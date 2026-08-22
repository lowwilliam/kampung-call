"""Rebuild the alfa asset from the complete original GLB.

The previous .blend source was missing 40 car parts that existed only in the
shipped GLB. This script restores a single-source-of-truth pipeline:

  original GLB -> import -> consolidate materials (15 -> <=8 families)
  -> decimate to hero budget -> ground -> save .blend -> Draco GLB

Usage:
  blender -b -P blender/rebuild_alfa_from_glb.py -- --source /tmp/alfa-backup.glb
"""

import bpy
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND = os.path.join(ROOT, "assets", "alfa-romeo-giulia-spider-v2.blend")
GLB = os.path.join(ROOT, "assets", "alfa-romeo-giulia-spider-v2.glb")
CAR_ROOT_NAME = "1963 Alfa Romeo Giulia Spider"
TRI_BUDGET = 33_500  # evaluated-triangle target; triangulation overhead ~9%
FALLBACK_FAMILY = "Cabin black"

MATERIAL_MAP = {
    "Black lacquer clearcoat": "Car paint",
    "Body panel shadow": "Car paint",
    "Polished chrome": "Bright metal",
    "Satin wheel steel": "Bright metal",
    "Tire rubber": "Tire rubber",
    "Tire tread": "Tire rubber",
    "Oxblood leather": "Oxblood leather",
    "Oxblood piping": "Oxblood leather",
    "Black dashboard": "Cabin black",
    "Grille black": "Cabin black",
    "Windshield glass": "Glazing",
    "Headlamp glass": "Glazing",
    "Amber lens": "Lamp and plate red",
    "Red lens": "Lamp and plate red",
    "Singapore red plate": "Lamp and plate red",
}

FAMILY_SPECS = {
    "Car paint": ((0.006, 0.008, 0.009), 0.17, 0.28, 1.0, 0.0, 1.0),
    "Bright metal": ((0.62, 0.66, 0.69), 0.14, 1.0, 0.5, 0.0, 1.0),
    "Tire rubber": ((0.010, 0.012, 0.012), 0.74, 0.0, 0.0, 0.0, 1.0),
    "Oxblood leather": ((0.33, 0.018, 0.018), 0.38, 0.0, 0.28, 0.0, 1.0),
    "Cabin black": ((0.008, 0.009, 0.009), 0.5, 0.05, 0.0, 0.0, 1.0),
    "Glazing": ((0.22, 0.36, 0.40), 0.08, 0.0, 0.15, 0.6, 0.4),
    "Lamp and plate red": ((0.55, 0.03, 0.02), 0.22, 0.0, 0.2, 0.15, 1.0),
    "Gauge cream": ((0.88, 0.84, 0.70), 0.5, 0.0, 0.0, 0.0, 1.0),
}


def parse_source():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    source = "/tmp/alfa-backup.glb"
    for flag, value in zip(argv, argv[1:]):
        if flag == "--source":
            source = value
    return source


def build_family_materials():
    fams = {}
    for name, (color, roughness, metallic, coat, transmission, alpha) in FAMILY_SPECS.items():
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if coat and "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = coat
            bsdf.inputs["Coat Roughness"].default_value = max(0.04, roughness * 0.35)
        if transmission and "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
            bsdf.inputs["IOR"].default_value = 1.45
        if alpha < 1.0:
            bsdf.inputs["Alpha"].default_value = alpha
            try:
                mat.blend_method = "BLEND"
            except Exception:
                pass
        fams[name] = mat
    return fams


def descendants(root):
    stack = [root]
    out = []
    while stack:
        obj = stack.pop()
        out.append(obj)
        stack.extend(obj.children)
    return out


def eval_tris(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    count = sum(len(p.vertices) - 2 for p in mesh.polygons) if mesh else 0
    eval_obj.to_mesh_clear()
    return count


def consolidate(car_meshes, families):
    unmapped = set()
    for obj in car_meshes:
        slot_targets = []
        for s in obj.material_slots:
            legacy = s.material.name if s.material else ""
            target = MATERIAL_MAP.get(legacy)
            if target is None:
                unmapped.add(legacy)
                target = FALLBACK_FAMILY
            slot_targets.append(target)
        face_fams = [slot_targets[p.material_index] for p in obj.data.polygons]
        present = list(dict.fromkeys(face_fams))
        obj.data.materials.clear()
        for name in present:
            obj.data.materials.append(families[name])
        fam_to_slot = {name: i for i, name in enumerate(present)}
        for poly, fam in zip(obj.data.polygons, face_fams):
            poly.material_index = fam_to_slot[fam]
    if unmapped:
        print("[alfa] WARNING unmapped materials:", sorted(unmapped))


def decimate_to_budget(car_meshes, budget=TRI_BUDGET):
    total = sum(eval_tris(o) for o in car_meshes)
    print(f"[alfa] evaluated triangles before: {total}")
    if total <= budget:
        return total
    ratio = budget / total * 0.98
    for obj in car_meshes:
        mod = obj.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
    bpy.context.view_layer.update()
    total_after = sum(eval_tris(o) for o in car_meshes)
    print(f"[alfa] triangles after decimate pass 1: {total_after}")
    attempts = 0
    while total_after > budget and attempts < 3:
        attempts += 1
        factor = max(0.65, (budget / total_after) ** 1.1)
        for obj in car_meshes:
            mod = obj.modifiers.get("Decimate")
            if mod:
                mod.ratio = min(1.0, mod.ratio * factor)
        bpy.context.view_layer.update()
        total_after = sum(eval_tris(o) for o in car_meshes)
        print(f"[alfa] triangles after corrective pass {attempts}: {total_after}")
    return total_after


def apply_all_modifiers(car_meshes):
    mods = [o for o in car_meshes if o.modifiers]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mods:
        obj.select_set(True)
    if mods:
        bpy.context.view_layer.objects.active = mods[0]
        bpy.ops.object.convert(target="MESH")


def ground(objects):
    lo = None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != "MESH":
            continue
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            world = eval_obj.matrix_world @ Vector(corner)
            lo = world.z if lo is None else min(lo, world.z)
    roots = [o for o in objects if o.parent is None or o.parent.type != "MESH" and o.parent not in objects]
    if lo is not None and abs(lo) > 1e-4:
        # Shift every root object of the imported forest.
        for r in roots:
            r.location.z -= lo
        bpy.context.view_layer.update()
        print(f"[alfa] grounded: shifted z by {-lo:.4f}")


def main():
    source = parse_source()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=source)
    imported = [o for o in bpy.data.objects if o not in before]
    print(f"[alfa] imported objects: {len(imported)}")

    # Parent every imported root under one canonical car empty.
    car_root = bpy.data.objects.new(CAR_ROOT_NAME, None)
    bpy.context.collection.objects.link(car_root)
    tops = [o for o in imported if o.parent is None or o.parent not in imported]
    for o in tops:
        o.parent = car_root
        o.matrix_parent_inverse = o.matrix_world.inverted() @ car_root.matrix_world

    meshes = [o for o in imported if o.type == "MESH"]
    print(f"[alfa] car meshes: {len(meshes)}")

    families = build_family_materials()
    consolidate(meshes, families)

    decimate_to_budget(meshes)
    apply_all_modifiers(meshes)
    meshes = [o for o in imported if o.type == "MESH"]
    ground(imported)

    final = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    print(f"[alfa] final triangles (base): {final} | materials ({len(mats)}): {mats}")

    # Purge now-unused legacy materials from the file, then strip the numeric
    # suffixes Blender added when family names collided with legacy names.
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for mat in list(bpy.data.materials):
        base = mat.name.split(".")[0]
        if "." in mat.name and base in FAMILY_SPECS:
            if bpy.data.materials.get(base) is None:
                mat.name = base

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(car_root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = car_root
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    print(f"[alfa] exported {GLB}")


main()
