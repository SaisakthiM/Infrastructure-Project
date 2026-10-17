import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Media3DBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.02);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 16);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    // Neon Magenta Grid
    const grid = new THREE.GridHelper(60, 30, 0xe2668a, 0x1f111e);
    grid.position.y = -3;
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add(grid);

    // 3D Media Hologram Projector
    const mediaGroup = new THREE.Group();
    mediaGroup.position.set(9, 2, -2);
    scene.add(mediaGroup);

    // Holographic Film Reel / Prism
    const prismGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24);
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0x180b18,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x3d0b28,
      emissiveIntensity: 0.5
    });
    const reel = new THREE.Mesh(prismGeo, prismMat);
    reel.rotation.x = Math.PI / 2;
    mediaGroup.add(reel);

    // Glowing Neon Rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xe2668a,
      emissive: 0xe2668a,
      emissiveIntensity: 2.5
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.06, 16, 48), ringMat);
    ring1.rotation.x = Math.PI / 2;
    mediaGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.04, 16, 48), ringMat);
    ring2.rotation.y = Math.PI / 4;
    mediaGroup.add(ring2);

    // Lighting
    const dLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dLight.position.set(5, 10, 5);
    scene.add(dLight);

    const pLight = new THREE.PointLight(0xe2668a, 3.5, 15);
    pLight.position.set(9, 3, 0);
    scene.add(pLight);

    let frame;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      mediaGroup.rotation.y = t * 0.4;
      mediaGroup.rotation.z = Math.sin(t * 0.3) * 0.15;
      ring2.rotation.x = t * 0.6;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 pointer-events-none z-0" />;
}
