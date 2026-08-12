"use client";

import { useEffect, useRef } from "react";
import globeSpec from "../data/kampung-call-globe.json";

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
      camera.position.set(0, 1.25, 6.4);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Rotating Kampung Call Film Park globe");
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfff4d1, 0x1f4b61, 3.4));
      const key = new THREE.DirectionalLight(0xffffff, 4.2);
      key.position.set(4, 7, 6);
      scene.add(key);

      const gradient = new THREE.DataTexture(new Uint8Array([38, 112, 200, 255]), 4, 1, THREE.RedFormat);
      gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
      gradient.generateMipmaps = false;
      gradient.needsUpdate = true;
      const toon = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: gradient });

      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = globeSpec.texture.width;
      textureCanvas.height = globeSpec.texture.height;
      const context = textureCanvas.getContext("2d");
      if (!context) throw new Error("Canvas texture unavailable");
      context.fillStyle = globeSpec.texture.ocean;
      context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      context.fillStyle = globeSpec.texture.land;
      for (const [x, y, radiusX, radiusY, rotation] of globeSpec.texture.continents) {
        context.beginPath();
        context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
        context.fill();
      }
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const display = new THREE.Group();
      display.rotation.z = -0.05;
      scene.add(display);
      const { fountain, ring, sphere } = globeSpec;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(fountain.baseTopRadius, fountain.baseBottomRadius, fountain.baseHeight, fountain.baseSegments),
        toon(fountain.baseColor),
      );
      base.position.y = fountain.baseHeight / 2;
      display.add(base);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(fountain.waterRadius, fountain.waterRadius, fountain.waterHeight, fountain.waterSegments),
        toon(fountain.waterColor),
      );
      water.position.y = fountain.baseHeight + fountain.waterHeight / 2 - 0.03;
      display.add(water);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(sphere.radius, sphere.widthSegments, sphere.heightSegments),
        new THREE.MeshToonMaterial({ map: texture, gradientMap: gradient }),
      );
      planet.position.y = sphere.height;
      display.add(planet);
      const orbitRing = new THREE.Mesh(
        new THREE.TorusGeometry(ring.radius, ring.tube, ring.radialSegments, ring.tubularSegments),
        toon(ring.color),
      );
      orbitRing.position.y = ring.height;
      orbitRing.rotation.x = ring.rotationX;
      display.add(orbitRing);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.target.set(0, 1.15, 0);
      controls.update();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clock = new THREE.Clock();

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
        if (!reducedMotion) planet.rotation.y = clock.getElapsedTime() * 0.5;
        controls.update();
        renderer.render(scene, camera);
      };
      render();
      host.dataset.ready = "true";
      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        controls.dispose();
        texture.dispose();
        gradient.dispose();
        display.traverse((object) => {
          if (!("isMesh" in object) || !object.isMesh) return;
          const mesh = object as InstanceType<typeof THREE.Mesh>;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        });
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
      <div className="collection-globe" ref={hostRef}>
        <div className="collection-globe-fallback" aria-hidden="true">
          <span className="fallback-orbit" />
          <span className="fallback-planet"><i /><i /><i /></span>
          <span className="fallback-water" />
          <span className="fallback-base" />
        </div>
      </div>
      <span>Move the globe</span>
    </div>
  );
}
