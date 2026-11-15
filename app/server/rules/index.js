const { parseRoster } = require('../parse/validate');
const { removeDuplicates } = require('./duplicate');
const { findOverlaps } = require('./overlap');
const { findShortRest } = require('./rest');
const { findLeaveClashes } = require('./leave');
const { cmp } = require('./util');

const RULES = ['DATA_BAD_ROW', 'DUPLICATE_ROW', 'UNKNOWN_REF', 'OVERLAP', 'SHORT_REST', 'ON_LEAVE'];

// Findings without an employee or a time (bad rows) sort after the others.
function compareFindings(a, b) {
  const ea = a.employeeId === null ? '￿' : a.employeeId;
  const eb = b.employeeId === null ? '￿' : b.employeeId;
  const ta = a._t === undefined ? Number.MAX_SAFE_INTEGER : a._t;
  const tb = b._t === undefined ? Number.MAX_SAFE_INTEGER : b._t;
  return cmp(ea, eb)
    || cmp(ta, tb)
    || cmp(a.rule, b.rule)
    || cmp(a.shiftIds.join(','), b.shiftIds.join(','))
    || cmp(a.message, b.message);
}

// Whole pipeline: parse and validate -> remove exact duplicates -> overlap, rest and
// leave rules on the valid shifts -> sort -> number -> summarise.
// Bad rows never reach the rules. Same input always gives the same output in the same order.
function runCheck(files, { maxFindings = 1000, minRestHours = 11 } = {}) {
  const parsed = parseRoster(files);
  const { unique, findings: duplicateFindings } = removeDuplicates(parsed.shifts);
  const overlap = findOverlaps(unique, maxFindings);

  let findings = [
    ...parsed.findings,
    ...duplicateFindings,
    ...overlap.findings,
    ...findShortRest(unique, minRestHours),
    ...findLeaveClashes(unique, parsed.leave),
  ];

  // Deterministic order: employee, time of the first shift involved, rule, shift IDs.
  findings.sort(compareFindings);

  let truncated = overlap.truncated;
  if (findings.length > maxFindings) {
    findings = findings.slice(0, maxFindings);
    truncated = true;
  }

  const counts = Object.fromEntries(RULES.map((r) => [r, 0]));
  findings = findings.map((f, i) => {
    counts[f.rule] += 1;
    const { _t, ...rest } = f; // eslint-disable-line no-unused-vars
    return { seq: i + 1, ...rest };
  });

  return {
    findings,
    summary: {
      clear: findings.length === 0,
      shiftsReceived: parsed.shiftsReceived,
      shiftsChecked: unique.length,
      rowsSkipped: parsed.rowsSkipped,
      truncated,
      counts,
    },
  };
}

module.exports = { runCheck, RULES };
