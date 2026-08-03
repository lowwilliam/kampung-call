import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './lib/project.mjs';

const report = JSON.parse(fs.readFileSync(path.join(root, 'world/asset-audit.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kampung-all-simplify-'));
const seen = new Set();
for (const entry of report.manifest) {
  if (entry.name === 'engineer' || entry.name.startsWith('resident:') || seen.has(entry.url)) continue;
  seen.add(entry.url);
  const input = path.join(root, entry.url);
  const simplified = path.join(work, path.basename(entry.url));
  console.log(`[simplify-all] ${entry.url}`);
  execFileSync('npm', ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'simplify', input, simplified, '--ratio', '0.25', '--error', '100'], { cwd: root, stdio: 'inherit' });
  fs.renameSync(simplified, input);
}
