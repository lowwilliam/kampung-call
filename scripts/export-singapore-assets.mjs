import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { singaporeAssetFactories } from '../src/singapore-assets/models.js';
import { root } from './lib/project.mjs';

class NodeFileReader {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((value) => {
      this.result = value;
      queueMicrotask(() => this.onloadend?.());
    });
  }

  readAsDataURL(blob) {
    void blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;
      queueMicrotask(() => this.onloadend?.());
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

const outputRoot = path.join(root, 'research', 'img2threejs', 'singapore-assets', 'raw');
const exporter = new GLTFExporter();
fs.mkdirSync(outputRoot, { recursive: true });

function inspect(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const materials = new Set();
  let meshes = 0;
  let triangles = 0;
  object.traverse((child) => {
    if (!child.isMesh) return;
    meshes += 1;
    triangles += Math.floor((child.geometry.index?.count ?? child.geometry.attributes.position?.count ?? 0) / 3);
    const assigned = Array.isArray(child.material) ? child.material : [child.material];
    assigned.filter(Boolean).forEach((entry) => materials.add(entry.uuid));
  });
  return {
    meshes,
    triangles,
    materials: materials.size,
    dimensions: size.toArray().map((value) => Number(value.toFixed(4))),
  };
}

function prepareForExport(object, assetId) {
  const disclosure = object.userData.disclosure;
  object.userData = {
    assetId,
    disclosure,
    productionMethod: 'Reference-led procedural Three.js; Blender CLI refinement',
  };
  object.traverse((child) => {
    if (child === object) return;
    child.userData = child.userData.componentId ? { componentId: child.userData.componentId } : {};
  });
  const bounds = new THREE.Box3().setFromObject(object);
  object.position.y -= bounds.min.y;
  object.updateMatrixWorld(true);
}

const results = {};
for (const [assetId, factory] of Object.entries(singaporeAssetFactories)) {
  const object = factory();
  prepareForExport(object, assetId);
  results[assetId] = inspect(object);
  const outputPath = path.join(outputRoot, `${assetId}.glb`);
  const bytes = await exporter.parseAsync(object, {
    binary: true,
    onlyVisible: false,
    trs: true,
  });
  fs.writeFileSync(outputPath, Buffer.from(bytes));
  console.log(`[singapore-assets] ${assetId} -> ${path.relative(root, outputPath)}`);
}

fs.writeFileSync(path.join(outputRoot, 'threejs-metrics.json'), `${JSON.stringify(results, null, 2)}\n`);
