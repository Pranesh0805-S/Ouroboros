const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');

async function getMetrics(req, res) {
  try {
    const [totalIncidents, byStatus, byTest, byApproval, timing] = await Promise.all([
      Incident.countDocuments(),
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Patch.aggregate([{ $group: { _id: '$test_result', count: { $sum: 1 } } }]),
      Patch.aggregate([{ $group: { _id: { $ifNull: ['$approval_status', 'pending'] }, count: { $sum: 1 } } }]),
      Patch.aggregate([
        { $lookup: { from: 'incidents', localField: 'incident_id', foreignField: '_id', as: 'incident' } },
        { $unwind: '$incident' },
        { $project: { ms: { $subtract: ['$createdAt', '$incident.createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$ms' } } },
      ]),
    ]);

    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.count]));
    const testMap = toMap(byTest);
    const approvalMap = toMap(byApproval);

    res.json({
      total_incidents: totalIncidents,
      incidents_by_status: toMap(byStatus),
      patches_by_test_result: testMap,
      patches_by_approval: approvalMap,
      awaiting_review: await Patch.countDocuments({ test_result: 'passed', approval_status: { $nin: ['approved', 'rejected'] } }),
      mean_time_to_patch_ms: timing[0]?.avgMs ?? null,
    });
  } catch (err) {
    console.error('Metrics error:', err.message);
    res.status(500).json({ error: 'Failed to compute metrics.' });
  }
}

module.exports = { getMetrics };