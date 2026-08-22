import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const assetUrl = new URL('../assets/alfa-romeo-giulia-spider-v2.glb', import.meta.url).href;

const semanticNames = [
  'body-shell', 'hood', 'trunk-lid', 'left-door', 'right-door', 'running-gear',
  'front-fascia', 'rear-fascia', 'cabin', 'steering-system', 'windshield',
];

function addRuntime(root) {
  const nodes = {};
  const meshes = {};
  const parts = [];
  root.updateMatrixWorld(true);
  const modelCentre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  for (const id of semanticNames) {
    const part = root.getObjectByName(id);
    if (!part) continue;
    nodes[id] = part;
    part.userData.componentId = id;
    part.userData.basePosition = part.position.clone();
    part.userData.explodeVector = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()).sub(modelCentre);
    if (part.userData.explodeVector.lengthSq() < .01) part.userData.explodeVector.set(0, .3, 0);
    part.traverse((entry) => {
      if (!entry.isMesh) return;
      entry.castShadow = true;
      entry.receiveShadow = true;
      entry.userData.componentId = id;
      meshes[entry.uuid] = entry;
    });
    parts.push(part);
  }
  const steering = nodes['steering-system'];
  function setExplode(amount = 0) {
    for (const part of parts) part.position.copy(part.userData.basePosition).addScaledVector(part.userData.explodeVector, amount * .58);
  }
  root.userData = {
    assetId: '1963-alfa-romeo-giulia-spider-v2',
    productionMethod: 'reference-led procedural Blender CLI model exported to glTF and loaded by Three.js',
    disclosure: 'Approximate reconstruction from eight museum photographs; hidden mechanical areas are inferred.',
    sculptRuntime: {
      nodes, meshes,
      sockets: Object.fromEntries(parts.map((part) => [`socket-${part.name}`, part])),
      colliders: Object.fromEntries(parts.map((part) => [part.name, { type: 'bounds', target: part.name }])),
      destructionGroups: Object.fromEntries(parts.map((part) => [part.name, [part.name]])),
      manifest: { id: root.userData.assetId, partCount: parts.length, meshCount: Object.keys(meshes).length, animationReady: true },
      setExplode,
      setDoorOpen(amount = 0) {
        if (nodes['left-door']) nodes['left-door'].rotation.y = -amount * .55;
        if (nodes['right-door']) nodes['right-door'].rotation.y = amount * .55;
      },
      setHoodOpen(amount = 0) { if (nodes.hood) nodes.hood.rotation.z = -amount * .34; },
      setSteeringAngle(amount = 0) { if (steering) steering.rotation.x = amount; },
    },
  };
  return root;
}

export async function loadAlfaRomeoGiuliaSpiderModel() {
  const gltf = await new GLTFLoader().loadAsync(assetUrl);
  const root = gltf.scene;
  root.name = '1963-alfa-romeo-giulia-spider-v2';
  return addRuntime(root);
}
