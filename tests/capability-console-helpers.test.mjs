import test from "node:test";
import assert from "node:assert/strict";
import {
  scenarioOptionsForDistrict, availableRoles, formatScoreLabel, defineCapabilityConsole,
} from "../src/capability/capability-console.mjs";

test("console helpers derive district scenarios and valid roles", () => {
  const changi = scenarioOptionsForDistrict("changi");
  assert.deepEqual(changi.map(({ id }) => id), ["changi-terminal-congestion"]);
  assert.deepEqual(availableRoles(changi[0].id).map(({ id }) => id), ["fieldEngineer", "dispatcher", "dutyManager"]);
});

test("score labels preserve commercial thresholds", () => {
  assert.equal(formatScoreLabel(85), "Proficient");
  assert.equal(formatScoreLabel(70), "Capable");
  assert.equal(formatScoreLabel(69), "Development required");
});

test("browser registration is a safe no-op outside a DOM", () => {
  assert.equal(defineCapabilityConsole(), false);
});

