const request = require('supertest');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const KEY = 'test-key-1234567890';
const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({ ACCESS_KEY: KEY });
const app = createApp(config, { logger: silent });

describe('scaffold', () => {
  test('GET /health returns ok without a key', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown route returns a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

const EMP = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,Priya Nair,S01,Manager,40\n';
const SHIFTS = 'shift_id,employee_id,store_id,date,start,end\n'
  + 'A1,E001,S01,2026-11-18,09:00,15:00\nA2,E001,S01,2026-11-18,13:00,19:00\n';
const good = { employees: EMP, shifts: SHIFTS, leave: '' };
const post = (body, key = KEY, a = app) => {
  const r = request(a).post('/api/check').set('Authorization', `Bearer ${key}`);
  return typeof body === 'string' ? r.set('Content-Type', 'application/json').send(body) : r.send(body);
};

describe('POST /api/check', () => {
  test('200 with findings and summary for a valid roster', async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ resultId: null, saved: false });
    expect(res.body.summary).toMatchObject({ clear: false, shiftsChecked: 2, rowsSkipped: 0, truncated: false });
    expect(res.body.summary.counts.OVERLAP).toBe(1);
    expect(res.body.findings).toHaveLength(1);
    expect(res.body.findings[0]).toMatchObject({
      seq: 1, rule: 'OVERLAP', severity: 'error', employeeId: 'E001', shiftIds: ['A1', 'A2'],
    });
    expect(typeof res.body.findings[0].message).toBe('string');
  });

  test('leave may be left out', async () => {
    const res = await post({ employees: EMP, shifts: SHIFTS });
    expect(res.status).toBe(200);
  });

  test('names never appear in the response', async () => {
    const res = await post(good);
    expect(JSON.stringify(res.body)).not.toMatch(/Priya|Nair|Manager/);
  });

  test('does not need the database: still 200 with saved:false', async () => {
    expect((await post(good)).body.saved).toBe(false);
  });
});

describe('access key', () => {
  test.each([
    ['missing', undefined],
    ['wrong', 'Bearer wrong-key-sent-by-caller'],
    ['wrong scheme', `Basic ${KEY}`],
    ['no scheme', KEY],
    ['empty bearer', 'Bearer '],
  ])('%s key gives 401 and the response never contains a key', async (_, header) => {
    const r = request(app).post('/api/check');
    if (header !== undefined) r.set('Authorization', header);
    const res = await r.send(good);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.text).not.toContain(KEY);
    expect(res.text).not.toContain('wrong-key-sent-by-caller');
  });

  test('unknown /api route without a key is 401, with a key is 404', async () => {
    expect((await request(app).get('/api/nothing')).status).toBe(401);
    expect((await request(app).get('/api/nothing').set('Authorization', `Bearer ${KEY}`)).status).toBe(404);
  });

  test('an unauthenticated caller learns nothing about validation', async () => {
    const res = await request(app).post('/api/check').send({ bad: true });
    expect(res.status).toBe(401);
  });
});

describe('input errors', () => {
  test.each([
    ['bad JSON', '{not json', /not valid JSON/],
    ['body is an array', '[1,2]', /JSON object/],
    ['employees not a string', { employees: { $ne: 1 }, shifts: SHIFTS }, /"employees"/],
    ['shifts missing', { employees: EMP }, /"shifts"/],
    ['leave is a number', { ...good, leave: 5 }, /"leave"/],
    ['empty shifts', { employees: EMP, shifts: '' }, /shifts.csv is empty/],
    ['wrong shifts header', { employees: EMP, shifts: 'a,b\n1,2\n' }, /missing column/],
  ])('%s gives 400 INVALID_REQUEST with a clear message', async (_, body, pattern) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toMatch(pattern);
  });

  test('wrong content type gives 400, not a crash', async () => {
    const res = await request(app).post('/api/check').set('Authorization', `Bearer ${KEY}`)
      .set('Content-Type', 'text/plain').send('hello');
    expect(res.status).toBe(400);
  });

  test('a body over MAX_BODY_KB gives 413', async () => {
    const small = createApp(loadConfig({ ACCESS_KEY: KEY, MAX_BODY_KB: '1' }), { logger: silent });
    const res = await post({ ...good, shifts: SHIFTS + 'x'.repeat(2000) }, KEY, small);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('TOO_LARGE');
  });

  test('malformed rows do not return an error: they come back as findings', async () => {
    const res = await post({ ...good, shifts: SHIFTS + 'A3,E001,S01,31/11/2026,09:00,10:00\n' });
    expect(res.status).toBe(200);
    expect(res.body.summary.counts.DATA_BAD_ROW).toBe(1);
  });
});

describe('unexpected errors', () => {
  const rules = require('../server/rules/index');
  afterEach(() => jest.restoreAllMocks());

  test('500 is generic, has a requestId, and leaks neither the key nor the error text', async () => {
    const lines = [];
    const capture = { info: (m, f) => lines.push(JSON.stringify([m, f])), warn() {}, error: (m, f) => lines.push(JSON.stringify([m, f])) };
    jest.spyOn(rules, 'runCheck').mockImplementation(() => { throw new Error(`boom ${KEY} Priya Nair`); });
    const res = await post(good, KEY, createApp(config, { logger: capture }));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.requestId).toEqual(expect.any(String));
    expect(res.text).not.toMatch(new RegExp(`${KEY}|boom|Priya`));
    const logs = lines.join('\n');
    expect(logs).toContain('unhandled_error');
    expect(logs).not.toMatch(new RegExp(`${KEY}|Priya|boom`));
  });

  test('the request log has no body, key or names', async () => {
    const lines = [];
    const capture = { info: (m, f) => lines.push(JSON.stringify([m, f])), warn() {}, error() {} };
    await post(good, KEY, createApp(config, { logger: capture }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(new RegExp(`${KEY}|Priya|E001|A1`));
  });
});

describe('config', () => {
  test('refuses to start without ACCESS_KEY', () => {
    expect(() => loadConfig({})).toThrow(/ACCESS_KEY/);
    expect(() => loadConfig({ ACCESS_KEY: '  ' })).toThrow(/ACCESS_KEY/);
  });

  test('applies defaults and rejects bad numbers', () => {
    const c = loadConfig({ ACCESS_KEY: 'k' });
    expect(c).toMatchObject({ port: 3000, maxBodyKb: 1024, maxFindings: 1000, minRestHours: 11 });
    expect(() => loadConfig({ ACCESS_KEY: 'k', MAX_FINDINGS: 'abc' })).toThrow(/MAX_FINDINGS/);
  });
});
