// Pure display logic: turns the API's findings into table rows with one short plain line, and
// counts them for the tabs and pills. No React, no network, no storage.
//
// The API's findings carry no store or times, so the lines are built from the CSV text the
// page already holds (employees, shifts). Names are never read: only IDs, stores, dates and
// times. If a lookup fails, the row falls back to the server's own sentence.

export const GROUP_OF = {
  OVERLAP: 'overlap',
  SHORT_REST: 'rest',
  ON_LEAVE: 'leave',
  DATA_BAD_ROW: 'data',
  DUPLICATE_ROW: 'data',
  UNKNOWN_REF: 'data',
};

export const RULE_LABEL = {
  OVERLAP: 'Double-booked',
  SHORT_REST: 'Short rest',
  ON_LEAVE: 'On approved leave',
  DATA_BAD_ROW: 'Unreadable row',
  DUPLICATE_ROW: 'Duplicate row',
  UNKNOWN_REF: 'Unknown ID',
};

const GROUP_RANK = { overlap: 0, rest: 1, leave: 2, data: 3 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- reading the loaded CSV text (display only; the server does the real validation) ----------

function csvObjects(text) {
  const lines = String(text || '').replace(/^﻿/, '').split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

// Data rows in a CSV text (header and blank lines excluded). Used for the "155 rows" tick.
export function countRows(text) {
  const n = String(text || '').split('\n').filter((l) => l.trim() !== '').length;
  return Math.max(0, n - 1);
}

export function buildLookup({ employees, shifts }) {
  const homeStore = new Map();
  for (const r of csvObjects(employees)) if (r.employee_id) homeStore.set(r.employee_id, r.home_store);
  const shift = new Map();
  for (const r of csvObjects(shifts)) {
    if (r.shift_id && !shift.has(r.shift_id)) {
      shift.set(r.shift_id, { store: r.store_id, date: r.date, start: r.start, end: r.end });
    }
  }
  return { homeStore, shift };
}

// ---------- small formatters ----------

function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], ms: d.getTime() };
}
// "2026-11-18" -> "Wed 18 Nov". A value that is not a real date (an unreadable row) is shown as it was typed.
const dateLabel = (iso) => { const p = dateParts(iso); return p ? `${p.weekday} ${p.day} ${p.month}` : (iso || '–'); };
const span = (s) => `${s.start}–${s.end}`;
const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

function gapText(a, b) {
  const pa = dateParts(a.date);
  const pb = dateParts(b.date);
  if (!pa || !pb) return null;
  const mins = (pb.ms - pa.ms) / 60000 + minutesOf(b.start) - minutesOf(a.end);
  if (!Number.isFinite(mins) || mins < 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// "shifts.csv line 87: date "x" is not a real date. Row skipped." -> the part in the middle.
function reasonOf(message) {
  return String(message || '')
    .replace(/^[\w.]+(?: line \d+)?: /, '')
    .replace(/ Row skipped\.$/, '')
    .replace(/\.$/, '')
    .replace(/ in YYYY-MM-DD format$/, '');
}
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------- one finding -> date + one short line ----------

export function describeRow(f, lookup) {
  const [id1, id2] = f.shiftIds || [];
  const a = lookup && lookup.shift.get(id1);
  const b = lookup && lookup.shift.get(id2);
  let date = null;
  let description = null;

  if (f.rule === 'OVERLAP' && a && b) {
    date = dateLabel(b.date);
    description = a.store === b.store
      ? `${span(a)} overlaps ${span(b)} at ${a.store}`
      : `${span(a)} at ${a.store} overlaps ${span(b)} at ${b.store}`;
  } else if (f.rule === 'SHORT_REST' && a && b) {
    const gap = gapText(a, b);
    if (gap) {
      const needs = /minimum is (\d+)h/.exec(f.message || '');
      date = dateLabel(a.date);
      description = `Only ${gap} rest: ends ${a.end}, next starts ${b.start}` + (needs ? ` (needs ${needs[1]}h)` : '');
    }
  } else if (f.rule === 'ON_LEAVE' && a) {
    const leaveId = /approved leave ([\w-]+)/.exec(f.message || '');
    date = dateLabel(a.date);
    description = `${span(a)} at ${a.store} during approved leave${leaveId ? ` ${leaveId[1]}` : ''}`;
  } else if (f.rule === 'DUPLICATE_ROW') {
    const n = /appears (\d+) times/.exec(f.message || '');
    date = a ? dateLabel(a.date) : null;
    description = `Appears ${n ? `${n[1]} times` : 'more than once'} with identical details. Counted once`;
  } else if (f.rule === 'DATA_BAD_ROW' || f.rule === 'UNKNOWN_REF') {
    date = a ? dateLabel(a.date) : null;
    description = `${capitalise(reasonOf(f.message))}. Row not checked`;
  }

  return {
    date: date || '–',
    description: description || f.message,
    fellBack: description === null,
  };
}

// ---------- rows, counts, status ----------

export function countByGroup(findings) {
  const c = { all: findings.length, overlap: 0, rest: 0, leave: 0, data: 0 };
  for (const f of findings) c[GROUP_OF[f.rule] || 'data'] += 1;
  return c;
}

// One row per finding for the table, optionally filtered by tab (all, overlap, rest, leave, data).
// Roster problems come before data rows; inside a group rows are ordered by employee, then as found.
export function tableRows(findings, lookup, tab = 'all') {
  return findings
    .filter((f) => tab === 'all' || (GROUP_OF[f.rule] || 'data') === tab)
    .map((f) => ({
      seq: f.seq,
      rule: f.rule,
      ruleLabel: RULE_LABEL[f.rule] || f.rule,
      group: GROUP_OF[f.rule] || 'data',
      severity: f.severity,
      employeeId: f.employeeId || '–',
      shiftIds: f.shiftIds && f.shiftIds.length ? f.shiftIds.join(', ') : '–',
      ...describeRow(f, lookup),
      finding: f,
    }))
    .sort((x, y) =>
      GROUP_RANK[x.group] - GROUP_RANK[y.group]
      || (x.employeeId < y.employeeId ? -1 : x.employeeId > y.employeeId ? 1 : 0)
      || x.seq - y.seq);
}

// The slim status bar text: "Not clear to publish: 4 problems".
export function statusLine(summary) {
  if (summary.clear) return { clear: true, text: 'Clear to publish' };
  const c = summary.counts;
  const problems = (c.OVERLAP || 0) + (c.SHORT_REST || 0) + (c.ON_LEAVE || 0);
  const data = (c.DATA_BAD_ROW || 0) + (c.DUPLICATE_ROW || 0) + (c.UNKNOWN_REF || 0);
  const say = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const parts = [];
  if (problems) parts.push(say(problems, 'problem', 'problems'));
  if (data) parts.push(say(data, 'data issue', 'data issues'));
  return { clear: false, text: `Not clear to publish: ${parts.join(' and ')}` };
}

// Text for the slim amber line above the data details.
export function dataStripText(findings) {
  const bad = findings.filter((f) => f.rule === 'DATA_BAD_ROW').length;
  const unknown = findings.filter((f) => f.rule === 'UNKNOWN_REF').length;
  const dup = findings.filter((f) => f.rule === 'DUPLICATE_ROW').length;
  const skipped = bad + unknown;
  const parts = [];
  if (skipped) parts.push(`${skipped} ${skipped === 1 ? 'row' : 'rows'} skipped (${[
    bad ? `${bad} unreadable` : '', unknown ? `${unknown} unknown ID` : '',
  ].filter(Boolean).join(', ')})`);
  if (dup) parts.push(`${dup} duplicate ${dup === 1 ? 'row' : 'rows'} counted once`);
  return parts.length ? parts.join(', ') : 'All rows were read. None were skipped or repeated.';
}

// ---------- recommended action per rule (fixed text, no AI) ----------

export const ACTION_FOR = {
  OVERLAP: 'Move one shift, or end the first before the second starts.',
  SHORT_REST: 'Start the second shift later, or give the first shift to someone else.',
  ON_LEAVE: 'Reassign the shift, or confirm the leave was cancelled and update leave.csv.',
  DUPLICATE_ROW: 'Delete the repeated row from shifts.csv.',
  DATA_BAD_ROW: 'Fix the row in the file (see the message) and upload again.',
  UNKNOWN_REF: 'Add the missing employee or store, or correct the ID in the row.',
};

export const GROUP_LABEL = { overlap: 'Overlap', rest: 'Rest', leave: 'Leave', data: 'Data quality' };

// ---------- store overview from the loaded CSV text (display only) ----------
// Stores are the distinct home_store values; shifts are counted per store_id. No names are read.
export function storeSummary({ employees, shifts }) {
  const staff = new Map();
  for (const r of csvObjects(employees)) if (r.home_store) staff.set(r.home_store, (staff.get(r.home_store) || 0) + 1);
  const shiftCount = new Map();
  const dates = [];
  for (const r of csvObjects(shifts)) {
    if (r.store_id) shiftCount.set(r.store_id, (shiftCount.get(r.store_id) || 0) + 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) dates.push(r.date);
  }
  const ids = [...new Set([...staff.keys(), ...shiftCount.keys()])].sort();
  dates.sort();
  return {
    stores: ids.map((id) => ({ id, employees: staff.get(id) || 0, shifts: shiftCount.get(id) || 0 })),
    from: dates[0] || null,
    to: dates[dates.length - 1] || null,
  };
}
