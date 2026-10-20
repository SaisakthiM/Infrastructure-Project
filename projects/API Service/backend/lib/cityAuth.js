// Who is calling? Ask the city bank. The caller's JWT is replayed against GET {bank}/accounts/{id}; the bank
// answers 200 only if the token is valid and owns that account, and the body carries the username.
// Verified identities are trusted for 60 s; if the bank is unreachable, one verified within 24 h is accepted
// (Safe Mode). An explicit 401/403/404 from the bank always wins.
const axios = require('axios');

const BANK = (process.env.BANK_API_URL || 'http://bank-backend:8080/api').replace(/\/$/, '');
const FRESH_MS = 60 * 1000;
const STALE_MS = 24 * 3600 * 1000;
const cache = new Map(); // `${account}:${token}` -> { at, user }

async function verify(req) {
  const auth = req.get('authorization') || '';
  const account = req.get('x-city-account') || '';
  const m = /^Bearer\s+(\S+)$/.exec(auth);
  if (!m || !/^\d{1,18}$/.test(account)) return null;

  const key = `${account}:${m[1]}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < FRESH_MS) return hit.user;

  try {
    const res = await axios.get(`${BANK}/accounts/${account}`, {
      headers: { Authorization: `Bearer ${m[1]}`, Accept: 'application/json' },
      timeout: 2500,
    });
    const user = res && res.data && res.data.data && res.data.data.customerName;
    if (!user) {
      cache.delete(key);
      return null;
    }
    if (cache.size > 2000) cache.clear();
    cache.set(key, { at: now, user });
    return user;
  } catch (err) {
    const status = err && err.response && err.response.status;
    if (status && status < 500) {
      cache.delete(key);
      return null;
    }
    return hit && now - hit.at < STALE_MS ? hit.user : null;
  }
}

async function requireCitizen(req, res, next) {
  try {
    const user = await verify(req);
    if (!user) return res.status(401).json({ error: 'Log in to the city bank first.' });
    req.citizen = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { verify, requireCitizen };
