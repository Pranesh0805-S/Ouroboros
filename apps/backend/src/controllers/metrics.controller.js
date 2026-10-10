const Incident = require('../models/Incident.model');
const Patch = require('../models/Patch.model');

async function getMetrics(req, res) {
  try {
    const [totalIncidents, byStatus, byTest, byApproval, timing, awaitingReview] = await Promise.all([
      Incident.countDocuments(),
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Patch.aggregate([{ $group: { _id: '$test_result', count: { $sum: 1 } } }]),
      Patch.aggregate([{ $group: { _id: { $ifNull: ['$approval_status', 'pending'] }, count: { $sum: 1 } } }]),
      // time from patch creation to the human approve/reject decision
      Patch.aggregate([
        { $match: { reviewed_at: { $exists: true, $ne: null } } },
        { $project: { ms: { $subtract: ['$reviewed_at', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$ms' } } },
      ]),
      Patch.countDocuments({ test_result: 'passed', approval_status: { $nin: ['approved', 'rejected'] } }),
    ]);

    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.count]));

    res.json({
      total_incidents: totalIncidents,
      incidents_by_status: toMap(byStatus),
      patches_by_test_result: toMap(byTest),
      patches_by_approval: toMap(byApproval),
      awaiting_review: awaitingReview,
      mean_time_to_review_ms: timing[0]?.avgMs ?? null,
    });
  } catch (err) {
    console.error('Metrics error:', err.message);
    res.status(500).json({ error: 'Failed to compute metrics.' });
  }
}

module.exports = { getMetrics };
