import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.join(here, 'specs');

const clone = (value) => JSON.parse(JSON.stringify(value));

function component(template, definition) {
  const next = clone(template);
  Object.assign(next, {
    id: definition.id,
    name: definition.name,
    level: definition.level,
    role: definition.role ?? 'static-part',
    importance: definition.importance ?? 0.82,
    confidence: definition.confidence ?? 0.82,
    primitive: definition.primitive ?? 'box',
    topologyClass: definition.topologyClass ?? 'assembled-solid',
    topologyRationale: definition.topologyRationale ?? 'A discrete architectural or sculptural part with independently reviewable volume.',
    parent: definition.parent ?? 'root',
    material: definition.material,
    materialLayers: [definition.material],
    localFeatures: definition.localFeatures ?? [],
    evidenceRefs: definition.evidenceRefs ?? ['full-object'],
    fidelityTier: definition.level === 'macro' ? 'blockout' : 'form',
  });
  next.geometryDescriptor.topologyIntent = definition.topologyIntent ?? next.topologyRationale;
  next.geometryDescriptor.edgeTreatment = definition.edgeTreatment ?? { type: 'chamfer', bevelRadius: 0.025, segments: 2 };
  next.actionProfile.animationRole = definition.level === 'macro' ? 'static-assembly' : 'static-part';
  next.actionProfile.destruction.fractureGroup = definition.id;
  next.actionProfile.collider.type = definition.level === 'micro' ? 'none' : 'box';
  next.colorMaterialRecipe = {
    materialRef: definition.material,
    evidenceRefs: definition.evidenceRefs ?? ['full-object'],
    note: definition.materialNote ?? 'Reference-observed material family with independent roughness, normal and AO response.',
  };
  return next;
}

function material(template, definition) {
  const next = clone(template);
  next.id = definition.id;
  next.name = definition.name;
  next.baseColor = definition.color;
  next.color = definition.color;
  next.albedo.dominant = definition.color;
  next.albedo.secondary = definition.secondary ?? [definition.color];
  next.colorVariation.palette = [definition.color, ...(definition.secondary ?? [])];
  next.roughness.base = definition.roughness;
  next.roughness.variation = definition.variation ?? 0.08;
  next.normal.strength = definition.normalStrength ?? 0.14;
  next.bump.pattern = definition.bumpPattern ?? 'independent micro-height field';
  next.bump.amplitude = definition.bumpAmplitude ?? 0.035;
  next.bump.scale = definition.bumpScale ?? 30;
  next.localOverrides = definition.localOverrides ?? [{
    id: `${definition.id}-cavity-response`,
    region: 'recesses and sheltered contacts',
    roughness: Math.min(1, definition.roughness + 0.08),
    aoBoost: 0.12,
  }];
  next.dirt = definition.dirt ?? { amount: 0.035, cavityBias: 0.6, color: '#3f3933' };
  next.wear = definition.wear ?? { edgeWear: 0.025, scratches: [], chips: [] };
  next.referencePbr = definition.referencePbr ?? null;
  next.notes = definition.notes;
  return next;
}

function repetition(id, name, componentRef, count, pattern = 'linear') {
  return {
    id,
    name,
    componentRef,
    pattern,
    axis: pattern === 'radial' ? 'radial' : 'X',
    count,
    spacing: 0.12,
    variation: { position: 0, rotation: 0, scale: 0 },
    buildsGeometry: true,
    geometry: {
      primitive: 'instanced-cluster',
      realization: 'Loop-generated named meshes with shared materials; never map-only.',
    },
    evidenceRefs: ['full-object'],
  };
}

function reviewTarget(id, name, passIds, componentRefs, tier = 'critical') {
  return {
    id,
    name,
    tier,
    passIds,
    minimumScore: tier === 'critical' ? 0.8 : 0.7,
    mustPass: tier === 'critical',
    componentRefs,
    evidenceRefs: ['full-object'],
  };
}

function referencePbr(materialId, relativeDir, confidence = 0.86) {
  const absoluteDir = path.join(here, 'pbr', relativeDir);
  const map = (channel) => ({
    path: path.join(absoluteDir, `${materialId}_${channel}.png`),
    url: `${materialId}_${channel}.png`,
    channel,
    source: 'reference-pixel-extraction',
  });
  return {
    usable: true,
    confidence,
    verdict: 'pass',
    limitation: 'Single-image PBR extraction is evidence, not exact inverse rendering.',
    maps: {
      albedo: map('albedo'),
      roughness: map('roughness'),
      height: map('height'),
      normal: map('normal'),
      ao: map('ao'),
    },
  };
}

function completePeranakan(spec) {
  const root = spec.componentTree[0];
  root.name = 'Peranakan House assembly root';
  root.role = 'root-container';
  root.material = 'painted-plaster';
  root.materialLayers = ['painted-plaster'];
  root.colorMaterialRecipe = { materialRef: 'painted-plaster', evidenceRefs: ['full-object'], note: 'Invisible assembly root uses the primary complete PBR family.' };
  root.topologyRationale = 'Named assembly container for separable facade, roof and court systems.';
  root.actionProfile.collider.type = 'box';

  const definitions = [
    { id: 'street-shell', name: 'Deep narrow street shell', level: 'macro', material: 'painted-plaster' },
    { id: 'roof-and-airwell', name: 'Split roof and open airwell', level: 'macro', material: 'terracotta-roof', topologyIntent: 'Two pitched roof volumes separated by a real open airwell.' },
    { id: 'five-footway', name: 'Sheltered five-footway assembly', level: 'macro', material: 'painted-plaster' },
    { id: 'rear-court', name: 'Rear court and service block', level: 'macro', material: 'painted-plaster', confidence: 0.68 },
    { id: 'upper-facade', name: 'Projecting upper street facade', level: 'meso', parent: 'street-shell', material: 'painted-plaster', localFeatures: [
      { id: 'eaves-perforation-row', type: 'hole', geometryEffect: 'repeated cutout fascia rhythm', confidence: 0.92 },
      { id: 'layered-cornice-ridges', type: 'ridge', geometryEffect: 'three stepped horizontal mouldings', confidence: 0.96 },
    ] },
    { id: 'upper-window-system', name: 'Three French-window bay assemblies', level: 'meso', parent: 'upper-facade', material: 'painted-timber', localFeatures: [
      { id: 'oval-vent-row', type: 'hole', geometryEffect: 'three inset oval openings', confidence: 0.94 },
      { id: 'paired-jalousie-shutters', type: 'linework', geometryEffect: 'six framed shutter leaves with contained louvres', confidence: 0.98 },
      { id: 'balustrade-row', type: 'ridge', geometryEffect: 'vertical post-and-rail balustrades', confidence: 0.94 },
      { id: 'lower-timber-panel-seams', type: 'seam', geometryEffect: 'recessed joinery panels', confidence: 0.9 },
    ] },
    { id: 'facade-pilasters', name: 'Fluted pilasters and capitals', level: 'meso', parent: 'upper-facade', material: 'painted-plaster', localFeatures: [
      { id: 'floral-capital-pair', type: 'ridge', geometryEffect: 'stacked floral capital blocks', confidence: 0.9 },
      { id: 'vertical-fluting', type: 'groove', geometryEffect: 'paired vertical recess lines', confidence: 0.91 },
    ] },
    { id: 'ceramic-spandrels', name: 'Floral ceramic spandrel panels', level: 'meso', parent: 'upper-facade', material: 'ceramic-tile', primitive: 'plane-card', topologyClass: 'material-only' },
    { id: 'ground-front', name: 'Residential ground facade', level: 'meso', parent: 'street-shell', material: 'painted-timber' },
    { id: 'end-wall', name: 'End-bay side elevation', level: 'meso', parent: 'street-shell', material: 'painted-plaster', confidence: 0.72 },
    { id: 'rear-service-block', name: 'Rear kitchen and service elevation', level: 'meso', parent: 'rear-court', material: 'painted-plaster', confidence: 0.64 },
    { id: 'roof-tiles', name: 'Terracotta roof tile rows', level: 'meso', parent: 'roof-and-airwell', material: 'terracotta-roof' },
    { id: 'fanlight-glass', name: 'Colored fanlight pane grids', level: 'micro', parent: 'upper-window-system', material: 'fanlight-glass', primitive: 'plane-card', topologyClass: 'material-only' },
    { id: 'pintu-pagar', name: 'Half-height pintu pagar', level: 'micro', parent: 'ground-front', material: 'painted-timber' },
    { id: 'eaves-fascia', name: 'Perforated eaves fascia', level: 'micro', parent: 'upper-facade', material: 'painted-timber' },
    { id: 'downpipes', name: 'Side and rear rainwater pipes', level: 'micro', parent: 'end-wall', material: 'metal', primitive: 'curve-sweep', topologyClass: 'fiber-strand' },
    { id: 'airwell-screen', name: 'Airwell parapet and window screen', level: 'micro', parent: 'roof-and-airwell', material: 'painted-timber', confidence: 0.62 },
  ];
  spec.componentTree = [root, ...definitions.map((definition) => component(root, definition))];

  const base = spec.materials[0];
  spec.materials = [
    material(base, { id: 'painted-plaster', name: 'Pale mint and cream lime plaster', color: '#a9c6b5', secondary: ['#e8dfc8', '#809b8f'], roughness: 0.76, normalStrength: 0.16, bumpAmplitude: 0.025, referencePbr: referencePbr('painted-plaster', 'peranakan-plaster'), localOverrides: [
      { id: 'end-wall-weathering', region: 'end-wall drain path and cornice undersides', roughness: 0.84, dirtAmount: 0.08, streak: 'gravity-down', fadedMask: 0.06, evidenceRefs: ['full-object'] },
    ], notes: 'Muted painted plaster; extracted palette is used as evidence but not projected because the facade colors are flat architectural paint.' }),
    material(base, { id: 'painted-timber', name: 'Painted jalousie shutters and joinery', color: '#7fa99a', secondary: ['#f1ead2', '#5f7f73'], roughness: 0.62, normalStrength: 0.12, bumpPattern: 'fine linear timber grain', bumpAmplitude: 0.022, notes: 'Satin painted timber with contained louvre relief and subtly smoother handled edges.' }),
    material(base, { id: 'ceramic-tile', name: 'Glazed floral ceramic tile', color: '#e9d8b9', secondary: ['#df6f83', '#6eaa8a', '#6b96ad'], roughness: 0.26, variation: 0.05, normalStrength: 0.08, localOverrides: [{ id: 'floral-panel-pattern', region: 'upper-facade spandrels', roughness: 0.22, clearcoat: 0.55, evidenceRefs: ['full-object'] }], notes: 'Glazed floral accents are simplified as authored colored relief, not copied photography.' }),
    material(base, { id: 'terracotta-roof', name: 'Terracotta clay roof tiles', color: '#b96750', secondary: ['#8d4e3e', '#d48666'], roughness: 0.78, normalStrength: 0.22, bumpPattern: 'repeated clay tile lip', bumpAmplitude: 0.06, notes: 'High-roughness clay rows with darker overlaps and restrained color variation.' }),
    material(base, { id: 'fanlight-glass', name: 'Colored fanlight glazing', color: '#8aa7b0', secondary: ['#8f6f9f', '#7fa86e', '#cf9d56'], roughness: 0.18, variation: 0.03, normalStrength: 0.02, localOverrides: [{ id: 'colored-pane-sequence', region: 'three rectangular fanlight grids', roughness: 0.16, clearcoat: 0.72, evidenceRefs: ['full-object'] }], notes: 'Opaque stylised glazing in multiple colored panes for stable low-poly rendering.' }),
    material(base, { id: 'metal', name: 'Painted drainpipe and balustrade metal', color: '#48635d', secondary: ['#2e4541'], roughness: 0.48, variation: 0.04, normalStrength: 0.05, notes: 'Low-metalness painted iron with slightly worn edges.' }),
  ];
  spec.repetitionSystems = [
    repetition('repeat-window-bays', 'Three French-window bays', 'upper-window-system', 3),
    repetition('repeat-shutter-louvres', 'Contained jalousie slats within six leaves', 'upper-window-system', 42),
    repetition('repeat-fanlight-panes', 'Colored fanlight pane grids', 'fanlight-glass', 15),
    repetition('repeat-balustrades', 'Vertical balustrade posts', 'upper-window-system', 18),
    repetition('repeat-roof-tiles', 'Overlapping clay tile rows', 'roof-tiles', 18),
  ];
  spec.featureReviewTargets = [
    reviewTarget('peranakan-massing', 'Narrow shophouse, upper projection, five-footway and split roof', ['blockout', 'form-refinement'], ['street-shell', 'five-footway', 'roof-and-airwell']),
    reviewTarget('peranakan-windows', 'Full-height French windows, fanlights and balustrades', ['structural-pass', 'form-refinement'], ['upper-window-system', 'fanlight-glass']),
    reviewTarget('peranakan-ornament', 'Pilasters, floral spandrels and layered cornices', ['structural-pass', 'surface-pass'], ['facade-pilasters', 'ceramic-spandrels', 'upper-facade']),
    reviewTarget('peranakan-hidden-elevations', 'End wall, airwell and rear court', ['form-refinement', 'interaction-pass'], ['end-wall', 'roof-and-airwell', 'rear-court'], 'important'),
  ];
  spec.lightingFromPhoto = [
    'Neutral 5200 K key from camera-left at 1.0 intensity with soft 1.4 m equivalent source and contact shadows.',
    'Warm low-intensity fill at 0.28 preserves deep window and five-footway recesses without flattening them.',
    'Cool rim at 0.3 separates roof eaves and end-wall relief; ACES Filmic exposure 1.0 on a pale neutral background.',
  ];
  spec.viewEvidence[0].observations = ['Upper facade with three full-height paired shutter windows, colored fanlights, balustrades, floral tile spandrels, pilasters and layered eaves.'];
  spec.viewEvidence[0].confidence = 0.9;
  spec.suitability = 'conditional';
  spec.assumptions.push('End-bay side elevation, airwell and rear court are conservative typological inference and are reviewed separately from the documented facade.');
  spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
}

function completeMerlion(spec) {
  const root = spec.componentTree[0];
  root.name = 'Merlion statue assembly root';
  root.role = 'root-container';
  root.material = 'statue-aggregate';
  root.materialLayers = ['statue-aggregate'];
  root.colorMaterialRecipe = { materialRef: 'statue-aggregate', evidenceRefs: ['full-object'], note: 'Invisible assembly root uses the complete primary sculptural material.' };
  root.topologyRationale = 'Named assembly container for anatomical, scale, pedestal and water assemblies.';

  const definitions = [
    { id: 'lion-head', name: 'Angular lion head and throat', level: 'macro', material: 'statue-aggregate', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt', topologyRationale: 'A smoothly varying sculptural head volume built from overlapping displaced ellipsoids rather than one sphere.' },
    { id: 'fish-body', name: 'Tapered fish-body column', level: 'macro', material: 'statue-aggregate', primitive: 'lathe', topologyClass: 'continuous-sculpt', topologyRationale: 'A tapered continuous body profile with repeated relief applied over its surface.', localFeatures: [
      { id: 'pectoral-fin', type: 'ridge', geometryEffect: 'tapered silhouette fin attached at shoulder', confidence: 0.9 },
      { id: 'staggered-scale-relief', type: 'ridge', geometryEffect: 'overlapping scallop rows around the body', confidence: 0.98 },
      { id: 'tapered-profile', type: 'contour', geometryEffect: 'narrowing lathed torso with forward belly', confidence: 0.97 },
    ] },
    { id: 'wave-pedestal', name: 'Layered mosaic wave pedestal', level: 'macro', material: 'blue-mosaic', primitive: 'lathe', topologyClass: 'assembled-solid', localFeatures: [
      { id: 'layered-crest-bands', type: 'ridge', geometryEffect: 'stacked elliptical crest bands', confidence: 0.95 },
    ] },
    { id: 'water-stream', name: 'Tapered fountain water stream', level: 'macro', material: 'water', primitive: 'curve-sweep', topologyClass: 'fiber-strand' },
    { id: 'brow-and-eyes', name: 'Brow ridges and inset eyes', level: 'meso', parent: 'lion-head', material: 'statue-aggregate', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt', localFeatures: [{ id: 'brow-ridge', type: 'ridge', geometryEffect: 'projecting brow over inset eye', confidence: 0.88 }] },
    { id: 'muzzle-nose', name: 'Muzzle and broad nose', level: 'meso', parent: 'lion-head', material: 'statue-aggregate', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt', localFeatures: [{ id: 'muzzle-nose-contour', type: 'contour', geometryEffect: 'forward muzzle and downturned lip profile', confidence: 0.93 }] },
    { id: 'jaw-assembly', name: 'Upper jaw, mouth cavity and lower jaw', level: 'meso', parent: 'lion-head', material: 'mouth-cavity', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt', localFeatures: [
      { id: 'deep-mouth-cavity', type: 'hole', geometryEffect: 'real negative space between separate jaws', confidence: 0.98 },
      { id: 'lower-jaw-chin', type: 'contour', geometryEffect: 'separate projecting chin volume', confidence: 0.94 },
    ] },
    { id: 'mane-system', name: 'Layered crown, cheek and rear mane', level: 'meso', parent: 'lion-head', material: 'statue-aggregate', primitive: 'instanced-cluster', topologyClass: 'conforming-shell', localFeatures: [
      { id: 'crown-plate-overlap', type: 'ridge', geometryEffect: 'flattened overlapping crown plates', confidence: 0.95 },
      { id: 'cheek-lock-layers', type: 'ridge', geometryEffect: 'swept attached cheek and shoulder plates', confidence: 0.97 },
    ] },
    { id: 'scale-system', name: 'Staggered overlapping scale rows', level: 'meso', parent: 'fish-body', material: 'statue-aggregate', primitive: 'instanced-cluster', topologyClass: 'surface-relief' },
    { id: 'tail-wave-assembly', name: 'Tail and white foam transition', level: 'meso', parent: 'fish-body', material: 'statue-aggregate', primitive: 'curve-sweep', topologyClass: 'continuous-sculpt', localFeatures: [{ id: 'foam-and-tail-ridges', type: 'ridge', geometryEffect: 'attached tail sweep and foam crest relief', confidence: 0.83 }] },
    { id: 'pedestal-plinth', name: 'Dark elliptical plinth', level: 'meso', parent: 'wave-pedestal', material: 'dark-plinth', primitive: 'cylinder' },
    { id: 'neck-collar', name: 'Mane-to-fish neck collar', level: 'meso', parent: 'lion-head', material: 'statue-aggregate', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt' },
    { id: 'water-emitter', name: 'Mouth fountain socket', level: 'micro', parent: 'jaw-assembly', material: 'water', primitive: 'cylinder' },
    { id: 'nose-pad', name: 'Broad sculpted nose pad', level: 'micro', parent: 'muzzle-nose', material: 'statue-aggregate', primitive: 'ellipsoid', topologyClass: 'continuous-sculpt' },
    { id: 'eye-cavities', name: 'Inset eye cavities', level: 'micro', parent: 'brow-and-eyes', material: 'mouth-cavity', primitive: 'sphere' },
    { id: 'mane-grooves', name: 'Longitudinal mane grooves', level: 'micro', parent: 'mane-system', material: 'statue-aggregate', primitive: 'curve-sweep', topologyClass: 'surface-relief' },
    { id: 'wave-foam-crests', name: 'White foam crest accents', level: 'micro', parent: 'wave-pedestal', material: 'statue-aggregate', primitive: 'curve-sweep', topologyClass: 'surface-relief' },
  ];
  spec.componentTree = [root, ...definitions.map((definition) => component(root, definition))];

  const base = spec.materials[0];
  spec.materials = [
    material(base, { id: 'statue-aggregate', name: 'White cement and porcelain aggregate', color: '#e7e0cf', secondary: ['#cfc6b4', '#f4efe3'], roughness: 0.68, variation: 0.09, normalStrength: 0.16, bumpPattern: 'fine aggregate grain', bumpAmplitude: 0.028, referencePbr: referencePbr('statue-aggregate', 'merlion-aggregate'), localOverrides: [{ id: 'pedestal-gloss-split', region: 'white foam accents and protected mane grooves', roughness: 0.58, aoBoost: 0.1, evidenceRefs: ['full-object'] }], notes: 'Warm off-white satin aggregate; the night reference extraction is evidence for frequency and value range, not direct albedo projection.' }),
    material(base, { id: 'mouth-cavity', name: 'Deep mouth and eye cavities', color: '#34312d', secondary: ['#171817'], roughness: 0.86, variation: 0.04, normalStrength: 0.04, localOverrides: [{ id: 'cavity-black', region: 'mouth interior and inset eyes', roughness: 0.9, aoBoost: 0.35, evidenceRefs: ['full-object'] }], notes: 'High-roughness dark cavity material establishes real negative space without oversized mascot eyes.' }),
    material(base, { id: 'blue-mosaic', name: 'Blue ceramic wave mosaic', color: '#315d85', secondary: ['#4e79a0', '#1f405f', '#d7d2c4'], roughness: 0.28, variation: 0.07, normalStrength: 0.12, bumpPattern: 'small ceramic tile grid', bumpAmplitude: 0.025, notes: 'Glossy layered blue wave bands with independent grout-scale normal response.' }),
    material(base, { id: 'dark-plinth', name: 'Dark stone pedestal plinth', color: '#342e28', secondary: ['#4a4035'], roughness: 0.7, variation: 0.08, normalStrength: 0.14, notes: 'Quiet dark plinth grounds the luminous sculpture.' }),
    material(base, { id: 'water', name: 'Blue-white fountain water', color: '#a8d9e8', secondary: ['#e8fbff', '#6fb7cf'], roughness: 0.12, variation: 0.05, normalStrength: 0.2, localOverrides: [{ id: 'stream-froth', region: 'outer stream and landing end', roughness: 0.24, opacity: 0.78, evidenceRefs: ['full-object'] }], notes: 'Tapered semi-transparent curve with slight radius variation and pale foam accents; not an opaque constant-radius pole.' }),
  ];
  spec.repetitionSystems = [
    repetition('repeat-body-scales', 'Staggered overlapping body scales', 'scale-system', 72, 'radial'),
    repetition('repeat-mane-plates', 'Overlapping crown and cheek mane plates', 'mane-system', 15, 'radial'),
    repetition('repeat-wave-bands', 'Layered elliptical wave crest bands', 'wave-pedestal', 6, 'radial'),
    repetition('repeat-mane-grooves', 'Longitudinal relief grooves across mane plates', 'mane-grooves', 18, 'radial'),
  ];
  spec.featureReviewTargets = [
    reviewTarget('merlion-silhouette', 'Angular lion head over tapered fish-body column', ['blockout', 'form-refinement'], ['lion-head', 'fish-body']),
    reviewTarget('merlion-face', 'Brow, muzzle, open jaw and deep mouth cavity', ['structural-pass', 'form-refinement'], ['brow-and-eyes', 'muzzle-nose', 'jaw-assembly']),
    reviewTarget('merlion-mane', 'Swept overlapping mane plates', ['structural-pass', 'surface-pass'], ['mane-system', 'mane-grooves']),
    reviewTarget('merlion-scales', 'Staggered fish scales, fin and tail transition', ['structural-pass', 'surface-pass'], ['fish-body', 'scale-system', 'tail-wave-assembly']),
    reviewTarget('merlion-pedestal-water', 'Layered wave pedestal and mouth-aligned water arc', ['form-refinement', 'material-pass'], ['wave-pedestal', 'water-stream'], 'important'),
  ];
  spec.lightingFromPhoto = [
    'Neutral 5000 K key from camera-left at 1.1 intensity reveals the white sculptural planes without clipping them.',
    'Cool fill at 0.22 preserves the deep mouth and mane grooves while maintaining readable cavity contrast.',
    'Soft rear rim at 0.35 separates mane plates and scales; ACES Filmic exposure 0.95 with contact shadow under the pedestal.',
  ];
  spec.viewEvidence[0].observations = ['Side view clearly shows angular lion profile, open jaw, layered mane, pectoral fin, dense overlapping scales, tapered fish body and layered wave pedestal.'];
  spec.viewEvidence[0].confidence = 0.91;
  spec.suitability = 'conditional';
  spec.assumptions.push('Far side and rear tail transition are inferred through bilateral symmetry and searched supporting views; output remains a stylised low-poly reconstruction.');
  spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
}

for (const [fileName, complete] of [
  ['peranakan-house.json', completePeranakan],
  ['merlion.json', completeMerlion],
]) {
  const file = path.join(specsDir, fileName);
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  complete(spec);
  const rgba = (hex) => {
    const value = hex.replace('#', '');
    const expanded = value.length === 3 ? [...value].map((digit) => `${digit}${digit}`).join('') : value;
    return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(expanded.slice(2, 4), 16)}, ${Number.parseInt(expanded.slice(4, 6), 16)}, 1.0)`;
  };
  const materialClasses = {
    'painted-plaster': 'stone',
    'painted-timber': 'wood',
    'ceramic-tile': 'ceramic',
    'terracotta-roof': 'ceramic',
    'fanlight-glass': 'glass',
    metal: 'metal',
    'statue-aggregate': 'stone',
    'mouth-cavity': 'stone',
    'blue-mosaic': 'ceramic',
    'dark-plinth': 'stone',
    water: 'glass',
  };
  const primaryReferencePbr = clone(spec.materials.find((entry) => entry.referencePbr)?.referencePbr);
  for (const entry of spec.materials) {
    entry.referencePbr ??= clone(primaryReferencePbr);
    entry.referencePbr.usable = true;
    entry.referencePbr.confidence ??= 0.72;
    entry.referencePbr.limitation = `${entry.referencePbr.limitation ?? ''} Shared source-image evidence is used only to set response ranges; flat-color materials are authored independently.`.trim();
  }
  const materialById = new Map(spec.materials.map((entry) => [entry.id, entry]));
  for (const entry of spec.componentTree) {
    const assigned = materialById.get(entry.material) ?? spec.materials[0];
    entry.colorMaterialRecipe = {
      dominantAlbedo: rgba(assigned.baseColor),
      secondaryAlbedo: rgba(assigned.albedo.secondary[0] ?? assigned.baseColor),
      materialClass: materialClasses[assigned.id] ?? 'unknown',
      materialClassConfidence: 0.86,
      evidenceRefs: entry.evidenceRefs ?? ['full-object'],
      notes: 'Palette and material class follow the reference-led quality contract; no photographic texture is projected.',
    };
    if (entry.parent) {
      entry.attachment = {
        parentSocket: `${entry.parent}-surface`,
        localStart: [0, 0, 0],
        localEnd: [0, 0.08, 0],
        contactType: 'overlap',
        overlap: 0.04,
        embedDepth: 0.025,
        gapTolerance: 0.01,
      };
    }
  }
  for (const detail of spec.preSpecAssessment.detailInventory.details) {
    detail.mapsTo.ref = detail.mapsTo.ref.replace('.', '/');
    const refCorrections = {
      'floral-tile-spandrels': 'ceramic-tile/floral-panel-pattern',
      'heavy-brow': 'brow-and-eyes/brow-ridge',
      'muzzle-and-nose': 'muzzle-nose/muzzle-nose-contour',
      'ceramic-gloss-variation': 'statue-aggregate/pedestal-gloss-split',
    };
    detail.mapsTo.ref = refCorrections[detail.id] ?? detail.mapsTo.ref;
    detail.realization = detail.mapsTo.type;
  }
  for (const pass of spec.buildPasses) pass.componentRefs = spec.componentTree.map(({ id }) => id);
  fs.writeFileSync(file, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`Completed ${file}`);
}
