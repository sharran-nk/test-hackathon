const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');
const db = require('../server/db');
const User = require('../server/models/User');
const Roster = require('../server/models/Roster');
const ValidationResult = require('../server/models/ValidationResult');
const Finding = require('../server/models/Finding');
const { seedUsers, ensureManager } = require('../server/seed');
const { SECRET } = require('./helpers');

jest.setTimeout(120000);

const logs = [];
const logger = {
  info: (m, f) => logs.push(JSON.stringify({ m, ...f })),
  warn: (m, f) => logs.push(JSON.stringify({ m, ...f })),
  error: (m, f) => logs.push(JSON.stringify({ m, ...f })),
};
const config = loadConfig({ JWT_SECRET: SECRET });
const app = createApp(config, { logger, clientDir: null });

const seedDir = path.join(__dirname, '../../case/seed');
const seed = {
  employees: fs.readFileSync(path.join(seedDir, 'employees.csv'), 'utf8'),
  shifts: fs.readFileSync(path.join(seedDir, 'shifts.csv'), 'utf8'),
  leave: fs.readFileSync(path.join(seedDir, 'leave.csv'), 'utf8'),
};
const EMP = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,Priya Nair,S01,Manager,40\n';
const SHIFTS = 'shift_id,employee_id,store_id,date,start,end\nA1,E001,S01,2026-11-18,09:00,15:00\n';
const small = { employees: EMP, shifts: SHIFTS, leave: '' };

let mongod;
let tmp;
let pw; // employee passwords read from the generated credentials file
let mgr; // manager token
const emp = {}; // employee tokens by ID

const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const get = (p, t) => request(app).get(p).set(bearer(t));
const check = (body, t = mgr) => request(app).post('/api/check').set(bearer(t)).send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-'));
  await db.connect(mongod.getUri('auth'), logger);
  const file = path.join(tmp, 'credentials.txt');
  await seedUsers({ managerPassword: 'manager123', employeeIds: ['E001', 'E003', 'E005', 'E007', 'E099'], credentialsFile: file, logger });
  pw = Object.fromEntries(fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')));
  mgr = (await login('manager', 'manager123')).body.token;
  for (const id of Object.keys(pw)) emp[id] = (await login(id, pw[id])).body.token;
});
afterAll(async () => {
  await db.disconnect();
  await mongod.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(async () => {
  logs.length = 0;
  await Promise.all([Roster.deleteMany({}), ValidationResult.deleteMany({}), Finding.deleteMany({})]);
  await User.updateMany({}, { active: true });
});

describe('login', () => {
  test('manager logs in with manager / manager123 and gets a signed, expiring token', async () => {
    const res = await login('manager', 'manager123');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ username: 'manager', role: 'manager', employeeId: null });
    const payload = jwt.verify(res.body.token, SECRET, { algorithms: ['HS256'] });
    expect(payload).toMatchObject({ role: 'manager', username: 'manager' });
    expect(payload.exp - payload.iat).toBe(8 * 3600);
    expect(JSON.stringify(payload)).not.toMatch(/manager123|\$2/);
  });

  test('every seeded employee logs in with their own generated password', async () => {
    for (const id of Object.keys(pw)) {
      const res = await login(id, pw[id]);
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ username: id, role: 'employee', employeeId: id });
    }
  });

  test('an employee password does not work for another employee or for the manager', async () => {
    expect((await login('E003', pw.E001)).status).toBe(401);
    expect((await login('manager', pw.E001)).status).toBe(401);
    expect((await login('E001', 'manager123')).status).toBe(401);
  });

  test('wrong password and unknown user give the same 401 (no way to tell which usernames exist)', async () => {
    const wrong = await login('manager', 'nope');
    const unknown = await login('nobody', 'nope');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('an inactive account cannot log in, even with the right password', async () => {
    await User.updateOne({ username: 'E005' }, { active: false });
    const res = await login('E005', pw.E005);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test.each([
    ['empty body', {}],
    ['missing password', { username: 'manager' }],
    ['empty password', { username: 'manager', password: '' }],
    ['blank username', { username: '  ', password: 'x' }],
    ['object instead of text (NoSQL injection)', { username: { $ne: null }, password: { $ne: null } }],
    ['number', { username: 5, password: 5 }],
    ['very long username', { username: 'a'.repeat(65), password: 'x' }],
    ['very long password', { username: 'manager', password: 'x'.repeat(129) }],
  ])('%s gives 400 and no token', async (_, body) => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  test('login body is limited in size', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'manager', password: 'x'.repeat(10000) });
    expect(res.status).toBe(413);
  });

  test('passwords and tokens never appear in logs or error responses', async () => {
    const ok = await login('E001', pw.E001);
    const bad = await login('E001', 'wrong-password-123');
    const all = logs.join('\n') + JSON.stringify(bad.body);
    expect(all).not.toContain(pw.E001);
    expect(all).not.toContain('wrong-password-123');
    expect(all).not.toContain(ok.body.token);
  });

  test('FAIL CLOSED: with MongoDB down, login and every protected request are 503, even with a valid token', async () => {
    await db.disconnect();
    try {
      const res = await login('manager', 'manager123');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
      const calls = [
        await check(seed), // a perfectly valid manager token and roster
        await get('/api/history', mgr),
        await get('/api/auth/me', mgr),
        await get('/api/me/schedule', emp.E001),
        await request(app).post('/api/auth/logout').set(bearer(mgr)),
      ];
      for (const r of calls) {
        expect(r.status).toBe(503);
        expect(r.body.error.code).toBe('AUTH_UNAVAILABLE');
        expect(r.body.findings).toBeUndefined();
      }
    } finally {
      await db.connect(mongod.getUri('auth'), logger);
    }
  });
});

describe('password storage', () => {
  test('only bcrypt hashes are stored, and no API ever returns a hash or password', async () => {
    const users = await User.find({}).lean();
    expect(users.length).toBe(6);
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(JSON.stringify(u)).not.toContain('manager123');
      for (const p of Object.values(pw)) expect(JSON.stringify(u)).not.toContain(p);
    }
    expect(await bcrypt.compare('manager123', users.find((u) => u.username === 'manager').passwordHash)).toBe(true);
    const responses = [(await get('/api/auth/me', mgr)).text, (await get('/api/me/schedule', emp.E001)).text, (await login('manager', 'manager123')).text];
    for (const r of responses) expect(r).not.toMatch(/passwordHash|\$2[aby]\$|manager123/);
  });

  test('a restart does not overwrite an existing manager password', async () => {
    const before = (await User.findOne({ username: 'manager' }).lean()).passwordHash;
    expect(await ensureManager('a-different-password')).toBe(false);
    expect((await User.findOne({ username: 'manager' }).lean()).passwordHash).toBe(before);
    expect((await login('manager', 'manager123')).status).toBe(200);
    expect((await login('manager', 'a-different-password')).status).toBe(401);
  });
});

describe('account lookup errors', () => {
  test('a database error during the account check is 503 (never "token looks fine") and only the error name is logged', async () => {
    jest.spyOn(User, 'findById').mockImplementationOnce(() => { throw new Error('mongodb://u:secretpw@host exploded'); });
    const res = await get('/api/auth/me', mgr);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('secretpw');
    expect(logs.join('')).toContain('auth_lookup_failed');
    expect(logs.join('')).not.toContain('secretpw');
    jest.restoreAllMocks();
    expect((await get('/api/auth/me', mgr)).status).toBe(200);
  });
});

describe('token checks', () => {
  const protectedCalls = [
    ['get', '/api/auth/me'], ['get', '/api/history'], ['post', '/api/check'], ['get', '/api/me/schedule'], ['post', '/api/auth/logout'],
  ];

  test.each(protectedCalls)('%s %s without a token is 401', async (m, p) => {
    expect((await request(app)[m](p)).status).toBe(401);
  });

  test.each([
    ['no scheme', () => mgr],
    ['Basic scheme', () => `Basic ${mgr}`],
    ['empty bearer', () => 'Bearer '],
    ['garbage', () => 'Bearer not.a.jwt'],
    ['signed with the wrong secret', () => `Bearer ${jwt.sign({ role: 'manager' }, 'x'.repeat(40), { subject: 'aaaaaaaaaaaaaaaaaaaaaaaa', jwtid: 'j' })}`],
    ['alg none', () => `Bearer ${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"aaaaaaaaaaaaaaaaaaaaaaaa","role":"manager","jti":"j"}').toString('base64url')}.`],
    ['payload edited after signing (employee made manager)', () => {
      const [h, , sig] = emp.E001.split('.');
      const p = JSON.parse(Buffer.from(emp.E001.split('.')[1], 'base64url').toString());
      p.role = 'manager';
      return `Bearer ${h}.${Buffer.from(JSON.stringify(p)).toString('base64url')}.${sig}`;
    }],
    ['HS512 instead of HS256', () => `Bearer ${jwt.sign({ role: 'manager' }, SECRET, { algorithm: 'HS512', subject: 'aaaaaaaaaaaaaaaaaaaaaaaa', jwtid: 'j' })}`],
  ])('%s is 401', async (_, header) => {
    const h = header();
    const res = await request(app).get('/api/auth/me').set('Authorization', h);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('an expired token is 401 with a clear message', async () => {
    const id = String((await User.findOne({ username: 'manager' }))._id);
    const old = jwt.sign({ role: 'manager', username: 'manager' }, SECRET, { subject: id, jwtid: 'x1', expiresIn: -10 });
    const res = await get('/api/auth/me', old);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  test('a token whose user was deleted is 401', async () => {
    await User.create({ username: 'tmp1', role: 'employee', employeeId: 'T1', passwordHash: await bcrypt.hash('p', 4) });
    const token = (await (async () => {
      const u = await User.findOne({ username: 'tmp1' });
      return require('../server/auth').signToken(config, u);
    })());
    expect((await get('/api/auth/me', token)).status).toBe(200);
    await User.deleteOne({ username: 'tmp1' });
    expect((await get('/api/auth/me', token)).status).toBe(401);
  });

  test('deactivating an account stops its existing token at once', async () => {
    expect((await get('/api/me/schedule', emp.E007)).status).toBe(200);
    await User.updateOne({ username: 'E007' }, { active: false });
    expect((await get('/api/me/schedule', emp.E007)).status).toBe(401);
  });

  test('a token claiming a role the account does not have is 401', async () => {
    const u = await User.findOne({ username: 'E001' });
    const forged = jwt.sign({ role: 'manager', username: 'E001' }, SECRET, { subject: String(u._id), jwtid: 'forged' });
    expect((await get('/api/history', forged)).status).toBe(401);
  });

  test('GET /api/auth/me returns the caller from the token', async () => {
    expect((await get('/api/auth/me', mgr)).body).toEqual({ username: 'manager', role: 'manager', employeeId: null });
    expect((await get('/api/auth/me', emp.E003)).body).toEqual({ username: 'E003', role: 'employee', employeeId: 'E003' });
  });

  test('logout ends that token only', async () => {
    const a = (await login('E001', pw.E001)).body.token;
    const b = (await login('E001', pw.E001)).body.token;
    expect((await get('/api/auth/me', a)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set(bearer(a))).status).toBe(204);
    expect((await get('/api/auth/me', a)).status).toBe(401);
    expect((await get('/api/auth/me', b)).status).toBe(200);
  });
});

describe('role restrictions', () => {
  test('manager can upload, validate, list, read and delete', async () => {
    const saved = await check(seed);
    expect(saved.status).toBe(200);
    expect(saved.body.saved).toBe(true);
    expect((await get('/api/history', mgr)).body.total).toBe(1);
    expect((await get(`/api/history/${saved.body.resultId}`, mgr)).status).toBe(200);
    expect((await request(app).delete(`/api/history/${saved.body.resultId}`).set(bearer(mgr))).status).toBe(204);
  });

  test('the saved roster records which manager uploaded it', async () => {
    await check(small);
    const manager = await User.findOne({ username: 'manager' });
    const roster = await Roster.findOne({}).lean();
    expect(String(roster.ownerId)).toBe(String(manager._id));
  });

  test('an employee gets 403 on every manager route, and nothing is saved or deleted', async () => {
    const saved = await check(seed);
    const id = saved.body.resultId;
    const calls = [
      request(app).post('/api/check').set(bearer(emp.E003)).send(seed),
      request(app).get('/api/history').set(bearer(emp.E003)),
      request(app).get(`/api/history/${id}`).set(bearer(emp.E003)),
      request(app).delete(`/api/history/${id}`).set(bearer(emp.E003)),
    ];
    for (const r of await Promise.all(calls)) {
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    }
    expect(await ValidationResult.countDocuments()).toBe(1);
    expect(await Roster.countDocuments()).toBe(1);
  });

  test('a 403 reveals nothing: same response whether or not the result exists or the body is valid', async () => {
    const a = await request(app).post('/api/check').set(bearer(emp.E003)).send({ junk: true });
    const b = await request(app).get('/api/history/ffffffffffffffffffffffff').set(bearer(emp.E003));
    expect([a.status, b.status]).toEqual([403, 403]);
    expect(a.body).toEqual(b.body);
  });

  test('the manager is not allowed on the employee portal route', async () => {
    expect((await get('/api/me/schedule', mgr)).status).toBe(403);
  });
});

describe('employee data isolation', () => {
  const forbiddenIds = (text, own) => ['E001', 'E003', 'E005', 'E007', 'E010', 'E012', 'E015'].filter((id) => id !== own && text.includes(id));

  test('E003 sees only their own shifts, and only their own finding (SHORT_REST)', async () => {
    await check(seed);
    const res = await get('/api/me/schedule', emp.E003);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasRoster: true, employeeId: 'E003' });
    expect(res.body.shifts.length).toBeGreaterThan(0);
    expect(res.body.findings.map((f) => f.rule)).toEqual(['SHORT_REST']);
    expect(forbiddenIds(res.text, 'E003')).toEqual([]);
    expect(Object.keys(res.body.shifts[0]).sort()).toEqual(['date', 'end', 'shiftId', 'start', 'storeId']);
  });

  test('E007 sees their OVERLAP, E005 their DUPLICATE_ROW, E001 no findings', async () => {
    await check(seed);
    expect((await get('/api/me/schedule', emp.E007)).body.findings.map((f) => f.rule)).toEqual(['OVERLAP']);
    expect((await get('/api/me/schedule', emp.E005)).body.findings.map((f) => f.rule)).toEqual(['DUPLICATE_ROW']);
    const e1 = await get('/api/me/schedule', emp.E001);
    expect(e1.body.findings).toEqual([]);
    expect(forbiddenIds(e1.text, 'E001')).toEqual([]);
  });

  test('the six findings are spread over employees: no employee ever receives another one', async () => {
    await check(seed);
    let total = 0;
    for (const id of ['E001', 'E003', 'E005', 'E007']) {
      const res = await get('/api/me/schedule', emp[id]);
      total += res.body.findings.length;
      expect(res.body.shifts.every((s) => s.shiftId)).toBe(true);
    }
    expect(total).toBe(3); // E003, E005 and E007 each have one; E001 has none
  });

  test('the employee ID cannot be chosen: query, header, URL and body are ignored', async () => {
    await check(seed);
    const own = await get('/api/me/schedule', emp.E001);
    const tries = [
      request(app).get('/api/me/schedule?employeeId=E007').set(bearer(emp.E001)),
      request(app).get('/api/me/schedule?employeeId[$ne]=E001').set(bearer(emp.E001)),
      request(app).get('/api/me/schedule').set({ ...bearer(emp.E001), 'X-Employee-Id': 'E007' }),
      request(app).get('/api/me/schedule').set(bearer(emp.E001)).send({ employeeId: 'E007' }),
    ];
    for (const r of await Promise.all(tries)) {
      expect(r.status).toBe(200);
      expect(r.body.employeeId).toBe('E001');
      expect(r.body).toEqual(own.body);
    }
    expect((await get('/api/me/schedule/E007', emp.E001)).status).toBe(404);
    expect((await get('/api/me/E007', emp.E001)).status).toBe(404);
  });

  test('no roster uploaded yet: a clear empty answer, not an error', async () => {
    const res = await get('/api/me/schedule', emp.E003);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasRoster: false, employeeId: 'E003', rosterDate: null, homeStore: null, shifts: [], leave: [], findings: [] });
  });

  test('the latest saved roster is used, and falls back to the previous one if it is deleted', async () => {
    const first = await check(seed);
    expect((await get('/api/me/schedule', emp.E003)).body.shifts.length).toBeGreaterThan(0);
    const second = await check(small); // E003 is not in this one
    const now = await get('/api/me/schedule', emp.E003);
    expect(now.body).toMatchObject({ hasRoster: true, shifts: [], findings: [] });
    await request(app).delete(`/api/history/${second.body.resultId}`).set(bearer(mgr));
    expect((await get('/api/me/schedule', emp.E003)).body.shifts.length).toBeGreaterThan(0);
    await request(app).delete(`/api/history/${first.body.resultId}`).set(bearer(mgr));
    expect((await get('/api/me/schedule', emp.E003)).body.hasRoster).toBe(false);
  });

  test('an employee who is not in the roster gets an empty schedule, not someone else\'s', async () => {
    await check(seed);
    const res = await get('/api/me/schedule', emp.E099);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasRoster: true, shifts: [], leave: [], findings: [], homeStore: null });
  });

  test('an employee with leave sees their own leave only', async () => {
    const leaveCsv = 'leave_id,employee_id,start_date,end_date,status\nL1,E001,2026-11-24,2026-11-25,approved\nL2,E003,2026-12-01,2026-12-02,approved\n';
    const emps = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,A,S01,x,1\nE003,B,S01,x,1\n';
    await check({ employees: emps, shifts: SHIFTS, leave: leaveCsv });
    const res = await get('/api/me/schedule', emp.E003);
    expect(res.body.leave).toEqual([{ leaveId: 'L2', startDate: '2026-12-01', endDate: '2026-12-02', status: 'approved' }]);
    expect(res.text).not.toContain('L1');
  });

  test('schedule is 503 when MongoDB is down', async () => {
    const token = emp.E001;
    await db.disconnect();
    try {
      const res = await get('/api/me/schedule', token);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
    } finally {
      await db.connect(mongod.getUri('auth'), logger);
    }
  });
});

describe('seeded findings are unchanged', () => {
  test('the manager still gets exactly the six planted findings', async () => {
    const res = await check(seed);
    expect(res.body.findings.map((f) => [f.rule, f.employeeId])).toEqual([
      ['SHORT_REST', 'E003'], ['DUPLICATE_ROW', 'E005'], ['OVERLAP', 'E007'],
      ['DATA_BAD_ROW', 'E010'], ['OVERLAP', 'E012'], ['ON_LEAVE', 'E015'],
    ]);
  });
});
