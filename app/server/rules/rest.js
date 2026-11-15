const { byEmployee } = require('./util');

// Less than minRestHours between the end of one shift and the start of the next is a
// finding. Exactly the minimum is allowed. After sorting we track the shift that ends
// latest; if the next shift starts before that, the two overlap and the OVERLAP rule
// already covers it, so rest is skipped. Touching shifts have a 0h gap and are flagged
// (assumption, to confirm). Cost O(n) after the sort.
function findShortRest(shifts, minRestHours) {
  const minRestMin = minRestHours * 60;
  const findings = [];
  for (const [employeeId, list] of byEmployee(shifts)) {
    let latest = null; // the shift that ends latest so far
    for (const s of list) {
      if (latest && s.startMin >= latest.endMin) {
        const gap = s.startMin - latest.endMin;
        if (gap < minRestMin) {
          findings.push({
            rule: 'SHORT_REST',
            severity: 'error',
            employeeId,
            shiftIds: [latest.shiftId, s.shiftId],
            message: `${employeeId} has only ${Math.floor(gap / 60)}h ${gap % 60}m rest between ${latest.shiftId} (ends ${latest.date} ${latest.end}) and ${s.shiftId} (starts ${s.date} ${s.start}). The minimum is ${minRestHours}h.`,
            _t: latest.startMin,
          });
        }
      }
      if (!latest || s.endMin > latest.endMin) latest = s;
    }
  }
  return findings;
}

module.exports = { findShortRest };
