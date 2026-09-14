const Incident = require('../models/Incident.model');
const { classifyByRules } = require('../classifier/rules');

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

    const ruleResult = classifyByRules(incident);

    if (ruleResult) {
      incident.classified_type = ruleResult.label;
      incident.classification_source = ruleResult.source;
      incident.status = 'classified';
      await incident.save();
    } else {
      // No rule matched — this is where Phase 2's LLM fallback will kick in later
      console.log(`No rule matched for incident ${incident._id}, needs LLM fallback`);
    }

    console.log(`Incident ingested: ${incident.error_type} → classified as: ${incident.classified_type || 'UNCLASSIFIED'} (${incident._id})`);

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

module.exports = { ingestIncident, getAllIncidents };