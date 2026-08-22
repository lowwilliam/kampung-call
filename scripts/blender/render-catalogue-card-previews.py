"""Render deterministic card previews for every manifested catalogue GLB.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/blender/render-catalogue-card-previews.py

The output is derived directly from the current model bytes. The companion
``showcase/scripts/accept-catalogue-previews.mjs`` script records checksums only
after the complete 74-image set exists.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "showcase" / "app" / "data" / "catalogue-manifest.json"
OUTPUT = ROOT / "assets" / "previews" / "catalogue"
WIDTH = 840
HEIGHT = 680


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.actions,
        bpy.data.images,
    ):
        for block in list(collection):
            collection.remove(block)


def bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    low = Vector((math.inf, math.inf, math.inf))
    high = Vector((-math.inf, -math.inf, -math.inf))
    for obj in meshes:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low.x, low.y, low.z = min(low.x, point.x), min(low.y, point.y), min(low.z, point.z)
            high.x, high.y, high.z = max(high.x, point.x), max(high.y, point.y), max(high.z, point.z)
    return low, high


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def render(model_path: Path, output_path: Path) -> None:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(model_path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No meshes found in {model_path.relative_to(ROOT)}")

    low, high = bounds(meshes)
    center = (low + high) * 0.5
    dimensions = high - low
    radius = max(dimensions.length * 0.58, 0.2)

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 86
    scene.render.film_transparent = False
    scene.render.filepath = str(output_path)
    scene.world.color = (0.018, 0.027, 0.031)
    scene.view_settings.look = "AgX - Medium High Contrast"
    # The archival reconstructions intentionally use much darker material
    # values than the playful game assets. Lift them for a legible card while
    # preserving their authored colours and geometry.
    scene.view_settings.exposure = 2.0 if "lost-heritage" in model_path.parts else 0.0

    camera_data = bpy.data.cameras.new("CatalogueCardCamera")
    camera = bpy.data.objects.new("CatalogueCardCamera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(dimensions.x, dimensions.y, dimensions.z) * 1.42
    camera.location = center + Vector((radius * 2.2, -radius * 2.55, radius * 1.55))
    look_at(camera, center + Vector((0.0, 0.0, dimensions.z * 0.04)))
    scene.camera = camera

    for name, energy, offset, color in (
        ("Key", 1150.0, (1.2, -1.4, 2.0), (1.0, 0.84, 0.68)),
        ("Fill", 800.0, (-1.5, -0.4, 1.1), (0.48, 0.82, 0.78)),
        ("Rim", 950.0, (0.4, 1.7, 1.7), (0.35, 0.66, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = max(radius * 1.2, 0.7)
        light = bpy.data.objects.new(name, data)
        light.location = center + Vector(tuple(value * radius for value in offset))
        scene.collection.objects.link(light)
        look_at(light, center)

    bpy.ops.mesh.primitive_plane_add(size=max(radius * 7.0, 4.0), location=(center.x, center.y, low.z - 0.003))
    ground = bpy.context.object
    ground.name = "CatalogueCardGround"
    material = bpy.data.materials.new("CatalogueCardGroundMaterial")
    material.diffuse_color = (0.025, 0.045, 0.048, 1.0)
    material.roughness = 0.84
    ground.data.materials.append(material)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    manifest = json.loads(MANIFEST.read_text())
    assets = manifest.get("assets", [])
    if len(assets) != 74:
        raise RuntimeError(f"Expected 74 catalogue assets, found {len(assets)}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    if args.asset:
        requested = set(args.asset)
        assets = [asset for asset in assets if asset["id"] in requested or asset["slug"] in requested]
        missing = requested - {asset["id"] for asset in assets} - {asset["slug"] for asset in assets}
        if missing:
            raise RuntimeError(f"Unknown catalogue assets: {', '.join(sorted(missing))}")
    else:
        expected = {f"{asset['slug']}.webp" for asset in assets}
        for stale in OUTPUT.iterdir():
            if stale.name not in expected:
                stale.unlink()

    for index, asset in enumerate(assets, 1):
        model_path = ROOT / asset["model"]["sourcePath"]
        output_path = OUTPUT / f"{asset['slug']}.webp"
        print(f"CARD_PREVIEW [{index}/{len(assets)}] {asset['id']}", flush=True)
        render(model_path, output_path)

    print(f"CARD_PREVIEWS_READY {OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
