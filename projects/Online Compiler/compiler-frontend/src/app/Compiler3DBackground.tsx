import React, { useEffect, useRef } from "react";

export function Compiler3DBackground() {
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

      // Rotating quantum execution core / matrix wireframe cube
      const outerBoxGeom = new THREE.BoxGeometry(3.6, 3.6, 3.6);
      const outerEdges = new THREE.EdgesGeometry(outerBoxGeom);
      const outerCube = new THREE.LineSegments(
        outerEdges,
        new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 })
      );
      group.add(outerCube);

      const innerBoxGeom = new THREE.BoxGeometry(2.2, 2.2, 2.2);
      const innerEdges = new THREE.EdgesGeometry(innerBoxGeom);
      const innerCube = new THREE.LineSegments(
        innerEdges,
        new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.85 })
      );
      group.add(innerCube);

      // Center glowing execution sphere
      const sphereGeom = new THREE.OctahedronGeometry(0.8, 2);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      group.add(sphere);

      // Cyber grid planes
      const grid = new THREE.GridHelper(30, 30, 0x06b6d4, 0x1e293b);
      grid.position.y = -4;
      scene.add(grid);

      let t = 0;
      const animate = () => {
        if (cancelled) return;
        animId = requestAnimationFrame(animate);
        t += 0.01;

        group.rotation.x = t * 0.4;
        group.rotation.y = t * 0.6;
        innerCube.rotation.x = -t * 0.7;
        innerCube.rotation.z = t * 0.5;
        sphere.scale.setScalar(1 + Math.sin(t * 3) * 0.12);

        grid.position.z = (t * 0.5) % 1;

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
