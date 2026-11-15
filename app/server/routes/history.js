const express = require('express');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const send = (res, status, code, message) => res.status(status).json({ error: { code, message } });

// Positive whole number from a query string, or the fallback. "abc", "0", "-1", "1.5" are rejected.
function intParam(raw, fallback, name) {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw) || Number(raw) < 1) {
    const err = new Error(`${name} must be a positive whole number.`);
    err.badParam = true;
    throw err;
  }
  return Number(raw);
}

// GET /api/history?page=1&limit=20   list, newest first (limit is capped at 100)
// GET /api/history/:id               one saved result with its findings in order
// DELETE /api/history/:id            delete the result, its findings and its roster
// Every route answers 503 when MongoDB is down; the checker itself keeps working.
function createHistoryRouter({ store, logger }) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!store.isUp()) {
      return send(res, 503, 'HISTORY_UNAVAILABLE', 'Saved history is unavailable right now (database not reachable). Checking still works.');
    }
    return next();
  });

  // A database error in the middle of a request is also "unavailable". Only the error name
  // is logged: messages from the driver can contain connection details.
  const guard = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err.badParam) return send(res, 400, 'INVALID_REQUEST', err.message);
      logger.error('history_db_error', { requestId: req.id, errorName: err.name });
      return send(res, 503, 'HISTORY_UNAVAILABLE', 'Saved history is unavailable right now (database error). Checking still works.');
    }
    return undefined;
  };

  const badId = (res) => send(res, 400, 'INVALID_REQUEST', 'Result ID is not valid.');
  const notFound = (res) => send(res, 404, 'NOT_FOUND', 'No saved result with that ID. It may have been deleted or expired.');

  router.get('/', guard(async (req, res) => {
    const page = intParam(req.query.page, 1, 'page');
    const limit = Math.min(intParam(req.query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);
    const { total, items } = await store.listResults({ page, limit });
    res.json({ page, limit, total, pages: Math.ceil(total / limit), items });
  }));

  router.get('/:id', guard(async (req, res) => {
    if (!store.isValidId(req.params.id)) return badId(res);
    const found = await store.getResult(req.params.id);
    return found ? res.json(found) : notFound(res);
  }));

  router.delete('/:id', guard(async (req, res) => {
    if (!store.isValidId(req.params.id)) return badId(res);
    return (await store.deleteResult(req.params.id)) ? res.status(204).end() : notFound(res);
  }));

  return router;
}

module.exports = { createHistoryRouter, MAX_LIMIT, DEFAULT_LIMIT };
