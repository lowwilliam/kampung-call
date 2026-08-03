import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './lib/project.mjs';

const report = JSON.parse(fs.readFileSync(path.join(root, 'world/asset-audit.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kampung-simplify-'));
for (const entry of report.manifest.filter((item) => item.overBudget)) {
  const input = path.join(root, entry.url);
  const output = path.join(work, path.basename(entry.url));
  const ratio = Math.max(0.02, Math.min(0.65, (entry.budget / entry.triangles) * 0.5));
  console.log(`[simplify] ${entry.url} → ratio ${ratio.toFixed(3)}`);
  execFileSync('npm', ['exec', '--yes', '--package=@gltf-transform/cli', 'gltf-transform', '--', 'optimize', input, output,
    '--compress', 'draco', '--texture-compress', 'false', '--palette', 'true', '--flatten', 'true', '--join', 'true', '--instance', 'true',
    '--simplify', 'true', '--simplify-ratio', String(ratio), '--simplify-error', '1'], { cwd: root, stdio: 'inherit' });
  fs.renameSync(output, input);
}
