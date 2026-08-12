# Collection Site Reconciliation Plan

## Objective

Make the public 3D Singapore Collection reflect the approved catalogue order,
controls, and latest canonical GLB assets from the game repository. The release
must be reproducible from one branch and verifiable against the exact files
served by the public site.

## Diagnostic summary

The collection currently has three diverged source states:

1. `origin/main` contains the game and its latest rendering changes, but not the
   collection website.
2. `showcase/` contains the newer collection interface and catalogue logic.
3. The Sites hosting repository has additional API/tooling work, while the
   public deployment still behaves like an older saved version.

This explains the visible mismatch:

- The public site lists People first, includes `Download all`, and has no
  interactive globe.
- The newer collection source already sorts People last, removes bulk download,
  and renders `CollectionGlobe` in the right side of the hero.
- The newer source was saved as later site versions but was not deployed to the
  public URL.
- Eleven revised canonical GLBs are present only as uncommitted working-tree
  files. The public university-model hashes match the old committed GLBs, not
  the revised files.
- Generated `showcase/public/models/` files are ignored. A local sync can look
  correct without making the same asset bytes part of a reproducible release.
- Duplicate files with suffixes such as ` 2` and legacy short names such as
  `nus-v2.glb` make it easy to audit or package the wrong file unless canonical
  names are enforced.

## Source-of-truth rules

1. The game repository's canonical `assets/` paths are the source of truth for
   original collection models.
2. `world/asset-audit.json` must be regenerated from those exact canonical GLBs
   after model changes and before the collection build.
3. `showcase/` is the canonical collection application. Hosting-only source
   changes must be reconciled back into `showcase/` before the next release.
4. A release archive must be built from the same commit that is pushed and
   saved as a site version.
5. Deployment verification must compare public model hashes and public HTML
   behaviour with that release commit.

## Implementation plan

### Phase 1 — Reconcile the asset set

1. Inventory every modified and untracked GLB and classify it as canonical,
   legacy alias, duplicate, or unrelated experiment.
2. Confirm the 11 revised canonical GLBs, including the four university models,
   are the intended final files.
3. Keep canonical filenames stable unless the catalogue and game manifest are
   migrated together.
4. Regenerate the world audit from the revised canonical files and review size,
   dimensions, ground contact, triangle budget, materials, and compression.
5. Commit the approved GLBs, their source `.blend`/generator changes, previews,
   and the regenerated audit together.

### Phase 2 — Reconcile the collection application

1. Bring the hosting repository's newer API, submission, and tooling changes
   back into `showcase/` so there is one maintainable application source.
2. Preserve the approved catalogue behaviour:
   - iconic objects first;
   - all People entries at the back;
   - no bulk-download control or bulk-download archive;
   - individual download only where permission allows it;
   - interactive globe in the right-hand hero area on desktop;
   - responsive globe placement on smaller screens;
   - a clear `Move the globe` interaction label.
3. Run the asset sync only after the canonical GLBs and audit are finalized.
4. Build a release from the reconciled branch, not from an independent hosting
   checkout or an ignored local asset snapshot.

### Phase 3 — Add release gates

Add automated checks that fail the release when any of these contracts break:

1. Every original catalogue entry resolves to one canonical GLB.
2. The release contains the same SHA-256 hash as the canonical GLB for all
   original assets.
3. All People cards appear after every non-People card.
4. Server-rendered HTML contains no `Download all` control or bulk archive URL.
5. Original-model detail pages retain the permitted individual download.
6. The collection hero renders the globe and its interaction label.
7. Desktop and mobile layouts pass a focused visual review of the hero, first
   catalogue row, People tail, and one university detail page.

### Phase 4 — Publish once and verify the public URL

1. Push the exact validated release commit to the hosting source.
2. Save one site version from its packaged build.
3. Publish that version after explicit public-deployment approval.
4. Verify the public page order, absence of bulk download, globe interaction,
   and hashes of all revised GLBs.
5. Record the deployed version, commit, and verification result in the release
   notes.

## Acceptance criteria

- The public site serves the revised hashes for all 11 changed canonical GLBs.
- The four revised university models load and frame correctly in their cards
  and detail views.
- The first People card appears only after the last non-People card.
- `Download all` is absent everywhere; no public bulk archive is produced.
- The interactive globe is visible at the right of the desktop hero and remains
  usable on touch/mobile layouts.
- The live public site matches the validated branch commit rather than an older
  saved deployment.

## Recommended commit sequence

1. `chore: reconcile canonical asset inventory`
2. `feat: publish revised collection models`
3. `refactor: unify collection and hosting source`
4. `test: enforce collection release contracts`
5. `fix: finalize collection ordering and globe placement`

