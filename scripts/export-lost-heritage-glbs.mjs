import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import collection from '../research/lost-singapore-buildings/collection.json' with { type: 'json' };
import { profiles } from '../research/lost-singapore-buildings/profiles.mjs';
import { createLandmark } from '../src/lost-heritage/models.js';
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

const outputRoot = path.join(root, 'assets', 'lost-heritage');
const catalogPath = path.join(root, 'showcase', 'app', 'data', 'lost-heritage-assets.json');
const hashesPath = path.join(root, 'showcase', 'app', 'data', 'heritage-model-hashes.json');
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lost-heritage-glb-'));
const exporter = new GLTFExporter();
const onlyArg = process.argv.find((argument) => argument.startsWith('--only='));
const onlyId = onlyArg?.slice('--only='.length);
const existingCatalog = onlyId && fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  : [];
const existingHashes = onlyId && fs.existsSync(hashesPath)
  ? JSON.parse(fs.readFileSync(hashesPath, 'utf8'))
  : {};

fs.mkdirSync(outputRoot, { recursive: true });

function inspect(rootObject) {
  const bounds = new THREE.Box3().setFromObject(rootObject);
  const size = bounds.getSize(new THREE.Vector3());
  const materialIds = new Set();
  let triangles = 0;
  let meshCount = 0;
  rootObject.traverse((child) => {
    if (!child.isMesh) return;
    meshCount += 1;
    const geometry = child.geometry;
    triangles += Math.floor((geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => materialIds.add(material.uuid));
  });
  return {
    triangles,
    materials: materialIds.size,
    meshCount,
    compressed: true,
    dimensions: { width: size.x, height: size.y, depth: size.z },
  };
}

function cleanForExport(object, building) {
  object.userData = {
    heritageId: building.id,
    disclosure: collection.modelingDisclosure,
  };
  object.traverse((child) => {
    if (child !== object) child.userData = {};
  });
  const bounds = new THREE.Box3().setFromObject(object);
  object.position.y -= bounds.min.y;
  object.updateMatrixWorld(true);
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const catalog = [];
const hashes = {};

for (const building of collection.buildings) {
  const relativeFile = `lost-heritage/${building.id}.glb`;
  if (onlyId && building.id !== onlyId) {
    const previous = existingCatalog.find((entry) => entry.file === relativeFile);
    if (!previous || !existingHashes[relativeFile]) {
      throw new Error(`Cannot preserve missing catalogue data for ${building.id}`);
    }
    catalog.push(previous);
    hashes[relativeFile] = existingHashes[relativeFile];
    continue;
  }
  const profile = profiles[building.id];
  if (!profile) throw new Error(`Missing reconstruction profile for ${building.id}`);
  const object = createLandmark({ ...building, ...profile });
  cleanForExport(object, building);
  const metrics = inspect(object);
  const rawPath = path.join(workRoot, `${building.id}.raw.glb`);
  const outputPath = path.join(root, 'assets', relativeFile);
  const bytes = await exporter.parseAsync(object, { binary: true, onlyVisible: false });
  fs.writeFileSync(rawPath, Buffer.from(bytes));
  execFileSync(
    'npm',
    ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'draco', rawPath, outputPath],
    { cwd: root, stdio: 'inherit' },
  );
  hashes[relativeFile] = sha256(outputPath);
  catalog.push({
    id: `lost-${building.id}`,
    name: building.name,
    file: relativeFile,
    category: 'Lost Heritage',
    intro: building.heritageCase,
    gameContext: 'Part of Lost Singapore, a research-led series of thirteen procedural reconstructions prepared for close inspection.',
    singaporeContext: `Opened ${building.opened} at ${building.location}; removed ${building.removed}. ${building.heritageCase}`,
    inspiration: `Opened ${building.opened} · Removed ${building.removed} · ${building.location}`,
    historySource: { label: 'Read the historical source', url: building.sources[0] },
    featured: true,
    provenance: 'Lost Singapore reconstruction',
    provenanceDetail: collection.modelingDisclosure,
    productionStory: `Procedurally assembled from ${profile.details.length} documented form and detail cues. Hidden elevations, inaccessible dimensions and altered late-life conditions remain explicitly approximate.`,
    metrics,
  });
  console.log(`[heritage] ${building.name} → ${relativeFile}`);
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(hashesPath, `${JSON.stringify(hashes, null, 2)}\n`);
console.log(onlyId ? `Exported ${onlyId}; preserved ${catalog.length - 1} catalogue entries.` : `Exported ${catalog.length} Lost Singapore GLBs.`);
