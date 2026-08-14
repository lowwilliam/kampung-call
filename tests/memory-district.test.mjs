import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await readFile(path.join(root, 'world', 'memory-district.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'showcase', 'app', 'data', 'catalogue-manifest.json'), 'utf8'));

test('Memory District is the complete Manifest-derived Lost Heritage runtime', async () => {
  const heritage = manifest.assets.filter((asset) => asset.category === 'Lost Heritage');
  assert.equal(registry.recordType, 'memory-district-runtime-registry');
  assert.equal(registry.entryCount, 13);
  assert.equal(registry.entries.length, 13);
  assert.deepEqual(new Set(registry.entries.map((entry) => entry.id)), new Set(heritage.map((asset) => asset.id)));
  for (const entry of registry.entries) {
    const asset = heritage.find((item) => item.id === entry.id);
    assert.equal(entry.modelPath, `assets/${asset.model.file}`);
    assert.equal(entry.modelSha256, asset.model.sha256);
    const actual = createHash('sha256').update(await readFile(path.join(root, entry.modelPath))).digest('hex');
    assert.equal(actual, entry.modelSha256);
  }
});

test('Memory District registry stays generated and demolition-era ordered', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-memory-district.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(registry.chunks.length, 3);
  assert.ok(registry.entries.every((entry, index) => index === 0 || entry.removedSortYear >= registry.entries[index - 1].removedSortYear));
});

test('game exposes dual entry, reliable return and chunk load/unload contracts', async () => {
  const [source, runtime, html, vite] = await Promise.all([
    readFile(path.join(root, 'src', 'main.js'), 'utf8'),
    readFile(path.join(root, 'src', 'memory-district.js'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'vite.config.js'), 'utf8'),
  ]);
  assert.match(source, /new URLSearchParams\(location\.search\)\.get\('district'\)==='memory'/);
  assert.match(source, /function enterMemoryDistrict/);
  assert.match(source, /function exitMemoryDistrict/);
  assert.match(source, /import\('\.\/memory-district\.js'\)/);
  assert.match(runtime, /import registry from '\.\.\/world\/memory-district\.json'/);
  assert.match(runtime, /const loadChunk=id=>/);
  assert.match(runtime, /const unloadChunk=id=>/);
  assert.doesNotMatch(source, /^import registry/m);
  assert.match(runtime, /surfacePosition/);
  assert.match(runtime, /state\.position\.z>=4\.7/);
  assert.match(html, /id="memoryBegin"/);
  assert.match(html, /id="memoryBtn"/);
  assert.match(vite, /memoryDistrict\.entries/);
});
