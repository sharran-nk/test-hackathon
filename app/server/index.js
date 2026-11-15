const crypto = require('crypto');
const express = require('express');
const { createLogger } = require('./logger');

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
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such route.' } });
  });

  return app;
}

module.exports = { createApp };
