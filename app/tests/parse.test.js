const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../server/parse/csv');
const { parseRoster, InputError } = require('../server/parse/validate');

const EMP = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,Priya Nair,S01,Manager,40\nE002,Tom Hargreaves,S02,Staff,32\n';
const SH_HEAD = 'shift_id,employee_id,store_id,date,start,end\n';
const LV_HEAD = 'leave_id,employee_id,start_date,end_date,status\n';
const run = (shifts, leave = '', employees = EMP) => parseRoster({ employees, shifts: SH_HEAD + shifts, leave });
const rules = (r) => r.findings.map((f) => f.rule);

describe('csv reader', () => {
  test('handles CRLF, BOM and blank lines, with spreadsheet line numbers', () => {
    const { header, rows } = parseCsv('﻿a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([{ line: 2, fields: ['1', '2'] }, { line: 4, fields: ['3', '4'] }]);
  });
});

describe('row validation', () => {
  test('a good shift is parsed with absolute minutes', () => {
    const r = run('SH1,E001,S01,2026-11-16,09:00,17:00\n');
    expect(r.findings).toEqual([]);
    expect(r.shifts).toHaveLength(1);
    expect(r.shifts[0].endMin - r.shifts[0].startMin).toBe(480);
  });

  test('names, roles and hours are dropped', () => {
    const r = run('SH1,E001,S01,2026-11-16,09:00,17:00\n');
    expect(JSON.stringify(r)).not.toMatch(/Priya|Nair|Tom|Hargreaves|Manager|Staff|contracted/);
    expect(r.employees).toEqual([
      { employeeId: 'E001', homeStore: 'S01' },
      { employeeId: 'E002', homeStore: 'S02' },
    ]);
  });

  test.each([
    ['31/11/2026 (wrong format)', 'SH1,E001,S01,31/11/2026,09:00,17:00'],
    ['2026-02-30 (not a real day)', 'SH1,E001,S01,2026-02-30,09:00,17:00'],
    ['bad start time', 'SH1,E001,S01,2026-11-16,9am,17:00'],
    ['hour 24', 'SH1,E001,S01,2026-11-16,09:00,24:00'],
    ['end before start', 'SH1,E001,S01,2026-11-16,17:00,09:00'],
    ['end equals start', 'SH1,E001,S01,2026-11-16,09:00,09:00'],
    ['too few fields', 'SH1,E001,S01,2026-11-16,09:00'],
    ['too many fields', 'SH1,E001,S01,2026-11-16,09:00,17:00,x'],
    ['quoted comma shifts the fields', 'SH1,"E001,x",S01,2026-11-16,09:00,17:00'],
    ['bad shift id', 'S H1,E001,S01,2026-11-16,09:00,17:00'],
  ])('%s is reported as DATA_BAD_ROW and skipped', (_, row) => {
    const r = run(row + '\n');
    expect(rules(r)).toEqual(['DATA_BAD_ROW']);
    expect(r.shifts).toHaveLength(0);
    expect(r.rowsSkipped).toBe(1);
    expect(r.findings[0]).toMatchObject({ source: 'shifts.csv', line: 2, severity: 'error' });
  });

  test('a bad row does not stop the good rows', () => {
    const r = run('SH1,E001,S01,31/11/2026,09:00,17:00\nSH2,E001,S01,2026-11-16,09:00,17:00\n');
    expect(r.shifts.map((s) => s.shiftId)).toEqual(['SH2']);
    expect(r.findings[0].shiftIds).toEqual(['SH1']);
    expect(r.findings[0].employeeId).toBe('E001');
  });

  test('unknown employee and unknown store are UNKNOWN_REF', () => {
    const r = run('SH1,E999,S01,2026-11-16,09:00,17:00\nSH2,E001,S99,2026-11-16,09:00,17:00\n');
    expect(rules(r)).toEqual(['UNKNOWN_REF', 'UNKNOWN_REF']);
    expect(r.shifts).toHaveLength(0);
  });

  test('identical repeated row is kept for the duplicate rule; a reused id with different content is bad', () => {
    const same = run('SH1,E001,S01,2026-11-16,09:00,17:00\nSH1,E001,S01,2026-11-16,09:00,17:00\n');
    expect(same.shifts).toHaveLength(2);
    expect(same.findings).toEqual([]);
    const diff = run('SH1,E001,S01,2026-11-16,09:00,17:00\nSH1,E001,S01,2026-11-17,09:00,17:00\n');
    expect(rules(diff)).toEqual(['DATA_BAD_ROW']);
  });

  test('wrong header or empty required file throws InputError; empty leave is fine', () => {
    expect(() => parseRoster({ employees: EMP, shifts: 'a,b\n1,2\n', leave: '' })).toThrow(InputError);
    expect(() => parseRoster({ employees: EMP, shifts: '', leave: '' })).toThrow(/shifts.csv is empty/);
    expect(() => parseRoster({ employees: '', shifts: SH_HEAD, leave: '' })).toThrow(/employees.csv is empty/);
    expect(run('SH1,E001,S01,2026-11-16,09:00,17:00\n', '').leave).toEqual([]);
  });

  test('leave rows: valid, bad date, reversed range, unknown employee', () => {
    const leave = LV_HEAD
      + 'L1,E001,2026-11-16,2026-11-17,Approved\n'
      + 'L2,E001,16/11/2026,2026-11-17,approved\n'
      + 'L3,E001,2026-11-18,2026-11-17,approved\n'
      + 'L4,E999,2026-11-16,2026-11-17,approved\n';
    const r = run('SH1,E001,S01,2026-11-16,09:00,17:00\n', leave);
    expect(r.leave).toHaveLength(1);
    expect(r.leave[0].status).toBe('approved');
    expect(rules(r)).toEqual(['DATA_BAD_ROW', 'DATA_BAD_ROW', 'UNKNOWN_REF']);
  });
});

describe('seed data', () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, '../../case/seed', f), 'utf8');
  test('exactly one bad row (SH086, line 87) and 155 usable shifts including the duplicate', () => {
    const r = parseRoster({
      employees: read('employees.csv'),
      shifts: read('shifts.csv'),
      leave: read('leave.csv'),
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ rule: 'DATA_BAD_ROW', employeeId: 'E010', shiftIds: ['SH086'], line: 87 });
    expect(r.shifts).toHaveLength(155);
    expect(r.leave).toHaveLength(5);
    expect(r.rowsSkipped).toBe(1);
  });
});
