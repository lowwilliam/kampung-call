# Kampung 3D Collection

A standalone, draft editorial 3D catalogue for 74 Singapore-connected objects, places and people: 61 game/wildlife/transit assets plus 13 research-led Lost Heritage reconstructions. Every product card uses a lazy-loaded WebGL viewer with auto-rotation, direct manipulation, zoom, animation playback where available, and a dedicated detail route.

Community submissions, moderation mutations, reports, receipts, and likes are retired. Historical community inventory is read-only; the public catalogue does not fingerprint visitors for interactions.

It ships a versioned read-only Asset API, the `kampung-assets` CLI and a local stdio MCP server for permission-aware asset search and grant-controlled download. The public `/cli` route provides a visual quick-start; see [docs/ASSET-API.md](docs/ASSET-API.md) for the protocol reference.

Production builds fail closed until every manifested asset passes the legal-release validator. Use `npm run build:preview` only for local draft review. See [`../docs/LEGAL-RISK-REVIEW-2026-08-15.md`](../docs/LEGAL-RISK-REVIEW-2026-08-15.md).

## Local development

```bash
npm ci
npm run dev
```

`predev` and `build:preview` copy the canonical game models, notices, and Draco decoder from the parent Kampung Call project into generated public directories.

## Verification

```bash
npm test
npm run catalogue:readiness
```

Run the focused CLI and MCP protocol tests with `npm run test:tooling`.

`catalogue:readiness` groups the production blockers by accountable review
instead of treating repeated per-asset messages as separate projects. For the
complete asset lists, run `npm run catalogue:readiness -- --json`.

Card previews are generated deterministically from the current manifested GLBs:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python ../scripts/blender/render-catalogue-card-previews.py
npm run catalogue:accept-previews
npm run catalogue:accept-previews -- --write
```

The first acceptance command verifies that all 74 images exist. Use `--write`
only after reviewing the complete set; it binds each accepted image to the
current model checksum and keeps the publication record in draft.

## Required hosted secrets

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

The database and object-storage bindings are declared in `.openai/hosting.json` as `DB` and `ASSET_BUCKET`.
