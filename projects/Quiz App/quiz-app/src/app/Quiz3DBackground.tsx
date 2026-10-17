import React, { useEffect, useRef } from "react";

export function Quiz3DBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let renderer: any, scene: any, camera: any, animId: number;
    let cancelled = false;

    const init = () => {
      const container = mountRef.current;
      if (!container || !(window as any).THREE) return;

      const THREE = (window as any).THREE;
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 10);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      // 3D Gamified Neon Icosahedron and Floating Quiz Badges
      const icoGeom = new THREE.IcosahedronGeometry(2.2, 0);
      const icoEdges = new THREE.EdgesGeometry(icoGeom);
      const icosahedron = new THREE.LineSegments(
        icoEdges,
        new THREE.LineBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.75 })
      );
      group.add(icosahedron);

      // Pulsing internal core
      const coreGeom = new THREE.DodecahedronGeometry(1.2, 0);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const core = new THREE.Mesh(coreGeom, coreMat);
      group.add(core);

      // Floating spark rings / stars
      const ringGeom = new THREE.TorusGeometry(3.5, 0.04, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 3;
      group.add(ring);

      let t = 0;
      const animate = () => {
        if (cancelled) return;
        animId = requestAnimationFrame(animate);
        t += 0.012;

        group.rotation.y = t * 0.5;
        group.rotation.x = Math.sin(t * 0.3) * 0.2;
        ring.rotation.z = t * 0.4;
        core.rotation.y = -t * 0.8;
        core.scale.setScalar(1 + Math.sin(t * 2.5) * 0.1);

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

    if (!(window as any).THREE) {
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
        opacity: 0.35,
      }}
    />
  );
}
