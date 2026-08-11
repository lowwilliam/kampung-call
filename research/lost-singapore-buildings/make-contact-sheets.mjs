import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const collection = JSON.parse(await fs.readFile(path.join(root, 'collection.json'), 'utf8'));
const outputDir = path.join(root, 'contact-sheets');
await fs.mkdir(outputDir, { recursive: true });

for (const building of collection.buildings) {
  const inputs = building.references.map((reference) => path.join(root, 'references', reference.filename));
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const input of inputs) args.push('-i', input);

  const filters = inputs.map((_, index) =>
    `[${index}:v]scale=480:320:force_original_aspect_ratio=decrease,pad=480:320:(ow-iw)/2:(oh-ih)/2:color=0x171b22[v${index}]`,
  );
  while (filters.length < 6) {
    const index = filters.length;
    filters.push(`color=c=0x171b22:s=480x320:d=1[v${index}]`);
  }
  filters.push('[v0][v1][v2][v3][v4][v5]xstack=inputs=6:layout=0_0|480_0|960_0|0_320|480_320|960_320[out]');

  const output = path.join(outputDir, `${building.id}.jpg`);
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '2', output);
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${building.id}: ${result.stderr}`);
  console.log(path.relative(root, output));
}
