"""Render deterministic multi-view review shots for GLB assets.

Usage (headless):
  blender -b -P blender/render_review_views.py -- --out review-shots/commercial-review \
      [--assets assets/a.glb assets/b.glb | --all] [--size 512]

Renders front, three-quarter, side, and top views per asset with a neutral
studio setup so vision reviewers can compare assets consistently.
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

VIEWS = {
    "front": (0.0, 8.0),
    "three-quarter": (38.0, 18.0),
    "side": (90.0, 6.0),
    "top": (0.0, 78.0),
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--assets", nargs="*", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--root", default="assets")
    parser.add_argument("--size", type=int, default=512)
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = ARGS.size
    scene.render.resolution_y = ARGS.size
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("ReviewWorld")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.82, 0.82, 0.84, 1.0)
        bg.inputs[1].default_value = 1.0


def add_ground():
    mesh = bpy.data.meshes.new("Ground")
    obj = bpy.data.objects.new("Ground", mesh)
    bpy.context.collection.objects.link(obj)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=100)
    bm.to_mesh(mesh)
    bm.free()
    mat = bpy.data.materials.new("GroundMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.55, 0.55, 0.56, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.9
    obj.data.materials.append(mat)
    return obj


def add_lights():
    key = bpy.data.lights.new("Key", type="AREA")
    key.energy = 800
    key.size = 6
    key_obj = bpy.data.objects.new("Key", key)
    key_obj.location = (4, -5, 6)
    key_obj.rotation_euler = (math.radians(40), 0, math.radians(35))
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("Fill", type="AREA")
    fill.energy = 300
    fill.size = 8
    fill_obj = bpy.data.objects.new("Fill", fill)
    fill_obj.location = (-6, -3, 3)
    fill_obj.rotation_euler = (math.radians(65), 0, math.radians(-60))
    bpy.context.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("Rim", type="SUN")
    rim.energy = 2.5
    rim_obj = bpy.data.objects.new("Rim", rim)
    rim_obj.rotation_euler = (math.radians(50), 0, math.radians(150))
    bpy.context.collection.objects.link(rim_obj)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def scene_bounds(objects):
    points = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type not in {"MESH", "CURVE", "SURFACE", "FONT", "META"}:
            continue
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            points.append(eval_obj.matrix_world @ Vector(corner))
    if not points:
        return None
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def add_camera(name, location, target):
    cam_data = bpy.data.cameras.new(name)
    cam_data.clip_end = 5000
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam)
    return cam


def render_views(glb_path, out_dir):
    name = os.path.splitext(os.path.basename(glb_path))[0]
    objects = import_glb(glb_path)
    bounds = scene_bounds(objects)
    if bounds is None:
        print(f"[review] SKIP (no geometry): {glb_path}")
        return False
    lo, hi = bounds
    center = (lo + hi) / 2
    size = max((hi - lo).length, 0.001)
    radius = size / 2

    # Ground plane sized under the model, at the model's min Z.
    ground = add_ground()
    ground.location.z = lo.z

    add_lights()

    distance = radius * 2.35 + 0.5
    scene = bpy.context.scene
    for view_name, (azimuth_deg, elevation_deg) in VIEWS.items():
        az = math.radians(azimuth_deg)
        el = math.radians(elevation_deg)
        loc = Vector((
            center.x + distance * math.cos(el) * math.sin(az),
            center.y - distance * math.cos(el) * math.cos(az),
            center.z + distance * math.sin(el),
        ))
        cam = add_camera(f"Cam_{view_name}", loc, center)
        # Keep whole model framed even for wide aspect ratios.
        cam.data.angle = math.radians(42)
        scene.camera = cam
        scene.render.filepath = os.path.join(out_dir, f"{name}__{view_name}.png")
        bpy.ops.render.render(write_still=True)
    print(f"[review] OK {name}")
    return True


ARGS = parse_args()


def main():
    os.makedirs(ARGS.out, exist_ok=True)
    if ARGS.all:
        roots = [ARGS.root, os.path.join(ARGS.root, "residents"), os.path.join(ARGS.root, "lost-heritage")]
        glbs = []
        for root_dir in roots:
            if not os.path.isdir(root_dir):
                continue
            glbs.extend(sorted(
                os.path.join(root_dir, f) for f in os.listdir(root_dir) if f.endswith(".glb")
            ))
    else:
        glbs = list(ARGS.assets)

    ok = fail = 0
    for glb in glbs:
        try:
            reset_scene()
            if render_views(glb, ARGS.out):
                ok += 1
            else:
                fail += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[review] FAIL {glb}: {exc}")
            fail += 1
    print(f"[review] done ok={ok} fail={fail}")


main()
