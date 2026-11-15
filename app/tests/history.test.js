const fs = require('fs');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');
const db = require('../server/db');
const Roster = require('../server/models/Roster');
const ValidationResult = require('../server/models/ValidationResult');
const Finding = require('../server/models/Finding');

jest.setTimeout(120000);

const { SECRET } = require('./helpers');
const { ensureManager } = require('../server/seed');
const logs = [];
const logger = {
  info: () => {},
  warn: () => {},
  error: (m, f) => logs.push(JSON.stringify({ m, ...f })),
};
const app = createApp(loadConfig({ JWT_SECRET: SECRET }), { logger, clientDir: null });
let TOKEN; // a real manager login, obtained in beforeAll
const auth = (r) => r.set('Authorization', `Bearer ${TOKEN}`);
const check = (body) => auth(request(app).post('/api/check')).send(body);
const hist = (p = '') => auth(request(app).get(`/api/history${p}`));
const del = (id) => auth(request(app).delete(`/api/history/${id}`));

const seedDir = path.join(__dirname, '../../case/seed');
const seed = {
  employees: fs.readFileSync(path.join(seedDir, 'employees.csv'), 'utf8'),
  shifts: fs.readFileSync(path.join(seedDir, 'shifts.csv'), 'utf8'),
  leave: fs.readFileSync(path.join(seedDir, 'leave.csv'), 'utf8'),
};
const EMP = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,Priya Nair,S01,Manager,40\n';
const SHIFTS = 'shift_id,employee_id,store_id,date,start,end\nA1,E001,S01,2026-11-18,09:00,15:00\nA2,E001,S01,2026-11-18,13:00,19:00\n';
const small = { employees: EMP, shifts: SHIFTS, leave: '' };

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await db.connect(mongod.getUri('history'), logger);
  await ensureManager('manager123');
  const login = await request(app).post('/api/auth/login').send({ username: 'manager', password: 'manager123' });
  TOKEN = login.body.token;
});
afterAll(async () => {
  await db.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  logs.length = 0;
  jest.restoreAllMocks();
  if (!db.isUp()) await db.connect(mongod.getUri('history'), logger);
  await Promise.all([Roster.deleteMany({}), ValidationResult.deleteMany({}), Finding.deleteMany({})]);
});

const counts = async () => ({
  rosters: await Roster.countDocuments(),
  results: await ValidationResult.countDocuments(),
  findings: await Finding.countDocuments(),
});

describe('persistence', () => {
  test('seed data: saved:true, resultId, exactly the six expected findings, same as the stored ones', async () => {
    const res = await check(seed);
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(res.body.resultId).toMatch(/^[0-9a-f]{24}$/);
    expect(res.body.findings.map((f) => [f.rule, f.employeeId])).toEqual([
      ['SHORT_REST', 'E003'], ['DUPLICATE_ROW', 'E005'], ['OVERLAP', 'E007'],
      ['DATA_BAD_ROW', 'E010'], ['OVERLAP', 'E012'], ['ON_LEAVE', 'E015'],
    ]);
    const stored = await hist(`/${res.body.resultId}`);
    expect(stored.status).toBe(200);
    expect(stored.body.findings).toEqual(res.body.findings); // same order, same fields
    expect(stored.body.summary).toEqual(res.body.summary);
  });

  test('stores roster rows (no names, roles or hours), the result and one document per finding', async () => {
    const res = await check(small);
    expect(await counts()).toEqual({ rosters: 1, results: 1, findings: 1 });
    const raw = JSON.stringify(await Roster.collection.find({}).toArray());
    expect(raw).toContain('E001');
    expect(raw).not.toMatch(/Priya|Nair|Manager|contracted|"name"|"role"/);
    expect(res.body.saved).toBe(true);
  });

  test('a clear roster saves with zero findings', async () => {
    const res = await check({ employees: EMP, shifts: 'shift_id,employee_id,store_id,date,start,end\nA1,E001,S01,2026-11-18,09:00,15:00\n', leave: '' });
    expect(res.body).toMatchObject({ saved: true });
    expect(res.body.summary.clear).toBe(true);
    expect(await counts()).toEqual({ rosters: 1, results: 1, findings: 0 });
  });

  test('a rejected request (400) saves nothing', async () => {
    expect((await check({ employees: EMP })).status).toBe(400);
    expect(await counts()).toEqual({ rosters: 0, results: 0, findings: 0 });
  });

  test('findings are stored in the same deterministic order', async () => {
    const a = await check(seed);
    const b = await check(seed);
    const fa = (await hist(`/${a.body.resultId}`)).body.findings;
    const fb = (await hist(`/${b.body.resultId}`)).body.findings;
    expect(fa.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fb).toEqual(fa);
  });
});

describe('partial failures', () => {
  test('findings insert fails: findings still returned, saved:false, nothing left behind', async () => {
    jest.spyOn(Finding, 'insertMany').mockRejectedValueOnce(new Error('boom password=secret'));
    const res = await check(small);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ saved: false, resultId: null });
    expect(res.body.findings).toHaveLength(1);
    expect(await counts()).toEqual({ rosters: 0, results: 0, findings: 0 });
    expect(logs.join('')).toContain('save_failed');
    expect(logs.join('')).not.toContain('secret'); // error message is never logged
  });

  test('result insert fails after findings were written: findings and roster are cleaned up', async () => {
    jest.spyOn(ValidationResult, 'create').mockRejectedValueOnce(new Error('boom'));
    const res = await check(seed);
    expect(res.body).toMatchObject({ saved: false, resultId: null });
    expect(res.body.findings).toHaveLength(6);
    expect(await counts()).toEqual({ rosters: 0, results: 0, findings: 0 });
  });

  test('roster insert fails: nothing is written', async () => {
    jest.spyOn(Roster.prototype, 'save').mockRejectedValueOnce(new Error('boom'));
    const res = await check(small);
    expect(res.body.saved).toBe(false);
    expect(await counts()).toEqual({ rosters: 0, results: 0, findings: 0 });
  });

  test('cleanup also failing does not crash: still 200 saved:false, and no result exists to be listed', async () => {
    jest.spyOn(ValidationResult, 'create').mockRejectedValueOnce(new Error('boom'));
    jest.spyOn(Finding, 'deleteMany').mockRejectedValueOnce(new Error('cleanup boom'));
    const res = await check(small);
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(false);
    expect((await hist()).body.total).toBe(0); // leftovers are unreachable (and expire by TTL)
  });

  test('a save failure does not change the findings', async () => {
    const ok = await check(seed);
    jest.spyOn(Roster.prototype, 'save').mockRejectedValueOnce(new Error('boom'));
    const failed = await check(seed);
    expect(failed.body.findings).toEqual(ok.body.findings);
    expect(failed.body.summary).toEqual(ok.body.summary);
  });
});

describe('GET /api/history', () => {
  test('empty history is a normal empty list', async () => {
    const res = await hist();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, limit: 20, total: 0, pages: 0, items: [] });
  });

  test('lists newest first with summary only (no findings, no roster rows)', async () => {
    const first = await check(small);
    const second = await check(seed);
    const res = await hist();
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((i) => i.id)).toEqual([second.body.resultId, first.body.resultId]);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(['createdAt', 'id', 'summary']);
    expect(res.body.items[0].summary.counts.OVERLAP).toBe(2);
    expect(JSON.stringify(res.body)).not.toMatch(/E003|shifts"/);
  });

  test('pagination: pages, limit, pages count, no overlap between pages', async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push((await check(small)).body.resultId);
    const p1 = (await hist('?page=1&limit=2')).body;
    const p2 = (await hist('?page=2&limit=2')).body;
    const p3 = (await hist('?page=3&limit=2')).body;
    const p4 = (await hist('?page=4&limit=2')).body;
    expect([p1.items.length, p2.items.length, p3.items.length, p4.items.length]).toEqual([2, 2, 1, 0]);
    expect(p1).toMatchObject({ page: 1, limit: 2, total: 5, pages: 3 });
    const all = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(all).toEqual([...ids].reverse());
  });

  test('limit is capped at 100', async () => {
    expect((await hist('?limit=5000')).body.limit).toBe(100);
  });

  test.each(['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=1.5', 'limit=1e3', 'page=1&page=2', 'limit[$gt]=1'])(
    'bad query "%s" gives 400, not a crash or an injection',
    async (q) => {
      const res = await hist(`?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    },
  );
});

describe('GET /api/history/:id', () => {
  test('returns summary, findings in order and roster counts only', async () => {
    const saved = await check(seed);
    const res = await hist(`/${saved.body.resultId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: saved.body.resultId });
    expect(res.body.findings).toHaveLength(6);
    expect(res.body.roster).toEqual(expect.objectContaining({ employees: expect.any(Number), shifts: expect.any(Number), leave: expect.any(Number) }));
    expect(res.body.roster.employees).toBeGreaterThan(10);
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'findings', 'id', 'roster', 'summary']);
    expect(Object.keys(res.body.findings[0])).not.toContain('resultId');
    expect(JSON.stringify(res.body)).not.toMatch(/Priya|Tom Hargreaves|passwordHash/);
  });

  test('unknown but well-formed ID gives 404', async () => {
    const res = await hist(`/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test.each(['abc', '123', '{"$ne":null}', '%7B%22%24ne%22%3Anull%7D', 'zzzzzzzzzzzzzzzzzzzzzzzz'])('malformed ID "%s" gives 400', async (id) => {
    expect((await hist(`/${id}`)).status).toBe(400);
  });
});

describe('DELETE /api/history/:id', () => {
  test('removes the result, its findings and its roster, and only those', async () => {
    const keep = await check(seed);
    const gone = await check(small);
    expect(await counts()).toEqual({ rosters: 2, results: 2, findings: 7 });
    const res = await del(gone.body.resultId);
    expect(res.status).toBe(204);
    expect(await counts()).toEqual({ rosters: 1, results: 1, findings: 6 });
    expect((await hist(`/${gone.body.resultId}`)).status).toBe(404);
    expect((await hist(`/${keep.body.resultId}`)).status).toBe(200);
  });

  test('deleting twice: second is 404', async () => {
    const saved = await check(small);
    expect((await del(saved.body.resultId)).status).toBe(204);
    expect((await del(saved.body.resultId)).status).toBe(404);
  });

  test('malformed ID is 400 and nothing is deleted', async () => {
    await check(small);
    expect((await del('not-an-id')).status).toBe(400);
    expect((await counts()).results).toBe(1);
  });

  test('if findings cleanup fails, the result is already gone from the API (and the DB error is a 503)', async () => {
    const saved = await check(small);
    jest.spyOn(Finding, 'deleteMany').mockRejectedValueOnce(new Error('boom'));
    expect((await del(saved.body.resultId)).status).toBe(503);
    expect((await hist(`/${saved.body.resultId}`)).status).toBe(404);
  });
});

describe('authorization', () => {
  test.each([['get', '/api/history'], ['get', '/api/history/abc'], ['delete', '/api/history/abc']])('%s %s without a token is 401', async (m, p) => {
    expect((await request(app)[m](p)).status).toBe(401);
  });
  test('wrong token is 401', async () => {
    expect((await request(app).get('/api/history').set('Authorization', 'Bearer not.a.token')).status).toBe(401);
  });
});

describe('database outage', () => {
  // The server fails closed: with MongoDB down it cannot verify the account, so every protected
  // request is 503. To still test what the history routes and the checker do when only the data
  // part is unavailable, the first test hands the app an account lookup that says "manager".
  const verifiedApp = createApp(loadConfig({ JWT_SECRET: SECRET }), {
    logger, clientDir: null, lookupUser: async () => ({ role: 'manager', active: true }),
  });

  test('account verified but MongoDB down: history routes 503, check still returns findings with saved:false', async () => {
    const saved = await check(small);
    const id = saved.body.resultId;
    await db.disconnect();
    const call = (m, p) => request(verifiedApp)[m](p).set('Authorization', 'Bearer ' + TOKEN);
    for (const res of [await call('get', '/api/history'), await call('get', '/api/history/' + id), await call('delete', '/api/history/' + id)]) {
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('HISTORY_UNAVAILABLE');
    }
    const res = await call('post', '/api/check').send(seed);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ saved: false, resultId: null });
    expect(res.body.findings).toHaveLength(6);
  });

  test('FAIL CLOSED: with MongoDB down and the real lookup, every protected route is 503 AUTH_UNAVAILABLE', async () => {
    const saved = await check(small);
    await db.disconnect();
    const calls = [await hist(), await hist('/' + saved.body.resultId), await del(saved.body.resultId), await check(seed)];
    for (const res of calls) {
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
      expect(res.body.findings).toBeUndefined();
    }
  });

  test('connection lost in the middle of a request: 503 and the error message is not logged', async () => {
    jest.spyOn(ValidationResult, 'countDocuments').mockRejectedValueOnce(new Error('mongodb://u:pw@host failed'));
    const res = await hist();
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('pw@host');
    expect(logs.join('')).toContain('history_db_error');
    expect(logs.join('')).not.toContain('pw@host');
  });

  test('server comes back: history works again', async () => {
    await db.disconnect();
    expect((await hist()).status).toBe(503);
    await db.connect(mongod.getUri('history'), logger);
    expect((await hist()).status).toBe(200);
  });
});
