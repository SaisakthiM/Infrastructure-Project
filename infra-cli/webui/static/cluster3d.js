// 3D backdrop for the social-platform web UI.
// The five Terragrunt environments are drawn as linked nodes in their dependency
// order. While a job streams output, the environment currently being applied
// pulses amber, finished ones turn green and a failure turns red.
//
//   window.Cluster3D.set('prod-docker', 'running' | 'done' | 'failed' | 'idle')
//   window.Cluster3D.feed(line)     called for every streamed log line
//   window.Cluster3D.finish(ok)     called when a job ends
//   window.Cluster3D.reset()
import * as THREE from '/vendor/three/three.module.min.js';

const canvas = document.getElementById('bg3d');

const NODES = {
  'prod-gateway': { pos: [0, 0, 0], label: 'gateway' },
  'prod-docker': { pos: [-5.2, 2.4, -2], label: 'docker apps' },
  'prod-social': { pos: [5.2, 2.0, -3], label: 'social / kind' },
  'prod-infra': { pos: [0, 5.2, -7], label: 'infra' },
  'prod-manage': { pos: [0, -3.9, -2], label: 'manage' },
};
const EDGES = [
  ['prod-gateway', 'prod-docker'],
  ['prod-gateway', 'prod-social'],
  ['prod-docker', 'prod-infra'],
  ['prod-social', 'prod-infra'],
  ['prod-gateway', 'prod-manage'],
  ['prod-social', 'prod-manage'],
];
const COLORS = { idle: 0x3a8fb7, running: 0xffb020, done: 0x34d399, failed: 0xf87171 };

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
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.035);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 1, 17);

  scene.add(new THREE.AmbientLight(0x8fb4ff, 0.8));
  const key = new THREE.PointLight(0xffffff, 60, 60);
  key.position.set(6, 8, 10);
  scene.add(key);

  const world = new THREE.Group();
  scene.add(world);

  function label(text) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const g = c.getContext('2d');
    g.font = '600 40px ui-monospace, Menlo, Consolas, monospace';
    g.fillStyle = 'rgba(5,7,13,0.65)';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#d7e3f4';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(3.4, 0.64, 1);
    return sp;
  }

  const nodes = {};
  Object.entries(NODES).forEach(([env, def]) => {
    const g = new THREE.Group();
    g.position.set(...def.pos);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: COLORS.idle, wireframe: true, transparent: true, opacity: 0.85 }),
    );
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), new THREE.MeshBasicMaterial({ color: COLORS.idle }));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.018, 8, 64),
      new THREE.MeshBasicMaterial({ color: COLORS.idle, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2.4;
    const tag = label(def.label);
    tag.position.y = -1.9;
    g.add(shell, core, ring, tag);
    world.add(g);
    nodes[env] = { g, shell, core, ring, color: new THREE.Color(COLORS.idle), target: new THREE.Color(COLORS.idle) };
    state[env] = 'idle';
  });

  const pulses = [];
  EDGES.forEach(([a, b]) => {
    const pa = new THREE.Vector3(...NODES[a].pos);
    const pb = new THREE.Vector3(...NODES[b].pos);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pa, pb]),
      new THREE.LineBasicMaterial({ color: 0x2b4a63, transparent: true, opacity: 0.6 }),
    );
    world.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    dot.visible = false;
    world.add(dot);
    pulses.push({ a, b, pa, pb, dot, t: Math.random() });
  });

  // faint star field
  const starPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i += 1) {
    starPos[i * 3] = (Math.random() - 0.5) * 120;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
    starPos[i * 3 + 2] = -Math.random() * 80 - 5;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9db8d9, size: 0.12, transparent: true, opacity: 0.7 })));

  function set(env, s) {
    const n = nodes[env];
    if (!n) return;
    state[env] = s;
    n.target.set(COLORS[s] || COLORS.idle);
  }
  function reset() {
    Object.keys(nodes).forEach((e) => set(e, 'idle'));
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
  (function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    const k = reduce ? 0.15 : 1;

    world.rotation.y = Math.sin(t * 0.12 * k) * 0.35 + px * 0.15;
    world.rotation.x = py * 0.06;

    Object.entries(nodes).forEach(([env, n]) => {
      n.color.lerp(n.target, Math.min(1, dt * 5));
      n.shell.material.color.copy(n.color);
      n.core.material.color.copy(n.color);
      n.ring.material.color.copy(n.color);
      const running = state[env] === 'running';
      const s = 1 + (running ? 0.18 * Math.sin(t * 6) : 0.04 * Math.sin(t * 1.5));
      n.shell.scale.setScalar(s);
      n.shell.rotation.y += dt * (running ? 1.6 : 0.25) * k;
      n.shell.rotation.x += dt * 0.15 * k;
      n.ring.rotation.z += dt * (running ? 1.4 : 0.3) * k;
    });

    pulses.forEach((p) => {
      const active = state[p.a] === 'running' || state[p.b] === 'running';
      p.dot.visible = active;
      if (active) {
        p.t = (p.t + dt * 0.7) % 1;
        p.dot.position.lerpVectors(p.pa, p.pb, p.t);
      }
    });

    renderer.render(scene, camera);
  })();
}
