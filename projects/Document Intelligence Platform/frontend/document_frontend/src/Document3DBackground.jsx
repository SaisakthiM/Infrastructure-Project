import React, { useEffect, useRef } from "react";

export function Document3DBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    let renderer, scene, camera, animId;
    let cancelled = false;

    const init = () => {
      const container = mountRef.current;
      if (!container || !window.THREE) return;

      const THREE = window.THREE;
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 9);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Cyber neural document stack / scanner rings
      const docGroup = new THREE.Group();
      scene.add(docGroup);

      // Glowing holographic document planes
      for (let i = 0; i < 4; i++) {
        const geom = new THREE.PlaneGeometry(3.5, 4.8);
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: i === 0 ? 0xa855f7 : 0x6366f1,
            transparent: true,
            opacity: 0.6 - i * 0.12,
          })
        );
        line.position.z = (i - 1.5) * 0.8;
        line.rotation.x = 0.2;
        line.rotation.y = 0.35 + i * 0.08;
        docGroup.add(line);
      }

      // Scanner laser beam (horizontal scanning line)
      const scanGeom = new THREE.CylinderGeometry(0.04, 0.04, 5, 16);
      const scanMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        wireframe: true,
      });
      const scanner = new THREE.Mesh(scanGeom, scanMat);
      scanner.rotation.z = Math.PI / 2;
      docGroup.add(scanner);

      // Floating neural nodes / particles
      const count = 120;
      const partGeom = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        pos[i] = (Math.random() - 0.5) * 16;
        pos[i + 1] = (Math.random() - 0.5) * 12;
        pos[i + 2] = (Math.random() - 0.5) * 10;
      }
      partGeom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const partMat = new THREE.PointsMaterial({
        color: 0xa855f7,
        size: 0.06,
        transparent: true,
        opacity: 0.7,
      });
      const particles = new THREE.Points(partGeom, partMat);
      scene.add(particles);

      let t = 0;
      const animate = () => {
        if (cancelled) return;
        animId = requestAnimationFrame(animate);
        t += 0.015;

        docGroup.rotation.y = Math.sin(t * 0.5) * 0.25;
        docGroup.rotation.x = Math.cos(t * 0.3) * 0.15;
        scanner.position.y = Math.sin(t * 2) * 2.2;
        particles.rotation.y = t * 0.04;

        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    if (!window.THREE) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
      script.async = true;
      script.onload = () => {
        if (!cancelled) init();
      };
      document.body.appendChild(script);
    } else {
      init();
    }

    return () => {
      cancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (renderer && renderer.domElement) {
        renderer.domElement.remove();
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.45,
      }}
    />
  );
}
