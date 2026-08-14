# Canonical asset quality review — 14 August 2026

Scope: every asset referenced by the game manifest, resident list, and Lost
Heritage catalogue. Finder duplicates, `.blend1` backups, legacy aliases, and
untracked local exports are not release assets and were excluded.

Review gates: recognisable silhouette at catalogue-card distance, sane scale,
ground contact within 1 cm, category triangle budget, no more than four material
families, Draco compression, successful GLB load, and no visibly missing or
broken components in the common-lighting contact sheet.

Result: **68/68 pass**. The canonical set contains **369,886 triangles**, down
from 398,648; no asset is over budget, over the material limit, ungrounded, or
uncompressed. See `world/asset-audit.json` for decoded measurements and
`review-shots/assets-review-{before,after}.png` for the visual comparison.

| Asset | Result | Current metrics | Review note |
| --- | --- | ---: | --- |
| engineer | Pass | 3,588 tris · 3 mats | Rigged courier remains readable; animation hierarchy preserved. |
| engineerLegacy | Improved | 1,736 · 1 | Grounded legacy fallback without changing silhouette. |
| kopitiam | Pass | 7,848 · 1 | Roof, counter, and seating read clearly. |
| hdb | Pass | 3,788 · 1 | Background slab has a clean HDB massing silhouette. |
| hdbHero | Pass | 3,788 · 1 | Call-site block remains grounded and legible. |
| shophouse | Improved | 4,820 · 1 | Re-exported from source, grounded, palette-merged, and simplified conservatively. |
| mrt | Pass | 4,192 · 1 | Entrance portal and canopy remain distinct. |
| condo | Pass | 3,672 · 1 | Background tower proportions are stable. |
| condoMarina | Pass | 8,536 · 1 | Stepped twin-wing silhouette remains distinct. |
| condoHolland | Pass | 8,658 · 1 | Balcony rhythm and podium remain clear. |
| kampungHero | Improved | 8,074 · 1 | Grounded and reduced from the source export while retaining house/service details. |
| pointblockHero | Pass | 6,822 · 1 | Point-block vertical identity remains clear. |
| airportTerminal | Improved | 8,582 · 1 | Grounded and reduced from 24,400 tris; wave roof and jet bridges survive. |
| nationalUniversity | Improved | 14,192 · 4 | Grounded; material families reduced from 9 to 4. |
| technologicalUniversity | Improved | 28,904 · 4 | Hive pods retained; materials reduced from 6 to 4. |
| managementUniversity | Improved | 9,724 · 4 | Pearl library silhouette retained; materials reduced from 8 to 4. |
| designUniversity | Improved | 10,488 · 4 | Connected-campus ribbons retained; materials reduced from 7 to 4. |
| nationalSchool | Improved | 5,952 · 1 | Grounded and reduced from 16,984 tris; corridor rhythm remains visible. |
| landed | Pass | 1,272 · 1 | Background house reads cleanly. |
| landedHero | Pass | 8,356 · 1 | Porch, roof, and service box remain distinct. |
| raintreeHero | Pass | 336 · 2 | Strong low-poly canopy at a very low cost. |
| van | Pass | 2,878 · 1 | Vehicle silhouette and wheels remain clear. |
| postbox | Improved | 836 · 4 | Replaced triangle-heavy font mesh with an envelope motif; down from 7,380 tris. |
| bench | Improved | 1,054 · 1 | Source badge rebuilt without a font mesh; grounded and within prop budget. |
| harbourStatue | Pass | 4,314 · 1 | Lion/fish/water silhouette remains recognisable. |
| skypark | Improved | 3,736 · 1 | Corrected 1.37 m source-export ground offset. |
| flyer | Improved | 7,092 · 4 | Down from 13,972 tris and 6 materials; wheel, spokes, and capsules remain clear. |
| supertree | Pass | 1,068 · 1 | Flared trunk and canopy retain their identity. |
| concertHall | Pass | 2,600 · 1 | Twin domes remain recognisable. |
| hawker | Pass | 7,834 · 1 | Open hall and stall frontage remain clear. |
| temple | Pass | 1,796 · 1 | Layered roof silhouette is clean. |
| mamashop | Pass | 2,984 · 1 | Awning and storefront remain readable. |
| peranakan | Pass | 12,672 · 2 | Narrow pastel façade and five-foot way remain detailed. |
| kampongHouse | Improved | 11,620 · 2 | Corrected source-export ground offset; house details retained. |
| hdbVoiddeck | Pass | 15,464 · 1 | Void-deck columns and residential massing remain legible. |
| kampongProps | Improved | 9,016 · 1 | Grounded while preserving 63 named, reusable child meshes. |
| sultanMosque | Pass | 13,912 · 1 | Dome, minarets, and arcade remain distinct. |
| wetmarket | Improved | 12,934 · 2 | Grounded and reduced from the 35,704-triangle source export; stalls remain intact. |
| busstop | Improved | 1,980 · 4 | Now within prop budget; materials reduced from 10 to 4 and ground corrected. |
| overheadbridge | Pass | 48 · 3 | Deliberately minimal silhouette is adequate at world scale. |
| controltower | Pass | 1,964 · 1 | Shaft and cab read clearly. |
| palm | Pass | 1,667 · 3 | Curved trunk and fronds remain distinct. |
| cat | Improved | 1,492 · 4 | Down from 5,464 tris; low-poly face, paws, ears, and tail remain readable. |
| bicycle | Improved | 1,812 · 4 | Down from 7,892 tris and 7 materials; wheels, frame, and basket remain intact. |
| birdcage | Improved | 1,992 · 4 | Down from 9,456 tris and 9 materials; cage bars, bird, and hanger survive. |
| bumboat | Pass | 2,840 · 1 | Hull, cabin, and canopy remain recognisable. |
| serviceRouter | Improved | 1,732 · 4 | Down from 4,932 tris and 10 materials; router, antennas, cable, and toolkit remain. |
| serviceFibre | Pass | 1,316 · 1 | ONT and meter kit remain clear. |
| serviceWifi | Pass | 1,632 · 1 | Mesh nodes and analyser remain clear. |
| resident:uncle-lim | Pass | 4,800 · 1 | Rig and character silhouette preserved. |
| resident:auntie-rosnah | Pass | 5,980 · 1 | Rig and character silhouette preserved. |
| resident:devi | Pass | 5,008 · 1 | Rig and character silhouette preserved. |
| resident:mr-tan | Pass | 4,908 · 1 | Rig and character silhouette preserved. |
| resident:kai | Pass | 4,900 · 1 | Rig and character silhouette preserved. |
| resident:sofia | Pass | 5,224 · 1 | Rig and character silhouette preserved. |
| lost-comcentre | Improved | 1,980 · 3 | Palette consolidated from 7 materials; tower frame and dishes retained. |
| lost-national-theatre | Improved | 1,252 · 4 | Palette consolidated from 6; five-point façade retained. |
| lost-national-library-stamford | Improved | 1,288 · 3 | Palette consolidated from 7; brick massing and stair remain clear. |
| lost-van-kleef-aquarium | Improved | 1,512 · 4 | Palette consolidated from 7; low horizontal aquarium form retained. |
| lost-former-national-stadium | Improved | 8,132 · 4 | Palette consolidated from 7; bowl, roof, and floodlights retained. |
| lost-pearl-bank-apartments | Improved | 11,936 · 3 | Palette consolidated from 5; horseshoe tower and façade rhythm retained. |
| lost-tanglin-shopping-centre | Improved | 1,212 · 4 | Palette consolidated from 6; podium and slab remain distinct. |
| lost-amber-mansions | Improved | 7,720 · 4 | Palette consolidated from 4/duplicate families; gables and arcades retained. |
| lost-eu-court | Improved | 6,336 · 4 | Palette consolidated from 6; corner tower and arcades retained. |
| lost-alkaff-arcade | Improved | 9,477 · 4 | Palette consolidated from 7; domes, passage, and galleries retained. |
| lost-beauty-world-market | Improved | 1,664 · 4 | Palette consolidated from 6; market lane and stall rows retained. |
| lost-tang-dynasty-city | Improved | 1,400 · 4 | Palette consolidated from 6; gate, roofs, walls, and pagoda retained. |
| lost-tank-road-railway-station | Improved | 1,544 · 4 | Palette consolidated from 8; clock tower, platform, and tracks retained. |

## Pipeline changes made during the review

- Blender static exports now follow one reproducible sequence: raw GLB, decoded
  ground-centering, material palette/join optimization, optional conservative
  simplification, and final Draco compression.
- Hierarchy-sensitive kits use a separate path that retains named nodes and
  performs ground-centering after hierarchy cleanup.
- The world audit now decodes Draco geometry before measuring bounds, instead
  of trusting potentially stale accessor metadata.
- The canonical asset review page renders every manifest entry with identical
  camera, lighting, and ground treatment for repeatable visual comparison.
- The Management University placement moved about 1.4 m along the world
  surface so its audited footprint keeps at least 3 m clear of both the Flyer
  and VOIDDECK, without changing the model scale.
