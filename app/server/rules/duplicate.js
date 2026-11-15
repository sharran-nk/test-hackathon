// Exact duplicate rows (same shift_id and identical details) are reported once and
// removed, so a duplicate is never also reported as a person overlapping themselves.
// (A reused shift_id with different details was already rejected by the parser.)
function removeDuplicates(shifts) {
  const first = new Map(); // shiftId -> the copy we keep
  const copies = new Map(); // shiftId -> line numbers of every copy
  const unique = [];
  for (const s of shifts) {
    if (!first.has(s.shiftId)) {
      first.set(s.shiftId, s);
      copies.set(s.shiftId, [s.line]);
      unique.push(s);
    } else {
      copies.get(s.shiftId).push(s.line);
    }
  }
  const findings = [];
  for (const [shiftId, lines] of copies) {
    if (lines.length < 2) continue;
    const s = first.get(shiftId);
    findings.push({
      rule: 'DUPLICATE_ROW',
      severity: 'warning',
      employeeId: s.employeeId,
      shiftIds: [shiftId],
      message: `shifts.csv lines ${lines.join(', ')}: shift ${shiftId} appears ${lines.length} times with identical details. It is counted once.`,
      source: 'shifts.csv',
      line: lines[1],
    });
  }
  return { unique, findings };
}

module.exports = { removeDuplicates };
