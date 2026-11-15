const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const db = require('../server/db');
const User = require('../server/models/User');
const Roster = require('../server/models/Roster');
const ValidationResult = require('../server/models/ValidationResult');
const Finding = require('../server/models/Finding');
const { seedUsers, employeeIdsFrom } = require('../server/seed');

jest.setTimeout(120000);

let mongod;
let tmp;
const logs = [];
const logger = {
  info: (m, f) => logs.push(JSON.stringify({ m, ...f })),
  warn: (m, f) => logs.push(JSON.stringify({ m, ...f })),
  error: (m, f) => logs.push(JSON.stringify({ m, ...f })),
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
  expect(await db.connect(mongod.getUri('roster'), logger)).toBe(true);
});
afterAll(async () => {
  await db.disconnect();
  await mongod.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('connection', () => {
  test('is up after connect', () => {
    expect(db.isUp()).toBe(true);
  });

  test('buildMongoUri URL-encodes credentials and prefers MONGODB_URI', () => {
    const uri = db.buildMongoUri({ MONGO_ROOT_USERNAME: 'a@b', MONGO_ROOT_PASSWORD: 'p:/ss w#rd' });
    expect(uri).toBe('mongodb://a%40b:p%3A%2Fss%20w%23rd@mongo:27017/roster?authSource=admin');
    expect(db.buildMongoUri({ MONGODB_URI: 'mongodb://x/y', MONGO_ROOT_USERNAME: 'u', MONGO_ROOT_PASSWORD: 'p' })).toBe('mongodb://x/y');
    expect(db.buildMongoUri({})).toBeNull();
  });

  test('connect() with no URI returns false and does not throw', async () => {
    expect(await db.connect(null, logger)).toBe(false);
  });
});

describe('schemas and indexes', () => {
  test('TTL indexes use RETENTION_DAYS (30 days by default) on all three data collections', async () => {
    for (const Model of [Roster, ValidationResult, Finding]) {
      const idx = await Model.collection.indexes();
      const ttl = idx.find((i) => i.expireAfterSeconds !== undefined);
      expect(ttl).toBeDefined();
      expect(ttl.expireAfterSeconds).toBe(30 * 86400);
    }
  });

  test('lookup indexes exist', async () => {
    const has = async (M, key) => (await M.collection.indexes()).some((i) => JSON.stringify(i.key) === JSON.stringify(key));
    expect(await has(ValidationResult, { ownerId: 1, createdAt: -1 })).toBe(true);
    expect(await has(Finding, { resultId: 1, seq: 1 })).toBe(true);
    expect(await has(Finding, { resultId: 1, employeeId: 1 })).toBe(true);
    expect(await has(User, { username: 1 })).toBe(true);
  });

  test('roster round trip drops names and other unknown fields', async () => {
    const owner = new mongoose.Types.ObjectId();
    const r = await Roster.create({
      ownerId: owner,
      employees: [{ employeeId: 'E001', homeStore: 'S01', name: 'Priya Nair', role: 'Cashier' }],
      shifts: [{ shiftId: 'SH1', employeeId: 'E001', storeId: 'S01', date: '2026-11-18', start: '09:00', end: '17:00' }],
    });
    const raw = await Roster.collection.findOne({ _id: r._id });
    expect(JSON.stringify(raw)).not.toMatch(/Priya|Cashier|name|role/);
    expect(raw.employees[0]).toEqual({ employeeId: 'E001', homeStore: 'S01' });
  });

  test('result and finding keep order and fields', async () => {
    const owner = new mongoose.Types.ObjectId();
    const roster = await Roster.create({ ownerId: owner });
    const result = await ValidationResult.create({ rosterId: roster._id, ownerId: owner, summary: { clear: false } });
    await Finding.insertMany([
      { resultId: result._id, seq: 1, rule: 'OVERLAP', severity: 'error', employeeId: 'E007', shiftIds: ['A', 'B'], message: 'm2' },
      { resultId: result._id, seq: 0, rule: 'SHORT_REST', severity: 'error', employeeId: 'E003', shiftIds: ['C'], message: 'm1' },
    ]);
    const found = await Finding.find({ resultId: result._id }).sort({ seq: 1 }).lean();
    expect(found.map((f) => f.rule)).toEqual(['SHORT_REST', 'OVERLAP']);
  });

  test('duplicate usernames are rejected', async () => {
    await User.create({ username: 'dup', role: 'employee', employeeId: 'ZD1', passwordHash: 'x' });
    await expect(User.create({ username: 'dup', role: 'employee', employeeId: 'ZD2', passwordHash: 'x' })).rejects.toThrow();
  });
});

describe('seed', () => {
  const csv = 'employee_id,name,home_store,role,contracted_hours_per_week\nE001,A B,S01,x,1\nE002,C D,S01,x,1\nE002,dup,S01,x,1\nbad id,x,S01,x,1\n';

  test('employeeIdsFrom reads IDs from employees.csv, de-duplicated and validated', () => {
    expect(employeeIdsFrom(csv)).toEqual(['E001', 'E002']);
    const real = fs.readFileSync(path.join(__dirname, '../../case/seed/employees.csv'), 'utf8');
    expect(employeeIdsFrom(real).length).toBeGreaterThanOrEqual(15);
    expect(() => employeeIdsFrom('a,b\n1,2\n')).toThrow();
  });

  test('creates manager and employees with bcrypt hashes, unique random passwords, credentials file', async () => {
    await User.deleteMany({});
    const file = path.join(tmp, 'credentials.txt');
    logs.length = 0;
    const out = await seedUsers({ managerPassword: 'manager123', employeeIds: ['E001', 'E002'], credentialsFile: file, logger });
    expect(out).toEqual({ managerCreated: true, employeesCreated: 2, employeesSkipped: 0 });

    const mgr = await User.findOne({ username: 'manager' }).lean();
    expect(mgr.role).toBe('manager');
    expect(mgr.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('manager123', mgr.passwordHash)).toBe(true);

    const creds = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(creds[0]).toBe('username,password');
    const pw = Object.fromEntries(creds.slice(1).map((l) => l.split(',')));
    expect(Object.keys(pw).sort()).toEqual(['E001', 'E002']);
    expect(pw.E001).not.toBe(pw.E002);
    expect(pw.E001.length).toBeGreaterThanOrEqual(16);
    for (const id of ['E001', 'E002']) {
      const u = await User.findOne({ username: id }).lean();
      expect(u.employeeId).toBe(id);
      expect(u.passwordHash).not.toContain(pw[id]);
      expect(await bcrypt.compare(pw[id], u.passwordHash)).toBe(true);
    }
    // no plaintext password anywhere in the logs
    expect(logs.join('\n')).not.toContain(pw.E001);
    expect(logs.join('\n')).not.toContain('manager123');
  });

  test('re-running never regenerates or overwrites passwords', async () => {
    const before = await User.find({}).sort({ username: 1 }).lean();
    const file = path.join(tmp, 'credentials2.txt');
    const out = await seedUsers({ managerPassword: 'changed-password', employeeIds: ['E001', 'E002'], credentialsFile: file, logger });
    expect(out).toEqual({ managerCreated: false, employeesCreated: 0, employeesSkipped: 2 });
    const after = await User.find({}).sort({ username: 1 }).lean();
    expect(after.map((u) => u.passwordHash)).toEqual(before.map((u) => u.passwordHash));
    expect(fs.existsSync(file)).toBe(false);
  });

  test('a new employee added later gets only their own new credential', async () => {
    const file = path.join(tmp, 'credentials3.txt');
    const out = await seedUsers({ managerPassword: 'x', employeeIds: ['E001', 'E003'], credentialsFile: file, logger });
    expect(out.employeesCreated).toBe(1);
    expect(fs.readFileSync(file, 'utf8')).toMatch(/^username,password\nE003,/);
  });
});

describe('database failure', () => {
  test('connect() to an unreachable server returns false and never logs the URI or password', async () => {
    await db.disconnect();
    logs.length = 0;
    const ok = await db.connect('mongodb://user:SuperSecretPw@127.0.0.1:1/x?serverSelectionTimeoutMS=500', logger);
    expect(ok).toBe(false);
    expect(logs.join('\n')).toContain('db_connect_failed');
    expect(logs.join('\n')).not.toMatch(/SuperSecretPw|127\.0\.0\.1/);
    expect(db.isUp()).toBe(false);
    // reconnect for any later tests
    await db.connect(mongod.getUri('roster'), logger);
  });
});
