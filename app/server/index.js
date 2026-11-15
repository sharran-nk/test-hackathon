const crypto = require('crypto');
const express = require('express');
const { createLogger } = require('./logger');
const { requireKey } = require('./auth');
const { createCheckRouter } = require('./routes/check');
const { InputError } = require('./parse/validate');

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ error: { code, message, ...extra } });

// Builds the Express app. Kept separate from listen() so Supertest can use it.
function createApp(config, { logger = createLogger() } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // One log line per request: method, path, status, duration. No body, no headers.
  app.use((req, res, next) => {
    const started = Date.now();
    req.id = crypto.randomUUID();
    res.on('finish', () => {
      logger.info('request', {
        requestId: req.id,
        method: req.method,
        path: req.baseUrl + req.path, // baseUrl is "/api" inside the mounted routers; no query string, so no data
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Order of checks: key, then size, then JSON and fields, then the rules.
  // An anonymous caller learns nothing about validation.
  app.use('/api', requireKey(config.accessKey));
  app.use('/api', express.json({ limit: `${config.maxBodyKb}kb` }));
  app.use('/api', createCheckRouter(config));

  app.use((req, res) => fail(res, 404, 'NOT_FOUND', 'No such route.'));

  // Central error handler. Messages of unexpected errors are never sent to the client
  // or logged (they could contain request data); only the error name and stack frames are.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof InputError) {
      return fail(res, 400, 'INVALID_REQUEST', err.message);
    }
    if (err.type === 'entity.too.large') {
      return fail(res, 413, 'TOO_LARGE', `Request is larger than the ${config.maxBodyKb} KB limit.`);
    }
    if (err.type === 'entity.parse.failed' || err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
      return fail(res, 400, 'INVALID_REQUEST', 'Request body is not valid JSON.');
    }
    const frames = String(err.stack || '').split('\n').filter((l) => /^\s+at /.test(l)).slice(0, 5);
    logger.error('unhandled_error', { requestId: req.id, errorName: err.name, frames });
    return fail(res, 500, 'INTERNAL', 'Something went wrong on the server.', { requestId: req.id });
  });

  return app;
}

module.exports = { createApp };
