// Tests the portal's pure display logic (client/src/describe.js) against the REAL seed result
// from the rules engine. The client file is an ES module, so it is loaded with import() (the
// test script runs Jest with --experimental-vm-modules).
const fs = require('fs');
const path = require('path');
const { runCheck } = require('../server/rules/index');

const seed = (f) => fs.readFileSync(path.join(__dirname, '../../case/seed', f), 'utf8');
const files = { employees: seed('employees.csv'), shifts: seed('shifts.csv'), leave: seed('leave.csv') };

let D;
let result;
let lookup;
beforeAll(async () => {
  D = await import('../client/src/describe.js');
  result = runCheck(files);
  lookup = D.buildLookup(files);
});

const rowFor = (rule, shiftId) => {
  const f = result.findings.find((x) => x.rule === rule && x.shiftIds.includes(shiftId));
  return D.describeRow(f, lookup);
};

describe('date and one short line per finding (the six seed problems)', () => {
  test('same-store double booking', () => {
    expect(rowFor('OVERLAP', 'SH024')).toMatchObject({ date: 'Wed 18 Nov', description: '09:00–15:00 overlaps 13:00–19:00 at S01' });
  });
  test('double booking across two stores names both stores', () => {
    expect(rowFor('OVERLAP', 'SH033')).toMatchObject({ date: 'Thu 19 Nov', description: '10:00–16:00 at S01 overlaps 12:00–18:00 at S02' });
  });
  test('short rest', () => {
    expect(rowFor('SHORT_REST', 'SH013')).toMatchObject({
      date: 'Tue 17 Nov',
      description: 'Only 8h rest: ends 22:00, next starts 06:00 (needs 11h)',
    });
  });
  test('shift on approved leave', () => {
    expect(rowFor('ON_LEAVE', 'SH098')).toMatchObject({ date: 'Tue 24 Nov', description: '08:00–16:00 at S02 during approved leave L001' });
  });
  test('duplicate row', () => {
    expect(rowFor('DUPLICATE_ROW', 'SH091')).toMatchObject({
      date: 'Tue 24 Nov',
      description: 'Appears 2 times with identical details. Counted once',
    });
  });
  test('unreadable row shows the date as typed and says it was not checked', () => {
    expect(rowFor('DATA_BAD_ROW', 'SH086')).toMatchObject({
      date: '31/11/2026',
      description: 'Date "31/11/2026" is not a real date. Row not checked',
    });
  });
  test('no line needed the fallback, and none repeats the date', () => {
    for (const f of result.findings) {
      const r = D.describeRow(f, lookup);
      expect(r.fellBack).toBe(false);
      expect(r.description).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});

describe('fallback', () => {
  test('without the CSV text, the server sentence is shown and the date is a dash', () => {
    const f = result.findings.find((x) => x.rule === 'OVERLAP');
    for (const lk of [D.buildLookup({ employees: '', shifts: '' }), null]) {
      const r = D.describeRow(f, lk);
      expect(r).toMatchObject({ date: '–', description: f.message, fellBack: true });
    }
  });
});

describe('table rows', () => {
  test('six rows for the seed: roster problems first, data rows last', () => {
    const rows = D.tableRows(result.findings, lookup);
    expect(rows.map((r) => `${r.group}:${r.employeeId}`)).toEqual([
      'overlap:E007', 'overlap:E012', 'rest:E003', 'leave:E015', 'data:E005', 'data:E010',
    ]);
  });
  test('each row has the five columns as plain text', () => {
    const r = D.tableRows(result.findings, lookup)[0];
    expect(r).toMatchObject({
      ruleLabel: 'Double-booked', employeeId: 'E007', shiftIds: 'SH024, SH025', date: 'Wed 18 Nov', severity: 'error',
    });
    expect(typeof r.description).toBe('string');
  });
  test('the duplicate is a warning and the unreadable row an error, both in the data group', () => {
    const data = D.tableRows(result.findings, lookup, 'data');
    expect(data.map((r) => [r.rule, r.severity])).toEqual([['DUPLICATE_ROW', 'warning'], ['DATA_BAD_ROW', 'error']]);
  });
  test('each tab keeps only its group', () => {
    expect(D.tableRows(result.findings, lookup, 'overlap')).toHaveLength(2);
    expect(D.tableRows(result.findings, lookup, 'rest')).toHaveLength(1);
    expect(D.tableRows(result.findings, lookup, 'leave')).toHaveLength(1);
    expect(D.tableRows(result.findings, lookup, 'data')).toHaveLength(2);
    expect(D.tableRows(result.findings, lookup, 'all')).toHaveLength(6);
  });
  test('names from the employees file never reach the rows', () => {
    const names = files.employees.split('\n').slice(1).map((l) => l.split(',')[1]).filter(Boolean);
    const out = JSON.stringify(D.tableRows(result.findings, lookup));
    for (const n of names) expect(out).not.toContain(n);
  });
  test('a finding with no employee or shifts gets dashes', () => {
    const rows = D.tableRows([{ seq: 1, rule: 'DATA_BAD_ROW', severity: 'error', employeeId: null, shiftIds: [], message: 'x line 2: bad. Row skipped.' }], null);
    expect(rows[0]).toMatchObject({ employeeId: '–', shiftIds: '–', date: '–' });
  });
});

describe('tab counts, status line, data line', () => {
  test('counts for the seed: 6 in all, 2 overlap, 1 rest, 1 leave, 2 data', () => {
    expect(D.countByGroup(result.findings)).toEqual({ all: 6, overlap: 2, rest: 1, leave: 1, data: 2 });
  });
  test('status line for the seed', () => {
    expect(D.statusLine(result.summary)).toEqual({ clear: false, text: 'Not clear to publish: 4 problems and 2 data issues' });
  });
  test('status line when clear, when only data issues, and singular', () => {
    expect(D.statusLine({ clear: true, counts: {} })).toEqual({ clear: true, text: 'Clear to publish' });
    expect(D.statusLine({ clear: false, counts: { DUPLICATE_ROW: 1 } }).text).toBe('Not clear to publish: 1 data issue');
    expect(D.statusLine({ clear: false, counts: { OVERLAP: 1 } }).text).toBe('Not clear to publish: 1 problem');
  });
  test('data line for the seed, and when everything was read', () => {
    expect(D.dataStripText(result.findings)).toBe('1 row skipped (1 unreadable), 1 duplicate row counted once');
    expect(D.dataStripText([])).toMatch(/All rows were read/);
  });
  test('row counts exclude the header and blank lines', () => {
    expect(D.countRows(files.shifts)).toBe(156);
    expect(D.countRows(files.employees)).toBe(25);
    expect(D.countRows(files.leave)).toBe(5);
    expect(D.countRows('a,b\n\n1,2\r\n')).toBe(1);
    expect(D.countRows('')).toBe(0);
  });
});
