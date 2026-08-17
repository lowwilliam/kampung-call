import fs from 'node:fs';
const path = new URL('alfa-sculpt-spec.json', import.meta.url);
const spec = JSON.parse(fs.readFileSync(path, 'utf8'));
const byId = Object.fromEntries(spec.componentTree.map((component) => [component.id, component]));
function cloneAs(sourceId, id, name, level = 'meso') {
  const value = structuredClone(byId[sourceId]);
  value.id = id; value.name = name; value.level = level;
  value.attachment = { ...value.attachment, parentId: 'body-shell', parentSocket: `socket-body-shell-${id}` };
  return value;
}
const runtimeIds = [
  'root','body-shell','front-fender-system','rear-fender-system','cockpit','hood','trunk-lid','windshield','dashboard','gauge-cluster','steering-system',
  'front-wheel-left','front-wheel-right','rear-wheel-left','rear-wheel-right','front-grille','front-lighting','front-bumper','rear-lighting','rear-bumper','exhaust','floor-chassis','left-door','right-door',
];
spec.componentTree = runtimeIds.map((id) => structuredClone(byId[id]));
if (!spec.componentTree.some((component) => component.id === 'left-door')) {
  spec.componentTree.push(cloneAs('door-system','left-door','Left forward-hinged door'), cloneAs('door-system','right-door','Right forward-hinged door'));
}
for (const component of spec.componentTree) {
  const parentAlias = { 'front-clip':'body-shell', 'rear-deck':'body-shell', 'wheel-system':'root' };
  if (parentAlias[component.parent]) component.parent = parentAlias[component.parent];
  if (component.attachment && component.parent) {
    component.attachment.parentId = component.parent;
    component.attachment.parentSocket = `socket-${component.parent}-${component.id}`;
  }
  if (component.id.includes('wheel')) component.level = 'meso';
  component.surfaceDetail = {
    macroRoughness: component.material === 'body-paint' ? 0.015 : 0.03,
    microRoughness: component.material === 'chrome' ? 0.012 : 0.025,
    bumpAmplitude: component.material === 'rubber' ? 0.035 : component.material === 'red-leather' ? 0.014 : 0.003,
    normalPattern: component.material === 'body-paint' ? 'bounded automotive orange-peel field' : component.material === 'rubber' ? 'circumferential tread blocks' : 'independent material micro-normal',
    displacementPattern: component.material === 'rubber' ? 'instanced tread geometry' : 'none',
    occlusionPattern: 'independent cavity response at seams, recesses and attachment contacts',
    edgeWearPattern: 'factory-restored finish; minimal bounded edge variation',
    notes: 'Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry.',
  };
}
const aliases = { 'wheel-system':'front-wheel-left', 'door-system':'left-door', 'seat-system':'cockpit', 'side-brightwork':'body-shell' };
const detailAliases = { ...aliases, 'body-paint':'body-clearcoat', chrome:'chrome-brightwork', 'red-leather':'oxblood-seats' };
for (const detail of spec.preSpecAssessment.detailInventory.details) if (detailAliases[detail.mapsTo.ref]) detail.mapsTo.ref = detailAliases[detail.mapsTo.ref];
for (const target of spec.featureReviewTargets) target.componentRefs = target.componentRefs.map((id) => aliases[id] || id).filter((id) => spec.componentTree.some((component) => component.id === id));
for (const repetition of spec.repetitionSystems) repetition.componentRef = aliases[repetition.componentRef] || repetition.componentRef;
for (const pass of spec.buildPasses) pass.componentRefs = spec.componentTree.map((component) => component.id);
spec.preSpecAssessment.complexity.estimatedCounts = { macroComponents: 5, mesoComponents: 19, microFeatureGroups: 24, materialLayers: 12, repetitionSystems: 6 };
fs.writeFileSync(path, `${JSON.stringify(spec, null, 2)}\n`);
const inventoryPath = new URL('detail-inventory.json', import.meta.url);
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
for (const detail of inventory.detailInventory.details) if (detailAliases[detail.mapsTo.ref]) detail.mapsTo.ref = detailAliases[detail.mapsTo.ref];
fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
