const mongoose = require('mongoose');

// One reusable connection. Fails fast when the database is down (no buffering), so callers
// can answer "saved: false" or 503 instead of hanging. The URI is never logged.

// Builds the URI from parts, URL-encoding the credentials. MONGODB_URI wins if set.
function buildMongoUri(env = process.env) {
  if (env.MONGODB_URI) return env.MONGODB_URI;
  const { MONGO_ROOT_USERNAME: u, MONGO_ROOT_PASSWORD: p } = env;
  if (!u || !p) return null;
  const host = env.MONGO_HOST || 'mongo';
  const dbName = env.MONGO_DB || 'roster';
  return `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${host}:27017/${dbName}?authSource=admin`;
}

const OPTIONS = { serverSelectionTimeoutMS: 5000, bufferCommands: false };

async function connect(uri, logger) {
  if (!uri) {
    if (logger) logger.warn('db_not_configured');
    return false;
  }
  try {
    await mongoose.connect(uri, OPTIONS);
    await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build indexes
    if (logger) logger.info('db_connected');
    return true;
  } catch (err) {
    // Name only: the message can contain the connection string.
    if (logger) logger.error('db_connect_failed', { errorName: err.name });
    return false;
  }
}

// readyState 1 = connected. Used by /health and the history routes later.
const isUp = () => mongoose.connection.readyState === 1;
const disconnect = () => mongoose.disconnect();

module.exports = { buildMongoUri, connect, disconnect, isUp };
