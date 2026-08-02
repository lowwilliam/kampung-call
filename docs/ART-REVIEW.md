# Kampung Call — art, modelling and visual review

Review date: 2026-08-02
Reviewed at: `1b2cbc2`

A critique of the visual product: the 3D assets, the render pipeline, the world
composition, and the interface. Findings are measured where measurement was
possible — silhouette overlap, material inventory, and scene statistics were
extracted from the shipped GLBs and from an instrumented runtime, not eyeballed.

Companion to [`ART-DIRECTION.md`](../ART-DIRECTION.md), which states the
intent. This document reports how far the assets are from it.

---

## 1. What is working

Real strengths, worth protecting through any change:

- **The best assets are genuinely characterful.** `kampung-call-v2` (the
  stilted kampung house), `shophouse-v2`, `kopitiam-v2`, `hawker-v2`, and
  `mamashop-v2` are authored, specific, and tell a story. The kampung house in
  particular reads instantly in flat black — it is the benchmark the rest of
  the set should be measured against.
- **Small props punch above their weight.** `bicycle-v2`, `birdcage-v2`,
  `cat-v2`, `streetlamp-v2`, `palm-v2`, `supertree-v2`, and `flyer-v2` all pass
  a strict silhouette read.
- **The GLB pipeline is professional.** Assets are joined by material family
  (`SHOPHOUSE · Terracotta`, `· Chalk`, `· Ink`), giving one draw call per
  family per asset. Draco compression, editable `.blend` beside every export,
  ground-contact origins. This is a real pipeline, not an export dump.
- **The title screen is the strongest single frame in the product.** Composition,
  type scale, the off-centre planet, the drifting clouds — it sells the game.
- **Parts of the UI are excellent.** The order-chit HUD with its perforated red
  edge, the rotated `RESTORED` rubber stamp on completion, the correct/wrong
  option states, and consistent `:focus-visible` outlines all show care.
- **The render setup is sound in principle:** `MeshToonMaterial` with a shared
  4-step gradient ramp, a warm key light, a cool rim light that tracks the
  player, and inverted-hull ink outlines. The ingredients are right.

---

## 2. Tier 1 — findings that break the world's identity

### 2.1 Silhouette collapse: four institutions, two outlines

The art bible's first modelling rule is *"Every hero object needs a distinctive
silhouette in flat black."* I rendered every asset to a pure front elevation in
flat black and computed pairwise intersection-over-union.

| Pair | Silhouette IoU |
| --- | ---: |
| `nus-v2` vs `smu-v2` | **100.0%** |
| `ntu-v2` vs `sutd-v2` | **100.0%** |
| `nus-v2` vs `ntu-v2` | 83.5% |
| `condo-marina-v2` vs `condo-holland-v2` | **88.0%** |
| `fibre-kit-v2` vs `wifi-kit-v2` | 71.5% |
| `courier` vs `engineer-v2` | 71.1% |

Four Singapore universities are served by **two silhouettes**. They are not the
same file — each was authored separately, 13.6k–18.3k vertices apiece — which
makes it worse: the modelling effort was spent and the differentiation was not
achieved. In game the only thing distinguishing NUS from SMU is a painted label
too small to read at gameplay camera distance.

The real buildings could hardly be more different: SMU is glass blocks embedded
in the CBD, SUTD is an angular campus, NTU has the Hive. All four collapsed into
one three-block massing with a recoloured roof.

**`condo-marina-v2` vs `condo-holland-v2` at 88% is the more damaging one.**
Those are two *different hero call locations* — Devi's Wi-Fi survey and Sofia's
mesh deployment. The player navigates this world by landmark. Two of the six
destinations look the same.

### 2.2 The palette is documented but not enforced

`ART-DIRECTION.md` specifies 7 named colours plus "three greens per canopy".
Extracting every material from every shipped GLB:

**81 distinct material names. 74 of them undocumented.**

Worse than the count is the drift. The same colour appears under many names:

- whites — `Chalk`, `Chalk white`, `Off white`, `Warm white`, `Sign white`, `HDB warm white`
- reds — `Terracotta`, `Terracotta coral`, `HDB coral`, `Corridor coral`, `Plaster coral`, `Singapore red`, `Transit red`
- teals — `Deep teal`, `Weathered teal`, `Feature teal`, `HDB teal`, `Block teal`
- greens — `Plant mid`, `Plant deep`, `Plant lime`, `Plant light`, `Plant green`, `Planting`, `Deep leaf`, `Sunlit leaf`, `Rain tree green`
- darks — `Ink`, `Ink charcoal`, `Charcoal frame`, `Dark metal`, `Dark steel`, `Steel`
- glass — `Graphic glass`, `Smoky glass`, `Blue green glass`, `Window glass`, `Transit glass`

And several names carry **different hex values in different assets**: `Concrete`
resolves to 3 distinct colours, `Timber` to 3, and `Terracotta`, `Deep teal`,
`Weathered teal`, and `Signal yellow` to 2 each. Even the documented palette is
inconsistent between files.

Each asset was authored independently with ad-hoc material naming. Nothing links
them and nothing validates them. This is precisely how a stylised world loses
coherence as it scales, and it explains the drift already visible — `smu-v2`
carries a blue roof no other campus uses, and it is not a palette colour.

Also worth noting: `Singtel Navy`, `Singtel Red`, and `Singtel red` are material
names **baked into the shipped GLB binaries**, so the trademark exposure noted
in the commercialisation review is not confined to JavaScript source.

### 2.3 Clouds occlude the gameplay camera

The most visible defect in play. Clouds are placed at:

```js
.multiplyScalar(R + 5 + Math.random() * 8)   // R = 26
```

so they orbit 5–13 units above a 26-unit planet, with puff spheres of radius
1.2–2.6. At the title camera this is beautiful. At the gameplay camera — which
sits low and close behind the player — a cloud passing between camera and world
fills a large fraction of the frame as flat grey haze.

In a captured dialogue frame, cloud geometry washes out roughly the right 60% of
the screen. They are also `transparent: true` at `opacity: 0.97`, which puts them
in the sorted transparent pass for no benefit — 0.97 is not a meaningful blend.

### 2.4 Four visual languages on one screen

| Layer | Language |
| --- | --- |
| 3D world | Hand-inked warm diorama, flat toon shading, ink outlines |
| HUD and panels | `Courier New` monospace throughout — reads as a terminal |
| Resident portraits | Painterly, semi-realistic, soft-rendered |
| "Missions" console | Dark teal, modern SaaS, sans-serif |

The portraits are the sharpest clash: soft painterly faces next to blocky
low-poly toon characters. They are not the same people in the same world.

The typography is also internally inconsistent — the dialogue panel sets its
body copy in the sans stack while the diagnosis panel sets everything in
`Courier New`, so the two core panels of the game do not match each other.

Nothing in the UI carries the world's defining feature: ink. The chit HUD's
perforated edge is the one element that reaches for a physical, hand-made
quality, and it is the best thing in the interface. It should be the rule, not
the exception.

---

## 3. Tier 2 — technique and craft

### 3.1 The outline technique is the wrong one, and it is expensive

Outlines are inverted hulls created as a **duplicate child mesh** scaled by a
uniform factor:

```js
const o = new THREE.Mesh(m.geometry, OUTLINE_MAT);
o.scale.setScalar(1.045);
m.add(o);
```

Two consequences.

**Visually:** uniform scaling means ink weight is proportional to object size, so
a streetlamp and an HDB block get wildly different line weights — the opposite of
a pen. And because it scales about the mesh's own origin rather than its
centroid, any asset whose origin is not centred gets a thick line on one side and
none on the other. The "hand-inked" north star cannot be achieved this way.

**In cost,** measured from an instrumented runtime after the world has loaded:

| Metric | Value |
| --- | ---: |
| Draw calls per frame | **1,293** |
| Meshes in scene | 3,770 |
| — of which outline duplicates | **1,546 (41%)** |
| Total scene triangles | 1,872,837 |
| — of which outline triangles | **919,822 (49%)** |
| Unique materials | 912 |
| Unique geometries | 2,094 |
| Triangles rendered per frame | 494,132 |

**Half the geometry in the world is outline.** For a stylised browser game
targeting mobile, 1,293 draw calls is roughly 4–6× a healthy budget, and the
bottleneck is CPU-side draw submission rather than triangle count.

The fix is a vertex-extrusion outline in a shader with **constant screen-space
thickness** — one extra material, no duplicate meshes, uniform ink weight at
every scale and distance. It solves the visual problem and the performance
problem with the same change.

### 3.2 No instancing for repeated props

912 unique materials and 2,094 unique geometries for a world containing 24
streetlamps, 3 benches, 2 postboxes, and repeated palms and trees. The `matCache`
only returns a cached material when no `extra` argument is passed, so most calls
mint a new one. Repeated props should be `InstancedMesh`; repeated materials
should be shared.

### 3.3 ACES tone mapping fights the palette

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
```

ACES is a photographic HDR curve: it desaturates saturated colour and rolls off
highlights. Applied to flat cel materials with an authored palette, it means the
terracotta and signal-yellow that were chosen in Blender are not the ones that
reach the screen — which is part of why the in-game look is muddier than the
preview renders. Worth A/B testing `NoToneMapping` (or `LinearToneMapping` with
exposure trim) and re-tuning the palette against the result.

### 3.4 Fog colour does not match the sky

```js
scene.fog = new THREE.Fog(VOID_COLOR, 36, 124);   // VOID_COLOR = 0x88c6c3, teal
```

but the sky dome grades to `0xf2e2bd` — warm sand — at the bottom. Distant
geometry therefore fades toward teal in front of a sand-coloured horizon. Objects
do not melt into the sky; they melt into a different colour, leaving a visible
seam exactly where the eye looks for depth. Fog colour needs to sample the sky
gradient, or the sky's lower stop needs to move to the fog colour.

### 3.5 Service props carry baked ground slabs — and are the least designed assets

`router-kit-v2`, `fibre-kit-v2`, and `wifi-kit-v2` each include a large
`Concrete` plate that, in silhouette, is the majority of the visual mass. The
kit itself reads as a small bump on a tray. Two problems: a flat slab fights
curved planet terrain, and the prop loses its read.

More importantly — **these are the assets the player looks at during the core
interaction.** The whole game is diagnosing this equipment. They are boxes and
cylinders on plinths, the least authored objects in the set. The detail budget is
inverted: background campuses got bespoke models, the hero gameplay props did
not.

### 3.6 Landmarks lean on painted text instead of form

`NUS`, `SMU`, `SUTD`, `NTU`, `KAMPUNG HAWKER`, `KAMPUNG CENTRAL`, `BUS STOP` are
painted onto façades and are doing the identification work that silhouette should
do. Text is the tell that a shape failed. At gameplay camera distance the text is
unreadable, so the landmark is unidentifiable.

Specific failures:

- **`mbs-v2`** — Marina Bay Sands is defined by curved towers and a cantilevered
  SkyPark. This is three straight slabs and a flat plank.
- **`bumboat-v2`** — reads as a bus. No hull, no prow, no waterline.
- **`mrt-v2`**, **`airport-terminal-v2`** — open boxes with canopies.
- **`merlion-v2`** — interestingly, this one reads *better* in flat black than
  shaded. The mane and tail are in the geometry; the shading is losing them. This
  is a material and light problem, not a modelling one.
- **`landed-bg-v2`**, **`hdb-bg-v2`** — large unbroken faces, which the bible
  explicitly forbids.

### 3.7 Characters are the weakest hero assets

`courier` and `engineer-v2` share 71% of their silhouette and are stiff and
blocky. The bible asks for "head and hands slightly oversized; clear posture and
tool silhouette before facial detail" — neither delivers that. The player looks
at this character for the entire session; it should be the most characterful
thing in the game, and currently the neighbourhood cat has more personality.

---

## 4. Tier 3 — process

### 4.1 Approval renders do not show the shipped look

The 38 preview PNGs in `assets/previews/` are soft PBR studio renders on a grey
slab, with **no ink outlines and no toon ramp**. They are the opposite of the
in-game look. An artist approving a model from these has no information about how
it will actually appear, which is a direct cause of the drift in section 2.2.

There are also no turnarounds, no scale references, and no silhouette views. Each
preview is framed to fill its tile, so `cat-v2` and `airport-terminal-v2` occupy
the same visual footprint and relative scale cannot be judged.

### 4.2 Frame and UX polish

- **The compass parks mid-screen.** It is built as an off-screen direction
  indicator but renders in the middle of empty sky rather than anchored to the
  screen edge on the bearing of the target.
- **No scrim behind modals.** The world keeps full contrast behind the diagnosis
  panel and competes with it.
- **The completion screen is emotionally flat.** After restoring six neighbours'
  service, the payoff is a small card with a number — no per-call breakdown, no
  competency read-out, and nothing changes in the world. The `RESTORED` stamp is
  the only moment of delight and it deserves company.
- The completion `✓` is a raw system-font glyph in a hand-drawn context.

---

## 5. Change plan

Ordered so that cheap global wins land before expensive per-asset work, and so
that nothing is re-authored before the standard it must meet exists.

### Phase A — Lock the bible (about 1 week)

Nothing else should be modelled until this exists.

- [ ] Collapse 81 material names to a **canonical palette of 12–16**, each with
      one hex, and write it into `ART-DIRECTION.md` as the single source of truth.
- [ ] Build a **shared Blender material library** (linked datablocks) that every
      asset appends from, so a palette change propagates instead of being retyped.
- [ ] Add a **CI palette check** that parses every GLB and fails on any material
      name outside the canon or any name bound to more than one hex. The tooling
      to read GLB materials is ~20 lines; the check is what stops the drift
      returning.
- [ ] Rename the `Singtel *` materials as part of the same pass.

### Phase B — Fix the frame (about 1 week, highest visible return)

Global render fixes that improve every frame without touching a single model.

- [ ] **Clouds:** raise the orbit to roughly `R + 18` to `R + 30`, shrink puff
      radii, drop `transparent`, and consider putting them on a layer the
      gameplay camera does not render at close range.
- [ ] **Fog/sky:** match fog colour to the sky's horizon stop.
- [ ] **Tone mapping:** A/B `NoToneMapping` against ACES and re-tune the palette
      to whichever is kept.
- [ ] **Compass:** anchor to the screen edge on the target bearing.
- [ ] **Modal scrim:** dim and slightly desaturate the world behind panels.

### Phase C — Outline and performance rework (1–2 weeks)

- [ ] Replace inverted-hull child meshes with a **shader outline using
      constant screen-space thickness**. Expected: mesh count down ~41%, scene
      triangles down ~49%, draw calls down substantially, and — the actual point
      — uniform ink weight at every scale.
- [ ] `InstancedMesh` for repeated props; share materials properly by fixing
      `matCache` to key on the full material description.
- [ ] Set a draw-call budget (target under 300) and enforce it in CI alongside
      the existing size budgets.

### Phase D — Re-silhouette the failures (3–4 weeks)

Work in priority order, because the list is longer than the budget.

1. **`condo-marina-v2` / `condo-holland-v2`** — two hero call destinations at
   88% IoU. Highest gameplay impact: the player navigates by these.
2. **The three service kits** — `router`, `fibre`, `wifi`. Remove the baked
   ground slabs, and give them the detail budget they deserve as the objects at
   the centre of the core loop.
3. **`courier` / `engineer-v2`** — the player character. Oversized head and
   hands, a real tool silhouette, distinct posture.
4. **The campus four** — give each one true massing: SMU low and city-embedded,
   NTU with a curved terraced roof, SUTD angular, NUS ridge-terraced. Then delete
   the painted labels and confirm they still read.
5. **`mbs-v2`** — curve the towers, cantilever the SkyPark.
6. **`bumboat-v2`** — give it a hull, a prow, and a waterline.
7. **`mrt-v2`**, **`airport-terminal-v2`** — a distinctive entrance form each.
8. **`merlion-v2`** — a shading and material pass, not a remodel.

**Acceptance for every item: it must be identifiable in flat black at gameplay
camera distance, with no painted text.**

### Phase E — One visual language for the UI (about 2 weeks)

- [ ] **Replace `Courier New` and `Trebuchet MS`.** Licence a display face with
      character for headings and a humanist sans for body copy, plus a decent
      mono if the docket metaphor is kept for numerals only. This is the single
      largest perceived-quality gain available in the interface.
- [ ] Extend the chit's **paper-and-ink treatment** to every panel: ink borders,
      slight rotation, torn or perforated edges, paper grain.
- [ ] **Re-style the portraits** to match the toon world, or replace them with
      rendered turnarounds of the actual 3D residents — which also removes a
      whole class of asset-provenance questions.
- [ ] **Rebuild the completion screen** as a real payoff: per-call breakdown,
      competency read-out, and a visible change in the world.
- [ ] Fold the "Missions" console into the same language, or remove it from the
      consumer shell as the commercialisation plan already recommends.

### Phase F — Process changes (ongoing, start immediately)

- [ ] **Re-render every preview through the game's own shader** — toon ramp, ink
      outlines, game key/rim lighting, on the game's ground colour. Approval
      artefacts must show the shipped look.
- [ ] Adopt a **reference-card format** per asset: 3/4 view, front elevation,
      flat-black silhouette, and a human scale figure in frame.
- [ ] Generate a **silhouette contact sheet in CI** and compute pairwise IoU
      across each asset family. Fail, or at least warn, above ~75% for assets in
      the same family. This is what would have caught the campus collapse before
      four models were built.

I have working scripts for the silhouette sheet, the IoU matrix, the material
inventory, and the scene-statistics probe used in this review; they can be
cleaned up into `scripts/` as the starting point for Phase F.

---

## 6. If only one week is available

In order of visible return per hour:

1. **Clouds, fog, and tone mapping** (Phase B) — every frame improves, no assets
   touched.
2. **Shader outline** (Phase C) — fixes the defining visual feature and roughly
   halves the geometry at the same time.
3. **Typography** (Phase E) — the biggest perceived-quality jump in the UI.
4. **Palette canon plus CI check** (Phase A) — stops the drift getting worse
   while the rest is decided.

Re-modelling is the expensive tier and should not start until Phase A gives it a
standard to hit.
