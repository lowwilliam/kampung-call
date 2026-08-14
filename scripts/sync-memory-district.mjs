import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/project.mjs';

const manifestPath = path.join(root, 'showcase', 'app', 'data', 'catalogue-manifest.json');
const researchPath = path.join(root, 'research', 'lost-singapore-buildings', 'collection.json');
const outputPath = path.join(root, 'world', 'memory-district.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const researchById = new Map(research.buildings.map((building) => [building.id, building]));
const year = (value) => Number(String(value).match(/\b(?:18|19|20)\d{2}\b/)?.[0] ?? 9999);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const heritage = manifest.assets
  .filter((asset) => asset.category === 'Lost Heritage')
  .map((asset) => {
    const researchId = asset.id.replace(/^lost-/, '');
    const building = researchById.get(researchId);
    if (!building) throw new Error(`Missing Lost Heritage research record for ${asset.id}`);
    if (!fs.existsSync(path.join(root, asset.model.sourcePath))) throw new Error(`Missing model ${asset.model.sourcePath}`);
    return { asset, building };
  })
  .sort((left, right) => year(left.building.removed) - year(right.building.removed)
    || year(left.building.opened) - year(right.building.opened)
    || left.asset.id.localeCompare(right.asset.id));

if (heritage.length !== 13) throw new Error(`Memory District requires exactly 13 Lost Heritage assets, found ${heritage.length}`);

const entries = heritage.map(({ asset, building }, index) => ({
  id: asset.id,
  catalogueSlug: asset.slug,
  name: asset.locale.en.name,
  modelPath: `assets/${asset.model.file}`,
  modelSha256: asset.model.sha256,
  opened: building.opened,
  removed: building.removed,
  openedYear: year(building.opened),
  removedSortYear: year(building.removed),
  location: building.location,
  story: building.heritageCase,
  sourceUrl: building.sources[0],
  evidenceStatus: asset.evidenceStatus,
  disclosure: research.modelingDisclosure,
  position: { x: index % 2 === 0 ? -9 : 9, z: -10 - index * 13 },
  heading: index % 2 === 0 ? 28 : -28,
  targetLongest: 12,
  chunk: Math.min(2, Math.floor(index / 5)),
}));

const generated = {
  schemaVersion: 1,
  recordType: 'memory-district-runtime-registry',
  sourceManifestRelease: manifest.release.id,
  sourceManifestVersion: manifest.release.version,
  sourceManifestHash: sha256(fs.readFileSync(manifestPath)),
  title: 'Memory District',
  framing: 'A curated timeline of research-led reconstructions, not a geographic reconstruction of Singapore.',
  disclosure: research.modelingDisclosure,
  responsiblePublisher: manifest.release.responsiblePublisher,
  entryCount: entries.length,
  chunks: [
    { id: 0, label: '1932–1984', startZ: 4, endZ: -67 },
    { id: 1, label: '1986–2005', startZ: -58, endZ: -126 },
    { id: 2, label: '2008–2025', startZ: -117, endZ: -178 },
  ],
  entries,
};

const serialized = `${JSON.stringify(generated, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== serialized) {
    console.error('[memory] world/memory-district.json is stale. Run npm run memory:sync.');
    process.exitCode = 1;
  } else {
    console.log('[memory] 13 Manifest-derived entries are current.');
  }
} else {
  fs.writeFileSync(outputPath, serialized);
  console.log('[memory] Wrote 13 Manifest-derived entries to world/memory-district.json.');
}
