// Daylight maquette behind the dashboard.
// The five Terragrunt stacks are drawn as buildings on a plinth in registry
// order — matte pale bodies, ink hairlines, one coloured roof plate each — the
// same model the city home is built from (see projects/city-core/THEME.md §4).
// While a job streams output the environment being applied lifts its roof plate
// and paints it ochre, finished ones go moss, a failure goes brick.
//
//   window.Cluster3D.set('prod-docker', 'running' | 'done' | 'failed' | 'idle')
//   window.Cluster3D.feed(line)     called for every streamed log line
//   window.Cluster3D.finish(ok)     called when a job ends
//   window.Cluster3D.reset()
import * as THREE from '/vendor/three/three.module.min.js';

const canvas = document.getElementById('bg3d');

// Registry order, street layout: gateway at the head of the street, the app
// wards either side, infra at the back, the manage block off to the kerb.
const BUILDINGS = {
  'prod-gateway': { code: '01', name: 'gateway', pos: [0, 0, 6],      size: [3.6, 2.2, 3.0], accent: 0x0f6e9c },
  'prod-docker':  { code: '02', name: 'docker apps', pos: [-4.6, 0, 0], size: [4.4, 3.4, 3.4], accent: 0x2b7e72 },
  'prod-social':  { code: '03', name: 'social / kind', pos: [4.8, 0, -0.4], size: [4.0, 2.8, 3.6], accent: 0x4a5aa6 },
  'prod-infra':   { code: '04', name: 'infra', pos: [0, 0, -6.4],     size: [5.6, 4.2, 3.2], accent: 0x9a4a32 },
  'prod-manage':  { code: '05', name: 'manage', pos: [7.4, 0, 5.4],   size: [2.6, 1.6, 2.4], accent: 0x6e7042 },
};
const EDGES = [
  ['prod-gateway', 'prod-docker'],
  ['prod-gateway', 'prod-social'],
  ['prod-docker', 'prod-infra'],
  ['prod-social', 'prod-infra'],
  ['prod-gateway', 'prod-manage'],
  ['prod-social', 'prod-manage'],
];

// The maquette palette — same numbers as MAQUETTE in intro/v3 and PALETTE in
// city-3d.js. Status colours are the registry's moss / ochre / brick.
const M = {
  ground: 0xedeae1, road: 0xdcd6c9, kerb: 0xcfc9bb, marking: 0x8a857a,
  body: 0xe8e4da, bodyAlt: 0xdcd6c9, trim: 0xb9b3a5, ink: 0x121212,
  skyLow: 0xe3dfd4, dust: 0xa29a88,
  running: 0xa9741b, done: 0x3f7139, failed: 0xa33a2e,
};

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const state = {};
let current = null;
let finished = false;

function noop() {}
window.Cluster3D = { set: noop, feed: noop, finish: noop, reset: noop };

if (canvas && webgl()) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(M.skyLow, 22, 74);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(6.5, 8.2, 20);
  camera.lookAt(1.2, 1.6, 0);

  // Overcast daylight: wide sky fill, warm low key, no neon anywhere.
  scene.add(new THREE.HemisphereLight(0xf2efe8, 0xc9c3b6, 1.1));
  const sun = new THREE.DirectionalLight(0xfff6e4, 1.6);
  sun.position.set(14, 24, 10);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  const matte = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
  const hairline = (opacity) => new THREE.LineBasicMaterial({ color: M.ink, transparent: true, opacity });

  // Ground + the drafting grid the model sits on
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), matte(M.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  world.add(ground);

  const grid = new THREE.GridHelper(120, 60, M.ink, M.ink);
  grid.material.transparent = true;
  grid.material.opacity = 0.07;
  world.add(grid);

  // Street: a kerbed road running the length of the block
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 46), matte(M.road));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0.6, 0.001, 0);
  world.add(road);
  const kerbMat = matte(M.kerb);
  [-1.6, 2.8].forEach((x) => {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 46), kerbMat);
    kerb.position.set(x, 0.03, 0);
    world.add(kerb);
  });

  function plateTexture(code, name, accentHex) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(251,250,247,.94)';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(18,18,18,.6)';
    g.lineWidth = 3;
    g.strokeRect(4, 4, c.width - 8, c.height - 8);
    g.fillStyle = accentHex;
    g.fillRect(4, 4, c.width - 8, 7);
    g.fillStyle = '#121212';
    g.fillRect(24, 34, 74, 56);
    g.fillStyle = '#f4f2ed';
    g.font = "500 30px 'JetBrains Mono', ui-monospace, monospace";
    g.textBaseline = 'middle';
    g.fillText(code, 38, 64);
    g.fillStyle = '#121212';
    g.font = "500 40px Archivo, 'Helvetica Neue', ui-sans-serif, sans-serif";
    g.fillText(name.toUpperCase(), 116, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const buildings = {};
  const plateTags = [];
  Object.entries(BUILDINGS).forEach(([env, def], i) => {
    const g = new THREE.Group();
    g.position.set(def.pos[0], 0, def.pos[2]);
    const w = def.size[0], h = def.size[1], d = def.size[2];

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(i % 2 ? M.bodyAlt : M.body));
    body.position.y = h / 2;
    g.add(body);

    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), hairline(0.5));
    outline.position.copy(body.position);
    g.add(outline);

    // Roof plate: the ward's accent, floating 6cm above the slab so its edge reads.
    const accentHex = '#' + def.accent.toString(16).padStart(6, '0');
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.78, 0.12, d * 0.78),
      new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.72, metalness: 0 }),
    );
    plate.position.y = h + 0.12;
    g.add(plate);
    const plateOutline = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), hairline(0.55));
    plateOutline.position.copy(plate.position);
    g.add(plateOutline);

    // Ground-floor glazing band, matte grey, never lit from inside.
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.005, h * 0.12, d * 1.005), matte(M.trim));
    band.position.y = h * 0.24;
    g.add(band);

    const tag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: plateTexture(def.code, def.name, accentHex), transparent: true, depthWrite: false,
    }));
    tag.scale.set(3.2, 0.8, 1);
    tag.position.set(0, h + 1.1, 0);
    g.add(tag);
    plateTags.push({ tag, code: def.code, name: def.name, accentHex });

    world.add(g);
    buildings[env] = {
      g, plate, plateOutline, tag,
      topY: h + 0.12,
      accent: new THREE.Color(def.accent),
      target: new THREE.Color(def.accent),
      lift: 0,
    };
    state[env] = 'idle';
  });

  // The plate is type, and the type is a webfont — the first bake would print
  // Helvetica. Redraw once Archivo and JetBrains Mono are actually available.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      plateTags.forEach(({ tag, code, name, accentHex }) => {
        const old = tag.material.map;
        tag.material.map = plateTexture(code, name, accentHex);
        tag.material.needsUpdate = true;
        if (old) old.dispose();
      });
    });
  }

  // Dependency leaders, drawn flat on the plinth like drafting connectors
  const pulses = [];
  EDGES.forEach(([a, b]) => {
    const pa = new THREE.Vector3(BUILDINGS[a].pos[0], 0.02, BUILDINGS[a].pos[2]);
    const pb = new THREE.Vector3(BUILDINGS[b].pos[0], 0.02, BUILDINGS[b].pos[2]);
    const pts = [];
    for (let i = 0; i <= 24; i += 1) pts.push(new THREE.Vector3().lerpVectors(pa, pb, i / 24));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: M.marking, transparent: true, opacity: 0.55, dashSize: 0.35, gapSize: 0.28 }),
    );
    line.computeLineDistances();
    world.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matte(M.marking));
    dot.visible = false;
    world.add(dot);
    pulses.push({ a, b, pa, pb, dot, t: Math.random() });
  });

  // Dust motes, never coloured by an accent
  const motes = new Float32Array(340 * 3);
  for (let i = 0; i < 340; i += 1) {
    motes[i * 3] = (Math.random() - 0.5) * 60;
    motes[i * 3 + 1] = Math.random() * 12 + 0.4;
    motes[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  const dust = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: M.dust, size: 0.07, transparent: true, opacity: 0.5, sizeAttenuation: true,
  }));
  scene.add(dust);

  function set(env, s) {
    const b = buildings[env];
    if (!b) return;
    state[env] = s;
    b.target.set(s === 'running' ? M.running : s === 'done' ? M.done : s === 'failed' ? M.failed : b.accent.getHex());
  }
  function reset() {
    Object.keys(buildings).forEach((e) => {
      state[e] = 'idle';
      const b = buildings[e];
      b.target.copy(b.accent);
    });
    current = null;
    finished = false;
  }

  window.Cluster3D = {
    set,
    reset,
    feed(line) {
      const m = /prod-(gateway|docker|social|infra|manage)/.exec(String(line));
      if (!m) return;
      if (finished) reset();
      const env = 'prod-' + m[1];
      if (current && current !== env && state[current] === 'running') set(current, 'done');
      current = env;
      set(env, 'running');
    },
    finish(ok) {
      if (current) set(current, ok ? 'done' : 'failed');
      if (ok) Object.keys(state).forEach((e) => state[e] === 'running' && set(e, 'done'));
      finished = true;
    },
  };

  let px = 0;
  let py = 0;
  window.addEventListener('pointermove', (e) => {
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let drawn = 0;
  (function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    // A maquette is photographed, not animated: the model only turns a few
    // degrees under the cursor. Reduced motion renders once and then idles.
    if (!reduce || drawn === 0) {
      world.rotation.y = Math.sin(t * 0.05) * 0.05 * (reduce ? 0 : 1) + px * 0.07;
      camera.position.y = 8.2 - py * 0.9;
      camera.lookAt(1.2, 1.6, 0);
    }

    Object.values(buildings).forEach((b) => {
      b.plate.material.color.lerp(b.target, Math.min(1, dt * 5));
    });

    Object.entries(buildings).forEach(([env, b]) => {
      const running = state[env] === 'running';
      const want = running ? 0.2 + 0.06 * Math.sin(t * 4) : 0;
      b.lift += (want - b.lift) * Math.min(1, dt * 6);
      b.plate.position.y = b.topY + b.lift;
      b.plateOutline.position.y = b.plate.position.y;
    });

    pulses.forEach((p) => {
      const active = state[p.a] === 'running' || state[p.b] === 'running';
      p.dot.visible = active;
      if (active) {
        p.t = (p.t + dt * 0.35) % 1;
        p.dot.position.lerpVectors(p.pa, p.pb, p.t);
        p.dot.position.y = 0.1;
      }
    });

    if (!reduce) {
      dust.rotation.y = t * 0.008;
      dust.position.y = Math.sin(t * 0.2) * 0.15;
    }

    renderer.render(scene, camera);
    drawn += 1;
  })();
}
