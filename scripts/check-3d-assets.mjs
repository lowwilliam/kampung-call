import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const assetsRoot = path.join(root, 'assets');
const manifestPath = path.join(root, 'showcase', 'app', 'data', 'catalogue-manifest.json');
const worldAuditPath = path.join(root, 'world', 'asset-audit.json');
const rawRoot = path.join(root, 'research', 'img2threejs', 'singapore-assets', 'raw');

const errors = [];

function walk(directory, excludedPrefixes = []) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const rel = relative(absolute);
    if (entry.isDirectory() && excludedPrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) return [];
    return entry.isDirectory() ? walk(absolute, excludedPrefixes) : [absolute];
  });
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function requireFile(file, context) {
  if (!fs.existsSync(file)) errors.push(`${context}: missing ${relative(file)}`);
}

const repositoryFiles = walk(root, [
  '.git',
  '.vercel',
  'node_modules',
  'dist',
  'showcase/.vinext',
  'showcase/.wrangler',
  'showcase/dist',
  'showcase/node_modules',
  'showcase/public',
]);

for (const file of repositoryFiles) {
  const basename = path.basename(file);
  if (basename.endsWith('.blend1')) errors.push(`Blender autosave must not be committed: ${relative(file)}`);
  if (/ \d+\.[^/]+$/.test(basename)) errors.push(`Conflict-copy filename is not allowed: ${relative(file)}`);
}

const assetFiles = walk(assetsRoot);
const glbs = assetFiles.filter((file) => file.endsWith('.glb'));
const blends = assetFiles.filter((file) => file.endsWith('.blend'));
const glbStems = new Set(glbs.map((file) => file.slice(0, -4)));
const blendStems = new Set(blends.map((file) => file.slice(0, -6)));

const proceduralWithoutBlend = new Set([
  'assets/engineer-v2.glb',
  'assets/landed-v2.glb',
  'assets/raintree-v2.glb',
  'assets/service-van-v2.glb',
  ...glbs.filter((file) => relative(file).startsWith('assets/lost-heritage/')).map(relative),
]);

for (const glb of glbs) {
  if (!blendStems.has(glb.slice(0, -4)) && !proceduralWithoutBlend.has(relative(glb)) && relative(glb) !== 'assets/hdb-call-v2.glb') {
    errors.push(`GLB has no editable or declared procedural source: ${relative(glb)}`);
  }
}

for (const blend of blends) {
  if (!glbStems.has(blend.slice(0, -6)) && relative(blend) !== 'assets/hdb-call-kit.blend') {
    errors.push(`Blender project has no canonical GLB output: ${relative(blend)}`);
  }
}

requireFile(path.join(assetsRoot, 'hdb-call-kit.blend'), 'Renamed Blender source');
requireFile(path.join(assetsRoot, 'hdb-call-v2.glb'), 'Renamed Blender output');

const rawGlbs = walk(rawRoot).filter((file) => file.endsWith('.glb'));
for (const raw of rawGlbs) {
  const id = path.basename(raw, '.glb');
  requireFile(path.join(assetsRoot, `${id}-v1.blend`), `Raw intermediate ${id}`);
  requireFile(path.join(assetsRoot, `${id}-v1.glb`), `Raw intermediate ${id}`);
}

const catalogue = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cataloguePaths = new Set();
for (const asset of catalogue.assets ?? []) {
  const sourcePath = asset.model?.sourcePath;
  if (!sourcePath?.startsWith('assets/') || path.isAbsolute(sourcePath)) {
    errors.push(`${asset.id}: invalid canonical model sourcePath ${sourcePath}`);
    continue;
  }
  if (cataloguePaths.has(sourcePath)) errors.push(`${asset.id}: duplicate model sourcePath ${sourcePath}`);
  cataloguePaths.add(sourcePath);
  requireFile(path.join(root, sourcePath), `${asset.id} catalogue entry`);
}

const nonCatalogueGlbs = glbs.map(relative).filter((file) => !cataloguePaths.has(file));
if (nonCatalogueGlbs.length !== 1 || nonCatalogueGlbs[0] !== 'assets/alfa-romeo-giulia-spider-v2.glb') {
  errors.push(`Unexpected GLBs outside the collection manifest: ${nonCatalogueGlbs.join(', ') || '(none)'}`);
}

const worldAudit = JSON.parse(fs.readFileSync(worldAuditPath, 'utf8'));
for (const entry of worldAudit.manifest ?? []) requireFile(path.join(root, entry.url), `${entry.name} world audit entry`);

if (errors.length) {
  console.error(`[3d-assets] ${errors.length} problem(s) found:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`[3d-assets] OK: ${glbs.length} canonical GLBs, ${blends.length} Blender projects, ${rawGlbs.length} raw intermediates, ${cataloguePaths.size} collection entries.`);
