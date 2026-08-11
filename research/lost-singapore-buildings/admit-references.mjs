import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = '/Users/william/.codex/skills/img2threejs';
const probeScript = path.join(skillRoot, 'forge/stage1_intake/probe_image.py');
const admissionScript = path.join(skillRoot, 'forge/stage1_intake/check_reference_admission.py');
const collection = JSON.parse(await fs.readFile(path.join(root, 'collection.json'), 'utf8'));

function runJson(script, args) {
  const result = spawnSync('python3', [script, ...args], { encoding: 'utf8' });
  const output = result.stdout.trim();
  if (result.status !== 0 && !output.startsWith('{')) {
    throw new Error(`${path.basename(script)} failed: ${result.stderr || result.stdout}`);
  }
  return output;
}

const buildings = [];
for (const building of collection.buildings) {
  const admittedHashes = [];
  const references = [];

  for (const reference of building.references) {
    const imagePath = path.join(root, 'references', reference.filename);
    const technical = JSON.parse(runJson(probeScript, [imagePath]));
    const admissionArgs = [imagePath, '--viewpoint', reference.view, '--json'];
    if (admittedHashes.length) admissionArgs.push('--against', admittedHashes.join(','));

    const admissionText = runJson(admissionScript, admissionArgs);
    const admission = JSON.parse(admissionText);
    const hashMatch = admissionText.match(/"pHash"\s*:\s*(\d+)/);
    if (hashMatch) admission.provenance.pHash = hashMatch[1];
    if (admission.admitted && hashMatch) admittedHashes.push(hashMatch[1]);

    references.push({
      id: reference.id,
      view: reference.view,
      filename: reference.filename,
      technical,
      admission,
    });
  }

  buildings.push({
    id: building.id,
    admitted: references.filter((item) => item.admission.admitted).length,
    rejected: references.filter((item) => !item.admission.admitted).length,
    references,
  });
}

const report = {
  schemaVersion: 1,
  generatedOn: new Date().toISOString(),
  policy: 'Deterministic technical probe and img2threejs reference-admission gate. Semantic suitability still requires visual inspection.',
  totals: {
    buildings: buildings.length,
    references: buildings.reduce((sum, building) => sum + building.references.length, 0),
    admitted: buildings.reduce((sum, building) => sum + building.admitted, 0),
    rejected: buildings.reduce((sum, building) => sum + building.rejected, 0),
  },
  buildings,
};

await fs.writeFile(path.join(root, 'reference-admission.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals));
for (const building of buildings) {
  console.log(`${building.id}: ${building.admitted} admitted, ${building.rejected} rejected`);
}
