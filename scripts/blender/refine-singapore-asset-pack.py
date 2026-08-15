"""Render an eight-angle review and refine/export the Singapore nature pack.

Run with Blender in background mode:
  blender --background --python scripts/blender/refine-singapore-asset-pack.py -- --stage round1
  blender --background --python scripts/blender/refine-singapore-asset-pack.py -- --stage final
"""

import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RESEARCH = os.path.join(ROOT, "research", "img2threejs", "singapore-assets")
RAW = os.path.join(RESEARCH, "raw")
REVIEWS = os.path.join(RESEARCH, "reviews")
ASSETS = os.path.join(ROOT, "assets")
PREVIEWS = os.path.join(ASSETS, "previews")

ASSET_IDS = (
    "smooth-coated-otter",
    "red-junglefowl",
    "oriental-pied-hornbill",
    "clouded-monitor",
    "singapore-cable-car-skyorb",
)

VIEW_DIRECTIONS = {
    "front": Vector((0.0, -1.0, 0.05)),
    "rear": Vector((0.0, 1.0, 0.05)),
    "left": Vector((-1.0, 0.0, 0.05)),
    "right": Vector((1.0, 0.0, 0.05)),
    "top": Vector((0.0, -0.05, 1.0)),
    "bottom": Vector((0.0, -0.05, -1.0)),
    "front-3q": Vector((0.78, -1.0, 0.5)),
    "rear-3q": Vector((-0.78, 1.0, 0.5)),
}

HARD_SURFACE_TOKENS = (
    "skirt", "plate", "bench", "back", "louvre", "grip", "beam",
    "fastener", "rib", "floor", "axle", "roller",
)


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("round1", "final"), required=True)
    parser.add_argument("--only", choices=ASSET_IDS)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_asset(asset_id):
    source = os.path.join(RAW, asset_id + ".glb")
    if not os.path.exists(source):
        raise FileNotFoundError(source)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=source)
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"No objects imported for {asset_id}")
    roots = [obj for obj in imported if obj.parent not in imported]
    root = roots[0] if len(roots) == 1 else bpy.data.objects.new(asset_id, None)
    if root not in bpy.context.scene.objects.values():
        bpy.context.scene.collection.objects.link(root)
        for obj in roots:
            obj.parent = root
    root.name = asset_id
    root["asset_id"] = asset_id
    root["production_method"] = "Reference-led procedural Three.js; Blender CLI refinement"
    return root, imported


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Cannot frame an asset with no mesh objects")
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def ground_asset(root, objects):
    low, _ = bounds(objects)
    root.location.z -= low.z
    bpy.context.view_layer.update()


def apply_modifier(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    finally:
        obj.select_set(False)


def clean_mesh(obj):
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if bm.verts:
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def refine_asset(asset_id, root, objects):
    changes = []
    for obj in mesh_objects(objects):
        clean_mesh(obj)
        lower = obj.name.lower()

        # The monitor's raised spot spheres dominate the source budget.  A
        # conservative decimation preserves the visible spotted relief while
        # bringing the game asset back inside its 45k-triangle contract.
        if asset_id == "clouded-monitor" and ("spot" in lower or "tail-band" in lower):
            modifier = obj.modifiers.new("Review budget decimation", "DECIMATE")
            modifier.ratio = 0.28 if "spot" in lower else 0.45
            apply_modifier(obj, modifier)
            changes.append(f"decimated {obj.name}")

        # Give fabricated panels a real highlight rolloff.  Organic meshes stay
        # smooth but do not receive blanket topology-changing subdivision.
        if asset_id == "singapore-cable-car-skyorb" and any(token in lower for token in HARD_SURFACE_TOKENS):
            dimensions = [value for value in obj.dimensions if value > 0]
            width = min(dimensions) * 0.07 if dimensions else 0.004
            modifier = obj.modifiers.new("Manufactured edge rolloff", "BEVEL")
            modifier.width = min(max(width, 0.0025), 0.018)
            modifier.segments = 2
            modifier.limit_method = "ANGLE"
            modifier.angle_limit = math.radians(25)
            try:
                apply_modifier(obj, modifier)
                changes.append(f"bevelled {obj.name}")
            except RuntimeError:
                obj.modifiers.remove(modifier)

    # Tighten imported PBR values for a readable neutral-studio presentation.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        node = mat.node_tree.nodes.get("Principled BSDF")
        if not node:
            continue
        rough = node.inputs.get("Roughness")
        metallic = node.inputs.get("Metallic")
        if asset_id == "singapore-cable-car-skyorb":
            if "chrome" in mat.name.lower() or (metallic and metallic.default_value > 0.6):
                if rough:
                    rough.default_value = min(rough.default_value, 0.22)
            elif rough:
                rough.default_value = max(rough.default_value, 0.34)
        elif rough:
            rough.default_value = max(rough.default_value, 0.48)

    root["blender_refinement"] = (
        "Mesh weld and normal repair; organic smoothing; clouded-monitor relief "
        "budget optimization; SkyOrb manufactured-edge bevel and PBR tuning"
    )
    return changes


def setup_studio(objects):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except (TypeError, ValueError):
        pass

    world = bpy.data.worlds.new("Singapore asset review world") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.04, 0.055, 1.0)
    background.inputs["Strength"].default_value = 0.28

    low, high = bounds(objects)
    center = (low + high) * 0.5
    extent = high - low
    radius = max(extent) * 0.62

    bpy.ops.mesh.primitive_plane_add(size=max(extent.x, extent.y) * 5.5, location=(center.x, center.y, low.z - 0.012))
    ground = bpy.context.object
    ground.name = "REVIEW_GROUND_NOT_EXPORTED"
    ground_mat = bpy.data.materials.new("Review ground")
    ground_mat.diffuse_color = (0.055, 0.14, 0.16, 1)
    ground_mat.roughness = 0.78
    ground.data.materials.append(ground_mat)

    for name, location, energy, size, color in (
        ("Warm key", center + Vector((-radius * 1.8, -radius * 2.2, radius * 2.7)), 1150, radius * 2.0, (1.0, 0.73, 0.5)),
        ("Cool fill", center + Vector((radius * 2.2, -radius * 0.2, radius * 1.5)), 850, radius * 2.4, (0.36, 0.69, 1.0)),
        ("Mint rim", center + Vector((0, radius * 2.1, radius * 2.0)), 980, radius * 1.8, (0.47, 1.0, 0.73)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "REVIEW_CAMERA_NOT_EXPORTED"
    camera.data.lens = 58
    camera.data.sensor_width = 36
    scene.camera = camera
    return scene, camera, ground, center, radius


def render_views(asset_id, stage, objects):
    output_dir = os.path.join(REVIEWS, stage)
    os.makedirs(output_dir, exist_ok=True)
    scene, camera, ground, center, radius = setup_studio(objects)
    for view_name, direction in VIEW_DIRECTIONS.items():
        unit = direction.normalized()
        camera.location = center + unit * radius * 3.25
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        ground.hide_render = view_name in ("top", "bottom")
        scene.render.filepath = os.path.join(output_dir, f"{asset_id}-{view_name}.png")
        bpy.ops.render.render(write_still=True)

    # The front three-quarter view is the asset-library preview.
    if stage == "final":
        os.makedirs(PREVIEWS, exist_ok=True)
        hero_direction = Vector((0.78, -1.0, 0.45)).normalized()
        camera.location = center + hero_direction * radius * 3.15
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        ground.hide_render = False
        scene.render.filepath = os.path.join(PREVIEWS, f"{asset_id}-v1.png")
        bpy.ops.render.render(write_still=True)


def object_stats(objects):
    triangles = 0
    materials = set()
    meshes = mesh_objects(objects)
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        for slot in obj.material_slots:
            if slot.material:
                materials.add(slot.material.name)
    low, high = bounds(objects)
    size = high - low
    return {
        "triangles": triangles,
        "meshes": len(meshes),
        "materials": len(materials),
        "dimensions": {
            "width": round(size.x, 4),
            "height": round(size.z, 4),
            "depth": round(size.y, 4),
        },
    }


def export_final(asset_id, root, objects):
    os.makedirs(ASSETS, exist_ok=True)
    blend_path = os.path.join(ASSETS, f"{asset_id}-v1.blend")
    glb_path = os.path.join(ASSETS, f"{asset_id}-v1.glb")
    # Save the editable asset before adding review-only cameras/lights/ground.
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_yup=True,
        export_apply=True,
        export_extras=True,
    )
    return glb_path


def main():
    options = args()
    stage = options.stage
    selected = (options.only,) if options.only else ASSET_IDS
    os.makedirs(os.path.join(REVIEWS, stage), exist_ok=True)
    all_stats = {}

    for asset_id in selected:
        reset_scene()
        root, objects = import_asset(asset_id)
        ground_asset(root, objects)
        changes = []
        if stage == "final":
            changes = refine_asset(asset_id, root, objects)
            exported = export_final(asset_id, root, objects)
            print(f"EXPORTED {exported}")
        all_stats[asset_id] = object_stats(objects)
        all_stats[asset_id]["refinements"] = len(changes)
        render_views(asset_id, stage, objects)
        print(f"REVIEWED {asset_id}: {all_stats[asset_id]}")

    output = os.path.join(REVIEWS, f"{stage}-metrics.json")
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(all_stats, handle, indent=2)
        handle.write("\n")
    print(f"WROTE {output}")


if __name__ == "__main__":
    main()
