const mongoose = require('mongoose');

const PatchSchema = new mongoose.Schema({
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  generated_diff: { type: String, required: true },
  target_file: { type: String, required: true },
  explanation: { type: String },
  confidence_score: { type: Number, default: null },
  test_result: { type: String, enum: ['pending', 'passed', 'failed', null], default: 'pending' },
  deployed: { type: Boolean, default: false },
  outcome: { type: String, enum: ['success', 'reverted', 'pending'], default: 'pending' },
}, {
  timestamps: true
});

module.exports = mongoose.model('Patch', PatchSchema);