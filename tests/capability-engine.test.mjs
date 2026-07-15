import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogue, validateCatalogue, createSession, getCurrentStep, chooseOption,
  useHint, scoreSession, createReport, listScenarios,
} from "../src/capability/index.mjs";

test("catalogue contains valid scenarios for all requested sectors", () => {
  assert.deepEqual(validateCatalogue(), { valid: true, errors: [] });
  const covered = new Set(catalogue.scenarios.map(({ sectorId }) => sectorId));
  for (const id of ["aviation", "education", "healthcare", "maritime-industrial", "public-transport", "community", "residential"]) {
    assert.ok(covered.has(id), `${id} must have a scenario`);
  }
});

test("session follows branches and produces an auditable report", () => {
  let session = createSession({ scenarioId: "changi-terminal-congestion", difficultyId: "standard", now: 1_000 });
  assert.equal(getCurrentStep(session).id, "triage");
  session = chooseOption(session, "inspect-controller", 2_000);
  assert.equal(session.currentStepId, "contain");
  session = chooseOption(session, "rebalance", 4_000);
  assert.equal(session.currentStepId, null);
  const report = createReport(session);
  assert.equal(report.outcome, "service-stabilised");
  assert.equal(report.timing.durationSeconds, 3);
  assert.equal(report.decisions.length, 2);
  assert.ok(report.score.overall >= 70);
});

test("poor terminal decision completes with a failing score", () => {
  let session = createSession({ scenarioId: "hospital-redundant-link", now: 10 });
  session = chooseOption(session, "unplug-backup", 20);
  assert.equal(session.outcome, "clinical-risk");
  assert.equal(scoreSession(session).passed, false);
});

test("difficulty controls hints and scenario filtering works", () => {
  let guided = createSession({ scenarioId: "hdb-intermittent-broadband", difficultyId: "guided" });
  guided = useHint(guided);
  assert.equal(guided.hintsUsed, 1);
  const available = listScenarios({ roleId: "dutyManager" });
  assert.ok(available.length > 0);
  assert.ok(available.every(({ roles }) => roles.includes("dutyManager")));
  assert.throws(() => createSession({ scenarioId: "hdb-intermittent-broadband", roleId: "dutyManager" }), /not available/);
});

test("unassessed competencies do not inflate the overall score", () => {
  let session = createSession({ scenarioId: "hdb-intermittent-broadband", difficultyId: "standard", now: 100 });
  session = chooseOption(session, "upsell", 200);
  const score = scoreSession(session);
  assert.equal(score.dimensions["service-continuity"].assessed, false);
  assert.equal(score.dimensions["service-continuity"].percentage, null);
  assert.equal(score.passed, false);
});
