# Codex task — Kampung Call world rebuild: scale, footprints, island layout

Paste everything below this line into Codex.

---

You are working in the **Kampung Call** repo (Three.js browser game, miniature
Singapore on a sphere). Read these first and treat them as binding:

- `docs/WORLD-AUDIT-2026-08-03.md` — the measured audit this task is based on.
  Every number in this prompt comes from it. Do not re-derive; do verify.
- `ART-DIRECTION.md` — the visual language. **You are not the art director.**
  Do not invent new shape language, palette, or style. Where this task requires
  a visual decision that ART-DIRECTION does not cover, stop and ask.
- `docs/CITY-PLANNING.md` — the road hierarchy and district rules. These rules
  are correct; the code does not currently honour them.
- `CONTRIBUTING.md`, `scripts/validate-project.mjs`, `scripts/check-performance-budget.mjs`.

## The problem in one paragraph

The world has no unit standard. The player is 2.17 units tall; four university
campuses are 2.28 units tall, the service van is 1.35 units tall, and an air
traffic control tower is the tallest object on the island. Separately, the
collider radii in `CITY_BUILDING_ZONES` were hand-typed before the GLBs existed
and are up to 2.8 units smaller than the models they represent, so
`auditBuildingSpacing()` and `auditPublicRouteClearance()` both pass while the
Sultan Mosque physically intersects the Peranakan shophouse row
(`review-shots/heritage-walking.png`). All six mission residents spawn inside
their own building's collider, 13 of 16 ambient NPCs stand in an empty field
nowhere near the place their dialogue names, and at R = 26 the horizon is 9.9
units away — 4.6 body lengths — so the ground curves out of frame and anything
past it reads as floating in the sky.

## Working method

Six gates. **Complete them in order. Stop after each gate, summarise what
changed and what you measured, and wait for review before starting the next
one.** Do not batch gates. Do not start writing geometry code before Gate A is
approved.

`npm test` must pass at the end of every gate.

---

## Gate A — Lock the scale bible

Produce `docs/SCALE-BIBLE.md` and a machine-readable `world/scale.json`. Nothing
else in this gate. No geometry changes yet.

### Rules to encode

**1 world unit = 1 metre.** This is literal and non-negotiable for anything the
player touches.

**Two scale bands.**

- **Band 1 — human and street scale: literal 1:1.** Characters, vehicles, props,
  doors, railings, kerbs, ground-floor storey heights, road widths, bench seat
  heights. A door is 2.1 u. A kerb is 0.15 u. If a player can walk up to it, it
  is real size.
- **Band 2 — building mass: vertically compressed.** Ground floor stays 3.0 u so
  entrances read correctly against a 1.75 u character. Every storey above the
  ground floor is a **stylised storey of 1.6 u**. This is what lets a 12-storey
  HDB exist on a 78-unit planet without becoming a needle.

**Planet radius: R = 26 → 78.** Derived, not chosen: 54 footprints at realistic
post-rescale radii need ~84,000 sq units of surface including roads, water and
open land; `4πR² = 84,000` gives R ≈ 82. Use 78 and keep the value in
`scale.json`, referenced from `src/main.js`, never re-typed.

**Height ladder.** These are targets. Hit them within ±10%.

| Tier | Object | Height (u) | Notes |
|---|---|---|---|
| Human | player, residents | 1.75 | the reference for everything |
| Human | cat | 0.30 | |
| Human | bench | 0.85 | seat height 0.45 |
| Human | postbox | 1.20 | |
| Human | bicycle | 1.10 | 1.80 long |
| Human | service kits (router/fibre/wifi) | 0.90 | |
| Human | **service van** | **2.30** | **5.40 long, 2.00 wide — the player must fit** |
| Human | bus | 3.20 | 11.0 long |
| Human | bus stop shelter | 2.90 | 6.0 long |
| Human | streetlamp | 5.00 | |
| Human | overhead bridge | deck clearance **5.20** | span 24.0 |
| Nature | palm | 9.0 | |
| Nature | rain tree | 12.0 | canopy 14 wide |
| Low-rise | mama shop | 4.6 | |
| Low-rise | kopitiam | 5.4 | |
| Low-rise | kampong house (on stilts) | 6.0 | |
| Low-rise | hawker centre | 6.2 | 34 × 22 footprint |
| Low-rise | shophouse / Peranakan | 6.2 | 2 storeys + parapet |
| Low-rise | wet market | 6.8 | 28 × 20 |
| Low-rise | landed house | 7.6 | |
| Low-rise | school | 8.0 | |
| Low-rise | MRT station | 9.0 | |
| Low-rise | temple | 10.0 | |
| Mid-rise | Esplanade | 12.0 | |
| Mid-rise | NUS / NTU / SMU / SUTD | 12 / 14 / 16 / 13 | **deliberately different — see Gate B** |
| Mid-rise | civic | 14.0 | |
| Mid-rise | airport terminal | 14.0 | 90 long × 45 deep |
| Mid-rise | hospital | 16.0 | |
| Mid-rise | Sultan Mosque | 18.0 dome / 24.0 minaret | |
| Mid-rise | HDB slab, Blk 65, void deck block | 20.6 | 12 storeys, 55 × 12 footprint |
| High | supertree | 26.0 | |
| High | CBD towers | 26–38 | spread them |
| High | control tower | 28.0 | |
| High | condo (Marina, Holland) | 30.0 | 18 storeys |
| High | point block | 34.0 | 22 storeys, 22 × 22 |
| High | Singapore Flyer | 34.0 | |
| **Cap** | **Marina Bay Sands** | **40.0** | **must be the single tallest object on the island** |

**Hard cap: nothing exceeds 40 u (≈ R/2).**

**Silhouette ranking must hold** and be asserted in code:
MBS > CBD tallest > Flyer ≥ point block > condo > control tower > supertree >
HDB > hospital > campus > everything else.

**Traversal budget.** Surface speed is `SPEED` units/second and is independent
of R, so tripling R triples every journey. Current `SPEED = 8.2` is 8.2 m/s —
Olympic sprint pace, another symptom of no unit standard. Retune:

- walk `SPEED` → 5.5 (fast jog, arcade-acceptable)
- `VAN_SPEED` 17 → 20
- `NPC_SPEED` 2.3 → 1.4, `NPC_WANDER_R` 4.2 → 9.0, `NPC_LOOK_R` 5.2 → 6.0
- **Constraint: the longest call-to-call walk must stay ≤ 40 s on foot.** Measure
  it and report the number. If it exceeds 40 s, move the depot or improve van
  access — do not raise walk speed above 6.0.

Also rescale, proportionally to R: `scene.fog` near/far (36/124), the shadow
camera extents (`sc.left/right/top/bottom = ±24`, `near 10`, `far 170`),
`camera.far` (500), road widths in `ROAD_STYLES`, `LOCAL_BUILDING_SETBACK`,
`MIN_BUILDING_VERGE`, `MAJOR_BUILDING_VISUAL_BUFFER`, and the terrain amplitude
in `terra()`.

### Gate A deliverable

`docs/SCALE-BIBLE.md` (human-readable, with the tables above) and
`world/scale.json` (the same numbers as data — `unit`, `planetRadius`,
`groundStorey`, `stylisedStorey`, `heightLadder`, `speeds`, `caps`).
No `src/` changes. Stop and wait for review.

---

## Gate B — Bring the assets to the bible

You may edit `blender/*.py` and `scripts/blender/*.py` and re-export GLBs.

1. **Rescale every asset to its ladder height.** Prefer fixing the Blender
   source and re-exporting; use the manifest `scale` factor only where the
   model's proportions are already correct.

2. **Re-author, don't rescale, where proportions are wrong.** `hdb-bg-v2` is
   built with two-storey proportions — scaling it to 20.6 u gives 10 m window
   rows. Rebuild the tall buildings (`hdb-bg-v2`, `hdb-call-v2`,
   `pointblock-call-v2`, `condo-bg-v2`, `condo-marina-v2`, `condo-holland-v2`)
   on a shared 1.6 u storey module with correct storey counts, a 3.0 u ground
   floor, and window/balcony rows that repeat per storey.

3. **Give the four campuses distinct silhouettes.** `nus-v2`, `ntu-v2`, `smu-v2`
   and `sutd-v2` are currently the same 5.33 × 3.74 × 2.28 mesh recoloured.
   Rebuild each with a different massing, roofline and height per the ladder.
   Recolouring is not differentiation.

4. **Enforce the `ART-DIRECTION.md` triangle budgets** (hero residence ≤ 35k,
   vehicle ≤ 18k, tree ≤ 8k, small prop ≤ 2k). Current worst offenders:
   `hdb-call-v2` 181,252 tris (5.2× over, 23% of the whole world),
   `busstop-v2` 27,048 (13.5× over the prop budget), `postbox-v2` 19,528 (9.8×),
   `overheadbridge-v2` 20,864, `fibre-kit-v2` 10,904, `birdcage-v2` 8,504,
   `bench-v2` 6,420. The cause is bevel/subdivision modifiers left on in the
   Blender scripts. Total across the manifest is 797,468 tris; target ≤ 250,000.

5. **Cut materials to ≤ 4 families per asset.** Every GLB currently runs ~1
   material per mesh (`wetmarket-v2` 20/20, `kampong-props-v2` 74 nodes,
   `landed-v2` 61 nodes) and has zero textures. Join meshes by material family
   before export. Note that `toonify()` adds an outline hull child per mesh, so
   every mesh you remove saves two draw calls.

6. **Draco-compress all 14 uncompressed GLBs**, including `hero-neighbourhood`,
   `hdb`, `landed-v2`, `service-van-v2`, `courier` and the six residents.

7. **Delete the 8 unreferenced GLBs** (4.0 MB shipping to `dist/`):
   `hero-neighbourhood.glb`, `hdb.glb`, `condo.glb`, `shophouse.glb`, `mrt.glb`,
   `kopitiam.glb`, `landed.glb`, `streetlamp-v2.glb`. If `streetlamp-v2` is
   wanted (`ASSET-PRODUCTION.md` claims it is used for "24 route-light
   replacements"), wire it into the manifest instead of deleting it.

8. **Every GLB origin at ground contact, minY = 0 ± 0.01.** `kampong-house-v2`
   exports at −1.46. Fix at source, don't mask it at runtime.

9. **Make `alignLowestPoint()` unconditional.** Remove the `ground:true` opt-in;
   13 manifest entries lack it today (`raintreeHero` floats +0.23,
   `birdcage` +0.23, `flyer` sinks −0.22, plus bench, postbox, merlion,
   supertree, busstop, controltower, palm, cat, bicycle, 3 service kits) and
   `swapResident()` never calls it at all. Keep `groundInset` as an override.

10. **Instance repeated assets.** `applySwap()` does `gltf.scene.clone(true)` per
    instance. Share geometry (or use `InstancedMesh`) for the 3 shophouses,
    3 supertrees, 8 palms, 3 cats, 3 benches, 2 postboxes and the bus fleet.

11. **Update `ASSET-PRODUCTION.md`.** It currently claims "0 unused GLBs",
    describes an unused `streetlamp-v2`, and references a `kampung-call.html`
    that no longer exists.

Stop and wait for review.

---

## Gate C — Make footprints derive from the models, not from memory

This is the gate that fixes the mosque-through-the-shophouse bug permanently.

1. **Write `scripts/audit-world.mjs`.** It must parse each GLB's JSON chunk
   directly — accessor `min`/`max` for `POSITION` plus node transforms give
   world-space bounds with no dependencies. For each manifest entry it computes
   height, footprint W × D, and `requiredRadius = hypot(W, D) / 2` at the
   manifest scale.

2. **Generate the footprint registry from that, at build time.** Replace the
   hand-typed radii in `CITY_BUILDING_ZONES`, `ROAD_CLEARANCE_ZONES`,
   `BUILDING_SPACING_PLAN` and the `addCollider(...)` calls with values derived
   from the audit output. A hand-typed radius should become a build error.

   Current shortfalls this fixes: `landedHero` needs 5.80 has 3.00;
   `hdbVoiddeck` 4.49/2.40; `sultanMosque` 4.68/2.60; `kampongHouse` 4.09/2.20;
   `kampongProps` 3.31/1.60; `wetmarket` 4.37/2.80; `airportTerminal` 4.23/3.00;
   `peranakan` 2.76/1.70; `kampungHero` 3.52/2.50; `hawker` 3.22/2.20;
   `overheadbridge` 4.97/none. And three oversized invisible walls:
   `condoMarina`, `condoHolland`, `mbs`.

3. **Add the 8 missing entries to `BUILDING_SPACING_PLAN`**: `CHANGI`,
   `CHANGI_TOWER`, `PERANAKAN`, `KGELAM`, `KGREEN`, `KGREEN_PROPS`, `VOIDDECK`,
   `WETMKT`. The whole Heritage pack has never been spacing-checked. Even at the
   old understated radii, four pairs already overlap
   (`KGREEN`/`KGREEN_PROPS` −0.88, `CHANGI`/`CHANGI_TOWER` −0.84,
   `GARDENS`/`KGREEN_PROPS` −0.37, `CHANGI_JEWEL`/`CHANGI_TOWER` −0.13).

4. **Wire `audit-world.mjs` into `npm test`** so it fails the build on: any
   footprint overlap, any asset over its triangle budget, any asset over 4
   materials, any GLB with minY ≠ 0, any uncompressed GLB, any unreferenced
   GLB, any height off its ladder target by >10%, and any violation of the
   silhouette ranking.

Stop and wait for review.

---

## Gate D — Replan the island at R = 78

Now that footprints are truthful and the planet is three times larger, redo the
layout. Follow `docs/CITY-PLANNING.md`; it is right, it just isn't implemented.

1. **Re-space every district.** With R = 78 there is room for real verges. Target
   a minimum verge of 8 u between independent building silhouettes (up from
   `MIN_BUILDING_VERGE = 0.4`). Intentional ensembles — the shophouse row, the
   airport campus, the CBD — keep one combined footprint as the doc already says.

2. **Group into legible districts with visual separation.** Right now the Sultan
   Mosque, the Peranakan row, the Singapore Flyer and the Universal Studios
   coaster are all in one 47° camera frame. After the replan, no two *different*
   districts should be fully visible from a single gameplay camera at ground
   level. Use the new horizon distance (~17 u at 1.6 u eye height) as the
   planning unit.

3. **Give every district a ground.** `plaza()` and `buildPathStrip()` exist and
   are barely used. Every major building gets a forecourt, podium or apron that
   visually seats it — no more buildings resting on raw procedural grass. Every
   institution (NUS, NTU, SMU, SUTD, hospital, civic) gets the pedestrian plaza
   between entrance and road that CITY-PLANNING.md already requires.

4. **Derive building headings from the street.** Replace the hand-typed heading
   degrees (`180`, `160`, `170`, `205`, `210`, `10`, `−13`, `66`, `−16`, `−34`…)
   with a frontage normal computed from `nearestRoadPose()`, so buildings face
   the road they sit on. Keep a manual override for landmarks with a canonical
   orientation (Merlion, MBS, mosque qibla).

5. **Fix `scatter()`.** It tests only `farFromPOIs`. Add the `onWater()` test
   (currently used only by `randomGroundUnit()`) and a road-corridor test, so
   bushes, flowers and tufts stop landing in the Marina Bay water disc, the ECP
   sea and the carriageway.

6. **Audit water properly.** The Merlion sits 0.84 u inside the bay disc (it is
   explicitly exempt — keep the exemption but make it deliberate and documented)
   and Clarke Quay sits 5.46 u inside the river disc and is not audited at all.
   Add `CLARKE_river` to `WATER_CLEARANCE_ZONES`.

7. **Fix the terrain sampling mismatch.** The planet is
   `SphereGeometry(26, 64, 48)` displaced per vertex by `terra()`, but objects
   are placed at the analytic `surfR(u)`. Equatorial vertex spacing is 2.55 u
   while `terra()`'s highest term has a ~15 u wavelength, so props and feet
   hover or sink by up to ~0.1 u across facets. Either raise the mesh tessellation
   so vertex spacing is ≤ 1/8 of the shortest terrain wavelength, or place
   objects on the *interpolated mesh* height rather than the analytic one. Same
   fix applies to `conformToSphere()`.

Stop and wait for review.

---

## Gate E — Put the characters where they belong

1. **Stop spawning residents inside their own building.** `CUSTOMER_DEFS` offsets
   each resident by ±3° of lat/lon, which at R = 26 is 1.36 u — inside colliders
   of 2.2–3.0 u. All six are inside: Sofia 1.53 u into CONDO5, Devi 1.46 into
   CONDO6, Kai 1.08 into LANDED4, Uncle Lim 1.03 into KAMPUNG, Mr Tan 0.95 into
   PBLOCK, Auntie Rosnah 0.01 into HDB. Mdm Wong is 1.71 u inside the wet market.

   Replace the degree offsets with **anchors derived from the building's frontage**:
   take the building's true footprint (Gate C), its street-facing normal
   (Gate D), and place the resident on the pavement in front of the entrance,
   outside the collider by a defined margin. Assert at load that no NPC spawn is
   inside any collider or any true model footprint.

2. **Move the 13 misplaced ambient NPCs to the place their dialogue names.**
   Each `AMBIENT_NPC_DEFS` entry has a `place:` string. Current distances to the
   nearest registered building: Hafiz "the void deck" 11.4 u away (nearest is the
   satellite station), Dinesh "the fitness corner" 11.4, Encik Zainal "the hawker
   centre" 10.9 (nearest is the Kopitiam), Aunty May "the market" 10.6 (nearest is
   NUS), Jia Hao "the MRT exit" 9.7, Cheryl "the shophouses" 9.5, Farah "the
   promenade" 9.4, Mei Lin "the bus stop" 8.2, Siti "the mama shop" 7.9,
   Uncle Bala "the community garden" 7.2, Iskandar "the riverside" 6.3,
   Ben "the park connector" 5.3.

   Replace hand-typed lat/lon with a lookup: `place` → anchor POI → frontage
   offset. Add an audit that fails if any NPC is more than 6 u from the anchor
   its `place` string names, or if the `place` string has no anchor.

3. **Ground the residents.** `swapResident()` never calls `alignLowestPoint()`.

4. **Rescale NPC motion** to the Gate A values and verify the wander radius
   (9.0 u) can't walk an NPC into a building, onto a road or into water.

Stop and wait for review.

---

## Gate F — Prove it

1. **Extend `scripts/validate-project.mjs`** with runtime-observable asserts for
   everything above, in the existing `document.documentElement.dataset.*` style:
   `npcSpawnConflicts`, `npcPlaceMismatches`, `footprintOverlaps`,
   `assetsOverBudget`, `silhouetteRankOk`, `groundedAssets`.

2. **Capture review screenshots** with `review-shots/shoot-cdp.cjs` at the same
   camera positions as the existing `heritage-*.png` set, plus one wide shot per
   district. Diff them against the current set and include both in your summary.
   The mosque must no longer intersect the Peranakan shophouse.

3. **Report measured numbers**, not adjectives:
   - player height, and every ladder entry's measured height vs target
   - total triangle count before/after (currently 797,468)
   - estimated draw calls before/after
   - `dist/` size before/after (currently 49 MB)
   - longest call-to-call walk in seconds
   - horizon distance at eye height
   - count of footprint overlaps, NPC spawn conflicts, NPC place mismatches — all must be 0

---

## Do not

- Do not invent art direction. `ART-DIRECTION.md` is the source of truth.
- Do not hand-type another collider radius, heading degree, or NPC lat/lon.
  Everything spatial derives from the model bounds and the road network.
- Do not raise walk speed above 6.0 u/s to paper over the larger island.
- Do not loosen `MIN_BUILDING_VERGE` or exempt a building from an audit to make
  it pass. If something doesn't fit, move it and say so.
- Do not add a new district, landmark or asset. This task is corrective only.
- Do not batch gates or skip the review stops.

## Ask before proceeding if

- The ladder target for an asset is impossible without re-authoring geometry you
  think should stay as-is.
- R = 78 breaks something structural I haven't anticipated (the MRT pocket world
  at `STATION_ORIGIN = (0, −112, 0)`, the van's road-snapping, the compass, or
  the swoop camera).
- Enforcing the triangle budgets would lose detail that ART-DIRECTION calls for.
