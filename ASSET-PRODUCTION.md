# Field Call — Completed 3D Asset Inventory

## Six call locations

| Call | Resident | Authored location asset | Service storytelling |
|---|---|---|---|
| Router installation | Kai | `landed-v2.glb` | Entry porch and installation zone |
| Optical fault | Uncle Lim | `kampung-call-v2.glb` | Fibre drop, splice box, veranda access |
| LAN link | Auntie Rosnah | `hdb-call-v2.glb` | Void deck, fibre riser, ONT and status LEDs |
| Wi-Fi survey | Devi | `condo-marina-v2.glb` | Lobby riser and access-point pair |
| Intermittent line | Mr Tan | `pointblock-call-v2.glb` | Line-test pedestal and fault loop |
| Mesh deployment | Sofia | `condo-holland-v2.glb` | Three mesh nodes and sky-garden terraces |

## Shared world assets

- `kopitiam-v2.glb` — dispatch hub, three stalls, seating and tray return
- `streetlamp-v2.glb` — 24 route-light replacements
- `postbox-v2.glb` — two neighbourhood postboxes
- `bench-v2.glb` — three planter benches
- `raintree-v2.glb` — hero tropical vegetation
- `service-van-v2.glb` — field van with wheel and beacon hooks
- `courier.glb` — rigged player character with Idle and Walk clips
- `residents/*.glb` — all six residents with Idle and Walk clips

## Pipeline

- Editable `.blend` source is stored beside every new GLB.
- Preview renders are in `assets/previews/` plus the two earlier hero previews in `assets/`.
- Static assets are joined by material and Draco-compressed before export.
- Procedural models remain as graceful fallbacks if a GLB cannot load.
- `kampung-call.html` scopes hero assets to their intended call location; background residences keep lightweight shared models.

## Transit pass

`blender/create_transit_assets.py` produces the optional `singapore-bus-v1` and
`mrt-train-v1` GLBs. The Three.js transit pass keeps a procedural fallback,
then replaces the bus instances and station train automatically when those
exports are present. The bus uses local `+Z` as forward and is instantiated
for routes 65, 97, and 143 without duplicating the base mesh.

## Priority 2–6 world pass

- Landmarks: `merlion-v2`, `mbs-v2`, `flyer-v2`, `supertree-v2`, `esplanade-v2`
- Neighbourhoods: `mrt-v2`, `shophouse-v2`, `hawker-v2`, `temple-v2`, `mamashop-v2`
- Infrastructure: `busstop-v2`, `overheadbridge-v2`, `controltower-v2`
- Background residences: `hdb-bg-v2`, `condo-bg-v2`, `landed-bg-v2`
- Ambient life: `palm-v2`, `cat-v2`, `bicycle-v2`, `birdcage-v2`, `bumboat-v2`
- Service equipment: `router-kit-v2`, `fibre-kit-v2`, `wifi-kit-v2`

## Complete export integration

All 51 GLB files in `assets/` are loaded by the game:

- 45 explicit asset-manifest references
- 6 dynamically loaded resident assets
- 0 unused GLBs and 0 missing paths

The eight superseded or combined exports are preserved as reduced-scale visible variants in the north-island archive ring. They do not replace the V2 production assets or overlap the six service-call locations.
