import * as THREE from "three";

export function createSignTexture(
  title: string,
  subtitle: string,
  color: string,
  dark = true,
  action = "ENTER / EXPLORE PROJECT",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.fillStyle = dark ? "#111418" : "#ebe7dc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.lineWidth = 12;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.fillStyle = color;
  context.fillRect(58, 58, 9, 204);
  context.fillStyle = dark ? "#f0ede4" : "#131518";
  context.font = "700 76px Syne, sans-serif";
  context.fillText(title.toUpperCase(), 104, 145);
  context.fillStyle = dark ? "#969ba1" : "#5a5d60";
  context.font = "500 28px 'DM Mono', monospace";
  context.fillText(subtitle.toUpperCase(), 107, 211);
  context.fillStyle = color;
  context.font = "500 21px 'DM Mono', monospace";
  context.fillText(action, 107, 262);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createWindowTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#11151a";
  context.fillRect(0, 0, 512, 1024);
  for (let y = 36; y < 1000; y += 82) {
    for (let x = 30; x < 500; x += 75) {
      const lit = Math.random() > 0.31;
      context.fillStyle = lit ? color : "#222a30";
      context.globalAlpha = lit ? 0.72 + Math.random() * 0.28 : 0.55;
      context.fillRect(x, y, 42, 48);
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
    color: 0x292d31,
    roughness: 0.36,
    metalness: 0.82,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffe4b0,
    emissive: 0xffb75e,
    emissiveIntensity: 5,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 10), metal);
  pole.position.y = 2.9;
  pole.castShadow = true;
  group.add(pole);
  addBox(group, [1.25, 0.08, 0.1], [0.55, 5.72, 0], metal);
  addBox(group, [0.45, 0.12, 0.28], [1.12, 5.61, 0], glow);
  scene.add(group);
}

export function addTree(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.25, 2.4, 9),
    new THREE.MeshStandardMaterial({ color: 0x55463a, roughness: 1 }),
  );
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x294a3f,
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
