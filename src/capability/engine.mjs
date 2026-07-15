import { catalogue } from "./catalog.mjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const byId = (items, id) => items.find((item) => item.id === id);

export function validateCatalogue(data = catalogue) {
  const errors = [];
  const sectorIds = new Set(data.sectors.map(({ id }) => id));
  const districtIds = new Set(data.districts.map(({ id }) => id));
  const competencyIds = new Set(data.competencies.map(({ id }) => id));
  const scenarioIds = new Set();
  for (const scenario of data.scenarios) {
    if (scenarioIds.has(scenario.id)) errors.push(`Duplicate scenario: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (!sectorIds.has(scenario.sectorId)) errors.push(`${scenario.id}: unknown sector`);
    if (!districtIds.has(scenario.districtId)) errors.push(`${scenario.id}: unknown district`);
    const stepIds = new Set(scenario.steps.map(({ id }) => id));
    if (!stepIds.has(scenario.firstStepId)) errors.push(`${scenario.id}: invalid firstStepId`);
    for (const step of scenario.steps) {
      const optionIds = new Set();
      for (const choice of step.options) {
        if (optionIds.has(choice.id)) errors.push(`${scenario.id}/${step.id}: duplicate option ${choice.id}`);
        optionIds.add(choice.id);
        if (choice.nextStep !== null && !stepIds.has(choice.nextStep)) errors.push(`${scenario.id}/${step.id}: invalid nextStep`);
        for (const competencyId of Object.keys(choice.competencyImpact)) {
          if (!competencyIds.has(competencyId)) errors.push(`${scenario.id}/${step.id}: unknown competency ${competencyId}`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createSession({ scenarioId, roleId = "fieldEngineer", difficultyId = "standard", now = Date.now() }, data = catalogue) {
  const scenario = byId(data.scenarios, scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  if (!data.roleModes[roleId] || !scenario.roles.includes(roleId)) throw new Error(`Role ${roleId} is not available for ${scenarioId}`);
  if (!data.difficultyModes[difficultyId]) throw new Error(`Unknown difficulty: ${difficultyId}`);
  return {
    id: `${scenarioId}:${now}`,
    schemaVersion: data.schemaVersion,
    scenarioId, scenarioVersion: scenario.version, roleId, difficultyId,
    startedAt: now, completedAt: null, currentStepId: scenario.firstStepId,
    decisions: [], outcome: null, hintsUsed: 0,
  };
}

export function getCurrentStep(session, data = catalogue) {
  if (!session.currentStepId) return null;
  const scenario = byId(data.scenarios, session.scenarioId);
  return scenario?.steps.find(({ id }) => id === session.currentStepId) ?? null;
}

export function chooseOption(session, optionId, now = Date.now(), data = catalogue) {
  if (session.completedAt) throw new Error("Session is already complete");
  const step = getCurrentStep(session, data);
  if (!step) throw new Error("Session has no current step");
  const choice = step.options.find(({ id }) => id === optionId);
  if (!choice) throw new Error(`Unknown option ${optionId} for step ${step.id}`);
  const decision = { stepId: step.id, optionId, at: now, competencyImpact: { ...choice.competencyImpact } };
  return {
    ...session,
    decisions: [...session.decisions, decision],
    currentStepId: choice.nextStep,
    completedAt: choice.nextStep === null ? now : null,
    outcome: choice.nextStep === null ? choice.outcome ?? "completed" : null,
  };
}

export function useHint(session, data = catalogue) {
  const allowance = data.difficultyModes[session.difficultyId]?.hintCount ?? 0;
  if (session.hintsUsed >= allowance) throw new Error("No hints remaining");
  return { ...session, hintsUsed: session.hintsUsed + 1 };
}

export function scoreSession(session, data = catalogue) {
  const totals = Object.fromEntries(data.competencies.map(({ id }) => [id, 0]));
  const opportunities = Object.fromEntries(data.competencies.map(({ id }) => [id, 0]));
  const scenario = byId(data.scenarios, session.scenarioId);
  for (const step of scenario.steps) {
    for (const competency of data.competencies) {
      const max = Math.max(0, ...step.options.map((choice) => choice.competencyImpact[competency.id] ?? 0));
      opportunities[competency.id] += max;
    }
  }
  for (const decision of session.decisions) {
    for (const [id, impact] of Object.entries(decision.competencyImpact)) totals[id] += impact;
  }
  const dimensions = Object.fromEntries(data.competencies.map((competency) => {
    const possible = opportunities[competency.id];
    const assessed = possible > 0;
    const percentage = assessed ? clamp(Math.round((totals[competency.id] / possible) * 100), 0, 100) : null;
    return [competency.id, { raw: totals[competency.id], possible, assessed, percentage, weight: competency.weight }];
  }));
  const assessed = data.competencies.filter((competency) => dimensions[competency.id].assessed);
  const assessedWeight = assessed.reduce((sum, competency) => sum + competency.weight, 0);
  const weighted = assessedWeight
    ? assessed.reduce((sum, competency) => sum + dimensions[competency.id].percentage * competency.weight, 0) / assessedWeight
    : 0;
  const difficulty = data.difficultyModes[session.difficultyId];
  const hintPenalty = session.hintsUsed * 3;
  const overall = clamp(Math.round(weighted * difficulty.scoreMultiplier - hintPenalty), 0, 100);
  return { overall, passed: overall >= 70, dimensions, hintPenalty };
}

export function createReport(session, data = catalogue) {
  if (!session.completedAt) throw new Error("Cannot report an incomplete session");
  const scenario = byId(data.scenarios, session.scenarioId);
  const district = byId(data.districts, scenario.districtId);
  const sector = byId(data.sectors, scenario.sectorId);
  const score = scoreSession(session, data);
  const ranked = data.competencies
    .map((item) => ({ id: item.id, name: item.name, percentage: score.dimensions[item.id].percentage }))
    .filter(({ percentage }) => percentage !== null)
    .sort((a, b) => b.percentage - a.percentage);
  return {
    reportVersion: "1.0", sessionId: session.id,
    scenario: { id: scenario.id, version: scenario.version, title: scenario.title },
    location: { districtId: district.id, district: district.name, sectorId: sector.id, sector: sector.name },
    mode: { roleId: session.roleId, difficultyId: session.difficultyId },
    timing: { startedAt: session.startedAt, completedAt: session.completedAt, durationSeconds: Math.max(0, Math.round((session.completedAt - session.startedAt) / 1000)) },
    outcome: session.outcome, score,
    strengths: ranked.filter(({ percentage }) => percentage >= 80).slice(0, 3),
    developmentAreas: ranked.filter(({ percentage }) => percentage < 70).reverse().slice(0, 3),
    decisions: session.decisions.map(({ stepId, optionId, at }) => ({ stepId, optionId, at })),
  };
}

export function listScenarios(filters = {}, data = catalogue) {
  return data.scenarios.filter((scenario) =>
    (!filters.sectorId || scenario.sectorId === filters.sectorId) &&
    (!filters.districtId || scenario.districtId === filters.districtId) &&
    (!filters.roleId || scenario.roles.includes(filters.roleId)) &&
    (!filters.maxDifficulty || scenario.difficulty <= filters.maxDifficulty));
}
