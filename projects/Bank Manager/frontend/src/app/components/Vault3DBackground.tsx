import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Vault3DBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.02);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 6, 16);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    // Neon Grid
    const grid = new THREE.GridHelper(60, 30, 0xd8b44b, 0x1a2618);
    grid.position.y = -1;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    scene.add(grid);

    // Lighting
    const sun = new THREE.DirectionalLight(0xfff5db, 1.8);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const goldLight = new THREE.PointLight(0xd8b44b, 3.5, 20);
    goldLight.position.set(0, 5, 0);
    scene.add(goldLight);

    // 3D Vault Pedestal & Gold Bullion
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(0, 1, 0);
    scene.add(vaultGroup);

    // Pedestal
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x0f1520,
      metalness: 0.85,
      roughness: 0.25,
    });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.8, 8), pedMat);
    vaultGroup.add(ped);

    // Glowing Halo Ring
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd8b44b,
      emissive: 0xd8b44b,
      emissiveIntensity: 2.5,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.08, 16, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.45;
    vaultGroup.add(ring);

    // Gold Bullion Stack
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xd4a017,
      emissiveIntensity: 0.4,
      metalness: 0.95,
      roughness: 0.15,
    });

    const barGeo = new THREE.BoxGeometry(1.6, 0.45, 0.8);
    [
      [-0.9, 0.7, 0], [0.9, 0.7, 0],
      [0, 1.2, 0],
      [-0.45, 1.7, 0], [0.45, 1.7, 0]
    ].forEach(([x, y, z]) => {
      const bar = new THREE.Mesh(barGeo, goldMat);
      bar.position.set(x, y, z);
      vaultGroup.add(bar);
    });

    // Orbiting currency shards
    const shardGeo = new THREE.OctahedronGeometry(0.35, 0);
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const shard = new THREE.Mesh(shardGeo, goldMat);
      vaultGroup.add(shard);
      shards.push(shard);
    }

    let frame: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      vaultGroup.rotation.y = t * 0.4;
      ring.rotation.z = t * 0.8;

      shards.forEach((s, idx) => {
        const angle = t * 0.8 + (idx / 6) * Math.PI * 2;
        s.position.x = Math.cos(angle) * 4.2;
        s.position.z = Math.sin(angle) * 4.2;
        s.position.y = 2.2 + Math.sin(t * 2 + idx) * 0.5;
        s.rotation.x = t * 2;
        s.rotation.y = t * 1.5;
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none z-0" />;
}
