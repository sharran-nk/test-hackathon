const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../db');
const { signToken, requireAuth, revoke, DUMMY_HASH } = require('../auth');
const { send } = require('./util');

// POST /api/auth/login   { username, password }  ->  { token, user }
// GET  /api/auth/me      who am I (from the verified token)
// POST /api/auth/logout  the token stops working
function createAuthRouter(config, logger, lookupUser) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string'
        || username.trim() === '' || username.length > 64 || password === '' || password.length > 128) {
        return send(res, 400, 'INVALID_REQUEST', 'username and password are required (text).');
      }
      if (!db.isUp()) {
        return send(res, 503, 'AUTH_UNAVAILABLE', 'Sign-in is unavailable right now (database not reachable).');
      }
      const user = await User.findOne({ username: username.trim() });
      const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
      if (!user || !ok || user.active === false) {
        logger.info('login_failed', { requestId: req.id });
        return send(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
      }
      logger.info('login_ok', { requestId: req.id, role: user.role });
      return res.json({
        token: signToken(config, user),
        user: { username: user.username, role: user.role, employeeId: user.employeeId || null },
      });
    } catch (err) {
      return next(err);
    }
  });

  const auth = requireAuth(config, logger, lookupUser);

  router.get('/me', auth, (req, res) => {
    res.json({ username: req.user.username, role: req.user.role, employeeId: req.user.employeeId || null });
  });

  router.post('/logout', auth, (req, res) => {
    revoke(req.token);
    res.status(204).end();
  });

  return router;
}

module.exports = { createAuthRouter };
