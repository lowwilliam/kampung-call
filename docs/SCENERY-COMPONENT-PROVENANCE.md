# Scenery Component provenance

Status: initial registry implemented on 2026-08-13.

The game has 20 scenery slots configured for optional models from `threejsassets.com`. These slots are not members of the 68-item Collection. Each slot has two mutually exclusive Source Variants:

- `kampung-call-procedural-fallback`: first-party procedural Three.js geometry used when the configured vendor GLB is unavailable.
- `threejsassets-licensed-glb`: the vendor model used and credited only after its configured file loads successfully. It must not be redistributed as a standalone Collection download.

The repository currently contains no vendor GLBs under `assets/vendor/threejsassets`; therefore the current checked-in game uses the first-party fallback variant for all 20 slots. The configuration is not evidence that a vendor model was delivered to a Visitor.

| Component key | Display name | Vendor file | Fallback implementation | Tier |
| --- | --- | --- | --- | --- |
| `cityTrafficLight` | City traffic light | `city/traffic-light-01.glb` | `buildTrafficSignal` | Free |
| `cityRoadGantry` | City road gantry | `city/road-gantry-01.glb` | `buildRoadGantry` | Premium |
| `cityRooftopUnits` | City rooftop units | `city/rooftop-units-01.glb` | `buildRooftopUnits` | Premium |
| `cityTrashBin` | City trash bin | `city/trash-bin-01.glb` | `buildBin` | Free |
| `cityDeliveryVan` | City delivery van | `city/delivery-van-01.glb` | `buildDeliveryVan` | Premium |
| `cityBus` | City bus | `city/city-bus-01.glb` | `buildIslandBus` | Premium |
| `viceCafeTableChairs` | Café table and chairs | `vice-beach/cafe-table-chairs.glb` | `buildCafeTable` | Free |
| `viceRoyalPalm` | Royal palm | `vice-beach/royal-palm.glb` | `buildPalmVariant('royal')` | Free |
| `viceCoconutPalm` | Coconut palm | `vice-beach/coconut-palm.glb` | `buildPalmVariant('coconut')` | Free |
| `viceMarinaDock` | Marina dock module | `vice-beach/marina-dock-module.glb` | `buildMarinaDock` | Free |
| `viceMooringPilings` | Mooring piling cluster | `vice-beach/mooring-piling-cluster.glb` | `buildMooringPilings` | Free |
| `viceBoardwalk` | Straight boardwalk | `vice-beach/boardwalk-straight.glb` | `buildBoardwalk` | Free |
| `viceShoreStraight` | Straight shoreline | `vice-beach/shore-straight.glb` | `buildShorePiece('straight')` | Free |
| `viceShoreCornerIn` | Inner shoreline corner | `vice-beach/shore-corner-in.glb` | `buildShorePiece('corner-in')` | Free |
| `viceShoreCornerOut` | Outer shoreline corner | `vice-beach/shore-corner-out.glb` | `buildShorePiece('corner-out')` | Free |
| `metroTransformerKiosk` | Transformer kiosk | `metropolis/transformer-kiosk-01.glb` | `buildTransformerKiosk` | Premium |
| `metroUtilityVentCabinet` | Utility vent cabinet | `metropolis/utility-vent-cabinet-01.glb` | `buildUtilityCabinet` | Premium |
| `metroServiceGate` | Service gate | `metropolis/service-gate-01.glb` | `buildServiceGate` | Premium |
| `metroBusBay` | Road bus bay | `metropolis/road-bus-bay-straight-01.glb` | `buildRoadServiceTile('BUS BAY')` | Premium |
| `metroLoadingZone` | Road loading zone | `metropolis/road-loading-zone-straight-01.glb` | `buildRoadServiceTile('LOADING')` | Premium |

The machine-readable source is `world/vendor-assets.json`. At runtime, `window.__vendorAssetAudit.sourceVariants` records the actual active variant per slot; a component switches to `threejsassets-licensed-glb` only in the successful GLB load path.
