# Kampung Call city-planning system

The island uses one shared `ROAD_NETWORKS` model for the 3D world, vehicle placement and navigation checks. New districts should connect to this model rather than adding isolated path strips.

## Road hierarchy

| Class | Purpose | Visual treatment |
| --- | --- | --- |
| Expressway | Cross-island and coastal movement between major capability districts | Widest charcoal carriageway, shoulder, frequent white centre markings |
| Arterial | Links town centres, campuses, housing and the civic core | Medium carriageway with calmer markings |
| Local | Organises individual estates and frontages | Narrow street, warm centre marking and lower visual contrast |
| Pedestrian path | Last-mile movement inside destinations and landmarks | Existing warm beige path material |

The hierarchy should remain readable in silhouette. Avoid using an expressway where a local road is sufficient, and avoid adding parallel links that do not create a new route choice.

## District-planning rules

- Every major district connects to at least one expressway or arterial.
- Critical locations should have two plausible approaches where the island scale allows it.
- Residential buildings sit beside local streets and face them; they do not occupy the road centreline.
- Major destinations use separate `ROAD_ACCESS` arrival nodes outside the building footprint; strategic routes never terminate at a landmark's model origin.
- `ROAD_CLEARANCE_ZONES` bend sampled carriageways around protected landmark footprints, including intermediate segments between access nodes.
- `CITY_BUILDING_ZONES` is the authoritative footprint registry for both gray roads and beige neighbourhood streets. Street endpoints resolve to the building frontage facing the route, never the model origin.
- Major procedural and imported buildings reserve an additional visual-footprint buffer beyond their gameplay collider so façades, balconies and roof overhangs remain visibly beside the street.
- The forty local-estate buildings derive their placement and exclusion zones from the same `localBuildingPose` function, preventing cross-network overlaps.
- Singapore River bridges are generated at transverse street intersections; each bridge inherits the street tangent and opens a matching collision corridor across the water.
- Authored road, street and bridge surfaces are protected movement corridors: incidental water, prop and NPC colliders cannot create invisible blockages, but registered building footprints still block movement.
- `auditPublicRouteClearance` samples the final road and bridge network after all colliders load and exposes its checked/blocked result for regression QA.
- Redundant links are removed when overlapping destination footprints cannot provide a safe verge; the Kampung and secondary condo district connect through the HDB/central network instead of an unsafe direct shortcut.
- Local plots keep a clearance setback greater than the road half-width, the largest building collider and a safety margin.
- Independent building silhouettes keep a measured verge; intentional connected ensembles such as shophouse rows and the airport campus use one combined planning footprint.
- `auditBuildingSpacing` checks every major footprint, the north archive display and all forty local-estate buildings whenever the world loads.
- Major intersections use a junction or roundabout treatment so route changes are visible from the gameplay camera.
- Institutions retain a pedestrian plaza between their entrance and the road network.
- Road signs name operational destinations rather than decorative landmarks.

## Current structure

- `ISLAND EXPRESS`: Tuas, a southern western-bypass approach, interchange, NUS, central depot, hospital, civic district and Changi.
- `COASTAL EXPRESS`: Tuas, East Coast, SUTD and Changi.
- `CENTRAL CORRIDOR`: a continuous west-to-east arterial from the kampung and MRT through central housing, civic and CBD districts.
- `CAMPUS LINK`: NTU, NUS, hospital, SMU and civic district.
- Eight local estate corridors organise the background building clusters.

When adding a district, create its building-free `ROAD_ACCESS` node, update `ROAD_NETWORKS`, terrain flattening and the collision/POI list, then run `npm test` and review both title and gameplay cameras. Parked vehicles snap to the nearest sampled road pose and inherit its tangent heading; moving road vehicles use the rendered road offset. Watercraft use the shared water-surface, draft and bob constants.

Vehicle assets use local `+Z` as forward. Assets authored on another axis must declare a `forwardYaw`; the service-van GLB uses `-π/2` to convert its Blender `+X` nose. Driving is forward-only, braking uses Down/S, and steering is applied only while moving.
