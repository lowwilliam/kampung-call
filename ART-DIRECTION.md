# Field Call — 3D Art Direction

## North star

Build a hand-inked Singapore neighbourhood diorama: recognisable silhouettes, warm imperfection, dense local storytelling, and readable forms at gameplay distance. The work should feel illustrated and authored rather than assembled from generic low-poly primitives.

## Shape language

- Architecture: large asymmetrical masses, deep tropical overhangs, rounded concrete edges, thin dark frames.
- Vehicles: one strong body silhouette, oversized readable windows and wheels, restrained surface detail.
- Characters: head and hands slightly oversized; clear posture and tool silhouette before facial detail.
- Vegetation: clustered, flattened canopies rather than single spheres; curved trunks and uneven colour grouping.
- Props: exaggerate service-relevant objects such as fibre boxes, cables, routers, tools, poles, and address plates.

## Materials and palette

- Ink: `#27302f`
- Warm plaster: `#dbcca8`
- Chalk: `#ebe3c7`
- Deep teal: `#06383b`
- Weathered teal: `#0e6b66`
- Terracotta: `#aa2e1c`
- Signal yellow: `#f09214`
- Vegetation: three greens per canopy, never a single uniform green

Materials stay mostly rough. Glass may be darker and smoother, but avoid realistic transparency that weakens silhouettes. Use bevels and contact shadows for depth instead of glossy rendering.

## Modelling rules

- Every hero object needs a distinctive silhouette in flat black.
- Use 2–4 bevel segments on visible hard edges.
- Avoid unbroken box faces: add recesses, frames, awnings, ledges, seams, or service detail.
- Keep detail clustered around player interaction zones; simplify back faces.
- Model cables as curves with deliberate sag and attachment points.
- Use local details—address plates, AC condensers, planters, utility poles, post boxes—without turning the scene into visual noise.

## Web budgets

- Hero residence: ≤ 35k triangles
- Reusable tree: ≤ 8k triangles
- Vehicle: ≤ 18k triangles
- Small prop: ≤ 2k triangles
- Maximum 4 material families per reusable asset where practical
- GLB assets must be centred at ground contact, face the game’s forward axis, and retain readable names

## Camera and composition

- Gameplay camera should preserve the building silhouette and show the route ahead.
- Keep foreground service props separated from the character silhouette.
- Use utility lines, road markings, trees, and roof angles to lead toward the current call.
- Avoid placing tall props directly behind interaction markers.

## Production order

1. [x] Landed-home call kit — `landed-v2.glb`
2. [x] HDB corridor and unit kit — `hdb-call-v2.glb`
3. [x] Kopitiam service kit — `kopitiam-v2.glb`
4. [x] Condo lobby and riser kits — `condo-marina-v2.glb`, `condo-holland-v2.glb`
5. [x] Shared street vegetation, lighting, and utility props — `raintree-v2.glb`, `streetlamp-v2.glb`, `postbox-v2.glb`, `bench-v2.glb`
6. [x] Character and vehicle refinement — rigged `courier.glb`, six resident GLBs, `service-van-v2.glb`

Additional call-specific kits completed during the pass:

- [x] Uncle Lim kampung optical-fault kit — `kampung-call-v2.glb`
- [x] Mr Tan point-block intermittent-line kit — `pointblock-call-v2.glb`

Every hero call location now has a task-specific authored model. Generic residence assets remain intentionally limited to background buildings, preserving world density without multiplying hero-level draw cost.
