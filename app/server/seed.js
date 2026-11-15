// Creates the demo accounts once. Run: node server/seed.js [path/to/employees.csv]
//  - manager: password from MANAGER_PASSWORD (required), only created if missing.
//  - employees: one account per employee_id in employees.csv, with a random password.
//    New passwords are written to credentials.txt (git-ignored, mode 600), never logged.
//    Existing accounts are never touched, so passwords are not regenerated on restart.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { parseCsv } = require('./parse/csv');
const User = require('./models/User');
const { createLogger } = require('./logger');
const db = require('./db');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const ROUNDS = 10;

const randomPassword = () => crypto.randomBytes(12).toString('base64url'); // 96 bits

function employeeIdsFrom(csvText) {
  const { header, rows } = parseCsv(csvText);
  const i = header ? header.indexOf('employee_id') : -1;
  if (i < 0) throw new Error('employees.csv has no employee_id column');
  return [...new Set(rows.map((r) => r.fields[i]).filter((id) => ID_RE.test(id)))];
}

// Creates the manager only if there is none. An existing manager's password is never changed.
async function ensureManager(managerPassword) {
  if (await User.exists({ username: 'manager' })) return false;
  await User.create({
    username: 'manager',
    role: 'manager',
    passwordHash: await bcrypt.hash(managerPassword, ROUNDS),
  });
  return true;
}

async function seedUsers({ managerPassword, employeeIds, credentialsFile, logger }) {
  const out = { managerCreated: await ensureManager(managerPassword), employeesCreated: 0, employeesSkipped: 0 };

  const lines = [];
  for (const id of employeeIds) {
    if (await User.exists({ username: id })) {
      out.employeesSkipped += 1;
      continue;
    }
    const password = randomPassword();
    await User.create({
      username: id,
      role: 'employee',
      employeeId: id,
      passwordHash: await bcrypt.hash(password, ROUNDS),
    });
    lines.push(`${id},${password}`);
    out.employeesCreated += 1;
  }

  if (lines.length && credentialsFile) {
    const header = fs.existsSync(credentialsFile) ? '' : 'username,password\n';
    fs.appendFileSync(credentialsFile, header + lines.join('\n') + '\n', { mode: 0o600 });
  }
  if (logger) logger.info('seed_done', out); // counts only
  return out;
}

async function main() {
  const logger = createLogger();
  const csvPath = process.argv[2] || path.join(__dirname, '../../case/seed/employees.csv');
  if (!process.env.MANAGER_PASSWORD) {
    console.error('MANAGER_PASSWORD is required (see .env.example)');
    process.exit(1);
  }
  const ids = employeeIdsFrom(fs.readFileSync(csvPath, 'utf8'));
  if (!(await db.connect(db.buildMongoUri(), logger))) process.exit(1);
  await seedUsers({
    managerPassword: process.env.MANAGER_PASSWORD,
    employeeIds: ids,
    credentialsFile: process.env.CREDENTIALS_FILE || path.join(process.cwd(), 'credentials.txt'),
    logger,
  });
  await db.disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('seed failed:', e.name);
    process.exit(1);
  });
}

module.exports = { ensureManager, seedUsers, employeeIdsFrom, randomPassword };
