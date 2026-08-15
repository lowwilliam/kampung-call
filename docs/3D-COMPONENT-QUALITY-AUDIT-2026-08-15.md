# 3D Component Quality Audit — 15 August 2026

## Outcome

All 73 versioned GLBs pass the final runtime and component-readiness gates.

| Gate | Before | After |
|---|---:|---:|
| Runtime-ready | 65 / 73 | 73 / 73 |
| Component-ready | 47 / 73 | 73 / 73 |
| Ground/origin failures | 8 | 0 |
| Complex flattened assemblies | 21 | 0 |
| Unreferenced versioned GLBs | 5 | 0 |
| Over-budget world assets | 0 before structural re-export; 5 during source rebuild | 0 |

The strict world audit reports 73 assets, 843,432 triangles, zero unreferenced GLBs,
and no geometry, material-family, grounding, or Draco-compression failures.

## What “ready” means here

- Imports successfully as a GLB with non-degenerate volume and at least one material.
- Uses a ground-contact origin within the review tolerance; the encoded glTF Y-up bound is
  independently checked to 1 cm by the release audit.
- Complex assets expose multiple named mesh nodes instead of one fused selectable lump.
- Parts remain separate through palette atlasing, Draco compression, and budget simplification.
- Holds a readable silhouette in front, side, three-quarter, and top views.
- Fits the applicable browser triangle and material-family budget.

This proves runtime and assembly structure. It does not prove that every hidden elevation is
historically exact. The thirteen Lost Heritage models remain explicitly procedural,
research-led approximations where references do not cover inaccessible or demolished sides.
The `engineer-legacy` asset is intentionally a simple documented prototype, not the current
hero character; its production replacement is the rigged `courier.glb`.

## Corrective work

1. Re-exported 23 complex Blender sources with a component root, named selectable nodes,
   ground contact, and component metadata. This removed the flattened-monolith failures.
2. Rebuilt `landed-v2`, `service-van-v2`, `engineer-v2`, and `raintree-v2` from their
   procedural source so their runtime files retain useful part boundaries.
3. Reworked `raintree-v2` from an overlapping canopy blob into seven separated three-tone
   canopy masses supported by visible left, right, and rear scaffold limbs.
4. Applied component-safe palette atlasing without flattening or joining nodes. The five
   dense hero sources were simplified per part; `hdb-call-v2` uses export-time decimation
   to stay below its 35k-triangle budget while preserving 16 selectable mesh nodes.
5. Added the five catalogue-only Singapore wildlife/SkyOrb models to the release audit,
   normalized their ground pivots, and preserved their hierarchies through compression.
6. Refreshed catalogue checksums, byte lengths, model metrics, and preview provenance after
   the GLB bytes changed. Affected records correctly returned to draft review status.

## Visual review

The retained evidence is deliberately compact; the full 292-frame render batch is reproducible
with `scripts/blender/audit-3d-components.py`.

- `review-shots/3d-component-review/root-assets-sheet.png` — 54 primary collection assets.
- `review-shots/3d-component-review/lost-heritage-sheet.png` — 13 Lost Heritage assets.
- `review-shots/3d-component-review/residents-sheet.png` — six resident characters.
- `review-shots/3d-component-review/hdb-call-v2-orbit.png` — post-decimation hero-kit orbit.
- `review-shots/3d-component-review/raintree-v2-orbit.png` — corrected canopy/branch orbit.
- `review-shots/3d-component-review/audit.json` — per-asset geometry and readiness evidence.

The final contact sheets show a coherent stylized diorama language: clean silhouettes,
restrained rough materials, readable local details, and no collapsed planes, incoherent surface
noise, accidental photobashing, or obvious generated-geometry artifacts. The collection is
stylized and selectively low-poly; that is intentional art direction, not a claim of photorealism.

## Verification

- `npm run audit:world -- --strict` — pass, 73 assets.
- `npm run validate` — pass.
- `npm run test:performance` — pass.
- `npm run format:check` — pass.
- `npm run build` — pass.
- `npm run test:unit` — 11 / 11 pass.
- `npm run catalogue:validate` — 73 draft records pass.
- `npm test` in `showcase/` — build pass, 24 / 24 tests pass.
- Blender component audit — 73 / 73 runtime-ready and 73 / 73 component-ready.

## Reproduction

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/blender/audit-3d-components.py -- \
  --output review-shots/3d-component-audit --size 320

/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/blender/reexport-component-assets.py

/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/blender/rebuild-hero-components.py

node scripts/optimize-component-glbs.mjs
npm run audit:world -- --strict
```
