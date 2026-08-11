"use client";

import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useEffect, useRef, useState } from "react";

type ModelViewerProps = {
  url: string;
  label: string;
  expanded?: boolean;
  eager?: boolean;
};

type LoaderInstance = InstanceType<typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader>;

const MAX_SIMULTANEOUS_LOADS = 3;
let activeLoads = 0;
const priorityQueue: Array<() => void> = [];
const standardQueue: Array<() => void> = [];
const modelCache = new Map<string, Promise<GLTF>>();

const runtimePromise = Promise.all([
  import("three"),
  import("three/examples/jsm/loaders/GLTFLoader.js"),
  import("three/examples/jsm/loaders/DRACOLoader.js"),
  import("three/examples/jsm/controls/OrbitControls.js"),
  import("three/examples/jsm/utils/SkeletonUtils.js"),
]).then(([THREE, gltfModule, dracoModule, controlsModule, skeletonUtils]) => {
  THREE.Cache.enabled = true;
  return {
    THREE,
    GLTFLoader: gltfModule.GLTFLoader,
    DRACOLoader: dracoModule.DRACOLoader,
    OrbitControls: controlsModule.OrbitControls,
    cloneScene: skeletonUtils.clone,
  };
});

let loaderPromise: Promise<LoaderInstance> | null = null;

function getLoader() {
  if (!loaderPromise) {
    loaderPromise = runtimePromise.then(({ GLTFLoader, DRACOLoader }) => {
      const draco = new DRACOLoader();
      draco.setDecoderPath("/draco/");
      draco.setWorkerLimit(2);
      draco.preload();
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      return loader;
    });
  }
  return loaderPromise;
}

function drainLoadQueue() {
  while (activeLoads < MAX_SIMULTANEOUS_LOADS) {
    const next = priorityQueue.shift() ?? standardQueue.shift();
    if (!next) return;
    activeLoads += 1;
    next();
  }
}

function scheduleLoad<T>(task: () => Promise<T>, priority: boolean) {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      void task()
        .then(resolve, reject)
        .finally(() => {
          activeLoads -= 1;
          drainLoadQueue();
        });
    };
    (priority ? priorityQueue : standardQueue).push(run);
    drainLoadQueue();
  });
}

function loadModel(url: string, priority: boolean) {
  const existing = modelCache.get(url);
  if (existing) return existing;
  const request = scheduleLoad(async () => (await getLoader()).loadAsync(url), priority).catch((error) => {
    modelCache.delete(url);
    throw error;
  });
  modelCache.set(url, request);
  return request;
}

export function ModelViewer({ url, label, expanded = false, eager = false }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(eager);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [clips, setClips] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationApi = useRef<{ play(name: string): void } | null>(null);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === hostRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: expanded ? "0px" : "160px 0px", threshold: 0.01 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !nearViewport) return;
    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanup = () => {};
    setStatus("loading");

    void (async () => {
      const [{ THREE, OrbitControls, cloneScene }, gltf] = await Promise.all([
        runtimePromise,
        loadModel(url, eager || expanded),
      ]);
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 2000);
      camera.position.set(4, 2.4, 6);
      const renderer = new THREE.WebGLRenderer({
        antialias: expanded,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, expanded ? 1.75 : 1.15));
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
      controls.autoRotate = true;
      controls.autoRotateSpeed = expanded ? 1.15 : 1.8;
      controls.enablePan = false;

      const clock = new THREE.Clock();
      let mixer: InstanceType<typeof THREE.AnimationMixer> | null = null;
      const objectRoot = cloneScene(gltf.scene);
      let fitDistance = 5;

      objectRoot.traverse((child) => {
        if ("isMesh" in child && child.isMesh) {
          const mesh = child as InstanceType<typeof THREE.Mesh>;
          mesh.castShadow = expanded;
          mesh.receiveShadow = true;
        }
      });
      scene.add(objectRoot);

      const fit = () => {
        const bounds = new THREE.Box3().setFromObject(objectRoot);
        if (bounds.isEmpty()) return;
        const centre = bounds.getCenter(new THREE.Vector3());
        objectRoot.position.sub(centre);
        const centredBounds = new THREE.Box3().setFromObject(objectRoot);
        const sphere = centredBounds.getBoundingSphere(new THREE.Sphere());
        const radius = Math.max(sphere.radius, 0.25);
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const limitingFov = Math.min(verticalFov, horizontalFov);
        fitDistance = (radius / Math.sin(limitingFov / 2)) * (expanded ? 1.12 : 1.2);
        const viewDirection = new THREE.Vector3(0.72, 0.34, 1.08).normalize();
        camera.position.copy(viewDirection.multiplyScalar(fitDistance));
        camera.near = Math.max(fitDistance - radius * 2.5, radius / 100, 0.01);
        camera.far = Math.max(fitDistance + radius * 5, 100);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = Math.max(fitDistance * 0.55, radius * 1.05);
        controls.maxDistance = fitDistance * 2.4;
        controls.update();
        controls.saveState();
      };

      const resize = () => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        fit();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(objectRoot);
        const clipNames = gltf.animations.map((clip, index) => clip.name || `Clip ${index + 1}`);
        setClips(clipNames);
        const first = clipNames.find((name) => /idle/i.test(name)) ?? clipNames[0];
        setActiveClip(first);
        const play = (name: string) => {
          mixer?.stopAllAction();
          const clip = gltf.animations.find((item) => (item.name || "") === name) ?? gltf.animations[0];
          mixer?.clipAction(clip, objectRoot).reset().fadeIn(0.2).play();
        };
        animationApi.current = { play };
        play(first);
      }

      const render = () => {
        frame = requestAnimationFrame(render);
        const delta = Math.min(clock.getDelta(), 0.05);
        mixer?.update(delta);
        controls.update(delta);
        renderer.render(scene, camera);
      };
      render();
      setStatus("ready");

      const reset = () => controls.reset();
      host.dataset.viewerReady = "true";
      host.addEventListener("viewer-reset", reset);
      cleanup = () => {
        host.removeEventListener("viewer-reset", reset);
        delete host.dataset.viewerReady;
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        mixer?.stopAllAction();
      };
    })().catch(() => {
      if (!disposed) setStatus("error");
    });

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

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === hostRef.current) {
      await document.exitFullscreen?.();
    } else {
      await hostRef.current?.requestFullscreen?.();
    }
  };

  return (
    <div className={`model-viewer ${expanded ? "is-expanded" : ""}`} ref={hostRef}>
      {status !== "ready" && (
        <div className={`viewer-status ${status === "error" ? "is-error" : ""}`}>
          <span className="viewer-orbit" aria-hidden="true" />
          <span>{status === "error" ? "Model unavailable" : "Loading 360° view"}</span>
        </div>
      )}
      {expanded && status === "ready" && (
        <div className="viewer-controls" aria-label="3D viewer controls">
          <button type="button" onClick={() => hostRef.current?.dispatchEvent(new Event("viewer-reset"))}>Reset</button>
          <button type="button" onClick={() => void toggleFullscreen()}>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
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
