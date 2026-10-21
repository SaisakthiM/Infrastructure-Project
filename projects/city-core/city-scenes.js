/**
 * city-scenes.js — one themed 3D backdrop per district, built from the same kit as grocery / housing / hospital
 * (city-3d.js: createStage, towers, glow, labels, particles). Apps call mountScene(kind, { accent }).
 *
 *   kinds: vault (bank) · quiz · library (notes) · compiler · archive (documents) · social · chat (whisper/whatsapp) · blog
 *
 * Every scene is a daylight architectural maquette photographed on paper: pale model bodies, ink hairlines,
 * one district accent used on the object that identifies the place, dust in the air. No neon, no night lights —
 * see THEME.md.
 */
import {
  createStage, THREE, PALETTE, MODEL, skyDome, floor, groundGrid, particles, glowMat, glassMat, tower, labelSprite, loadSkyline,
} from './city-3d.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const col = (c) => new THREE.Color(c);

/* each scene: stage = createStage(...); build(stage, accentHex) */
const SCENES = {
  /* ───────── bank: a stone vault door on a plinth, rings turning, coin rain ───────── */
  vault: {
    camera: { pos: [0, 5.5, 15], look: [0, 2.4, 0] }, fog: { color: MODEL.ground, density: 0.017 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.08 });
      const g = new THREE.Group(); s.scene.add(g);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 0.9, 10), new THREE.MeshStandardMaterial({ color: MODEL.bodyAlt, metalness: 0.02, roughness: 0.85 }));
      ped.position.y = 0.45; g.add(ped);
      const door = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.7, 48), new THREE.MeshStandardMaterial({ color: MODEL.steel, metalness: 0.75, roughness: 0.42 }));
      door.rotation.x = Math.PI / 2; door.position.set(0, 3.1, 0); g.add(door);
      const rings = [2.5, 3.1, 3.7].map((r, i) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 12, 72), glowMat(accent, 1 + i * 0.2));
        m.position.copy(door.position); g.add(m); return m;
      });
      const spokes = new THREE.Group(); spokes.position.copy(door.position); spokes.position.z = 0.45; g.add(spokes);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), glowMat(MODEL.trim, 0.4)); b.rotation.z = (i * Math.PI) / 3; spokes.add(b); }
      const coins = new THREE.Group(); s.scene.add(coins);
      for (let i = 0; i < 46; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), glowMat(accent, 0.9));
        c.position.set(rnd(-9, 9), rnd(0, 14), rnd(-8, 5)); c.userData.v = rnd(0.5, 1.4); c.rotation.x = rnd(0, 3); coins.add(c);
      }
      const l = new THREE.PointLight(0xfff3dc, 9, 22); l.position.set(0, 7, 5); s.scene.add(l);
      s.onFrame((dt, t) => {
        rings.forEach((r, i) => { r.rotation.x = t * (0.4 + i * 0.25); r.rotation.y = t * (0.3 + i * 0.18); });
        spokes.rotation.z = -t * 0.35;
        coins.children.forEach((c) => { c.position.y -= dt * c.userData.v * s.motion; c.rotation.x += dt * 1.4 * s.motion; if (c.position.y < 0.3) c.position.y = 14; });
      });
    },
  },

  /* ───────── quiz: paper answer cards orbiting a wireframe question solid ───────── */
  quiz: {
    camera: { pos: [0, 4, 14], look: [0, 3, 0] }, fog: { color: MODEL.ground, density: 0.019 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.09 });
      const cube = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.55 }));
      cube.position.y = 4; s.scene.add(cube);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: MODEL.body, roughness: 0.7, metalness: 0.02 })); core.position.y = 4; s.scene.add(core);
      const cards = ['A', 'B', 'C', 'D'].map((L, i) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.1), new THREE.MeshStandardMaterial({ color: MODEL.body, roughness: 0.85, metalness: 0 }));
        const lbl = labelSprite(L, { size: 1.05 }); lbl.position.z = 0.12; m.add(lbl);
        m.userData.a = (i / 4) * Math.PI * 2; s.scene.add(m); return m;
      });
      particles(s, { color: MODEL.dust, count: 200, area: [50, 22, 40], opacity: 0.34 });
      s.onFrame((dt, t) => {
        cube.rotation.x = t * 0.25; cube.rotation.y = t * 0.4; core.rotation.y = -t * 0.8;
        cards.forEach((c, i) => { const a = c.userData.a + t * 0.25; c.position.set(Math.cos(a) * 6, 4 + Math.sin(t * 0.8 + i) * 0.5, Math.sin(a) * 4 - 2); c.lookAt(0, 4, 8); });
      });
    },
  },

  /* ───────── library (notes): a reading room — shelves, loose pages, a lamp ───────── */
  library: {
    camera: { pos: [0, 4.2, 13], look: [0, 3.2, 0] }, fog: { color: MODEL.ground, density: 0.018 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground });
      const cloth = [PALETTE.blog, PALETTE.document, PALETTE.housing, PALETTE.media, PALETTE.api];
      for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(9, 0.16, 1.6), new THREE.MeshStandardMaterial({ color: 0xc4b190, roughness: 0.82 }));
        shelf.position.set(side * 12, 1 + row * 2.1, -4); s.scene.add(shelf);
        for (let b = 0; b < 16; b++) {
          const h = rnd(1.1, 1.8);
          const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 1.1), new THREE.MeshStandardMaterial({ color: cloth[(b + row) % cloth.length], roughness: 0.78 }));
          book.position.set(side * 12 - 4 + b * 0.55, 1.1 + row * 2.1 + h / 2, -4); s.scene.add(book);
        }
      }
      const pages = [];
      for (let i = 0; i < 22; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.75), new THREE.MeshStandardMaterial({ color: MODEL.body, side: THREE.DoubleSide, roughness: 0.92 }));
        p.position.set(rnd(-7, 7), rnd(1, 9), rnd(-7, 3)); p.userData = { sp: rnd(0.2, 0.6), ph: rnd(0, 6), bob: rnd(0.2, 0.5) };
        s.scene.add(p); pages.push(p);
      }
      const lamp = new THREE.PointLight(0xffe6bd, 12, 20); lamp.position.set(0, 7, 2); s.scene.add(lamp);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), glowMat(accent, 1.4)); bulb.position.copy(lamp.position); s.scene.add(bulb);
      particles(s, { color: MODEL.dust, count: 150, area: [40, 14, 30], size: 0.1, opacity: 0.32, drift: 0.08 });
      s.onFrame((dt, t) => {
        lamp.intensity = 12 + Math.sin(t * 9) * 0.4;
        pages.forEach((p) => { p.rotation.y += dt * p.userData.sp * s.motion; p.rotation.x = Math.sin(t * p.userData.sp + p.userData.ph) * 0.4; p.position.y += Math.sin(t + p.userData.ph) * dt * p.userData.bob * 0.4; });
      });
    },
  },

  /* ───────── compiler: a rack canyon with ticker tape running down it ───────── */
  compiler: {
    camera: { pos: [0, 4, 14], look: [0, 3.5, -6] }, fog: { color: MODEL.ground, density: 0.017 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.1 });
      const racks = [];
      for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        const r = tower({ w: 2.2, h: rnd(5, 11), d: 2.2, color: accent, seed: i + (side > 0 ? 11 : 1), glow: 0.8 });
        r.position.set(side * 7.5, 0, -i * 5 + 4); s.scene.add(r); racks.push(r);
      }
      const tape = [];
      for (let i = 0; i < 70; i++) {
        const c = i % 3 ? accent : PALETTE.ink;
        const l = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.5, 2.6), 0.05, 0.05), glowMat(c, 1, { transparent: true, opacity: 0.62 }));
        l.position.set(rnd(-5, 5), rnd(0, 12), rnd(-34, 4)); l.userData.v = rnd(1, 3.2); s.scene.add(l); tape.push(l);
      }
      s.onFrame((dt, t) => {
        tape.forEach((l) => { l.position.y -= dt * l.userData.v * s.motion; if (l.position.y < 0) { l.position.y = 12; l.position.x = rnd(-5, 5); } });
        racks.forEach((r, i) => { r.userData.cap.material.emissiveIntensity = 0.12 + Math.sin(t * 2 + i) * 0.06; });
      });
    },
  },

  /* ───────── archive (documents): a stack of paper slabs under a scanning rule ───────── */
  archive: {
    camera: { pos: [0, 5, 15], look: [0, 3, 0] }, fog: { color: MODEL.ground, density: 0.018 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.08 });
      const slabs = [];
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 4.2), new THREE.MeshStandardMaterial({ color: i % 2 ? MODEL.body : MODEL.bodyAlt, roughness: 0.9, metalness: 0 }));
        m.position.set(Math.sin(i * 0.5) * 0.6, 0.6 + i * 0.5, Math.cos(i * 0.5) * 0.6); m.rotation.y = i * 0.22; s.scene.add(m); slabs.push(m);
      }
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.05), glowMat(accent, 2, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      beam.rotation.x = -Math.PI / 2; s.scene.add(beam);
      particles(s, { color: MODEL.dust, count: 180, area: [40, 18, 30], opacity: 0.3 });
      s.onFrame((dt, t) => {
        slabs.forEach((m, i) => { m.rotation.y = i * 0.22 + t * 0.12; m.position.x = Math.sin(i * 0.5) * 0.6 + Math.max(0, 1 - Math.abs(beam.position.y - m.position.y) * 1.6) * 0.35; });
        beam.position.y = 0.6 + ((Math.sin(t * 0.9) + 1) / 2) * 7; beam.rotation.z = t * 0.5;
      });
    },
  },

  /* ───────── social: a plaza of model figures linked by hairline connections ───────── */
  social: {
    camera: { pos: [0, 6, 17], look: [0, 3, 0] }, fog: { color: MODEL.ground, density: 0.016 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.08 });
      const palette = [accent, PALETTE.grocery, PALETTE.housing, PALETTE.blog, PALETTE.api];
      const orbs = [];
      for (let i = 0; i < 16; i++) {
        const o = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.35, 0.8), 24, 16), glowMat(palette[i % palette.length], 0.6));
        o.userData = { a: rnd(0, 6.28), r: rnd(3, 10), y: rnd(1.5, 7), sp: rnd(0.08, 0.3) }; s.scene.add(o); orbs.push(o);
      }
      const geo = new THREE.BufferGeometry(); const N = orbs.length * 2;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const links = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.22 })); s.scene.add(links);
      s.onFrame((dt, t) => {
        orbs.forEach((o) => { const u = o.userData; const a = u.a + t * u.sp; o.position.set(Math.cos(a) * u.r, u.y + Math.sin(t + u.a) * 0.4, Math.sin(a) * u.r * 0.6 - 2); });
        const p = geo.attributes.position;
        orbs.forEach((o, i) => { const n = orbs[(i + 3) % orbs.length]; p.setXYZ(i * 2, o.position.x, o.position.y, o.position.z); p.setXYZ(i * 2 + 1, n.position.x, n.position.y, n.position.z); });
        p.needsUpdate = true;
      });
    },
  },

  /* ───────── chat: message cards drifting up over the model skyline ───────── */
  chat: {
    camera: { pos: [0, 5, 16], look: [0, 4, -4] }, fog: { color: MODEL.ground, density: 0.014 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground });
      loadSkyline(s, { tint: 0.88 }).catch(() => {});
      const bubbles = [];
      for (let i = 0; i < 26; i++) {
        const out = i % 2 === 0;
        const b = new THREE.Mesh(new THREE.BoxGeometry(rnd(1.4, 3), rnd(0.55, 0.95), 0.1), out ? glowMat(accent, 1, { transparent: true, opacity: 0.8 }) : new THREE.MeshStandardMaterial({ color: MODEL.body, roughness: 0.9 }));
        b.position.set(rnd(-11, 11), rnd(0, 12), rnd(-8, 2)); b.userData = { v: rnd(0.4, 1.1), sway: rnd(0, 6) }; s.scene.add(b); bubbles.push(b);
      }
      particles(s, { color: MODEL.dust, count: 130, area: [50, 20, 40], opacity: 0.28 });
      s.onFrame((dt, t) => bubbles.forEach((b) => { b.position.y += dt * b.userData.v * s.motion; b.position.x += Math.sin(t + b.userData.sway) * dt * 0.3; if (b.position.y > 13) b.position.y = -1; }));
    },
  },

  /* ───────── blog: newsprint towers on a press floor ───────── */
  blog: {
    camera: { pos: [0, 5, 16], look: [0, 3.5, 0] }, fog: { color: MODEL.ground, density: 0.017 },
    build(s, accent) {
      skyDome(s, MODEL.skyTop, MODEL.skyLow); floor(s, { color: MODEL.ground }); groundGrid(s, { opacity: 0.08 });
      const ts = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2; const r = rnd(8, 15);
        const t = tower({ w: rnd(1.4, 2.4), h: rnd(3, 11), d: rnd(1.4, 2.4), color: i % 3 ? accent : PALETTE.ink, seed: i, glow: 0.7 });
        t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 4); s.scene.add(t); ts.push(t);
      }
      particles(s, { color: MODEL.dust, count: 140, area: [44, 16, 36], size: 0.12, opacity: 0.28 });
      s.onFrame((dt, t) => ts.forEach((m, i) => { m.userData.cap.material.emissiveIntensity = 0.1 + Math.sin(t * 1.4 + i) * 0.05; }));
    },
  },
};

export function mountScene(kind = 'vault', { accent = '#0f6e9c', container = document.body } = {}) {
  const def = SCENES[kind] || SCENES.vault;
  const stage = createStage(container, { camera: def.camera, fog: def.fog, parallax: 0.9 });
  if (stage.ok) {
    try { def.build(stage, col(accent).getHex()); } catch (e) { console.warn('[city] scene failed', e); }
  }
  return stage;
}

export const sceneKinds = Object.keys(SCENES);
