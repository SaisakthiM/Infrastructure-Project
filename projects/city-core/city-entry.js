/**
 * city-entry.js — "entering the city asks for the bank login first, and everything after uses that token".
 *
 * Load it from the portfolio / city home (see intro/v3/index.html). It
 *   1. gates the 3D city (/city, also when you arrive there by in-app navigation) behind the bank sign-in,
 *   2. exposes the signed-in citizen as window.CityAuth (token, username, accountId) + a `city:auth` event,
 *   3. shows a small "signed in as …" chip with Log out.
 *
 * The token itself is City's one shared session (localStorage "city.session"), so every district on the same origin
 * (grocery, housing, hospital, media, api-service, bank UI…) is already signed in when you walk into it.
 * No token is copied anywhere else.
 */
import City from './city-core.js';

const isCityPath = (p = location.pathname) => /^\/city(\/|$)/.test(p);

function css() {
  if (document.getElementById('city-gate-css')) return;
  const l = document.createElement('link');
  l.id = 'city-gate-css';
  l.rel = 'stylesheet';
  l.href = new URL('./city-gate.css', import.meta.url).href;
  document.head.appendChild(l);
}

const auth = {
  get token() { return City.session?.token ?? null; },
  get username() { return City.session?.username ?? null; },
  get accountId() { return City.session?.accountId ?? null; },
  get loggedIn() { return !!City.session; },
  headers: () => City.identityHeaders(),
  logout: () => City.logout(),
};
window.CityAuth = auth;

let chip = null;
function paintChip(snap) {
  if (!snap.loggedIn || !isCityPath()) { chip?.remove(); chip = null; return; }
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'city-entry-chip';
    chip.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;gap:12px;align-items:center;' +
      'padding:7px 12px;border:1px solid #121212;background:rgba(251,250,247,.95);' +
      'backdrop-filter:blur(10px);box-shadow:0 8px 24px -14px rgba(18,18,18,.3);color:#121212;' +
      "font:500 11px/1.4 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.06em";
    document.body.appendChild(chip);
  }
  chip.replaceChildren();
  const who = document.createElement('span');
  who.textContent = '◈ ' + snap.username + (snap.offline ? ' · safe mode' : snap.balance != null ? ' · ' + City.money(snap.balance) : '');
  const out = document.createElement('button');
  out.textContent = 'Log out';
  out.style.cssText = 'all:unset;cursor:pointer;color:rgba(18,18,18,.56);text-decoration:underline;text-underline-offset:2px';
  out.onclick = () => City.logout();
  chip.append(who, out);
}

let announced = null;
City.on((snap) => {
  const key = snap.loggedIn ? snap.username + ':' + snap.accountId : '';
  if (key !== announced) {
    announced = key;
    window.dispatchEvent(new CustomEvent('city:auth', { detail: { loggedIn: snap.loggedIn, username: snap.username, accountId: snap.accountId } }));
  }
  if (document.body) paintChip(snap);
});

function gateIfCity() {
  if (!isCityPath()) return;
  css();
  City.requireLogin(); // non-dismissible; re-opens on logout / token expiry
}

// the city home is a single-page app: catch client-side navigation into /city as well
for (const fn of ['pushState', 'replaceState']) {
  const orig = history[fn];
  history[fn] = function (...a) {
    const r = orig.apply(this, a);
    queueMicrotask(() => { gateIfCity(); paintChip(City.snapshot()); });
    return r;
  };
}
window.addEventListener('popstate', () => { gateIfCity(); paintChip(City.snapshot()); });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gateIfCity, { once: true });
else gateIfCity();

export { City, auth };
export default City;
