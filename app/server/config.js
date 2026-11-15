// Reads all settings from environment variables. Refuses to start without a JWT_SECRET.
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
  const secret = env.JWT_SECRET || '';
  if (secret.trim().length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters. Set it in the environment (see .env.example).');
  }
  const expires = env.JWT_EXPIRES_IN || '8h';
  if (!/^[1-9]\d{0,3}[mhd]$/.test(expires)) {
    throw new Error('JWT_EXPIRES_IN must look like 30m, 8h or 1d');
  }
  return {
    jwtSecret: secret,
    jwtExpiresIn: expires,
    port: intFrom(env, 'PORT', 3000),
    maxBodyKb: intFrom(env, 'MAX_BODY_KB', 1024),
    maxFindings: intFrom(env, 'MAX_FINDINGS', 1000),
    minRestHours: intFrom(env, 'MIN_REST_HOURS', 11),
  };
}

module.exports = { loadConfig };
