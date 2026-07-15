# Commercial readiness

This checklist turns the prototype into a measurable launch programme. “Done” means evidence exists, not only that a feature was discussed.

## Release gates

- [ ] Product owner has approved the target roles, competencies, pass criteria, and supported devices.
- [ ] Every scenario has a subject-matter expert, version, learning objective, evidence rubric, and escalation path.
- [ ] Browser support, frame-time, memory, initial-transfer, and low-power-device budgets are measured in CI.
- [ ] Staging has a release smoke test covering load, one successful job, one failed choice, reset, audio, and completion.
- [ ] Production has error monitoring, uptime checks, release identifiers, rollback instructions, and named incident owners.
- [ ] Brand, dialogue, customer likenesses, music, fonts, 3D assets, and training claims have documented commercial rights.

## Accessibility

- [ ] Meet WCAG 2.2 AA; test with keyboard only, VoiceOver, NVDA, zoom at 200%, reduced motion, and high contrast.
- [ ] Supply a non-canvas equivalent for objectives, position, equipment state, choices, feedback, score, and completion.
- [ ] Add visible focus, a skip link, semantic landmarks, correct dialog focus trapping/restoration, and no keyboard traps.
- [ ] Never encode status only through colour, sound, emoji, animation, or position.
- [ ] Caption and transcribe meaningful audio; expose independent music, ambience, effects, and narration controls.
- [ ] Support reduced motion and a low-graphics mode without changing assessment outcomes.
- [ ] Complete an independent audit and publish an accessibility statement and support route.

## Privacy, safety, and security

- [ ] Document every personal-data field, purpose, lawful basis, owner, retention period, processor, and data residency.
- [ ] Collect the minimum learner identity required; separate training analytics from advertising and prohibit session replay on personal fields.
- [ ] Provide privacy notice, consent where required, access/export/deletion workflows, and enterprise data-processing terms.
- [ ] Threat-model authentication, tenant boundaries, reports, scenario authoring, uploads, APIs, and administrator actions.
- [ ] Use SSO (OIDC/SAML), MFA for privileged roles, least-privilege RBAC, auditable admin actions, and automated deprovisioning.
- [ ] Add dependency, secret, SAST, DAST, and security-header scanning; define vulnerability disclosure and patch SLAs.
- [ ] Complete backups, restore testing, business continuity, incident response, and breach-notification exercises.

## Learning, LMS, and reporting

- [ ] Use a versioned scenario schema outside application code with validation, preview, approval, localisation, and rollback.
- [ ] Score observable competencies—not only speed—including diagnosis, safety, communication, documentation, cost, and escalation.
- [ ] Store attempts, choices, evidence, hints, outcomes, scenario version, timestamps, and assessor overrides in an append-only audit trail.
- [ ] Implement xAPI statements and/or SCORM 2004 packaging; validate suspend/resume, completion, success, score, and offline retry in target LMSs.
- [ ] Provide cohort, competency-gap, completion, attempt, and scenario-quality reports with CSV/API export and retention controls.
- [ ] Prevent answer memorisation through parameterised symptoms, equipment states, evidence, distractors, and root causes.
- [ ] Establish content calibration, bias review, SME revalidation, and learner appeal procedures.

## Analytics and operations

- [ ] Create a tracking plan with event owner, definition, properties, privacy class, retention, and decision supported.
- [ ] Measure activation, scenario start/completion, error category, abandon point, frame rate, load time, crash, and accessibility-mode use.
- [ ] Exclude raw free text, credentials, precise location, and unnecessary identifiers from telemetry.
- [ ] Define service-level objectives for availability, latency, data freshness, support response, recovery time, and recovery point.
- [ ] Add tenant-aware feature flags, staged rollout, kill switches, synthetic checks, and dashboards tied to alert runbooks.
- [ ] Test capacity and cost for expected concurrent learners, report generation, content delivery, and analytics ingestion.

## Current engineering commands

- `npm run dev` serves the existing Vercel route locally at `http://127.0.0.1:4173`.
- `npm run validate` checks HTML invariants, local asset references, and scenario structure.
- `npm run test:performance` prevents growth beyond the prototype’s transitional budgets.
- `npm test` runs all dependency-free CI checks.

The current budgets are regression guards, not launch targets. Before public launch, target an initial transfer below 3 MB, defer district assets until needed, cap individual compressed assets near 1 MB where practical, and validate a stable 30 FPS on the lowest supported device.
