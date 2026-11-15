// Structured logging: one JSON object per line. Callers pass IDs and counts only,
// never names, CSV text or the access key.
function createLogger(write = (line) => process.stdout.write(line + '\n')) {
  function log(level, msg, fields = {}) {
    write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
  }
  return {
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
  };
}

module.exports = { createLogger };
