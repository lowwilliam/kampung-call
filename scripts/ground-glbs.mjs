import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const report = JSON.parse(fs.readFileSync(path.join(root, 'world/asset-audit.json'), 'utf8'));

function shiftRootNodes(file, shift) {
  const data = fs.readFileSync(file);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const parents = new Set();
  for (const node of json.nodes || []) for (const child of node.children || []) parents.add(child);
  const roots = (json.scenes?.[0]?.nodes || json.nodes?.map((_, index) => index) || []).filter((index) => !parents.has(index));
  for (const index of roots) {
    const node = json.nodes[index];
    if (node.matrix) node.matrix[13] += shift;
    else {
      node.translation ||= [0, 0, 0];
      node.translation[1] += shift;
    }
  }
  const nextJson = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(nextJson.length / 4) * 4;
  const padded = Buffer.concat([nextJson, Buffer.alloc(paddedLength - nextJson.length, 0x20)]);
  const output = Buffer.alloc(data.length - jsonLength + paddedLength);
  data.copy(output, 0, 0, 12);
  output.writeUInt32LE(paddedLength, 12);
  output.writeUInt32LE(data.readUInt32LE(16), 16);
  padded.copy(output, 20);
  data.copy(output, 20 + paddedLength, 20 + jsonLength);
  output.writeUInt32LE(output.length, 8);
  fs.writeFileSync(file, output);
}

for (const entry of report.manifest) {
  if (Math.abs(entry.minY) <= 0.001) continue;
  const sourceShift = -entry.minY / (entry.scale || 1);
  shiftRootNodes(path.join(root, entry.url), sourceShift);
  console.log(`[ground] ${entry.url}: shifted ${sourceShift.toFixed(4)} u`);
}
