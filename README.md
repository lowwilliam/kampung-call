# Kampung Call

Kampung Call is a Three.js browser game set across a playful, stylised island. Explore its neighbourhoods, meet six residents, solve home-connectivity problems, and complete every call before the shift ends.

The game combines a small open-world Three.js experience with hands-on service missions. Each customer visit asks the player to inspect symptoms, choose diagnostic actions, get immediate feedback, and either restore service or make the correct escalation.

## What you do

A shift contains six work orders in a randomized order:

- install and validate a new router;
- identify and escalate an optical `LOS / red PON` fault;
- isolate a broken Ethernet link;
- improve a Wi-Fi dead zone with a mesh node;
- diagnose intermittent service;
- recover and re-pair an offline mesh node.

For each call, the player follows the target compass to a resident, holds a short arrival conversation, completes a three-step diagnosis, and closes the visit with the customer. Correct decisions build score and service streaks; incorrect decisions reduce customer patience and include an explanation of what to check next.

## Highlights

- A navigable miniature island built with Three.js, including housing estates, campuses, civic landmarks, roads, bridges, watercraft, and moving street life.
- Three island bus examples (routes 65, 97, and 143) sharing one reusable transit model, including one moving Central Corridor service.
- An enterable Kampung Central MRT pocket world with a concourse, stairs, platform, tunnel, and a three-car MRT set. Walk back upstairs and press Enter to return to the map.
- Walking and drivable-van traversal with route guidance and collision-aware roads.
- Six resident characters with portraits, dialogue, randomized visit order, and persistent in-progress diagnosis state.
- Scenario questions with randomized answer order, coaching feedback, scoring, and a completion summary.
- Keyboard, touch, audio, mute, and reduced-motion support.
- Local GLB, PNG, and MP3 assets with procedural fallbacks for selected scene elements.
- A dependency-free capability engine for structured scenarios, competency scoring, and report generation.

## Run locally

### Requirements

- Node.js 20 or newer
- npm 10 or newer

Three.js, its GLTF/DRACO loaders, and the application code are bundled locally by Vite. The game does not depend on runtime CDN scripts.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally [http://localhost:5173](http://localhost:5173). To use a different port:

```sh
npm run dev -- --port 8080
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk or steer | `WASD` or arrow keys | Drag the joystick on the left |
| Enter or exit the van | `F` when near the van | Use the van button |
| Enter or exit the MRT | `Enter` near the MRT entrance or upstairs exit | Use the MRT button when it appears |
| Send an emote | `E` | Use the emote button |
| Choose a diagnostic answer | Number keys `1`–`3` or click | Tap an answer |
| Toggle sound | Click the speaker button | Tap the speaker button |

Customer conversations and diagnosis panels open automatically when the player reaches the active resident on foot. Work orders cannot start or finish while driving.

## Project structure

```text
index.html              Accessible application shell and HUD markup
src/main.js             Three.js world, player controls, missions and asset loading
src/styles.css          Responsive HUD, dialogue and title-screen styling
vite.config.js          Production build and static 3D/audio asset pipeline
assets/                 Runtime 3D models, resident portraits, audio and previews
blender/                Scripts and source files used to produce 3D assets
src/capability/          Reusable scenario, competency and reporting modules
tests/                  Node tests for the capability engine and console helpers
scripts/                Project validation and performance checks
docs/                   Planning, performance and launch-readiness notes
vercel.json             Production route and cache-header configuration
```

The application uses native ES modules in development and produces a self-contained static build in `dist/`. The capability modules are browser-loadable ES modules and have their own integration notes in [`src/capability/README.md`](src/capability/README.md).

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build:preview` | Create a local draft build in `dist/` for review and testing |
| `npm run build` | Create a production build only after the catalogue legal-release gate passes |
| `npm run preview` | Preview the production build locally |
| `npm run validate` | Check HTML invariants, assets, roads, work orders and scenario structure |
| `npm run test:performance` | Enforce HTML, total runtime-asset and single-asset budgets |
| `npm run format:check` | Run lightweight formatting checks |
| `npm test` | Run all project checks and a production build |

Run the full suite before opening a pull request:

```sh
npm test
```

Pull requests and pushes to `main` run the same checks in GitHub Actions.

## Working with content and assets

- Keep every work order in sync with a diagnostic scenario. Validation requires one scenario per active call, at least three diagnostic rounds, three or more choices per round, and exactly one correct choice.
- Treat scenario and competency IDs in `src/capability/` as stable external keys. Increment a scenario version when its branching or scoring meaning changes.
- Update the shared road and building-footprint data when adding a district; do not create isolated routes that bypass the city-planning model.
- Keep generated runtime assets in `assets/` and their Blender sources or generation scripts in `assets/` and `blender/` as appropriate.
- Check performance budgets after changing HTML, GLBs, images, or audio.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the change workflow and the documentation below for specialist guidance.

## Deployment

The application builds to a static Vite site. Vercel serves `dist/index.html` and applies the cache and security headers defined in `vercel.json`.

This repository is currently a prototype, not a production-ready learning platform. Accessibility, security, analytics, LMS integration, content governance, browser support, operational readiness, and asset/landmark rights clearance still require dedicated work before a public or commercial launch. See [`docs/LEGAL-RISK-REVIEW-2026-08-15.md`](docs/LEGAL-RISK-REVIEW-2026-08-15.md).

## Further documentation

- [`docs/CITY-PLANNING.md`](docs/CITY-PLANNING.md) — road hierarchy, building clearances and district rules
- [`docs/MEDIA-PERFORMANCE.md`](docs/MEDIA-PERFORMANCE.md) — current media footprint and optimization history
- [`docs/COMMERCIAL-READINESS.md`](docs/COMMERCIAL-READINESS.md) — release, accessibility, privacy and learning-platform gates
- [`ART-DIRECTION.md`](ART-DIRECTION.md) — visual language and asset direction
- [`ASSET-PRODUCTION.md`](ASSET-PRODUCTION.md) — 3D asset-production guidance
- [`src/capability/README.md`](src/capability/README.md) — scenario-engine integration contract
