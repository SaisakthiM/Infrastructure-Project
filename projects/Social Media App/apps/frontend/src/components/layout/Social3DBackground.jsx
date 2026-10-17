import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Social3DBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.02);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 4, 18);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    // Connected Network Nodes (Social Graph)
    const graphGroup = new THREE.Group();
    graphGroup.position.set(6, 2, -4);
    scene.add(graphGroup);

    const nodeCount = 35;
    const nodeGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0c8 });

    const nodes = [];
    const positions = [];

    for (let i = 0; i < nodeCount; i++) {
      const radius = 6.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const mesh = new THREE.Mesh(nodeGeo, i % 3 === 0 ? cyanMat : nodeMat);
      mesh.position.set(x, y, z);
      graphGroup.add(mesh);
      nodes.push(mesh);
      positions.push(new THREE.Vector3(x, y, z));
    }

    // Connect close nodes with lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 });
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (positions[i].distanceTo(positions[j]) < 4.5) {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([positions[i], positions[j]]);
          const line = new THREE.Line(lineGeo, lineMat);
          graphGroup.add(line);
        }
      }
    }

    let frame;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      graphGroup.rotation.y = t * 0.15;
      graphGroup.rotation.x = Math.sin(t * 0.1) * 0.1;
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
