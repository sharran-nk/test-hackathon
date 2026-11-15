const mongoose = require('mongoose');

// The roster rows that passed validation. Names, roles and contracted hours are never stored
// (strict mode drops unknown fields). Expires RETENTION_DAYS after createdAt (TTL index).
const retentionSeconds = (Number(process.env.RETENTION_DAYS) || 30) * 86400;

const rosterSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set from the login in Milestone 4
  employees: [{ _id: false, employeeId: String, homeStore: String }],
  shifts: [{ _id: false, shiftId: String, employeeId: String, storeId: String, date: String, start: String, end: String }],
  leave: [{ _id: false, leaveId: String, employeeId: String, startDate: String, endDate: String, status: String }],
  createdAt: { type: Date, default: Date.now },
});
rosterSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionSeconds });
rosterSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.models.Roster || mongoose.model('Roster', rosterSchema);
