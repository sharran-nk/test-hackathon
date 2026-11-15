const mongoose = require('mongoose');
const Roster = require('./models/Roster');
const ValidationResult = require('./models/ValidationResult');
const Finding = require('./models/Finding');
const db = require('./db');

// All database reads and writes for saved checks. The routes only talk to this file.
//
// Standalone MongoDB has no multi-document transactions, so none are used. Instead:
//   save:   roster, then findings, then the result LAST. A result therefore never exists
//           without its findings. If any step fails, what was written is deleted again.
//           If that cleanup also fails, the leftovers have no result so no API can reach
//           them, and the 30-day TTL index removes them.
//   delete: the result first (so it disappears from the API at once), then findings, then roster.

const ID_RE = /^[0-9a-f]{24}$/i;
const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

async function saveCheck({ parsed, summary, findings, ownerId }) {
  const resultId = new mongoose.Types.ObjectId();
  const roster = new Roster({ ownerId, employees: parsed.employees, shifts: parsed.shifts, leave: parsed.leave });
  try {
    await roster.save();
    if (findings.length) {
      await Finding.insertMany(findings.map((f) => ({ ...f, resultId })), { ordered: true });
    }
    await ValidationResult.create({ _id: resultId, ownerId, rosterId: roster._id, summary });
    return String(resultId);
  } catch (err) {
    await Promise.allSettled([
      ValidationResult.deleteOne({ _id: resultId }),
      Finding.deleteMany({ resultId }),
      Roster.deleteOne({ _id: roster._id }),
    ]);
    throw err;
  }
}

async function listResults({ page, limit }) {
  const [total, docs] = await Promise.all([
    ValidationResult.countDocuments({}),
    ValidationResult.find({}).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return {
    total,
    items: docs.map((d) => ({ id: String(d._id), createdAt: d.createdAt, summary: d.summary })),
  };
}

// Returns null if there is no such result (never saved, deleted or expired).
async function getResult(id) {
  const result = await ValidationResult.findById(id).lean();
  if (!result) return null;
  const [findings, roster] = await Promise.all([
    Finding.find({ resultId: result._id }).sort({ seq: 1 }).select('-_id -resultId -__v -createdAt').lean(),
    Roster.findById(result.rosterId).select('employees shifts leave').lean(),
  ]);
  return {
    id: String(result._id),
    createdAt: result.createdAt,
    summary: result.summary,
    // Only counts of the roster are returned, not the rows themselves.
    roster: {
      employees: roster ? roster.employees.length : 0,
      shifts: roster ? roster.shifts.length : 0,
      leave: roster ? roster.leave.length : 0,
    },
    findings,
  };
}

// Returns false if there was nothing to delete.
async function deleteResult(id) {
  const result = await ValidationResult.findOneAndDelete({ _id: id }).lean();
  if (!result) return false;
  await Promise.all([
    Finding.deleteMany({ resultId: result._id }),
    Roster.deleteOne({ _id: result.rosterId }),
  ]);
  return true;
}

// One employee's own view of the latest saved check (by any manager). Only that employee's rows
// are selected, so nothing about anyone else leaves this function.
async function getEmployeeSchedule(employeeId) {
  const latest = await ValidationResult.findOne({}).sort({ createdAt: -1, _id: -1 }).lean();
  const roster = latest && (await Roster.findById(latest.rosterId).select('employees shifts leave').lean());
  if (!latest || !roster) {
    return { hasRoster: false, employeeId, rosterDate: null, homeStore: null, shifts: [], leave: [], findings: [] };
  }
  const me = roster.employees.find((e) => e.employeeId === employeeId);
  const findings = await Finding.find({ resultId: latest._id, employeeId }).sort({ seq: 1 }).lean();
  return {
    hasRoster: true,
    employeeId,
    rosterDate: latest.createdAt,
    homeStore: me ? me.homeStore : null,
    shifts: roster.shifts
      .filter((s) => s.employeeId === employeeId)
      .map(({ shiftId, storeId, date, start, end }) => ({ shiftId, storeId, date, start, end }))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    leave: roster.leave
      .filter((l) => l.employeeId === employeeId)
      .map(({ leaveId, startDate, endDate, status }) => ({ leaveId, startDate, endDate, status })),
    findings: findings.map(({ rule, severity, shiftIds, message }) => ({ rule, severity, shiftIds, message })),
  };
}

module.exports = { saveCheck, getEmployeeSchedule, listResults, getResult, deleteResult, isValidId, isUp: db.isUp };
