import fs from 'node:fs';
import path from 'node:path';
import { humanBytes, readHtml, root } from './lib/project.mjs';

const budgets = {
  // Recalibrated for the transit/MRT and heritage-expansion feature waves:
  // the app legitimately grew ~35 KB of authored world code. The budget still
  // guards against accidental bloat; asset budgets below are unchanged.
  // The licensed-pack fallbacks and city/NPC spacing audits add intentional
  // authored source while contributing less than 1 KB to the gzipped bundle.
  // Keep a rounded 320 KB ceiling; shipped-asset budgets remain unchanged.
  html: 320 * 1024,
  referencedAssets: 19 * 1024 * 1024,
  singleAsset: 6 * 1024 * 1024,
};
const html = readHtml();
const assets = new Set(
  [...html.matchAll(/["'`](assets\/[A-Za-z0-9_./-]+\.(?:glb|mp3|png|jpg|jpeg|webp))["'`]/gi)]
    .map((match) => match[1]),
);
const residentAssetMatch = html.match(/const RESIDENT_ASSETS=(\[[^;]+\]);/);
if (residentAssetMatch) {
  for (const resident of JSON.parse(residentAssetMatch[1].replaceAll("'", '"'))) assets.add(`assets/residents/${resident}.glb`);
}
const sizes = [...assets]
  .filter((asset) => fs.existsSync(path.join(root, asset)))
  .map((asset) => ({ asset, size: fs.statSync(path.join(root, asset)).size }));
const htmlBytes = Buffer.byteLength(html);
const total = sizes.reduce((sum, item) => sum + item.size, 0);
const largest = sizes.sort((a, b) => b.size - a.size)[0];
const failures = [];

if (htmlBytes > budgets.html) failures.push(`HTML ${humanBytes(htmlBytes)} exceeds ${humanBytes(budgets.html)}.`);
if (total > budgets.referencedAssets) failures.push(`Referenced assets ${humanBytes(total)} exceed ${humanBytes(budgets.referencedAssets)}.`);
if (largest?.size > budgets.singleAsset) failures.push(`${largest.asset} ${humanBytes(largest.size)} exceeds ${humanBytes(budgets.singleAsset)}.`);

console.log(`HTML: ${humanBytes(htmlBytes)} / ${humanBytes(budgets.html)}`);
console.log(`Referenced assets: ${humanBytes(total)} / ${humanBytes(budgets.referencedAssets)}`);
console.log(`Largest asset: ${largest?.asset || 'none'} (${humanBytes(largest?.size || 0)})`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exitCode = 1;
} else console.log('PASS  Performance budgets are within limits.');
