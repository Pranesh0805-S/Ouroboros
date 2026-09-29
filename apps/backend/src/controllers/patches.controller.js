const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');
const { generatePatch } = require('../services/patchGenerator');

async function createPatch(req, res) {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    if (!incident.classified_type) {
      return res.status(400).json({ error: 'Incident has not been classified yet.' });
    }

    const result = await generatePatch(incident);

    const patch = await Patch.create({
      incident_id: incident._id,
      generated_diff: result.generated_diff,
      target_file: result.target_file,
      explanation: result.explanation,
      confidence_score: result.confidence_score,
    });

    incident.status = 'patched';
    await incident.save();

    console.log(`Patch generated for incident ${incident._id} (confidence: ${result.confidence_score})`);

    res.status(201).json({ success: true, patch });
  } catch (err) {
    console.error('Patch generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate patch.' });
  }
}

async function getPatchesForIncident(req, res) {
  try {
    const patches = await Patch.find({ incident_id: req.params.id }).sort({ createdAt: -1 });
    res.json({ count: patches.length, patches });
  } catch (err) {
    console.error('Fetch patches error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patches.' });
  }
}

module.exports = { createPatch, getPatchesForIncident };