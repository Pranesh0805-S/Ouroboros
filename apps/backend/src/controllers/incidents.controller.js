const Incident = require('../models/Incident.model');
const { classifyByRules } = require('../classifier/rules');
const { classifyByLLM } = require('../classifier/llm-fallback');
const { storeIncidentEmbedding, findSimilarIncidents } = require('../services/incidentEmbedding');

async function ingestIncident(req, res) {
  try {
    const { source_repo, route, error_type, message, stack, context } = req.body;

    if (!source_repo || !error_type || !message) {
      return res.status(400).json({
        error: 'Missing required fields: source_repo, error_type, and message are required.'
      });
    }

    const incident = await Incident.create({
      source_repo,
      route,
      error_type,
      message,
      stack,
      context
    });

    let result = classifyByRules(incident);

    if (!result) {
      console.log(`No rule matched for incident ${incident._id}, falling back to LLM...`);
      result = await classifyByLLM(incident);
    }

    incident.classified_type = result.label;
    incident.classification_source = result.source;
    incident.status = 'classified';
    await incident.save();

    console.log(`Incident ingested: ${incident.error_type} → classified as: ${incident.classified_type} (source: ${incident.classification_source}) (${incident._id})`);

    // Phase 3: generate + store embedding for future similarity search
    try {
      await storeIncidentEmbedding(incident);
      console.log(`Embedding stored for incident ${incident._id}`);
    } catch (embedErr) {
      console.error(`Embedding storage failed for incident ${incident._id}:`, embedErr.message);
    }

    res.status(201).json({ success: true, incident });
  } catch (err) {
    console.error('Ingest error:', err.message);
    res.status(500).json({ error: 'Failed to ingest incident.' });
  }
}

async function getAllIncidents(req, res) {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.json({ count: incidents.length, incidents });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch incidents.' });
  }
}

async function getSimilarIncidents(req, res) {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    const similar = await findSimilarIncidents(incident);

    res.json({ incident_id: incident._id, similar_incidents: similar });
  } catch (err) {
    console.error('Similarity search error:', err.message);
    res.status(500).json({ error: 'Failed to find similar incidents.' });
  }
}

module.exports = { ingestIncident, getAllIncidents, getSimilarIncidents };