// Pure display logic: turns the API's findings into short plain-English lines, groups them per
// employee and counts them for the filter chips. No React, no network, no storage.
//
// The API's findings carry no store or times, so the sentences are built from the CSV text the
// page already holds (employees, shifts, leave). Names are never read: only IDs, stores,
// dates and times. If a lookup fails, the line falls back to the server's own sentence.

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

// Shown when the finding has no `hint` of its own (the server does not send hints yet).
const DEFAULT_HINT = {
  OVERLAP: 'Move one of the shifts, or end the first one before the second starts.',
  SHORT_REST: 'Start the later shift later, or end the earlier one sooner.',
  ON_LEAVE: 'Give the shift to someone else, or move it to another day.',
  DATA_BAD_ROW: 'Correct the row in the file, then check again.',
  DUPLICATE_ROW: 'Delete the repeated row from the file.',
  UNKNOWN_REF: 'Add the missing ID to the employees file, or correct the row.',
};

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

export function buildLookup({ employees, shifts, leave }) {
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
const dayLong = (iso) => { const p = dateParts(iso); return p ? `${p.weekday} ${p.day} ${p.month}` : iso; };
const dayShort = (iso) => { const p = dateParts(iso); return p ? p.weekday : iso; };
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
    .replace(/\.$/, '');
}
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------- one finding -> one plain line ----------

export function describeFinding(f, lookup) {
  const hint = f.hint || DEFAULT_HINT[f.rule] || '';
  const group = GROUP_OF[f.rule] || 'data';
  const [id1, id2] = f.shiftIds || [];
  const a = lookup && lookup.shift.get(id1);
  const b = lookup && lookup.shift.get(id2);
  let text = null;

  if (f.rule === 'OVERLAP' && a && b) {
    text = a.store === b.store
      ? `Double-booked on ${dayLong(b.date)}: ${span(a)} and ${span(b)} at ${a.store}`
      : `Double-booked on ${dayLong(b.date)}: ${span(a)} at ${a.store} and ${span(b)} at ${b.store}`;
  } else if (f.rule === 'SHORT_REST' && a && b) {
    const gap = gapText(a, b);
    if (gap) {
      const needs = /minimum is (\d+)h/.exec(f.message || '');
      text = `Only ${gap} rest between ${dayShort(a.date)} ${a.end} and ${dayShort(b.date)} ${b.start}`
        + (needs ? ` (needs ${needs[1]}h)` : '');
    }
  } else if (f.rule === 'ON_LEAVE' && a) {
    const leaveId = /approved leave ([\w-]+)/.exec(f.message || '');
    text = `Rostered ${dayLong(a.date)} ${span(a)} at ${a.store} during approved leave${leaveId ? ` (${leaveId[1]})` : ''}`;
  } else if (f.rule === 'DUPLICATE_ROW') {
    const n = /appears (\d+) times/.exec(f.message || '');
    text = `Shift ${id1 || 'row'} appears ${n ? `${n[1]} times` : 'more than once'} with identical details. It was counted once`;
  } else if (f.rule === 'DATA_BAD_ROW' || f.rule === 'UNKNOWN_REF') {
    const reason = reasonOf(f.message);
    text = id1
      ? `Shift ${id1}: ${reason}. This row was not checked`
      : `${capitalise(reason)}. This row was not checked`;
  }

  return {
    text: text || f.message,
    hint,
    group,
    severity: f.severity,
    fellBack: text === null,
  };
}

// ---------- grouping, sorting, counting ----------

const SEV_RANK = { error: 0, warning: 1 };
const GROUP_RANK = { overlap: 0, rest: 1, leave: 2, data: 3 };

export function countByGroup(findings) {
  const c = { all: findings.length, overlap: 0, rest: 0, leave: 0, data: 0 };
  for (const f of findings) c[GROUP_OF[f.rule] || 'data'] += 1;
  return c;
}

// One card per employee. Cards: errors before warnings, then by ID; findings not tied to an
// employee come last. Inside a card: roster problems before data issues, errors before warnings.
export function groupByEmployee(findings, lookup, chip = 'all') {
  const wanted = chip === 'all' ? findings : findings.filter((f) => (GROUP_OF[f.rule] || 'data') === chip);
  const cards = new Map();
  for (const f of wanted) {
    const key = f.employeeId || '';
    if (!cards.has(key)) {
      cards.set(key, { employeeId: f.employeeId || null, store: (lookup && lookup.homeStore.get(key)) || null, items: [] });
    }
    cards.get(key).items.push({ finding: f, ...describeFinding(f, lookup) });
  }
  const list = [...cards.values()];
  for (const card of list) {
    card.items.sort((x, y) =>
      GROUP_RANK[x.group] - GROUP_RANK[y.group]
      || SEV_RANK[x.severity] - SEV_RANK[y.severity]
      || x.finding.seq - y.finding.seq);
    card.worst = card.items.some((i) => i.severity === 'error') ? 'error' : 'warning';
  }
  list.sort((x, y) => {
    if ((x.employeeId === null) !== (y.employeeId === null)) return x.employeeId === null ? 1 : -1;
    return SEV_RANK[x.worst] - SEV_RANK[y.worst]
      || (x.employeeId || '').localeCompare(y.employeeId || '', 'en');
  });
  return list;
}

// Text for the slim amber strip above the data details.
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
