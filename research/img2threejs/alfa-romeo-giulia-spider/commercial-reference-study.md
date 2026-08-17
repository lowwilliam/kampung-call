# Commercial open-source vehicle reference study

The Alfa asset remains procedurally authored. No third-party geometry or textures are included.

## References inspected

- Khronos glTF Sample Assets **Car Concept** — CC BY 4.0. A production-oriented real-time car with logical names and pivots, cleaned transforms, shell optimization, LSCM UVs, clearcoat paint, shared AO, low-geometry tires with normal-mapped tread, and compressed delivery variants.
- Khronos glTF Sample Assets **Toy Car** — CC0. A high-quality material demonstration using clearcoat, transmission, sheen, texture transforms, and eight authored review cameras.

## Lessons applied

- Replace intersecting ellipsoid fenders with continuous quad patches and a separate curved side skin.
- Make the wheel opening part of the panel boundary instead of subtracting it from an oversized primitive.
- Preserve logical body, door, hood, running-gear, fascia, cabin, steering, and windshield systems.
- Keep tire tread low-frequency and inexpensive; wheel-face identity receives geometry, while tread is visually restrained.
- Use clearcoat and distinct chrome, rubber, glass, steel, leather, and lens materials.
- Review from fixed front and rear three-quarter cameras and keep the web asset within a practical download budget.

## Deliberately not copied

No mesh, UV layout, texture, logo, normal map, animation, camera, or material file from either reference asset is shipped with this project. The references inform topology and delivery decisions only.
