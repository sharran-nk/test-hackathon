const { byEmployee } = require('./util');

// Sweep-line overlap detection (Decision 10), O(n log n + k).
// For each person, shifts are sorted by start. For each shift, drop active shifts that
// end at or before its start (touching is NOT an overlap), then pair it with every shift
// still active. This finds every pair, including nested and three-way overlaps.
// Reporting stops at maxFindings and sets truncated, so it is never silent.
function findOverlaps(shifts, maxFindings) {
  const findings = [];
  let truncated = false;

  for (const [employeeId, list] of byEmployee(shifts)) {
    let active = [];
    for (const s of list) {
      active = active.filter((a) => a.endMin > s.startMin);
      for (const a of active) {
        if (findings.length >= maxFindings) {
          return { findings, truncated: true };
        }
        const sameStore = a.storeId === s.storeId;
        findings.push({
          rule: 'OVERLAP',
          severity: 'error',
          employeeId,
          shiftIds: [a.shiftId, s.shiftId],
          message: sameStore
            ? `${employeeId} is booked twice at ${s.storeId} on ${s.date}: ${a.shiftId} ${a.start}-${a.end} overlaps ${s.shiftId} ${s.start}-${s.end}.`
            : `${employeeId} is booked at two stores at once on ${s.date}: ${a.shiftId} at ${a.storeId} ${a.start}-${a.end} overlaps ${s.shiftId} at ${s.storeId} ${s.start}-${s.end}.`,
          _t: a.startMin,
        });
      }
      active.push(s);
    }
  }
  return { findings, truncated };
}

module.exports = { findOverlaps };
