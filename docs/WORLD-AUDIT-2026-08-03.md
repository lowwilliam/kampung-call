# Kampung Call — world audit, 3 Aug 2026

Evidence base: `src/main.js` (5,781 lines), all 57 GLBs in `assets/` parsed for
world-space bounds and triangle counts, `review-shots/heritage-*.png`, and a
numeric re-run of the city-planning maths at R = 26.

Reference measurement: **the player is 2.17 units tall** (`courier.glb`, manifest
scale 1). Every ratio below is against that.

---

## Part A — 3D modelling gaps

### A1. There is no unit standard. The world is a doll-house around a giant.

| Asset | Height (u) | × player | Should read as |
|---|---|---|---|
| `mamashop-v2` | 2.02 | **0.9×** | a shop |
| `nus/ntu/smu/sutd-v2` | 2.28 | **1.0×** | a university campus |
| `esplanade-v2` | 2.27 | **1.0×** | a concert hall |
| `mrt-v2` | 2.44 | 1.1× | an MRT station |
| `merlion-v2` | 2.40 | 1.1× | an 8.6 m statue |
| `airport-terminal-v2` | 2.89 | 1.3× | Changi T3 |
| `hawker-v2` | 2.92 | 1.3× | a hawker centre |
| `service-van-v2` | **1.35** | **0.6×** | a van the player drives |
| `busstop-v2` | 1.80 | 0.8× | a shelter you stand under |
| `hdb-bg-v2` | 6.72 | 3.1× | a 12-storey HDB slab |
| `pointblock-call-v2` | 7.78 | 3.6× | a 25-storey point block |
| `mbs-v2` | 6.43 | 3.0× | the tallest thing in Singapore |
| `flyer-v2` | 5.81 | 2.7× | a 165 m observation wheel |
| `controltower-v2` | **6.92** | **3.2×** | — currently the tallest object on the island |

Consequences: the player cannot fit inside his own van; four universities are
person-height; Marina Bay Sands and the Singapore Flyer are shorter than an air
traffic control tower; every landmark reads as a garden ornament.

This is not fixable by uniform scaling alone. `hdb-bg-v2` is authored with
two-storey proportions — scaling it to 34 u gives 17 m window rows. The tall
buildings need re-authoring on a shared storey module.

### A2. Four campuses are the same model

`nus-v2`, `ntu-v2`, `smu-v2`, `sutd-v2` all measure exactly 5.33 × 3.74 × 2.28.
Only triangle counts differ (7,744 / 5,008 / 7,864 / 8,992). They are recolours
of one base with no distinct silhouette.

### A3. Triangle budgets in `ART-DIRECTION.md` are violated by 3–90×

Stated budgets: hero residence ≤ 35k, vehicle ≤ 18k, tree ≤ 8k, small prop ≤ 2k.

| Asset | Tris | Budget | Over |
|---|---|---|---|
| `hdb-call-v2` | **181,252** | 35k | **5.2×** |
| `hawker-v2` | 39,272 | 35k | 1.1× |
| `kopitiam-v2` | 37,688 | 35k | 1.1× |
| `wetmarket-v2` | 36,336 | 35k | 1.0× |
| `busstop-v2` | 27,048 | 2k | **13.5×** |
| `overheadbridge-v2` | 20,864 | 2k | 10.4× |
| `postbox-v2` | **19,528** | 2k | **9.8×** |
| `fibre-kit-v2` | 10,904 | 2k | 5.5× |
| `birdcage-v2` | 8,504 | 2k | 4.3× |
| `bench-v2` | 6,420 | 2k | 3.2× |

`hdb-call-v2` alone is 23% of the world's geometry. Meanwhile `raintree-v2` is
384 tris and `landed-bg-v2` is 1,296 — a 470:1 spread between comparable
assets. There is no enforced budget anywhere in `npm test`.

**Total across the 48 manifest assets: 797,468 unique triangles.**

### A4. One material per mesh, zero textures, doubled draw calls

- 551 unique mesh nodes across the manifest, at roughly 1 material per mesh
  (`wetmarket-v2` 20/20, `peranakan-house-v2` 16/16, `landed-v2` 61 nodes,
  `kampong-props-v2` 74 nodes).
- Every GLB has **0 images**. Nothing is texture-atlased; all colour is
  per-material.
- `toonify()` (line 5586) adds a `BackSide` outline hull as a child of every
  mesh, so runtime draw calls are ≈ 2 × mesh count before instancing.
- `applySwap()` does `gltf.scene.clone(true)` per instance — no `InstancedMesh`,
  no geometry sharing across the 3 shophouses, 3 supertrees, 8 palms, 3 cats.
- `ART-DIRECTION.md` says "max 4 material families per reusable asset". Over 30
  assets break this.

### A5. Draco is applied inconsistently

14 GLBs are uncompressed, and they are the largest ones:
`hero-neighbourhood.glb` (1.7 MB / 31k tris), `hdb.glb` (1.1 MB / 15k tris),
`landed-v2.glb` (854 kB / 15,856 tris / 61 nodes), `service-van-v2.glb` (379 kB),
`courier.glb` (269 kB), the six residents (~370 kB each), `condo.glb`,
`shophouse.glb`, `mrt.glb`, `kopitiam.glb`, `landed.glb`, `engineer-v2.glb`,
`raintree-v2.glb`.

### A6. 4.0 MB of dead GLBs ship to production

Unreferenced anywhere in `src/main.js`: `hero-neighbourhood.glb` (1.7 M),
`hdb.glb` (1.1 M), `condo.glb`, `shophouse.glb`, `mrt.glb`, `kopitiam.glb`,
`landed.glb`, `streetlamp-v2.glb`. All eight are copied into `dist/` (49 MB).

`ASSET-PRODUCTION.md` claims "0 unused GLBs" and describes `streetlamp-v2` as
"24 route-light replacements" — it is never loaded. The doc also references a
`kampung-call.html` that no longer exists. Both asset docs are stale.

### A7. Ground alignment is only half-wired

`alignLowestPoint()` runs only when the manifest entry sets `ground:true`. These
13 entries do not, and their exported origins are off the contact plane:

- floating: `raintreeHero` +0.23 u, `birdcage` +0.23 u
- sunk: `flyer` −0.22 u
- unchecked: `bench`, `postbox`, `merlion`, `supertree`, `busstop`,
  `controltower`, `palm`, `cat`, `bicycle`, `serviceRouter/Fibre/Wifi`

`swapResident()` (line 5683) never calls it either.

`kampong-house-v2.glb` exports with minY = −1.46 — masked at runtime, but it
breaks the "GLB assets must be centred at ground contact" rule and means the
`.blend` source is wrong.

### A8. Terrain mesh and placement surface are sampled at different resolutions

The planet is `SphereGeometry(26, 64, 48)` displaced per vertex by `terra()`
(line 406). Every object is placed at the *analytic* `surfR(u)` (line 332).
Equatorial vertex spacing is 2.55 u; the highest-frequency term in `terra()`
has a ~15 u wavelength. Linear interpolation across a facet therefore drifts
from the analytic value by up to ~0.1 u, so small props and NPC feet visibly
hover or sink as they cross facets. `conformToSphere()` has the same mismatch.

---

## Part B — Island layout gaps

### B1. Collider radii do not match the models. This is the root cause.

`CITY_BUILDING_ZONES`, `ROAD_CLEARANCE_ZONES`, `auditBuildingSpacing()` and
`auditPublicRouteClearance()` all run on hand-typed radii that were authored
before the GLBs and never re-derived. Required radius = half the model's
footprint diagonal:

| Footprint | Needs | Registered | Shortfall |
|---|---|---|---|
| `landedHero` | 5.80 | 3.00 | **−2.80** |
| `hdbVoiddeck` | 4.49 | 2.40 | **−2.09** |
| `sultanMosque` | 4.68 | 2.60 | **−2.08** |
| `kampongHouse` | 4.09 | 2.20 | −1.89 |
| `kampongProps` | 3.31 | 1.60 | −1.71 |
| `wetmarket` | 4.37 | 2.80 | −1.57 |
| `airportTerminal` | 4.23 | 3.00 | −1.23 |
| `peranakan` | 2.76 | 1.70 | −1.06 |
| `hawker` / `kampungHero` | 3.22 / 3.52 | 2.20 / 2.50 | −1.02 |
| `overheadbridge` | 4.97 | **none** | −4.97 |

20 of 32 audited footprints are undersized. **The audits pass because they are
auditing footprints roughly half the size of the models.** The mosque poking
through the Peranakan shophouse in `review-shots/heritage-walking.png` is
exactly the 2.08 u shortfall above.

Three are oversized instead (`condoMarina`, `condoHolland`, `mbs`), producing
invisible walls.

### B2. The whole Heritage pack is exempt from the spacing audit

`BUILDING_SPACING_PLAN` (line 530) is missing eight entries that exist in
`CITY_BUILDING_ZONES`: `CHANGI`, `CHANGI_TOWER`, `PERANAKAN`, `KGELAM`,
`KGREEN`, `KGREEN_PROPS`, `VOIDDECK`, `WETMKT`.

Even at the *understated* radii, four pairs already overlap:

- `KGREEN` / `KGREEN_PROPS` −0.88 u
- `CHANGI` / `CHANGI_TOWER` −0.84 u
- `GARDENS` / `KGREEN_PROPS` −0.37 u
- `CHANGI_JEWEL` / `CHANGI_TOWER` −0.13 u

### B3. All six mission residents spawn inside their own building

`CUSTOMER_DEFS` (line 3872) offsets each resident by ±3° of lat/lon from their
POI. At R = 26, 3° = 1.36 u — well inside colliders of 2.2–3.0 u.

| Resident | Inside | By |
|---|---|---|
| Sofia | `CONDO5` | 1.53 u |
| Devi | `CONDO6` | 1.46 u |
| Kai | `LANDED4` | 1.08 u |
| Uncle Lim | `KAMPUNG` | 1.03 u |
| Mr Tan | `PBLOCK` | 0.95 u |
| Auntie Rosnah | `HDB` | 0.01 u |
| Mdm Wong (ambient) | `WETMKT` | 1.71 u |

`resolveNpcCollisions()` shoves them out of an already-invalid spawn every
frame; because the true model footprint is up to 2× the collider (B1), they pop
out and still end up inside the geometry. This is the misplaced-character
symptom.

### B4. 13 of 16 ambient NPCs stand in an empty field

Each has a `place:` string used in dialogue. Distance to the nearest registered
building:

| NPC | Claims to be at | Nearest building | Distance |
|---|---|---|---|
| Hafiz | the void deck | Satellite station | 11.4 u |
| Dinesh | the fitness corner | Wet market | 11.4 u |
| Encik Zainal | the hawker centre | Kopitiam | 10.9 u |
| Aunty May | the market | NUS | 10.6 u |
| Jia Hao | the MRT exit | MRT | 9.7 u |
| Cheryl | the shophouses | Temple | 9.5 u |
| Farah | the promenade | Holland V | 9.4 u |
| Mei Lin | the bus stop | Satellite station | 8.2 u |
| Siti | the mama shop | NTU | 7.9 u |
| Uncle Bala | the community garden | Point block | 7.2 u |
| Iskandar | the riverside | Wet market | 6.3 u |
| Ben | the park connector | Void deck | 5.3 u |

Only Raj (2.97 u), Nadia (3.10 u) and Priya (3.73 u) are plausibly placed. These
are hand-typed coordinates that were never re-checked.

### B5. The planet is far too small for its content

R = 26 gives **8,495 sq units of surface** for 42 major footprints, 12 local
buildings, a theme park, an airport, a CBD, four universities, an MRT network
and ~120 props.

From a 2 u eye height the horizon is **9.9 u away — 4.6 body lengths.**

This produces the two symptoms you named:

- **"Messy."** `heritage-district-overview.png` has the Sultan Mosque, the
  Peranakan row, the Singapore Flyer and the Universal Studios coaster loop in
  one frame. Districts cannot read as districts when four of them fit in a
  single 47° camera.
- **"Characters fly in the sky."** Nothing leaves the surface — the *surface*
  leaves the frame. Past 9.9 u the ground curves out of view, so NPCs and props
  standing on it render as silhouettes against the sky gradient with no visible
  ground beneath. The scene fog (36→124) and the shadow camera (±24 u) are both
  wider than the entire visible world, so there is no depth cue to correct it.

### B6. Districts have no ground

Every building sits directly on the same procedural green. `plaza()` (line 438)
and `buildPathStrip()` (line 444) exist but almost nothing uses them. There is
no paving, kerb, podium, forecourt or district colour anywhere.

`docs/CITY-PLANNING.md` requires "institutions retain a pedestrian plaza between
their entrance and the road network" — not implemented for NUS, NTU, SMU, SUTD,
the hospital or the civic district.

### B7. Scatter ignores water and roads

`scatter()` (line 3320) tests only `farFromPOIs`. `onWater()` exists but is used
solely by `randomGroundUnit()` for the instanced carpet. So scattered bushes
(min 6 u), flowers (5.5 u) and tufts (5 u) can be placed inside the Marina Bay
water disc (radius 7.5 u) and the ECP sea (5 u), and there is no road-corridor
test at all, so props can land on the carriageway.

Separately: the Merlion sits 0.84 u inside the bay disc and Clarke Quay 5.46 u
inside the river disc — the first is explicitly exempted from
`auditBuildingWaterClearance()`, the second is not audited at all.

### B8. Building headings are hand-typed, not derived from the street

`placeOnSphere(..., 180 / 160 / 170 / 205 / 210 / 10 / −13 / 66 / −16 / −34 …)`.
`CITY-PLANNING.md` says "residential buildings sit beside local streets and face
them", but nothing computes a frontage normal from `nearestRoadPose()`. In the
overview screenshot the shophouse row and the mosque face different directions
with no street between them.

---

## Summary of root causes

Four decisions explain nearly everything above:

1. **No locked unit standard**, so every asset was scaled by eye against its
   neighbours rather than against the player.
2. **Collider radii were authored before the GLBs and never re-derived**, so the
   entire city-planning system validates a fictional city.
3. **Placement coordinates are hand-typed degrees**, so NPCs, headings and
   props were never re-checked against the buildings they refer to.
4. **The planet radius was never revisited** as content grew from a few
   landmarks to 42 districts.
