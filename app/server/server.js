const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { createApp } = require('./index');
const db = require('./db');
const { ensureManager } = require('./seed');

const logger = createLogger();
let config;
try {
  config = loadConfig();
} catch (err) {
  logger.error('startup_failed', { reason: err.message });
  process.exit(1);
}

createApp(config, { logger }).listen(config.port, () => {
  logger.info('listening', { port: config.port });
});

// Connect in the background so the checker answers even if MongoDB is slow or down. Retry until it
// is up, then make sure the manager account exists (an existing one is never changed).
// The driver reconnects by itself if the connection drops later.
(async function connectWithRetry() {
  const uri = db.buildMongoUri();
  if (!uri) {
    logger.warn('db_not_configured');
    return;
  }
  while (!(await db.connect(uri, logger))) {
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!process.env.MANAGER_PASSWORD) {
    logger.warn('manager_password_not_set');
    return;
  }
  try {
    if (await ensureManager(process.env.MANAGER_PASSWORD)) logger.info('manager_created');
  } catch (err) {
    logger.error('manager_setup_failed', { errorName: err.name });
  }
}());
