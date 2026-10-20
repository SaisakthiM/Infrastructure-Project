/**
 * city-core.js — shared city economy for every Mini City district.
 *
 *  - One bank session for the whole origin (localStorage "city.session")
 *  - City.spend / City.earn talk to the real Bank Manager API (JWT, ₹ integers)
 *  - Safe Mode: if the bank is unreachable, the city keeps running:
 *      * you can still spend money you already hold, but only at ONE service
 *      * earnings go to an offline queue and are applied when the bank returns
 *  - A HUD (balance, bank status, login) any page can mount with one call
 *
 * No dependencies, no build step. Plain ES module:
 *      import City from '/city-core/city-core.js';
 *      City.mountHud({ service: 'grocery', title: 'Grocery Store', accent: '#72b66f' });
 */

const BANK_BASE = (typeof window !== 'undefined' && window.CITY_BANK_BASE) || '/bank/api';

const KEY = {
  session: 'city.session',
  account: 'city.account',
  queue: 'city.queue.v1',
  ledger: 'city.ledger.v1',
  lock: 'city.safe.lock',
  syncLock: 'city.sync.lock',
};

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
};

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
  if (!s || !s.token) return null;
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
  state.account = {
    balance: Number(a.balance ?? 0),
    loanBalance: Number(a.loanBalance ?? 0),
    creditScore: Number(a.creditScore ?? 0),
    customerName: a.customerName ?? state.session?.username ?? '',
    accountNumber: a.accountNumber ?? state.session?.accountNumber ?? '',
  };
  writeJSON(KEY.account, state.account);
}

/* ───────────────────────── bank transport ───────────────────────── */

async function bankRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!state.session) throw new AuthError('Not logged in');
    headers.Authorization = 'Bearer ' + state.session.token;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BANK_BASE + path, {
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
  if (res.status === 429) throw new BankError('Bank is rate-limiting you — wait a few seconds', 429);
  if (!res.ok || (json && json.success === false)) {
    throw new BankError(json?.message || 'Bank rejected the request (' + res.status + ')', res.status);
  }
  return json?.data ?? null;
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

/* ───────────────────────── public API ───────────────────────── */

const City = {
  BANK_BASE,
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
    return City._adopt(data);
  },

  async register(username, password) {
    const data = await bankRequest('/auth/register', { method: 'POST', body: { username, password }, auth: false });
    return City._adopt(data);
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
    emit();
    scheduleProbe();
    syncQueue();
    return City.snapshot();
  },

  logout() {
    setSession(null);
    state.account = null;
    state.mode = 'anon';
    clearTimeout(probeTimer);
    emit();
  },

  /** re-read the account from the bank; flips Safe Mode on/off automatically */
  async refresh() {
    if (!state.session) return null;
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
    buildLogin(opts);
  },

  mountHud({ service, title, accent = '#00f0c8', home = '/', requireLogin = false } = {}) {
    state.service = service;
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--accent', accent);
    document.body.classList.add('city-body');
    if (!document.getElementById('city-hud')) buildHud({ service, title, home });
    if (requireLogin) {
      City.ready.then(() => {
        if (!state.session) City.openLogin({ required: true });
      });
    }
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

function buildHud({ service, title, home }) {
  const balance = el('span', { class: 'hud-balance', id: 'city-balance' }, '₹–');
  const chip = el('span', { class: 'hud-chip', id: 'city-chip' }, 'LOGGED OUT');
  const userBtn = el('button', { class: 'hud-user', type: 'button', 'aria-label': 'Account menu' }, '?');
  const menu = el(
    'div',
    { class: 'hud-menu', hidden: true },
    el('a', { href: '/bank/' }, 'Open bank'),
    el('button', { type: 'button', onclick: () => City.logout() }, 'Log out'),
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
    userBtn.textContent = s.username ? s.username[0].toUpperCase() : '?';
    userBtn.title = s.username || 'Log in';

    if (s.mode === 'safe') {
      banner.hidden = false;
      banner.textContent =
        `Bank offline — Safe Mode. Spending is locked to ${s.lock ? '“' + s.lock + '”' : 'the first service you spend at'}; ` +
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

function buildLogin({ required = false } = {}) {
  let mode = 'login';
  const err = el('div', { class: 'login-err', role: 'alert' });
  const user = el('input', { type: 'text', autocomplete: 'username', required: true, maxlength: '40', placeholder: 'username' });
  const pass = el('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'password' });
  const submit = el('button', { type: 'submit', class: 'btn primary' }, 'Enter the city');
  const tabLogin = el('button', { type: 'button', class: 'tab on' }, 'Log in');
  const tabReg = el('button', { type: 'button', class: 'tab' }, 'Create account');

  const setMode = (m) => {
    mode = m;
    tabLogin.classList.toggle('on', m === 'login');
    tabReg.classList.toggle('on', m === 'register');
    pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    submit.textContent = m === 'login' ? 'Enter the city' : 'Open my account';
    err.textContent = '';
  };
  tabLogin.onclick = () => setMode('login');
  tabReg.onclick = () => setMode('register');

  const form = el(
    'form',
    { class: 'login-card', onsubmit: onSubmit },
    el('div', { class: 'login-logo' }, '◈'),
    el('h2', {}, 'City Bank'),
    el('p', {}, 'One account for every district. Your balance follows you everywhere.'),
    el('div', { class: 'tabs' }, tabLogin, tabReg),
    el('label', {}, 'Username', user),
    el('label', {}, 'Password', pass),
    err,
    submit,
    required ? null : el('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Not now'),
  );
  const overlay = el('div', { id: 'city-login', class: 'city-login' }, form);
  document.body.appendChild(overlay);
  user.focus();

  function close() {
    overlay.remove();
  }
  async function onSubmit(e) {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    try {
      if (mode === 'register') {
        if (pass.value.length < 6) throw new BankError('Password needs at least 6 characters');
        await City.register(user.value.trim(), pass.value);
      } else {
        await City.login(user.value.trim(), pass.value);
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
state.mode = state.session ? 'online' : 'anon';

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
