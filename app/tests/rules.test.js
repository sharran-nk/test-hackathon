const { runCheck } = require('../server/rules/index');

const EMP = 'employee_id,name,home_store,role,contracted_hours_per_week\n'
  + 'E001,A,S01,x,40\nE002,B,S02,x,40\nE003,C,S01,x,40\n';
const SH = 'shift_id,employee_id,store_id,date,start,end\n';
const LV = 'leave_id,employee_id,start_date,end_date,status\n';

// rows: array of "id,emp,store,date,start,end" strings
function check(rows, leave = [], opts) {
  return runCheck(
    { employees: EMP, shifts: SH + rows.join('\n') + '\n', leave: leave.length ? LV + leave.join('\n') + '\n' : '' },
    opts,
  );
}
const ids = (r, rule) => r.findings.filter((f) => f.rule === rule).map((f) => f.shiftIds.join('+'));

describe('OVERLAP', () => {
  test('same store: reports the pair once', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,15:00', 'A2,E001,S01,2026-11-18,13:00,19:00']);
    expect(ids(r, 'OVERLAP')).toEqual(['A1+A2']);
    expect(r.findings[0]).toMatchObject({ severity: 'error', employeeId: 'E001' });
    expect(r.findings[0].message).toContain('at S01');
  });

  test('cross store: message names both stores', () => {
    const r = check(['A1,E001,S01,2026-11-19,10:00,16:00', 'A2,E001,S02,2026-11-19,12:00,18:00']);
    expect(ids(r, 'OVERLAP')).toEqual(['A1+A2']);
    expect(r.findings[0].message).toMatch(/S01.*S02/);
  });

  test('touching shifts are NOT an overlap', () => {
    const r = check(['A1,E001,S01,2026-11-18,06:00,14:00', 'A2,E001,S01,2026-11-18,14:00,22:00']);
    expect(ids(r, 'OVERLAP')).toEqual([]);
  });

  test('nested shifts: a neighbour-only check would miss A1+A3', () => {
    const r = check([
      'A1,E001,S01,2026-11-18,09:00,17:00',
      'A2,E001,S01,2026-11-18,10:00,12:00',
      'A3,E001,S01,2026-11-18,13:00,15:00',
    ]);
    expect(ids(r, 'OVERLAP').sort()).toEqual(['A1+A2', 'A1+A3']);
  });

  test('three shifts that all overlap give three pairs', () => {
    const r = check([
      'A1,E001,S01,2026-11-18,09:00,15:00',
      'A2,E001,S01,2026-11-18,10:00,16:00',
      'A3,E001,S02,2026-11-18,11:00,17:00',
    ]);
    expect(ids(r, 'OVERLAP').sort()).toEqual(['A1+A2', 'A1+A3', 'A2+A3']);
  });

  test('identical start and end times with different IDs overlap', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,17:00', 'A2,E001,S01,2026-11-18,09:00,17:00']);
    expect(ids(r, 'OVERLAP')).toEqual(['A1+A2']);
  });

  test('different people never overlap each other', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,17:00', 'A2,E002,S01,2026-11-18,09:00,17:00']);
    expect(r.findings).toEqual([]);
    expect(r.summary.clear).toBe(true);
  });

  test('MAX_FINDINGS stops reporting and sets truncated', () => {
    const rows = [1, 2, 3, 4, 5].map((i) => `A${i},E001,S01,2026-11-18,09:00,17:00`);
    const r = check(rows, [], { maxFindings: 3 });
    expect(r.findings).toHaveLength(3);
    expect(r.summary.truncated).toBe(true);
    const full = check(rows);
    expect(full.findings).toHaveLength(10);
    expect(full.summary.truncated).toBe(false);
  });

  test('exactly MAX_FINDINGS findings is not truncated', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,17:00', 'A2,E001,S01,2026-11-18,09:00,17:00'], [], { maxFindings: 1 });
    expect(r.findings).toHaveLength(1);
    expect(r.summary.truncated).toBe(false);
  });
});

describe('SHORT_REST', () => {
  test('exactly 11h is allowed, 10h59 is flagged', () => {
    const ok = check(['A1,E001,S01,2026-11-17,11:00,19:00', 'A2,E001,S01,2026-11-18,06:00,14:00']);
    expect(ids(ok, 'SHORT_REST')).toEqual([]);
    const bad = check(['A1,E001,S01,2026-11-17,11:00,19:01', 'A2,E001,S01,2026-11-18,06:00,14:00']);
    expect(ids(bad, 'SHORT_REST')).toEqual(['A1+A2']);
    expect(bad.findings[0].message).toContain('10h 59m');
  });

  test('seed-style case: 22:00 to 06:00 is 8h', () => {
    const r = check(['A1,E003,S01,2026-11-17,14:00,22:00', 'A2,E003,S01,2026-11-18,06:00,14:00']);
    expect(ids(r, 'SHORT_REST')).toEqual(['A1+A2']);
    expect(r.findings[0].message).toContain('8h 0m');
  });

  test('overlapping shifts are reported as OVERLAP only, not also as short rest', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,15:00', 'A2,E001,S01,2026-11-18,13:00,19:00']);
    expect(ids(r, 'SHORT_REST')).toEqual([]);
  });

  test('touching shifts have a 0h gap and are flagged (documented caveat)', () => {
    const r = check(['A1,E001,S01,2026-11-18,06:00,14:00', 'A2,E001,S01,2026-11-18,14:00,22:00']);
    expect(ids(r, 'SHORT_REST')).toEqual(['A1+A2']);
  });

  test('rest is measured from the latest-ending earlier shift', () => {
    const r = check([
      'A1,E001,S01,2026-11-17,09:00,23:00',
      'A2,E001,S01,2026-11-17,10:00,12:00',
      'A3,E001,S01,2026-11-18,06:00,10:00',
    ]);
    expect(ids(r, 'SHORT_REST')).toEqual(['A1+A3']);
  });

  test('MIN_REST_HOURS option is respected', () => {
    const rows = ['A1,E001,S01,2026-11-17,11:00,19:00', 'A2,E001,S01,2026-11-18,06:00,14:00'];
    expect(ids(check(rows, [], { minRestHours: 12 }), 'SHORT_REST')).toEqual(['A1+A2']);
  });
});

describe('ON_LEAVE', () => {
  const shift = (d) => [`A1,E002,S02,${d},08:00,16:00`];
  const leave = ['L1,E002,2026-11-24,2026-11-25,approved'];
  test('first day and last day are flagged, the day before and after are not', () => {
    expect(ids(check(shift('2026-11-24'), leave), 'ON_LEAVE')).toEqual(['A1']);
    expect(ids(check(shift('2026-11-25'), leave), 'ON_LEAVE')).toEqual(['A1']);
    expect(ids(check(shift('2026-11-23'), leave), 'ON_LEAVE')).toEqual([]);
    expect(ids(check(shift('2026-11-26'), leave), 'ON_LEAVE')).toEqual([]);
  });

  test('only approved leave counts', () => {
    expect(ids(check(shift('2026-11-24'), ['L1,E002,2026-11-24,2026-11-25,pending']), 'ON_LEAVE')).toEqual([]);
    expect(ids(check(shift('2026-11-24'), ['L1,E002,2026-11-24,2026-11-25,APPROVED']), 'ON_LEAVE')).toEqual(['A1']);
  });

  test("another person's leave does not matter", () => {
    expect(ids(check(['A1,E001,S01,2026-11-24,08:00,16:00'], leave), 'ON_LEAVE')).toEqual([]);
  });

  test('message names the leave id and range', () => {
    const r = check(shift('2026-11-24'), leave);
    expect(r.findings[0].message).toContain('L1');
    expect(r.findings[0].message).toContain('2026-11-25');
  });
});

describe('DUPLICATE_ROW', () => {
  const dup = ['A1,E001,S01,2026-11-18,09:00,17:00', 'A1,E001,S01,2026-11-18,09:00,17:00'];
  test('reported once, as a warning, and not as an overlap or short rest', () => {
    const r = check(dup);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ rule: 'DUPLICATE_ROW', severity: 'warning', shiftIds: ['A1'] });
    expect(r.summary).toMatchObject({ shiftsReceived: 2, shiftsChecked: 1 });
  });

  test('a duplicate on leave is flagged on leave only once', () => {
    const r = check(['A1,E002,S02,2026-11-24,08:00,16:00', 'A1,E002,S02,2026-11-24,08:00,16:00'],
      ['L1,E002,2026-11-24,2026-11-25,approved']);
    expect(ids(r, 'ON_LEAVE')).toEqual(['A1']);
    expect(ids(r, 'DUPLICATE_ROW')).toEqual(['A1']);
  });
});

describe('pipeline', () => {
  test('bad rows are reported and the rest is still checked', () => {
    const r = check(['A0,E001,S01,31/11/2026,09:00,17:00', 'A1,E001,S01,2026-11-18,09:00,15:00', 'A2,E001,S01,2026-11-18,13:00,19:00']);
    expect(r.summary.counts).toMatchObject({ DATA_BAD_ROW: 1, OVERLAP: 1 });
    expect(r.summary.rowsSkipped).toBe(1);
    expect(r.summary.clear).toBe(false);
  });

  test('a clean roster is clear with zero counts', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,17:00', 'A2,E001,S01,2026-11-19,09:00,17:00']);
    expect(r.summary.clear).toBe(true);
    expect(Object.values(r.summary.counts).every((n) => n === 0)).toBe(true);
  });

  test('findings are numbered from 1 and carry no internal fields', () => {
    const r = check(['A1,E001,S01,2026-11-18,09:00,17:00', 'A2,E001,S01,2026-11-18,10:00,12:00']);
    expect(r.findings.map((f) => f.seq)).toEqual([1]);
    expect(JSON.stringify(r)).not.toContain('_t');
  });

  test('row order does not change the result (same input, same output)', () => {
    const rows = [
      'A1,E001,S01,2026-11-18,09:00,15:00',
      'A2,E001,S01,2026-11-18,13:00,19:00',
      'A3,E002,S02,2026-11-24,08:00,16:00',
      'A4,E003,S01,2026-11-17,14:00,22:00',
      'A5,E003,S01,2026-11-18,06:00,14:00',
      'A6,E001,S02,2026-11-18,14:00,18:00',
    ];
    const leave = ['L1,E002,2026-11-24,2026-11-25,approved'];
    const strip = (r) => JSON.stringify(r.findings.map(({ line, message, source, ...f }) => ({ ...f, message: message.replace(/line \d+/, '') })));
    const base = strip(check(rows, leave));
    const reversed = strip(check([...rows].reverse(), leave));
    const shuffled = strip(check([rows[3], rows[5], rows[0], rows[4], rows[2], rows[1]], leave));
    expect(reversed).toBe(base);
    expect(shuffled).toBe(base);
    expect(check(rows, leave).findings.length).toBeGreaterThan(3);
  });

  test('calling twice gives identical output', () => {
    const rows = ['A1,E001,S01,2026-11-18,09:00,15:00', 'A2,E001,S01,2026-11-18,13:00,19:00'];
    expect(check(rows)).toEqual(check(rows));
  });
});
