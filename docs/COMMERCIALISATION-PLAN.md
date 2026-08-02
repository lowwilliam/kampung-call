# Kampung Call — commercialisation review and plan

Review date: 2026-08-02
Reviewed at: `7195761` (branch `claude/project-review-commercialization-xcu1e3`)

This document is a review of the project as it stands, a positioning
recommendation, and a phased plan to get from prototype to a product someone
pays for. It supersedes nothing in `docs/COMMERCIAL-READINESS.md` — that
document is a good *checklist*, but a checklist is not a plan. It says what
"done" looks like without saying what to build, in what order, or who buys it.

---

## 1. What you actually have

Measured, not assumed:

| Area | State |
| --- | --- |
| World and art direction | **Strong.** 24 authored Blender assets with editable sources, toon shading, inverted-hull ink outlines, a real city-planning model (road hierarchy, clearance zones, footprint registry). |
| Game loop | **Complete but thin.** 6 work orders × 3 questions = 18 decisions total. ~10 minutes of content. |
| Assessment engine | **Well designed, entirely disconnected.** `src/capability/` has competencies, weights, role modes, difficulty modes, scoring, and report generation. Nothing in the game calls it. |
| Codebase | `src/main.js` is 5,254 lines / 256 KB in one file, containing 79 procedural builders plus renderer, terrain, audio, input, HUD, and all mission state. |
| Backend | **None.** No auth, no persistence beyond `localStorage['kp_best']`, no analytics, no error monitoring, no tenancy. |
| Accessibility | **None for the game itself.** The canvas has no role, label, or tabindex. No skip link. |
| Docs | Unusually thorough, partly stale. |

The craft is real. The art direction document is better than most funded
studios produce, and the world holds up on screen. That is the asset worth
building a company around. Everything else in this document is in service of
not wasting it.

---

## 2. The central problem: there are two products in this repo

**Product A — a consumer game.** "Kampung Call: six neighbours, one mission."
An AI-built homage, made in Singapore, charming, nostalgic.

**Product B — a B2B capability assessment platform.** `src/capability/` defines
7 sectors (Aviation, Healthcare, Maritime & Industrial, Public Transport…),
6 weighted competencies, 3 role modes (field engineer / dispatcher / duty
manager), 3 difficulty modes, a pass mark at 70, and competency reports with
strengths and development areas.

They share no code. The game's work orders are hardcoded in `src/main.js:4058`.
The capability scenarios live in `src/capability/catalog.mjs` and are reachable
only through a floating **"Missions"** button that overlays the title screen and
opens a completely different content set. Two content models, two scoring
systems, two visual languages, one page.

A player who clicks that button on the consumer title screen lands in an
enterprise training console about Changi terminal Wi-Fi congestion. That is not
a bug — it is the shape of an unmade decision.

**Nothing else on this list matters until that decision is made**, because the
answer changes what "commercial ready" even means.

---

## 3. Recommendation: B2B first, consumer build as the funnel

### Why not consumer-first

A six-mission browser game about diagnosing routers has a small addressable
audience and no obvious monetisation. Ads on a 5 MB WebGL page are a rounding
error. Premium sales need 10× the content. The consumer path is real work with
a weak commercial ceiling.

### Why B2B

Field-service training today is SCORM click-throughs, PDFs, and ride-alongs.
The ride-along is the expensive part: a senior engineer shadowing a new hire
costs two salaries and produces one trained person. **A single senior engineer's
week costs more than a year of software.** If a simulator removes even the first
two ride-alongs per hire, the ROI story writes itself.

That is the pitch, and it should be the literal first line of every deck:

> **Replace the first two ride-alongs.**

Buyers, in order of proximity:

1. **SG telcos and their contractor networks** — Singtel, StarHub, M1, Simba,
   NetLink Trust. High contractor churn; onboarding is the acknowledged pain.
2. **Adjacent trades with the same shape** — SP Group, town councils, facilities
   management, fire/security systems, M&E and aircon installers. Same job:
   go to a premises, read symptoms, decide, escalate correctly.
3. **Training providers and IHLs** — ITE, the polytechnics, and private
   Approved Training Organisations running WSQ-aligned technical courses. They
   buy content rather than build it.
4. **SEA telcos** — Telkom Indonesia, Maxis/TM, AIS/True, PLDT/Globe,
   Viettel/VNPT. Far larger field forces, weaker training tooling. This is the
   scale story, and it is why the content must be localisable from day one.

### The Singapore unlock: don't become an ATO — sell into one

SkillsFuture Singapore funding covers a large share of course fees for local
companies. An employer comparing your S$50k simulator against a subsidised WSQ
course is not comparing like with like — until your assessment is *inside* a
funded course.

Becoming an Approved Training Organisation yourself is a long, heavy process.
**Partnering with an ATO that already holds accreditation, and supplying your
simulator as the practical and assessment component of their existing WSQ
course, is dramatically faster.** They keep the accreditation burden; you get
the funded distribution channel and a reference logo.

This is the single highest-leverage commercial move available, and the existing
capability engine is already shaped for it: weighted competencies, a pass mark,
evidence per decision, and per-attempt reports are exactly the artefacts a
competency-based assessment framework asks for. Someone was already thinking
this way — finish the thought.

### What happens to the consumer game

**Keep it. Free, public, polished, at a real domain.** It is not the revenue —
it is the demo. Nobody opens a PDF from a cold email. Everybody clicks a link
that turns into a playable Singapore in three seconds. The consumer build is
the top of the funnel and the recruiting pitch, and it costs almost nothing to
maintain once the content pipeline exists.

Two builds, one codebase, one scenario engine, different content packs and
different shells.

---

## 4. Blockers found

Ordered by how hard they block taking money. Every item is evidence-backed.

### 4.1 Legal and IP — these block the first invoice

| # | Finding | Evidence |
| --- | --- | --- |
| L1 | **`Singtel` branding is baked into shipped geometry**, not just comments: a ComCentre tower, a satellite earth station, and canvas-painted door panels on the player's van. `NetLink Trust` appears in customer-facing scenario copy. | `src/main.js:2029`, `:2122`, `:2780`, `:4061` — 16 occurrences |
| L2 | **No LICENSE file.** No documented commercial rights for 3D assets, audio, fonts, or dialogue. | repo root |
| L3 | **"an AI-built homage to messenger.abeto.co"** — a written derivative-work acknowledgment of another studio's work, shipped in the HTML of a product you intend to sell. It is hidden from view by `.t-credit{display:none}`, so it is a source-level disclosure rather than a visible one, but it ships and it is discoverable. | `index.html:21`, `src/styles.css:65` |
| L4 | Real protected landmarks: Merlion (a registered STB mark), Marina Bay Sands, Changi, NUS/NTU/SMU/SUTD. Stylised silhouettes are usually defensible, but "usually" is not a position to sell from. | 24 Merlion references + landmark kits |

Selling a training product branded with a telco's marks to that telco's
competitor is not a subtle problem. **L1 and L3 must be resolved before any
commercial conversation.** The fix is cheap: a neutral in-world brand
(e.g. "Kampung Telecom") that becomes a *white-label slot* — which is a feature,
not a compromise, because every enterprise buyer will want their own livery on
that van. Turn the liability into the upsell.

### 4.2 Engineering — these block scaling the team and the content

| # | Finding | Evidence |
| --- | --- | --- |
| E1 | **Unit tests never run in CI.** `npm test` = validate + performance + format + build. `node --test` appears nowhere. The 8 capability-engine tests pass but are unenforced. The README's documented `node --test tests/` also fails on Node 22 (needs a glob or explicit files). | `package.json:12`, `.github/workflows/` |
| E2 | **The validation suite is regex matching over source text**, asserting that specific function bodies match specific patterns — e.g. `/function buildPath\(a,b,width=1\.5\)…buildClearedRoute\(raw,pathWidth\/2\)/`. It proves nothing about behaviour, breaks on any rename or reformat, and **actively blocks the modularisation the project needs.** | `scripts/validate-project.mjs:132` and ~20 similar |
| E3 | **Everything loads eagerly.** 48 GLBs / 51 asset requests fire at script parse — 5.1 MB before the player presses Start, with no loading screen, no progress, no prioritisation. Main thread blocked ~4.8 s during scene construction. | measured, headless Chromium |
| E4 | **33.9 MB of the 40 MB `dist/assets` is never requested** — 70 files. Includes **3.6 MB of source maps published to production** (full unminified source exposed), ~4 MB of orphaned legacy GLBs with zero code references (`hero-neighbourhood`, `hdb`, `kopitiam`, `mrt`, `landed`, `shophouse`, `condo`), and 21.2 MB of Blender preview PNGs flattened into `dist/assets/`. `.vercelignore` masks the previews on Vercel only — move host and you ship all of it. | measured against `dist/` |
| E5 | **The performance budget measures the wrong artefact.** `check-performance-budget.mjs` concatenates `index.html` + `src/main.js`, calls the result "HTML", and reports 253.7 KB against a 280 KB budget — 91% consumed, and it will fail on ordinary feature work. It never measures the actual shipped bundle (816 KB JS / 225 KB gzipped), real transfer, LCP, or frame time. | `scripts/check-performance-budget.mjs:6` |
| E6 | `src/main.js` at 5,254 lines is not unit-testable at any granularity. No function in it can be reached by a test. | `wc -l` |
| E7 | **No backend.** Nothing to authenticate, persist, report, or bill against. | repo-wide |
| E8 | `CONTRIBUTING.md` still instructs contributors to edit `kampung-call.html`, deleted in the Vite migration, and to open port 4173 (dev is 5173). | `CONTRIBUTING.md:11,26` |

### 4.3 Product — these block the product being worth buying

| # | Finding |
| --- | --- |
| P1 | **18 total decisions, all fixed.** Answers are memorised in two playthroughs. `docs/COMMERCIAL-READINESS.md` flags this itself. For a *paid assessment* this is fatal — a score that can be memorised certifies nothing. |
| P2 | **Zero accessibility for the world.** The canvas has no role, label, or tabindex; there is no skip link and no non-canvas equivalent. Objectives, position, equipment state, and navigation are invisible to assistive tech. For SG public-sector and enterprise procurement this is a hard gate, and `COMMERCIAL-READINESS.md` promises WCAG 2.2 AA that the current architecture cannot deliver. |
| P3 | The "Missions" console — an enterprise catalogue — renders on the consumer title screen. |
| P4 | Compass renders as a floating disc mid-screen over the world rather than in the HUD; cloud layer occludes the gameplay camera. |

---

## 5. The architectural insight that makes this tractable

> **The 3D world is the motivation layer. The assessment is a decision graph.
> Keep them separable.**

This one constraint resolves three of the hardest problems at once:

- **Accessibility (P2)** stops being "make WebGL screen-readable", which is
  near-impossible, and becomes "render the same decision graph as semantic
  HTML" — which is a week of work, and yields an *assessment-equivalent* text
  mode where a screen-reader user is scored identically.
- **Content scale (P1)** stops being "author more 3D" and becomes "author more
  data", which SMEs can do without touching Blender or JavaScript.
- **White-labelling (L1)** stops being a rebrand and becomes a content pack plus
  a livery swap.

Every phase below serves this separation.

### Target structure

```
apps/
  play/        consumer + embedded learner client
  admin/       tenant admin, cohorts, reporting, authoring preview
packages/
  world/       terrain, city planning, districts, asset manifest
  gameplay/    player, van, camera, input, collision
  scenario/    unified scenario engine (today's src/capability, extended)
  ui/          HUD, dialogue, diagnosis panels, text-mode equivalents
  content/     scenario packs as versioned data + JSON schema
services/
  api/         auth, tenancy, attempts, reports, xAPI bridge
```

---

## 6. The plan

Assumes 1–3 developers. Phases are sequential where they must be; items within
a phase are parallelisable.

### Phase 0 — Decide and de-risk (weeks 1–2)

Cheap, unblocking, mostly not code.

- [ ] **Make the positioning call.** Written, one page, dated. Everything else
      depends on it.
- [ ] **L1/L3:** strip `Singtel` and `NetLink` from geometry, textures, scenario
      copy, **and GLB material names** (`Singtel Navy`, `Singtel Red` are baked
      into the shipped binaries — see `docs/ART-REVIEW.md` §2.2); replace with a
      neutral in-world brand behind a single config object that later becomes
      the white-label slot. Remove the abeto.co credit line.
- [ ] **L2:** add a LICENSE, and an asset provenance register recording origin
      and commercial rights for every GLB, audio file, font, and portrait.
- [ ] **E1:** add `node --test "tests/*.test.mjs"` to `npm test`. Fix the README
      command. A test suite that does not run is worse than none — it reports
      safety that does not exist.
- [ ] **E4:** set `sourcemap: 'hidden'`, delete the 7 orphaned GLBs, and scope
      `viteStaticCopy` to runtime assets only rather than relying on
      `.vercelignore`. Target: `dist/` under 8 MB, first load under 3 MB.
- [ ] **E8:** correct `CONTRIBUTING.md`.
- [ ] **P3:** remove the capability console from the consumer shell.
- [ ] Add error monitoring (Sentry or equivalent) and a release identifier.
      You currently cannot tell whether anyone hit a crash.

**Gate:** clean legal surface, honest CI, first load under 3 MB.

### Phase 1 — One product, one engine (weeks 3–8)

- [ ] **Replace E2 before touching E6.** The regex validators must become
      behavioural tests first, or the refactor cannot start. Convert each
      source-pattern assertion into a test of the function's *output*
      (route clearance, building spacing, water clearance are all pure
      geometry — genuinely unit-testable once extracted).
- [ ] **Extract `src/main.js` into `packages/`** along the boundaries that
      already exist implicitly in the file's section comments. Do it in
      mechanical, reviewable slices; do not rewrite behaviour in the same
      commit as a move.
- [ ] **Unify the two content models.** The six work orders become scenario
      packs in the `scenario` engine's format. Delete the parallel scoring path
      in `main.js`. One engine, one report shape.
- [ ] **Extend the scenario schema for parameterisation (P1):** fault
      *templates* with parameter slots (which indicator is lit, cable
      condition, whether the customer already rebooted, premises type, time
      pressure), distractor pools per step, and a per-attempt seed recorded in
      the attempt record for audit and appeal. This is the line between a quiz
      and an assessment.
- [ ] **Text mode (P2).** Semantic-HTML equivalent of the full decision graph:
      objectives, location, distance and bearing, equipment state, choices,
      feedback, score. Assessment-equivalent by construction.
- [ ] **E3:** staged loading — player, van, and active district first; defer the
      rest to idle. Add a real loading state with progress.
- [ ] **E5:** replace the source-size proxy with budgets on the shipped bundle,
      first-load transfer, LCP, and frame time on a defined low-end device.

**Gate:** one engine, one report; `main.js` under 500 lines; text mode completes
and scores a full shift; behavioural tests green in CI.

### Phase 2 — Make it sellable (weeks 9–16)

- [ ] **`services/api`:** tenants, users, cohorts, attempts, reports. Postgres.
      Append-only attempt records — scenario version, seed, every decision,
      timestamps, assessor overrides.
- [ ] **SSO (OIDC/SAML)** and least-privilege RBAC. Enterprise buyers will not
      accept a password form.
- [ ] **Admin app:** cohort management, competency-gap reporting, CSV and API
      export, retention controls.
- [ ] **LMS integration:** xAPI statements first (cheaper, more expressive),
      SCORM 2004 packaging second because procurement will ask for it by name.
      Validate suspend/resume, completion, success, score, and offline retry
      against at least two target LMSs.
- [ ] **White-label:** livery, brand, and content pack as tenant configuration —
      the upsell that L1 turned into a feature.
- [ ] Tracking plan and product analytics: activation, scenario start and
      completion, error category, abandon point, frame rate, load time,
      accessibility-mode use. No free text, no credentials, no precise location.

**Gate:** a second tenant can be provisioned without a code change, and an
attempt can be traced end to end from launch to LMS statement.

### Phase 3 — Make it credible (weeks 17–24)

- [ ] **Independent WCAG 2.2 AA audit** and published accessibility statement.
      Budget for a remediation round; first audits are never clean.
- [ ] **Content governance:** every scenario gets a named SME, a version, a
      learning objective, an evidence rubric, and a revalidation date. Bias
      review and a learner appeal procedure — both are prerequisites for
      assessment that affects someone's employment.
- [ ] **Content depth:** 6 scenarios is a demo. 25–30 parameterised templates
      across 3–4 job families is a curriculum. This is the largest single body
      of remaining work and it is content, not code — which is the point of
      Phase 1's parameterisation.
- [ ] **Security:** threat model, dependency/secret/SAST/DAST scanning,
      vulnerability disclosure policy, patch SLAs, backup and restore testing.
- [ ] **DPA, privacy notice, data residency.** SG enterprise buyers will ask
      where learner data lives before they ask what the product does.

**Gate:** an enterprise security questionnaire can be answered without
qualifications.

### Phase 4 — Go to market (parallel from Phase 2)

- [ ] Ship the free consumer build at a real domain. It is the demo link in
      every outbound email.
- [ ] **Sign one ATO partner.** Supply the simulator as the practical and
      assessment component of an existing funded WSQ course. This is the
      fastest path to funded distribution and a reference logo.
- [ ] **Three paid pilots**, ideally one telco, one adjacent trade, one IHL.
      Price them — free pilots do not convert and do not tell you anything.
- [ ] **Instrument the ROI claim.** Ride-along hours before and after. Without
      that number the pitch is an assertion; with it, it is a business case.

---

## 7. Business model

| Tier | Shape | Indicative price |
| --- | --- | --- |
| Consumer / demo | Free, public, unauthenticated | — |
| Team | Per seat, self-serve, standard content | S$60–150 / learner / year |
| Enterprise | Platform fee + content packs, SSO, LMS, reporting | S$25k–120k / year |
| Custom world | White-label livery, customer's equipment and SOPs | S$40k–150k one-off |

The custom-world tier is where the Blender pipeline stops being a cost centre
and becomes the moat. Competitors selling SCORM click-throughs cannot quote it
at all.

---

## 8. Metrics that decide whether this is working

Track these, not vanity numbers.

**Product:** first-load transfer, LCP, p50/p95 frame time on the defined low-end
device, scenario completion rate, abandon point, text-mode usage share.

**Learning:** score distribution (a distribution with no spread means the
assessment is too easy or memorised), repeat-attempt improvement, competency-gap
concentration, SME revalidation currency.

**Commercial:** pilots started → converted, ride-along hours displaced per
learner, seats deployed vs seats active, ATO-channel share of pipeline.

---

## 9. What I would do first

If only one week is available, do these six. They are cheap, they are all
blockers, and together they change the project's honest status from "prototype
with unknown risk" to "prototype with known risk":

1. Make the positioning call and write it down.
2. Strip the `Singtel`/`NetLink` marks and the abeto.co credit.
3. Add a LICENSE and an asset provenance register.
4. Wire `node --test` into CI.
5. Turn off published source maps; delete the 7 orphaned GLBs.
6. Add error monitoring.

Then Phase 1, in order — and specifically **E2 before E6**. The regex validators
are the reason `main.js` cannot be split. Everything downstream is waiting on
that one unlock.
