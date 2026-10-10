const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');
const { generatePatch } = require('../services/patchGenerator');
const { runPatchInSandbox } = require('../services/sandboxRunner');

// apps/backend/src/controllers -> apps/sample-buggy-app
const APP_ROOT = path.resolve(__dirname, '../../../sample-buggy-app');

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

async function reviewPatch(req, res, decision) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patch id.' });
    }

    const patch = await Patch.findById(req.params.id);
    if (!patch) {
      return res.status(404).json({ error: 'Patch not found.' });
    }

    if (patch.approval_status && patch.approval_status !== 'pending') {
      return res.status(409).json({ error: `Patch already ${patch.approval_status}.` });
    }

    // safety gate: only patches that passed the sandbox can be approved
    if (decision === 'approved' && patch.test_result !== 'passed') {
      return res.status(400).json({ error: 'Only patches that passed sandbox tests can be approved.' });
    }

    patch.approval_status = decision;
    patch.review_note = req.body?.note || undefined;
    patch.reviewed_at = new Date();
    await patch.save();

    console.log(`Patch ${patch._id} ${decision}`);
    res.json({ success: true, patch });
  } catch (err) {
    console.error('Patch review error:', err.message);
    res.status(500).json({ error: 'Failed to review patch.' });
  }
}

const approvePatch = (req, res) => reviewPatch(req, res, 'approved');
const rejectPatch = (req, res) => reviewPatch(req, res, 'rejected');

async function getPatchOriginal(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patch id.' });
    }

    const patch = await Patch.findById(req.params.id);
    if (!patch) {
      return res.status(404).json({ error: 'Patch not found.' });
    }

    const full = path.resolve(APP_ROOT, patch.target_file);
    if (!full.startsWith(APP_ROOT + path.sep)) {
      return res.status(400).json({ error: 'Invalid target_file.' });
    }

    const original = await fs.promises.readFile(full, 'utf8');
    res.json({ target_file: patch.target_file, original });
  } catch (err) {
    console.error('Original file error:', err.message);
    res.status(500).json({ error: 'Could not read original file.' });
  }
}

module.exports = {
  createPatch,
  getPatchesForIncident,
  testPatch,
  approvePatch,
  rejectPatch,
  getPatchOriginal,
};