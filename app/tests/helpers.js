// Shared test helpers (not a test file: Jest only runs *.test.js).
const { signToken } = require('../server/auth');

// Stand-in for the database account lookup, for tests that run without MongoDB. The server fails
// closed without a lookup, so these tests hand createApp this one instead. Accounts are the ones
// tokenFor() made.
const accounts = new Map();
const lookupUser = async (id) => accounts.get(id) || null;

const SECRET = 'test-jwt-secret-0123456789-abcdefghijklmnop';

// A signed token for tests that run without MongoDB (pair it with the stub lookupUser above).
// Tests that use MongoDB log in through /api/auth/login instead, so the user really exists.
function tokenFor(config, role = 'manager', employeeId) {
  const id = role === 'manager' ? 'aaaaaaaaaaaaaaaaaaaaaaaa' : 'bbbbbbbbbbbbbbbbbbbbbbbb';
  accounts.set(id, { role, employeeId, active: true });
  return signToken(config, {
    id,
    username: role === 'manager' ? 'manager' : employeeId,
    role,
    employeeId,
  });
}

module.exports = { SECRET, tokenFor, lookupUser };
