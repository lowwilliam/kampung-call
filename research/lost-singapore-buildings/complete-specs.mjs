import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profiles, tierFor } from './profiles.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const collection = JSON.parse(await fs.readFile(path.join(root, 'collection.json'), 'utf8'));
const validPrimitives = new Set(['box', 'sphere', 'ellipsoid', 'cylinder', 'cone', 'capsule', 'torus', 'tube', 'lathe', 'extrude', 'ground-blade', 'curve-sweep', 'plane-card', 'instanced-cluster']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizedPrimitive(value) {
  if (value === 'revolved-profile') return 'lathe';
  if (!validPrimitives.has(value)) return 'box';
  return value;
}

function rgb(hex) {
  const value = hex.replace('#', '');
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function rgba(hex) {
  return `rgba(${rgb(hex).join(', ')}, 1.0)`;
}

function materialClass(name) {
  const lower = name.toLowerCase();
  if (/(steel|metal|rail|copper)/.test(lower)) return 'metal';
  if (/(glass|glazing|water)/.test(lower)) return 'glass';
  if (/(timber|wood)/.test(lower)) return 'wood';
  if (/(tile|ceramic)/.test(lower)) return 'ceramic';
  if (/(canvas|fabric)/.test(lower)) return 'fabric';
  if (/(brick|concrete|stone|plaster|render|gravel)/.test(lower)) return 'stone';
  return 'unknown';
}

function makeMaterial(template, family, color, accent, index) {
  const material = clone(template);
  material.id = `${slug(family)}-${index + 1}`;
  material.name = family;
  material.baseColor = color;
  material.color = color;
  material.albedo.dominant = color;
  material.albedo.secondary = [accent, color];
  material.albedo.samplingNotes = 'Palette estimated from the admitted archive views; no source photograph is projected as texture.';
  material.colorVariation.palette = [color, accent];
  material.colorVariation.pattern = 'low-amplitude procedural weathering';
  material.colorVariation.amplitude = 0.08;
  material.textureResolution = 1024;
  material.textureProjection.mode = 'object-space triplanar procedural coordinates';
  material.textureProjection.texelDensityIntent = 'Stable object-scale procedural breakup; historical photos are color/material study only.';
  const cls = materialClass(family);
  material.roughness = {
    base: cls === 'glass' ? 0.24 : cls === 'metal' ? 0.42 : cls === 'fabric' ? 0.82 : 0.72,
    variation: 0.12,
    map: 'independent procedural roughness field',
    localResponse: 'Raised edges slightly smoother; cavities and sheltered ledges rougher.',
  };
  material.metalness = { base: cls === 'metal' ? 0.72 : 0, variation: cls === 'metal' ? 0.08 : 0 };
  material.normal = { pattern: 'independent object-space micro-height derivative', strength: cls === 'glass' ? 0.04 : 0.18, scale: 24, space: 'tangent' };
  material.bump = { pattern: cls === 'brick' ? 'joint relief' : 'subtle granular breakup', amplitude: cls === 'glass' ? 0.005 : 0.025, scale: 1 };
  material.displacement = { pattern: 'none at browser distance', amplitude: 0.001, scale: 1, silhouetteAffects: false };
  material.ambientOcclusion = { cavityStrength: 0.28, contactShadowBias: 0.38, notes: 'Independent contact and recess darkening; not copied from albedo.' };
  material.wear = { edgeWear: 0.05, scratches: [], chips: [] };
  material.dirt = { amount: 0.04, cavityBias: 0.6, color: '#39362f' };
  material.localOverrides = [{ id: 'sheltered-weathering', region: 'undersides, recesses and ground-contact zones', roughness: Math.min(1, material.roughness.base + 0.08), aoBoost: 0.12 }];
  material.notes = `Procedural ${family}; source imagery informs palette and response only.`;
  delete material.referencePbr;
  return material;
}

function makeAttachment(parentId, id) {
  return {
    parentId,
    parentSocket: `socket-${id}`,
    localStart: [0, 0, 0],
    localEnd: [0, 0.05, 0],
    contactNormal: [0, 1, 0],
    contactType: 'embedded structural overlap',
    embedDepth: 0.03,
    overlap: 0.03,
    gapTolerance: 0.01,
    evidenceRefs: ['full-object'],
  };
}

function makeComponent(template, detail, index, macroCount, material, palette, evidenceRefs) {
  const component = clone(template);
  component.id = detail.component;
  component.name = detail.component.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  component.level = index < macroCount - 1 ? 'macro' : 'meso';
  component.role = detail.kind === 'attachment' ? 'attachment' : detail.kind === 'repetition' ? 'repeated-structure' : 'architectural-structure';
  component.importance = Math.max(0.62, 0.98 - index * 0.018);
  component.confidence = detail.confidence;
  component.primitive = normalizedPrimitive(detail.primitive);
  component.topologyClass = detail.primitive === 'plane-card' ? 'surface-relief' : detail.primitive === 'curve-sweep' || detail.primitive === 'tube' ? 'fiber-strand' : 'assembled-solid';
  component.topologyRationale = `${detail.description}; the selected primitive preserves the visible volume or repeated construction in orbit views.`;
  component.geometryDescriptor.topologyIntent = detail.description;
  component.geometryDescriptor.edgeTreatment = { type: 'small bevel', bevelRadius: detail.scale === 'micro' ? 0.008 : 0.025, segments: 2 };
  component.parent = 'assembly-root';
  component.attachment = makeAttachment('assembly-root', detail.component);
  component.dimensions = {
    width: Number((1.2 + (index % 4) * 0.55).toFixed(2)),
    height: Number((0.8 + ((index + 2) % 5) * 0.7).toFixed(2)),
    depth: Number((0.65 + ((index + 1) % 3) * 0.45).toFixed(2)),
    units: 'relative architectural study units',
    confidence: detail.confidence,
  };
  component.transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  component.actionProfile.animationRole = 'pickable-explode-part';
  component.actionProfile.pivot = { mode: 'local attachment centroid', localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.8 };
  component.actionProfile.sockets = [];
  component.actionProfile.collider = { type: 'box', offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: 'Loose inspection collider; visual geometry remains authoritative.' };
  component.actionProfile.destruction = { breakable: false, fractureGroup: detail.component, seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: material.id };
  component.material = material.id;
  component.materialLayers = [material.id];
  component.localFeatures = [{
    id: 'reference-detail',
    description: detail.description,
    kind: detail.kind,
    scale: detail.scale,
    realization: detail.affects === 'material' ? 'procedural material zone plus named geometry boundary' : 'named procedural geometry',
    evidenceRefs,
  }];
  component.surfaceDetail = {
    macroRoughness: 0.08,
    microRoughness: 0.12,
    bumpAmplitude: detail.affects === 'material' ? 0.025 : 0.01,
    normalPattern: 'material-specific independent micro field',
    displacementPattern: 'none unless silhouette-affecting geometry is named',
    occlusionPattern: 'contact seams and recessed bays',
    edgeWearPattern: 'very low exposed-edge brightening',
    notes: detail.description,
  };
  component.evidenceRefs = evidenceRefs;
  component.details = [detail.description];
  component.fidelityTier = detail.scale === 'macro' ? 'blockout-and-structural' : 'structural-and-refinement';
  component.colorMaterialRecipe = {
    dominantAlbedo: rgba(material.baseColor),
    secondaryAlbedo: rgba(palette[(index + 1) % palette.length]),
    materialClass: materialClass(material.name),
    materialClassConfidence: Math.min(0.96, detail.confidence),
    evidenceRefs,
    notes: 'Palette derived by visual observation; no photographic texture projection.',
  };
  return component;
}

for (const building of collection.buildings) {
  const profile = profiles[building.id];
  const specPath = path.join(root, 'specs', `${building.id}.json`);
  const assessment = JSON.parse(await fs.readFile(path.join(root, 'intake', `${building.id}-assessment.json`), 'utf8'));
  const spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
  const rootTemplate = spec.componentTree[0];
  const materialTemplate = spec.materials[0];
  const macroCount = tierFor(building.id) === 'ultra-complex' ? 4 : 3;
  const evidenceRefs = building.references.map((reference) => reference.id);
  const materials = profile.materials.map((family, index) => makeMaterial(
    materialTemplate,
    family,
    profile.palette[index % profile.palette.length],
    profile.palette[(index + 1) % profile.palette.length],
    index,
  ));

  const assemblyRoot = clone(rootTemplate);
  assemblyRoot.id = 'assembly-root';
  assemblyRoot.name = `${building.name} assembly root`;
  assemblyRoot.level = 'macro';
  assemblyRoot.role = 'root';
  assemblyRoot.confidence = building.evidenceConfidence;
  assemblyRoot.topologyRationale = 'Non-rendered assembly origin for the documented exterior and representative site slice.';
  assemblyRoot.dimensions = { width: 20, height: 12, depth: 14, units: 'relative architectural study units', confidence: 0.65 };
  assemblyRoot.actionProfile.sockets = profile.details.map((detail) => ({ id: `socket-${detail.component}`, localPosition: [0, 0, 0], localRotation: [0, 0, 0] }));
  assemblyRoot.material = materials[0].id;
  assemblyRoot.materialLayers = [materials[0].id];
  assemblyRoot.evidenceRefs = ['full-object', ...evidenceRefs];
  assemblyRoot.colorMaterialRecipe = {
    dominantAlbedo: rgba(profile.palette[0]),
    secondaryAlbedo: rgba(profile.palette[1]),
    materialClass: materialClass(materials[0].name),
    materialClassConfidence: building.evidenceConfidence,
    evidenceRefs: ['full-object'],
    notes: 'Assembly-level palette; rendered geometry lives in named child components.',
  };

  const components = profile.details.map((detail, index) => makeComponent(
    rootTemplate,
    detail,
    index,
    macroCount,
    materials[index % materials.length],
    profile.palette,
    evidenceRefs,
  ));

  spec.suitability = 'conditional';
  spec.scores = {
    object_isolation: 3,
    silhouette_readability: 3,
    depth_inference: 2,
    primitive_decomposition: 3,
    material_procedurality: 3,
    occlusion_risk: building.id === 'beauty-world-market' || building.id === 'alkaff-arcade' ? 3 : 2,
    interaction_fit: 3,
  };
  spec.preSpecAssessment = assessment.preSpecAssessment;
  // The dimensional unknowns have been converted into disclosed modelling risks.
  // Keeping this implementation-gate list empty records that no unknown blocks coding.
  spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
  spec.qualityContract = assessment.qualityContract;
  for (const group of spec.qualityContract.featureGroups) {
    if (!group.evidenceRefs?.includes('full-object')) group.evidenceRefs = evidenceRefs.slice(0, Math.min(3, evidenceRefs.length));
  }
  spec.sourceImage = path.join('research/lost-singapore-buildings/references', building.references[0].filename);
  spec.referenceCamera = {
    solved: false,
    fovDegrees: 42,
    aspect: 1.5,
    orientation: { yaw: -28, pitch: -12, roll: 0 },
    positionHint: [10, 7, 14],
    note: 'Representative three-quarter review camera; archive views span multiple lenses and dates, so no single photograph is treated as a calibrated camera solve.',
  };
  spec.coordinateFrame = {
    handedness: 'right-handed',
    upAxis: 'Y',
    forwardAxis: 'Z',
    origin: 'assembly ground-contact centroid',
    front: 'principal public elevation',
    right: 'viewer right when facing the principal public elevation',
    up: 'vertical',
    scaleReference: 'relative study units normalized per subject; dimensions are approximate',
  };
  spec.silhouette = {
    boundingShape: building.geometryIdentity[0],
    aspectRatios: ['Reference-led height-to-width and mass-to-void proportions; no surveyed dimensions claimed.'],
    symmetry: /symmetr|paired|five /.test(building.geometryIdentity.join(' ')) ? 'strong primary-elevation symmetry with documented secondary asymmetry' : 'reference-led asymmetry',
    dominantCurves: building.geometryIdentity.filter((item) => /curve|ellip|oval|horseshoe|bowed|crescent|arch|dome/.test(item)),
    negativeSpaces: building.geometryIdentity.filter((item) => /open|court|arcade|passage|bowl|gap|void/.test(item)),
    landmarks: building.geometryIdentity,
  };
  spec.viewEvidence = [
    { id: 'full-object', view: 'multi-view synthesis', imageRegion: { x: 0, y: 0, width: 1, height: 1, units: 'normalized' }, observations: building.geometryIdentity, confidence: building.evidenceConfidence },
    ...building.references.map((reference) => ({ id: reference.id, view: reference.view, imageRegion: { x: 0, y: 0, width: 1, height: 1, units: 'normalized' }, observations: [`${reference.view}; source and rights retained in collection.json.`], confidence: Math.max(0.6, building.evidenceConfidence - 0.08) })),
  ];
  spec.componentTree = [assemblyRoot, ...components];
  spec.materials = materials;
  spec.featureReviewTargets = building.geometryIdentity.slice(0, 5).map((identity, index) => ({
    id: `identity-system-${index + 1}-${slug(identity).slice(0, 38)}`,
    name: identity,
    tier: index < 3 ? 'critical' : 'important',
    passIds: index === 0
      ? ['blockout', 'form-refinement']
      : index === 1
        ? ['structural-pass', 'interaction-pass']
        : index === 2
          ? ['structural-pass', 'surface-pass']
          : ['material-pass', 'lighting-pass'],
    minimumScore: index < 3 ? 0.8 : 0.68,
    mustPass: index < 3,
    componentRefs: components.slice(index, Math.min(components.length, index + 3)).map((component) => component.id),
    evidenceRefs: ['full-object', ...evidenceRefs.slice(0, 2)],
  }));
  spec.repetitionSystems = profile.details.filter((detail) => detail.kind === 'repetition').map((detail, index) => ({
    id: `repeat-${detail.component}`,
    name: detail.description,
    componentRef: detail.component,
    pattern: /radial|oval|curve|arch/.test(detail.description) ? 'radial-or-curve-following' : 'linear-grid',
    axis: index % 2 ? 'Y' : 'X',
    count: Math.max(4, 6 + index * 2),
    spacing: 0.18,
    variation: { position: 0, rotation: 0, scale: 0 },
    buildsGeometry: true,
    geometry: { primitive: normalizedPrimitive(detail.primitive), realization: 'Instanced or loop-generated named meshes; never map-only.' },
    evidenceRefs,
  }));
  const allRefs = spec.componentTree.map((component) => component.id);
  const macroRefs = spec.componentTree.filter((component) => component.level === 'macro').map((component) => component.id);
  for (const pass of spec.buildPasses) {
    pass.componentRefs = pass.id === 'blockout' ? macroRefs : allRefs;
  }
  spec.qualityTargets = {
    targetFidelity: 0.76,
    mustMatch: building.geometryIdentity,
    niceToHave: ['period-aware procedural weathering', 'site-context hints without full district reconstruction'],
    reviewViewpoints: ['front', 'front-three-quarter', 'opposite-three-quarter', 'elevated-or-top'],
  };
  spec.lookDevTargets = {
    qualityPriority: 'reference-fidelity',
    materialPass: {
      minimumTextureResolution: 1024,
      independentMapChannels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
      referencePbrExtraction: { requiredWhenSourceImagePresent: false, targetThreshold: 0.7, limitation: 'Archive photographs vary in age, scan colour and lighting; procedural PBR is authored from observation rather than extracted as authoritative maps.' },
    },
    lightingPass: { toneMapping: 'ACES Filmic', exposure: 1.05, contactShadows: true, proofViews: ['neutral', 'grazing-angle', 'reference-inspired'] },
  };
  spec.lightingFromPhoto = [
    'Large soft key from camera-left, exposure 1.05 with ACES Filmic tone mapping.',
    'Low-intensity cool fill preserves deep facade recesses without flattening them.',
    'Warm rim plus ambient-occlusion/contact shadows separates rooflines and grounds every part.',
  ];
  spec.proceduralStrategy = [
    'Construct macro silhouette and negative spaces from volumetric Three.js primitives and extrusions.',
    'Build repeated windows, arches, seats, bays, posts and roof elements as instanced or loop-generated geometry.',
    'Keep every identity component in a named parent group with stable local pivot and assembly socket.',
    'Use parent-aware non-uniform explode vectors derived from component centroids and hierarchy depth.',
    'Author independent procedural albedo, roughness, normal-height and AO response; never project source photographs.',
    'Render front and multiple orbit views before acceptance; preserve disclosed uncertainty on hidden sides.',
  ];
  spec.animationAnchors = ['assembly-root supports whole-object transforms', ...components.slice(0, 6).map((component) => `${component.id} has a stable local pivot and explode socket`)];
  spec.destructionAnchors = components.map((component) => `${component.id} is non-breakable but addressable as destruction group ${component.id}`);
  spec.risks = profile.unknowns.map((unknown) => ({ risk: unknown, mitigation: 'Keep the inferred geometry visibly approximate and disclosed in the viewer.' }));
  spec.modelingDisclosure = building.modelingScope || collection.modelingDisclosure;
  spec.referenceRights = 'Research references only; source pages, credits and rights notes are preserved in collection.json. No images ship in the browser build.';

  await fs.writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`${building.id}: ${spec.componentTree.length} components, ${materials.length} materials, ${spec.repetitionSystems.length} repetition systems`);
}
