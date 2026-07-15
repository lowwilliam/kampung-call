# Capability scenario integration

The module is dependency-free and browser-loadable:

```js
import {
  catalogue, createSession, getCurrentStep, chooseOption, createReport
} from "./src/capability/index.mjs";
```

Integration contract:

1. Use `catalogue.districts` to place/select map districts and `listScenarios()` to populate missions.
2. Store the value returned by `createSession()`. Render `getCurrentStep(session)` and replace the session with `chooseOption(session, optionId)` after each decision.
3. When `session.completedAt` is set, call `createReport(session)`. Persist the returned JSON as the stable reporting boundary; it includes scenario version, role, difficulty, timestamps, decisions, outcome, weighted competency scores, strengths, and development areas.
4. Treat scenario IDs and competency IDs as stable external keys. Increment a scenario's `version` when changing its scoring or branching semantics.
5. Call `validateCatalogue()` in CI or an authoring tool before publishing new content.

Run the standalone tests with:

```sh
node --test tests/capability-engine.test.mjs
```

## Optional operations console

Add one module script and one element. The console uses Shadow DOM, is collapsed by default,
and only captures pointer input inside its own launcher or panel:

```html
<script type="module" src="./src/capability/capability-console.mjs"></script>
<capability-console></capability-console>
```

It can also be mounted programmatically:

```js
import { mountCapabilityConsole } from "./src/capability/capability-console.mjs";
mountCapabilityConsole(document.body, { districtId: "changi" });
```

