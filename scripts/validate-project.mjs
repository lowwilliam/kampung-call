import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { extractBalancedLiteral, readHtml, root } from './lib/project.mjs';

const html = readHtml();
const failures = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(/^<!doctype html>/i.test(html.trimStart()), 'HTML must begin with a doctype.');
assert(/<html[^>]+lang=["'][a-z-]+["']/i.test(html), 'HTML must declare a document language.');
assert(/<meta[^>]+name=["']viewport["']/i.test(html), 'HTML must include a viewport meta tag.');
assert(/<title>[^<]+<\/title>/i.test(html), 'HTML must have a non-empty title.');

assert(/bridgeSites\.some\(site=>centers\[i\]\.angleTo\(site\.unit\)\*R<3\.4\)/.test(html),
  'Singapore River collision strip must leave every bridge crossing clear.');
assert(/for\(const site of bridgeSites\)[\s\S]{0,300}alignXToDir\(bridge,site\.unit,site\.across\)/.test(html),
  'Singapore River bridges must align with their detected street crossings.');
assert(/console\.assert\(bridgeSites\.length>=2/.test(html),
  'Singapore River must provide multiple connected bridge crossings.');
assert(/const preserveCorridor=walkableCorridorAt\(unit\)&&!insideProtectedBuilding\(unit\)/.test(html),
  'Authored road corridors must reject invisible incidental blockers while preserving buildings.');
assert(/RIVER_BRIDGE_WALKWAYS\.push\(\{u:site\.unit\.clone\(\),axis:site\.across\.clone\(\),halfLength:2\.35,halfWidth:\.72\}\)/.test(html),
  'Every river bridge must register a traversable collision corridor.');
assert(/const bridgeSiteClear=[\s\S]{0,500}!insideVisibleBuildingFootprint\(sample\)/.test(html),
  'Bridge selection must validate the full deck against protected building footprints.');
assert(/function auditPublicRouteClearance\(\)[\s\S]{0,1800}window\.__routeClearanceAudit=\{checked,blocked\}/.test(html),
  'Runtime QA must audit every public route against the final collision set.');
assert(/dataset\.routeClearanceBlocked=String\(blocked\.length\)/.test(html),
  'Runtime route-clearance result must be browser-test observable.');
assert(/if\(cfg\.ground\|\|cfg\.watercraft\)[\s\S]{0,500}alignLowestPoint\(inst\)/.test(html)
    && /function alignLowestPoint\(model\)[\s\S]{0,500}new THREE\.Box3\(\)\.setFromObject\(model\)/.test(html),
  'Imported buildings must be grounded from their rendered bounds.');
assert(/overheadbridge:\{[^}]*ground:true/.test(html),
  'The overhead bridge asset must be aligned to the local terrain.');
assert(/function overheadBridgeHeight\(unit\)/.test(html)
    && /surfR\(up2\)\+overheadBridgeHeight\(up2\)\+bob/.test(html),
  'The overhead bridge stairs and deck must contribute to the player standing height.');

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert(duplicateIds.length === 0, `Duplicate HTML ids: ${duplicateIds.join(', ')}`);

const localReferences = new Set(
  [...html.matchAll(/["'`](assets\/[A-Za-z0-9_./-]+\.(?:glb|mp3|png|jpg|jpeg|webp))["'`]/gi)]
    .map((match) => match[1]),
);
for (const reference of localReferences) {
  const target = path.resolve(root, reference);
  assert(target.startsWith(`${root}${path.sep}`), `Unsafe asset path: ${reference}`);
  assert(fs.existsSync(target), `Referenced asset is missing: ${reference}`);
  if (fs.existsSync(target)) assert(fs.statSync(target).size > 0, `Referenced asset is empty: ${reference}`);
}

const residentAssetMatch = html.match(/const RESIDENT_ASSETS=(\[[^;]+\]);/);
if (!residentAssetMatch) failures.push('Could not find RESIDENT_ASSETS.');
else {
  try {
    const residents = new vm.Script(`(${residentAssetMatch[1]})`).runInNewContext(Object.create(null), { timeout: 1000 });
    for (const resident of residents) {
      const reference = `assets/residents/${resident}.glb`;
      assert(fs.existsSync(path.join(root, reference)), `Referenced resident asset is missing: ${reference}`);
    }
  } catch (error) {
    failures.push(`Could not parse RESIDENT_ASSETS: ${error.message}`);
  }
}

let scenarios;
try {
  const literal = extractBalancedLiteral(html, 'DIAGNOSTIC_CASES');
  scenarios = new vm.Script(`(${literal})`).runInNewContext(Object.create(null), { timeout: 1000 });
} catch (error) {
  failures.push(`Could not parse DIAGNOSTIC_CASES: ${error.message}`);
}

if (scenarios) {
  const questions = new Set();
  assert(Object.keys(scenarios).length >= 6, 'At least six diagnostic scenarios are required.');
  for (const [name, scenario] of Object.entries(scenarios)) {
    assert(typeof scenario.complaint === 'string' && scenario.complaint.trim(), `${name}: complaint is required.`);
    assert(Array.isArray(scenario.rounds) && scenario.rounds.length >= 3, `${name}: at least three diagnostic rounds are required.`);
    for (const [roundIndex, round] of (scenario.rounds || []).entries()) {
      const label = `${name}, round ${roundIndex + 1}`;
      assert(typeof round.question === 'string' && round.question.trim(), `${label}: question is required.`);
      assert(!questions.has(round.question), `${label}: question is duplicated.`);
      questions.add(round.question);
      assert(Array.isArray(round.options) && round.options.length >= 3, `${label}: at least three choices are required.`);
      const correct = (round.options || []).filter((option) => option[1] === true);
      assert(correct.length === 1, `${label}: exactly one choice must be correct.`);
      for (const [optionIndex, option] of (round.options || []).entries()) {
        assert(Array.isArray(option) && option.length === 3, `${label}, choice ${optionIndex + 1}: expected [answer, correct, feedback].`);
        assert(typeof option?.[0] === 'string' && option[0].trim(), `${label}, choice ${optionIndex + 1}: answer is required.`);
        assert(typeof option?.[1] === 'boolean', `${label}, choice ${optionIndex + 1}: correctness must be boolean.`);
        assert(typeof option?.[2] === 'string' && option[2].trim(), `${label}, choice ${optionIndex + 1}: feedback is required.`);
      }
    }
  }
  const deliveryBlock = html.slice(html.indexOf('const FUTURE_DELIVERIES='), html.indexOf('// Pool of calls'));
  const deliveryNames = [...deliveryBlock.matchAll(/\bitem:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  const scenarioNames = Object.keys(scenarios);
  assert(deliveryNames.length === scenarioNames.length, 'Every diagnostic scenario must map to exactly one work order.');
  for (const deliveryName of deliveryNames) assert(scenarioNames.includes(deliveryName), `Work order has no diagnostic scenario: ${deliveryName}`);
  for (const scenarioName of scenarioNames) assert(deliveryNames.includes(scenarioName), `Diagnostic scenario has no work order: ${scenarioName}`);
}

const roadStart = html.indexOf('const ROAD_ACCESS=');
const roadEnd = html.indexOf('function buildDashedPath', roadStart);
assert(roadStart >= 0 && roadEnd > roadStart, 'Could not find the shared ROAD_NETWORKS city plan.');
if (roadStart >= 0 && roadEnd > roadStart) {
  const roadBlock = html.slice(roadStart, roadEnd);
  assert(roadBlock.includes('const ROAD_ACCESS='), 'Road plan must define building-free destination access nodes.');
  assert(/const ROAD_CLEARANCE_ZONES=\[[\s\S]{0,300}LOCAL_BUILDING_PLOTS\.map/.test(roadBlock),
    'Road plan must use major and local building footprints.');
  for (const accessName of ['TUAS', 'NUS', 'KOPITIAM', 'HOSPITAL', 'CIVIC', 'CHANGI', 'MRT', 'HDB', 'SMU', 'CBD']) {
    assert(roadBlock.includes(`A.${accessName}`), `Strategic road plan must use the ${accessName} access node.`);
  }
  for (const roadClass of ['expressway', 'arterial', 'local']) {
    assert(roadBlock.includes(`type:'${roadClass}'`), `Road plan must include the ${roadClass} hierarchy.`);
  }
  for (const routeName of ['ISLAND EXPRESS', 'COASTAL EXPRESS', 'CENTRAL CORRIDOR', 'CAMPUS LINK']) {
    assert(roadBlock.includes(`name:'${routeName}'`), `Road plan is missing ${routeName}.`);
  }
  const roadConsumers = [...html.matchAll(/for\(const network of ROAD_NETWORKS\)/g)].length;
  assert(roadConsumers >= 2, 'ROAD_NETWORKS must drive both the 3D world and operations map.');
  assert(/network\.renderPoints=centers\.map\(latLonFromUnit\)/.test(html),
    'Operations map must consume the same collision-cleared road geometry as the 3D city.');
}
assert(/LOCAL_BUILDING_SETBACK>ROAD_STYLES\.local\.width\/2\+1\.25\+\.25/.test(html),
  'Local buildings must retain a full road-and-collider clearance setback.');
assert(/function buildPath\(a,b,width=1\.5\)[\s\S]{0,1000}buildClearedRoute\(raw,pathWidth\/2\)/.test(html)
  && /function buildClearedRoute\(raw,halfWidth\)[\s\S]{0,1800}relaxed\[i\]=slerpUnit\(centers\[i\],midpoint,\.62\)/.test(html),
  'Neighbourhood streets must use the smoothed shared-footprint clearance pipeline.');
assert(/const CITY_BUILDING_ZONES=\[[\s\S]{0,2500}\[CBD,5\.0\]/.test(html),
  'City building-footprint registry must cover residential, institutional and downtown districts.');
assert(/const MAJOR_BUILDING_VISUAL_BUFFER=1\.35/.test(html),
  'Major buildings must reserve extra visual footprint beyond gameplay colliders.');
assert(/function visibleBuildingOverlap\(unit\)[\s\S]{0,700}MAJOR_BUILDING_VISUAL_BUFFER/.test(html),
  'Road QA must validate against enlarged visible building footprints.');
assert(/function localBuildingPose\(i\)[\s\S]{0,1200}LOCAL_BUILDING_SETBACK/.test(html),
  'Local building placement and road clearance must share one deterministic pose function.');
assert(/surfR\(up2\)\+VEHICLE_SURFACE_OFFSET/.test(html),
  'Moving service vehicles must be aligned to the rendered road surface.');
assert(/forwardYaw:-Math\.PI\/2/.test(html)
    && /model\.rotation\.y=cfg\.forwardYaw\|\|0/.test(html),
  'Imported van +X nose must be normalized to the controller +Z forward axis.');
assert(/const targetSpeed=braking\?0:throttle\*VAN_SPEED/.test(html)
    && /if\(turn&&vanState\.speed>\.05\)/.test(html),
  'Van motion must be forward-only and steering must require forward speed.');
assert(/const roadPose=nearestRoadPose[\s\S]{0,300}vanState\.forward\.copy\(roadPose\.forward\)/.test(html),
  'Randomized parked vehicles must snap to a road centerline and inherit its heading.');
assert(/WATER_SURFACE_OFFSET-BOAT_DRAFT/.test(html),
  'Boats must sit at a defined waterline instead of hovering above the map.');

if (!/<main\b/i.test(html)) warnings.push('No <main> landmark found; add one during the accessibility pass.');
if (!/<meta[^>]+name=["']description["']/i.test(html)) warnings.push('No meta description found.');

for (const warning of warnings) console.warn(`WARN  ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  HTML structure, ${localReferences.size} asset references, and ${Object.keys(scenarios || {}).length} scenarios validated.`);
}
