# Singapore nature and transit asset delivery

Date: 2026-08-15  
Requested branch: `singapore-wildlife-cablecar-assets`  
Method: reference admission → strict img2threejs sculpt spec → procedural Three.js → Blender CLI repair/refinement → eight-angle review → Draco GLB → Catalogue Manifest

## Library assets

| Asset | Editable source | Browser GLB | Triangles | Materials | AI comparison | Orbit gate |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Smooth-coated Otter | `assets/smooth-coated-otter-v1.blend` | `assets/smooth-coated-otter-v1.glb` | 17,560 | 4 | 0.75 | no degenerate view |
| Red Junglefowl | `assets/red-junglefowl-v1.blend` | `assets/red-junglefowl-v1.glb` | 19,600 | 8 | 0.74 | no degenerate view |
| Oriental Pied Hornbill | `assets/oriental-pied-hornbill-v1.blend` | `assets/oriental-pied-hornbill-v1.glb` | 9,264 | 5 | 0.72 | no degenerate view |
| Clouded Monitor | `assets/clouded-monitor-v1.blend` | `assets/clouded-monitor-v1.glb` | 28,764 | 3 | 0.74 | no degenerate view |
| Singapore Cable Car SkyOrb | `assets/singapore-cable-car-skyorb-v1.blend` | `assets/singapore-cable-car-skyorb-v1.glb` | 29,788 | 5 | 0.82 | no degenerate view |

The monitor's reference-led Three.js source contained 60,248 triangles. Blender CLI decimation reduced the relief-heavy model to 28,764 triangles while retaining the spot system and silhouette. The SkyOrb received manufactured-edge bevels plus metallic/roughness tuning in Blender. All imported meshes received duplicate-weld, normal repair and organic smoothing where applicable.

## Evidence and limitations

- `RESEARCH.md` records the source provenance, factual cues and admission decisions.
- `intake-analysis.md` records macro-to-micro image analysis and hidden-view assumptions.
- `specs/*-sculpt-spec.json` contain strict complex-tier specifications and eight completed review gates.
- `reviews/comparisons/` contains the full reference/render pairs used for AI-vision scoring.
- `reviews/final/*-contact.png` contains front, rear, left, right, top, bottom and two three-quarter views for each asset.
- The assets are stylised real-time reconstructions, not photogrammetry. Hidden anatomy, feather overlap and inaccessible mechanical surfaces remain explicitly approximate.
- The SkyOrb is unbranded and remains in draft/legal-review status for display; catalogue downloads fail closed until rights are cleared.

## Verification

- All five sculpt specs: strict quality `PASS`; pipeline `complete` with 8/8 passes.
- All five GLBs: readable after Draco compression with `KHR_draco_mesh_compression` declared.
- Catalogue Manifest: 73 draft records validated; models and previews checksum-bound and synced.
- Showcase: build complete; 25/25 tests passed.
- Root project validation: passed.
