import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const assetsRoot = path.join(root, 'assets');
const sourcePath = path.join(root, 'src/main.js');
const outputPath = path.join(root, 'world/asset-audit.json');
const strict = process.argv.includes('--strict');

const budgets = {
  hero: 35000,
  vehicle: 18000,
  tree: 8000,
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
  return manifest;
}

function readGlb(file) {
  const data = fs.readFileSync(file);
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: invalid GLB magic`);
  const jsonLength = data.readUInt32LE(12);
  return { json: JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8').trim()), data };
}

function quatMatrix(q) {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0,
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0,
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
}

function multiply(a, b) {
  const out = Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) for (let row = 0; row < 4; row += 1) {
    for (let k = 0; k < 4; k += 1) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  }
  return out;
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const translation = node.translation || [0, 0, 0];
  const scale = node.scale || [1, 1, 1];
  const rotation = quatMatrix(node.rotation || [0, 0, 0, 1]);
  rotation[0] *= scale[0]; rotation[1] *= scale[0]; rotation[2] *= scale[0];
  rotation[4] *= scale[1]; rotation[5] *= scale[1]; rotation[6] *= scale[1];
  rotation[8] *= scale[2]; rotation[9] *= scale[2]; rotation[10] *= scale[2];
  rotation[12] = translation[0]; rotation[13] = translation[1]; rotation[14] = translation[2];
  return rotation;
}

function transform(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function accessorBounds(gltf, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor?.min || !accessor?.max) throw new Error(`POSITION accessor ${accessorIndex} has no min/max`);
  return [accessor.min, accessor.max];
}

function inspect(entry) {
  const file = path.resolve(root, entry.url);
  const { json } = readGlb(file);
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const parents = Array(nodes.length).fill(-1);
  nodes.forEach((node, index) => (node.children || []).forEach((child) => { parents[child] = index; }));
  const worldMatrices = Array(nodes.length);
  const matrixFor = (index) => {
    if (worldMatrices[index]) return worldMatrices[index];
    const local = nodeMatrix(nodes[index]);
    worldMatrices[index] = parents[index] < 0 ? local : multiply(matrixFor(parents[index]), local);
    return worldMatrices[index];
  };
  nodes.forEach((_, index) => matrixFor(index));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  const materials = new Set();
  let meshCount = 0;
  for (const [nodeIndex, node] of nodes.entries()) {
    if (node.mesh === undefined) continue;
    meshCount += 1;
    const mesh = meshes[node.mesh];
    for (const primitive of mesh.primitives || []) {
      const positionIndex = primitive.attributes?.POSITION;
      if (positionIndex === undefined) continue;
      const [pMin, pMax] = accessorBounds(json, positionIndex);
      const corners = [];
      for (const x of [pMin[0], pMax[0]]) for (const y of [pMin[1], pMax[1]]) for (const z of [pMin[2], pMax[2]]) corners.push(transform(worldMatrices[nodeIndex], [x, y, z]));
      for (const point of corners) for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
      if (primitive.material !== undefined) materials.add(primitive.material);
      const indexCount = primitive.indices === undefined ? json.accessors[positionIndex].count : json.accessors[primitive.indices]?.count;
      const mode = primitive.mode ?? 4;
      if (mode === 4) triangles += Math.floor((indexCount || 0) / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, (indexCount || 0) - 2);
    }
  }
  const scale = entry.scale || 1;
  const dimensions = max.map((value, axis) => (value - min[axis]) * scale);
  const scaledMinY = min[1] * scale;
  const scaledMaxY = max[1] * scale;
  const kind = entry.name === 'engineer' || entry.name === 'van' ? 'vehicle' :
    /palm|tree|supertree|raintree/.test(entry.name) ? 'tree' :
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
    overBudget: triangles > budget,
  };
}

const manifest = readManifest();
const entries = [];
const failures = [];
for (const entry of manifest) {
  try { entries.push(inspect(entry)); }
  catch (error) { failures.push(`${entry.name}: ${error.message}`); }
}
const referenced = new Set(manifest.map((entry) => entry.url));
const allGlbs = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.glb')) allGlbs.push(path.relative(root, file).split(path.sep).join('/'));
  }
}
walk(assetsRoot);
const unreferenced = allGlbs.filter((file) => !referenced.has(file));
const report = {
  generatedAt: new Date().toISOString(),
  manifest: entries,
  unreferenced,
  failures,
  summary: {
    assets: entries.length,
    triangles: entries.reduce((sum, entry) => sum + entry.triangles, 0),
    unreferenced: unreferenced.length,
    assetsOverBudget: entries.filter((entry) => entry.overBudget).length,
    materialsOverBudget: entries.filter((entry) => entry.materials > 4).length,
    ungrounded: entries.filter((entry) => Math.abs(entry.minY) > 0.01).length,
    uncompressed: entries.filter((entry) => !entry.compressed).length,
  },
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

for (const entry of entries) {
  if (entry.overBudget) failures.push(`${entry.name}: ${entry.triangles} triangles exceeds ${entry.budget}`);
  if (entry.materials > 4) failures.push(`${entry.name}: ${entry.materials} material families exceeds 4`);
  if (Math.abs(entry.minY) > 0.01) failures.push(`${entry.name}: minY ${entry.minY.toFixed(3)} is not ground contact`);
  if (!entry.compressed) failures.push(`${entry.name}: GLB is not Draco-compressed`);
}
if (unreferenced.length) failures.push(`Unreferenced GLBs: ${unreferenced.join(', ')}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  if (strict) process.exitCode = 1;
}
console.log(`WORLD  ${entries.length} manifest assets · ${report.summary.triangles.toLocaleString()} triangles · ${unreferenced.length} unreferenced GLBs`);
if (!failures.length) console.log('PASS  World asset audit passed.');
else console.log(`AUDIT  ${failures.length} findings written to world/asset-audit.json`);
