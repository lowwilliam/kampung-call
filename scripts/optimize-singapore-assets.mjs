import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const assetIds = [
  'smooth-coated-otter',
  'red-junglefowl',
  'oriental-pied-hornbill',
  'clouded-monitor',
  'singapore-cable-car-skyorb',
];
const transform = path.join(root, 'node_modules', '.bin', 'gltf-transform');

for (const assetId of assetIds) {
  const source = path.join(root, 'assets', `${assetId}-v1.glb`);
  const optimized = path.join(root, 'assets', `${assetId}-v1.optimized.glb`);
  if (!fs.existsSync(source)) throw new Error(`Missing ${source}`);
  execFileSync(transform, ['draco', source, optimized, '--method', 'edgebreaker'], {
    cwd: root,
    stdio: 'inherit',
  });
  fs.renameSync(optimized, source);
  console.log(`[singapore-assets] compressed ${assetId}`);
}
