// Per-app functional load test: register/login where needed, then reads (+ optional capped writes).
// Usage: APP=notes|bank|social|whisper|hospital|video  [WRITES=1 WRITE_CAP=20]  PEAK_VUS=3
import http from 'k6/http';
import { check, sleep, fail } from 'k6';

const BASE = __ENV.BASE_URL || 'https://saisakthi.qzz.io';
const APP = __ENV.APP || 'notes';
const PEAK = parseInt(__ENV.PEAK_VUS || '3');
const WRITES = __ENV.WRITES === '1';
const WRITE_CAP = parseInt(__ENV.WRITE_CAP || '20');
const RUN = Date.now().toString(36);

export const options = {
  scenarios: Object.assign(
    {
      reads: {
        executor: 'ramping-vus',
        exec: 'reads',
        startVUs: 1,
        stages: [
          { duration: '20s', target: PEAK },
          { duration: '1m', target: PEAK },
          { duration: '10s', target: 0 },
        ],
      },
    },
    WRITES
      ? {
          writes: {
            executor: 'shared-iterations', // exactly WRITE_CAP writes in total
            exec: 'writes',
            vus: 2,
            iterations: WRITE_CAP,
            maxDuration: '2m',
            startTime: '25s',
          },
        }
      : {}
  ),
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

// ---------- helpers ----------
let warned = 0;
function warn(label, res) {
  if (warned++ < 3) console.warn(`${label} -> ${res.status} ${String(res.body).slice(0, 160)}`);
}
function uname(tag) { return `lt_${tag}_${RUN}${Math.floor(Math.random() * 1e4)}`; }
function pass() { return `Lt!${Math.random().toString(36).slice(2, 10)}Aa1`; }
function bearer(t) { return t ? { Authorization: `Bearer ${t}` } : {}; }
function jget(res, sel) { try { return res.json(sel); } catch (e) { return undefined; } }

function req(method, path, opts) {
  const o = opts || {};
  const label = o.name || `${method} ${path}`;
  const ok = o.ok || [200, 201, 204];
  const params = { headers: Object.assign({}, o.headers || {}), tags: { name: label } };
  let payload = null;
  if (o.body !== undefined) {
    params.headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(o.body);
  }
  const res = http.request(method, BASE + path, payload, params);
  const passed = check(res, { [label]: (r) => ok.includes(r.status) });
  if (!passed) warn(label, res);
  return res;
}

// ---------- notes (Django REST + JWT) ----------
function notesSetup() {
  const u = uname('notes'), p = pass();
  const r = req('POST', '/notes/api/user/register/', { body: { username: u, password: p }, name: 'notes register', ok: [201] });
  const t = req('POST', '/notes/api/token/', { body: { username: u, password: p }, name: 'notes token', ok: [200] });
  const access = jget(t, 'access');
  if (!access) fail(`notes: no token (register ${r.status}, token ${t.status}) ${String(t.body).slice(0, 200)}`);
  console.log(`notes test user: ${u}`);
  return { token: access, user: u };
}
function notesRead(ctx) {
  req('GET', '/notes/api/notes/', { headers: bearer(ctx.token), name: 'notes list', ok: [200] });
}
function notesWrite(ctx) {
  const body = __ENV.NOTE_JSON ? JSON.parse(__ENV.NOTE_JSON) : { title: 'lt note', content: 'load test', importance: 1 };
  const c = req('POST', '/notes/api/notes/', { body: body, headers: bearer(ctx.token), name: 'notes create', ok: [201] });
  const id = jget(c, 'id');
  if (id) req('DELETE', `/notes/api/notes/${id}/`, { headers: bearer(ctx.token), name: 'notes delete {id}', ok: [204] });
}

// ---------- bank (Spring, currently permitAll) ----------
function bankSetup() {
  const u = uname('bank'), p = pass();
  const r = req('POST', '/bank/api/auth/register', { body: { username: u, password: p }, name: 'bank register', ok: [200] });
  const l = req('POST', '/bank/api/auth/login', { body: { username: u, password: p }, name: 'bank login', ok: [200] });
  const token = jget(l, 'data.token');
  const id = jget(l, 'data.accountId');
  if (!token) fail(`bank: no token (register ${r.status}, login ${l.status}) ${String(l.body).slice(0, 200)}`);
  console.log(`bank test user: ${u} accountId=${id}`);
  return { token: token, id: id, user: u };
}
function bankRead(ctx) {
  const h = bearer(ctx.token);
  req('GET', '/bank/api/accounts', { headers: h, name: 'bank list accounts', ok: [200] });
  if (ctx.id) req('GET', `/bank/api/accounts/${ctx.id}`, { headers: h, name: 'bank get account {id}', ok: [200] });
}
function bankWrite(ctx) {
  if (!ctx.id) return;
  const h = bearer(ctx.token);
  req('POST', `/bank/api/accounts/${ctx.id}/deposit`, { body: { amount: 1 }, headers: h, name: 'bank deposit {id}', ok: [200] });
  req('POST', `/bank/api/accounts/${ctx.id}/withdraw`, { body: { amount: 1 }, headers: h, name: 'bank withdraw {id}', ok: [200] });
}

// ---------- social (Django + JWT) : reads only ----------
function socialSetup() {
  const u = uname('soc'), p = pass();
  const r = req('POST', '/social/api/auth/register/', {
    body: { username: u, email: `${u}@example.com`, profile_name: u, password: p, password2: p },
    name: 'social register', ok: [201],
  });
  const access = jget(r, 'access');
  if (!access) fail(`social: register ${r.status} ${String(r.body).slice(0, 200)}`);
  console.log(`social test user: ${u}`);
  return { token: access, user: u };
}
function socialRead(ctx) {
  const h = bearer(ctx.token);
  req('GET', '/social/api/posts/', { headers: h, name: 'social feed', ok: [200] });
  req('GET', '/social/api/posts/explore/', { headers: h, name: 'social explore', ok: [200] });
  req('GET', '/social/api/auth/me/', { headers: h, name: 'social me', ok: [200] });
  req('GET', '/social/api/users/suggested/', { headers: h, name: 'social suggested', ok: [200] });
}

// ---------- whisper (Rust/axum) ----------
function whisperSetup() {
  const u = uname('wh'), p = pass();
  const r = req('POST', '/whisper/api/users', { body: { username: u, password: p }, name: 'whisper register', ok: [200, 201] });
  const l = req('POST', '/whisper/api/login', { body: { username: u, password: p }, name: 'whisper login', ok: [200] });
  const token = jget(l, 'token');
  const id = jget(l, 'id');
  if (!token || !id) fail(`whisper: register ${r.status}, login ${l.status} ${String(l.body).slice(0, 200)}`);
  console.log(`whisper test user: ${u}`);
  return { token: token, id: id, user: u };
}
function whisperRead(ctx) {
  const h = bearer(ctx.token);
  req('GET', '/whisper/api/rooms/discover', { headers: h, name: 'whisper discover', ok: [200] });
  req('GET', `/whisper/api/users/${ctx.id}`, { headers: h, name: 'whisper get user {id}', ok: [200] });
}
function whisperWrite(ctx) {
  req('POST', '/whisper/api/room', {
    body: { name: `lt_room_${RUN}`, creator_id: ctx.id }, headers: bearer(ctx.token),
    name: 'whisper create room', ok: [200, 201],
  });
}

// ---------- hospital (Django pages, no auth) : reads only ----------
function hospitalRead() {
  const pages = ['/hospital/', '/hospital/patients/', '/hospital/doctors/', '/hospital/appointments/'];
  for (const p of pages) req('GET', p, { name: `hospital ${p}`, ok: [200] });
}

// ---------- video (Spring, anonymous) ----------
function videoRead() {
  req('GET', '/video/api/getFiles', { name: 'video getFiles', ok: [200] });
}
function videoWrite() {
  const res = http.post(`${BASE}/video/api/upload`,
    { file: http.file('x'.repeat(10240), `lt_${RUN}.txt`, 'text/plain') },
    { tags: { name: 'video upload' } });
  const good = check(res, { 'video upload': (r) => r.status >= 200 && r.status < 300 });
  if (!good) { warn('video upload', res); return; }
  let path = jget(res, 'path') || jget(res, 'fileName') || jget(res, 'filename');
  if (!path) path = String(res.body).trim();
  req('DELETE', `/video/api/remove/${encodeURI(path)}`, { name: 'video remove {path}', ok: [200, 204] });
}

// ---------- wiring ----------
const apps = {
  notes: { setup: notesSetup, read: notesRead, write: notesWrite },
  bank: { setup: bankSetup, read: bankRead, write: bankWrite },
  social: { setup: socialSetup, read: socialRead },
  whisper: { setup: whisperSetup, read: whisperRead, write: whisperWrite },
  hospital: { read: hospitalRead },
  video: { read: videoRead, write: videoWrite },
};

export function setup() {
  const app = apps[APP];
  if (!app) fail(`unknown APP=${APP}; choose one of: ${Object.keys(apps).join(', ')}`);
  return app.setup ? app.setup() : {};
}
export function reads(ctx) {
  apps[APP].read(ctx);
  sleep(Math.random() + 0.5);
}
export function writes(ctx) {
  if (apps[APP].write) apps[APP].write(ctx);
  sleep(1);
}