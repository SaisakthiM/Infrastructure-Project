/**
 * city-app.js — one call turns an app into a Mini City district:
 *   shared city.css look (loaded here if the page did not), HUD with the citizen + balance, the login gate
 *   (the bank session is shared by the whole origin), and the district's themed 3D scene behind the UI.
 *
 *   const { City, stage } = await startCityApp({ service: 'quiz', title: 'Quiz Arena', accent: '#9b7bff', scene: 'quiz' });
 *
 * React / Vite apps call it through a variable import (const url = '/city-core/city-app.js'; import(url))
 * so the bundler leaves it alone — see each app's src/city/startCity.
 */
import City from './city-core.js';
import { mountScene } from './city-scenes.js';

function ensureCss() {
  if (document.querySelector('link[data-city-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('./city.css', import.meta.url).href;
  l.dataset.cityCss = '1';
  document.head.appendChild(l);
}

export async function startCityApp({ service, title, accent = '#00f0c8', scene = 'vault', home = '/city', requireLogin = true, backdrop = true } = {}) {
  if (window.__cityApp) return window.__cityApp;
  ensureCss();
  const go = () => City.mountHud({ service, title, accent, home, requireLogin });
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
  let stage = null;
  if (backdrop) {
    try { stage = mountScene(scene, { accent }); } catch (e) { console.warn('[city] no 3D backdrop', e); }
  }
  window.__cityApp = { City, stage };
  return window.__cityApp;
}

export { City, mountScene };
export default startCityApp;
