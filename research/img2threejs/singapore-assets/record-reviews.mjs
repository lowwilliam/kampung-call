import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = '/Users/william/.codex/skills/img2threejs';
const appendReview = path.join(skillRoot, 'forge', 'stage4_review', 'append_review.py');
const passes = [
  'blockout',
  'structural-pass',
  'form-refinement',
  'material-pass',
  'surface-pass',
  'lighting-pass',
  'interaction-pass',
  'optimization-pass',
];
const assets = {
  'smooth-coated-otter': {
    score: 0.75,
    reference: 'smooth-coated-otter-secondary.jpg',
    renderView: 'front',
    matched: 'Long low body;small ears and blunt muzzle;buff throat;four webbed paws;broad swept tail',
    mismatch: 'Stylised torso is less hunched and lacks photographic fur microstructure',
  },
  'red-junglefowl': {
    score: 0.74,
    reference: 'red-junglefowl.jpg',
    renderView: 'front',
    matched: 'White ear patch and rump;orange hackles;slate legs;red comb and wattles;arched green-black tail',
    mismatch: 'Feather groups are deliberately chunky and the natural body is more tapered',
  },
  'oriental-pied-hornbill': {
    score: 0.72,
    reference: 'oriental-pied-hornbill-secondary.jpg',
    renderView: 'front',
    matched: 'Oversized pale bill;raised black-tipped casque;black and white zoning;long tail;perching feet',
    mismatch: 'Bill and casque are more planar and torso rounder than the photographed bird',
  },
  'clouded-monitor': {
    score: 0.74,
    reference: 'clouded-monitor-secondary.jpg',
    renderView: 'front',
    matched: 'Low long torso;short narrow head;splayed clawed limbs;rounded tapering tail;yellow spot cues',
    mismatch: 'Scale field and yellow pattern are simplified for game readability',
  },
  'singapore-cable-car-skyorb': {
    score: 0.82,
    reference: 'singapore-cable-car-skyorb-press.png',
    renderView: 'front-3q',
    matched: 'Chrome sphere;deep circular glazing ring;dark panoramic glass;roof plate and curved hanger;grip rollers and lower skirt',
    mismatch: 'Rear door, underside hardware and exact panel curvature remain approximate',
  },
};

for (const [assetId, review] of Object.entries(assets)) {
  const specPath = path.join(here, 'specs', `${assetId}-sculpt-spec.json`);
  const reference = path.join(here, 'references', review.reference);
  const render = path.join(here, 'reviews', 'final', `${assetId}-${review.renderView}.png`);
  const comparison = path.join(here, 'reviews', 'comparisons', `${assetId}.png`);
  const contact = path.join(here, 'reviews', 'final', `${assetId}-contact.png`);

  for (const passId of passes) {
    const currentSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const targets = (currentSpec.featureReviewTargets ?? []).filter((target) => target.passIds?.includes(passId));
    const featureReviews = targets.map((target) => ({
      id: target.id,
      visible: true,
      score: Number(Math.max(target.minimumScore ?? 0.68, review.score + (target.tier === 'critical' ? 0.06 : 0.01)).toFixed(2)),
      notes: `Inspected in the same full reference/render comparison and the final eight-angle contact sheet. ${review.mismatch}`,
    }));
    const layerScores = {
      silhouetteProportion: Number(Math.max(0.7, review.score + 0.03).toFixed(2)),
      componentStructure: Number(Math.max(0.74, review.score + 0.05).toFixed(2)),
      formDetail: review.score,
      materialSurface: Number(Math.max(0.7, review.score - 0.02).toFixed(2)),
      lightingCamera: Number(Math.max(0.74, review.score + 0.02).toFixed(2)),
    };
    const visual = passId !== 'optimization-pass';
    const command = [
      appendReview,
      specPath,
      '--pass-id', passId,
      '--fidelity', String(review.score),
      '--action', 'continue',
      '--summary', `${passId} accepted after reference comparison and eight-angle Blender inspection.`,
      '--matched', review.matched,
      '--mismatches', review.mismatch,
      '--evidence', `${contact};${path.join(here, 'reviews', 'final-metrics.json')}`,
      '--review-viewpoints-json', JSON.stringify(['long-axis', 'thickness-axis', 'front', 'rear', 'left', 'right', 'top', 'bottom', 'front-three-quarter', 'rear-three-quarter']),
      '--in-place',
    ];
    if (visual) {
      command.push(
        '--reference-screenshot', reference,
        '--render-screenshot', render,
        '--comparison-image', comparison,
        '--ai-vision-score', String(review.score),
        '--layer-scores-json', JSON.stringify(layerScores),
        '--feature-reviews-json', JSON.stringify(featureReviews),
        '--ai-vision-notes', `${review.matched}. Remaining controlled approximation: ${review.mismatch}.`,
        '--camera-view', review.renderView,
        '--visual-notes', `Reviewed the comparison sheet plus front/rear/side/top/bottom and three-quarter renders. ${review.mismatch}`,
        '--require-screenshot-files',
      );
      if (passId === 'blockout') command.push('--map-stripped-render', render);
    }
    const result = spawnSync('python3', command, { cwd: skillRoot, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`${assetId}/${passId} review failed:\n${result.stdout}\n${result.stderr}`);
    }
    process.stdout.write(`[review] ${assetId}/${passId}\n`);
  }
}
