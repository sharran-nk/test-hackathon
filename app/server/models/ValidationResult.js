const mongoose = require('mongoose');

const retentionSeconds = (Number(process.env.RETENTION_DAYS) || 30) * 86400;

// One check run: the summary counts. The findings are separate documents (Finding).
const resultSchema = new mongoose.Schema({
  rosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roster', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  summary: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});
resultSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionSeconds });
resultSchema.index({ ownerId: 1, createdAt: -1 }); // history list, newest first
resultSchema.index({ rosterId: 1 });

module.exports = mongoose.models.ValidationResult || mongoose.model('ValidationResult', resultSchema);
