import fs from 'node:fs';

const base = new URL('./', import.meta.url);
const assessmentPath = new URL('alfa-assessment.json', base);
const inventoryPath = new URL('detail-inventory.json', base);
const assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const detailRows = [
  ['alfa-shield-grille', 'cutout', 'Triangular chrome shield grille with inset vertical and horizontal bars', 'meso', 'geometry', 'component.localFeatures', 'front-grille'],
  ['twin-front-intakes', 'recess', 'Two black horizontal intake voids bounded by chrome rails', 'meso', 'silhouette', 'component.localFeatures', 'front-grille'],
  ['round-headlamps', 'lens', 'Large circular glass headlamps in chrome bezels at fender noses', 'meso', 'material', 'component.localFeatures', 'front-lighting'],
  ['front-overriders', 'raised-relief', 'Paired vertical chrome bumper overriders with rounded caps', 'meso', 'silhouette', 'component.localFeatures', 'front-bumper'],
  ['hood-spear', 'raised-relief', 'Tapered chrome spear centered along the hood crown', 'micro', 'specular', 'component.localFeatures', 'hood'],
  ['hood-perimeter-seam', 'seam', 'Narrow recessed gap tracing the separate hood panel', 'micro', 'shadow', 'component.localFeatures', 'hood'],
  ['alfa-crest', 'decal', 'Round Alfa crest at the shield grille crown', 'micro', 'albedo', 'component.localFeatures', 'front-grille'],
  ['split-windshield-frame', 'trim', 'Low two-pane windshield with polished perimeter and center divider', 'meso', 'silhouette', 'component.localFeatures', 'windshield'],
  ['paired-wipers', 'fastener', 'Two thin chrome wiper arms resting at the windshield base', 'micro', 'specular', 'component.localFeatures', 'windshield'],
  ['body-clearcoat', 'gloss', 'Near-black paint with sharp clearcoat reflections over a dark base', 'micro', 'roughness', 'material.localOverrides', 'body-paint'],
  ['chrome-brightwork', 'gloss', 'Polished bumpers, grille, trim and handles with sharp highlights', 'micro', 'roughness', 'material.localOverrides', 'chrome'],
  ['wheel-vent-holes', 'cutout', 'Repeated circular ventilation holes around each steel wheel face', 'micro', 'shadow', 'component.localFeatures', 'wheel-system'],
  ['polished-hubcaps', 'raised-relief', 'Domed bright center caps on silver steel wheels', 'micro', 'specular', 'component.localFeatures', 'wheel-system'],
  ['tire-tread', 'repetition', 'Circumferential tread blocks on four black rubber tires', 'micro', 'normal', 'component.localFeatures', 'wheel-system'],
  ['door-panel-seams', 'seam', 'Separate side-hinged doors with narrow perimeter gaps', 'meso', 'shadow', 'component.localFeatures', 'door-system'],
  ['door-handles', 'fastener', 'Horizontal polished pull handles with round lock cylinders', 'micro', 'specular', 'component.localFeatures', 'door-system'],
  ['beltline-trim', 'trim', 'Thin chrome strip running along the upper body sides', 'micro', 'specular', 'component.localFeatures', 'body-shell'],
  ['oxblood-seats', 'gloss', 'Red leather/vinyl bucket seats with moderate sheen and rounded bolsters', 'meso', 'roughness', 'material.localOverrides', 'red-leather'],
  ['seat-pleats', 'linework', 'Repeated horizontal pleats across both bucket-seat cushions', 'micro', 'normal', 'component.localFeatures', 'seat-system'],
  ['three-gauge-cluster', 'repetition', 'Three circular black gauges with chrome bezels behind the steering wheel', 'micro', 'specular', 'component.localFeatures', 'dashboard'],
  ['three-spoke-wheel', 'cutout', 'Black steering rim with three brushed-metal slotted spokes', 'meso', 'silhouette', 'component.localFeatures', 'steering-system'],
  ['rear-tail-lamps', 'lens', 'Vertical amber and red rear lamp stacks in chrome housings', 'meso', 'albedo', 'component.localFeatures', 'rear-lighting'],
  ['rear-bumper-overriders', 'raised-relief', 'Rear chrome blade bumper with paired vertical overriders', 'meso', 'silhouette', 'component.localFeatures', 'rear-bumper'],
  ['exhaust-tip', 'tube', 'Single dark circular exhaust outlet under the left rear', 'micro', 'shadow', 'component.localFeatures', 'exhaust'],
];

inventory.detailInventory.scanMethod = 'multi-view visual zones + grid-4x4 primary view';
inventory.detailInventory.targetMinDetails = 24;
inventory.detailInventory.details = detailRows.map(([id, kind, description, scale, affects, type, ref], index) => ({
  id, kind, description, region: inventory.detailInventory.details[index]?.region || null,
  scale, affects, mapsTo: { type, ref },
  evidenceRef: index < 9 ? 'references/front-close.jpg' : index < 17 ? 'references/front-three-quarter.jpg' : index < 22 ? 'references/cabin-right.jpg' : 'references/rear-three-quarter.jpg',
  confidence: index === 23 ? 0.78 : 0.9,
}));
fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

const pre = assessment.preSpecAssessment;
pre.objectClass = {
  primaryType: 'classic two-seat roadster automobile', primaryDomain: 'object',
  formLanguage: ['low horizontal stance', 'lofted compound body curvature', 'bilateral symmetry', 'rounded separate fenders'],
  structureKind: ['hard-surface shell', 'open cockpit', 'rotational wheel assemblies', 'hinged panels', 'attached brightwork'],
  motionPotential: ['wheel rotation', 'front-wheel steering', 'steering-wheel rotation', 'door hinges', 'hood hinge', 'trunk hinge', 'exploded assembly'],
  materialFamilies: ['automotive painted metal', 'polished chrome', 'rubber', 'glass', 'leather/vinyl', 'painted steel', 'lens plastic'],
  notes: 'Placard identifies 1963 Alfa Romeo Giulia Spider. Geometry is procedural and hidden mechanical regions are approximated.',
};
pre.complexity.scores = { silhouetteComplexity: 3, componentCount: 3, hierarchyDepth: 3, repetitionDensity: 3, materialLayerCount: 3, localDetailDensity: 3, occlusionRisk: 2, actionReadinessNeed: 3 };
pre.complexity.estimatedCounts = { macroComponents: 8, mesoComponents: 28, microFeatureGroups: 14, materialLayers: 9, repetitionSystems: 5 };
pre.complexity.reasoning = [
  'Compound body shell and separate fenders require lofted/subdivision-like geometry rather than primitive boxes.',
  'Identity depends on many independent chrome, lamp, grille, wheel, cockpit, and control assemblies.',
  'Four wheels, wheel vents, grille bars, gauge rings, seat pleats, and bumper hardware are repeated systems.',
  'Interactive use requires stable pivots, sockets, pickable components, colliders, and scale-about-centre explosion.',
];
pre.unknownsToResolveBeforeImplementation = [
  'Underside, suspension, engine bay, and luggage compartment are not visible; model only low-detail occlusion proxies.',
  'Exact left-side door and lower rocker contour are inferred from bilateral symmetry and oblique views.',
  'Soft-top frame and folded canvas mechanism are omitted beyond rear cockpit trim because references do not expose them.',
];
pre.detailInventory = inventory.detailInventory;
assessment.qualityContract.definitionOfDone = [
  'At front and rear three-quarter review views the car reads as the supplied 1963 Alfa Romeo Giulia Spider rather than a generic roadster.',
  'The shield grille, separate fenders, low split windshield, chrome bumper-overrider systems, wheel-hole pattern, and oxblood right-hand-drive cabin are independently recognizable.',
  'Every visible assembly is named, pickable, explodable by scale about model centre, and animated where a physical pivot is supported.',
  'A neutral studio render and two orbit views show real volume, stable wheel placement, clearcoat/chrome separation, and grounded contact shadows.',
];
assessment.qualityContract.visualDeltaChecks = [
  'wheelbase-to-body-length and hood-to-cockpit proportion', 'front shield grille and twin-intake negative-space layout',
  'fender crown and headlamp placement', 'windshield height/rake and cockpit opening', 'rear deck taper and tail-lamp placement',
  'black clearcoat versus chrome roughness response', 'oxblood cabin visibility and right-hand-drive dashboard layout',
];
fs.writeFileSync(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
