import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { root } from './lib/project.mjs';

// These exports deliberately keep their node hierarchy. Palette atlasing reduces
// material families without joining parts; simplification is limited to the five
// source scenes whose unapplied bevel geometry exceeds the browser hero budget.
const components = {
  'airport-terminal-v2': 1,
  'bumboat-v2': 1,
  'clouded-monitor-v1': 1,
  'concert-hall-v2': 1,
  'condo-bg-v2': 1,
  'condo-holland-v2': 1,
  'condo-marina-v2': 1,
  'controltower-v2': 1,
  'engineer-v2': 1,
  'hawker-v2': 0.82,
  'hdb-bg-v2': 1,
  'hdb-call-v2': 1,
  'hdb-voiddeck-v2': 0.86,
  'kampong-house-v2': 1,
  'kampong-props-v2': 1,
  'kampung-call-v2': 1,
  'kopitiam-v2': 0.82,
  'landed-v2': 1,
  'mamashop-v2': 1,
  'mrt-v2': 1,
  'national-school-v2': 1,
  'oriental-pied-hornbill-v1': 1,
  'pointblock-call-v2': 1,
  'raintree-v2': 1,
  'red-junglefowl-v1': 1,
  'service-van-v2': 1,
  'shophouse-v2': 1,
  'singapore-cable-car-skyorb-v1': 1,
  'skypark-hotel-v2': 1,
  'smooth-coated-otter-v1': 1,
  'sultan-mosque-v2': 1,
  'wetmarket-v2': 0.86,
};

const executable = path.join(root, 'node_modules', '.bin', 'gltf-transform');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'component-safe-glb-'));
const requested = new Set(process.argv.slice(2));
const centerBelow = new Set([
  'clouded-monitor-v1',
  'oriental-pied-hornbill-v1',
  'red-junglefowl-v1',
  'singapore-cable-car-skyorb-v1',
  'smooth-coated-otter-v1',
]);

for (const [assetId, ratio] of Object.entries(components)) {
  if (requested.size && !requested.has(assetId)) continue;
  const input = path.join(root, 'assets', `${assetId}.glb`);
  const output = path.join(temporary, `${assetId}.glb`);
  let optimizationInput = input;
  if (centerBelow.has(assetId)) {
    optimizationInput = path.join(temporary, `centered-${assetId}.glb`);
    execFileSync(executable, ['center', input, optimizationInput, '--pivot', 'below'], { cwd: root, stdio: 'inherit' });
  }
  const args = [
    'optimize', optimizationInput, output,
    '--compress', 'draco',
    '--texture-compress', 'false',
    '--palette', 'true',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--simplify', String(ratio < 1),
  ];
  if (ratio < 1) args.push('--simplify-ratio', String(ratio), '--simplify-error', '1');
  console.log(`[component-optimize] ${assetId}${ratio < 1 ? ` ratio=${ratio}` : ''}`);
  execFileSync(executable, args, { cwd: root, stdio: 'inherit' });
  fs.renameSync(output, input);
}

console.log(`Component-safe optimization complete${requested.size ? ` for ${[...requested].join(', ')}` : ` for ${Object.keys(components).length} GLBs`}.`);
