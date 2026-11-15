const crypto = require('crypto');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

// Shared-key gate (Decision 2). The key must arrive as "Authorization: Bearer <key>".
// Both sides are hashed first so the two buffers always have the same length, then
// compared in constant time. The key is never logged and never put in a response.
function requireKey(expectedKey) {
  const expected = sha256(expectedKey);
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const match = /^Bearer (.+)$/.exec(header);
    if (match && crypto.timingSafeEqual(sha256(match[1]), expected)) {
      return next();
    }
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'A valid access key is required (Authorization: Bearer <key>).' },
    });
  };
}

module.exports = { requireKey };
