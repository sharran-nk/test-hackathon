const { cmp } = require('./util');

// A shift on a day of approved leave is a finding. Only status "approved" counts
// (assumption D7). Leave runs from start_date to end_date, both included (D8).
// Cost: shifts x that person's leave rows, which is small.
function findLeaveClashes(shifts, leave) {
  const approved = new Map(); // employeeId -> leave rows, in leave_id order
  for (const l of leave) {
    if (l.status !== 'approved') continue;
    if (!approved.has(l.employeeId)) approved.set(l.employeeId, []);
    approved.get(l.employeeId).push(l);
  }
  for (const rows of approved.values()) rows.sort((a, b) => cmp(a.leaveId, b.leaveId));

  const findings = [];
  for (const s of shifts) {
    const rows = approved.get(s.employeeId);
    if (!rows) continue;
    const day = Math.floor(s.startMin / 1440);
    const hit = rows.find((l) => l.startDay <= day && day <= l.endDay);
    if (hit) {
      findings.push({
        rule: 'ON_LEAVE',
        severity: 'error',
        employeeId: s.employeeId,
        shiftIds: [s.shiftId],
        message: `${s.employeeId} is rostered on ${s.shiftId} at ${s.storeId} on ${s.date} ${s.start}-${s.end}, during approved leave ${hit.leaveId} (${hit.startDate} to ${hit.endDate}).`,
        _t: s.startMin,
      });
    }
  }
  return findings;
}

module.exports = { findLeaveClashes };
