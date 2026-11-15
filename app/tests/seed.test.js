// The answer key: case/seed/README.md lists exactly 6 planted problems.
// A correct checker reports those 6 and NOTHING else (zero false positives on the
// other 155 shifts). This runs the real seed files through the real HTTP API.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const { SECRET, tokenFor } = require('./helpers');

const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({ JWT_SECRET: SECRET });
const KEY = tokenFor(config, 'manager');
const app = createApp(config, { logger: silent, clientDir: null });
const read = (f) => fs.readFileSync(path.join(__dirname, '../../case/seed', f), 'utf8');

let res;
beforeAll(async () => {
  res = await request(app)
    .post('/api/check')
    .set('Authorization', `Bearer ${KEY}`)
    .send({ employees: read('employees.csv'), shifts: read('shifts.csv'), leave: read('leave.csv') });
});

// Compact view of a finding: rule, employee, shift IDs.
const view = (f) => `${f.rule} ${f.employeeId} ${f.shiftIds.join('+')}`;

describe('seed data answer key', () => {
  test('responds 200', () => {
    expect(res.status).toBe(200);
  });

  test('exactly the six planted problems, and nothing else', () => {
    expect(res.body.findings.map(view).sort()).toEqual([
      'DATA_BAD_ROW E010 SH086',
      'DUPLICATE_ROW E005 SH091',
      'ON_LEAVE E015 SH098',
      'OVERLAP E007 SH024+SH025',
      'OVERLAP E012 SH033+SH041',
      'SHORT_REST E003 SH013+SH021',
    ]);
    expect(res.body.findings).toHaveLength(6);
  });

  test('summary: not clear, counts match, one row skipped, 154 valid distinct shifts checked, not truncated', () => {
    expect(res.body.summary).toEqual({
      clear: false,
      shiftsReceived: 156, // 155 distinct + 1 duplicate row
      shiftsChecked: 154,
      rowsSkipped: 1,
      truncated: false,
      counts: {
        DATA_BAD_ROW: 1, DUPLICATE_ROW: 1, UNKNOWN_REF: 0, OVERLAP: 2, SHORT_REST: 1, ON_LEAVE: 1,
      },
    });
  });

  test('details match the README: stores, rest hours, leave id, line numbers', () => {
    const by = (rule, id) => res.body.findings.find((f) => f.rule === rule && f.shiftIds.includes(id));
    expect(by('OVERLAP', 'SH024').message).toContain('at S01');
    const cross = by('OVERLAP', 'SH033').message;
    expect(cross).toMatch(/S01/);
    expect(cross).toMatch(/S02/);
    expect(by('SHORT_REST', 'SH013').message).toContain('8h 0m');
    expect(by('ON_LEAVE', 'SH098').message).toContain('L001');
    expect(by('DATA_BAD_ROW', 'SH086')).toMatchObject({ line: 87, source: 'shifts.csv' });
    expect(by('DUPLICATE_ROW', 'SH091').message).toContain('92, 93');
  });

  test('leave rows L002-L005 and the day after L001 produce nothing', () => {
    const text = JSON.stringify(res.body.findings);
    for (const id of ['L002', 'L003', 'L004', 'L005']) expect(text).not.toContain(id);
    expect(res.body.findings.filter((f) => f.rule === 'ON_LEAVE')).toHaveLength(1);
  });

  test('no employee names in the response', () => {
    const names = read('employees.csv').split('\n').slice(1).map((l) => l.split(',')[1]).filter(Boolean);
    expect(names.length).toBe(25);
    for (const n of names) expect(res.text).not.toContain(n);
  });
});
