// Tiny in-memory TTL cache so a busy dashboard does not burn through provider rate limits.
const store = new Map();

function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.exp < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.val;
}

function set(key, val, ttlMs) {
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) if (v.exp < now) store.delete(k);
    if (store.size > 500) store.clear();
  }
  store.set(key, { val, exp: Date.now() + ttlMs });
}

async function remember(key, ttlMs, fn) {
  const hit = get(key);
  if (hit !== undefined) return hit;
  const val = await fn();
  set(key, val, ttlMs);
  return val;
}

const clear = () => store.clear();

module.exports = { get, set, remember, clear };
