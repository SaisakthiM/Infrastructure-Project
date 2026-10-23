import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
} from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./home.css";
import { projects } from "../data/projects";
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
import { initAudio, playTone, setSfxEnabled } from "../lib/sfx";

const BASE = import.meta.env.BASE_URL;

/* ────────────────────────────────────────────────────────────────────────── */
/* Data                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

type ZoneId = "about" | "skills" | "projects" | "city" | "contact";
type EmoteName = "Wave" | "Dance" | "ThumbsUp";

type Zone = {
  id: ZoneId;
  number: string;
  name: string;
  subtitle: string;
  color: string;
  pos: [number, number];
};

const zones: Zone[] = [
  { id: "about", number: "01", name: "About", subtitle: "Who builds the city", color: "#0f6e9c", pos: [0, 0] },
  { id: "skills", number: "02", name: "Skills", subtitle: "Engineering stack", color: "#3d4e66", pos: [-14, -12] },
  { id: "projects", number: "03", name: "Projects", subtitle: "Featured builds", color: "#6e4a79", pos: [14, -12] },
  { id: "city", number: "04", name: "The City", subtitle: "Walk the live systems", color: "#2b7e72", pos: [-16, -26] },
  { id: "contact", number: "05", name: "Contact", subtitle: "Open to new roles", color: "#4c7c3f", pos: [12, -26] },
];

const zoneById = (id: ZoneId) => zones.find((zone) => zone.id === id)!;

// Road network between the zones (world x, z)
const roads: [[number, number], [number, number]][] = [
  [[0, 9], [0, 0]],
  [[0, 0], [-14, -12]],
  [[0, 0], [14, -12]],
  [[-14, -12], [-16, -26]],
  [[14, -12], [12, -26]],
  [[-16, -26], [12, -26]],
];

const WORLD = { minX: -40, maxX: 40, minZ: -46, maxZ: 24 };
const DEFAULT_REACH = 5.2;
const CITY_MODEL_SIZE = 18;
const CITY_ZONE_POS = zoneById("city").pos;

const aboutStats = [
  { value: "10+", label: "Services deployed" },
  { value: "5+", label: "Languages" },
  { value: "0", label: "CVEs in production" },
  { value: "100+", label: "DSA solutions" },
];

const skillGroups = [
  {
    name: "Backend frameworks",
    tags: ["Django / Python", "Spring Boot / Java", "Axum / Rust", "RESTful APIs", "WebSocket Channels", "gRPC"],
  },
  {
    name: "Cloud & infrastructure",
    tags: ["Docker & Compose", "Kubernetes Clusters", "Terraform IaC", "Nginx Reverse Proxy", "Cloudflare Tunnels"],
  },
  {
    name: "Databases & analytics",
    tags: ["PostgreSQL", "Redis Caching & PubSub", "DuckDB ETL", "MinIO Object Storage", "JSONL Event Pipelines"],
  },
  {
    name: "Observability & tooling",
    tags: ["Grafana Dashboards", "Prometheus Metrics", "Loki Logging", "GitOps", "Linux Systemd", "Shell Scripting"],
  },
];

const alsoBuilt = [
  {
    name: "DuckDB Financial Pipeline",
    description:
      "Serverless analytics engine aggregating event logs from MinIO into DuckDB for instant financial reporting.",
    stack: ["DuckDB", "Python", "MinIO", "ETL"],
  },
  {
    name: "Document Intelligence",
    description:
      "Therapeutic mental health journaling with AI-assisted contextual sentiment and retrieval.",
    stack: ["React", "LLM RAG", "Python", "Tailwind"],
  },
  {
    name: "3D Cyber Portfolio City",
    description:
      "Three.js 3D web game world with animated mascots, zone detection, and custom shaders.",
    stack: ["Three.js", "WebGL", "GLTF", "GameDev"],
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Three.js helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const target = object as THREE.Mesh;
    target.geometry?.dispose?.();
    const material = target.material as THREE.Material | THREE.Material[] | undefined;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    list.forEach((mat) => {
      Object.values(mat as unknown as Record<string, unknown>).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      mat.dispose();
    });
  });
}

function zoneSignTexture(zone: Zone) {
  return createSignTexture(zone.name, zone.subtitle, zone.color, "PRESS E TO ENTER", `Z-${zone.number}`);
}

function addRoad(scene: THREE.Scene, from: [number, number], to: [number, number], materials: {
  asphalt: THREE.Material;
  line: THREE.Material;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const group = new THREE.Group();
  group.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2);
  group.rotation.y = angle;
  addBox(group, [5.2, 0.1, length], [0, 0.05, 0], materials.asphalt, false);
  for (let d = -length / 2 + 2; d < length / 2 - 1; d += 3.4) {
    addBox(group, [0.14, 0.016, 1.6], [0, 0.108, d], materials.line, false);
  }
  scene.add(group);

  // street lights on alternating sides of the road
  const nx = Math.cos(angle);
  const nz = -Math.sin(angle);
  const steps = Math.max(1, Math.floor(length / 11));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / (steps + 1);
    const side = i % 2 === 0 ? 1 : -1;
    const px = from[0] + dx * t + nx * 3.5 * side;
    const pz = from[1] + dz * t + nz * 3.5 * side;
    const blockedByZone = zones.some(
      (zone) => Math.hypot(px - zone.pos[0], pz - zone.pos[1]) < (zone.id === "city" ? CITY_MODEL_SIZE / 2 + 2.5 : 6),
    );
    if (blockedByZone) continue;
    addStreetLight(scene, px, pz, Math.atan2(nz * side, -nx * side));
  }
}

function addSkyline(scene: THREE.Scene, texture: THREE.Texture) {
  // daytime glazing sheet: pale facades, no lit windows at night
  const windows = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.05,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: MAQUETTE.trim, roughness: 0.72, metalness: 0.2 });
  const centerZ = -11;
  const count = 36;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + seeded(i) * 0.1;
    const radius = 56 + seeded(i + 40) * 24;
    const width = 9 + seeded(i + 80) * 8;
    const depth = 9 + seeded(i + 120) * 7;
    const height = 15 + seeded(i + 160) * 26;
    const x = Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.atan2(-x, centerZ - z);

    const facade = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.1 + (i % 4) * 0.006, 0.1, 0.8 + (i % 3) * 0.02),
      roughness: 0.82,
      metalness: 0.03,
    });
    addBox(group, [width, height, depth], [0, height / 2, 0], facade);

    const faces: [number, number, number, number, number][] = [
      [width * 0.82, depth / 2 + 0.012, 0, 0, 0],
      [width * 0.82, -depth / 2 - 0.012, 0, Math.PI, 0],
      [depth * 0.78, 0, width / 2 + 0.012, Math.PI / 2, 0],
      [depth * 0.78, 0, -width / 2 - 0.012, -Math.PI / 2, 0],
    ];
    faces.forEach(([planeWidth, zOffset, xOffset, rotation]) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, height * 0.88), windows);
      plane.position.set(xOffset, height * 0.51, zOffset);
      plane.rotation.y = rotation;
      group.add(plane);
    });
    addBox(group, [width * 0.42, 0.6, depth * 0.42], [0, height + 0.3, 0], roofMaterial);
    if (i % 2 === 0) addBox(group, [0.08, 2.8, 0.08], [0, height + 1.7, 0], roofMaterial);
    scene.add(group);
  }
}

function addZonePlatform(zone: Zone) {
  const accent = new THREE.Color(zone.color);
  const group = new THREE.Group();
  group.position.set(zone.pos[0], 0, zone.pos[1]);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.6, 0.4, 48),
    new THREE.MeshStandardMaterial({ color: MAQUETTE.kerb, roughness: 0.85, metalness: 0.05 }),
  );
  platform.position.y = 0.2;
  platform.receiveShadow = true;
  platform.castShadow = true;
  group.add(platform);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.45, 0.07, 14, 72),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.18,
      roughness: 0.55,
      metalness: 0.05,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.42;
  group.add(ring);

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.04, 48),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }),
  );
  marker.position.y = 0.42;
  group.add(marker);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.2,
      roughness: 0.5,
      metalness: 0.15,
    }),
  );
  crystal.position.y = 3.2;
  crystal.castShadow = true;
  group.add(crystal);

  const sign = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: zoneSignTexture(zone), transparent: true, toneMapped: false }),
  );
  sign.scale.set(6.4, 2, 1);
  sign.position.y = 5.3;
  group.add(sign);

  // daylight: the zone light is a soft tint, not a lamp
  const light = new THREE.PointLight(accent, 0.5, 11);
  light.position.y = 3.5;
  group.add(light);

  return { zone, group, crystal, ring, light, sign, marker };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 3D scene                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

type SceneApi = {
  goTo: (id: ZoneId) => void;
  emote: (name: EmoteName) => void;
  setActive: (active: boolean) => void;
  setPaused: (paused: boolean) => void;
};

type SceneProps = {
  apiRef: MutableRefObject<SceneApi | null>;
  radarRef: RefObject<HTMLCanvasElement | null>;
  onProgress: (pct: number, message: string) => void;
  onReady: () => void;
  onNear: (id: ZoneId | null) => void;
  onOpen: (id: ZoneId) => void;
};

function HomeScene({ apiRef, radarRef, onProgress, onReady, onNear, onOpen }: SceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onProgress, onReady, onNear, onOpen });
  callbacks.current = { onProgress, onReady, onNear, onOpen };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    /* renderer / scene / camera */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MAQUETTE.paper);
    scene.fog = new THREE.FogExp2(MAQUETTE.skyLow, 0.011);

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 240);
    camera.position.set(4.5, 4.4, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 26;
    controls.target.set(0, 1.4, 8);

    /* lighting — the city's flat daylight rig, plus a cool fill */
    addDaylight(scene, { left: 44, top: 44, mapSize: 2048 });
    const fill = new THREE.DirectionalLight(0xdfe7ea, 0.35);
    fill.position.set(45, 18, -52);
    scene.add(fill);

    /* ground + roads */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: MAQUETTE.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const asphalt = new THREE.MeshStandardMaterial({ color: MAQUETTE.road, roughness: 0.96, metalness: 0.02 });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: MAQUETTE.marking });
    roads.forEach(([from, to]) => addRoad(scene, from, to, { asphalt, line: lineMaterial }));

    /* skyline + scenery */
    const windowTexture = createWindowTexture("#3d4e66");
    addSkyline(scene, windowTexture);
    [
      [-9, 6], [9, 6], [-24, -2], [24, -2], [25, -18], [26, -32], [4, -35], [-7, 17], [8, 18],
    ].forEach(([x, z], index) => addTree(scene, x, z, 0.8 + (index % 3) * 0.08));

    const starData = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i += 1) {
      const radius = 85 + Math.random() * 65;
      const angle = Math.random() * Math.PI * 2;
      starData[i * 3] = Math.cos(angle) * radius;
      starData[i * 3 + 1] = 4 + Math.random() * 38;
      starData[i * 3 + 2] = -11 + Math.sin(angle) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starData, 3));
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: MAQUETTE.dust, size: 0.12, opacity: 0.38, transparent: true }),
      ),
    );

    /* zones */
    const zoneObjects = zones.map((zone) => {
      const built = addZonePlatform(zone);
      scene.add(built.group);
      return built;
    });
    const zoneReach = new Map<ZoneId, number>(zones.map((zone) => [zone.id, DEFAULT_REACH]));
    let blocker: { x: number; z: number; r: number } | null = null;

    // Sign textures use web fonts — rebuild them once the fonts are really available.
    Promise.all([
      document.fonts.load("500 66px Archivo"),
      document.fonts.load("400 26px 'JetBrains Mono'"),
    ])
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        zoneObjects.forEach(({ zone, sign }) => {
          const material = sign.material as THREE.SpriteMaterial;
          material.map?.dispose();
          material.map = zoneSignTexture(zone);
          material.needsUpdate = true;
        });
      });

    /* models */
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${BASE}draco/`);
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(draco);

    let robot: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let cityMixer: THREE.AnimationMixer | null = null;
    const actions: Record<string, THREE.AnimationAction> = {};
    let currentAction: THREE.AnimationAction | null = null;
    const loaded = { robot: 0, city: 0 };
    const reportProgress = (message: string) =>
      callbacks.current.onProgress(Math.round(10 + loaded.robot * 30 + loaded.city * 58), message);

    const fadeTo = (name: string, duration = 0.2) => {
      const next = actions[name];
      if (!next || currentAction === next) return;
      const previous = currentAction;
      currentAction = next;
      previous?.fadeOut(duration);
      next.reset().fadeIn(duration).play();
    };

    const emote = (name: EmoteName) => {
      const action = actions[name];
      if (!action || !mixer) return;
      initAudio();
      playTone(550, "triangle", 0.18);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      if (currentAction && currentAction !== action) currentAction.fadeOut(0.2);
      action.fadeIn(0.2);
      currentAction = action;
      const onFinished = (event: { action: THREE.AnimationAction }) => {
        if (event.action !== action) return;
        mixer?.removeEventListener("finished", onFinished);
        fadeTo("Idle", 0.25);
      };
      mixer.addEventListener("finished", onFinished);
    };

    const loadModel = (url: string, kind: "robot" | "city") =>
      new Promise<GLTF>((resolve, reject) => {
        gltfLoader.load(
          url,
          resolve,
          (event) => {
            if (event.total) {
              loaded[kind] = event.loaded / event.total;
              reportProgress(kind === "robot" ? "Summoning the robot" : "Building the city district");
            }
          },
          reject,
        );
      });

    const spawn = new THREE.Vector3(0, 0, 8);

    const useFallbackAvatar = () => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16),
        new THREE.MeshStandardMaterial({ color: MAQUETTE.accent, metalness: 0.15, roughness: 0.5 }),
      );
      body.position.y = 0.8;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({ color: MAQUETTE.paperRaised }),
      );
      head.position.y = 1.6;
      head.castShadow = true;
      group.add(body, head);
      group.position.copy(spawn);
      scene.add(group);
      robot = group;
    };

    const robotPromise = loadModel(`${BASE}models/robot.glb`, "robot");
    const cityPromise = loadModel(`${BASE}models/city.glb`, "city");

    Promise.allSettled([robotPromise, cityPromise]).then(([robotResult, cityResult]) => {
      if (disposed) {
        [robotResult, cityResult].forEach((result) => {
          if (result.status === "fulfilled") disposeObject(result.value.scene);
        });
        return;
      }

      if (robotResult.status === "fulfilled") {
        const gltf = robotResult.value;
        const model = gltf.scene;
        model.scale.setScalar(0.65);
        model.position.copy(spawn);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
        robot = model;
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            actions[clip.name] = mixer!.clipAction(clip);
          });
          fadeTo("Idle", 0.2);
        }
      } else {
        console.warn("robot.glb failed to load, using fallback avatar", robotResult.reason);
        useFallbackAvatar();
      }

      if (cityResult.status === "fulfilled") {
        const gltf = cityResult.value;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z);

        if (Number.isFinite(largest) && largest > 0) {
          const scale = CITY_MODEL_SIZE / largest;
          model.scale.setScalar(scale);
          model.position.set(
            CITY_ZONE_POS[0] - center.x * scale,
            0.4 - box.min.y * scale,
            CITY_ZONE_POS[1] - center.z * scale,
          );
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(model);
          if (gltf.animations.length) {
            cityMixer = new THREE.AnimationMixer(model);
            cityMixer.clipAction(gltf.animations[0]).play();
          }

          // The diorama sits on the "The City" platform: lift its sign above it, keep the robot outside it.
          const cityZone = zoneObjects.find((item) => item.zone.id === "city");
          if (cityZone) {
            cityZone.crystal.visible = false;
            cityZone.sign.position.y = size.y * scale + 3.2;
            cityZone.light.position.y = 6;
          }
          blocker = { x: CITY_ZONE_POS[0], z: CITY_ZONE_POS[1], r: CITY_MODEL_SIZE / 2 + 0.4 };
          zoneReach.set("city", blocker.r + 2.6);
        }
      } else {
        console.warn("city.glb failed to load, continuing without the diorama", cityResult.reason);
      }

      callbacks.current.onProgress(100, "World ready");
      window.setTimeout(() => {
        if (!disposed) callbacks.current.onReady();
      }, 350);
    });

    reportProgress("Booting 3D engine");

    /* input */
    const keys: Record<string, boolean> = {};
    const state = { active: false, paused: false };
    let nearId: ZoneId | null = null;
    let autoTarget: { x: number; z: number; arrive: number } | null = null;
    let jumping = false;
    let jumpVelocity = 0;

    const triggerJump = () => {
      if (jumping || !robot) return;
      jumping = true;
      jumpVelocity = 6.5;
      fadeTo("Jump", 0.1);
      playTone(320, "sine", 0.15);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys[event.code] = true;
      if (!state.active || state.paused) return;
      initAudio();
      if (event.code === "KeyE" && !event.repeat && nearId) callbacks.current.onOpen(nearId);
      if (event.code === "KeyT") emote("Wave");
      if (event.code === "KeyV") emote("Dance");
      if (event.code === "KeyB") emote("ThumbsUp");
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) triggerJump();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys[event.code] = false;
    };
    const onBlur = () => {
      Object.keys(keys).forEach((code) => (keys[code] = false));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    apiRef.current = {
      goTo: (id) => {
        if (!robot) return;
        const zone = zoneById(id);
        autoTarget = {
          x: zone.pos[0],
          z: zone.pos[1],
          arrive: id === "city" && blocker ? blocker.r + 1 : 0.7,
        };
        initAudio();
        playTone(500, "sine", 0.1);
      },
      emote,
      setActive: (active) => {
        state.active = active;
      },
      setPaused: (paused) => {
        state.paused = paused;
        if (paused) {
          Object.keys(keys).forEach((code) => (keys[code] = false));
          autoTarget = null;
        }
      },
    };

    /* radar (minimap) */
    const radarX = (x: number) => 75 + x * 1.6;
    const radarY = (z: number) => 75 + (z + 11) * 1.6;
    const drawRadar = () => {
      const radar = radarRef.current;
      if (!radar || !robot) return;
      if (radar.width !== 150) {
        radar.width = 150;
        radar.height = 150;
      }
      const radarCtx = radar.getContext("2d");
      if (!radarCtx) return;
      radarCtx.clearRect(0, 0, 150, 150);
      // paper radar: roads drawn in ink, not light
      radarCtx.strokeStyle = "rgba(18, 18, 18, 0.12)";
      radarCtx.lineWidth = 5;
      radarCtx.lineCap = "round";
      roads.forEach(([from, to]) => {
        radarCtx.beginPath();
        radarCtx.moveTo(radarX(from[0]), radarY(from[1]));
        radarCtx.lineTo(radarX(to[0]), radarY(to[1]));
        radarCtx.stroke();
      });
      zones.forEach((zone) => {
        const x = radarX(zone.pos[0]);
        const y = radarY(zone.pos[1]);
        radarCtx.beginPath();
        radarCtx.arc(x, y, zone.id === nearId ? 6 : 4.5, 0, Math.PI * 2);
        radarCtx.fillStyle = zone.color;
        radarCtx.fill();
        if (zone.id === nearId) {
          radarCtx.strokeStyle = "#121212";
          radarCtx.lineWidth = 1.5;
          radarCtx.stroke();
        }
      });
      const px = radarX(robot.position.x);
      const py = radarY(robot.position.z);
      radarCtx.beginPath();
      radarCtx.arc(px, py, 3.6, 0, Math.PI * 2);
      radarCtx.fillStyle = "#121212";
      radarCtx.fill();
      radarCtx.strokeStyle = "#0f6e9c";
      radarCtx.lineWidth = 2;
      radarCtx.stroke();
      radarCtx.beginPath();
      radarCtx.moveTo(px, py);
      radarCtx.lineTo(px + Math.sin(robot.rotation.y) * 9, py + Math.cos(robot.rotation.y) * 9);
      radarCtx.stroke();
    };

    /* main loop */
    const camDir = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const moveDir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const desiredTarget = new THREE.Vector3();
    const followDelta = new THREE.Vector3();
    let last = performance.now();
    let elapsed = 0;
    let frameCount = 0;
    let viewShift = 0.17; // pushes the robot to the right of the welcome card
    let frame = 0;

    const platformHeight = (x: number, z: number) =>
      zones.some((zone) => Math.hypot(x - zone.pos[0], z - zone.pos[1]) < 4.2) ? 0.4 : 0;

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      frameCount += 1;

      mixer?.update(dt);
      cityMixer?.update(dt);

      if (robot && state.active && !state.paused) {
        const sprint = Boolean(keys.ShiftLeft || keys.ShiftRight);
        const speed = sprint ? 9.5 : 5;

        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();
        camRight.crossVectors(camDir, up).normalize();

        moveDir.set(0, 0, 0);
        if (keys.KeyW || keys.ArrowUp) moveDir.add(camDir);
        if (keys.KeyS || keys.ArrowDown) moveDir.sub(camDir);
        if (keys.KeyD || keys.ArrowRight) moveDir.add(camRight);
        if (keys.KeyA || keys.ArrowLeft) moveDir.sub(camRight);

        if (moveDir.lengthSq() > 0.01) {
          autoTarget = null; // manual input cancels auto-walk
        } else if (autoTarget) {
          moveDir.set(autoTarget.x - robot.position.x, 0, autoTarget.z - robot.position.z);
          if (moveDir.length() > autoTarget.arrive) {
            moveDir.normalize();
          } else {
            moveDir.set(0, 0, 0);
            autoTarget = null;
            emote("ThumbsUp");
          }
        }

        const moving = moveDir.lengthSq() > 0.01;
        if (moving) {
          moveDir.normalize();
          robot.position.addScaledVector(moveDir, speed * dt);

          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          const diff = targetAngle - robot.rotation.y;
          robot.rotation.y += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, 12 * dt);

          if (!jumping) fadeTo(sprint ? "Running" : "Walking", 0.15);
        } else if (
          !jumping &&
          currentAction !== actions.Wave &&
          currentAction !== actions.Dance &&
          currentAction !== actions.ThumbsUp
        ) {
          fadeTo("Idle", 0.2);
        }

        robot.position.x = THREE.MathUtils.clamp(robot.position.x, WORLD.minX, WORLD.maxX);
        robot.position.z = THREE.MathUtils.clamp(robot.position.z, WORLD.minZ, WORLD.maxZ);
        if (blocker) {
          const dx = robot.position.x - blocker.x;
          const dz = robot.position.z - blocker.z;
          const distance = Math.hypot(dx, dz);
          if (distance < blocker.r) {
            const k = blocker.r / Math.max(distance, 0.001);
            robot.position.x = blocker.x + dx * k;
            robot.position.z = blocker.z + dz * k;
          }
        }

        const groundY = platformHeight(robot.position.x, robot.position.z);
        if (jumping) {
          robot.position.y += jumpVelocity * dt;
          jumpVelocity -= 18 * dt;
          if (robot.position.y <= groundY && jumpVelocity < 0) {
            robot.position.y = groundY;
            jumping = false;
            jumpVelocity = 0;
            fadeTo(moving ? (sprint ? "Running" : "Walking") : "Idle", 0.15);
          }
        } else {
          robot.position.y += (groundY - robot.position.y) * Math.min(1, 16 * dt);
        }
      }

      // Camera follows the robot while keeping the player's orbit angle and zoom.
      if (robot) {
        desiredTarget.set(robot.position.x, robot.position.y + 1.2, robot.position.z);
        followDelta.copy(desiredTarget).sub(controls.target).multiplyScalar(Math.min(1, 10 * dt));
        controls.target.add(followDelta);
        camera.position.add(followDelta);
      }

      zoneObjects.forEach((item, index) => {
        item.crystal.rotation.y = elapsed * 1.2 + index;
        item.crystal.position.y = 3.2 + Math.sin(elapsed * 2 + index) * 0.15;
        item.ring.rotation.z = elapsed * 0.4 + index * 0.2;
        item.light.intensity = 0.5 + Math.sin(elapsed * 3 + index) * 0.15;
        item.marker.scale.setScalar(1 + Math.sin(elapsed * 2 + index) * 0.1);
      });

      if (frameCount % 4 === 0 && robot) {
        let nearest: ZoneId | null = null;
        if (state.active && !state.paused) {
          let best = Infinity;
          for (const zone of zones) {
            const distance = Math.hypot(robot.position.x - zone.pos[0], robot.position.z - zone.pos[1]);
            if (distance < (zoneReach.get(zone.id) ?? DEFAULT_REACH) && distance < best) {
              best = distance;
              nearest = zone.id;
            }
          }
        }
        if (nearest !== nearId) {
          nearId = nearest;
          if (nearest) playTone(480, "sine", 0.08);
          callbacks.current.onNear(nearest);
        }
        drawRadar();
      }

      const targetShift = state.active || window.innerWidth <= 800 ? 0 : 0.17;
      viewShift += (targetShift - viewShift) * Math.min(1, 4 * dt);
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (viewShift > 0.002) {
        camera.setViewOffset(width, height, -viewShift * width, 0, width, height);
      } else if (camera.view?.enabled) {
        camera.clearViewOffset();
      }

      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      apiRef.current = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", resize);
      controls.dispose();
      mixer?.stopAllAction();
      cityMixer?.stopAllAction();
      disposeObject(scene);
      windowTexture.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(renderer.domElement);
    };
  }, [apiRef, radarRef]);

  return <div className="city-canvas" ref={mountRef} />;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Icons (inline SVG)                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="hw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="hw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="hw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="hw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="hw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? <path d="m23 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Zone panels                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function ZonePanel({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  return (
    <section
      className="hw-panel"
      role="dialog"
      aria-modal="true"
      aria-label={zone.name}
      style={{ "--project-color": zone.color } as CSSProperties}
    >
      <button className="close-button" onClick={onClose}>
        Back to the world <span>×</span>
      </button>
      <div className="hw-panel-inner">
        <p className="kicker">
          {zone.number} / {zone.subtitle}
        </p>
        {zone.id === "about" && <AboutPanel />}
        {zone.id === "skills" && <SkillsPanel />}
        {zone.id === "projects" && <ProjectsPanel />}
        {zone.id === "city" && <CityPanel />}
        {zone.id === "contact" && <ContactPanel />}
      </div>
    </section>
  );
}

function AboutPanel() {
  return (
    <>
      <h2 className="hw-title">Saisakthi M.</h2>
      <p className="hw-lede">
        Self-taught backend and distributed systems engineer specializing in containerized
        microservices, production APIs, and automated data pipelines.
      </p>
      <div className="hw-stats">
        {aboutStats.map((stat) => (
          <div key={stat.label}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      <pre className="hw-terminal">
        <span className="t-c"># Developer identity</span>
        {"\n"}
        <span className="t-k">engineer</span>: <span className="t-s">"Saisakthi M"</span>
        {"\n"}
        <span className="t-k">focus</span>: <span className="t-s">"Backend &amp; Distributed Systems"</span>
        {"\n"}
        <span className="t-k">location</span>: <span className="t-s">"Chennai, Tamil Nadu"</span>
        {"\n\n"}
        <span className="t-c"># Active stack</span>
        {"\n"}
        <span className="t-k">backend</span>: [<span className="t-s">"Django"</span>, <span className="t-s">"Spring Boot"</span>, <span className="t-s">"Axum (Rust)"</span>]
        {"\n"}
        <span className="t-k">infra</span>: [<span className="t-s">"Docker"</span>, <span className="t-s">"Kubernetes"</span>, <span className="t-s">"Terraform"</span>, <span className="t-s">"Nginx"</span>]
        {"\n"}
        <span className="t-k">storage</span>: [<span className="t-s">"PostgreSQL"</span>, <span className="t-s">"Redis"</span>, <span className="t-s">"MinIO S3"</span>, <span className="t-s">"DuckDB"</span>]
        {"\n"}
        <span className="t-k">status</span>: <span className="t-v">available_for_hire</span>
      </pre>
    </>
  );
}

function SkillsPanel() {
  return (
    <>
      <h2 className="hw-title">Engineering stack</h2>
      <p className="hw-lede">
        Versatile across backend frameworks, distributed object storage, and container orchestration.
      </p>
      <div className="hw-grid">
        {skillGroups.map((group) => (
          <article className="hw-card" key={group.name}>
            <h3>{group.name}</h3>
            <div className="hw-chips">
              {group.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ProjectsPanel() {
  return (
    <>
      <h2 className="hw-title">Featured projects</h2>
      <p className="hw-lede">
        Each project runs containerized with dedicated databases, health checks, and secure gateway
        routing. Every card links to the live service.
      </p>
      <div className="hw-grid">
        {projects.map((project) => (
          <a
            className="hw-card hw-card-link"
            key={project.name}
            href={project.link}
            target="_blank"
            rel="noreferrer"
            style={{ "--project-color": project.color } as CSSProperties}
          >
            <span className="hw-card-number">{project.code}</span>
            <h3>{project.name}</h3>
            <small>{project.district}</small>
            <p>{project.description}</p>
            <div className="hw-chips">
              {project.stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <span className="hw-card-cta">
              Launch project <ArrowIcon />
            </span>
          </a>
        ))}
      </div>
      <p className="kicker hw-subhead">Also built</p>
      <div className="hw-grid">
        {alsoBuilt.map((project) => (
          <article className="hw-card" key={project.name}>
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <div className="hw-chips">
              {project.stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function CityPanel() {
  return (
    <>
      <h2 className="hw-title">The City</h2>
      <p className="hw-lede">
        Every project in this portfolio runs as a live service, and in the city each one is a
        district you can walk up to. Step in first-person, explore the landmarks, and use the
        directory to fast-travel to any project.
      </p>
      <Link className="enter-button hw-cta" to="/city">
        Enter the city <ArrowIcon />
      </Link>
      <div className="hw-chips hw-district-chips">
        {projects.map((project) => (
          <span key={project.name} style={{ "--project-color": project.color } as CSSProperties}>
            <i /> {project.code} {project.name}
          </span>
        ))}
      </div>
    </>
  );
}

function ContactPanel() {
  const links = [
    { icon: <MailIcon />, label: "saisakthicloud@gmail.com", href: "mailto:saisakthicloud@gmail.com" },
    { icon: <GithubIcon />, label: "github.com/SaisakthiM", href: "https://github.com/SaisakthiM" },
    { icon: <LinkedInIcon />, label: "LinkedIn profile", href: "https://linkedin.com/in/saisakthi" },
    { icon: <GlobeIcon />, label: "saisakthi.qzz.io", href: "https://saisakthi.qzz.io" },
  ];
  return (
    <>
      <h2 className="hw-title">Get in touch</h2>
      <p className="hw-lede">
        Open to backend engineering, distributed systems, and platform developer positions.
      </p>
      <div className="hw-grid">
        {links.map((link) => (
          <a
            className="hw-card hw-card-link hw-contact"
            key={link.href}
            href={link.href}
            target={link.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
          >
            {link.icon}
            <h3>{link.label}</h3>
            <span className="hw-card-cta">
              Open <ArrowIcon />
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Page                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  const apiRef = useRef<SceneApi | null>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState({ pct: 8, message: "Booting 3D engine" });
  const [phase, setPhase] = useState<"loading" | "ready" | "playing">("loading");
  const [near, setNear] = useState<ZoneId | null>(null);
  const [panel, setPanel] = useState<ZoneId | null>(null);
  const [sfx, setSfx] = useState(true);

  const handleProgress = useCallback((pct: number, message: string) => {
    setProgress((current) => ({ pct: Math.max(current.pct, pct), message }));
  }, []);
  const handleReady = useCallback(() => setPhase((current) => (current === "loading" ? "ready" : current)), []);

  const openPanel = useCallback((id: ZoneId) => {
    playTone(440, "triangle", 0.15);
    setPanel(id);
  }, []);
  const closePanel = useCallback(() => {
    playTone(330, "sine", 0.1);
    setPanel(null);
  }, []);

  useEffect(() => {
    apiRef.current?.setActive(phase === "playing");
  }, [phase]);

  useEffect(() => {
    apiRef.current?.setPaused(panel !== null);
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  const start = () => {
    initAudio();
    playTone(440, "triangle", 0.2);
    setPhase("playing");
  };

  const walkTo = (id: ZoneId) => {
    if (phase === "ready") start();
    apiRef.current?.goTo(id);
  };

  const toggleSfx = () => {
    const next = !sfx;
    setSfx(next);
    setSfxEnabled(next);
    if (next) playTone(520, "sine", 0.1);
  };

  const nearZone = near ? zoneById(near) : null;
  const panelZone = panel ? zoneById(panel) : null;

  return (
    <main className="city-shell hw-shell">
      <HomeScene
        apiRef={apiRef}
        radarRef={radarRef}
        onProgress={handleProgress}
        onReady={handleReady}
        onNear={setNear}
        onOpen={openPanel}
      />
      <div className="vignette" />

      {phase === "loading" && (
        <div className="hw-loading" role="status">
          <span className="brand-mark">SM</span>
          <h1>Saisakthi M.</h1>
          <p className="kicker">Loading the portfolio world</p>
          <div className="hw-bar">
            <span style={{ width: `${progress.pct}%` }} />
          </div>
          <small>{progress.message}</small>
        </div>
      )}

      {phase !== "loading" && (
        <header className="city-header">
          <div className="city-brand">
            <span className="brand-mark">SM</span>
            <span>
              Saisakthi M.
              <small>Backend systems engineer · Chennai</small>
            </span>
          </div>
          <div className="city-status">
            <span />
            World online
          </div>
          <nav className="hw-nav">
            {zones.map((zone) => (
              <button
                key={zone.id}
                className={near === zone.id ? "is-active" : undefined}
                onClick={() => walkTo(zone.id)}
              >
                {zone.name}
              </button>
            ))}
            <Link className="hw-nav-city" to="/city">
              Enter city <ArrowIcon />
            </Link>
          </nav>
        </header>
      )}

      {phase === "ready" && (
        <section className="welcome-card">
          <p className="kicker">Portfolio home</p>
          <h1>
            Walk through
            <br />
            <em>my work.</em>
          </h1>
          <p>
            Backend and distributed systems engineer. Guide the robot around the grounds to explore my
            projects, stack, and live infrastructure, then step into the full city.
          </p>
          <div className="hw-enter-row">
            <button className="enter-button" onClick={start}>
              Enter the world <ArrowIcon />
            </button>
            <Link className="hw-secondary" to="/city">
              Or skip to the walkable city
            </Link>
          </div>
          <div className="control-row">
            <span><b>WASD</b> move</span>
            <span><b>Drag</b> orbit</span>
            <span><b>Shift</b> sprint</span>
            <span><b>Space</b> jump</span>
            <span><b>E</b> inspect</span>
          </div>
        </section>
      )}

      {phase === "playing" && (
        <>
          <div className="walk-hud">
            <div className="compass">
              N <span>•</span> {nearZone ? nearZone.name : "Open grounds"}
            </div>
            <div className="walk-controls">
              WASD move · Shift sprint · Space jump · E inspect · Drag to orbit · T / V / B emotes
            </div>
          </div>

          <div className="hw-actions">
            <button onClick={() => apiRef.current?.emote("Wave")}>Wave</button>
            <button onClick={() => apiRef.current?.emote("Dance")}>Dance</button>
            <button onClick={() => apiRef.current?.emote("ThumbsUp")}>Thumbs up</button>
            <button onClick={toggleSfx} aria-pressed={sfx}>
              <SpeakerIcon muted={!sfx} />
              SFX {sfx ? "on" : "off"}
            </button>
          </div>

          {nearZone && !panel && (
            <button
              className="enter-prompt"
              onClick={() => openPanel(nearZone.id)}
              style={{ "--project-color": nearZone.color } as CSSProperties}
            >
              <span className="key">E</span>
              <span>
                Open {nearZone.name}
                <small>{nearZone.subtitle}</small>
              </span>
            </button>
          )}
        </>
      )}

      {phase === "playing" && (
        <aside className="hw-radar">
          <p>Zone radar</p>
          <canvas ref={radarRef} />
        </aside>
      )}

      {panelZone && <ZonePanel zone={panelZone} onClose={closePanel} />}
    </main>
  );
}
