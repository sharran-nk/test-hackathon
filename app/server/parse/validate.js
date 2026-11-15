const { parseCsv } = require('./csv');

// Thrown when the request as a whole is unusable (400). Bad individual rows are NOT
// errors: they become DATA_BAD_ROW findings and are skipped, so the check still runs.
class InputError extends Error {}

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const COLUMNS = {
  employees: ['employee_id', 'home_store'],
  shifts: ['shift_id', 'employee_id', 'store_id', 'date', 'start', 'end'],
  leave: ['leave_id', 'employee_id', 'start_date', 'end_date', 'status'],
};
const FILE_NAME = { employees: 'employees.csv', shifts: 'shifts.csv', leave: 'leave.csv' };

// "2026-11-18" -> whole days since 1970-01-01, or null if not a real calendar date.
function dayNumber(text) {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return ms / 86400000;
}

function minutesOfDay(text) {
  const m = TIME_RE.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const show = (v) => (v.length > 40 ? v.slice(0, 40) + '...' : v) || '(empty)';

// Reads one file: checks the header, then hands each row to `build`, which returns
// { row } on success or { reason } on failure. Returns accepted rows and findings.
function readFile(kind, text, build, { required }) {
  const file = FILE_NAME[kind];
  if (typeof text !== 'string' || text.trim() === '') {
    if (required) throw new InputError(`${file} is empty. It needs a header row and data.`);
    return { rows: [], findings: [], skipped: 0 };
  }
  const { header, rows } = parseCsv(text);
  const missing = COLUMNS[kind].filter((c) => !header.includes(c));
  if (missing.length) {
    throw new InputError(`${file} is missing column(s): ${missing.join(', ')}.`);
  }
  const col = {};
  header.forEach((name, i) => { col[name] = i; });

  const accepted = [];
  const findings = [];
  let skipped = 0;
  for (const { line, fields } of rows) {
    let result;
    if (fields.length !== header.length) {
      result = { reason: `expected ${header.length} fields but found ${fields.length}` };
    } else {
      const get = (name) => fields[col[name]];
      result = build(get, line);
    }
    if (result.row) {
      accepted.push(result.row);
    } else {
      skipped += 1;
      findings.push({
        rule: 'DATA_BAD_ROW',
        severity: 'error',
        employeeId: result.employeeId || null,
        shiftIds: result.shiftIds || [],
        message: `${file} line ${line}: ${result.reason}. Row skipped.`,
        source: file,
        line,
      });
    }
  }
  return { rows: accepted, findings, skipped };
}

// Parses and validates the three CSV texts. Names, roles and contracted hours are
// never copied into the output (privacy: S1).
function parseRoster({ employees, shifts, leave }) {
  const findings = [];
  let rowsSkipped = 0;

  // --- employees: only id and home store are kept ---
  const seenEmployees = new Set();
  const emp = readFile('employees', employees, (get) => {
    const id = get('employee_id');
    const store = get('home_store');
    if (!ID_RE.test(id)) return { reason: `employee_id "${show(id)}" is not a valid ID` };
    if (!ID_RE.test(store)) return { reason: `home_store "${show(store)}" is not a valid ID`, employeeId: id };
    if (seenEmployees.has(id)) return { reason: `employee_id ${id} appears more than once`, employeeId: id };
    seenEmployees.add(id);
    return { row: { employeeId: id, homeStore: store } };
  }, { required: true });
  findings.push(...emp.findings);
  rowsSkipped += emp.skipped;
  // Assumption: known stores are the distinct home_store values.
  const stores = new Set(emp.rows.map((e) => e.homeStore));
  const knownEmployees = new Set(emp.rows.map((e) => e.employeeId));

  // --- shifts ---
  const seenShiftIds = new Map(); // shift_id -> content of the first row with that id
  const sh = readFile('shifts', shifts, (get, line) => {
    const shiftId = get('shift_id');
    const employeeId = get('employee_id');
    const storeId = get('store_id');
    const date = get('date');
    const start = get('start');
    const end = get('end');
    const ids = {
      employeeId: ID_RE.test(employeeId) ? employeeId : null,
      shiftIds: ID_RE.test(shiftId) ? [shiftId] : [],
    };
    if (!ID_RE.test(shiftId)) return { reason: `shift_id "${show(shiftId)}" is not a valid ID` };
    if (!ID_RE.test(employeeId)) return { reason: `employee_id "${show(employeeId)}" is not a valid ID`, ...ids };
    if (!ID_RE.test(storeId)) return { reason: `store_id "${show(storeId)}" is not a valid ID`, ...ids };
    const day = dayNumber(date);
    if (day === null) return { reason: `date "${show(date)}" is not a real date in YYYY-MM-DD format`, ...ids };
    const s = minutesOfDay(start);
    if (s === null) return { reason: `start "${show(start)}" is not a time in HH:MM format`, ...ids };
    const e = minutesOfDay(end);
    if (e === null) return { reason: `end "${show(end)}" is not a time in HH:MM format`, ...ids };
    if (e <= s) return { reason: `end ${end} is not after start ${start}`, ...ids };

    const content = [employeeId, storeId, date, start, end].join('|');
    if (seenShiftIds.has(shiftId) && seenShiftIds.get(shiftId) !== content) {
      return { reason: `shift_id ${shiftId} is reused with different details`, ...ids };
    }
    if (!seenShiftIds.has(shiftId)) seenShiftIds.set(shiftId, content);
    return {
      row: {
        shiftId, employeeId, storeId, date, start, end, line,
        startMin: day * 1440 + s,
        endMin: day * 1440 + e,
      },
    };
  }, { required: true });
  findings.push(...sh.findings);
  rowsSkipped += sh.skipped;

  // --- leave (the file is optional) ---
  const lv = readFile('leave', leave, (get) => {
    const leaveId = get('leave_id');
    const employeeId = get('employee_id');
    const startDate = get('start_date');
    const endDate = get('end_date');
    const status = get('status').toLowerCase();
    if (!ID_RE.test(leaveId)) return { reason: `leave_id "${show(leaveId)}" is not a valid ID` };
    if (!ID_RE.test(employeeId)) return { reason: `employee_id "${show(employeeId)}" is not a valid ID` };
    const a = dayNumber(startDate);
    const b = dayNumber(endDate);
    if (a === null) return { reason: `start_date "${show(startDate)}" is not a real date in YYYY-MM-DD format`, employeeId };
    if (b === null) return { reason: `end_date "${show(endDate)}" is not a real date in YYYY-MM-DD format`, employeeId };
    if (b < a) return { reason: 'end_date is before start_date', employeeId };
    if (status === '') return { reason: 'status is empty', employeeId };
    return { row: { leaveId, employeeId, startDate, endDate, status, startDay: a, endDay: b } };
  }, { required: false });
  findings.push(...lv.findings);
  rowsSkipped += lv.skipped;

  // --- references: shifts and leave must name a known employee; shifts a known store ---
  const keptShifts = [];
  for (const s of sh.rows) {
    const badEmp = !knownEmployees.has(s.employeeId);
    const badStore = !stores.has(s.storeId);
    if (badEmp || badStore) {
      rowsSkipped += 1;
      const why = badEmp
        ? `employee ${s.employeeId} is not in employees.csv`
        : `store ${s.storeId} is not a known store`;
      findings.push({
        rule: 'UNKNOWN_REF',
        severity: 'error',
        employeeId: s.employeeId,
        shiftIds: [s.shiftId],
        message: `shifts.csv line ${s.line}: ${why}. Row skipped.`,
        source: 'shifts.csv',
        line: s.line,
      });
    } else {
      keptShifts.push(s);
    }
  }
  const keptLeave = [];
  for (const l of lv.rows) {
    if (!knownEmployees.has(l.employeeId)) {
      rowsSkipped += 1;
      findings.push({
        rule: 'UNKNOWN_REF',
        severity: 'error',
        employeeId: l.employeeId,
        shiftIds: [],
        message: `leave.csv: leave ${l.leaveId} names employee ${l.employeeId}, who is not in employees.csv. Row skipped.`,
        source: 'leave.csv',
        line: null,
      });
    } else {
      keptLeave.push(l);
    }
  }

  return {
    employees: emp.rows,
    shifts: keptShifts,
    leave: keptLeave,
    findings,
    rowsSkipped,
    shiftsReceived: sh.rows.length + sh.skipped,
  };
}

module.exports = { parseRoster, InputError, dayNumber, minutesOfDay };
