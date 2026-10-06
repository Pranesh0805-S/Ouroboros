const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');
const { generatePatch } = require('../services/patchGenerator');
const { runPatchInSandbox } = require('../services/sandboxRunner');

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

async function testPatch(req, res) {
  try {
    const patch = await Patch.findById(req.params.id);
    if (!patch) {
      return res.status(404).json({ error: 'Patch not found.' });
    }

    let result;
    try {
      result = await runPatchInSandbox({
        targetFile: patch.target_file,
        patchedContent: patch.generated_diff,
      });
    } catch (err) {
      // bad target_file, empty or oversized patch: not a sandbox failure
      return res.status(400).json({ error: err.message });
    }

    patch.test_result = result.status;
    patch.test_details = {
      tests: result.tests,
      pass: result.pass,
      fail: result.fail,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      testFile: result.testFile,
      output: result.output,
      ran_at: new Date(),
    };
    await patch.save();

    if (result.status === 'passed') {
      try {
        await Incident.findByIdAndUpdate(
          patch.incident_id,
          { status: 'tested' },
          { runValidators: true }
        );
      } catch (err) {
        console.warn('Could not set incident status to "tested":', err.message);
      }
    }

    console.log(
      `Patch ${patch._id} tested: ${result.status} (${result.pass}/${result.tests} passed, ${result.durationMs}ms)`
    );
    res.json({ success: true, status: result.status, patch });
  } catch (err) {
    console.error('Patch test error:', err.message);
    res.status(500).json({ error: 'Failed to test patch.' });
  }
}

module.exports = { createPatch, getPatchesForIncident, testPatch };