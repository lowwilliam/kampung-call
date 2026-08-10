"use client";

import { useEffect, useRef, useState } from "react";

type ModelViewerProps = {
  url: string;
  label: string;
  expanded?: boolean;
  eager?: boolean;
};

export function ModelViewer({ url, label, expanded = false, eager = false }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(eager);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [clips, setClips] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<string>("");
  const animationApi = useRef<{ play(name: string): void } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || eager) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "260px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !nearViewport) return;
    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanup = () => {};
    setStatus("loading");

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 2000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, expanded ? 2 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = expanded;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute("aria-label", `360 degree view of ${label}`);
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfff7df, 0x06383b, 2.4));
      const key = new THREE.DirectionalLight(0xffedc8, 4.2);
      key.position.set(5, 8, 6);
      key.castShadow = expanded;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x5ed0c2, 2.2);
      rim.position.set(-6, 4, -5);
      scene.add(rim);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = expanded ? 0.8 : 1.15;
      controls.enablePan = false;
      controls.minDistance = 0.7;
      controls.maxDistance = 120;

      const draco = new DRACOLoader();
      draco.setDecoderPath("/draco/");
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      const clock = new THREE.Clock();
      let mixer: InstanceType<typeof THREE.AnimationMixer> | null = null;
      let objectRoot: InstanceType<typeof THREE.Object3D> | null = null;
      let baseDistance = 5;

      const fit = (root: InstanceType<typeof THREE.Object3D>) => {
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        root.position.sub(centre);
        root.position.y += size.y / 2;
        const maxDim = Math.max(size.x, size.y, size.z, 0.5);
        baseDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
        camera.position.set(baseDistance * 0.72, baseDistance * 0.4, baseDistance * 1.12);
        camera.near = Math.max(maxDim / 100, 0.01);
        camera.far = Math.max(maxDim * 50, 100);
        camera.updateProjectionMatrix();
        controls.target.set(0, size.y * 0.08, 0);
        controls.minDistance = baseDistance * 0.55;
        controls.maxDistance = baseDistance * 2.1;
        controls.update();
      };

      loader.load(
        url,
        (gltf) => {
          if (disposed) return;
          objectRoot = gltf.scene;
          objectRoot.traverse((child) => {
            if ("isMesh" in child && child.isMesh) {
              const mesh = child as InstanceType<typeof THREE.Mesh>;
              mesh.castShadow = expanded;
              mesh.receiveShadow = true;
            }
          });
          scene.add(objectRoot);
          fit(objectRoot);
          if (gltf.animations.length) {
            mixer = new THREE.AnimationMixer(objectRoot);
            const clipNames = gltf.animations.map((clip) => clip.name || `Clip ${gltf.animations.indexOf(clip) + 1}`);
            setClips(clipNames);
            const first = clipNames.find((name) => /idle/i.test(name)) ?? clipNames[0];
            setActiveClip(first);
            const play = (name: string) => {
              mixer?.stopAllAction();
              const clip = gltf.animations.find((item) => (item.name || "") === name) ?? gltf.animations[0];
              mixer?.clipAction(clip).reset().fadeIn(0.2).play();
            };
            animationApi.current = { play };
            play(first);
          }
          setStatus("ready");
        },
        undefined,
        () => setStatus("error"),
      );

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
        const delta = Math.min(clock.getDelta(), 0.05);
        mixer?.update(delta);
        controls.update();
        renderer.render(scene, camera);
      };
      render();

      const reset = () => {
        camera.position.set(baseDistance * 0.72, baseDistance * 0.4, baseDistance * 1.12);
        controls.reset();
      };
      host.dataset.viewerReady = "true";
      host.addEventListener("viewer-reset", reset);
      cleanup = () => {
        host.removeEventListener("viewer-reset", reset);
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        controls.dispose();
        draco.dispose();
        scene.traverse((child) => {
          if ("geometry" in child) (child as InstanceType<typeof THREE.Mesh>).geometry?.dispose?.();
          if ("material" in child) {
            const material = (child as InstanceType<typeof THREE.Mesh>).material;
            (Array.isArray(material) ? material : [material]).forEach((item) => item?.dispose?.());
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        objectRoot = null;
      };
    })().catch(() => setStatus("error"));

    return () => {
      disposed = true;
      cleanup();
      animationApi.current = null;
      setClips([]);
    };
  }, [url, label, expanded, eager, nearViewport]);

  const playClip = (name: string) => {
    setActiveClip(name);
    animationApi.current?.play(name);
  };

  return (
    <div className={`model-viewer ${expanded ? "is-expanded" : ""}`} ref={hostRef}>
      {status !== "ready" && (
        <div className={`viewer-status ${status === "error" ? "is-error" : ""}`}>
          <span className="viewer-orbit" aria-hidden="true" />
          <span>{status === "error" ? "Model unavailable" : "Preparing 360° view"}</span>
        </div>
      )}
      {expanded && status === "ready" && (
        <div className="viewer-controls" aria-label="3D viewer controls">
          <button type="button" onClick={() => hostRef.current?.dispatchEvent(new Event("viewer-reset"))}>Reset</button>
          <button type="button" onClick={() => void hostRef.current?.requestFullscreen?.()}>Fullscreen</button>
        </div>
      )}
      {expanded && clips.length > 0 && (
        <div className="animation-controls" aria-label="Animation controls">
          {clips.map((clip) => (
            <button key={clip} type="button" className={activeClip === clip ? "is-active" : ""} onClick={() => playClip(clip)}>
              {clip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
