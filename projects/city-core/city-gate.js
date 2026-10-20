/**
 * city-gate.js — makes a page ask for the city bank login FIRST.
 *
 * For pages that are not a district (the city home / portfolio): add one line to index.html
 *
 *     <script type="module" src="/city-core/city-gate.js"></script>
 *
 * Nothing on the page can be clicked until somebody is signed in. The login is the bank's own (City.login);
 * the session lives in localStorage and is shared by every district on the same origin.
 *   - bank reachable      -> normal sign-in / create account
 *   - bank down, known    -> sign-in against the verifier stored on this device (Safe Mode)
 *   - bank down, unknown  -> refused, with a Retry button
 *
 * Optional, before the script:  window.CITY_BANK_BASES = ['/bank/api', 'https://bank.example.com/api'];
 */
import City from './city-core.js';

if (typeof document !== 'undefined' && !document.getElementById('city-gate-css')) {
  const link = document.createElement('link');
  link.id = 'city-gate-css';
  link.rel = 'stylesheet';
  link.href = new URL('./city-gate.css', import.meta.url).href;
  document.head.appendChild(link);
}

City.requireLogin();

export { City };
export default City;
