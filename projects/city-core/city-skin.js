/**
 * city-skin.js — puts an EXISTING web app (Whisper chat, Notes, …) inside the Mini City look
 * without touching its logic: a live three.js scene sits behind the page and city-skin.css turns the
 * app's own panels into glass. No component is replaced, no request is changed, nothing is re-rendered.
 *
 * One-time setup in the app's index.html (same import map every other district uses):
 *
 *   <script type="importmap">
 *   { "imports": { "three": "/city-core/vendor/three/three.module.js",
 *                  "three/addons/": "/city-core/vendor/three/addons/" } }
 *   </script>
 *   <script type="module" src="/city-core/city-skin.js"></script>
 *
 * The theme is picked from the URL (/whisper… -> whisper, /notes… -> notes). To force one, or to tune it,
 * set this BEFORE the script:   window.CITY_SKIN = { theme: 'notes', accent: '#e6b450' }
 * Opt out for a session with ?skin=off — handy when comparing against the old UI.
 */

const BASE = new URL('.', import.meta.url).href; // …/city-core/

const THEMES = {
  whisper: {
    accent: '#25d6a3',
    sky: [0x08161c, 0x03070b],
    fog: 0x050c10,
    camera: { pos: [0, 3.4, 13], look: [0, 3.2, -4] },
  },
  notes: {
    accent: '#e8b44f',
    sky: [0x16120a, 0x070504],
    fog: 0x0a0806,
    camera: { pos: [0, 3.6, 12.5], look: [0, 3.4, -4] },
  },
};

let mounted = null;

function pickTheme(opt) {
  if (opt && THEMES[opt]) return opt;
  const p = (typeof location !== 'undefined' ? location.pathname : '').toLowerCase();
  if (p.includes('note')) return 'notes';
  return 'whisper';
}

function ensureImportMap() {
  // city-3d.js imports "three" by bare name. Best practice is to declare the map in index.html (before any module);
  // this is a safety net for browsers that still accept a late one.
  if (document.querySelector('script[type="importmap"]')) return;
  const s = document.createElement('script');
  s.type = 'importmap';
  s.textContent = JSON.stringify({ imports: { three: BASE + 'vendor/three/three.module.js', 'three/addons/': BASE + 'vendor/three/addons/' } });
  document.head.appendChild(s);
}

function injectCss() {
  if (document.getElementById('city-skin-css')) return;
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap';
  document.head.appendChild(fonts);
  const link = document.createElement('link');
  link.id = 'city-skin-css';
  link.rel = 'stylesheet';
  link.href = BASE + 'city-skin.css';
  document.head.appendChild(link);
}

/** Mount the skin. Idempotent: calling it twice returns the same dispose(). */
export function mountSkin(options = {}) {
  if (typeof document === 'undefined') return () => {};
  if (mounted) return mounted.dispose;
  if (new URLSearchParams(location.search).get('skin') === 'off') return () => {};

  const cfg = { ...(window.CITY_SKIN || {}), ...options };
  const name = pickTheme(cfg.theme);
  const theme = { ...THEMES[name], ...(cfg.accent ? { accent: cfg.accent } : {}) };

  const root = document.documentElement;
  root.classList.add('city-skin', 'city-skin-' + name);
  root.style.setProperty('--accent', theme.accent);
  injectCss();
  ensureImportMap();

  const state = { dispose: () => {} };
  mounted = state;
  let cancelled = false;
  let stage = null;
  let offPointer = () => {};

  const start = async () => {
    try {
      const kit = await import(/* @vite-ignore */ BASE + 'city-3d.js');
      if (cancelled) return;
      stage = kit.createStage(document.body, {
        camera: theme.camera,
        fog: { color: theme.fog, density: 0.018 },
        parallax: 1.1,
        pixelRatioMax: 1.5,
      });
      if (!stage.ok) return; // no WebGL: the CSS gradient fallback in city-skin.css takes over
      stage.canvas.style.pointerEvents = 'none'; // the app owns every click
      stage.canvas.classList.add('city-skin-canvas');

      // the app covers the canvas, so feed the pointer to the camera ourselves
      const onMove = (e) => {
        stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        stage.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      offPointer = () => window.removeEventListener('pointermove', onMove);

      kit.skyDome(stage, theme.sky[0], theme.sky[1]);
      kit.floor(stage, { size: 90, color: 0x070b10 });
      (name === 'notes' ? buildNotes : buildWhisper)(kit, stage, theme);
      kit.loadSkyline(stage, { span: 170, z: -85, tint: 0.4 });
      root.classList.add('city-skin-3d');
    } catch (err) {
      console.warn('[city-skin] 3D backdrop unavailable, keeping the glass theme only', err);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  state.dispose = () => {
    cancelled = true;
    offPointer();
    stage?.dispose?.();
    root.classList.remove('city-skin', 'city-skin-' + name, 'city-skin-3d');
    mounted = null;
  };
  return state.dispose;
}

/* ───────────────────────── Whisper: a night city made of conversations ───────────────────────── */

function buildWhisper(kit, stage, theme) {
  const { THREE } = kit;
  const accent = new THREE.Color(theme.accent);
  const other = new THREE.Color(0x6aa8ff);

  kit.groundGrid(stage, { color: accent.getHex(), opacity: 0.14, size: 100, divisions: 70 });
  kit.particles(stage, { count: 220, color: accent.getHex(), area: [60, 18, 40], size: 0.12, opacity: 0.55, drift: 0.12 });

  const lamp = new THREE.PointLight(accent.getHex(), 40, 40);
  lamp.position.set(0, 6, 4);
  const cool = new THREE.PointLight(other.getHex(), 25, 40);
  cool.position.set(-10, 4, -2);
  stage.scene.add(lamp, cool);

  // floating chat bubbles: mine (accent, drifting up on the right) and theirs (blue, on the left)
  const bubbles = [];
  const group = new THREE.Group();
  stage.scene.add(group);
  const make = (mine, i) => {
    const color = mine ? accent : other;
    const len = 0.9 + Math.random() * 1.6;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.5,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, len, 6, 14), mat);
    body.rotation.z = Math.PI / 2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 3), mat);
    tail.position.set(mine ? len / 2 + 0.2 : -len / 2 - 0.2, -0.22, 0);
    tail.rotation.z = mine ? -Math.PI / 2.6 : Math.PI / 2.6;
    const g = new THREE.Group();
    g.add(body, tail);
    const side = mine ? 1 : -1;
    g.position.set(side * (4 + Math.random() * 7), Math.random() * 12, -6 - Math.random() * 12);
    g.userData = { side, speed: 0.25 + Math.random() * 0.4, phase: Math.random() * 6.28, base: g.position.x, i };
    group.add(g);
    bubbles.push(g);
  };
  for (let i = 0; i < 18; i += 1) make(i % 2 === 0, i);

  // "typing…" dots
  const dots = [0, 1, 2].map((k) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), kit.glowMat(accent.getHex(), 2));
    d.position.set(-0.5 + k * 0.5, 1.2, -3);
    stage.scene.add(d);
    return d;
  });

  // a signal tower with pulsing rings
  const tower = kit.tower({ w: 1.2, h: 9, d: 1.2, color: accent.getHex(), seed: 7, glow: 0.9 });
  tower.position.set(11, 0, -14);
  stage.scene.add(tower);
  const rings = [0, 1, 2].map((k) => {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 8, 64),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.6 }),
    );
    r.rotation.x = Math.PI / 2;
    r.position.set(11, 9.4, -14);
    r.userData.k = k / 3;
    stage.scene.add(r);
    return r;
  });

  stage.onFrame((dt, t) => {
    const m = stage.motion;
    bubbles.forEach((b) => {
      const u = b.userData;
      b.position.y += dt * u.speed * m;
      if (b.position.y > 13) b.position.y = -1;
      b.position.x = u.base + Math.sin(t * 0.5 + u.phase) * 0.6 * m;
      b.rotation.z = Math.sin(t * 0.4 + u.phase) * 0.08;
    });
    dots.forEach((d, k) => {
      d.position.y = 1.2 + Math.max(0, Math.sin(t * 4 - k * 0.7)) * 0.35 * m;
    });
    rings.forEach((r) => {
      const k = (t * 0.25 * m + r.userData.k) % 1;
      r.scale.setScalar(1 + k * 9);
      r.material.opacity = 0.6 * (1 - k);
    });
  });

  // a robot citizen reading messages in the corner
  kit.loadRobot(stage, { position: [-9, 0, -2], rotationY: 0.7, scale: 0.9, clip: 'Idle', tint: accent.getHex() }).then((r) => {
    if (!r) return;
    const wave = () => r.play('Wave', { once: true });
    setTimeout(wave, 1500);
    setInterval(wave, 14000);
  });
}

/* ───────────────────────── Notes: a desk at night, pages drifting in lamplight ───────────────────────── */

function buildNotes(kit, stage, theme) {
  const { THREE } = kit;
  const accent = new THREE.Color(theme.accent);

  kit.groundGrid(stage, { color: accent.getHex(), opacity: 0.1, size: 100, divisions: 60 });
  kit.particles(stage, { count: 160, color: 0xffd58a, area: [50, 14, 36], size: 0.14, opacity: 0.7, drift: 0.07 }); // fireflies

  const lamp = new THREE.PointLight(0xffc477, 70, 45);
  lamp.position.set(-7, 7, 2);
  const fill = new THREE.PointLight(0x7aa7ff, 14, 40);
  fill.position.set(10, 5, -4);
  stage.scene.add(lamp, fill);

  const inks = [0xffe9a8, 0xbfe3ff, 0xd9f2c4, 0xffd0d9, 0xe6d6ff];
  const pages = [];
  const group = new THREE.Group();
  stage.scene.add(group);

  const sheetTexture = (ink) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 340;
    const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(ink).getHexString();
    g.fillRect(0, 0, 256, 340);
    g.fillStyle = 'rgba(30,25,15,0.55)';
    g.fillRect(18, 22, 120, 12); // title
    g.fillStyle = 'rgba(30,25,15,0.28)';
    for (let y = 58; y < 316; y += 22) g.fillRect(18, y, 200 - ((y * 7) % 70), 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  for (let i = 0; i < 16; i += 1) {
    const ink = inks[i % inks.length];
    const mat = new THREE.MeshStandardMaterial({ map: sheetTexture(ink), roughness: 0.9, emissive: ink, emissiveIntensity: 0.12 });
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 0.04), mat);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.glowMat(accent.getHex(), 1.8));
    pin.position.set(0, 0.88, 0.05);
    const g = new THREE.Group();
    g.add(sheet, pin);
    g.position.set((Math.random() - 0.5) * 30, 1 + Math.random() * 9, -4 - Math.random() * 14);
    g.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5);
    g.userData = { phase: Math.random() * 6.28, speed: 0.3 + Math.random() * 0.5, y0: g.position.y, spin: (Math.random() - 0.5) * 0.15 };
    group.add(g);
    pages.push(g);
  }

  stage.onFrame((dt, t) => {
    const m = stage.motion;
    pages.forEach((p) => {
      const u = p.userData;
      p.position.y = u.y0 + Math.sin(t * 0.35 * u.speed * 2 + u.phase) * 0.7 * m;
      p.rotation.y += u.spin * dt * m;
      p.rotation.z = Math.sin(t * 0.3 + u.phase) * 0.12 * m;
    });
    lamp.intensity = 70 + Math.sin(t * 2.3) * 3 * m; // candle-ish flicker
  });

  kit.loadRobot(stage, { position: [9, 0, -1], rotationY: -0.7, scale: 0.9, clip: 'Idle', tint: accent.getHex() }).then((r) => {
    if (!r) return;
    setTimeout(() => r.play('Yes', { once: true }), 2500);
    setInterval(() => r.play('ThumbsUp', { once: true }), 17000);
  });
}

// auto-mount: one <script type="module" src="/city-core/city-skin.js"> line is enough
if (typeof window !== 'undefined' && !window.CITY_SKIN_MANUAL) mountSkin();

export default mountSkin;
