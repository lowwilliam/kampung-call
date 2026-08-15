"""Audit every shipping GLB and render deterministic multi-angle review images.

Run with:
  blender --background --python scripts/blender/audit-3d-components.py -- \
    --output review-shots/3d-component-audit

The audit intentionally distinguishes a loadable runtime asset from an assembly-ready
component. A complex asset flattened to one mesh can be runtime-ready while still being
unsuitable for part picking, animation, or an exploded view.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="review-shots/3d-component-audit")
    parser.add_argument("--size", type=int, default=384)
    parser.add_argument("--asset", action="append", default=[])
    parser.add_argument("--no-render", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures,
                       bpy.data.materials, bpy.data.cameras, bpy.data.lights,
                       bpy.data.actions, bpy.data.images):
        for block in list(collection):
            collection.remove(block)


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    low = Vector((math.inf, math.inf, math.inf))
    high = Vector((-math.inf, -math.inf, -math.inf))
    for obj in meshes:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low.x, low.y, low.z = min(low.x, point.x), min(low.y, point.y), min(low.z, point.z)
            high.x, high.y, high.z = max(high.x, point.x), max(high.y, point.y), max(high.z, point.z)
    return low, high


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def add_review_stage(low: Vector, high: Vector, size: int) -> tuple[bpy.types.Object, Vector, float]:
    center = (low + high) * 0.5
    dimensions = high - low
    radius = max(dimensions.length * 0.58, 0.2)

    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = size
    bpy.context.scene.render.resolution_y = size
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.render.image_settings.color_mode = "RGBA"
    bpy.context.scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.context.scene.world.color = (0.035, 0.04, 0.045)

    camera_data = bpy.data.cameras.new("AuditCamera")
    camera = bpy.data.objects.new("AuditCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(dimensions.x, dimensions.y, dimensions.z) * 1.32
    bpy.context.scene.camera = camera

    for name, energy, location, color, size_value in (
        ("Key", 1100.0, center + Vector((radius, -radius, radius * 1.6)), (1.0, 0.82, 0.65), radius),
        ("Fill", 800.0, center + Vector((-radius, -radius * 0.4, radius)), (0.55, 0.75, 1.0), radius),
        ("Rim", 950.0, center + Vector((0.0, radius, radius * 1.4)), (0.7, 0.85, 1.0), radius),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = max(size_value, 0.5)
        light = bpy.data.objects.new(name, data)
        light.location = location
        bpy.context.scene.collection.objects.link(light)
        look_at(light, center)

    bpy.ops.mesh.primitive_plane_add(size=max(radius * 7.0, 4.0), location=(center.x, center.y, low.z - 0.002))
    ground = bpy.context.object
    ground.name = "AuditGround"
    material = bpy.data.materials.new("AuditGroundMaterial")
    material.diffuse_color = (0.055, 0.06, 0.065, 1.0)
    material.roughness = 0.82
    ground.data.materials.append(material)
    return camera, center, radius


def render_angles(camera: bpy.types.Object, center: Vector, radius: float, output: Path) -> None:
    distance = max(radius * 2.8, 1.5)
    views = {
        "front": Vector((0.0, -distance, distance * 0.24)),
        "side": Vector((distance, 0.0, distance * 0.24)),
        "three-quarter": Vector((distance * 0.78, -distance * 0.78, distance * 0.52)),
        "top": Vector((distance * 0.18, -distance * 0.22, distance * 1.35)),
    }
    for name, offset in views.items():
        camera.location = center + offset
        look_at(camera, center)
        bpy.context.scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def generic_name(name: str) -> bool:
    stripped = name.strip()
    return (not stripped or stripped.isdigit()
            or stripped.startswith(("Object", "Mesh", "Cube", "Sphere", "Cylinder", "Plane", "Torus")))


def inspect_asset(path: Path, output_root: Path, size: int, no_render: bool) -> dict:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if not meshes:
        return {"path": str(path.relative_to(ROOT)), "runtimeReady": False,
                "componentReady": False, "issues": ["no-meshes"]}

    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    materials: set[str] = set()
    unnamed_meshes = 0
    unapplied_scale = 0
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
        if generic_name(obj.name):
            unnamed_meshes += 1
        if any(abs(component - 1.0) > 1e-4 for component in obj.scale):
            unapplied_scale += 1
        for slot in obj.material_slots:
            if slot.material:
                materials.add(slot.material.name)

    low, high = world_bounds(meshes)
    dims = high - low
    ordered_dims = sorted((dims.x, dims.y, dims.z))
    degenerate = ordered_dims[0] < max(ordered_dims[-1] * 0.008, 1e-5)
    # Blender's glTF axis conversion can leave a few centimetres of evaluated
    # bound drift on nested, non-uniformly scaled animal parts. The release audit
    # separately checks the encoded glTF Y-up bound at 1 cm precision.
    grounded = abs(low.z) <= max(0.05, dims.z * 0.02)
    complex_asset = triangles > 2200 or len(meshes) > 3 or len(objects) > 8
    named_parts = [obj for obj in meshes if not generic_name(obj.name)]
    selectable_parts = len(named_parts)

    issues: list[str] = []
    warnings: list[str] = []
    if degenerate:
        issues.append("degenerate-volume")
    if not grounded:
        issues.append("not-grounded")
    if not materials:
        issues.append("missing-material")
    if unnamed_meshes:
        warnings.append(f"generic-mesh-names:{unnamed_meshes}")
    if unapplied_scale:
        warnings.append(f"unapplied-object-scale:{unapplied_scale}")
    if complex_asset and selectable_parts < 2:
        issues.append("complex-asset-flattened-to-one-selectable-part")
    if len(materials) > 6:
        warnings.append(f"high-material-count:{len(materials)}")

    asset_output = output_root / path.relative_to(ROOT / "assets").with_suffix("")
    asset_output.mkdir(parents=True, exist_ok=True)
    if not no_render:
        camera, center, radius = add_review_stage(low, high, size)
        render_angles(camera, center, radius, asset_output)

    runtime_ready = not any(issue in issues for issue in ("degenerate-volume", "not-grounded", "missing-material"))
    component_ready = runtime_ready and "complex-asset-flattened-to-one-selectable-part" not in issues
    return {
        "path": str(path.relative_to(ROOT)),
        "runtimeReady": runtime_ready,
        "componentReady": component_ready,
        "stats": {
            "objects": len(objects),
            "meshes": len(meshes),
            "selectableNamedParts": selectable_parts,
            "armatures": len(armatures),
            "animations": len(bpy.data.actions),
            "triangles": triangles,
            "materials": len(materials),
            "dimensions": [round(dims.x, 5), round(dims.y, 5), round(dims.z, 5)],
            "groundOffset": round(low.z, 6),
        },
        "issues": issues,
        "warnings": warnings,
        "renders": ({name: str((asset_output / f"{name}.png").relative_to(ROOT))
                     for name in ("front", "side", "three-quarter", "top")}
                    if not no_render else {}),
    }


def main() -> None:
    args = parse_args()
    output_root = (ROOT / args.output).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    candidates = sorted((ROOT / "assets").rglob("*.glb"))
    if args.asset:
        requested = set(args.asset)
        candidates = [path for path in candidates if path.name in requested or str(path.relative_to(ROOT)) in requested]

    results = []
    for index, path in enumerate(candidates, 1):
        print(f"AUDIT [{index}/{len(candidates)}] {path.relative_to(ROOT)}", flush=True)
        try:
            results.append(inspect_asset(path, output_root, args.size, args.no_render))
        except Exception as error:  # Continue so one corrupt component cannot hide the rest.
            results.append({"path": str(path.relative_to(ROOT)), "runtimeReady": False,
                            "componentReady": False, "issues": [f"audit-error:{type(error).__name__}:{error}"]})

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "criteria": {
            "runtimeReady": "Imports, has non-degenerate volume/materials, and sits at ground contact.",
            "componentReady": "Runtime-ready, plus complex assets expose at least two named selectable mesh parts.",
            "visualReview": "Human/vision review of front, side, three-quarter, and top renders is still required.",
        },
        "summary": {
            "assets": len(results),
            "runtimeReady": sum(item["runtimeReady"] for item in results),
            "componentReady": sum(item["componentReady"] for item in results),
            "requiresRuntimeFix": sum(not item["runtimeReady"] for item in results),
            "requiresComponentFix": sum(not item["componentReady"] for item in results),
        },
        "assets": results,
    }
    report_path = output_root / "audit.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"AUDIT_REPORT {report_path}")
    print(json.dumps(report["summary"], sort_keys=True))


if __name__ == "__main__":
    main()
