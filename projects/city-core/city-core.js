/**
 * city-core.js — shared city economy for every Mini City district.
 *
 *  - One bank session for the whole origin (localStorage "city.session")
 *  - City.spend / City.earn talk to the real Bank Manager API (JWT, ₹ integers)
 *  - Safe Mode: if the bank is unreachable, the city keeps running:
 *      * you can still spend money you already hold, but only at ONE service
 *      * earnings go to an offline queue and are applied when the bank returns
 *  - A HUD (balance, bank status, login) any page can mount with one call
 *  - LOGIN GATE: every page that mounts the HUD asks for bank credentials first (non-dismissible)
 *  - Bank fallbacks: several bank URLs are tried in order (see candidateBases); the one that answers is remembered
 *  - Local vault: after a successful login a salted PBKDF2 verifier of the password is kept on this device,
 *    so a known person can still sign in (Safe Mode) when the bank is down. A first-ever login with the bank
 *    down is refused — there is nothing local to check it against.
 *
 * No dependencies, no build step. Plain ES module:
 *      import City from '/city-core/city-core.js';
 *      City.mountHud({ service: 'grocery', title: 'Grocery Store' });   // accent + district code come from DISTRICTS
 */

/* The city registry: ward code and accent per district. One list, so a district is the same colour and the same
   code in the HUD, the panels, the 3D roof plates and the home page. Keep in sync with city-3d.js PALETTE + THEME.md. */
export const DISTRICTS = {
  bank: { code: 'D-01', accent: '#0f6e9c' },
  hospital: { code: 'D-02', accent: '#2b7e72' },
  grocery: { code: 'D-03', accent: '#4c7c3f' },
  housing: { code: 'D-04', accent: '#966e35' },
  blog: { code: 'D-05', accent: '#6e4a79' },
  social: { code: 'D-06', accent: '#4a5aa6' },
  video: { code: 'D-07', accent: '#8d4850' },
  media: { code: 'D-07', accent: '#8d4850' }, // the video district boots with service "media"
  api: { code: 'D-08', accent: '#3d4e66' },
  document: { code: 'D-09', accent: '#6e7042' },
  compiler: { code: 'D-10', accent: '#4a4f55' },
  whisper: { code: 'D-11', accent: '#0f7a8c' },
  police: { code: 'D-12', accent: '#9a4a32' },
};

const KEY = {
  session: 'city.session',
  account: 'city.account',
  queue: 'city.queue.v1',
  ledger: 'city.ledger.v1',
  lock: 'city.safe.lock',
  syncLock: 'city.sync.lock',
  vault: 'city.vault.v1',
  last: 'city.lastUser',
  base: 'city.bank.base',
};

/**
 * Where the bank lives. Tried in this order, first answer wins and is remembered:
 *   1. window.CITY_BANK_BASE            (string)  — set before this module loads
 *   2. window.CITY_BANK_BASES           (array)   — extra / fallback bank URLs
 *   3. /bank/api                                  — the gateway (production and docker-compose)
 *   4. http://localhost:8080/api, 127.0.0.1:8080  — only when the page itself is on localhost
 *      (the bank container's published port; the bank must allow the page's origin in its CORS list)
 */
function candidateBases() {
  const w = typeof window !== 'undefined' ? window : {};
  const out = [];
  const add = (b) => {
    const v = String(b || '').trim().replace(/\/+$/, '');
    if (v && !out.includes(v)) out.push(v);
  };
  add(w.CITY_BANK_BASE);
  (Array.isArray(w.CITY_BANK_BASES) ? w.CITY_BANK_BASES : []).forEach(add);
  add('/bank/api');
  const host = w.location && w.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    add('http://localhost:8080/api');
    add('http://127.0.0.1:8080/api');
  }
  let remembered = null;
  try {
    remembered = localStorage.getItem(KEY.base);
  } catch {
    /* no storage */
  }
  if (remembered && out.includes(remembered)) {
    out.splice(out.indexOf(remembered), 1);
    out.unshift(remembered);
  }
  return out;
}

let activeBase = candidateBases()[0];
function setActiveBase(base) {
  activeBase = base;
  try {
    localStorage.setItem(KEY.base, base);
  } catch {
    /* no storage */
  }
}

const MAX_AMOUNT = 1_000_000_000;
const REQUEST_TIMEOUT_MS = 8000;
const PROBE_MS_SAFE = 10_000;
const PROBE_MS_ONLINE = 60_000;

/* ───────────────────────── small helpers ───────────────────────── */

const listeners = new Set();
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('city-economy') : null;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — economy keeps working in memory */
  }
}

export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '₹–';
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

function toAmount(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0 || v > MAX_AMOUNT) return null;
  return v;
}

function uid() {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

class BankDown extends Error {}
class BankError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
class AuthError extends Error {}

/* ───────────────────────── state ───────────────────────── */

const state = {
  mode: 'anon', // anon | online | safe | syncing
  session: null,
  account: null, // { balance, loanBalance, creditScore, customerName, accountNumber }
  service: null,
  ready: false,
  bankUp: null, // null = unknown, true / false = result of the last reachability check
  needsReauth: false, // offline sign-in is active and the bank is back, but we no longer hold the password
};

// The typed password lives in memory only (never on disk) so an offline session can be upgraded
// to a real bank session without asking again, as long as the tab stays open.
let memAuth = null; // { username, password }

function emit() {
  const snap = City.snapshot();
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch (e) {
      console.error('[city] listener failed', e);
    }
  });
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'city:balance', balance: snap.balance, mode: snap.mode }, '*');
    } catch {
      /* cross-origin parent — ignore */
    }
  }
}

function loadSession() {
  const s = readJSON(KEY.session, null);
  if (!s || (!s.token && !s.offline)) return null;
  if (s.offline) return s; // an offline sign-in has no live token; it is upgraded when the bank returns
  const claims = decodeJwt(s.token);
  if (claims && claims.exp && claims.exp * 1000 < Date.now()) {
    localStorage.removeItem(KEY.session);
    return null;
  }
  return s;
}

function setSession(s) {
  state.session = s;
  if (s) writeJSON(KEY.session, s);
  else {
    localStorage.removeItem(KEY.session);
    localStorage.removeItem(KEY.account);
  }
}

function setAccount(a) {
  if (!a) return;
  setTimeout(vaultTouch, 0);
  state.account = {
    balance: Number(a.balance ?? 0),
    loanBalance: Number(a.loanBalance ?? 0),
    creditScore: Number(a.creditScore ?? 0),
    customerName: a.customerName ?? state.session?.username ?? '',
    accountNumber: a.accountNumber ?? state.session?.accountNumber ?? '',
  };
  writeJSON(KEY.account, state.account);
}

/* ───────────────────────── local vault (offline sign-in) ───────────────────────── */

const VAULT_ITER = 150_000;
const canVault = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof localStorage !== 'undefined';
const vkey = (u) => String(u || '').trim().toLowerCase();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const vaultRead = () => readJSON(KEY.vault, {});

async function derive(password, salt, iter) {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, raw, 256);
}

/** remember a verified login on this device (verifier only, never the password) */
async function vaultSave(username, password, data) {
  if (!canVault()) return;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, VAULT_ITER);
    const v = vaultRead();
    v[vkey(username)] = {
      username: data.username || username,
      salt: b64(salt),
      hash: b64(hash),
      iter: VAULT_ITER,
      token: data.token,
      accountId: data.accountId,
      accountNumber: data.accountNumber,
      account: {
        balance: data.balance,
        loanBalance: data.loanBalance,
        creditScore: data.creditScore,
        customerName: data.customerName,
        accountNumber: data.accountNumber,
      },
      savedAt: Date.now(),
    };
    writeJSON(KEY.vault, v);
    localStorage.setItem(KEY.last, data.username || username);
  } catch {
    /* vault is a convenience; never block a login on it */
  }
}

/** keep the vaulted token + balance fresh for the signed-in person */
function vaultTouch() {
  if (!state.session || state.session.offline) return;
  const v = vaultRead();
  const rec = v[vkey(state.session.username)];
  if (!rec) return;
  rec.token = state.session.token;
  if (state.account) rec.account = { ...state.account };
  writeJSON(KEY.vault, v);
}

async function vaultVerify(username, password) {
  if (!canVault()) return null;
  const rec = vaultRead()[vkey(username)];
  if (!rec) return null;
  try {
    const got = new Uint8Array(await derive(password, unb64(rec.salt), rec.iter));
    const want = unb64(rec.hash);
    if (got.length !== want.length) return null;
    let diff = 0;
    for (let i = 0; i < got.length; i += 1) diff |= got[i] ^ want[i];
    return diff === 0 ? rec : null;
  } catch {
    return null;
  }
}

const vaultHas = (username) => !!vaultRead()[vkey(username)];
const vaultAny = () => Object.keys(vaultRead()).length > 0;

/* ───────────────────────── bank transport ───────────────────────── */

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

async function bankRequestAt(base, path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!state.session) throw new AuthError('Not logged in');
    headers.Authorization = 'Bearer ' + state.session.token;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new BankDown('Bank unreachable');
  } finally {
    clearTimeout(timer);
  }

  // an HTML error page (nginx 403/404/502 …) is the gateway talking, not the bank: the bank is "not there"
  if (isHtml(res) && !res.ok) throw new BankDown('Bank not reachable through the gateway (' + res.status + ')');
  if ([500, 502, 503, 504].includes(res.status)) throw new BankDown('Bank unavailable (' + res.status + ')');

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }

  if (res.status === 401 || res.status === 403) {
    if (auth) {
      setSession(null);
      state.account = null;
      state.mode = 'anon';
      emit();
    }
    throw new AuthError(json?.message || 'Session expired — please log in again');
  }
  if (res.status === 404 && json == null) throw new BankDown('Bank endpoint not found (' + path + ')');
  if (res.status === 429) throw new BankError('Bank is rate-limiting you — wait a few seconds', 429);
  if (!res.ok || (json && json.success === false)) {
    throw new BankError(json?.message || 'Bank rejected the request (' + res.status + ')', res.status);
  }
  return json?.data ?? null;
}

/**
 * Money-moving calls only ever use the active bank (a retry elsewhere after a timeout could charge twice).
 * Reads, login and register walk the fallback list until one bank answers.
 */
async function bankRequest(path, opts = {}) {
  const { method = 'GET', auth = true } = opts;
  const failover = opts.failover ?? (method === 'GET' || !auth);
  const bases = failover ? candidateBases() : [activeBase];
  let down = null;
  for (const base of bases) {
    try {
      const out = await bankRequestAt(base, path, opts);
      if (base !== activeBase) setActiveBase(base);
      state.bankUp = true;
      return out;
    } catch (e) {
      if (e instanceof BankDown) {
        down = e;
        continue;
      }
      state.bankUp = true; // it answered, just not with what we hoped
      throw e;
    }
  }
  state.bankUp = false;
  throw down || new BankDown('Bank unreachable');
}

/** a bank "answers" when anything JSON-ish (even a 400/401) comes back instead of a network error / gateway page */
async function pingBase(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: ctrl.signal,
    });
    return ![500, 502, 503, 504].includes(res.status) && !isHtml(res);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const bankOp = (op, amount) =>
  bankRequest(`/accounts/${state.session.accountId}/${op}`, { method: 'POST', body: { amount } });

const fetchAccount = () => bankRequest(`/accounts/${state.session.accountId}`);

/* ───────────────────────── ledger + queue ───────────────────────── */

const getQueue = () => readJSON(KEY.queue, []);
const saveQueue = (q) => writeJSON(KEY.queue, q);

function logLedger(entry) {
  const l = readJSON(KEY.ledger, []);
  l.unshift({ ts: Date.now(), ...entry });
  writeJSON(KEY.ledger, l.slice(0, 80));
}

function result(ok, extra) {
  return { ok, ...extra };
}
function fail(code, message) {
  if (code === 'LOGIN') City.openLogin();
  return result(false, { code, message, balance: state.account?.balance ?? null });
}

/* ───────────────────────── safe mode ───────────────────────── */

let probeTimer = null;
function scheduleProbe() {
  clearTimeout(probeTimer);
  if (!state.session) return;
  const delay = state.mode === 'safe' ? PROBE_MS_SAFE : PROBE_MS_ONLINE;
  probeTimer = setTimeout(async () => {
    await City.refresh();
    scheduleProbe();
  }, delay);
}

function enterSafe() {
  if (state.mode === 'safe' || state.mode === 'syncing') return;
  state.mode = 'safe';
  emit();
  City.toast('Bank unreachable — Safe Mode on. Spending is locked to one service; earnings are queued.', 'warn');
  scheduleProbe();
}

function safeSpend(service, amount, reason) {
  const lock = localStorage.getItem(KEY.lock);
  if (lock && lock !== service) {
    return fail('SAFE_LOCK', `Safe Mode: you can only spend at "${lock}" until the bank is back.`);
  }
  const bal = state.account?.balance ?? 0;
  if (bal < amount) return fail('FUNDS', 'Not enough money to cover that in Safe Mode.');

  localStorage.setItem(KEY.lock, service);
  state.account = { ...state.account, balance: bal - amount };
  writeJSON(KEY.account, state.account);

  const q = getQueue();
  const evt = { id: uid(), type: 'spend', service, amount, reason, ts: Date.now(), status: 'pending' };
  q.push(evt);
  saveQueue(q);
  logLedger({ id: evt.id, service, type: 'spend', amount, reason, mode: 'safe' });
  emit();
  return result(true, { mode: 'safe', queued: true, balance: state.account.balance, id: evt.id });
}

function safeEarn(service, amount, reason) {
  const q = getQueue();
  const evt = { id: uid(), type: 'earn', service, amount, reason, ts: Date.now(), status: 'pending' };
  q.push(evt);
  saveQueue(q);
  logLedger({ id: evt.id, service, type: 'earn', amount, reason, mode: 'safe' });
  emit();
  City.toast(`${money(amount)} earned — it will be credited when the bank is back.`, 'info');
  return result(true, { mode: 'safe', queued: true, balance: state.account?.balance ?? null, id: evt.id });
}

function acquireSyncLock() {
  const t = Number(localStorage.getItem(KEY.syncLock) || 0);
  if (Date.now() - t < 30_000) return false;
  localStorage.setItem(KEY.syncLock, String(Date.now()));
  return true;
}

async function syncQueue() {
  if (!state.session || state.mode === 'syncing') return;
  const pending = getQueue().filter((e) => e.status === 'pending' || e.status === 'inflight');
  if (pending.length === 0) {
    localStorage.removeItem(KEY.lock);
    return;
  }
  if (!acquireSyncLock()) return;

  const was = state.mode;
  state.mode = 'syncing';
  emit();

  let applied = 0;
  let failed = 0;
  let down = false;

  try {
    let acct = await fetchAccount();
    for (const evt of getQueue()) {
      if (evt.status !== 'pending' && evt.status !== 'inflight') continue;
      const q = getQueue();
      const live = q.find((e) => e.id === evt.id);

      // An "inflight" event may or may not have reached the bank (tab closed / timeout).
      // The bank has no idempotency keys, so reconcile against the balance we recorded before sending.
      if (live.status === 'inflight') {
        acct = await fetchAccount();
        const expected = live.type === 'earn' ? live.pre + live.amount : live.pre - live.amount;
        if (acct.balance === expected) {
          live.status = 'done';
          saveQueue(q);
          applied += 1;
          continue;
        }
      }

      live.pre = acct.balance;
      live.status = 'inflight';
      saveQueue(q);
      try {
        acct = await bankOp(live.type === 'earn' ? 'deposit' : 'withdraw', live.amount);
        const q2 = getQueue();
        q2.find((e) => e.id === live.id).status = 'done';
        saveQueue(q2);
        applied += 1;
      } catch (e) {
        if (e instanceof BankDown) {
          down = true;
          break;
        }
        if (e instanceof AuthError) throw e;
        const q2 = getQueue();
        const target = q2.find((x) => x.id === live.id);
        target.status = 'failed';
        target.err = e.message;
        saveQueue(q2);
        failed += 1;
      }
    }
    setAccount(acct);
  } catch (e) {
    if (e instanceof BankDown) down = true;
    else if (!(e instanceof AuthError)) console.error('[city] sync failed', e);
  } finally {
    localStorage.removeItem(KEY.syncLock);
  }

  // keep failed events visible for the user, drop the rest
  saveQueue(getQueue().filter((e) => e.status === 'pending' || e.status === 'inflight' || e.status === 'failed'));

  if (!state.session) return; // logged out by an AuthError
  if (down) {
    state.mode = 'safe';
  } else {
    state.mode = 'online';
    if (!getQueue().some((e) => e.status === 'pending' || e.status === 'inflight')) localStorage.removeItem(KEY.lock);
    if (applied || failed) {
      City.toast(
        `Bank is back — ${applied} queued transaction${applied === 1 ? '' : 's'} applied` +
          (failed ? `, ${failed} rejected` : '') +
          '.',
        failed ? 'warn' : 'ok',
      );
    }
  }
  if (was === 'safe' || down) scheduleProbe();
  emit();
}

/** an offline sign-in is active: when the bank answers again, upgrade to a real bank session */
async function reauth() {
  if (!(await City.checkBank())) {
    if (state.mode !== 'safe') {
      state.mode = 'safe';
      emit();
    }
    return null;
  }
  const s = state.session;
  if (memAuth && s && vkey(memAuth.username) === vkey(s.username)) {
    try {
      await City.login(memAuth.username, memAuth.password);
      City.toast('Bank is back — signed in again.', 'ok');
      return City.snapshot();
    } catch (e) {
      if (e instanceof BankDown) return null;
      memAuth = null; // password no longer valid at the bank
    }
  }
  if (!state.needsReauth) {
    state.needsReauth = true;
    emit();
  }
  return null;
}

/* ───────────────────────── public API ───────────────────────── */

const City = {
  get BANK_BASE() {
    return activeBase;
  },
  money,

  /** current snapshot, safe to hand to UI code */
  snapshot() {
    const q = getQueue();
    return {
      mode: state.mode,
      loggedIn: !!state.session,
      username: state.session?.username ?? null,
      accountId: state.session?.accountId ?? null,
      accountNumber: state.account?.accountNumber ?? state.session?.accountNumber ?? null,
      balance: state.account?.balance ?? null,
      loanBalance: state.account?.loanBalance ?? 0,
      creditScore: state.account?.creditScore ?? 0,
      pending: q.filter((e) => e.status === 'pending' || e.status === 'inflight').length,
      failed: q.filter((e) => e.status === 'failed').length,
      lock: localStorage.getItem(KEY.lock),
      offline: !!state.session?.offline,
      needsReauth: state.needsReauth,
      bankUp: state.bankUp,
    };
  },

  on(fn) {
    listeners.add(fn);
    fn(City.snapshot());
    return () => listeners.delete(fn);
  },

  ledger: () => readJSON(KEY.ledger, []),
  failedEvents: () => getQueue().filter((e) => e.status === 'failed'),
  get session() {
    return state.session;
  },

  /** resolves once the stored session has been checked against the bank */
  ready: null,

  async login(username, password) {
    const data = await bankRequest('/auth/login', { method: 'POST', body: { username, password }, auth: false });
    memAuth = { username: data.username || username, password };
    vaultSave(username, password, data);
    return City._adopt(data);
  },

  async register(username, password) {
    const data = await bankRequest('/auth/register', { method: 'POST', body: { username, password }, auth: false });
    memAuth = { username: data.username || username, password };
    vaultSave(username, password, data);
    return City._adopt(data);
  },

  /**
   * Bank down + this device has seen this person before: check the password against the local verifier and
   * continue in Safe Mode (spend from the cached balance at one service, earnings queued).
   * Returns null when there is nothing local to check against or the password is wrong.
   */
  async loginOffline(username, password) {
    const rec = await vaultVerify(username, password);
    if (!rec) return null;
    memAuth = { username: rec.username, password };
    setSession({
      token: rec.token,
      username: rec.username,
      accountId: rec.accountId,
      accountNumber: rec.accountNumber,
      savedAt: Date.now(),
      offline: true,
    });
    setAccount({ ...(rec.account || {}), customerName: rec.account?.customerName ?? rec.username });
    state.mode = 'safe';
    state.needsReauth = false;
    emit();
    scheduleProbe();
    return City.snapshot();
  },

  _adopt(data) {
    setSession({
      token: data.token,
      username: data.username,
      accountId: data.accountId,
      accountNumber: data.accountNumber,
      savedAt: Date.now(),
    });
    setAccount(data);
    state.mode = 'online';
    state.needsReauth = false;
    state.bankUp = true;
    emit();
    scheduleProbe();
    syncQueue();
    return City.snapshot();
  },

  logout() {
    setSession(null);
    state.account = null;
    state.mode = 'anon';
    state.needsReauth = false;
    memAuth = null;
    clearTimeout(probeTimer);
    emit();
  },

  /** also forget the offline-login verifier of this device (use on shared computers) */
  forgetDevice() {
    try {
      localStorage.removeItem(KEY.vault);
      localStorage.removeItem(KEY.last);
    } catch {
      /* ignore */
    }
    City.logout();
  },

  /** is any configured bank answering right now? (also picks and remembers the first one that does) */
  async checkBank() {
    for (const base of candidateBases()) {
      if (await pingBase(base)) {
        setActiveBase(base);
        state.bankUp = true;
        emit();
        return true;
      }
    }
    state.bankUp = false;
    emit();
    return false;
  },

  hasLocalLogin: (username) => (username ? vaultHas(username) : vaultAny()),
  lastUser: () => {
    try {
      return localStorage.getItem(KEY.last) || '';
    } catch {
      return '';
    }
  },

  /** re-read the account from the bank; flips Safe Mode on/off automatically */
  async refresh() {
    if (!state.session) return null;
    if (state.session.offline) return reauth();
    try {
      const acct = await fetchAccount();
      setAccount(acct);
      if (state.mode === 'safe' || state.mode === 'anon') state.mode = 'online';
      if (getQueue().some((e) => e.status === 'pending' || e.status === 'inflight')) await syncQueue();
      else if (state.mode === 'online') localStorage.removeItem(KEY.lock);
      emit();
      return City.snapshot();
    } catch (e) {
      if (e instanceof BankDown) enterSafe();
      return null;
    }
  },

  /** take money out of the citizen's bank account */
  async spend(service, amount, reason = '') {
    const amt = toAmount(amount);
    if (!amt) return fail('AMOUNT', 'Amount must be a positive whole number.');
    if (!state.session) return fail('LOGIN', 'Log in to the city bank first.');
    if (state.mode === 'safe' || state.mode === 'syncing') return safeSpend(service, amt, reason);
    try {
      const acct = await bankOp('withdraw', amt);
      setAccount(acct);
      const id = uid();
      logLedger({ id, service, type: 'spend', amount: amt, reason, mode: 'bank' });
      emit();
      return result(true, { mode: 'bank', balance: state.account.balance, id });
    } catch (e) {
      if (e instanceof BankDown) {
        enterSafe();
        return safeSpend(service, amt, reason);
      }
      if (e instanceof AuthError) return fail('LOGIN', e.message);
      return fail('REJECTED', e.message);
    }
  },

  /** put money into the citizen's bank account */
  async earn(service, amount, reason = '') {
    const amt = toAmount(amount);
    if (!amt) return fail('AMOUNT', 'Amount must be a positive whole number.');
    if (!state.session) return fail('LOGIN', 'Log in to the city bank first.');
    if (state.mode === 'safe' || state.mode === 'syncing') return safeEarn(service, amt, reason);
    try {
      const acct = await bankOp('deposit', amt);
      setAccount(acct);
      const id = uid();
      logLedger({ id, service, type: 'earn', amount: amt, reason, mode: 'bank' });
      emit();
      return result(true, { mode: 'bank', balance: state.account.balance, id });
    } catch (e) {
      if (e instanceof BankDown) {
        enterSafe();
        return safeEarn(service, amt, reason);
      }
      if (e instanceof AuthError) return fail('LOGIN', e.message);
      return fail('REJECTED', e.message);
    }
  },

  /** headers that identify the citizen to a district backend (the backend verifies them with the bank) */
  identityHeaders() {
    if (!state.session) return {};
    return {
      Authorization: 'Bearer ' + state.session.token,
      'X-City-Account': String(state.session.accountId),
      'X-City-User': state.session.username,
    };
  },

  /** fetch() for a district backend, with identity headers and JSON helpers */
  async api(url, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const init = { method, headers: { ...City.identityHeaders(), ...headers } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, init);
    if (raw) return res;
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    if (!res.ok) {
      const err = new Error(data?.error || data?.detail || data?.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  /* ───────────── UI ───────────── */

  toast(message, kind = 'info') {
    if (typeof document === 'undefined') return;
    let host = document.getElementById('city-toasts');
    if (!host) {
      host = el('div', { id: 'city-toasts', 'aria-live': 'polite' });
      document.body.appendChild(host);
    }
    const t = el('div', { class: 'city-toast ' + kind }, message);
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  },

  openLogin(opts = {}) {
    if (typeof document === 'undefined' || document.getElementById('city-login')) return;
    const mount = () => buildLogin(opts);
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  },

  /**
   * The gate: nothing on the page is usable until somebody is signed in. Re-opens by itself on logout / expiry.
   * Safe to call more than once.
   */
  requireLogin() {
    if (typeof document === 'undefined' || City._gate) return;
    City._gate = true;
    City.ready.then(() => {
      const check = () => {
        if (!state.session) City.openLogin({ required: true });
      };
      check();
      City.on(() => {
        if (state.ready) check();
      });
    });
  },

  /** requireLogin defaults to true: every district asks for credentials first. Pass false for a public page. */
  mountHud({ service, title, accent, home = '/', requireLogin = true } = {}) {
    state.service = service;
    if (typeof document === 'undefined') return;
    const district = DISTRICTS[service] || {};
    document.documentElement.style.setProperty('--accent', accent || district.accent || '#0f6e9c');
    document.documentElement.style.colorScheme = 'light';
    document.body.classList.add('city-body');
    if (!document.getElementById('city-hud')) buildHud({ service, title, code: district.code, home });
    if (requireLogin) City.requireLogin();
  },
};

/* ───────────────────────── DOM builders ───────────────────────── */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function buildHud({ service, title, code, home }) {
  const balance = el('span', { class: 'hud-balance', id: 'city-balance' }, '₹–');
  const chip = el('span', { class: 'hud-chip', id: 'city-chip' }, 'LOGGED OUT');
  const userBtn = el('button', { class: 'hud-user', type: 'button', 'aria-label': 'Account menu' }, '?');
  const menu = el(
    'div',
    { class: 'hud-menu', hidden: true },
    el('a', { href: '/bank/' }, 'Open bank'),
    el('button', { type: 'button', onclick: () => City.logout() }, 'Log out'),
    el(
      'button',
      {
        type: 'button',
        title: 'Log out and delete the offline-login data stored on this device',
        onclick: () => City.forgetDevice(),
      },
      'Forget this device',
    ),
  );
  const banner = el('div', { class: 'hud-banner', id: 'city-banner', hidden: true });

  userBtn.addEventListener('click', () => {
    if (!state.session) return City.openLogin();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== userBtn) menu.hidden = true;
  });

  const bar = el(
    'header',
    { id: 'city-hud', class: 'city-hud' },
    el(
      'div',
      { class: 'hud-left' },
      el('a', { class: 'hud-back', href: home }, '← City'),
      code && el('span', { class: 'hud-code' }, code),
      el('span', { class: 'hud-dot' }),
      el('span', { class: 'hud-title' }, title || service || 'District'),
    ),
    el(
      'div',
      { class: 'hud-right' },
      chip,
      el('span', { class: 'hud-balance-wrap' }, el('small', {}, 'BALANCE'), balance),
      el('div', { class: 'hud-user-wrap' }, userBtn, menu),
    ),
  );
  document.body.prepend(banner);
  document.body.prepend(bar);

  let shown = null;
  City.on((s) => {
    if (s.balance != null && shown !== s.balance) {
      countTo(balance, shown ?? s.balance, s.balance);
      shown = s.balance;
    } else if (s.balance == null) {
      balance.textContent = '₹–';
      shown = null;
    }
    const labels = {
      anon: ['LOGGED OUT', 'off'],
      online: ['BANK ONLINE', 'ok'],
      safe: ['SAFE MODE', 'warn'],
      syncing: ['SYNCING…', 'info'],
    };
    const [text, cls] = labels[s.mode] || labels.anon;
    chip.textContent = text;
    chip.className = 'hud-chip ' + cls;
    balance.className = 'hud-balance' + (s.mode === 'online' && s.balance != null ? ' live' : '');
    userBtn.textContent = s.username ? s.username[0].toUpperCase() : '?';
    userBtn.title = s.username || 'Log in';

    if (s.needsReauth) {
      banner.hidden = false;
      banner.replaceChildren(
        'The bank is back. Sign in once more to sync your offline activity. ',
        el('button', { type: 'button', class: 'hud-banner-btn', onclick: () => City.openLogin({ reauth: true }) }, 'Sign in'),
      );
    } else if (s.mode === 'safe') {
      banner.hidden = false;
      banner.textContent =
        `${s.offline ? 'Offline sign-in' : 'Bank offline'} — Safe Mode. Spending is locked to ${s.lock ? '“' + s.lock + '”' : 'the first service you spend at'}; ` +
        `${s.pending} transaction${s.pending === 1 ? '' : 's'} waiting for the bank.`;
    } else if (s.failed > 0) {
      banner.hidden = false;
      banner.textContent = `${s.failed} queued transaction${s.failed === 1 ? ' was' : 's were'} rejected by the bank after Safe Mode.`;
    } else {
      banner.hidden = true;
    }
  });
}

function countTo(node, from, to) {
  if (from === to) {
    node.textContent = money(to);
    return;
  }
  const t0 = performance.now();
  const dur = 600;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = money(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** while the gate is up, nothing behind it can be focused or clicked */
function lockPage(on) {
  document.documentElement.classList.toggle('city-locked', on);
  for (const n of Array.from(document.body.children)) {
    if (n.id === 'city-login' || n.id === 'city-toasts') continue;
    if (on) {
      if (!n.hasAttribute('inert')) {
        n.setAttribute('inert', '');
        n.dataset.cityLocked = '1';
      }
    } else if (n.dataset.cityLocked) {
      n.removeAttribute('inert');
      delete n.dataset.cityLocked;
    }
  }
}

function buildLogin({ required = false, reauth = false } = {}) {
  let mode = 'login';
  let checking = false;

  const err = el('div', { class: 'login-err', role: 'alert' });
  const user = el('input', {
    type: 'text',
    autocomplete: 'username',
    required: true,
    maxlength: '40',
    placeholder: 'username',
    autocapitalize: 'none',
    spellcheck: 'false',
    value: (reauth && state.session?.username) || City.lastUser(),
  });
  const pass = el('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'password' });
  const eye = el('button', { type: 'button', class: 'login-eye', 'aria-label': 'Show password', title: 'Show / hide password' }, '👁');
  eye.onclick = () => {
    pass.type = pass.type === 'password' ? 'text' : 'password';
  };
  const submit = el('button', { type: 'submit', class: 'btn primary' }, 'Enter the city');
  const tabLogin = el('button', { type: 'button', class: 'tab on' }, 'Log in');
  const tabReg = el('button', { type: 'button', class: 'tab' }, 'Create account');

  const dot = el('i', { class: 'dot' });
  const statusText = el('span', {}, 'Contacting the city bank…');
  const retry = el('button', { type: 'button', class: 'login-retry' }, 'Retry');
  const status = el('div', { class: 'login-status checking', role: 'status' }, dot, statusText, retry);

  const paintStatus = (up) => {
    const known = City.hasLocalLogin(user.value.trim() || undefined);
    status.className = 'login-status ' + (up == null ? 'checking' : up ? 'up' : 'down');
    retry.hidden = up !== false;
    if (up == null) statusText.textContent = 'Contacting the city bank…';
    else if (up) statusText.textContent = 'Bank online';
    else if (known) statusText.textContent = 'Bank unreachable — you can still sign in with the login saved on this device (Safe Mode).';
    else if (City.hasLocalLogin()) statusText.textContent = 'Bank unreachable — only accounts used on this device before can sign in right now.';
    else statusText.textContent = 'Bank unreachable — the city is closed until it is back. Nothing is saved on this device to sign in with yet.';
    tabReg.disabled = up === false;
    if (up === false && mode === 'register') setMode('login');
  };

  async function probe() {
    if (checking) return;
    checking = true;
    paintStatus(null);
    paintStatus(await City.checkBank());
    checking = false;
  }
  retry.onclick = probe;
  user.addEventListener('input', () => {
    if (state.bankUp === false) paintStatus(false);
  });

  const setMode = (m) => {
    mode = m;
    tabLogin.classList.toggle('on', m === 'login');
    tabReg.classList.toggle('on', m === 'register');
    pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    submit.textContent = m === 'login' ? (reauth ? 'Sign in & sync' : 'Enter the city') : 'Open my account';
    err.textContent = '';
  };
  tabLogin.onclick = () => setMode('login');
  tabReg.onclick = () => setMode('register');

  const form = el(
    'form',
    { class: 'login-card', onsubmit: onSubmit },
    el('div', { class: 'login-logo' }, '◈'),
    el('h2', {}, 'City Bank'),
    el(
      'p',
      {},
      reauth
        ? 'The bank is back. Sign in to apply what you did while it was offline.'
        : 'Sign in to enter the city. One account for every district — your balance follows you everywhere.',
    ),
    status,
    el('div', { class: 'tabs' }, tabLogin, tabReg),
    el('label', {}, 'Username', user),
    el('label', {}, 'Password', el('span', { class: 'login-pass' }, pass, eye)),
    err,
    submit,
    required ? null : el('button', { type: 'button', class: 'btn ghost', onclick: close }, reauth ? 'Later' : 'Not now'),
    el('small', { class: 'login-foot' }, 'Your password is sent only to the bank. This device keeps a salted hash of it so you can still sign in if the bank is down.'),
  );
  const overlay = el('div', { id: 'city-login', class: 'city-login' + (required ? ' required' : '') }, form);
  document.body.appendChild(overlay);
  if (required) lockPage(true);
  (user.value ? pass : user).focus();
  paintStatus(state.bankUp);
  probe();

  function close() {
    overlay.remove();
    if (required) lockPage(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    err.textContent = '';
    const name = user.value.trim();
    submit.disabled = true;
    try {
      if (mode === 'register') {
        if (pass.value.length < 6) throw new BankError('Password needs at least 6 characters');
        await City.register(name, pass.value);
      } else {
        try {
          await City.login(name, pass.value);
        } catch (ex) {
          if (!(ex instanceof BankDown)) throw ex;
          // the bank is not there: fall back to the login saved on this device, or refuse
          const local = await City.loginOffline(name, pass.value);
          if (!local) {
            paintStatus(false);
            throw new BankError(
              City.hasLocalLogin(name)
                ? 'The bank is unreachable and that password does not match the login saved on this device.'
                : 'The bank is unreachable, and this device has no saved login for “' + name + '”. Connect to the bank once first.',
            );
          }
          close();
          City.toast('Bank unreachable — signed in offline. Safe Mode is on.', 'warn');
          return;
        }
      }
      close();
      City.toast('Welcome, ' + state.session.username + '.', 'ok');
    } catch (ex) {
      err.textContent = ex instanceof BankDown ? 'The bank is unreachable right now — try again in a moment.' : ex.message;
    } finally {
      submit.disabled = false;
    }
  }
}

/* ───────────────────────── boot ───────────────────────── */

state.session = typeof localStorage !== 'undefined' ? loadSession() : null;
state.account = state.session ? readJSON(KEY.account, null) : null;
state.mode = state.session ? (state.session.offline ? 'safe' : 'online') : 'anon';

City.ready = (async () => {
  if (state.session) await City.refresh();
  state.ready = true;
  scheduleProbe();
  emit();
})();

if (typeof window !== 'undefined') {
  // other tabs/districts: keep every open page in step
  window.addEventListener('storage', (e) => {
    if (e.key === KEY.session) {
      state.session = loadSession();
      if (!state.session) {
        state.account = null;
        state.mode = 'anon';
      } else if (state.mode === 'anon') state.mode = 'online';
      emit();
    }
    if (e.key === KEY.account) {
      state.account = readJSON(KEY.account, state.account);
      emit();
    }
  });
  window.addEventListener('online', () => City.refresh());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) City.refresh();
  });
  window.City = City;
}
void bus; // reserved: BroadcastChannel hook for cross-tab events

export { City, BankDown, BankError, AuthError };
export default City;
