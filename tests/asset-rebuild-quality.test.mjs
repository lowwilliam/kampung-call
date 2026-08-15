import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createLandmark } from "../src/lost-heritage/models.js";
import { createSingaporeAsset } from "../src/singapore-assets/models.js";
import { profiles } from "../research/lost-singapore-buildings/profiles.mjs";

const names = (root) => {
  const result = new Set();
  root.traverse((child) => result.add(child.name));
  return result;
};

test("Comcentre is tall and contains no Singtel wordmark", () => {
  const object = createLandmark({ id: "comcentre", ...profiles.comcentre });
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const objectNames = names(object);
  assert.ok(size.y > 38, `expected >38m height, got ${size.y}`);
  assert.ok(objectNames.has("brand-neutral-crown-louvres"));
  assert.ok(![...objectNames].some((name) => /singtel/i.test(name)));
});

test("Tang Dynasty City temples have enclosed facade and bracket systems", () => {
  const object = createLandmark({ id: "tang-dynasty-city", ...profiles["tang-dynasty-city"] });
  const objectNames = names(object);
  assert.ok(objectNames.has("temple-facades-and-brackets"));
  assert.ok([...objectNames].filter((name) => /painted-door-panel/.test(name)).length >= 7);
  assert.ok([...objectNames].filter((name) => /side-hall-/.test(name)).length >= 2);
});

test("Tank Road station includes a completed facade and platform details", () => {
  const object = createLandmark({ id: "tank-road-railway-station", ...profiles["tank-road-railway-station"] });
  const objectNames = names(object);
  assert.ok(objectNames.has("completed-street-facade"));
  assert.ok(objectNames.has("platform-furniture-and-signals"));
  assert.ok([...objectNames].some((name) => /station-name-board/.test(name)));
  assert.ok([...objectNames].filter((name) => /bench-seat/.test(name)).length >= 4);
});

test("Clouded monitor uses a continuous tail and polished anatomy groups", () => {
  const object = createSingaporeAsset("clouded-monitor");
  const objectNames = names(object);
  assert.ok(objectNames.has("tail/continuous-tapered-tail"));
  assert.ok(objectNames.has("mouth-and-throat-detail"));
  assert.ok([...objectNames].filter((name) => /elbow-knee/.test(name)).length === 4);
  assert.ok(![...objectNames].some((name) => /tail-segment/.test(name)));
});
