"""Bring the Alfa Romeo Giulia Spider GLB to catalogue budget.

Consolidates 15+ generator materials into 8 catalogue families, decimates to
the hero triangle budget, grounds the model, and exports a Draco-compressed
GLB beside an updated editable .blend source.

Usage:
  blender -b assets/alfa-romeo-giulia-spider-v2.blend -P \
      blender/optimize_alfa_for_catalogue.py
"""

import bpy
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND = os.path.join(ROOT, "assets", "alfa-romeo-giulia-spider-v2.blend")
GLB = os.path.join(ROOT, "assets", "alfa-romeo-giulia-spider-v2.glb")
CAR_ROOT_NAME = "1963 Alfa Romeo Giulia Spider"
TRI_BUDGET = 34_000  # margin under the 35,000 hero audit budget
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
    "Gauge cream": "Gauge cream",
    "Lettering": "Gauge cream",
}

# family: (color, roughness, metallic, coat, transmission, alpha)
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


def descendants(root):
    stack = [root]
    out = []
    while stack:
        obj = stack.pop()
        out.append(obj)
        stack.extend(obj.children)
    return out


def mesh_tris(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    count = sum(len(p.vertices) - 2 for p in mesh.polygons) if mesh else 0
    eval_obj.to_mesh_clear()
    return count


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


def consolidate(car_meshes, families):
    """Rebuild every mesh's slots so each polygon lands on its family material."""
    for obj in car_meshes:
        slot_targets = [
            MATERIAL_MAP.get(s.material.name if s.material else "", FALLBACK_FAMILY)
            for s in obj.material_slots
        ]
        face_fams = [slot_targets[p.material_index] for p in obj.data.polygons]
        present = list(dict.fromkeys(face_fams))
        obj.data.materials.clear()
        for name in present:
            obj.data.materials.append(families[name])
        fam_to_slot = {name: i for i, name in enumerate(present)}
        for poly, fam in zip(obj.data.polygons, face_fams):
            poly.material_index = fam_to_slot[fam]


def decimate_to_budget(car_meshes, budget=TRI_BUDGET):
    total = sum(mesh_tris(o) for o in car_meshes)
    print(f"[alfa] triangles before: {total}")
    if total <= budget:
        return total
    ratio = budget / total * 0.97
    for obj in car_meshes:
        mod = obj.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
    bpy.context.view_layer.update()
    total_after = sum(mesh_tris(o) for o in car_meshes)
    print(f"[alfa] triangles after decimate pass 1: {total_after}")
    attempts = 0
    while total_after > budget and attempts < 3:
        attempts += 1
        factor = max(0.6, (budget / total_after) ** 1.15)
        for obj in car_meshes:
            mod = obj.modifiers.get("Decimate")
            if mod:
                mod.ratio = min(1.0, mod.ratio * factor)
        bpy.context.view_layer.update()
        total_after = sum(mesh_tris(o) for o in car_meshes)
        print(f"[alfa] triangles after corrective pass {attempts}: {total_after}")
    return total_after


def apply_all_modifiers(root):
    meshes = [o for o in descendants(root) if o.type == "MESH" and o.modifiers]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.convert(target="MESH")


def ground(root):
    meshes = [o for o in descendants(root) if o.type == "MESH"]
    lo = None
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            world = eval_obj.matrix_world @ Vector(corner)
            lo = world.z if lo is None else min(lo, world.z)
    if lo is not None and abs(lo) > 1e-4:
        root.location.z -= lo
        bpy.context.view_layer.update()
        print(f"[alfa] grounded: shifted z by {-lo:.4f}")


def export_glb():
    root = bpy.data.objects[CAR_ROOT_NAME]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
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


def main():
    root = bpy.data.objects.get(CAR_ROOT_NAME)
    if root is None:
        raise SystemExit(f"[alfa] root '{CAR_ROOT_NAME}' not found")
    car_meshes = [o for o in descendants(root) if o.type == "MESH"]
    print(f"[alfa] meshes: {len(car_meshes)}")

    families = build_family_materials()
    consolidate(car_meshes, families)

    total_before = sum(
        sum(len(p.vertices) - 2 for p in o.data.polygons) for o in car_meshes
    )
    print(f"[alfa] consolidated triangles: {total_before}")

    decimate_to_budget(car_meshes)
    apply_all_modifiers(root)
    car_meshes = [o for o in descendants(root) if o.type == "MESH"]
    ground(root)

    final = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in car_meshes)
    mats = sorted({s.material.name for o in car_meshes for s in o.material_slots if s.material})
    print(f"[alfa] final triangles: {final} | materials ({len(mats)}): {mats}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    export_glb()


main()
