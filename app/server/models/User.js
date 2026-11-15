const mongoose = require('mongoose');

// Accounts. Only a bcrypt hash is stored, never a password. Employees are keyed by their
// employee ID (E001...); no names are kept.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  role: { type: String, required: true, enum: ['manager', 'employee'] },
  employeeId: { type: String, default: undefined }, // employees only
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
