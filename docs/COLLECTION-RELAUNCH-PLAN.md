# Collection Relaunch Plan

Status: accepted; implementation in progress as of 2026-08-14.

## Implementation progress — 2026-08-14

- Phase 1: local D1/R2 inventory complete with zero local rows/objects; hosted inventory remains a deletion blocker.
- Phase 2: 68-record draft Catalogue Manifest, schema, checksum validation, integrity refresh and Manifest-derived web/API data layer implemented.
- Phase 4: public Collection now exposes only the 68 Game Assets, uses static Card Previews or explicit static placeholders, preserves search/category/order state in URLs, and opens server-resolved standalone Detail Views with real 404s and one WebGL viewer.
- Phase 4: the Collection client now receives only lightweight card records rather than the full rights/editorial Manifest; Detail Views server-render a static poster or placeholder beneath the one progressive WebGL viewer.
- Phase 5: public Community, Like, Report and Submission endpoints return `410 Gone`; CLI, MCP and the shared Asset Client expose only catalogue search, detail and grant-controlled downloads. Historic private receipt reads and admin inventory access remain until hosted cleanup is approved.
- Phase 6: a Manifest-derived 13-entry Memory District registry now drives a demolition-era timeline, sourced story panels, main-island and direct URL entry, exact surface-pose return, and three-region load/unload streaming. The runtime is a separate lazy chunk and all 13 GLBs are copied into the game build.
- Phase 7 engineering gate: the root source budget is back under its 320 KB ceiling (319.2 KB); the production Memory District chunk is 22.75 KB / 8.16 KB gzip and the main game chunk is 257.21 KB / 84.85 KB gzip. Reference-device frame pacing, memory and accessibility acceptance remain outstanding.
- Phase 1 safety: private inventory reads no longer initialise schema or trigger automatic retention deletion, and authenticated admin mutations now return `410 Gone`.
- Provenance: all 20 optional threejsassets Scenery Components now distinguish their configured vendor Source Variant from the first-party procedural fallback actually delivered.
- Integrity: the 68 public model copies and approved-quality hashes have been resynchronised to the current source GLBs; changed records were returned to draft and their stale previews invalidated.
- Release remains blocked: 47 Card Previews are still missing, all 68 Display Clearances and Creator Credits remain unreviewed, every Download Grant is blocked, and the production domain/corrections address/hosted data inventory/external reviews are absent.

## Outcome

Relaunch the Collection as a mobile-public-first, authoritative, read-only catalogue of 68 Game Assets. The public experience supports discovery, standalone Detail Views, sourced stories, asset-specific licensed downloads, and privacy-minimal telemetry. The game adds all 13 Lost Heritage reconstructions as playable content in a lazily loaded Memory District.

The release is not a Community platform, a CMS, a popularity product, a bulk asset library, or a geographic reconstruction of lost Singapore.

## Product contract

1. A Visitor can discover an asset, inspect it, read its evidence and provenance, share its canonical URL, return to the same Collection state, and request a factual correction without creating an account.
2. The Collection remains complete without WebGL. Interactive 3D is progressive enhancement available only in a Detail View.
3. The Catalogue Manifest is the only publication authority. Runtime audits, Lost Heritage research data, databases, and game registries are inputs or validators, not parallel sources of truth.
4. Display Clearance and Download Grant are separate. Every public asset needs Display Clearance; downloads appear only for the individually cleared subset.
5. Credits describe the exact Source Variant delivered. A first-party fallback is not credited as a third-party model, and a licensed third-party model is never presented as first-party work.
6. William Liu is the initial Responsible Publisher (`https://www.linkedin.com/in/ruiqian-liu/`). Creator Credit, adapters, Production Method, and Asset Provenance remain separate.

## Hard release blockers

- A real production domain and dedicated corrections email on that domain.
- Display Clearance for all 68 Game Assets.
- An explicit Download Grant for every asset that exposes a download.
- Written Singapore Tourism Board clearance for the Merlion-resembling Harbour Statue, or a non-recognisable original redesign.
- Documented professional review for high-risk modern landmarks, post-10-April-1987 buildings, religious, university, airport, trademark, likeness, and source-media cases.
- Community D1/R2 and personal-data inventory before destructive cleanup.
- Recorded acceptance on a Pixel 6a-class Android device and an iPhone 12-class iOS device.
- WCAG 2.2 AA, browser, performance, asset, link, provenance, and Manifest gates passing with non-zero failure exits.

## Delivery sequence

### Phase 0 — Supply external release inputs

- Choose and configure the production domain.
- Create the dedicated corrections email.
- Choose the private encrypted rights-evidence store and access policy.
- Retain a Singapore intellectual-property reviewer for high-risk assets.
- Identify the independent accessibility reviewer.
- Record the two reference devices or contracted cloud-device equivalents.
- Contact STB regarding the Harbour Statue or approve the redesign brief.

Exit: every external dependency has an owner, destination, and evidence location. This phase may overlap engineering but blocks publication.

### Phase 1 — Inventory before deletion

- Read-only inventory the existing Community D1 database, R2 objects, submissions, receipts, reports, likes, admin accounts, and hosted secrets.
- Determine whether any real Contributor data exists and what minimum audit record must be retained.
- Produce a deletion manifest for submitted models, LinkedIn URLs, other personal data, D1 tables, R2 objects, secrets, and write bindings.
- Snapshot the current Collection behaviour, APIs, CLI, MCP, tests, and deployment configuration for rollback and migration comparison.
- Mark ADRs 0002–0005 as superseded until the data cleanup is accepted; remove them with the Community implementation at the final cleanup stage.

Exit: signed inventory and deletion plan. Nothing is deleted in this phase.

### Phase 2 — Establish the Catalogue Manifest

- Define a versioned schema and validator for exactly 68 Game Assets.
- Import the current 55 game models and 13 Lost Heritage models without treating current JSON files as authoritative after migration.
- Record stable ID, canonical slug, locale-ready copy, category, Curated Order, GLB path/checksum/version, checksum-bound Card Preview, Creator Credit, adapters, Production Method, Asset Provenance, Singapore Connection, historical sources, source-media rights evidence, Evidence Status, publication state, last review, Responsible Publisher, Display Clearance, Download Grant, and withdrawal state.
- Add separate Scenery Component and Source Variant records for the 20 threejsassets slots; do not add them to the 68-item Collection.
- Generate all downstream game, web, API, CLI, MCP, sitemap, credits, and download metadata from the Manifest.
- Make CI fail for duplicate IDs/slugs, missing fields, stale checksums/posters, broken sources, unknown rights state, or count drift.

Exit: one validated Manifest reproduces the same 68-item catalogue across every read surface.

### Phase 3 — Complete editorial and rights clearance

- Classify each asset as original, building, sculpture, person, trademark-bearing, vendor-derived, or composite.
- Separate historical references from model-making source media and record rights for photographs, plans, textures, logos, likenesses, and embedded components.
- Set display and download rights to `blocked` by default.
- Apply CC BY-NC 4.0 only to wholly controlled first-party models; enumerate excluded third-party rights in every eligible package.
- Require professional review or permission for the high-risk groups identified in Phase 0.
- For every Lost Heritage statement, mark `Source-confirmed`, `Reasoned inference`, or `Artistic interpretation` and add the last review date.
- Resolve Harbour Statue through STB permission or redesign.
- Generate `/credits` data and asset-level credit/license copy from the same records.

Exit: all 68 assets have Display Clearance; the downloadable subset has complete Download Grants. This is the critical path for public release.

### Phase 4 — Rebuild the read-only Collection

- Remove Community, Like, Submit, Report, Receipt, and Admin concepts from public navigation and Collection state.
- Replace per-card WebGL with one generated AVIF/WebP Card Preview tied to the current GLB checksum.
- Retain search, category filters, disclosed Curated Order, alphabetical order, and Lost Heritage demolition-era order.
- Replace the modal with server-resolved standalone Detail Views and real 404s.
- Preserve Collection filters and scroll state when returning from a detail route.
- Add asset-specific metadata, canonical URL, Open Graph poster, structured data, sitemap entries, and `noindex` withdrawn tombstones.
- Detail Views expose story, Evidence Status, sources, Creator Credit, adapters, Production Method, Responsible Publisher, rights status, correction email, and eligible download.
- Provide the full static experience when WebGL is unavailable, reduced, or fails.
- Remove request-dependent root metadata so public catalogue pages can be cached.

Exit: discovery → inspect → share → return works on desktop, mobile, keyboard, screen reader, and no-WebGL paths.

### Phase 5 — Rebuild downloads and read tooling

- Centralise one Manifest permission function for website, API, CLI, and MCP.
- Generate one ZIP per cleared asset containing the published GLB, `LICENSE.txt`, provenance JSON, and README.
- Do not publish a 68-item bulk archive.
- Keep versioned read-only search/metadata APIs and grant-controlled downloads.
- Remove upload, submission recovery, moderation, write, and Community commands from API, CLI, and MCP.
- Make package contents, licence scope, checksum, and public metadata mutually verifiable in tests.

Exit: no channel can distribute a blocked model or report permissions inconsistent with another channel.

### Phase 6 — Add the Memory District to the game

- Add a discoverable portal on the main island and a direct menu/URL entry.
- Build a demolition-era timeline walk, explicitly labelled as a curated memory space rather than a geographic reconstruction.
- Integrate all 13 Lost Heritage GLBs as real runtime content with placement, scale, collision, sourced interaction, and a reliable return to the main island.
- Stream nearby regions; do not parse all 13 models at entry.
- Reuse Manifest identity, credits, evidence, and model versions in the game.
- Do not add a new mission, reward, or save-state system in the first release.
- Test portal re-entry, direct entry, return flow, collision, camera clearance, frame pacing, memory release, and missing-model fallback.

Exit: every Lost Heritage model is encounterable and inspectable in gameplay without changing the modern island's historical meaning or startup budget.

### Phase 7 — Enforce public-quality gates

- WCAG 2.2 AA, including keyboard order, visible focus, screen-reader structure, touch targets, contrast, reduced motion, and non-WebGL access.
- Browser matrix: current and previous two major releases of Safari, Chrome, Edge, and Firefox.
- Collection budgets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 under recorded mobile throttling.
- Detail View: at most one WebGL context and interactive within five seconds after view entry.
- Memory District: ≥30 FPS on reference mid-range devices and no sustained memory growth across entry, traversal, exit, and re-entry.
- Fix the asset audit so budget failures are present in its report and make the command exit non-zero in CI.
- Add same-origin, cookie-free, fixed-schema, rate-limited telemetry for aggregate page views, detail opens, cleared downloads, WebGL failure, and performance only.
- Persist no request-level telemetry; retain daily aggregates for 13 months.

Exit: automated gates pass and independent accessibility plus recorded Android/iOS acceptance is complete.

### Phase 8 — Migrate and release

- Deploy the replacement to a private environment.
- Run editorial, legal, rights, model, download, SEO, security, privacy, accessibility, performance, and data-cleanup rehearsals.
- Promote to a small authenticated or otherwise restricted `noindex` acceptance preview.
- Obtain William Liu's final review of the generated Manifest diff and external review evidence.
- Cut over the public domain once all blockers are clear; expose download controls only for the cleared subset.
- Monitor errors, WebGL fallback, Core Web Vitals, download denials, and corrections during the initial release window.
- After accepted cutover, execute the approved Community deletion manifest, remove D1/R2 bindings and secrets, delete Community code/tests/docs/ADRs, and verify no write surface or personal data remains.

Exit: the public domain serves one immutable Catalogue Release, the old experience remains recoverable during the rollback window, and Community cleanup has a completed audit record.

## Dependency and parallel-work map

- Phase 1 and external work in Phase 0 start first.
- Phase 2 depends on the inventory shape but can proceed while legal review is arranged.
- Phases 4 and 6 can run in parallel after stable Manifest identity and model versions exist.
- Phase 5 depends on the Manifest permission model and Phase 3 download decisions.
- Phase 7 runs continuously, with final device and accessibility acceptance after Phases 4–6 stabilise.
- Phase 8 depends on all prior exit criteria and every hard blocker.
- Rights clearance, not UI coding, is the expected critical path.

## Acceptance matrix

| Surface | Required proof |
| --- | --- |
| Collection | 68 validated cards, no card WebGL, filters/sort/search, no Community writes |
| Detail View | stable URL, unique metadata, real 404, one viewer, static fallback, return-state restoration |
| Provenance | exact Source Variant, Creator/adapter/method separation, evidence states and sources |
| Rights | 68 Display Clearances; asset-specific downloads default blocked |
| Download | ZIP licence/provenance/checksum consistency across web/API/CLI/MCP |
| Game | 13 placed Memory District assets, collisions, stories, dual entry, return, streamed loading |
| Accessibility | WCAG 2.2 AA plus independent keyboard/screen-reader/mobile check |
| Performance | Core Web Vitals, 5-second viewer, 30 FPS and stable memory on reference devices |
| Privacy | no Community data after cleanup; no request telemetry; 13-month aggregates only |
| Operations | immutable release, generated diff approval, emergency withdrawal and rollback exercised |

## Explicitly deferred

- Community submissions, likes, reports, accounts, moderation, D1/R2 publishing, or public CMS.
- Multi-language publication beyond human-reviewed English-first infrastructure.
- Bulk download of all assets.
- Card-level interactive 3D or autoplay videos.
- Memory District missions, rewards, or persistent progression.
- Treating threejsassets Scenery Components as Collection Assets or downloadable files.

## External facts still required

- Production domain.
- Dedicated corrections email.
- Private evidence-store location and access owner.
- Named IP reviewer and accessibility reviewer.
- STB permission result or Harbour Statue redesign approval.
- Exact Android/iOS device models and OS versions used for final acceptance.

The user confirmed this document as the shared understanding before implementation began.
