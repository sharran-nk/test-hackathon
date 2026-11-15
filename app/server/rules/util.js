// Small helpers shared by the rules. The rules are pure functions: no HTTP, no database.

// Plain character comparison, so the order is identical on every machine (no locale).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Groups shifts per employee. Returns [employeeId, shifts[]] pairs, employees in ID order,
// each person's shifts sorted by (start, end, shiftId).
function byEmployee(shifts) {
  const map = new Map();
  for (const s of shifts) {
    if (!map.has(s.employeeId)) map.set(s.employeeId, []);
    map.get(s.employeeId).push(s);
  }
  return [...map.keys()].sort(cmp).map((id) => [
    id,
    map.get(id).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || cmp(a.shiftId, b.shiftId)),
  ]);
}

const describeShift = (s) => `${s.shiftId} (${s.storeId}, ${s.date} ${s.start}-${s.end})`;

module.exports = { cmp, byEmployee, describeShift };
