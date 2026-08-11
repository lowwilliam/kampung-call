"use client";

import { useEffect, useRef } from "react";

export function CollectionGlobe() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanup = () => {};

    void (async () => {
      const [THREE, { OrbitControls }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
      ]);
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.4, 6.2);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Rotating miniature Singapore collection globe");
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfff4d1, 0x06383b, 3.2));
      const key = new THREE.DirectionalLight(0xffc85a, 4.5);
      key.position.set(4, 6, 5);
      scene.add(key);

      const globe = new THREE.Group();
      globe.rotation.z = -0.18;
      scene.add(globe);
      const planet = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.65, 3),
        new THREE.MeshStandardMaterial({ color: 0x0e6b66, roughness: 0.82, flatShading: true }),
      );
      globe.add(planet);
      const grid = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.67, 2), 12),
        new THREE.LineBasicMaterial({ color: 0xebe3c7, transparent: true, opacity: 0.2 }),
      );
      globe.add(grid);

      const markers = [
        { lat: 12, lon: 25, height: 0.38, color: 0xf09214 },
        { lat: -4, lon: 62, height: 0.25, color: 0xebe3c7 },
        { lat: 28, lon: 108, height: 0.32, color: 0xaa2e1c },
        { lat: -22, lon: 154, height: 0.22, color: 0xebe3c7 },
        { lat: 35, lon: 210, height: 0.3, color: 0xf09214 },
        { lat: -12, lon: 268, height: 0.28, color: 0xaa2e1c },
        { lat: 8, lon: 324, height: 0.42, color: 0xebe3c7 },
      ];
      for (const marker of markers) {
        const phi = THREE.MathUtils.degToRad(90 - marker.lat);
        const theta = THREE.MathUtils.degToRad(marker.lon);
        const normal = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        );
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, marker.height, 0.13),
          new THREE.MeshStandardMaterial({ color: marker.color, roughness: 0.7 }),
        );
        building.position.copy(normal.clone().multiplyScalar(1.65 + marker.height / 2));
        building.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        globe.add(building);
      }

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = 1.5;

      const resize = () => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const render = () => {
        frame = requestAnimationFrame(render);
        controls.update();
        renderer.render(scene, camera);
      };
      render();
      host.dataset.ready = "true";
      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        delete host.dataset.ready;
      };
    })().catch(() => {
      if (!disposed) host.dataset.error = "true";
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className="collection-globe-wrap">
      <div className="collection-globe" ref={hostRef} />
      <span>Drag the globe</span>
    </div>
  );
}
