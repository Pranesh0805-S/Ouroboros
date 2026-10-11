const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');

const uniq = (arr) => [...new Set(arr)];

async function getOutcomeHistory(incident, limit = 3) {
  const filter = { classified_type: incident.classified_type };
  if (incident._id) filter._id = { $ne: incident._id };

  const ids = await Incident.find(filter).distinct('_id');
  if (!ids.length) return { successes: [], reverts: [], pitfalls: [] };

  const patches = await Patch.find({ incident_id: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const successes = uniq(patches.filter((p) => p.outcome === 'success' && p.explanation).map((p) => p.explanation)).slice(0, limit);
  const reverts = uniq(patches.filter((p) => p.outcome === 'reverted' && p.explanation).map((p) => p.explanation)).slice(0, limit);

  // names of tests that earlier attempts failed on
  const pitfalls = [];
  for (const p of patches) {
    for (const a of p.attempts || []) {
      if (a.test_result !== 'failed' || !a.output) continue;
      for (const m of a.output.matchAll(/^not ok \d+ - (.+)$/gm)) pitfalls.push(m[1].trim());
    }
  }

  return { successes, reverts, pitfalls: uniq(pitfalls).slice(0, limit) };
}

function formatHistory(h) {
  if (!h || (!h.successes.length && !h.reverts.length && !h.pitfalls.length)) return '';
  const lines = ['', 'LESSONS FROM THIS SYSTEM\'S OWN HISTORY (same bug class, for context only)'];
  if (h.successes.length) lines.push('Fixes that were applied and verified:', ...h.successes.map((s) => `- ${s}`));
  if (h.reverts.length) lines.push('Fixes that were REVERTED, avoid repeating them:', ...h.reverts.map((s) => `- ${s}`));
  if (h.pitfalls.length) lines.push('Tests that earlier patches failed, make sure yours passes them:', ...h.pitfalls.map((s) => `- ${s}`));
  return lines.join('\n') + '\n';
}

module.exports = { getOutcomeHistory, formatHistory };