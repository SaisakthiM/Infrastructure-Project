/**
 * city-3d.js — three.js kit shared by every Mini City district.
 *
 *   <script type="importmap">
 *     { "imports": { "three": "/city-core/vendor/three/three.module.js",
 *                    "three/addons/": "/city-core/vendor/three/addons/" } }
 *   </script>
 *
 *   import { createStage, THREE, tower, loadRobot } from '/city-core/city-3d.js';
 *   const stage = createStage(document.body, { camera: { pos: [0, 6, 18], look: [0, 3, 0] } });
 *   if (stage.ok) { ... stage.onFrame((dt, t) => { ... }); }
 *
 * If WebGL is missing, createStage() returns a stub with ok === false and adds the
 * "no-webgl" class to <html>, so pages still work as plain 2D UIs.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export { THREE, OrbitControls };

export const ASSETS = {
  base: '/city-core',
  robot: '/city-core/models/robot.glb',
  skyline: '/city-core/models/city.glb',
  fox: '/city-core/models/Fox.glb',
  draco: '/city-core/draco/',
  earth: '/city-core/textures/earth_atmos_2048.jpg',
  clouds: '/city-core/textures/earth_clouds_1024.png',
  lights: '/city-core/textures/earth_lights_2048.png',
};

/* Canonical district accents — one muted, cohesive set. Every app, scene and the 3D home read accents
   from here so a district is the same colour everywhere. Keep these in sync with intro/v3/src/data/projects.ts. */
export const PALETTE = {
  bg: 0xf4f2ed,
  ink: 0x121212,
  paper: 0xf4f2ed,
  model: 0xe7e3d9,
  up: 0x3f7139,
  down: 0xa33a2e,
  warn: 0xa9741b,
  bank: 0x0f6e9c,
  hospital: 0x2b7e72,
  media: 0x8d4850,
  api: 0x3d4e66,
  grocery: 0x4c7c3f,
  housing: 0x966e35,
  whisper: 0x0f7a8c,
  document: 0x6e7042,
  blog: 0x6e4a79,
  social: 0x4a5aa6,
  compiler: 0x4a4f55,
  police: 0x9a4a32,
  exchange: 0x3d4e66,
};

/* daylight maquette: matte off-whites the buildings are painted in, ink for anything structural */
export const MODEL = {
  body: 0xe8e4da,
  bodyAlt: 0xdcd6c9,
  trim: 0xb9b3a5,
  glass: 0xa9a29a,
  ground: 0xedeae1,
  skyTop: 0xf7f5f0,
  skyLow: 0xe3dfd4,
  dust: 0xa29a88,
  steel: 0x8a857a,
  off: 0xb9b4a8,
};

export const ease = {
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
};

/* ───────────────────────── stage ───────────────────────── */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function stubStage() {
  document.documentElement.classList.add('no-webgl');
  const noop = () => {};
  return {
    ok: false,
    THREE,
    onFrame: () => noop,
    interactive: noop,
    flyTo: noop,
    orbit: () => null,
    dispose: noop,
    pointer: { x: 0, y: 0 },
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    motion: 0,
  };
}

/**
 * @param {HTMLElement} container  element that will hold the canvas (document.body = fullscreen backdrop)
 * @param {object} opts
 *   camera: { fov, pos:[x,y,z], look:[x,y,z] }  fog: {color, density}  parallax: number (0 disables)
 *   exposure, pixelRatioMax, lights: false to skip default lighting
 */
export function createStage(container = document.body, opts = {}) {
  if (!webglAvailable()) return stubStage();

  const cfg = {
    camera: { fov: 55, pos: [0, 6, 18], look: [0, 3, 0], ...(opts.camera || {}) },
    fog: { color: PALETTE.bg, density: 0.011, ...(opts.fog || {}) },
    parallax: opts.parallax ?? 0.6,
    exposure: opts.exposure ?? 1.05,
    pixelRatioMax: opts.pixelRatioMax ?? 1.75,
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'city-canvas' + (container === document.body ? ' fixed' : '');
  container.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove();
    return stubStage();
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.exposure;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, cfg.pixelRatioMax);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.fog.color);
  scene.fog = new THREE.FogExp2(cfg.fog.color, cfg.fog.density);

  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, 0.1, 600);
  const basePos = new THREE.Vector3(...cfg.camera.pos);
  const baseLook = new THREE.Vector3(...cfg.camera.look);
  const look = baseLook.clone();
  camera.position.copy(basePos);

  if (opts.lights !== false) {
    scene.add(new THREE.HemisphereLight(0xf2efe8, 0xc9c3b6, 1.15));
    const key = new THREE.DirectionalLight(0xfff6e4, 1.7);
    key.position.set(14, 24, 10);
    scene.add(key);
  }

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const frameFns = new Set();
  const pointer = { x: 0, y: 0, px: 0, py: 0, inside: false };
  const picks = []; // { object, cfg }
  let hovered = null;
  let controls = null;
  let fly = null;
  let disposed = false;
  let raf = 0;

  /* tooltip */
  const tip = document.createElement('div');
  tip.className = 'city-tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  function size() {
    const w = container === document.body ? window.innerWidth : container.clientWidth;
    const h = container === document.body ? window.innerHeight : container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = Math.max(1, w) / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(container === document.body ? document.documentElement : container);

  /* picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick() {
    if (!picks.length) return null;
    ndc.set(pointer.x, pointer.y);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(
      picks.map((p) => p.object),
      true,
    );
    if (!hits.length) return null;
    for (const hit of hits) {
      let o = hit.object;
      while (o) {
        const found = picks.find((p) => p.object === o);
        if (found) return found;
        o = o.parent;
      }
    }
    return null;
  }

  function boost(object, on) {
    object.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (!('emissiveIntensity' in mat)) return;
        if (on) {
          if (mat.userData._ei === undefined) mat.userData._ei = mat.emissiveIntensity;
          mat.emissiveIntensity = mat.userData._ei * 1.5 + 0.18;
        } else if (mat.userData._ei !== undefined) {
          mat.emissiveIntensity = mat.userData._ei;
        }
      });
    });
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    pointer.px = e.clientX;
    pointer.py = e.clientY;
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer.inside = true;
    const hit = pick();
    if (hit !== hovered) {
      if (hovered) {
        boost(hovered.object, false);
        hovered.cfg.onHover?.(false, hovered.object);
      }
      hovered = hit;
      if (hovered) {
        boost(hovered.object, true);
        hovered.cfg.onHover?.(true, hovered.object);
      }
      canvas.style.cursor = hovered ? hovered.cfg.cursor || 'pointer' : '';
    }
    if (hovered && hovered.cfg.label) {
      tip.hidden = false;
      tip.textContent = typeof hovered.cfg.label === 'function' ? hovered.cfg.label(hovered.object) : hovered.cfg.label;
      tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    } else tip.hidden = true;
  }
  let downAt = null;
  const onDown = (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // a drag, not a click
    onMove(e);
    if (hovered) hovered.cfg.onClick?.(hovered.object, e);
  };
  const onLeave = () => {
    pointer.inside = false;
    if (hovered) {
      boost(hovered.object, false);
      hovered.cfg.onHover?.(false, hovered.object);
      hovered = null;
    }
    tip.hidden = true;
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  /* frame loop with adaptive resolution */
  let slow = 0;
  let fast = 0;
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    if (dt > 0.034) slow += 1;
    else slow = Math.max(0, slow - 1);
    if (dt < 0.02) fast += 1;
    else fast = 0;
    if (slow > 45 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      size();
      slow = 0;
    }

    if (fly) {
      fly.k = Math.min(1, fly.k + dt / fly.dur);
      const e = ease.inOutCubic(fly.k);
      basePos.lerpVectors(fly.fromPos, fly.toPos, e);
      baseLook.lerpVectors(fly.fromLook, fly.toLook, e);
      if (fly.k >= 1) fly = null;
    }

    if (controls) controls.update();
    else {
      const px = reduceMotion ? 0 : pointer.x * cfg.parallax;
      const py = reduceMotion ? 0 : pointer.y * cfg.parallax * 0.5;
      camera.position.x += (basePos.x + px - camera.position.x) * Math.min(1, dt * 3);
      camera.position.y += (basePos.y + py - camera.position.y) * Math.min(1, dt * 3);
      camera.position.z += (basePos.z - camera.position.z) * Math.min(1, dt * 3);
      look.lerp(baseLook, Math.min(1, dt * 4));
      camera.lookAt(look);
    }

    frameFns.forEach((fn) => fn(dt, t));
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const stage = {
    ok: true,
    THREE,
    renderer,
    scene,
    camera,
    canvas,
    clock,
    pointer,
    motion: reduceMotion ? 0.25 : 1,

    onFrame(fn) {
      frameFns.add(fn);
      return () => frameFns.delete(fn);
    },

    /** make an object hoverable/clickable. cfg: { onClick, onHover, label, cursor } */
    interactive(object, cfgIn = {}) {
      picks.push({ object, cfg: cfgIn });
      return () => {
        const i = picks.findIndex((p) => p.object === object);
        if (i >= 0) picks.splice(i, 1);
      };
    },

    clearInteractive() {
      picks.length = 0;
      hovered = null;
      tip.hidden = true;
    },

    flyTo(pos, lookAt, seconds = 1.4) {
      fly = {
        k: 0,
        dur: Math.max(0.05, seconds),
        fromPos: basePos.clone(),
        toPos: new THREE.Vector3(...pos),
        fromLook: baseLook.clone(),
        toLook: new THREE.Vector3(...lookAt),
      };
    },

    /** switch from parallax camera to orbit controls (e.g. globe, tower inspector) */
    orbit({ target = [0, 0, 0], min = 4, max = 40, autoRotate = false, speed = 0.6, maxPolar = Math.PI * 0.95 } = {}) {
      controls = new OrbitControls(camera, canvas);
      controls.target.set(...target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = min;
      controls.maxDistance = max;
      controls.maxPolarAngle = maxPolar;
      controls.autoRotate = autoRotate && !reduceMotion;
      controls.autoRotateSpeed = speed;
      controls.enablePan = false;
      return controls;
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      controls?.dispose();
      tip.remove();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
          m.dispose();
        });
      });
      renderer.dispose();
      canvas.remove();
    },
  };

  void fast;
  return stage;
}

/* ───────────────────────── materials + textures ───────────────────────── */

/** Accent material for the paper city. Call sites still pass the old night intensities;
   they are clamped to a matte finish so nothing glows on a daylight maquette. */
export function glowMat(color, intensity = 0.8, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: Math.min(0.3, Math.max(0, intensity) * 0.14),
    roughness: 0.62,
    metalness: 0.04,
    ...extra,
  });
}

export function glassMat(color = MODEL.glass, opacity = 0.5) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.2,
    roughness: 0.22,
    transparent: true,
    opacity,
    clearcoat: 0.6,
    emissive: color,
    emissiveIntensity: 0.06,
  });
}

export function windowTexture(color = '#a9a29a', seed = 1) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e4da';
  g.fillRect(0, 0, 256, 512);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 16; y < 500; y += 40) {
    for (let x = 14; x < 244; x += 36) {
      const lit = rnd() > 0.34;
      g.fillStyle = lit ? color : '#c9c3b6';
      g.globalAlpha = lit ? 0.55 + rnd() * 0.35 : 0.9;
      g.fillRect(x, y, 20, 24);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** canvas-drawn panel in 3D (stats, tickers, screens). draw(ctx, w, h) is called on redraw(). */
export function canvasPanel({ width = 1024, height = 512, world = [6, 3], draw, transparent = true }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(world[0], world[1]),
    new THREE.MeshBasicMaterial({ map: texture, transparent, toneMapped: false, side: THREE.DoubleSide }),
  );
  const redraw = (fn) => {
    ctx.clearRect(0, 0, width, height);
    (fn || draw)?.(ctx, width, height);
    texture.needsUpdate = true;
  };
  redraw();
  return { mesh, canvas, ctx, texture, redraw };
}

export function labelSprite(text, { color = '#121212', bg = 'rgba(244,242,237,0.94)', size = 1.2, font = '500 44px Archivo, ui-sans-serif, system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 56;
  c.width = w;
  c.height = 88;
  g.font = font;
  g.fillStyle = bg;
  const r = 26;
  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(w, 0, w, 88, r);
  g.arcTo(w, 88, 0, 88, r);
  g.arcTo(0, 88, 0, 0, r);
  g.arcTo(0, 0, w, 0, r);
  g.fill();
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(text, 28, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set((w / 88) * size, size, 1);
  return sp;
}

/* ───────────────────────── procedural scenery ───────────────────────── */

export function skyDome(stage, top = MODEL.skyTop, bottom = MODEL.skyLow) {
  if (!stage.ok) return null;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), mat);
  stage.scene.add(dome);
  return dome;
}

export function groundGrid(stage, { size = 160, divisions = 80, color = PALETTE.ink, y = 0, opacity = 0.09 } = {}) {
  if (!stage.ok) return null;
  const grid = new THREE.GridHelper(size, divisions, color, color);
  grid.position.y = y;
  grid.material.transparent = true;
  grid.material.opacity = opacity;
  stage.scene.add(grid);
  return grid;
}

export function floor(stage, { size = 120, color = MODEL.ground, y = 0 } = {}) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size, 64),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  stage.scene.add(m);
  return m;
}

export function particles(stage, { count = 400, color = MODEL.dust, area = [60, 30, 60], size = 0.16, opacity = 0.4, drift = 0.15 } = {}) {
  if (!stage.ok) return null;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * area[0];
    pos[i * 3 + 1] = Math.random() * area[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * area[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true }),
  );
  stage.scene.add(pts);
  stage.onFrame((dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i += 1) {
      let y = p.getY(i) + dt * drift * stage.motion;
      if (y > area[1]) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return pts;
}

/** a glowing tower: used for stats, stocks, houses-as-skyscrapers… */
export function tower({ w = 2, h = 6, d = 2, color = PALETTE.bank, seed = 1, glow = 0.8 } = {}) {
  const g = new THREE.Group();
  const tex = windowTexture('#' + new THREE.Color(color).getHexString(), seed);
  tex.repeat.set(Math.max(1, Math.round(w / 1.2)), Math.max(1, Math.round(h / 2.2)));
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: MODEL.body,
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(color),
      emissiveIntensity: Math.min(0.25, glow * 0.14),
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  body.position.y = h / 2;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.14, d * 1.04), glowMat(color, 1.1));
  cap.position.y = h + 0.07;
  g.add(cap);
  g.userData.body = body;
  g.userData.cap = cap;
  return g;
}

export function streetLight(color = 0xd8b477) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: MODEL.steel, roughness: 0.55, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), metal);
  pole.position.y = 2.3;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), glowMat(color, 2));
  lamp.position.set(0, 4.7, 0);
  g.add(pole, lamp);
  return g;
}

/* ───────────────────────── model loading ───────────────────────── */

let gltfLoader = null;
const gltfCache = new Map();

function loader() {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(ASSETS.draco);
    gltfLoader.setDRACOLoader(draco);
  }
  return gltfLoader;
}

/** cached GLB loader. Resolves to the gltf, or null if the file is missing (scenes degrade gracefully). */
export function loadGLB(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(
      url,
      new Promise((resolve) => {
        loader().load(
          url,
          (gltf) => resolve(gltf),
          undefined,
          (err) => {
            console.warn('[city-3d] could not load', url, err?.message || err);
            resolve(null);
          },
        );
      }),
    );
  }
  return gltfCache.get(url);
}

/** the shared skyline (your city.glb), normalised and parked behind the scene */
export async function loadSkyline(stage, { span = 150, z = -70, y = -0.1, tint = 0.55 } = {}) {
  if (!stage.ok) return null;
  const gltf = await loadGLB(ASSETS.skyline);
  if (!gltf) return null;
  const root = SkeletonUtils.clone(gltf.scene);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const k = span / Math.max(size.x, size.z, 0.001);
  root.scale.setScalar(k);
  root.position.set(-center.x * k, -box.min.y * k + y, -center.z * k + z);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      const c = m.clone();
      if (c.color) c.color.multiplyScalar(tint);
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  stage.scene.add(root);
  return root;
}

/** the city's robot (RobotExpressive) as a citizen/NPC. clips: Idle Walking Running Wave Dance ThumbsUp Yes No Sitting … */
export async function loadRobot(stage, { position = [0, 0, 0], rotationY = 0, scale = 1, clip = 'Idle', tint = null } = {}) {
  if (!stage.ok) return null;
  const gltf = await loadGLB(ASSETS.robot);
  if (!gltf) return null;
  const root = SkeletonUtils.clone(gltf.scene);
  root.position.set(...position);
  root.rotation.y = rotationY;
  root.scale.setScalar(scale);
  if (tint) {
    root.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        if (o.material.emissive) {
          o.material.emissive = new THREE.Color(tint);
          o.material.emissiveIntensity = 0.18;
        }
      }
    });
  }
  stage.scene.add(root);

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  gltf.animations.forEach((a) => {
    actions[a.name] = mixer.clipAction(a);
  });
  let current = null;
  const api = {
    root,
    mixer,
    clips: Object.keys(actions),
    play(name, { once = false, fade = 0.3 } = {}) {
      const next = actions[name];
      if (!next || next === current) return;
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      next.fadeIn(fade).play();
      if (current) current.fadeOut(fade);
      current = next;
      if (once) {
        const done = (e) => {
          if (e.action === next) {
            mixer.removeEventListener('finished', done);
            api.play('Idle');
          }
        };
        mixer.addEventListener('finished', done);
      }
    },
  };
  stage.onFrame((dt) => mixer.update(dt));
  api.play(actions[clip] ? clip : 'Idle');
  return api;
}

export async function loadFox(stage, { position = [0, 0, 0], rotationY = 0, scale = 0.02, clip = 'Survey' } = {}) {
  if (!stage.ok) return null;
  const gltf = await loadGLB(ASSETS.fox);
  if (!gltf) return null;
  const root = SkeletonUtils.clone(gltf.scene);
  root.position.set(...position);
  root.rotation.y = rotationY;
  root.scale.setScalar(scale);
  stage.scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const names = gltf.animations.map((a) => a.name);
  const pick = gltf.animations.find((a) => a.name === clip) || gltf.animations[0];
  if (pick) mixer.clipAction(pick).play();
  stage.onFrame((dt) => mixer.update(dt));
  return { root, mixer, clips: names };
}

/* ───────────────────────── tiny helpers for scenes ───────────────────────── */

export function lerp(a, b, k) {
  return a + (b - a) * k;
}

export function hex(n) {
  return '#' + new THREE.Color(n).getHexString();
}

/** animate a number toward a target each frame; returns a getter */
export function smooth(stage, initial = 0, speed = 3) {
  let v = initial;
  let target = initial;
  stage.onFrame((dt) => {
    v += (target - v) * Math.min(1, dt * speed);
  });
  return {
    set: (t) => {
      target = t;
    },
    get: () => v,
  };
}
