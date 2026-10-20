// Minimal fixed-window rate limiter keyed by citizen (or IP).
function limit({ windowMs = 60000, max = 30 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.citizen || req.ip;
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now - rec.start >= windowMs) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { start: now, n: 1 });
      return next();
    }
    rec.n += 1;
    if (rec.n > max) return res.status(429).json({ error: 'Slow down — too many requests.' });
    return next();
  };
}

module.exports = { limit };
