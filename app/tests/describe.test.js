// Tests the dashboard's pure display logic (client/src/describe.js) against the REAL seed
// result from the rules engine. The client file is an ES module, so it is loaded with
// import() (the test script runs Jest with --experimental-vm-modules).
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

const line = (rule, shiftId) => {
  const f = result.findings.find((x) => x.rule === rule && x.shiftIds.includes(shiftId));
  return D.describeFinding(f, lookup);
};

describe('one plain line per finding (the six seed problems)', () => {
  test('same-store double booking', () => {
    expect(line('OVERLAP', 'SH024').text).toBe('Double-booked on Wed 18 Nov: 09:00–15:00 and 13:00–19:00 at S01');
  });
  test('double booking across two stores names both stores', () => {
    expect(line('OVERLAP', 'SH033').text).toBe('Double-booked on Thu 19 Nov: 10:00–16:00 at S01 and 12:00–18:00 at S02');
  });
  test('short rest', () => {
    expect(line('SHORT_REST', 'SH013').text).toBe('Only 8h rest between Tue 22:00 and Wed 06:00 (needs 11h)');
  });
  test('shift on approved leave', () => {
    expect(line('ON_LEAVE', 'SH098').text).toBe('Rostered Tue 24 Nov 08:00–16:00 at S02 during approved leave (L001)');
  });
  test('duplicate row', () => {
    expect(line('DUPLICATE_ROW', 'SH091').text).toBe('Shift SH091 appears 2 times with identical details. It was counted once');
  });
  test('unreadable row keeps the reason and says it was not checked', () => {
    const l = line('DATA_BAD_ROW', 'SH086');
    expect(l.text).toContain('31/11/2026');
    expect(l.text).toContain('This row was not checked');
    expect(l.text).not.toMatch(/line 87|Row skipped/); // file and line live under Details
  });
  test('every finding gets a one-line fix hint, and none of the lines needed the fallback', () => {
    for (const f of result.findings) {
      const d = D.describeFinding(f, lookup);
      expect(d.hint.length).toBeGreaterThan(10);
      expect(d.fellBack).toBe(false);
    }
  });
  test('a hint sent by the server wins over the default', () => {
    const f = { ...result.findings[0], hint: 'Server hint' };
    expect(D.describeFinding(f, lookup).hint).toBe('Server hint');
  });
});

describe('fallback', () => {
  test('without the CSV text, the server sentence is shown unchanged', () => {
    const f = result.findings.find((x) => x.rule === 'OVERLAP');
    const d = D.describeFinding(f, D.buildLookup({ employees: '', shifts: '', leave: '' }));
    expect(d.text).toBe(f.message);
    expect(d.fellBack).toBe(true);
    expect(D.describeFinding(f, null).text).toBe(f.message);
  });
});

describe('cards per employee', () => {
  test('six findings give six cards, errors first, warnings last', () => {
    const cards = D.groupByEmployee(result.findings, lookup);
    expect(cards.map((c) => c.employeeId)).toEqual(['E003', 'E007', 'E010', 'E012', 'E015', 'E005']);
    expect(cards.map((c) => c.worst)).toEqual(['error', 'error', 'error', 'error', 'error', 'warning']);
  });
  test('each card carries the home store of its employee', () => {
    const cards = D.groupByEmployee(result.findings, lookup);
    const by = Object.fromEntries(cards.map((c) => [c.employeeId, c.store]));
    expect(by.E007).toBe('S01');
    expect(by.E015).toBe('S02');
  });
  test('names from the employees file never reach the cards', () => {
    const names = files.employees.split('\n').slice(1).map((l) => l.split(',')[1]).filter(Boolean);
    const out = JSON.stringify(D.groupByEmployee(result.findings, lookup));
    for (const n of names) expect(out).not.toContain(n);
  });
  test('one employee with several problems gets one card, roster problems before data issues', () => {
    const fs2 = [
      { seq: 1, rule: 'DUPLICATE_ROW', severity: 'warning', employeeId: 'E1', shiftIds: ['X'], message: 'm' },
      { seq: 2, rule: 'SHORT_REST', severity: 'error', employeeId: 'E1', shiftIds: ['A', 'B'], message: 'm' },
      { seq: 3, rule: 'OVERLAP', severity: 'error', employeeId: 'E1', shiftIds: ['A', 'C'], message: 'm' },
    ];
    const cards = D.groupByEmployee(fs2, null);
    expect(cards).toHaveLength(1);
    expect(cards[0].items.map((i) => i.finding.rule)).toEqual(['OVERLAP', 'SHORT_REST', 'DUPLICATE_ROW']);
  });
  test('a finding with no employee goes in its own card, last', () => {
    const fs2 = [
      { seq: 1, rule: 'DATA_BAD_ROW', severity: 'error', employeeId: null, shiftIds: [], message: 'x line 2: bad. Row skipped.' },
      { seq: 2, rule: 'OVERLAP', severity: 'error', employeeId: 'E9', shiftIds: ['A', 'B'], message: 'm' },
    ];
    expect(D.groupByEmployee(fs2, null).map((c) => c.employeeId)).toEqual(['E9', null]);
  });
});

describe('filter chips', () => {
  test('counts for the seed: 6 in all, 2 overlap, 1 rest, 1 leave, 2 data', () => {
    expect(D.countByGroup(result.findings)).toEqual({ all: 6, overlap: 2, rest: 1, leave: 1, data: 2 });
  });
  test('a chip keeps only its group', () => {
    expect(D.groupByEmployee(result.findings, lookup, 'overlap').map((c) => c.employeeId)).toEqual(['E007', 'E012']);
    expect(D.groupByEmployee(result.findings, lookup, 'data').map((c) => c.employeeId)).toEqual(['E010', 'E005']);
    expect(D.groupByEmployee(result.findings, lookup, 'leave')).toHaveLength(1);
  });
});

describe('data strip and row counts', () => {
  test('strip text for the seed', () => {
    expect(D.dataStripText(result.findings)).toBe('1 row skipped (1 unreadable), 1 duplicate row counted once');
  });
  test('strip text when everything was read', () => {
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
