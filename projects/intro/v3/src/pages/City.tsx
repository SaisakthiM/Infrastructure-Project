import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { projects, type Project } from "../data/projects";
import { Link } from "../lib/router";
import {
  addBox,
  addDaylight,
  addStreetLight,
  addTree,
  createSignTexture,
  createWindowTexture,
  MAQUETTE,
} from "../lib/scenery";

function addLitWindowGrid(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  color: string,
  rows = 5,
  columns = 6,
) {
  // daytime glazing: neutral glass carrying a cast of the ward accent
  const pane = new THREE.Color(color).lerp(new THREE.Color(MAQUETTE.glass), 0.72);
  const litMaterial = new THREE.MeshStandardMaterial({
    color: pane,
    roughness: 0.42,
    metalness: 0.08,
  });
  const dimMaterial = new THREE.MeshStandardMaterial({
    color: MAQUETTE.bodyAlt,
    roughness: 0.85,
  });
  const windowWidth = Math.min(0.82, (width - 2) / columns * 0.56);
  const windowHeight = Math.min(0.58, (height - 2.5) / rows * 0.5);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = -width * 0.38 + (column / Math.max(1, columns - 1)) * width * 0.76;
      const y = 2.55 + (row / Math.max(1, rows - 1)) * (height - 4);
      const lit = (row * 7 + column * 3 + columns) % 5 !== 0;
      addBox(
        group,
        [windowWidth, windowHeight, 0.08],
        [x, y, depth / 2 + 0.055],
        lit ? litMaterial : dimMaterial,
        false,
      );
      addBox(
        group,
        [windowWidth, windowHeight, 0.08],
        [-x, y, -depth / 2 - 0.055],
        (row + column) % 4 !== 0 ? litMaterial : dimMaterial,
        false,
      );
    }
  }

  const sideColumns = Math.max(3, Math.round(columns * depth / width));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < sideColumns; column += 1) {
      const z = -depth * 0.34 + (column / Math.max(1, sideColumns - 1)) * depth * 0.68;
      const y = 2.55 + (row / Math.max(1, rows - 1)) * (height - 4);
      const rightWindow = addBox(
        group,
        [windowWidth, windowHeight, 0.08],
        [width / 2 + 0.055, y, z],
        (row * 3 + column) % 5 !== 0 ? litMaterial : dimMaterial,
        false,
      );
      rightWindow.rotation.y = Math.PI / 2;
      const leftWindow = addBox(
        group,
        [windowWidth, windowHeight, 0.08],
        [-width / 2 - 0.055, y, -z],
        (row + column * 2) % 4 !== 0 ? litMaterial : dimMaterial,
        false,
      );
      leftWindow.rotation.y = Math.PI / 2;
    }
  }
}

function addBackgroundBuilding(
  scene: THREE.Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  texture: THREE.Texture,
  seed: number,
) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const facade = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.1 + (seed % 4) * 0.006, 0.1, 0.8 + (seed % 3) * 0.02),
    roughness: 0.82,
    metalness: 0.03,
  });
  const windows = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.05,
  });
  addBox(group, [width, height, depth], [0, height / 2, 0], facade);

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.82, height * 0.88),
    windows,
  );
  front.position.set(0, height * 0.51, depth / 2 + 0.012);
  group.add(front);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.82, height * 0.88),
    windows.clone(),
  );
  back.rotation.y = Math.PI;
  back.position.set(0, height * 0.51, -depth / 2 - 0.012);
  group.add(back);

  const rightSide = new THREE.Mesh(
    new THREE.PlaneGeometry(depth * 0.78, height * 0.88),
    windows.clone(),
  );
  rightSide.rotation.y = Math.PI / 2;
  rightSide.position.set(width / 2 + 0.012, height * 0.51, 0);
  group.add(rightSide);

  const leftSide = new THREE.Mesh(
    new THREE.PlaneGeometry(depth * 0.78, height * 0.88),
    windows.clone(),
  );
  leftSide.rotation.y = -Math.PI / 2;
  leftSide.position.set(-width / 2 - 0.012, height * 0.51, 0);
  group.add(leftSide);

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: MAQUETTE.trim,
    roughness: 0.72,
    metalness: 0.2,
  });
  addBox(group, [width * 0.42, 0.6, depth * 0.42], [0, height + 0.3, 0], roofMaterial);
  if (seed % 2 === 0) {
    addBox(group, [0.08, 2.8, 0.08], [0, height + 1.7, 0], roofMaterial);
  }
  scene.add(group);
}

function createProjectBuilding(project: Project, index: number) {
  const group = new THREE.Group();
  group.position.set(project.position[0], 0, project.position[1]);
  group.rotation.y = Math.atan2(project.facing[0], project.facing[1]);
  const styleIndex = index % 4;
  const accent = new THREE.Color(project.color);
  const concrete = new THREE.MeshStandardMaterial({
    color: index % 2 ? MAQUETTE.bodyAlt : MAQUETTE.body,
    roughness: 0.85,
    metalness: 0.02,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: MAQUETTE.trim,
    roughness: 0.5,
    metalness: 0.24,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: accent.clone().lerp(new THREE.Color(MAQUETTE.glass), 0.45),
    roughness: 0.34,
    metalness: 0.06,
    transparent: true,
    opacity: 0.9,
    emissive: accent,
    emissiveIntensity: 0.05,
  });
  // the ward colour stays as matte signage, not as a lamp
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.18,
    roughness: 0.55,
    metalness: 0.05,
  });

  let buildingWidth = 13;
  let buildingHeight = 10;
  let buildingDepth = 11;

  if (styleIndex === 0) {
    addBox(group, [13, 10, 11], [0, 5, 0], concrete);
    addBox(group, [9.8, 7.3, 0.4], [0, 5.2, 5.7], glass);
    addBox(group, [11, 0.38, 2.1], [0, 8.8, 6.15], darkMetal);
    for (let x = -5.1; x <= 5.1; x += 2.55) {
      addBox(group, [0.18, 7.6, 0.55], [x, 5.1, 5.98], darkMetal);
    }
    for (let y = 2.6; y <= 7.8; y += 1.7) {
      addBox(group, [9.4, 0.09, 0.08], [0, y, 5.95], glow, false);
    }
    addBox(group, [3.7, 3.25, 0.35], [0, 1.63, 6.03], darkMetal);
  } else if (styleIndex === 1) {
    buildingWidth = 12.5;
    buildingHeight = 12.5;
    buildingDepth = 10.5;
    addBox(group, [12.5, 12.5, 10.5], [0, 6.25, 0], concrete);
    addBox(group, [8.4, 9.8, 0.5], [0, 6.4, 5.48], glass);
    for (let x = -5.15; x <= 5.15; x += 2.05) {
      addBox(group, [0.34, 10.8, 0.75], [x, 6.6, 5.72], darkMetal);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.1, 10, 80),
      glow,
    );
    ring.position.set(0, 7.1, 5.91);
    group.add(ring);
    addBox(group, [3.8, 3.1, 0.4], [0, 1.55, 5.85], darkMetal);
  } else if (styleIndex === 2) {
    buildingWidth = 14;
    buildingHeight = 8.5;
    buildingDepth = 11.5;
    addBox(group, [14, 8.5, 11.5], [0, 4.25, 0], concrete);
    addBox(group, [15.2, 1.1, 12.7], [0, 8.65, 0], darkMetal);
    for (let x = -5.3; x <= 5.3; x += 2.65) {
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.48, 7.3, 18),
        concrete,
      );
      column.position.set(x, 4.45, 6.25);
      column.castShadow = true;
      group.add(column);
    }
    addBox(group, [11.5, 4.6, 0.35], [0, 4.55, 5.85], glass);
    addBox(group, [3.7, 3.15, 0.4], [0, 1.58, 6.14], darkMetal);
  } else {
    buildingWidth = 13.5;
    buildingHeight = 10.8;
    buildingDepth = 11.5;
    addBox(group, [13.5, 10.8, 11.5], [0, 5.4, 0], concrete);
    for (let x = -5.2; x <= 5.2; x += 2.1) {
      addBox(group, [1.25, 8.8, 0.42], [x, 5.7, 5.96], glass);
      addBox(group, [0.17, 10.5, 0.7], [x + 0.72, 5.8, 6.08], darkMetal);
    }
    addBox(group, [3.7, 3.25, 0.35], [0, 1.63, 6.22], darkMetal);
    for (let x = -5; x <= 5; x += 2.5) {
      addBox(group, [1.7, 0.65, 2.3], [x, 11.1, 0], darkMetal);
    }
  }

  addLitWindowGrid(
    group,
    buildingWidth,
    buildingHeight,
    buildingDepth,
    project.color,
    Math.max(4, Math.round(buildingHeight / 2)),
    Math.max(5, Math.round(buildingWidth / 2)),
  );

  const signTexture = createSignTexture(
    project.name,
    project.district,
    project.color,
    "OPEN " + project.link,
    project.code,
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.8, 2.44),
    new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }),
  );
  sign.position.set(
    0,
    styleIndex === 2 ? 10.3 : styleIndex === 1 ? 12.9 : 11.1,
    buildingDepth / 2 + 0.68,
  );
  group.add(sign);
  group.userData.signTexture = signTexture;

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.055, 48),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.45,
    }),
  );
  marker.position.set(0, 0.08, buildingDepth / 2 + 2.5);
  group.add(marker);
  return group;
}

function CityScene({
  onNear,
  onOpen,
  onLockChange,
}: {
  onNear: (index: number | null) => void;
  onOpen: (index: number) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<number | null>(null);
  const callbacks = useRef({ onNear, onOpen, onLockChange });
  callbacks.current = { onNear, onOpen, onLockChange };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MAQUETTE.paper);
    scene.fog = new THREE.Fog(MAQUETTE.skyLow, 46, 168);

    const camera = new THREE.PerspectiveCamera(
      66,
      mount.clientWidth / mount.clientHeight,
      0.08,
      190,
    );
    camera.position.set(0, 1.72, 10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.object);
    controls.addEventListener("lock", () => callbacks.current.onLockChange(true));
    controls.addEventListener("unlock", () =>
      callbacks.current.onLockChange(false),
    );

    addDaylight(scene);
    const fill = new THREE.DirectionalLight(0xdfe7ea, 0.35);
    fill.position.set(45, 18, -52);
    scene.add(fill);

    const asphalt = new THREE.MeshStandardMaterial({
      color: MAQUETTE.road,
      roughness: 0.96,
      metalness: 0.02,
    });
    const concrete = new THREE.MeshStandardMaterial({
      color: MAQUETTE.kerb,
      roughness: 0.92,
    });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: MAQUETTE.marking });
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: MAQUETTE.ground,
      roughness: 0.88,
      metalness: 0.02,
    });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 280),
      new THREE.MeshStandardMaterial({ color: MAQUETTE.ground, roughness: 1 }),
    );
    ground.position.set(0, 0, -30);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    addBox(scene, [18, 0.12, 240], [0, 0.06, -30], asphalt, false);
    addBox(scene, [160, 0.12, 18], [0, 0.061, 0], asphalt, false);
    addBox(scene, [25, 0.16, 25], [0, 0.09, 0], plazaMaterial, false);

    [-6, -30, -50, -70, -90, -110].forEach((z) => {
      addBox(scene, [82, 0.125, 9], [0, 0.066, z], asphalt, false);
      addBox(scene, [82, 0.22, 3.2], [0, 0.115, z - 6.1], concrete, false);
      addBox(scene, [82, 0.22, 3.2], [0, 0.116, z + 6.1], concrete, false);
      for (let x = -35; x <= 35; x += 9) {
        addBox(scene, [4.5, 0.016, 0.14], [x, 0.142, z], lineMaterial, false);
      }
    });

    [-11.5, 11.5].forEach((x) => {
      addBox(scene, [5, 0.22, 240], [x, 0.11, -30], concrete, false);
    });
    [-11.5, 11.5].forEach((z) => {
      addBox(scene, [160, 0.22, 5], [0, 0.115, z], concrete, false);
    });

    for (let z = -140; z <= 72; z += 9) {
      addBox(scene, [0.16, 0.016, 4.6], [0, 0.135, z], lineMaterial, false);
    }
    for (let x = -72; x <= 72; x += 9) {
      addBox(scene, [4.6, 0.016, 0.16], [x, 0.136, 0], lineMaterial, false);
    }
    [-8.45, 8.45].forEach((x) =>
      addBox(scene, [0.12, 0.018, 240], [x, 0.14, -30], lineMaterial, false),
    );
    [-8.45, 8.45].forEach((z) =>
      addBox(scene, [160, 0.018, 0.12], [0, 0.141, z], lineMaterial, false),
    );

    for (let i = -4; i <= 4; i += 1) {
      addBox(scene, [0.72, 0.025, 4.2], [i * 1.35, 0.15, 14.4], lineMaterial, false);
      addBox(scene, [0.72, 0.025, 4.2], [i * 1.35, 0.15, -14.4], lineMaterial, false);
      addBox(scene, [4.2, 0.025, 0.72], [14.4, 0.15, i * 1.35], lineMaterial, false);
      addBox(scene, [4.2, 0.025, 0.72], [-14.4, 0.15, i * 1.35], lineMaterial, false);
    }

    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.25, 4.55, 0.55, 64),
      new THREE.MeshStandardMaterial({
        color: MAQUETTE.kerb,
        roughness: 0.7,
        metalness: 0.1,
      }),
    );
    fountainBase.position.y = 0.35;
    fountainBase.receiveShadow = true;
    scene.add(fountainBase);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(3.75, 3.75, 0.06, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xa8c0c9,
        roughness: 0.16,
        metalness: 0.06,
        transmission: 0.2,
        transparent: true,
        opacity: 0.72,
      }),
    );
    water.position.y = 0.66;
    scene.add(water);
    const sculptureMaterial = new THREE.MeshStandardMaterial({
      color: MAQUETTE.accent,
      emissive: MAQUETTE.accent,
      emissiveIntensity: 0.2,
      roughness: 0.45,
      metalness: 0.15,
    });
    const sculpture = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.35, 0.18, 140, 16),
      sculptureMaterial,
    );
    sculpture.position.y = 2.45;
    sculpture.castShadow = true;
    scene.add(sculpture);

    const projectGroups = projects.map((project, index) => {
      const building = createProjectBuilding(project, index);
      scene.add(building);
      return building;
    });

    const windowTexture = createWindowTexture("#3d4e66");
    const backgroundLayouts = [
      [-54, -46, 15, 14, 29],
      [53, -47, 17, 15, 36],
      [-54, -23, 15, 13, 19],
      [53, -24, 17, 14, 24],
      [-52, 21, 16, 15, 34],
      [52, 22, 16, 15, 28],
      [-47, 49, 17, 14, 25],
      [-26, 51, 14, 15, 33],
      [27, 52, 14, 16, 22],
      [49, 49, 17, 14, 31],
      [-70, -8, 16, 15, 29],
      [70, 8, 17, 15, 38],
      [-51, -73, 16, 15, 24],
      [51, -73, 17, 15, 30],
      [-25, -88, 15, 14, 27],
      [27, -89, 16, 15, 34],
      [8, 70, 15, 17, 34],
    ] as const;
    backgroundLayouts.forEach(([x, z, width, depth, height], index) =>
      addBackgroundBuilding(
        scene,
        x,
        z,
        width,
        depth,
        height,
        windowTexture,
        index,
      ),
    );

    for (let distance = -62; distance <= 62; distance += 15.5) {
      addStreetLight(scene, -8.9, distance, 0);
      addStreetLight(scene, 8.9, distance, Math.PI);
      if (Math.abs(distance) > 15) {
        addStreetLight(scene, distance, -8.9, Math.PI / 2);
        addStreetLight(scene, distance, 8.9, -Math.PI / 2);
      }
    }

    const treePositions = [
      [-15, -14],
      [15, -14],
      [-15, 14],
      [15, 14],
      [-38, -11.5],
      [38, -11.5],
      [-38, 11.5],
      [38, 11.5],
      [-11.5, -38],
      [11.5, -38],
      [-11.5, 38],
      [11.5, 38],
    ];
    treePositions.forEach(([x, z], index) => addTree(scene, x, z, 0.8 + (index % 3) * 0.08));

    const starGeometry = new THREE.BufferGeometry();
    const starData = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i += 1) {
      const radius = 80 + Math.random() * 65;
      const angle = Math.random() * Math.PI * 2;
      starData[i * 3] = Math.cos(angle) * radius;
      starData[i * 3 + 1] = 4 + Math.random() * 38;
      starData[i * 3 + 2] = Math.sin(angle) * radius;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starData, 3));
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: MAQUETTE.dust, size: 0.12, opacity: 0.38, transparent: true }),
      ),
    );

    const keys = { forward: false, backward: false, left: false, right: false, sprint: false };
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW" || event.code === "ArrowUp") keys.forward = true;
      if (event.code === "KeyS" || event.code === "ArrowDown") keys.backward = true;
      if (event.code === "KeyA" || event.code === "ArrowLeft") keys.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") keys.right = true;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.sprint = true;
      if (event.code === "KeyE" && nearRef.current !== null) {
        controls.unlock();
        callbacks.current.onOpen(nearRef.current);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW" || event.code === "ArrowUp") keys.forward = false;
      if (event.code === "KeyS" || event.code === "ArrowDown") keys.backward = false;
      if (event.code === "KeyA" || event.code === "ArrowLeft") keys.left = false;
      if (event.code === "KeyD" || event.code === "ArrowRight") keys.right = false;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.sprint = false;
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    const lockCity = () => controls.lock();
    const teleport = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      const project = projects[index];
      camera.position.set(
        project.position[0] + project.facing[0] * 10.5,
        1.72,
        project.position[1] + project.facing[1] * 10.5,
      );
      camera.lookAt(project.position[0], 3.2, project.position[1]);
      controls.lock();
    };
    window.addEventListener("city:lock", lockCity);
    window.addEventListener("city:teleport", teleport);

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.06);
      const elapsed = clock.elapsedTime;

      sculpture.rotation.y = elapsed * 0.18;
      sculpture.position.y = 2.45 + Math.sin(elapsed * 1.2) * 0.08;
      projectGroups.forEach((group, index) => {
        const marker = group.children[group.children.length - 1];
        marker.scale.setScalar(1 + Math.sin(elapsed * 2 + index) * 0.12);
      });

      if (controls.isLocked) {
        velocity.x -= velocity.x * 8 * delta;
        velocity.z -= velocity.z * 8 * delta;
        direction.z = Number(keys.forward) - Number(keys.backward);
        direction.x = Number(keys.right) - Number(keys.left);
        direction.normalize();
        const speed = keys.sprint ? 62 : 38;
        if (keys.forward || keys.backward) velocity.z -= direction.z * speed * delta;
        if (keys.left || keys.right) velocity.x -= direction.x * speed * delta;

        const oldPosition = camera.position.clone();
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y = 1.72;
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -78, 78);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -135, 78);

        const blocked = projects.some(
          (project) =>
            Math.hypot(
              camera.position.x - project.position[0],
              camera.position.z - project.position[1],
            ) < 7.3,
        );
        if (blocked) camera.position.copy(oldPosition);
      }

      let nearest: number | null = null;
      let nearestDistance = 8.7;
      projects.forEach((project, index) => {
        const entrance = new THREE.Vector3(
          project.position[0] + project.facing[0] * 8.4,
          1.72,
          project.position[1] + project.facing[1] * 8.4,
        );
        const distance = camera.position.distanceTo(entrance);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      if (nearRef.current !== nearest) {
        nearRef.current = nearest;
        callbacks.current.onNear(nearest);
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      if (controls.isLocked) controls.unlock();
      controls.disconnect();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      window.removeEventListener("city:lock", lockCity);
      window.removeEventListener("city:teleport", teleport);
      projectGroups.forEach((group) => (group.userData.signTexture as THREE.Texture).dispose());
      windowTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="city-canvas" ref={mountRef} />;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export default function City() {
  const [near, setNear] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const enterCity = () => window.dispatchEvent(new Event("city:lock"));
  const teleport = (index: number) => {
    setMapOpen(false);
    window.dispatchEvent(new CustomEvent("city:teleport", { detail: index }));
  };

  return (
    <main className="city-shell">
      <CityScene onNear={setNear} onOpen={setSelected} onLockChange={setLocked} />
      <div className="vignette" />

      <header className="city-header">
        <div className="city-brand">
          <span className="brand-mark">SM</span>
          <span>
            Mini City
            <small>Interactive systems registry</small>
          </span>
        </div>
        <div className="city-status">
          <span />
          {projects.length} wards · one bank
        </div>
        <nav>
          <Link to="/">Home</Link>
          <button onClick={() => setMapOpen(true)}>City map</button>
          <a href="mailto:saisakthicloud@gmail.com">Contact</a>
        </nav>
      </header>

      {!locked && selected === null && !mapOpen && (
        <section className="welcome-card">
          <p className="kicker">Twelve wards, one currency</p>
          <h1>
            Systems you can
            <br />
            <em>walk through.</em>
          </h1>
          <p>
            Every landmark is a live system: the bank that holds your balance, the
            wards you work in, the shops, studios and services you spend it at.
            Walk the streets, or arrive at any door from the registry.
          </p>
          <button className="enter-button" onClick={enterCity}>
            Enter the city <ArrowIcon />
          </button>
          <div className="control-row">
            <span><b>WASD</b> move</span>
            <span><b>Mouse</b> look</span>
            <span><b>Shift</b> sprint</span>
            <span><b>E</b> enter</span>
          </div>
        </section>
      )}

      {locked && (
        <>
          <div className="crosshair"><span /></div>
          <div className="walk-hud">
            <div className="compass">N <span>•</span> MINI CITY</div>
            <div className="walk-controls">WASD move · Shift sprint · ESC release mouse</div>
          </div>
        </>
      )}

      {near !== null && locked && (
        <button
          className="enter-prompt"
          onClick={() => setSelected(near)}
          style={{ "--project-color": projects[near].color } as React.CSSProperties}
        >
          <span className="key">E</span>
          <span>
            Enter {projects[near].name}
            <small>{projects[near].district}</small>
          </span>
        </button>
      )}

      <aside className="district-list">
        <p>City registry</p>
        {projects.map((project, index) => (
          <button key={project.name} onClick={() => teleport(index)}>
            <span style={{ backgroundColor: project.color }} />
            <b>{project.code}</b>
            {project.name}
          </button>
        ))}
      </aside>

      {mapOpen && (
        <section className="map-overlay" role="dialog" aria-modal="true">
          <button className="close-button" onClick={() => setMapOpen(false)}>
            Close <span>×</span>
          </button>
          <div className="map-copy">
            <p className="kicker">Fast travel</p>
            <h2>City registry</h2>
            <p>Select a ward to arrive outside its entrance.</p>
          </div>
          <div className="map-grid">
            <div className="map-road vertical" />
            <div className="map-road horizontal" />
            <div className="map-center">Central<br />Plaza</div>
            {projects.map((project, index) => (
              <button
                key={project.name}
                className={`map-project map-project-${index}`}
                onClick={() => teleport(index)}
                style={{ "--project-color": project.color } as React.CSSProperties}
              >
                <span>{project.code}</span>
                <b>{project.name}</b>
                <small>{project.district}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {selected !== null && (
        <section
          className="project-modal"
          role="dialog"
          aria-modal="true"
          style={{ "--project-color": projects[selected].color } as React.CSSProperties}
        >
          <button className="close-button" onClick={() => setSelected(null)}>
            Return to city <span>×</span>
          </button>
          <div className="project-visual">
            <span className="project-number">{projects[selected].number}</span>
            <div className="visual-grid" />
            <div className="server-stack">
              <i /><i /><i /><i /><i />
            </div>
            <p>{projects[selected].code} · ward node</p>
          </div>
          <div className="project-copy">
            <p className="kicker">
              {projects[selected].code} · {projects[selected].district}
            </p>
            <h2>{projects[selected].name}</h2>
            <p className="project-description">{projects[selected].description}</p>
            <div className="project-stack">
              {projects[selected].stack.map((item) => <span key={item}>{item}</span>)}
            </div>
            <a href={projects[selected].link}>Open {projects[selected].name}</a>
          </div>
        </section>
      )}
    </main>
  );
}
