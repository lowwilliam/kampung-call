# Contributing to Kampung Call

Kampung Call is a static Three.js game with dependency-free Node.js tooling. Changes should keep the experience easy to run, preserve the relationship between work orders and learning scenarios, and avoid unexpected growth in the runtime download.

## Before you start

Use Node.js 20 or newer, install the locked project metadata, and run the game locally:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173` and complete at least the part of the player journey affected by your change.

## Where changes belong

- Change gameplay, UI, the Three.js scene, resident visits, or active diagnostic cases in `kampung-call.html`.
- Change reusable scenario scoring and report generation in `src/capability/`.
- Put capability-module tests in `tests/`.
- Put runtime models, portraits, audio, and preview images in `assets/`.
- Keep Blender source files and repeatable asset-generation scripts in `assets/` and `blender/`.
- Put durable technical or product decisions in `docs/` rather than leaving them only in commit messages.

## Scenario changes

Every active work order must map to exactly one diagnostic case. A diagnostic case must include:

- a clear customer complaint;
- at least three diagnostic rounds;
- at least three choices in each round;
- exactly one correct choice per round;
- useful feedback for every choice.

Wrong answers should explain the diagnostic reasoning without shaming the player. Prefer observable evidence and safe field practice over trivia. If you change a reusable capability scenario's scoring or branching semantics, increment its version and keep its scenario and competency IDs stable.

## World and asset changes

Use the shared road, access-node, clearance-zone, and building-footprint systems when adding or moving a district. Review the title camera, gameplay camera, walking routes, van routes, landmark spacing, and river crossings after geometry changes.

When adding media:

- use relative `assets/...` references;
- keep filenames stable when replacing an asset in place;
- ground GLB models from their rendered bounds;
- preserve the expected local forward axis or declare the required orientation correction;
- run the performance-budget check before committing.

More detail is available in `docs/CITY-PLANNING.md`, `ASSET-PRODUCTION.md`, and `docs/MEDIA-PERFORMANCE.md`.

## Required checks

Run all automated checks:

```sh
npm test
```

For gameplay-facing changes, also check manually:

1. The title screen transitions into play.
2. Walking, the compass, and collision boundaries behave normally.
3. The van can be entered, driven, and exited near a safe road position.
4. Customer dialogue opens only when expected.
5. Correct and incorrect diagnostic choices show the right feedback.
6. A visit can be paused and resumed without overlapping panels.
7. Sound can be muted and the layout remains usable at a narrow viewport.

## Pull requests

Keep each pull request focused and explain:

- what changed from the player's point of view;
- why the change is needed;
- which automated and manual checks were run;
- whether media size, controls, scenarios, routes, or deployment behavior changed.

Do not commit generated caches, `node_modules/`, `.vercel/`, coverage output, or operating-system metadata.
