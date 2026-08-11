# 3D Singapore Collection

A standalone, editorial 3D catalogue for the 55 objects made for Kampung Call. Every product card uses a lazy-loaded WebGL viewer with auto-rotation, direct manipulation, zoom, animation playback where available, and a dedicated detail route.

The site also includes an anonymous community-submission workflow for Singapore 3D assets, receipt-based status and withdrawal, a password-protected moderation desk, D1 metadata storage, and R2 quarantine/publishing storage.

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

## Required hosted secrets

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

The database and object-storage bindings are declared in `.openai/hosting.json` as `DB` and `ASSET_BUCKET`.
