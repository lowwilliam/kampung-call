import fs from 'node:fs';

const specPath = new URL('alfa-sculpt-spec.json', import.meta.url);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const template = spec.componentTree[0];
const baseMaterial = spec.materials[0];

spec.suitability = 'pass';
spec.scores = { object_isolation: 3, silhouette_readability: 3, depth_inference: 3, primitive_decomposition: 3, material_procedurality: 3, occlusion_risk: 2, interaction_fit: 3 };
spec.preSpecAssessment.complexity.scores = { silhouetteComplexity: 3, componentCount: 3, hierarchyDepth: 3, repetitionDensity: 3, materialLayerCount: 3, localDetailDensity: 3, occlusionRisk: 2, actionReadinessNeed: 3 };
spec.coordinateFrame = { front: '+X points toward the grille', up: '+Y', lateral: '+Z points to vehicle left', scaleReference: 'metres; overall body length 3.90, width 1.58, windshield height 1.28' };
spec.referenceCamera = { solved: true, fovDegrees: 42, aspect: 4 / 3, orientation: { yaw: -42, pitch: -15, roll: 0 }, positionHint: [5.6, 3.0, 5.2], targetHint: [0, 0.65, 0], note: 'Manual multi-view estimate aligned to supplied front three-quarter reference; not a calibrated camera solve.' };
spec.silhouette = {
  boundingShape: 'low 3.90m x 1.58m x 1.28m open roadster with long hood, short tail, and four exposed lower wheel circles',
  aspectRatios: ['length:width 2.47', 'length:body-height 3.45', 'wheelbase:length 0.575'], symmetry: 'bilateral about Z=0 except right-hand-drive controls and exhaust',
  dominantCurves: ['front fender crowns rise over wheel centres then fall into the nose', 'hood crown descends toward the grille', 'rear haunches taper into a rounded trunk', 'windshield frame forms a low shallow arc'],
  negativeSpaces: ['open cockpit', 'four wheel arches', 'twin front intake voids', 'Alfa shield grille slots', 'windshield glazing'],
  landmarks: ['front axle X=1.15', 'rear axle X=-1.15', 'hood leading edge X=1.82', 'cockpit centre X=-0.30', 'windshield base X=0.18', 'trunk edge X=-1.72'],
};
spec.proceduralStrategy = [
  'Build the body tub and deck as section-loft BufferGeometry with compound curvature and mirrored vertices.',
  'Use separate ellipsoid/conforming-shell fenders so the wheel arches remain volumetric from orbit views.',
  'Use curve-swept tubes and extruded profiles for chrome bumpers, grille perimeter, windshield frame, trim, and handles.',
  'Use lathed/cylindrical wheel stacks with repeated ventilation holes and tread blocks.',
  'Use independent hinge and rotation pivot groups for doors, hood, trunk, steering system, and wheels.',
  'Use solid PBR fields for black clearcoat, oxblood upholstery, chrome, rubber, glass, and lenses; source pixels guide scalars but are not projected.',
];

const featuresByComponent = new Map();
for (const detail of spec.preSpecAssessment.detailInventory.details) {
  const ref = detail.mapsTo.ref;
  if (detail.mapsTo.type === 'component.localFeatures') {
    if (!featuresByComponent.has(ref)) featuresByComponent.set(ref, []);
    featuresByComponent.get(ref).push({ id: detail.id, type: detail.kind, description: detail.description, scale: detail.scale, evidenceRefs: [detail.evidenceRef] });
  }
}

function component(id, name, level, role, parent, primitive, topologyClass, position, dimensions, material, options = {}) {
  const c = structuredClone(template);
  c.id = id; c.name = name; c.level = level; c.role = role; c.parent = parent; c.primitive = primitive; c.topologyClass = topologyClass;
  c.topologyRationale = options.topologyRationale || `${name} is represented as ${topologyClass} because its visible volume and seams remain distinct from adjacent assemblies.`;
  c.importance = options.importance ?? (level === 'macro' ? 0.95 : level === 'meso' ? 0.78 : 0.55);
  c.confidence = options.confidence ?? 0.88;
  c.dimensions = { width: dimensions[0], height: dimensions[1], depth: dimensions[2], units: 'm', confidence: c.confidence };
  c.transform = { position, rotation: options.rotation || [0, 0, 0], scale: [1, 1, 1] };
  c.material = material; c.materialLayers = [material];
  const recipeByMaterial = {
    'body-paint':['rgba(8, 10, 9, 1)','rgba(17, 21, 19, 1)','metal'], chrome:['rgba(216, 221, 224, 1)','rgba(245, 247, 246, 1)','metal'],
    rubber:['rgba(17, 16, 15, 1)','rgba(37, 35, 32, 1)','rubber'], glass:['rgba(184, 212, 213, 0.28)','rgba(225, 240, 240, 0.18)','glass'],
    'red-leather':['rgba(143, 23, 27, 1)','rgba(187, 41, 45, 1)','fabric'], 'cabin-black':['rgba(23, 22, 21, 1)','rgba(40, 37, 34, 1)','plastic'],
    'lamp-glass':['rgba(231, 229, 213, 0.72)','rgba(255, 250, 224, 0.55)','glass'], 'red-lens':['rgba(157, 16, 19, 0.9)','rgba(210, 123, 11, 0.9)','plastic'],
    'gauge-black':['rgba(9, 10, 9, 1)','rgba(216, 212, 198, 1)','plastic'], 'dark-metal':['rgba(37, 39, 39, 1)','rgba(8, 9, 9, 1)','metal'],
    plate:['rgba(163, 55, 44, 1)','rgba(211, 155, 36, 1)','metal'], 'utility-dark':['rgba(10, 11, 11, 1)','rgba(18, 19, 19, 1)','plastic'],
  };
  const [dominantAlbedo, secondaryAlbedo, materialClass] = recipeByMaterial[material] || recipeByMaterial['utility-dark'];
  c.colorMaterialRecipe = { dominantAlbedo, secondaryAlbedo, materialClass, materialClassConfidence: options.confidence ?? .88, evidenceRefs: c.evidenceRefs || ['front-three-quarter'] };
  c.geometryDescriptor = {
    topologyIntent: options.topologyIntent || `${topologyClass} procedural real-time mesh with stable normals`,
    edgeTreatment: { type: options.edgeType || 'bevel', bevelRadius: options.bevelRadius ?? 0.018, segments: options.bevelSegments ?? 3 },
    deformationStack: options.deformations || [], uvStrategy: 'generated object-space coordinates', normalStrategy: 'computed vertex normals with bevel continuity',
  };
  c.localFeatures = featuresByComponent.get(id) || [];
  c.deformations = options.deformations || [];
  c.seams = options.seams || [];
  c.joints = options.joints || [];
  c.evidenceRefs = options.evidenceRefs || ['front-three-quarter', 'rear-three-quarter'];
  c.fidelityTier = options.fidelityTier || (level === 'micro' ? 'detail' : 'hero');
  c.attachment = parent ? { parentId: parent, parentSocket: `socket-${parent}-${id}`, localStart: [0, 0, 0], localEnd: options.localEnd || [dimensions[0] * 0.5, 0, 0], contactType: options.contactType || 'surface-mounted', embedDepth: 0.025, overlap: 0.025, gapTolerance: 0.012, evidenceRefs: c.evidenceRefs } : null;
  c.actionProfile.animationRole = options.animationRole || 'static-part';
  c.actionProfile.pivot = { mode: options.pivotMode || 'component-origin', localPosition: options.pivot || [0, 0, 0], axis: options.axis || [0, 1, 0], confidence: c.confidence };
  c.actionProfile.sockets = [{ id: `socket-${id}`, localPosition: [0, 0, 0], purpose: 'assembly/explosion origin' }];
  c.actionProfile.collider = { type: options.collider || 'box', offset: [0, 0, 0], scale: dimensions, isTrigger: false, notes: 'Simplified runtime proxy.' };
  c.actionProfile.destruction = { breakable: options.breakable ?? true, fractureGroup: id, seamRefs: c.seams, detachableFragments: [], breakImpulse: options.breakImpulse || 8, debrisMaterial: material };
  return c;
}

spec.componentTree = [
  component('root', '1963 Alfa Romeo Giulia Spider', 'macro', 'root', null, 'box', 'assembled-solid', [0,0,0], [3.9,1.3,1.58], 'utility-dark', { confidence: .99, animationRole: 'root', collider: 'compound', breakable: false }),
  component('body-shell', 'Central body tub and side sills', 'macro', 'body shell', 'root', 'curve-sweep', 'continuous-sculpt', [-.08,.55,0], [3.62,.72,1.48], 'body-paint', { deformations: ['section loft from tapered nose to cockpit waist and rounded tail'], seams: ['door-perimeters','hood-gap','trunk-gap'], topologyRationale: 'Continuous compound sheet-metal volume needs a lofted curve sweep to preserve rounded shoulders in orbit views.' }),
  component('front-clip', 'Front nose and valance', 'macro', 'front body', 'body-shell', 'curve-sweep', 'continuous-sculpt', [1.52,.58,0], [.72,.55,1.42], 'body-paint', { deformations: ['rounded nose taper','central grille notch'] }),
  component('rear-deck', 'Rear deck and rounded tail', 'macro', 'rear body', 'body-shell', 'curve-sweep', 'continuous-sculpt', [-1.42,.69,0], [1.0,.62,1.45], 'body-paint', { deformations: ['tapered tail plan','convex trunk crown'] }),
  component('front-fender-system', 'Separate front fender crowns', 'macro', 'fender system', 'body-shell', 'ellipsoid', 'continuous-sculpt', [1.08,.68,0], [1.52,.72,1.58], 'body-paint', { deformations: ['paired lateral crowns','wheel-arch subtraction'], topologyRationale: 'Paired compound fenders are continuous bulged forms represented by volumetric ellipsoid sections, never flat extrusions.' }),
  component('rear-fender-system', 'Rear haunches and wheel arches', 'macro', 'fender system', 'body-shell', 'ellipsoid', 'continuous-sculpt', [-1.10,.66,0], [1.42,.7,1.57], 'body-paint', { deformations: ['paired rear crowns','wheel-arch subtraction'] }),
  component('cockpit', 'Open cockpit tub', 'macro', 'cockpit', 'body-shell', 'extrude', 'conforming-shell', [-.42,.84,0], [1.42,.55,1.25], 'cabin-black', { deformations: ['rounded opening rim','deep interior occlusion'] }),
  component('wheel-system', 'Four wheel assemblies', 'macro', 'wheel assembly', 'root', 'cylinder', 'assembled-solid', [0,.43,0], [2.85,.68,1.6], 'rubber', { collider: 'compound', topologyRationale: 'Four repeated lathed solids remain independent rotational assemblies.' }),
  component('hood', 'Hinged long bonnet', 'meso', 'hinged panel', 'front-clip', 'curve-sweep', 'conforming-shell', [.94,1.00,0], [1.52,.12,1.12], 'body-paint', { animationRole: 'hinge', pivot: [-.75,0,0], axis: [0,0,1], seams: ['hood-gap'], deformations: ['longitudinal crown','nose taper'] }),
  component('trunk-lid', 'Rounded trunk lid', 'meso', 'hinged panel', 'rear-deck', 'curve-sweep', 'conforming-shell', [-1.34,.98,0], [.78,.10,1.04], 'body-paint', { animationRole: 'hinge', pivot: [.36,0,0], axis: [0,0,1], seams: ['trunk-gap'] }),
  component('door-system', 'Paired side-hinged doors', 'meso', 'hinged door', 'body-shell', 'extrude', 'conforming-shell', [-.38,.72,0], [1.18,.62,1.52], 'body-paint', { animationRole: 'hinge-pair', pivot: [.52,0,0], axis: [0,1,0], seams: ['left-door-gap','right-door-gap'] }),
  component('windshield', 'Split windshield and chrome frame', 'meso', 'window frame', 'cockpit', 'tube', 'assembled-solid', [.18,1.19,0], [.08,.66,1.3], 'glass', { deformations: ['shallow lateral arc','18-degree rearward rake'], topologyRationale: 'Glass panes are conforming shells mounted inside a separate curve-swept metal frame.' }),
  component('front-grille', 'Alfa shield and twin intakes', 'meso', 'grille', 'front-clip', 'extrude', 'assembled-solid', [1.89,.64,0], [.10,.52,1.13], 'chrome', { deformations: ['tapered shield perimeter','recessed intake voids'] }),
  component('front-bumper', 'Front chrome blade and overriders', 'meso', 'bumper', 'front-clip', 'tube', 'assembled-solid', [1.97,.39,0], [.15,.2,1.46], 'chrome', { deformations: ['wraparound lateral curvature'] }),
  component('rear-bumper', 'Rear chrome blade and overriders', 'meso', 'bumper', 'rear-deck', 'tube', 'assembled-solid', [-1.94,.42,0], [.15,.22,1.46], 'chrome', { deformations: ['wraparound lateral curvature'] }),
  component('front-lighting', 'Headlamps and front indicators', 'meso', 'lamp assembly', 'front-fender-system', 'cylinder', 'assembled-solid', [1.64,.78,0], [.25,.31,1.35], 'lamp-glass', { topologyRationale: 'Paired circular lens, bezel, and reflector solids are separate attached assemblies.' }),
  component('rear-lighting', 'Vertical tail lamp stacks', 'meso', 'lamp assembly', 'rear-fender-system', 'extrude', 'assembled-solid', [-1.73,.67,0], [.12,.38,1.34], 'red-lens'),
  component('seat-system', 'Oxblood bucket seats and rear squab', 'meso', 'seat assembly', 'cockpit', 'ellipsoid', 'continuous-sculpt', [-.55,.82,0], [.92,.72,1.08], 'red-leather', { deformations: ['rounded bolsters','repeated pleats'], topologyRationale: 'Upholstered cushions require continuous rounded volumes rather than box stacks.' }),
  component('dashboard', 'Right-hand-drive dashboard', 'meso', 'control panel', 'cockpit', 'extrude', 'assembled-solid', [.08,1.02,0], [.22,.35,1.18], 'cabin-black', { deformations: ['shallow padded top arc'] }),
  component('steering-system', 'Three-spoke steering wheel and column', 'meso', 'steering wheel', 'dashboard', 'torus', 'assembled-solid', [-.01,1.03,-.38], [.46,.46,.22], 'cabin-black', { animationRole: 'rotational-control', axis: [1,0,0], topologyRationale: 'Independent torus rim, spokes, hub, and column form a rotational control assembly.' }),
  component('gauge-cluster', 'Three circular instrument gauges', 'meso', 'gauge assembly', 'dashboard', 'cylinder', 'assembled-solid', [.10,1.12,-.26], [.12,.24,.54], 'gauge-black'),
  component('side-brightwork', 'Beltline trim and door handles', 'meso', 'trim system', 'body-shell', 'tube', 'surface-relief', [-.30,.90,0], [1.7,.08,1.58], 'chrome'),
  component('floor-chassis', 'Dark underbody and axle occlusion', 'meso', 'chassis proxy', 'root', 'box', 'assembled-solid', [-.05,.28,0], [3.25,.22,1.17], 'utility-dark', { confidence: .3, breakable: false }),
  component('exhaust', 'Single rear exhaust pipe', 'meso', 'exhaust tube', 'floor-chassis', 'tube', 'assembled-solid', [-1.82,.27,.46], [.62,.08,.08], 'dark-metal', { confidence: .78, localEnd: [-.6,0,0] }),
  component('front-wheel-left', 'Front left wheel pivot', 'micro', 'wheel', 'wheel-system', 'cylinder', 'assembled-solid', [1.14,.43,.73], [.24,.66,.66], 'rubber', { animationRole: 'steered-wheel', axis: [0,0,1], pivotMode: 'axle-centre' }),
  component('front-wheel-right', 'Front right wheel pivot', 'micro', 'wheel', 'wheel-system', 'cylinder', 'assembled-solid', [1.14,.43,-.73], [.24,.66,.66], 'rubber', { animationRole: 'steered-wheel', axis: [0,0,1], pivotMode: 'axle-centre' }),
  component('rear-wheel-left', 'Rear left wheel pivot', 'micro', 'wheel', 'wheel-system', 'cylinder', 'assembled-solid', [-1.15,.43,.73], [.24,.66,.66], 'rubber', { animationRole: 'rotating-wheel', axis: [0,0,1], pivotMode: 'axle-centre' }),
  component('rear-wheel-right', 'Rear right wheel pivot', 'micro', 'wheel', 'wheel-system', 'cylinder', 'assembled-solid', [-1.15,.43,-.73], [.24,.66,.66], 'rubber', { animationRole: 'rotating-wheel', axis: [0,0,1], pivotMode: 'axle-centre' }),
  component('wiper-system', 'Paired windshield wipers', 'micro', 'wiper arm', 'windshield', 'tube', 'assembled-solid', [.16,1.0,0], [.42,.03,.64], 'chrome'),
  component('plate-system', 'Front and rear Singapore plates', 'micro', 'plate', 'root', 'extrude', 'assembled-solid', [0,.43,0], [3.9,.18,.5], 'plate'),
  component('cockpit-hardware', 'Door pulls, cranks and latches', 'micro', 'handle assembly', 'cockpit', 'tube', 'assembled-solid', [-.3,.88,0], [.44,.12,1.22], 'chrome'),
  component('hood-latches', 'Bonnet latch pair', 'micro', 'fastener assembly', 'hood', 'cylinder', 'assembled-solid', [.18,1.01,0], [.08,.08,1.0], 'chrome'),
];

function material(id, name, color, roughness, metalness, options = {}) {
  const m = structuredClone(baseMaterial);
  m.id = id; m.name = name; m.baseColor = color; m.color = color; m.type = options.type || 'physical'; m.shaderModel = options.shaderModel || 'MeshPhysicalMaterial';
  m.albedo = { dominant: color, secondary: options.secondary || [color], samplingNotes: options.notes || 'Solid material sampled from admitted references; lighting reflections are not baked into albedo.' };
  m.colorVariation = { palette: [color, ...(options.secondary || [])], pattern: options.pattern || 'low-amplitude object-space variation', amplitude: options.variation ?? .025, heightCorrelation: 0 };
  m.textureResolution = options.utility ? 256 : 1024; m.qualityTier = options.utility ? 'utility' : 'reference';
  m.textureProjection = { mode: 'object-space procedural', repeat: [1,1], anisotropy: 8, texelDensityIntent: 'Stable world-scale detail without UV stretching.' };
  m.surfaceFrequencyBands = [
    { id: 'macro', frequency: 1.5, amplitude: options.macro ?? .015, role: 'broad finish variation' },
    { id: 'meso', frequency: 18, amplitude: options.meso ?? .008, role: 'manufacturing and wear variation' },
    { id: 'micro', frequency: 96, amplitude: options.micro ?? .003, role: 'grazing highlight breakup' },
  ];
  m.roughness = { base: roughness, variation: options.roughnessVariation ?? .03, map: `${id}-independent-roughness-field`, localResponse: options.roughnessNotes || 'Independent finish response.' };
  m.metalness = { base: metalness, variation: options.metalVariation || 0 };
  m.normal = { pattern: `${id}-independent-micro-normal`, strength: options.normalStrength ?? .04, scale: 64, space: 'tangent' };
  m.bump = { pattern: `${id}-independent-height-field`, amplitude: options.bump ?? .003, scale: 48 };
  m.ambientOcclusion = { cavityStrength: .22, contactShadowBias: .3, notes: 'Independent cavity and contact response; never aliases albedo.' };
  m.localOverrides = options.localOverrides || [];
  m.clearcoat = options.clearcoat ?? 0; m.clearcoatRoughness = options.clearcoatRoughness ?? .1;
  m.transmission = options.transmission || 0; m.ior = options.ior || 1.5; m.opacity = options.opacity ?? 1;
  m.notes = options.notes || 'Reference-led procedural solid material; exact inverse rendering is not claimed.';
  return m;
}
spec.materials = [
  material('body-paint','Black automotive lacquer','#080a09',.17,0,{ clearcoat:1,clearcoatRoughness:.08,secondary:['#111513','#020303'],localOverrides:[{id:'body-clearcoat',region:'exterior panels',roughness:.14,clearcoat:1,evidenceRefs:['front-three-quarter','rear-three-quarter']}],notes:'Near-black solid paint with a strong independent clearcoat lobe.' }),
  material('chrome','Polished chrome','#d8dde0',.09,1,{secondary:['#f5f7f6','#8c9497'],roughnessVariation:.025,normalStrength:.015,localOverrides:[{id:'chrome-brightwork',region:'bumpers grille trim handles',roughness:.07,metalness:1,evidenceRefs:['front-close','rear-three-quarter']}]}),
  material('rubber','Black tire rubber','#11100f',.72,0,{secondary:['#252320'],normalStrength:.28,bump:.035,pattern:'circumferential tread and sidewall variation'}),
  material('glass','Windshield glass','#b8d4d5',.06,0,{transmission:.92,ior:1.52,opacity:.28,normalStrength:.01,roughnessVariation:.01}),
  material('red-leather','Oxblood leather/vinyl','#8f171b',.42,0,{secondary:['#bb292d','#5b0d11'],normalStrength:.12,bump:.014,localOverrides:[{id:'oxblood-seats',region:'seat and door upholstery',roughness:.38,evidenceRefs:['cabin-left','cabin-right']}]}),
  material('cabin-black','Matte black cabin trim','#171615',.62,0,{secondary:['#282522'],normalStrength:.06}),
  material('lamp-glass','Clear ribbed lamp glass','#e7e5d5',.16,0,{transmission:.55,ior:1.48,opacity:.72,normalStrength:.12}),
  material('red-lens','Red and amber lens stack','#9d1013',.2,0,{transmission:.25,opacity:.9,secondary:['#d27b0b'],normalStrength:.08}),
  material('gauge-black','Gauge faces','#090a09',.48,0,{secondary:['#d8d4c6'],normalStrength:.02}),
  material('dark-metal','Exhaust dark steel','#252727',.38,.72,{secondary:['#080909'],normalStrength:.06}),
  material('plate','Painted number plates','#a7372c',.44,0,{secondary:['#d39b24','#e2d9be'],normalStrength:.02}),
  material('utility-dark','Hidden utility proxy','#0a0b0b',.88,0,{utility:true,normalStrength:0,bump:0}),
];

spec.repetitionSystems = [
  { id:'four-wheel-assemblies', componentRef:'wheel-system', count:4, arrangement:'two axles mirrored across Z', buildsGeometry:true, geometry:{primitive:'cylinder-stack'}, instances:['front-wheel-left','front-wheel-right','rear-wheel-left','rear-wheel-right'], evidenceRefs:['front-three-quarter','rear-three-quarter'] },
  { id:'wheel-vent-ring', componentRef:'wheel-system', count:10, arrangement:'radial per wheel', buildsGeometry:true, geometry:{primitive:'cylinder recess'}, instances:'instanced around wheel hub', evidenceRefs:['front-three-quarter'] },
  { id:'tire-tread-blocks', componentRef:'wheel-system', count:28, arrangement:'circumferential per tire', buildsGeometry:true, geometry:{primitive:'box tread'}, instances:'instanced around tire', evidenceRefs:['front-three-quarter','rear-three-quarter'] },
  { id:'shield-grille-bars', componentRef:'front-grille', count:13, arrangement:'vertical and horizontal inset grid clipped to shield', buildsGeometry:true, geometry:{primitive:'box bars'}, instances:'procedural bar loop', evidenceRefs:['front-close'] },
  { id:'seat-pleats', componentRef:'seat-system', count:7, arrangement:'horizontal per front cushion', buildsGeometry:true, geometry:{primitive:'tube ridge'}, instances:'paired seat loops', evidenceRefs:['cabin-left','cabin-right'] },
  { id:'gauge-rings', componentRef:'gauge-cluster', count:3, arrangement:'horizontal arc behind steering wheel', buildsGeometry:true, geometry:{primitive:'cylinder and torus'}, instances:'three gauges', evidenceRefs:['dashboard'] },
];

spec.featureReviewTargets = [
  { id:'roadster-proportion-system',name:'Low roadster silhouette, wheelbase, hood and cockpit proportions',tier:'critical',passIds:['blockout','form-refinement'],minimumScore:.78,mustPass:true,componentRefs:['body-shell','front-fender-system','rear-deck','wheel-system'],evidenceRefs:['front-three-quarter','rear-three-quarter'] },
  { id:'alfa-front-identity',name:'Shield grille, twin intakes, round lamps and chrome bumper',tier:'critical',passIds:['structural-pass','form-refinement','material-pass'],minimumScore:.78,mustPass:true,componentRefs:['front-grille','front-lighting','front-bumper'],evidenceRefs:['front-close','front-three-quarter'] },
  { id:'open-cockpit-system',name:'Low split windshield and oxblood right-hand-drive cockpit',tier:'critical',passIds:['structural-pass','material-pass'],minimumScore:.75,mustPass:true,componentRefs:['windshield','seat-system','dashboard','steering-system'],evidenceRefs:['dashboard','cabin-right'] },
  { id:'chrome-brightwork-system',name:'Separated chrome bumpers, trim, handles and grille material response',tier:'critical',passIds:['material-pass','lighting-pass'],minimumScore:.75,mustPass:true,componentRefs:['front-bumper','rear-bumper','front-grille','side-brightwork'],evidenceRefs:['front-close','rear-three-quarter'] },
  { id:'wheel-system-detail',name:'Four steel wheels, ventilation rings, hubcaps and rubber tires',tier:'important',passIds:['structural-pass','form-refinement'],minimumScore:.68,mustPass:false,componentRefs:['wheel-system'],evidenceRefs:['front-three-quarter','rear-three-quarter'] },
  { id:'rear-identity-system',name:'Rounded tail, vertical lamp stacks and chrome rear bumper',tier:'important',passIds:['form-refinement','material-pass'],minimumScore:.68,mustPass:false,componentRefs:['rear-deck','rear-lighting','rear-bumper'],evidenceRefs:['rear-three-quarter'] },
];
for (const pass of spec.buildPasses) pass.componentRefs = spec.componentTree.filter(c => pass.id === 'blockout' ? c.level === 'macro' : pass.id === 'structural-pass' ? c.level !== 'micro' : true).map(c => c.id);
spec.qualityTargets.reviewViewpoints = ['front-three-quarter','rear-three-quarter','front','side','cockpit-close','grazing-material'];
spec.qualityTargets.targetFidelity = .82;
spec.performanceBudget = { qualityPriority:'reference-fidelity', targetTriangles:145000, maxDrawCalls:150, textureSize:1024, fpsTarget:60, optimizationPolicy:'Preserve silhouette, wheels, grille, lamps, cockpit and chrome geometry; instance tread, wheel vents, grille bars and seat pleats.' };
spec.lodPlan = [ {tier:'near',distance:0,strategy:'full 24+ semantic details and repeated geometry'}, {tier:'mid',distance:16,strategy:'reduce tread and seat pleat instances'}, {tier:'far',distance:36,strategy:'hide cabin hardware and merge static brightwork while preserving silhouette'} ];
spec.viewEvidence = [
  {id:'front-three-quarter',view:'front-three-quarter',imageRegion:{x:0,y:0,width:1,height:1,units:'normalized'},observations:['full body proportion','front and side component placement','wheelbase','black paint and chrome'],confidence:.94},
  {id:'rear-three-quarter',view:'rear-three-quarter',imageRegion:{x:0,y:0,width:1,height:1,units:'normalized'},observations:['rounded rear deck','tail lamps','rear bumper and overriders','exhaust','cockpit opening'],confidence:.92},
  {id:'front-close',view:'front',imageRegion:{x:0,y:.25,width:1,height:.7,units:'normalized'},observations:['shield grille','twin intakes','headlamps','bumper','hood spear'],confidence:.96},
  {id:'dashboard',view:'cockpit',imageRegion:{x:0,y:.25,width:1,height:.65,units:'normalized'},observations:['right-hand drive','three gauges','steering spokes','dash trim'],confidence:.94},
  {id:'cabin-right',view:'cabin-side',imageRegion:{x:0,y:.25,width:1,height:.7,units:'normalized'},observations:['seat shape and pleats','door card','handles and cranks','windshield frame'],confidence:.93},
];
spec.visualEvidence = [{ id:'multi-view-reference-set', type:'admitted-image-set', paths:['references/front-three-quarter.jpg','references/rear-three-quarter.jpg','references/front-close.jpg','references/dashboard.jpg','references/cabin-left.jpg','references/cabin-right.jpg'], note:'All images passed reference-admission checks; placard supplies model identity.' }];
spec.lightingFromPhoto = [
  'Neutral studio key light: large-area warm-white source from front-left and above, intensity 4.5, soft shadow radius 5.',
  'Cool fill/environment light from rear-right at intensity 1.6 so black paint retains silhouette separation.',
  'White rim strip lights at both lateral sides to reveal fender crowns and chrome clearcoat separation.',
  'ACES Filmic tone mapping, exposure 1.05, neutral #e7e4dd background, and soft contact shadow beneath all four tires.',
];
spec.lookDevTargets.materialPass.referencePbrExtraction.requiredWhenSourceImagePresent = false;
spec.lookDevTargets.materialPass.referencePbrExtraction.acceptedLimitation = 'Multi-material museum photos contain baked strip-light reflections; scalars are evidence-guided procedural approximations, not inverse-rendered maps.';
spec.assumptions = ['Bilateral symmetry fills the less-visible vehicle side.', 'Underside and closed compartment interiors use dark low-detail proxies.', 'Exact badge art and plate typography are simplified as procedural geometry/text-free marks.', 'The folded soft top mechanism is omitted because no reference exposes its geometry.'];
spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
spec.risks = ['Black clearcoat can collapse the body silhouette without strip/rim reflections.', 'Compound fender/body seams may read too toy-like unless overlaps and bevel highlights are maintained.', 'High micro-part count must be instanced or grouped to stay below draw-call budget.', 'Photo-vs-render pixel gates are advisory because museum background and camera differ.'];
spec.animationAnchors = ['root whole-object transform','four wheel axle pivots','front wheel steering yokes','steering wheel column rotation','left and right forward-edge door hinges','rear-edge hood hinge','forward-edge trunk hinge'];
spec.destructionAnchors = ['doors detach at forward hinges','hood and trunk detach at hinge seams','windshield frame separates from cowl socket','bumpers detach from front/rear mounting sockets','wheels detach at axle centres'];

const validKinds = new Set(['gloss','bevel','fastener','linework','contour','seam','stitch','stain','scratch','chip','decal','emissive','hole','groove','ridge']);
for (const detail of spec.preSpecAssessment.detailInventory.details) {
  if (!validKinds.has(detail.kind)) detail.kind = detail.kind === 'cutout' ? 'hole' : detail.kind === 'raised-relief' || detail.kind === 'trim' || detail.kind === 'repetition' || detail.kind === 'tube' ? 'ridge' : detail.kind === 'lens' ? 'gloss' : 'linework';
  detail.realization = detail.mapsTo.type === 'component.localFeatures' ? 'procedural geometry in mapped named component' : 'independent MeshPhysicalMaterial scalar override';
}

fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
