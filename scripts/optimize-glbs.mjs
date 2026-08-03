import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './lib/project.mjs';

const reportPath = path.join(root, 'world/asset-audit.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kampung-glb-'));
const seen = new Set();

function compactMaterialFamilies(file) {
  const data = fs.readFileSync(file);
  const jsonLength = data.readUInt32LE(12);
  const jsonStart = 20;
  const json = JSON.parse(data.subarray(jsonStart, jsonStart + jsonLength).toString('utf8').trim());
  const materials = json.materials || [];
  const family = (material, index) => {
    const name = String(material?.name || '').toLowerCase();
    if (/plant|leaf|grass|green|vegetation/.test(name)) return 2;
    if (/glass|window|water/.test(name)) return 1;
    if (/ink|black|dark|metal/.test(name)) return 0;
    if (/clay|terracotta|red|orange|yellow|timber|wood/.test(name)) return 3;
    return index % 4;
  };
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) {
    if (primitive.material !== undefined) primitive.material = family(materials[primitive.material], primitive.material);
  }
  const nextJson = Buffer.from(JSON.stringify(json));
  const paddedJsonLength = Math.ceil(nextJson.length / 4) * 4;
  const paddedJson = Buffer.concat([nextJson, Buffer.alloc(paddedJsonLength - nextJson.length, 0x20)]);
  const output = Buffer.alloc(data.length - jsonLength + paddedJsonLength);
  data.copy(output, 0, 0, 12);
  output.writeUInt32LE(paddedJsonLength, 12);
  output.writeUInt32LE(data.readUInt32LE(16), 16);
  paddedJson.copy(output, 20);
  data.copy(output, 20 + paddedJsonLength, 20 + jsonLength);
  output.writeUInt32LE(output.length, 8);
  fs.writeFileSync(file, output);
}

for (const entry of report.manifest) {
  if (seen.has(entry.url)) continue;
  seen.add(entry.url);
  const input = path.join(root, entry.url);
  const optimized = path.join(work, path.basename(entry.url));
  const centered = path.join(work, `centered-${path.basename(entry.url)}`);
  const animated = entry.name === 'engineer' || entry.name.startsWith('resident:');
  const args = ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'optimize', input, optimized,
    '--compress', 'draco', '--texture-compress', 'false', '--palette', 'true',
    '--flatten', String(!animated), '--join', String(!animated), '--instance', String(!animated),
    '--simplify', String(!animated && entry.overBudget), '--simplify-error', '1'];
  if (!animated && entry.overBudget) {
    args.push('--simplify-ratio', String(Math.max(0.03, Math.min(0.9, (entry.budget / entry.triangles) * 0.9))));
  }
  console.log(`[glb] optimizing ${entry.url}`);
  execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
  if (animated) fs.renameSync(optimized, centered);
  else execFileSync('npm', ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'center', optimized, centered, '--pivot', 'below'], { cwd: root, stdio: 'inherit' });
  compactMaterialFamilies(centered);
  fs.renameSync(centered, input);
}

console.log(`Optimized ${seen.size} GLBs with Draco, grounded static scenes, joined meshes, and four material families.`);
