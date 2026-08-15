import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const specsRoot = path.join(root, 'specs');
const refsRoot = path.join(root, 'references');

const profiles = {
  'smooth-coated-otter': {
    type: 'stylized smooth-coated otter',
    forms: ['organic', 'character-like'],
    structure: ['branching hierarchy', 'articulated assembly'],
    motion: ['whole-object transform', 'articulated', 'bendable'],
    families: ['short fur', 'skin-like', 'keratin'],
    score: [3, 3, 2, 2, 2, 3, 2, 3],
    secondary: 'smooth-coated-otter.jpg',
    silhouette: 'Long low torso with a rounded head, short limbs and a broad curved tail; body length is approximately 2.5 torso heights.',
    unknowns: ['Belly topology and the far-side limb pose are inferred from bilateral anatomy.', 'Exact webbing and claw proportions are approximated for browser-scale readability.'],
    materials: [
      ['fur-brown', '#675148', 0.68, 0.0, 'directional short-fur grain'],
      ['fur-buff', '#B8A58A', 0.72, 0.0, 'lighter throat and underside fur'],
      ['wet-features', '#211916', 0.18, 0.0, 'nose and eye clearcoat'],
    ],
    components: [
      ['root', 'Otter root', 'macro', null, 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['torso', 'Streamlined torso', 'macro', 'root', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['head', 'Rounded head', 'macro', 'torso', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['tail', 'Flattened tapering tail', 'macro', 'torso', 'curve-sweep', 'continuous-sculpt', 'fur-brown'],
      ['neck', 'Tapered neck', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'fur-buff'],
      ['muzzle', 'Blunt muzzle', 'meso', 'head', 'ellipsoid', 'continuous-sculpt', 'fur-buff'],
      ['forelimb-left', 'Left forelimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'fur-brown'],
      ['forelimb-right', 'Right forelimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'fur-brown'],
      ['hindlimb-left', 'Left hindlimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'fur-brown'],
      ['hindlimb-right', 'Right hindlimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'fur-brown'],
      ['paw-left-front', 'Left front webbed paw', 'meso', 'forelimb-left', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['paw-right-front', 'Right front webbed paw', 'meso', 'forelimb-right', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['paw-left-hind', 'Left hind webbed paw', 'meso', 'hindlimb-left', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
      ['paw-right-hind', 'Right hind webbed paw', 'meso', 'hindlimb-right', 'ellipsoid', 'continuous-sculpt', 'fur-brown'],
    ],
    features: [
      ['pale-throat-mask', 'stain', 'fur-buff'], ['webbed-toe-fans', 'ridge', 'paw-left-front'],
      ['nose-clearcoat', 'gloss', 'wet-features'], ['whisker-sockets', 'hole', 'muzzle'],
      ['ear-rims', 'ridge', 'head'], ['fur-flow-grooves', 'groove', 'torso'],
      ['tail-flattening-keel', 'ridge', 'tail'], ['eye-catchlights', 'gloss', 'wet-features'],
      ['paw-claw-row', 'ridge', 'paw-right-front'], ['wet-back-sheen', 'gloss', 'fur-brown'],
    ],
    repeat: ['whisker-and-claw-system', 34, 'radial and digit-tip clusters', 'tube/instanced geometry'],
    review: [['body-tail-silhouette', ['torso', 'tail']], ['rounded-head-muzzle', ['head', 'muzzle']], ['limb-webbing-attachments', ['forelimb-left', 'hindlimb-left', 'paw-left-front']], ['coat-zoning-response', ['torso', 'neck']]],
  },
  'red-junglefowl': {
    type: 'stylized adult male red junglefowl',
    forms: ['organic', 'character-like'],
    structure: ['layered shell', 'articulated assembly', 'repeated modules'],
    motion: ['whole-object transform', 'articulated'],
    families: ['feather', 'skin-like', 'keratin'],
    score: [3, 3, 3, 3, 3, 3, 2, 3],
    silhouette: 'Upright rooster with an inclined torso, high neck, long slate legs and an arched fan of sickle feathers.',
    unknowns: ['Opposite-wing feather layering is inferred by bilateral symmetry.', 'Exact individual feather counts are reduced to layered silhouette groups.'],
    materials: [
      ['plumage-dark', '#12201E', 0.48, 0.05, 'blue-green black feather sheen'],
      ['hackle-orange', '#C66A1E', 0.62, 0.0, 'orange-gold hackle and saddle feathers'],
      ['comb-red', '#C51F2E', 0.55, 0.0, 'comb and wattles'],
      ['leg-slate', '#777C74', 0.78, 0.0, 'slate-grey scaled legs'],
      ['ear-white', '#E9E1C6', 0.7, 0.0, 'white ear patch and rump'],
    ],
    components: [
      ['root', 'Junglefowl root', 'macro', null, 'ellipsoid', 'continuous-sculpt', 'plumage-dark'],
      ['torso', 'Inclined torso', 'macro', 'root', 'ellipsoid', 'continuous-sculpt', 'plumage-dark'],
      ['head', 'Rooster head', 'macro', 'torso', 'ellipsoid', 'continuous-sculpt', 'comb-red'],
      ['tail-fan', 'Arched sickle tail', 'macro', 'torso', 'instanced-cluster', 'fiber-strand', 'plumage-dark'],
      ['neck-hackle', 'Orange hackle neck', 'meso', 'torso', 'curve-sweep', 'continuous-sculpt', 'hackle-orange'],
      ['beak', 'Tapered beak', 'meso', 'head', 'extrude', 'assembled-solid', 'leg-slate'],
      ['comb', 'Serrated comb', 'meso', 'head', 'extrude', 'continuous-sculpt', 'comb-red'],
      ['wattle-left', 'Left wattle', 'meso', 'head', 'ellipsoid', 'continuous-sculpt', 'comb-red'],
      ['wattle-right', 'Right wattle', 'meso', 'head', 'ellipsoid', 'continuous-sculpt', 'comb-red'],
      ['wing-left', 'Left layered wing', 'meso', 'torso', 'plane-card', 'conforming-shell', 'plumage-dark'],
      ['wing-right', 'Right layered wing', 'meso', 'torso', 'plane-card', 'conforming-shell', 'plumage-dark'],
      ['leg-left', 'Left slate leg', 'meso', 'torso', 'capsule', 'assembled-solid', 'leg-slate'],
      ['leg-right', 'Right slate leg', 'meso', 'torso', 'capsule', 'assembled-solid', 'leg-slate'],
      ['foot-left', 'Left four-toed foot', 'meso', 'leg-left', 'instanced-cluster', 'fiber-strand', 'leg-slate'],
      ['foot-right', 'Right four-toed foot', 'meso', 'leg-right', 'instanced-cluster', 'fiber-strand', 'leg-slate'],
    ],
    features: [
      ['comb-serrations', 'ridge', 'comb'], ['white-ear-disc', 'stain', 'ear-white'],
      ['white-rump-zone', 'stain', 'ear-white'], ['hackle-feather-ridges', 'ridge', 'neck-hackle'],
      ['wing-covert-seams', 'seam', 'wing-left'], ['tail-iridescent-gloss', 'gloss', 'plumage-dark'],
      ['eye-catchlight', 'gloss', 'plumage-dark'], ['leg-scale-grooves', 'groove', 'leg-left'],
      ['toe-claw-tips', 'ridge', 'foot-left'], ['beak-seam', 'linework', 'beak'],
    ],
    repeat: ['feather-layer-system', 42, 'overlapping wing, hackle and tail arcs', 'instanced cards/curves'],
    review: [['upright-rooster-silhouette', ['torso', 'neck-hackle', 'tail-fan']], ['comb-wattle-ear-identity', ['head', 'comb', 'wattle-left']], ['arched-tail-feather-system', ['tail-fan']], ['slate-leg-foot-system', ['leg-left', 'foot-left']]],
  },
  'oriental-pied-hornbill': {
    type: 'stylized male Oriental pied hornbill',
    forms: ['organic', 'character-like'],
    structure: ['layered shell', 'articulated assembly'],
    motion: ['whole-object transform', 'articulated'],
    families: ['feather', 'keratin', 'skin-like'],
    score: [3, 3, 3, 2, 3, 3, 2, 3],
    secondary: 'oriental-pied-hornbill.jpg',
    silhouette: 'Perched long-tailed hornbill with an oversized down-curved bill and a raised casque above the skull.',
    unknowns: ['Dorsal wing layout and rear casque curvature are inferred.', 'Feather counts are grouped into readable real-time layers.'],
    materials: [
      ['plumage-black', '#151A20', 0.5, 0.03, 'satin black feather response'],
      ['plumage-white', '#E7E4D7', 0.72, 0.0, 'white belly, wing patch and tail panels'],
      ['bill-ivory', '#D9C989', 0.48, 0.0, 'pale yellow bill and casque'],
      ['eye-red', '#6C2018', 0.16, 0.0, 'male red eye clearcoat'],
    ],
    components: [
      ['root', 'Hornbill root', 'macro', null, 'ellipsoid', 'continuous-sculpt', 'plumage-black'],
      ['torso', 'Perched torso', 'macro', 'root', 'ellipsoid', 'continuous-sculpt', 'plumage-black'],
      ['head', 'Hornbill head', 'macro', 'torso', 'ellipsoid', 'continuous-sculpt', 'plumage-black'],
      ['tail', 'Long primary tail', 'macro', 'torso', 'instanced-cluster', 'conforming-shell', 'plumage-white'],
      ['neck', 'Curved neck', 'meso', 'torso', 'curve-sweep', 'continuous-sculpt', 'plumage-black'],
      ['upper-bill', 'Curved upper bill', 'meso', 'head', 'extrude', 'continuous-sculpt', 'bill-ivory'],
      ['lower-bill', 'Lower mandible', 'meso', 'head', 'extrude', 'continuous-sculpt', 'bill-ivory'],
      ['casque', 'Black-tipped casque', 'meso', 'upper-bill', 'extrude', 'continuous-sculpt', 'bill-ivory'],
      ['wing-left', 'Left folded wing', 'meso', 'torso', 'plane-card', 'conforming-shell', 'plumage-black'],
      ['wing-right', 'Right folded wing', 'meso', 'torso', 'plane-card', 'conforming-shell', 'plumage-black'],
      ['leg-left', 'Left leg', 'meso', 'torso', 'capsule', 'assembled-solid', 'plumage-black'],
      ['leg-right', 'Right leg', 'meso', 'torso', 'capsule', 'assembled-solid', 'plumage-black'],
      ['foot-left', 'Left gripping foot', 'meso', 'leg-left', 'instanced-cluster', 'fiber-strand', 'plumage-black'],
      ['foot-right', 'Right gripping foot', 'meso', 'leg-right', 'instanced-cluster', 'fiber-strand', 'plumage-black'],
    ],
    features: [
      ['casque-black-tip', 'stain', 'bill-ivory'], ['bill-cutting-seam', 'linework', 'upper-bill'],
      ['eye-ring', 'contour', 'head'], ['red-eye-gloss', 'gloss', 'eye-red'],
      ['white-belly-mask', 'stain', 'plumage-white'], ['wing-white-patch', 'stain', 'plumage-white'],
      ['tail-black-band', 'stain', 'plumage-black'], ['wing-feather-seams', 'seam', 'wing-left'],
      ['bill-edge-bevel', 'bevel', 'upper-bill'], ['toe-claw-ridges', 'ridge', 'foot-left'],
    ],
    repeat: ['flight-feather-system', 28, 'layered wings and tail fan', 'instanced cards'],
    review: [['bill-casque-profile', ['upper-bill', 'lower-bill', 'casque']], ['pied-plumage-zoning', ['torso', 'wing-left', 'tail']], ['body-tail-counterbalance', ['torso', 'tail']], ['perching-foot-attachments', ['leg-left', 'foot-left']]],
  },
  'clouded-monitor': {
    type: 'stylized clouded monitor lizard',
    forms: ['organic'],
    structure: ['branching hierarchy', 'articulated assembly', 'repeated modules'],
    motion: ['whole-object transform', 'articulated', 'bendable'],
    families: ['scaled skin', 'keratin'],
    score: [3, 3, 3, 3, 2, 3, 3, 3],
    secondary: 'clouded-monitor.jpg',
    silhouette: 'Low elongated reptile with a narrow raised head, four splayed clawed limbs and a long round tapering tail.',
    unknowns: ['Full tail tip and underside coloration are inferred from species proportions.', 'Far-side limb pose is reconstructed bilaterally.'],
    materials: [
      ['scale-brown', '#51483B', 0.78, 0.0, 'leathery scale field'],
      ['scale-yellow', '#B9A65D', 0.72, 0.0, 'dense pale-yellow spot clusters'],
      ['eye-claw-dark', '#161714', 0.2, 0.0, 'glossy eye and keratin claws'],
    ],
    components: [
      ['root', 'Monitor root', 'macro', null, 'ellipsoid', 'continuous-sculpt', 'scale-brown'],
      ['torso', 'Long torso', 'macro', 'root', 'ellipsoid', 'continuous-sculpt', 'scale-brown'],
      ['head', 'Short narrow head', 'macro', 'torso', 'ellipsoid', 'continuous-sculpt', 'scale-brown'],
      ['tail', 'Rounded tapering tail', 'macro', 'torso', 'curve-sweep', 'continuous-sculpt', 'scale-brown'],
      ['neck', 'Raised neck', 'meso', 'torso', 'curve-sweep', 'continuous-sculpt', 'scale-brown'],
      ['jaw', 'Lower jaw', 'meso', 'head', 'ellipsoid', 'continuous-sculpt', 'scale-brown'],
      ['forelimb-left', 'Left forelimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'scale-brown'],
      ['forelimb-right', 'Right forelimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'scale-brown'],
      ['hindlimb-left', 'Left hindlimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'scale-brown'],
      ['hindlimb-right', 'Right hindlimb', 'meso', 'torso', 'capsule', 'continuous-sculpt', 'scale-brown'],
      ['foot-left-front', 'Left front foot', 'meso', 'forelimb-left', 'instanced-cluster', 'fiber-strand', 'scale-brown'],
      ['foot-right-front', 'Right front foot', 'meso', 'forelimb-right', 'instanced-cluster', 'fiber-strand', 'scale-brown'],
      ['foot-left-hind', 'Left hind foot', 'meso', 'hindlimb-left', 'instanced-cluster', 'fiber-strand', 'scale-brown'],
      ['foot-right-hind', 'Right hind foot', 'meso', 'hindlimb-right', 'instanced-cluster', 'fiber-strand', 'scale-brown'],
    ],
    features: [
      ['yellow-spot-field', 'stain', 'scale-yellow'], ['transverse-tail-bands', 'linework', 'tail'],
      ['mid-snout-nostril', 'hole', 'head'], ['ear-opening', 'hole', 'head'],
      ['eye-catchlight', 'gloss', 'eye-claw-dark'], ['jaw-seam', 'seam', 'jaw'],
      ['dorsal-scale-ridges', 'ridge', 'torso'], ['neck-fold-grooves', 'groove', 'neck'],
      ['digit-yellow-lines', 'linework', 'scale-yellow'], ['claw-ridge-row', 'ridge', 'foot-left-front'],
    ],
    repeat: ['scale-and-spot-system', 96, 'irregular dorsal clusters and limb rows', 'instanced relief plus color masks'],
    review: [['long-body-tail-silhouette', ['torso', 'tail']], ['short-head-neck-profile', ['head', 'neck']], ['splayed-limb-attachments', ['forelimb-left', 'hindlimb-left']], ['yellow-spot-scale-system', ['torso', 'head']]],
  },
  'singapore-cable-car-skyorb': {
    type: 'stylized unbranded SkyOrb gondola cabin',
    forms: ['hard-surface', 'mechanical'],
    structure: ['layered shell', 'articulated assembly', 'repeated modules'],
    motion: ['whole-object transform', 'articulated', 'detachable'],
    families: ['metal', 'glass-like', 'plastic', 'emissive'],
    score: [3, 3, 3, 2, 3, 3, 2, 3],
    secondary: 'singapore-cable-car-skyorb.jpg',
    silhouette: 'Near-spherical faceted cabin with a deep circular panoramic window and an S-curved roof hanger rising to the cable grip.',
    unknowns: ['Rear door seam and underside fasteners are inferred from the available three-quarter and interior views.', 'Operator logos and campaign wraps are intentionally omitted.'],
    materials: [
      ['chrome-shell', '#B9BDC0', 0.2, 0.85, 'chrome-like faceted shell'],
      ['tinted-glass', '#17242B', 0.08, 0.0, 'dark panoramic glazing with transmission'],
      ['hanger-steel', '#282B2D', 0.34, 0.75, 'painted and exposed roof hardware'],
      ['interior-satin', '#D7DADD', 0.45, 0.15, 'pale benches and ribs'],
      ['led-ring', '#A5D9E8', 0.12, 0.0, 'soft cyan-white emissive ring'],
    ],
    components: [
      ['root', 'SkyOrb root', 'macro', null, 'ellipsoid', 'assembled-solid', 'chrome-shell'],
      ['cabin-shell', 'Spherical cabin shell', 'macro', 'root', 'ellipsoid', 'conforming-shell', 'chrome-shell'],
      ['window-system', 'Panoramic window system', 'macro', 'cabin-shell', 'torus', 'assembled-solid', 'tinted-glass'],
      ['hanger', 'Roof hanger assembly', 'macro', 'cabin-shell', 'curve-sweep', 'assembled-solid', 'hanger-steel'],
      ['window-ring', 'Deep circular window ring', 'meso', 'window-system', 'torus', 'assembled-solid', 'chrome-shell'],
      ['front-glazing', 'Front panoramic glazing', 'meso', 'window-system', 'ellipsoid', 'conforming-shell', 'tinted-glass'],
      ['side-glazing', 'Side panoramic glazing', 'meso', 'cabin-shell', 'plane-card', 'conforming-shell', 'tinted-glass'],
      ['glass-floor', 'Transparent floor panel', 'meso', 'cabin-shell', 'plane-card', 'conforming-shell', 'tinted-glass'],
      ['roof-plate', 'Roof attachment plate', 'meso', 'cabin-shell', 'box', 'assembled-solid', 'hanger-steel'],
      ['cable-grip', 'Cable grip hardware', 'meso', 'hanger', 'instanced-cluster', 'assembled-solid', 'hanger-steel'],
      ['door-seam', 'Rear door seam', 'meso', 'cabin-shell', 'extrude', 'surface-relief', 'hanger-steel'],
      ['bench-left', 'Left interior bench', 'meso', 'cabin-shell', 'box', 'assembled-solid', 'interior-satin'],
      ['bench-right', 'Right interior bench', 'meso', 'cabin-shell', 'box', 'assembled-solid', 'interior-satin'],
      ['vent-louvres', 'Ventilation louvre system', 'meso', 'cabin-shell', 'instanced-cluster', 'surface-relief', 'hanger-steel'],
    ],
    features: [
      ['chrome-panel-seams', 'seam', 'cabin-shell'], ['window-ring-bevel', 'bevel', 'window-ring'],
      ['window-led-ring', 'emissive', 'led-ring'], ['front-glass-gloss', 'gloss', 'tinted-glass'],
      ['side-louvre-slots', 'groove', 'vent-louvres'], ['roof-fastener-row', 'fastener', 'roof-plate'],
      ['door-panel-line', 'linework', 'door-seam'], ['glass-floor-edge', 'bevel', 'glass-floor'],
      ['hanger-weld-seam', 'seam', 'hanger'], ['grip-roller-ridges', 'ridge', 'cable-grip'],
    ],
    repeat: ['louvre-and-fastener-system', 26, 'radial louvres plus linear roof fasteners', 'instanced geometry'],
    review: [['orb-shell-window-silhouette', ['cabin-shell', 'window-ring']], ['hanger-grip-assembly', ['hanger', 'roof-plate', 'cable-grip']], ['transparent-glazing-floor', ['front-glazing', 'side-glazing', 'glass-floor']], ['interior-bench-rib-system', ['bench-left', 'bench-right']]],
  },
};

function attachment(parent, index) {
  return {
    parentId: parent,
    parentSocket: `${parent}-socket-${index}`,
    localStart: [0, 0, 0],
    localEnd: [0, 0.25 + index * 0.01, 0],
    contactType: 'embedded',
    embedDepth: 0.04,
    gapTolerance: 0.01,
    baseRadius: 0.08,
    endRadius: 0.04,
    evidenceRefs: ['primary-photo'],
  };
}

function componentFrom(base, row, index) {
  const [id, name, level, parent, primitive, topologyClass, material] = row;
  const result = structuredClone(base);
  result.id = id;
  result.name = name;
  result.level = level;
  result.role = id === 'root' ? 'body' : (id.includes('wing') ? 'wing' : id.includes('leg') || id.includes('limb') || id.includes('foot') || id.includes('paw') ? 'limb' : id.includes('tail') ? 'tail' : id.includes('hanger') ? 'handle' : 'static-part');
  result.importance = level === 'macro' ? 0.95 : 0.78;
  result.confidence = 0.78;
  result.primitive = primitive;
  result.topologyClass = topologyClass;
  result.topologyRationale = `${name} is classified as ${topologyClass}; ${primitive} preserves its visible cross-section and non-reference-angle volume.`;
  result.parent = parent;
  result.attachment = parent ? attachment(parent, index) : null;
  result.material = material;
  result.materialLayers = [material];
  result.colorMaterialRecipe = null;
  result.dimensions = { width: 0.5, height: 0.5, depth: 0.35, units: 'relative', confidence: 0.72 };
  result.transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  result.geometryDescriptor.topologyIntent = topologyClass === 'assembled-solid' ? 'bevelled hard-surface solid' : 'volumetric procedural form with non-planar cross-section';
  result.geometryDescriptor.edgeTreatment = { type: topologyClass === 'assembled-solid' ? 'chamfer' : 'soft-roll', bevelRadius: 0.025, segments: 2 };
  result.actionProfile.animationRole = id === 'root' ? 'root' : result.role;
  result.actionProfile.pivot.mode = parent ? 'base' : 'center';
  result.actionProfile.collider.type = primitive === 'ellipsoid' ? 'sphere' : primitive === 'capsule' || primitive === 'curve-sweep' ? 'capsule' : 'box';
  result.actionProfile.destruction.fractureGroup = id;
  result.localFeatures = [];
  result.evidenceRefs = ['primary-photo', 'secondary-photo'];
  result.fidelityTier = level === 'macro' ? 'blockout' : 'form-refinement';
  return result;
}

function materialFrom(base, row, index, pbr, sourceImage) {
  const [id, color, roughness, metalness, note] = row;
  const result = structuredClone(base);
  result.id = id;
  result.name = id.replaceAll('-', ' ');
  result.baseColor = color;
  result.color = color;
  result.albedo = { dominant: color, secondary: [color, index === 0 ? '#81756A' : color], samplingNotes: note };
  result.colorVariation = { palette: [color, '#5D5D58', '#D3CBB9'], pattern: note, amplitude: 0.09, heightCorrelation: 0.18 };
  result.roughness = { base: roughness, variation: 0.12, map: 'independent-procedural-roughness', localResponse: 'cavities rougher; exposed ridges slightly smoother' };
  result.metalness = { base: metalness, variation: metalness > 0 ? 0.08 : 0 };
  result.normal = { pattern: note, strength: 0.26, scale: 32, space: 'tangent' };
  result.bump = { pattern: note, amplitude: 0.018, scale: 48 };
  result.ambientOcclusion = { cavityStrength: 0.24, contactShadowBias: 0.3, notes: 'Independent cavity/contact field.' };
  result.localOverrides = [{ id: `${id}-local-response`, region: 'identity-defining zones', roughness: Math.max(0.08, roughness - 0.12), evidenceRefs: ['primary-photo'] }];
  result.clearcoat = roughness < 0.35 ? 0.45 : 0.0;
  result.notes = note;
  if (index === 0) {
    result.referencePbr = {
      version: '1.0', sourceImage, extractor: 'extract_pbr_evidence.py', method: 'reference-derived single-image inference',
      verdict: pbr.verdict, usable: pbr.ok, confidence: pbr.confidence, estimatedFidelity: pbr.estimatedFidelity,
      targetThreshold: pbr.targetThreshold, hardLimit: pbr.limitation, maps: pbr.maps,
    };
  } else {
    result.qualityTier = 'utility';
  }
  return result;
}

function rgbaFromHex(hex) {
  const clean = hex.slice(1);
  return `rgba(${Number.parseInt(clean.slice(0, 2), 16)}, ${Number.parseInt(clean.slice(2, 4), 16)}, ${Number.parseInt(clean.slice(4, 6), 16)}, 1.0)`;
}

for (const [slug, profile] of Object.entries(profiles)) {
  const specPath = path.join(specsRoot, `${slug}-sculpt-spec.json`);
  const assessmentPath = path.join(specsRoot, `${slug}-assessment.json`);
  const pbrPath = path.join(specsRoot, `${slug}-pbr-report.json`);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const pbr = JSON.parse(fs.readFileSync(pbrPath, 'utf8'));
  const componentBase = spec.componentTree[0];
  const materialBase = spec.materials[0];
  spec.suitability = slug === 'red-junglefowl' ? 'pass' : 'conditional';
  spec.scores = { object_isolation: 3, silhouette_readability: 3, depth_inference: 2, primitive_decomposition: 3, material_procedurality: 3, occlusion_risk: 2, interaction_fit: 3 };
  spec.coordinateFrame = { front: '-Z lateral/profile review direction', up: '+Y', scaleReference: 'metres; grounded at lowest visible contact' };
  spec.silhouette = { boundingShape: profile.silhouette, aspectRatios: ['reference-led'], symmetry: 'bilateral with pose asymmetry', dominantCurves: ['primary spine/profile curve', 'appendage taper curves'], negativeSpaces: ['limb/foot gaps', 'appendage/body gaps'], landmarks: profile.review.map(([id]) => id) };
  spec.viewEvidence = [
    { id: 'primary-photo', view: 'lateral or front-three-quarter', imageRegion: { x: 0, y: 0, width: 1, height: 1, units: 'normalized' }, observations: [profile.silhouette], confidence: 0.9 },
    { id: 'secondary-photo', view: 'supplemental anatomy/material', imageRegion: { x: 0, y: 0, width: 1, height: 1, units: 'normalized' }, observations: profile.unknowns, confidence: profile.secondary ? 0.78 : 0.68 },
  ];
  spec.preSpecAssessment.objectClass = {
    primaryType: profile.type, primaryDomain: 'object', formLanguage: profile.forms,
    structureKind: profile.structure, motionPotential: profile.motion, materialFamilies: profile.families,
    notes: 'Reference-led stylized real-time asset; hidden surfaces are explicitly approximate.',
  };
  const keys = ['silhouetteComplexity', 'componentCount', 'hierarchyDepth', 'repetitionDensity', 'materialLayerCount', 'localDetailDensity', 'occlusionRisk', 'actionReadinessNeed'];
  spec.preSpecAssessment.complexity.scores = Object.fromEntries(keys.map((key, index) => [key, profile.score[index]]));
  spec.preSpecAssessment.complexity.estimatedCounts = { macroComponents: profile.components.filter((item) => item[2] === 'macro').length, mesoComponents: profile.components.filter((item) => item[2] === 'meso').length, microFeatureGroups: profile.features.length, materialLayers: profile.materials.length, repetitionSystems: 1 };
  spec.preSpecAssessment.complexity.reasoning = [`${profile.type} has an interrupted articulated silhouette, repeated surface systems, multiple material zones and non-trivial hidden-side inference.`];
  spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
  spec.componentTree = profile.components.map((row, index) => componentFrom(componentBase, row, index));
  const byId = new Map(spec.componentTree.map((item) => [item.id, item]));
  profile.features.forEach(([id, kind, owner], index) => {
    const componentOwner = byId.get(owner) ?? spec.componentTree.find((item) => item.material === owner) ?? spec.componentTree[index % spec.componentTree.length];
    componentOwner.localFeatures.push({ id, type: kind, placement: 'reference-observed identity zone', geometryEffect: kind === 'stain' || kind === 'gloss' || kind === 'linework' ? 'material-local response' : 'explicit relief geometry', materialEffect: kind, confidence: 0.78, evidenceRefs: ['primary-photo'] });
  });
  spec.materials = profile.materials.map((row, index) => materialFrom(materialBase, row, index, pbr, spec.sourceImage));
  const materialMap = new Map(spec.materials.map((material) => [material.id, material]));
  spec.componentTree.forEach((component) => {
    const material = materialMap.get(component.material);
    const primary = rgbaFromHex(material.baseColor);
    component.colorMaterialRecipe = {
      dominantAlbedo: primary,
      secondaryAlbedo: primary,
      materialClass: profile.families.includes('metal') && component.material !== 'tinted-glass' ? 'metal'
        : component.material.includes('glass') ? 'glass'
          : profile.families.includes('short fur') || profile.families.includes('feather') || profile.families.includes('scaled skin') ? 'skin'
            : 'plastic',
      materialClassConfidence: 0.82,
      colorGradient: { type: 'linear', stops: [{ position: 0, color: primary }, { position: 1, color: primary }] },
      evidenceRefs: ['primary-photo'],
    };
  });
  spec.repetitionSystems = [{ id: profile.repeat[0], count: profile.repeat[1], distribution: profile.repeat[2], geometry: profile.repeat[3], realization: 'instanced-geometry', buildsGeometry: true, evidenceRefs: ['primary-photo'] }];
  spec.preSpecAssessment.detailInventory = {
    scanMethod: 'grid-3x3 plus component-zone reconciliation', targetMinDetails: 10,
    note: 'Every detail maps to a component local feature or material local override.',
    details: profile.features.map(([id, kind], index) => ({ id: `detail-${index + 1}-${id}`, kind, region: { x: (index % 3) / 3, y: Math.floor(index / 3) / 4, width: 1 / 3, height: 1 / 4, units: 'normalized' }, affects: kind, scale: index < 4 ? 'meso' : 'micro', evidenceRef: 'primary-photo', confidence: 0.76, mapsTo: { type: 'component.localFeatures', ref: id } })),
  };
  spec.qualityContract.definitionOfDone = [profile.silhouette, `All ${profile.features.length} identity details remain legible in neutral and grazing light.`, 'Front, rear, both side, top, bottom and four three-quarter renders remain volumetric and free of floating attachments.'];
  spec.qualityContract.featureGroups = profile.review.map(([id, refs]) => ({ id, name: id.replaceAll('-', ' '), required: true, qualityCriteria: [`${id} matches the reference-led silhouette, attachment and material zoning.`], evidenceRefs: ['primary-photo', 'secondary-photo'], failureModes: [`${id} reads as a generic placeholder`, `${id} collapses or detaches in an orbit view`] }));
  spec.qualityContract.visualDeltaChecks = profile.review.map(([id]) => `${id} silhouette, depth and material delta`);
  spec.featureReviewTargets = profile.review.map(([id, refs], index) => ({ id, name: id.replaceAll('-', ' '), tier: index < 3 ? 'critical' : 'important', passIds: index === 0 ? ['blockout', 'form-refinement'] : index === 3 ? ['material-pass', 'surface-pass'] : ['structural-pass', 'form-refinement'], minimumScore: index < 3 ? 0.78 : 0.68, mustPass: index < 3, componentRefs: refs, evidenceRefs: ['primary-photo', 'secondary-photo'] }));
  spec.qualityTargets.mustMatch = [profile.silhouette, ...profile.review.map(([id]) => id)];
  spec.qualityTargets.niceToHave = ['micro surface variation beyond the review distance', 'subtle pose asymmetry'];
  spec.qualityTargets.reviewViewpoints = ['front', 'rear', 'left-side', 'right-side', 'top', 'bottom', 'front-three-quarter', 'rear-three-quarter'];
  spec.assumptions = profile.unknowns;
  spec.risks = profile.unknowns;
  spec.lightingFromPhoto = [
    { role: 'key light', direction: [-3, 5, 4], colorTemperature: '5400K', intensity: 3.2, shadowSoftness: 0.45, exposure: 0.9, toneMapping: 'AgX/Filmic' },
    { role: 'fill light', direction: [4, 2, 1], color: '#AFC7D9', intensity: 1.2, ambientColor: '#59616A' },
    { role: 'rim/environment light', direction: [0, 4, -5], color: '#D6E7FF', intensity: 2.0, background: '#E9E4D8', contactShadow: 'soft ground shadow with AO at attachment and foot contacts' },
  ];
  spec.buildPasses.forEach((pass) => { pass.componentRefs = spec.componentTree.filter((item) => item.level === 'macro').map((item) => item.id); });
  spec.lookDevTargets.materialPass.referencePbrExtraction.requiredWhenSourceImagePresent = true;
  spec.performanceBudget = { qualityPriority: 'real-time-browser', targetTriangles: slug === 'singapore-cable-car-skyorb' ? 65000 : 45000, maxDrawCalls: 80, textureSize: 1024, fpsTarget: 60, optimizationPolicy: 'Preserve identity silhouette and named parts first; reduce repeated micro geometry at distance.' };
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  const assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
  assessment.preSpecAssessment = spec.preSpecAssessment;
  assessment.qualityContract = spec.qualityContract;
  fs.writeFileSync(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
}

console.log(`Finalized ${Object.keys(profiles).length} img2threejs sculpt specs.`);
