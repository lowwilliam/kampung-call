"""Re-export complex Blender sources as named, grounded component assemblies."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"

SOURCE_MAP = {
    "airport-terminal-v2": "airport-terminal-v2.blend",
    "bumboat-v2": "bumboat-v2.blend",
    "concert-hall-v2": "concert-hall-v2.blend",
    "condo-bg-v2": "condo-bg-v2.blend",
    "condo-holland-v2": "condo-holland-v2.blend",
    "condo-marina-v2": "condo-marina-v2.blend",
    "controltower-v2": "controltower-v2.blend",
    "hawker-v2": "hawker-v2.blend",
    "hdb-bg-v2": "hdb-bg-v2.blend",
    "hdb-call-v2": "hdb-call-kit.blend",
    "hdb-voiddeck-v2": "hdb-voiddeck-v2.blend",
    "kampong-house-v2": "kampong-house-v2.blend",
    "kampong-props-v2": "kampong-props-v2.blend",
    "kampung-call-v2": "kampung-call-v2.blend",
    "kopitiam-v2": "kopitiam-v2.blend",
    "mamashop-v2": "mamashop-v2.blend",
    "mrt-v2": "mrt-v2.blend",
    "national-school-v2": "national-school-v2.blend",
    "pointblock-call-v2": "pointblock-call-v2.blend",
    "shophouse-v2": "shophouse-v2.blend",
    "skypark-hotel-v2": "skypark-hotel-v2.blend",
    "sultan-mosque-v2": "sultan-mosque-v2.blend",
    "wetmarket-v2": "wetmarket-v2.blend",
}

DECIMATE_RATIOS = {
    # The source stores dense applied bevels. Per-part decimation keeps the named
    # assembly while bringing the hero kit below its 35k browser budget.
    "hdb-call-v2": 0.15,
}


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    low = Vector((float("inf"),) * 3)
    high = Vector((float("-inf"),) * 3)
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low.x, low.y, low.z = min(low.x, point.x), min(low.y, point.y), min(low.z, point.z)
            high.x, high.y, high.z = max(high.x, point.x), max(high.y, point.y), max(high.z, point.z)
    return low, high


def is_generic(name: str) -> bool:
    return bool(re.match(r"^(Cube|Sphere|Cylinder|Plane|Torus|Object|Mesh)(\.\d+)?$", name))


def semantic_fallback(obj: bpy.types.Object, index: int) -> str:
    material = next((slot.material.name for slot in obj.material_slots if slot.material), "Unassigned")
    material = re.sub(r"[^A-Za-z0-9]+", " ", material).strip() or "Unassigned"
    return f"{material} part {index:03d}"


def export_asset(asset_id: str, source_name: str) -> None:
    source = ASSETS / source_name
    output = ASSETS / f"{asset_id}.glb"
    print(f"COMPONENT_REEXPORT {asset_id} <- {source.name}", flush=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))

    renderables = [obj for obj in bpy.context.scene.objects
                   if obj.type in {"MESH", "CURVE", "FONT", "ARMATURE", "EMPTY"}
                   and not obj.hide_render]
    meshes = [obj for obj in renderables if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{source.name} contains no renderable meshes")

    generic_index = 1
    for obj in meshes:
        if is_generic(obj.name):
            obj.name = semantic_fallback(obj, generic_index)
            generic_index += 1

    decimate_ratio = DECIMATE_RATIOS.get(asset_id)
    if decimate_ratio:
        for obj in meshes:
            if len(obj.data.polygons) < 24:
                continue
            modifier = obj.modifiers.new("Component budget decimation", "DECIMATE")
            modifier.ratio = decimate_ratio
            modifier.use_collapse_triangulate = True

    root = bpy.data.objects.new(f"{asset_id} component root", None)
    bpy.context.scene.collection.objects.link(root)
    root["componentReady"] = True
    root["units"] = "metres"
    root["groundContactZ"] = 0.0
    root["partPicking"] = "named-mesh-nodes"
    root["explodeLayout"] = "scale-from-bounds-centre"

    top_level = [obj for obj in renderables if obj.parent not in renderables]
    for obj in top_level:
        matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = matrix

    bpy.context.view_layer.update()
    low, _ = bounds(meshes)
    root.location.z -= low.z
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in renderables:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )


def main() -> None:
    requested = set(sys.argv[sys.argv.index("--") + 1 :]) if "--" in sys.argv else set()
    mapping = {key: value for key, value in SOURCE_MAP.items() if not requested or key in requested}
    for asset_id, source_name in mapping.items():
        export_asset(asset_id, source_name)
    print(f"COMPONENT_REEXPORT_DONE {len(mapping)}")


if __name__ == "__main__":
    main()
