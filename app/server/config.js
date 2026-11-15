// Reads all settings from environment variables. Refuses to start without ACCESS_KEY.
function intFrom(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive whole number`);
  }
  return n;
}

function loadConfig(env = process.env) {
  if (!env.ACCESS_KEY || env.ACCESS_KEY.trim() === '') {
    throw new Error('ACCESS_KEY is required. Set it in the environment (see .env.example).');
  }
  return {
    accessKey: env.ACCESS_KEY,
    port: intFrom(env, 'PORT', 3000),
    maxBodyKb: intFrom(env, 'MAX_BODY_KB', 1024),
    maxFindings: intFrom(env, 'MAX_FINDINGS', 1000),
    minRestHours: intFrom(env, 'MIN_REST_HOURS', 11),
  };
}

module.exports = { loadConfig };
