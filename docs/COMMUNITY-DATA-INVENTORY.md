# Community data inventory

Status: local inventory complete; hosted inventory pending. No data has been deleted.

Inventory date: 2026-08-13
Scope: Collection Community submissions, models, reports, likes, receipts, moderation, authentication, and bindings.

## Local findings

The local Miniflare D1 database contains the expected `submissions`, `reports`, `audit_events`, and `likes` tables. A read-only count found zero rows in every table. The local Miniflare R2 metadata database has no object table and no locally recorded objects.

The repository retains the legacy schema and storage helpers for recovery, but active public and administrator routes have been made read-only:

- D1 binding `DB` and R2 binding `ASSET_BUCKET` in `.openai/hosting.json` and the Worker environment.
- Public submission, like, report, Community model, and legacy write routes return `410 Gone`; historic receipt lookup remains read-only.
- Password/session-protected administration exposes inventory reads only; publication, editing, moderation, deletion, runtime schema initialisation, and automatic retention purge are disabled in active routes.
- D1 migrations and runtime schema creation for `submissions`, `reports`, `audit_events`, and `likes`.
- Dormant R2 upload, publication, and retention-deletion helpers remain in source until the hosted inventory and deletion manifest are approved.
- CLI, MCP, and the shared Asset Client expose only read-only catalogue discovery and grant-controlled download capabilities.
- Potential personal or sensitive fields: contributor name, LinkedIn URL and display consent, source URL, receipt hash, submitter fingerprint, reporter name, administrator notes, audit details, IP-derived fingerprint input, and administrator secrets.

## Hosted inventory still required

The repository configuration proves that hosted bindings are expected, but it does not prove whether the deployed D1 database or R2 bucket contains real Contributor data. Before any destructive migration, an authorised operator must record:

- Deployment/environment name and immutable inventory timestamp.
- Row counts by status for all four D1 tables without exporting personal field values into this repository.
- R2 object count and total bytes grouped by private submission and public model prefixes.
- Active write routes, CLI/MCP clients, scheduled retention jobs, and recent write activity.
- Presence and owner of `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, D1, and R2 bindings without recording secret values.
- Required legal/operational retention per field, evidence owner, retention end, and deletion method.

## Deletion-manifest gate

Do not remove D1 rows, R2 objects, secrets, bindings, routes, migrations, or audit records until the hosted inventory is complete and the deletion manifest is approved. The deletion manifest must identify every target, retention exception, recovery/rollback window, verifier, and post-deletion proof. Until then, implementation may make the new Catalogue read-only and stop new writes, but the legacy storage must remain recoverable.
