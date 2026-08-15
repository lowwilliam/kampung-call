# Kampung 3D Collection

A standalone, editorial 3D catalogue for 73 Singapore objects, places and people: 60 made for Kampung Call plus 13 research-led Lost Heritage reconstructions. Every product card uses a lazy-loaded WebGL viewer with auto-rotation, direct manipulation, zoom, animation playback where available, and a dedicated detail route.

The site also includes an anonymous community-submission workflow for Singapore 3D assets, receipt-based status and withdrawal, a password-protected moderation desk, D1 metadata storage, and R2 quarantine/publishing storage.

It now ships a versioned Asset API, the `kampung-assets` CLI and a local stdio MCP server for permission-aware asset search, upload, download and submission recovery. The public `/cli` route provides a visual quick-start; see [docs/ASSET-API.md](docs/ASSET-API.md) for the protocol reference.

## Local development

```bash
npm ci
npm run dev
```

`predev` and `prebuild` copy the canonical game models and Draco decoder from the parent Kampung Call project into generated public directories.

## Verification

```bash
npm test
```

Run the focused CLI and MCP protocol tests with `npm run test:tooling`.

## Required hosted secrets

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

The database and object-storage bindings are declared in `.openai/hosting.json` as `DB` and `ASSET_BUCKET`.
