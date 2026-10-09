import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE_URL || 'https://saisakthi.qzz.io';
const MODE = __ENV.MODE || 'public';
const PEAK = parseInt(__ENV.PEAK_VUS || '20');

// public GET endpoints discovered by enum.py
const publicPaths = new SharedArray('public', () => {
  try {
    return JSON.parse(open(__ENV.ENDPOINTS_FILE || '/work/out/endpoints.json'))
      .filter((e) => e.class === 'public' && e.method === 'GET'
        && !/\.(env|git)/.test(e.path) && !/^\/(jenkins|argocd|grafana|n8n)\b/.test(e.path))
      .map((e) => e.path);
  } catch (err) {
    return ['/'];
  }
});

export const options = {
  scenarios: {
    [MODE]: {
      executor: 'ramping-vus',
      exec: MODE === 'auth' ? 'authTest' : 'publicTest',
      startVUs: 1,
      stages: [
        { duration: '30s', target: PEAK },
        { duration: '1m', target: PEAK },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

export function setup() {
  if (MODE !== 'auth') return {};
  const user = `lt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const pass = `Lt!${Math.random().toString(36).slice(2)}Aa1`;
  const hdr = { headers: { 'Content-Type': 'application/json' } };
  const extra = JSON.parse(__ENV.EXTRA_REGISTER_JSON || '{}');

  const reg = http.post(BASE + __ENV.REGISTER_URL,
    JSON.stringify({ [__ENV.USER_FIELD]: user, [__ENV.PASS_FIELD]: pass, ...extra }), hdr);
  console.log(`register -> ${reg.status} ${reg.body.slice(0, 200)}`);

  const login = http.post(BASE + __ENV.LOGIN_URL,
    JSON.stringify({ [__ENV.USER_FIELD]: user, [__ENV.PASS_FIELD]: pass }), hdr);
  console.log(`login -> ${login.status}`);
  const token = login.json(__ENV.TOKEN_FIELD || 'access');
  if (!token) throw new Error(`no token in login response: ${login.body.slice(0, 200)}`);
  console.log(`test user: ${user} (delete it afterwards)`);
  return { token };
}

export function publicTest() {
  const path = publicPaths[Math.floor(Math.random() * publicPaths.length)];
  const res = http.get(BASE + path, { tags: { name: path } });
  check(res, { 'status < 400': (r) => r.status < 400 });
  sleep(Math.random() * 1.5 + 0.5);
}

export function authTest(data) {
  const paths = (__ENV.AUTHED_PATHS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const headers = { Authorization: `${__ENV.AUTH_SCHEME || 'Bearer'} ${data.token}` };
  for (const p of paths) {
    const res = http.get(BASE + p, { headers, tags: { name: p } });
    check(res, { [`${p} ok`]: (r) => r.status === 200 });
    sleep(Math.random() + 0.5);
  }
}
