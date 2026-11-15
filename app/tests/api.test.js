const request = require('supertest');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const { SECRET, tokenFor, lookupUser } = require('./helpers');

const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({ JWT_SECRET: SECRET });
// KEY is a valid manager token. These tests run without MongoDB, so createApp gets a stub account lookup.
const KEY = tokenFor(config, 'manager');
// clientDir: null so these API tests never depend on whether the React build exists.
const app = createApp(config, { logger: silent, clientDir: null, lookupUser });

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

describe('token required', () => {
  test.each([
    ['missing', undefined],
    ['wrong', 'Bearer wrong-key-sent-by-caller'],
    ['wrong scheme', `Basic ${KEY}`],
    ['no scheme', KEY],
    ['empty bearer', 'Bearer '],
  ])('%s token gives 401 and the response never contains a token', async (_, header) => {
    const r = request(app).post('/api/check');
    if (header !== undefined) r.set('Authorization', header);
    const res = await r.send(good);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.text).not.toContain(KEY);
    expect(res.text).not.toContain('wrong-key-sent-by-caller');
  });

  test('unknown /api route without a token is 401, with a token is 404', async () => {
    expect((await request(app).get('/api/nothing')).status).toBe(401);
    expect((await request(app).get('/api/nothing').set('Authorization', `Bearer ${KEY}`)).status).toBe(404);
  });

  test('an unauthenticated caller learns nothing about validation', async () => {
    const res = await request(app).post('/api/check').send({ bad: true });
    expect(res.status).toBe(401);
  });
});

// The token is checked BEFORE the body is read, so an anonymous caller cannot learn anything
// from 200, 400 or 413. These tests fail if that order ever changes.
describe('token check does not depend on the body', () => {
  const WRONG = 'Bearer definitely.the.wrong-token';
  const bodies = [
    ['empty object', '{}'],
    ['a fully valid roster', JSON.stringify(good)],
    ['malformed JSON', '{not json'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON string', '"hello"'],
    ['valid roster with a bad row', JSON.stringify({ ...good, shifts: SHIFTS + 'A3,E001,S01,31/11/2026,09:00,10:00\n' })],
    ['a body over the size limit', JSON.stringify({ ...good, shifts: SHIFTS + 'x'.repeat(5000) })],
    ['no body at all', ''],
  ];

  test.each(bodies)('wrong token + %s is always 401', async (_, raw) => {
    const small = createApp(loadConfig({ JWT_SECRET: SECRET, MAX_BODY_KB: '1' }), { logger: silent, clientDir: null, lookupUser });
    const res = await request(small).post('/api/check')
      .set('Authorization', WRONG).set('Content-Type', 'application/json').send(raw);
    expect(res.status).toBe(401);
    expect([200, 400, 413]).not.toContain(res.status);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('missing token is also 401 for every body', async () => {
    for (const [, raw] of bodies) {
      const res = await request(app).post('/api/check').set('Content-Type', 'application/json').send(raw);
      expect(res.status).toBe(401);
    }
  });

  test('right token + empty object is 400', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
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
    const small = createApp(loadConfig({ JWT_SECRET: SECRET, MAX_BODY_KB: '1' }), { logger: silent, lookupUser });
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
    const res = await post(good, KEY, createApp(config, { logger: capture, lookupUser }));
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
    await post(good, KEY, createApp(config, { logger: capture, lookupUser }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"/api/check"');
    expect(lines[0]).not.toMatch(new RegExp(`${KEY}|Priya|E001|A1`));
  });
});

describe('serving the React build', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-dist-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Roster Checker</title>');
  fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
  const withClient = createApp(config, { logger: silent, clientDir: dir, lookupUser });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('GET / returns the page, with a CSP header', async () => {
    const res = await request(withClient).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  test('static files are served', async () => {
    expect((await request(withClient).get('/app.js')).status).toBe(200);
  });

  test('/health and /api are not swallowed by the page fallback', async () => {
    expect((await request(withClient).get('/health')).body).toEqual({ status: 'ok' });
    const res = await request(withClient).get('/api/check');
    expect(res.status).toBe(401);
    expect(res.type).toBe('application/json');
  });

  test('without a build, / is a JSON 404 and the API still works', async () => {
    const none = createApp(config, { logger: silent, clientDir: path.join(dir, 'missing'), lookupUser });
    expect((await request(none).get('/')).status).toBe(404);
    expect((await request(none).get('/health')).status).toBe(200);
  });
});

describe('config', () => {
  test('refuses to start without a strong JWT_SECRET', () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ JWT_SECRET: '  ' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });

  test('ACCESS_KEY is gone: it is neither required nor used', () => {
    expect(() => loadConfig({ ACCESS_KEY: 'a-long-access-key-that-used-to-work-0123456789' })).toThrow(/JWT_SECRET/);
    expect(loadConfig({ JWT_SECRET: SECRET, ACCESS_KEY: 'x' })).not.toHaveProperty('accessKey');
  });

  test('applies defaults and rejects bad numbers', () => {
    const c = loadConfig({ JWT_SECRET: SECRET });
    expect(c).toMatchObject({ port: 3000, maxBodyKb: 1024, maxFindings: 1000, minRestHours: 11, jwtExpiresIn: '8h' });
    expect(() => loadConfig({ JWT_SECRET: SECRET, MAX_FINDINGS: 'abc' })).toThrow(/MAX_FINDINGS/);
    expect(() => loadConfig({ JWT_SECRET: SECRET, JWT_EXPIRES_IN: 'forever' })).toThrow(/JWT_EXPIRES_IN/);
  });
});
