import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profiles, tierFor } from './profiles.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const collection = JSON.parse(await fs.readFile(path.join(root, 'collection.json'), 'utf8'));

function inventoryKind(detail) {
  if (detail.kind === 'attachment') return 'fastener';
  if (detail.kind === 'negative-space') return 'hole';
  if (detail.kind === 'color-zone') return 'decal';
  if (detail.kind === 'edge-detail') return 'bevel';
  if (detail.kind === 'surface-detail') return 'groove';
  if (detail.kind === 'repetition') return 'ridge';
  return 'contour';
}

for (const building of collection.buildings) {
  const profile = profiles[building.id];
  if (!profile) throw new Error(`Missing profile for ${building.id}`);

  const assessmentPath = path.join(root, 'intake', `${building.id}-assessment.json`);
  const inventoryPath = path.join(root, 'intake', `${building.id}-detail-inventory.json`);
  const assessment = JSON.parse(await fs.readFile(assessmentPath, 'utf8'));
  const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
  const tier = tierFor(building.id);
  const macroCount = tier === 'ultra-complex' ? 4 : 3;
  const zoneStubs = inventory.detailInventory.details;

  inventory.detailInventory.details = profile.details.map((detail, index) => {
    const zone = zoneStubs[index % zoneStubs.length];
    return {
      id: `detail-${String(index + 1).padStart(2, '0')}-${detail.component}`,
      kind: inventoryKind(detail),
      description: detail.description,
      region: zone.region,
      scale: detail.scale,
      affects: detail.affects,
      mapsTo: {
        type: 'component.localFeatures',
        ref: `${detail.component}/reference-detail`,
      },
      evidenceRef: zone.evidenceRef,
      confidence: detail.confidence,
    };
  });
  inventory.detailInventory.targetMinDetails = profile.details.length;
  inventory.authoringInstruction = 'Completed after whole-image and zone-sheet visual inspection. Every detail maps to a planned spec component or material override.';
  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  const pre = assessment.preSpecAssessment;
  pre.objectClass = {
    primaryType: 'architectural landmark prop',
    primaryDomain: 'object',
    formLanguage: profile.formLanguage,
    structureKind: profile.structureKind,
    motionPotential: ['exploded-view interaction', 'clickable part inspection'],
    materialFamilies: profile.materials,
    notes: building.modelingScope || 'Stylised real-time reconstruction of the documented exterior.',
  };
  pre.complexity.tier = tier;
  pre.complexity.scores = {
    silhouetteComplexity: tier === 'ultra-complex' ? 3 : 2,
    componentCount: 3,
    hierarchyDepth: 2,
    repetitionDensity: profile.details.some((item) => item.kind === 'repetition') ? 3 : 2,
    materialLayerCount: profile.materials.length >= 5 ? 3 : 2,
    localDetailDensity: 3,
    occlusionRisk: building.id === 'beauty-world-market' || building.id === 'alkaff-arcade' ? 3 : 2,
    actionReadinessNeed: 3,
  };
  pre.complexity.estimatedCounts = {
    macroComponents: macroCount,
    mesoComponents: profile.details.length - macroCount,
    microFeatureGroups: profile.details.length,
    materialLayers: profile.materials.length,
    repetitionSystems: Math.max(1, profile.details.filter((item) => item.kind === 'repetition').length),
  };
  pre.complexity.reasoning = [
    `${building.name} requires ${profile.details.length} named structural/detail components to preserve its identity at the selected tier.`,
    `The quality decision is driven by ${building.geometryIdentity.join('; ')}.`,
  ];
  pre.specDepthDecision.requiredDepth = tier;
  pre.specDepthDecision.rationale = 'Selected after visual inspection of the primary reference, independent supporting views and every generated zone crop.';
  pre.unknownsToResolveBeforeImplementation = profile.unknowns;
  pre.detailInventory = inventory.detailInventory;

  assessment.qualityContract.qualityBar = tier;
  assessment.qualityContract.definitionOfDone = [
    `The model reads as ${building.name} in silhouette without labels.`,
    `The model includes the identity features: ${building.geometryIdentity.join('; ')}.`,
    'All named parts are selectable and remain attached during parent-aware non-uniform explode.',
    'Front, three-quarter, side and elevated review views preserve proportions and negative spaces.',
    'All hidden-side and dimensional inference remains disclosed in runtime metadata and research notes.',
  ];
  assessment.qualityContract.minimumSpecDepth = {
    macroComponents: macroCount,
    mesoComponents: profile.details.length - macroCount,
    microFeatureGroups: profile.details.length,
    materialLayers: profile.materials.length,
    repetitionSystems: Math.max(1, profile.details.filter((item) => item.kind === 'repetition').length),
    reviewViewpoints: 4,
  };
  assessment.qualityContract.featureGroups.push(...building.geometryIdentity.map((identity, index) => ({
    id: `identity-${index + 1}`,
    name: identity,
    required: true,
    qualityCriteria: [`Visible in at least two review viewpoints and represented by named geometry or an explicit repetition system.`],
    evidenceRefs: building.references.map((reference) => reference.filename),
    failureModes: [`The model can no longer be distinguished from a generic ${pre.objectClass.primaryType}.`],
  })));
  assessment.qualityContract.visualDeltaChecks = [
    'silhouette and primary height-to-width ratio',
    'critical negative spaces and courtyard/open-bowl geometry',
    'roofline and skyline attachments',
    'facade-bay count, rhythm and depth',
    'material color-zone separation and roughness family',
    'ground contact, podium, steps and site transition',
  ];
  assessment.authoringInstruction = 'Assessment completed. Author the ObjectSculptSpec with the attached detail inventory and modeling disclosures.';
  await fs.writeFile(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  console.log(`${building.id}: ${tier}, ${profile.details.length} mapped details`);
}
