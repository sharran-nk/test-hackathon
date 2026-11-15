// Shared test helpers (not a test file: Jest only runs *.test.js).
const { signToken } = require('../server/auth');

const SECRET = 'test-jwt-secret-0123456789-abcdefghijklmnop';

// A signed token for tests that run without MongoDB (the server trusts a valid signature then).
// Tests that use MongoDB log in through /api/auth/login instead, so the user really exists.
function tokenFor(config, role = 'manager', employeeId) {
  return signToken(config, {
    id: role === 'manager' ? 'aaaaaaaaaaaaaaaaaaaaaaaa' : 'bbbbbbbbbbbbbbbbbbbbbbbb',
    username: role === 'manager' ? 'manager' : employeeId,
    role,
    employeeId,
  });
}

module.exports = { SECRET, tokenFor };
