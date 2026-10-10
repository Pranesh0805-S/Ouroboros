const mongoose = require('mongoose');

const PatchSchema = new mongoose.Schema({
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  generated_diff: { type: String, required: true },
  target_file: { type: String, required: true },
  explanation: { type: String },
  confidence_score: { type: Number, default: null },
  test_result: { type: String, enum: ['pending', 'passed', 'failed', 'error', 'timeout', null], default: 'pending' },
  test_details: {
    tests: Number,
    pass: Number,
    fail: Number,
    durationMs: Number,
    exitCode: Number,
    testFile: String,
    output: String,
    ran_at: Date,
  },
  approval_status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  review_note: { type: String },
  reviewed_at: { type: Date },
  deployed: { type: Boolean, default: false },
  outcome: { type: String, enum: ['success', 'reverted', 'pending'], default: 'pending' },
}, {
  timestamps: true
});

module.exports = mongoose.model('Patch', PatchSchema);