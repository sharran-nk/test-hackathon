const mongoose = require('mongoose');

const retentionSeconds = (Number(process.env.RETENTION_DAYS) || 30) * 86400;

// One finding per document so a big result cannot hit MongoDB's 16 MB document limit.
// seq keeps the original order.
const findingSchema = new mongoose.Schema({
  resultId: { type: mongoose.Schema.Types.ObjectId, ref: 'ValidationResult', required: true },
  seq: { type: Number, required: true },
  rule: { type: String, required: true },
  severity: { type: String, required: true },
  employeeId: { type: String, default: null },
  shiftIds: [String],
  message: { type: String, required: true },
  source: String,
  line: Number,
  createdAt: { type: Date, default: Date.now },
});
findingSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionSeconds });
findingSchema.index({ resultId: 1, seq: 1 });
findingSchema.index({ resultId: 1, employeeId: 1 }); // employee-only lookups

module.exports = mongoose.models.Finding || mongoose.model('Finding', findingSchema);
