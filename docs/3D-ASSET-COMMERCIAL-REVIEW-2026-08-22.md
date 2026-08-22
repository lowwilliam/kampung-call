# 3D Asset Commercial Readiness Review — 2026-08-22

Full review of all shipping GLB assets (`assets/*.glb`, `assets/residents/*`,
`assets/lost-heritage/*`): technical audits, geometry-health audit,
pixel-level render analysis, and targeted repairs.

## Executive summary

| Area | Result |
|---|---|
| World audit (strict) | **PASS** — 75 assets, 902,931 triangles, 0 unreferenced |
| Geometry health | **PASS** — all degenerate slivers removed or documented |
| Pixel render analysis | **PASS** — 0 black-patch/inverted-normal suspects in 300 renders |
| Project test suite | **PASS** — validate, performance, format, build, visibility |
| Catalogue integrity | Refreshed; affected records returned to draft review |
| Rights/release gates | Unchanged by design — require product-owner evidence |

## Repairs made

### alfa-romeo-giulia-spider-v2 (was failing 4 audit rules)
- Restored the complete 203-part model from the shipped GLB (the `.blend`
  source had silently lost 40 parts: grille frame, seat pleats, bumpers,
  exhaust, gear lever).
- Decimated 98,116 → 32,658 triangles (hero budget 35,000) with collapse
  decimation; all named parts retained.
- Consolidated 15 generator materials → 7 catalogue families
  (Car paint / Bright metal / Tire rubber / Oxblood leather / Cabin black /
  Glazing / Lamp and plate red).
- Grounded to min-Z = 0; Draco-compressed export.
- File size 2.27 MB → 412 KB (-82%); dist bundle picks up the smaller asset.

### Geometry hygiene pass (20 assets)
Blender batch cleanup (`blender/cleanup_asset_geometry.py`) applied to every
asset flagged by the geometry-health audit:
- Removed zero-area degenerate faces (up to 384 per asset, e.g. flyer-v2).
- Welded micro-cracks (≤1e-5) left by boolean operations.
- Recalculated outward normals only on watertight closed shells with negative
  signed volume (decimation fallout on the Alfa).
- Assets touched: alfa, bench, busstop, condo-marina, design-university,
  flyer, hawker, hdb-call, kopitiam, management-university, national-university,
  postbox, router-kit, satellite-station, skypark-hotel,
  technological-university, wetmarket, alkaff-arcade, comcentre.

Rigged characters (courier, residents) were excluded from automated passes.

### Repository hygiene
- Deleted 10 conflict-copy duplicates ("* 2.blend") whose originals exist,
  plus 4 Blender autosave files (`.blend1`).
- Archived 16 superseded-generation blend sources with no canonical output to
  `research/archive-superseded-blends/` (hero-neighbourhood, condo, hdb,
  landed, mrt, kopitiam, universities, merlion, esplanade, mbs, streetlamp…).

## Tooling added (repeatable)

| Tool | Purpose |
|---|---|
| `blender/render_review_views.py` | Deterministic 4-view studio renders per GLB |
| `scripts/make-review-sheets.py` | Labeled 2×2 contact sheets for review |
| `blender/audit_asset_health.py` | Degenerate faces, flipped normals, non-manifold edges, duplicate instances, floating parts, placeholder materials |
| `scripts/analyze-review-pixels.py` | Render pixel analysis: enclosed-background holes, black-patch share, placeholder-grey share, colorfulness |
| `blender/rebuild_alfa_from_glb.py`, `optimize_alfa_for_catalogue.py`, `reexport_alfa_glb.py`, `cleanup_alfa_materials.py` | Alfa budget rebuild pipeline |
| `blender/cleanup_asset_geometry.py` | Conservative geometry cleanup batch |

Review artifacts: `review-shots/commercial-review/` (300 renders, 75 sheets,
geometry-health.json, pixel-health.json).

## Known limitations & follow-ups

1. **AI-vision review unavailable** — no image-capable model is reachable in
   this session (parent and subagents included). Visual verdicts were therefore
   produced only by objective pixel/geometry analysis. A human or vision-model
   pass over `review-shots/commercial-review/sheets/` is recommended before
   public release; the sheets are ready for it.
2. **Negative-volume warnings** remain on open-shell surfaces (canopies,
   awnings) in amber-mansions, beauty-world-market, comcentre, tang-dynasty-city
   and 6 Alfa parts — ambiguous sign on non-watertight shells; previously
   human-reviewed; no black-patch rendering detected.
3. **Residual slivers**: hdb-call-v2 (3) and wetmarket-v2 (1) sub-millimetre
   n-gons cannot be removed without deleting real geometry. Invisible and
   negligible.
4. **Catalogue release gates unchanged**: records touched by the repair pass
   were honestly reset to draft by `refresh-catalogue-integrity.mjs`.
   Release still requires product-level inputs (productionDomain,
   correctionsEmail, publishedAt, per-asset evidence hashes, person releases).
   Run `npm run legal:release` to see the full list.
5. **Environment fix needed (one line)**: `~/.npm` contains root-owned files;
   `npm pack` fails until you run:
   `sudo chown -R $(id -u):$(id -g) ~/.npm`
   Session workarounds used a temp cache. `sync-game-assets.mjs` was patched
   to run `npm pack` from inside the package folder (robust against this).

## Verification commands

```sh
npm run validate          # PASS
npm run audit:world -- --strict   # PASS
npm test                  # PASS (incl. build + visibility)
```
