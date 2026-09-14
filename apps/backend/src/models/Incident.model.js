const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  source_repo: { type: String, required: true },
  route: { type: String },
  error_type: { type: String, required: true },
  message: { type: String, required: true },
  stack: { type: String },
  context: { type: mongoose.Schema.Types.Mixed },
  classified_type: { type: String, default: null },
  classification_source: { type: String, enum: ['rule', 'llm', null], default: null },
  status: { type: String, enum: ['new', 'classified', 'patched', 'resolved'], default: 'new' },
}, {
  timestamps: true
});

module.exports = mongoose.model('Incident', IncidentSchema);