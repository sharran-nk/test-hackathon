const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const db = require('./db');

// JWT authentication. Tokens are signed with HS256 using JWT_SECRET and expire (JWT_EXPIRES_IN).
// The role and employee ID used by the routes come from the verified token (and, when MongoDB is
// up, from the user's database record), never from the request body, query or URL.

const deny = (res, message = 'Sign in required (Authorization: Bearer <token>).') =>
  res.status(401).json({ error: { code: 'UNAUTHORIZED', message } });

function signToken(config, user) {
  return jwt.sign(
    { username: user.username, role: user.role, employeeId: user.employeeId },
    config.jwtSecret,
    { algorithm: 'HS256', subject: String(user._id || user.id), expiresIn: config.jwtExpiresIn, jwtid: crypto.randomUUID() },
  );
}

// Logout list. A JWT cannot be "un-signed", so a logged-out token's ID is remembered here until the
// token would have expired anyway. It lives in memory: a server restart forgets it (documented limit).
const revoked = new Map(); // jti -> expiry (seconds since epoch)
function revoke(payload) {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revoked) if (exp <= now) revoked.delete(jti);
  revoked.set(payload.jti, payload.exp);
}

// A hash to compare against when the username does not exist, so a wrong username and a wrong
// password take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function requireAuth(config, logger) {
  return async (req, res, next) => {
    const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!match) return deny(res);
    let payload;
    try {
      payload = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      return deny(res, err.name === 'TokenExpiredError' ? 'Session expired. Sign in again.' : undefined);
    }
    if (!payload.jti || !payload.sub || revoked.has(payload.jti)) return deny(res);
    const user = { id: payload.sub, username: payload.username, role: payload.role, employeeId: payload.employeeId };

    // While MongoDB is up the account must still exist and be active, and its role must match the
    // token. While it is down the signed token is trusted, so checking a roster still works.
    if (db.isUp()) {
      try {
        const record = await User.findById(payload.sub).select('role active employeeId').lean();
        if (!record || record.active === false || record.role !== payload.role
          || (record.employeeId || undefined) !== (payload.employeeId || undefined)) {
          return deny(res);
        }
      } catch (err) {
        if (err.name === 'CastError') return deny(res);
        logger.error('auth_lookup_failed', { requestId: req.id, errorName: err.name });
      }
    }
    req.user = user;
    req.token = payload;
    return next();
  };
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Your account is not allowed to use this feature.' } });
  }
  return next();
};

module.exports = { signToken, requireAuth, requireRole, revoke, DUMMY_HASH };
