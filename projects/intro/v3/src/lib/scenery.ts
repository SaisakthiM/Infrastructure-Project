import * as THREE from "three";

/*
  The maquette palette for the home page's 3D world. These are the same numbers as
  PALETTE / MODEL in projects/city-core/city-3d.js (they cannot be imported here: the city
  core is served as static files, this is a bundled Vite app). Change one, change the other.

  The world is a daylight architectural model, not a night render: pale matte bodies,
  ink hairlines, one muted accent per ward, no neon.
*/
export const MAQUETTE = {
  paper: 0xf4f2ed,
  paperRaised: 0xfbfaf7,
  ink: 0x121212,
  ground: 0xedeae1,
  road: 0xdcd6c9,
  kerb: 0xcfc9bb,
  marking: 0x8a857a,
  body: 0xe8e4da,
  bodyAlt: 0xdcd6c9,
  trim: 0xb9b3a5,
  glass: 0xa9a29a,
  steel: 0x8a857a,
  dust: 0xa29a88,
  skyTop: 0xf7f5f0,
  skyLow: 0xe3dfd4,
  accent: 0x0f6e9c,
  moss: 0x4c7c3f,
  warn: 0xa9741b,
  down: 0xa33a2e,
};

/* The signature element, printed: ward code on an ink block, name in the condensed
   grotesque, one accent rule, mono subtitle. Same construction as `.plate` in city.css. */
export function createSignTexture(
  title: string,
  subtitle: string,
  color: string,
  action = "ENTER DISTRICT",
  code = "",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const letterSpacing = (px: string) => {
    // canvas2d tracking, ignored where unsupported
    (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = px;
  };

  context.fillStyle = "#fbfaf7";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // hairline frame, ink on paper
  context.strokeStyle = "rgba(18,18,18,.55)";
  context.lineWidth = 3;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // accent rule across the top, like the panel header in city.css
  context.fillStyle = color;
  context.fillRect(6, 6, canvas.width - 12, 8);

  // ward code plate
  if (code) {
    context.fillStyle = "#121212";
    context.fillRect(44, 62, 132, 54);
    context.fillStyle = "#f4f2ed";
    context.font = "500 30px 'JetBrains Mono', ui-monospace, monospace";
    letterSpacing("2px");
    context.fillText(code, 62, 100);
    letterSpacing("0px");
  }

  const titleX = code ? 196 : 44;
  context.fillStyle = "#121212";
  context.font = "500 66px Archivo, 'Helvetica Neue', ui-sans-serif, system-ui, sans-serif";
  letterSpacing("-2.4px");
  context.fillText(title.toUpperCase(), titleX, 116);
  letterSpacing("0px");

  context.fillStyle = "rgba(18,18,18,.56)";
  context.font = "400 26px 'JetBrains Mono', ui-monospace, monospace";
  letterSpacing("2px");
  context.fillText(subtitle.toUpperCase(), 44, 196);

  context.fillStyle = color;
  context.font = "400 22px 'JetBrains Mono', ui-monospace, monospace";
  letterSpacing("3px");
  context.fillText(action.toUpperCase(), 44, 262);
  letterSpacing("0px");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* Daylight glazing: a pale facade sheet with recessed panes. Only a few panes carry the
   ward accent, so the building reads as a model, not as a block of lit windows at night. */
export function createWindowTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#e8e4da";
  context.fillRect(0, 0, 512, 1024);
  for (let y = 36; y < 1000; y += 82) {
    for (let x = 30; x < 500; x += 75) {
      const tinted = Math.random() > 0.86;
      context.fillStyle = tinted ? color : "#a9a29a";
      context.globalAlpha = tinted ? 0.5 + Math.random() * 0.2 : 0.34 + Math.random() * 0.22;
      context.fillRect(x, y, 42, 48);
      context.globalAlpha = 0.5;
      context.strokeStyle = "#b9b3a5";
      context.lineWidth = 2;
      context.strokeRect(x, y, 42, 48);
    }
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addStreetLight(scene: THREE.Scene, x: number, z: number, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  const metal = new THREE.MeshStandardMaterial({
    color: MAQUETTE.steel,
    roughness: 0.5,
    metalness: 0.3,
  });
  // daytime: the head is a pale fixture, not a lamp
  const head = new THREE.MeshStandardMaterial({
    color: MAQUETTE.paperRaised,
    emissive: MAQUETTE.warn,
    emissiveIntensity: 0.12,
    roughness: 0.7,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 10), metal);
  pole.position.y = 2.9;
  pole.castShadow = true;
  group.add(pole);
  addBox(group, [1.25, 0.08, 0.1], [0.55, 5.72, 0], metal);
  addBox(group, [0.45, 0.12, 0.28], [1.12, 5.61, 0], head);
  scene.add(group);
}

export function addTree(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.25, 2.4, 9),
    new THREE.MeshStandardMaterial({ color: 0x9a8770, roughness: 1 }),
  );
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: MAQUETTE.moss,
    roughness: 0.92,
  });
  [
    [0, 3.3, 0, 1.25],
    [-0.65, 2.85, 0.15, 0.82],
    [0.62, 2.8, -0.2, 0.88],
  ].forEach(([lx, ly, lz, radius]) => {
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      leafMaterial,
    );
    leaves.position.set(lx, ly, lz);
    leaves.castShadow = true;
    group.add(leaves);
  });
  scene.add(group);
}

/* Flat light rig for the maquette — overcast key, pale sky bounce, no sunset. */
export function addDaylight(
  scene: THREE.Scene,
  shadows: { left: number; top: number; mapSize?: number } = { left: 52, top: 52 },
) {
  const sky = new THREE.HemisphereLight(0xf2efe8, 0xc9c3b6, 1.15);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff6e4, 1.7);
  sun.position.set(-32, 55, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadows.mapSize ?? 2048, shadows.mapSize ?? 2048);
  sun.shadow.camera.left = -shadows.left;
  sun.shadow.camera.right = shadows.left;
  sun.shadow.camera.top = shadows.top;
  sun.shadow.camera.bottom = -shadows.top;
  scene.add(sun);
  return { sky, sun };
}
