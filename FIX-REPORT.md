# Kampung Call branch work report

The four requested work items were implemented on separate `codex/` branches.

| Item | Branch / commit | Result | Evidence |
| --- | --- | --- | --- |
| Transit bus scale and terrain seating | `codex/fix-transit-bus` / `0411af2` | Rebuilt the procedural bus around the authored 11 m × 2.5 m × 3.2 m scale, restricted parked buses to suitable road links, and aligned transit vehicles to sampled terrain frames. | `npm run test` passed; browser transit audit reports the expected bus dimensions and no seating/ground-clearance failures. |
| De-brand real-world entities and assets | `codex/debrand-real-world-entities` / `c6e4bce` | Replaced named real-world entity and asset identifiers with fictional/generic equivalents, renamed the asset files, and added a validation denylist for legacy names. | `npm run test` passed; world audit includes a legacy-brand scan. |
| 3D asset visibility and placement | `codex/audit-3d-asset-visibility` / `f5548f2` | Added required/optional asset load outcomes, building-footprint sink/float audits, fog/camera/shadow checks, and a headless visibility verification command. | Headless verification: required asset failures 0, optional fallbacks 2, building footprints checked 55 with sink/float conflicts 0. |
| Island River building clearance | `codex/enforce-river-building-clearance` | Registered the authored river centerline as a sampled clearance corridor, included its width and verge in building-water audits, moved conflicting non-waterfront anchors, and re-ran the audit after river creation. | Browser state: route samples 1,391 blocked 0; building spacing checked 55 with crowded 0; water checked 50 with wet 0. |

The original unrelated working-tree files (`CODEX-FIX-PROMPT.md` and the generated `world/asset-audit.json` changes) were left outside the Task 4 commit.
