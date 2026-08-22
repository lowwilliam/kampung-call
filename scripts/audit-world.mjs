import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getBounds, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { root } from './lib/project.mjs';

const assetsRoot = path.join(root, 'assets');
const sourcePath = path.join(root, 'src/main.js');
const outputPath = path.join(root, 'world/asset-audit.json');
const strict = process.argv.includes('--strict');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const budgets = {
  hero: 35000,
  vehicle: 18000,
  tree: 8000,
  kit: 12000,
  prop: 2000,
};

function readManifest() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const manifest = [];
  const block = source.slice(source.indexOf('const ASSET_MANIFEST='), source.indexOf('// convert imported materials', source.indexOf('const ASSET_MANIFEST=')));
  const re = /^\s*([A-Za-z0-9_]+):\s*\{url:'([^']+)'([^}]*)\},?\s*$/gm;
  for (const match of block.matchAll(re)) {
    const scale = match[3].match(/scale\s*:\s*([0-9.]+)/)?.[1];
    manifest.push({ name: match[1], url: match[2], scale: Number(scale || 1) });
  }
  const residents = source.match(/const RESIDENT_ASSETS=(\[[^;]+\]);/)?.[1];
  if (residents) {
    for (const name of residents.matchAll(/'([^']+)'/g)) {
      manifest.push({ name: `resident:${name[1]}`, url: `assets/residents/${name[1]}.glb`, scale: 1 });
    }
  }
  const heritageCatalogPath = path.join(root, 'showcase', 'app', 'data', 'lost-heritage-assets.json');
  if (fs.existsSync(heritageCatalogPath)) {
    const heritageAssets = JSON.parse(fs.readFileSync(heritageCatalogPath, 'utf8'));
    for (const asset of heritageAssets) {
      manifest.push({ name: asset.id, url: `assets/${asset.file}`, scale: 1 });
    }
  }
  // The public catalogue also contains standalone, production-ready components
  // that are intentionally not instantiated in the game world. They still ship,
  // so audit them instead of misclassifying them as dead GLBs.
  const cataloguePath = path.join(root, 'showcase', 'app', 'data', 'catalogue-manifest.json');
  if (fs.existsSync(cataloguePath)) {
    const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));
    const knownUrls = new Set(manifest.map((entry) => entry.url));
    for (const asset of catalogue.assets || []) {
      const url = asset.model?.sourcePath;
      if (!url?.endsWith('.glb') || knownUrls.has(url)) continue;
      manifest.push({ name: `catalogue:${asset.slug}`, url, scale: 1, catalogueOnly: true });
      knownUrls.add(url);
    }
  }
  // Dedicated experience pages may load canonical GLBs outside the main world
  // and collection manifests. Include their static import.meta.url references
  // so valid page assets are audited instead of reported as dead files.
  const standaloneSources = [path.join(root, 'src', 'loadAlfaRomeoGiuliaSpiderModel.js')];
  const knownUrls = new Set(manifest.map((entry) => entry.url));
  for (const standaloneSource of standaloneSources) {
    if (!fs.existsSync(standaloneSource)) continue;
    const source = fs.readFileSync(standaloneSource, 'utf8');
    for (const match of source.matchAll(/\.\.\/(assets\/[A-Za-z0-9_./-]+\.glb)/g)) {
      const url = match[1];
      if (knownUrls.has(url)) continue;
      manifest.push({ name: `experience:${path.basename(url, '.glb')}`, url, scale: 1, experienceOnly: true });
      knownUrls.add(url);
    }
  }
  return manifest;
}

function readGlb(file) {
  const data = fs.readFileSync(file);
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: invalid GLB magic`);
  const jsonLength = data.readUInt32LE(12);
  return { json: JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8').trim()), data };
}

async function inspect(entry) {
  const file = path.resolve(root, entry.url);
  const { json } = readGlb(file);
  const document = await io.read(file);
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${file}: GLB has no scene`);
  // Read decoded geometry bounds. Draco-compressed accessors may retain stale
  // JSON min/max metadata after transforms, so parsing the GLB JSON alone can
  // incorrectly report a grounded model as floating (or the reverse).
  const { min, max } = getBounds(scene);
  let triangles = 0;
  const materials = new Set();
  let meshCount = 0;
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    meshCount += 1;
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION');
      if (!positions) continue;
      if (primitive.getMaterial()) materials.add(primitive.getMaterial());
      const indexCount = primitive.getIndices()?.getCount() ?? positions.getCount();
      const mode = primitive.getMode();
      if (mode === 4) triangles += Math.floor((indexCount || 0) / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, (indexCount || 0) - 2);
    }
  }
  const scale = entry.scale || 1;
  const dimensions = max.map((value, axis) => (value - min[axis]) * scale);
  const scaledMinY = min[1] * scale;
  const scaledMaxY = max[1] * scale;
  const kind = entry.catalogueOnly ? 'hero' :
    entry.name === 'engineer' || entry.name === 'van' ? 'vehicle' :
    /palm|tree|supertree|raintree/.test(entry.name) ? 'tree' :
      /props/i.test(entry.name) ? 'kit' :
      /bench|postbox|kit|busstop|bridge|bicycle|birdcage|cat|prop|service/.test(entry.name) ? 'prop' : 'hero';
  const budget = budgets[kind];
  return {
    name: entry.name,
    url: entry.url,
    scale,
    dimensions: { width: dimensions[0], height: dimensions[1], depth: dimensions[2] },
    minY: scaledMinY,
    maxY: scaledMaxY,
    requiredRadius: Math.hypot(dimensions[0], dimensions[2]) / 2,
    triangles,
    materials: materials.size,
    meshCount,
    compressed: Boolean(json.extensionsUsed?.includes('KHR_draco_mesh_compression') || json.extensionsRequired?.includes('KHR_draco_mesh_compression')),
    kind,
    budget,
    materialBudget: entry.catalogueOnly ? 8 : 4,
    overBudget: triangles > budget,
  };
}

const manifest = readManifest();
const entries = [];
const failures = [];
for (const entry of manifest) {
  try { entries.push(await inspect(entry)); }
  catch (error) { failures.push(`${entry.name}: ${error.message}`); }
}
const referenced = new Set(manifest.map((entry) => entry.url));
// Only versioned assets can enter a reproducible release. Local Blender exports,
// legacy aliases, and Finder-created " 2" duplicates must not contaminate the
// canonical audit or make a clean CI checkout disagree with a developer machine.
const allGlbs = execFileSync('git', ['ls-files', '--', 'assets/*.glb', 'assets/**/*.glb'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean);
const unreferenced = allGlbs.filter((file) => !referenced.has(file));
const legacyBrandedAssets = allGlbs.filter((file) => /(?:smu|nus|ntu|sutd|mbs|merlion|esplanade|singapore-bus|mrt-train)/i.test(path.basename(file)));
const report = {
  generatedAt: new Date().toISOString(),
  manifest: entries,
  unreferenced,
  legacyBrandedAssets,
  failures,
  summary: {
    assets: entries.length,
    triangles: entries.reduce((sum, entry) => sum + entry.triangles, 0),
    unreferenced: unreferenced.length,
    assetsOverBudget: entries.filter((entry) => entry.overBudget).length,
    materialsOverBudget: entries.filter((entry) => entry.materials > entry.materialBudget).length,
    ungrounded: entries.filter((entry) => Math.abs(entry.minY) > 0.01).length,
    uncompressed: entries.filter((entry) => !entry.compressed).length,
  },
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

for (const entry of entries) {
  if (entry.overBudget) failures.push(`${entry.name}: ${entry.triangles} triangles exceeds ${entry.budget}`);
  if (entry.materials > entry.materialBudget) failures.push(`${entry.name}: ${entry.materials} material families exceeds ${entry.materialBudget}`);
  if (Math.abs(entry.minY) > 0.01) failures.push(`${entry.name}: minY ${entry.minY.toFixed(3)} is not ground contact`);
  if (!entry.compressed) failures.push(`${entry.name}: GLB is not Draco-compressed`);
}
if (unreferenced.length) failures.push(`Unreferenced GLBs: ${unreferenced.join(', ')}`);
if (legacyBrandedAssets.length) failures.push(`Legacy branded asset filenames: ${legacyBrandedAssets.join(', ')}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  if (strict) process.exitCode = 1;
}
console.log(`WORLD  ${entries.length} manifest assets · ${report.summary.triangles.toLocaleString()} triangles · ${unreferenced.length} unreferenced GLBs`);
if (!failures.length) console.log('PASS  World asset audit passed.');
else console.log(`AUDIT  ${failures.length} findings written to world/asset-audit.json`);
