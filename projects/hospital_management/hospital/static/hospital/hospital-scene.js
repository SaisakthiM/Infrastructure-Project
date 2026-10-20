// The 3D ward behind every hospital page.
import {
  createStage, THREE, PALETTE, skyDome, groundGrid, floor, particles, glowMat, glassMat,
  canvasPanel, labelSprite, loadRobot, loadSkyline, smooth,
} from '/city-core/city-3d.js';

const stats = JSON.parse(document.getElementById('scene-data')?.textContent || '{}');
const page = document.body.dataset.page || 'dashboard';

const stage = createStage(document.body, {
  camera: { pos: [3, 5.5, 17], look: [4, 3.2, 0] },
  fog: { color: 0x050b16, density: 0.017 },
  parallax: 0.7,
});

if (stage.ok) build();

async function build() {
  const { scene } = stage;
  skyDome(stage, 0x0a1a2e, 0x050b16);
  floor(stage, { size: 90, color: 0x08111c });
  groundGrid(stage, { color: PALETTE.hospital, opacity: 0.2 });
  particles(stage, { count: 260, color: PALETTE.hospital, area: [70, 18, 50], drift: 0.12 });

  const cyan = new THREE.PointLight(PALETTE.hospital, 40, 30);
  cyan.position.set(-6, 6, 4);
  const teal = new THREE.PointLight(0x00f0c8, 30, 26);
  teal.position.set(10, 4, -2);
  scene.add(cyan, teal);

  /* medical pad with a glowing cross, right side of the screen so content stays clear */
  const pad = new THREE.Group();
  pad.position.set(7, 0, 1);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 48), new THREE.MeshStandardMaterial({ color: 0x0d1b2b, roughness: 0.4, metalness: 0.6 }));
  disc.position.y = 0.18;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.06, 12, 64), glowMat(PALETTE.hospital, 2.4));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.38;
  const crossA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), glowMat(0x00f0c8, 1.8));
  const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.4), glowMat(0x00f0c8, 1.8));
  crossA.position.y = crossB.position.y = 0.4;
  pad.add(disc, ring, crossA, crossB);
  scene.add(pad);

  /* DNA helix */
  const helix = new THREE.Group();
  helix.position.set(-10, 0, -7);
  const ball = new THREE.SphereGeometry(0.2, 12, 10);
  const a = glowMat(PALETTE.hospital, 1.6);
  const b = glowMat(0x0ea5e9, 1.6);
  const rungMat = new THREE.MeshBasicMaterial({ color: PALETTE.hospital, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 44; i += 1) {
    const t = i * 0.38;
    const y = i * 0.3;
    const p1 = new THREE.Vector3(Math.cos(t) * 1.8, y, Math.sin(t) * 1.8);
    const p2 = new THREE.Vector3(Math.cos(t + Math.PI) * 1.8, y, Math.sin(t + Math.PI) * 1.8);
    const s1 = new THREE.Mesh(ball, a);
    const s2 = new THREE.Mesh(ball, b);
    s1.position.copy(p1);
    s2.position.copy(p2);
    helix.add(s1, s2);
    if (i % 2 === 0) {
      const len = p1.distanceTo(p2);
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), rungMat);
      rung.position.copy(p1).lerp(p2, 0.5);
      rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      helix.add(rung);
    }
  }
  scene.add(helix);

  /* heart monitor: scrolling ECG ribbon */
  const N = 220;
  const ecgPts = new Float32Array(N * 3);
  const ecgGeo = new THREE.BufferGeometry();
  ecgGeo.setAttribute('position', new THREE.BufferAttribute(ecgPts, 3));
  const ecg = new THREE.Line(ecgGeo, new THREE.LineBasicMaterial({ color: 0x00f0c8 }));
  ecg.position.set(-2, 9.2, -9);
  scene.add(ecg);
  const wave = (x) => {
    const k = x % 1;
    if (k > 0.16 && k < 0.22) return (k - 0.16) * 12; // P-R spike up
    if (k >= 0.22 && k < 0.26) return 0.7 - (k - 0.22) * 40; // down through baseline
    if (k >= 0.26 && k < 0.3) return -0.9 + (k - 0.26) * 40; // back up
    if (k > 0.5 && k < 0.62) return Math.sin(((k - 0.5) / 0.12) * Math.PI) * 0.25; // T wave
    return 0;
  };

  /* stat towers */
  const labels = [
    ['Doctors', stats.doctors ?? 0, PALETTE.hospital, -3],
    ['Patients', stats.patients ?? 0, 0x00f0c8, 0],
    ['Waiting', stats.pending ?? 0, 0xd8b44b, 3],
  ];
  const towers = labels.map(([name, count, color, x]) => {
    const g = new THREE.Group();
    g.position.set(x, 0, -6);
    const target = 1.2 + Math.min(count, 24) * 0.32;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1, 24), glassMat(color, 0.5));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 12), glowMat(color, 2));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 24), glowMat(color, 2.4));
    g.add(body, core, cap);
    const label = labelSprite(`${name} ${count}`, { size: 0.8 });
    g.add(label);
    scene.add(g);
    return { g, body, core, cap, label, target, h: smooth(stage, 0.2, 2.2) };
  });
  towers.forEach((t) => t.h.set(t.target));

  /* robot doctor greets you */
  const robot = await loadRobot(stage, { position: [7, 0.35, 1], rotationY: -0.5, scale: 0.9, clip: 'Idle', tint: PALETTE.hospital });
  if (robot) {
    robot.play('Wave', { once: true });
    stage.interactive(robot.root, {
      label: 'Dr. Robo — click to say hi',
      onClick: () => robot.play(['ThumbsUp', 'Yes', 'Dance'][Math.floor(Math.random() * 3)], { once: true }),
    });
  }
  loadSkyline(stage, { span: 170, z: -85, tint: 0.5 });

  /* page-specific camera: lists/forms push the scene to the right so the panel stays readable */
  if (page !== 'dashboard') stage.flyTo([-1, 5.5, 18], [5, 3, 0], 1.2);

  stage.onFrame((dt, t) => {
    helix.rotation.y = t * 0.4 * stage.motion;
    ring.rotation.z = t * 0.5 * stage.motion;
    for (let i = 0; i < N; i += 1) {
      const x = (i / N) * 8;
      ecgPts[i * 3] = x;
      ecgPts[i * 3 + 1] = wave(x * 0.45 - t * 0.5) * 1.2;
      ecgPts[i * 3 + 2] = 0;
    }
    ecgGeo.attributes.position.needsUpdate = true;
    towers.forEach((tw) => {
      const h = tw.h.get();
      tw.body.scale.y = h;
      tw.body.position.y = h / 2;
      tw.core.scale.y = h * 0.98;
      tw.core.position.y = h / 2;
      tw.cap.position.y = h;
      tw.label.position.y = h + 0.9;
    });
  });
}
