import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './lib/project.mjs';

const report = JSON.parse(fs.readFileSync(path.join(root, 'world/asset-audit.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kampung-draco-'));
const seen = new Set();
for (const entry of report.manifest) {
  if (seen.has(entry.url)) continue;
  seen.add(entry.url);
  const input = path.join(root, entry.url);
  const output = path.join(work, path.basename(entry.url));
  execFileSync('npm', ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'draco', input, output], { cwd: root, stdio: 'inherit' });
  fs.renameSync(output, input);
}
console.log(`Draco-compressed ${seen.size} GLBs.`);
