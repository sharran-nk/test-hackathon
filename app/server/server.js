const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { createApp } = require('./index');

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
