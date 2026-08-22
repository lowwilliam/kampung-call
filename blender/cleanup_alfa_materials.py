"""Clean up material names in the optimized alfa .blend (remove .001 suffixes)."""

import bpy

RENAMES = {
    "Car paint": "Car paint",
    "Bright metal": "Bright metal",
    "Tire rubber": "Tire rubber",
    "Oxblood leather": "Oxblood leather",
    "Cabin black": "Cabin black",
    "Glazing": "Glazing",
    "Lamp and plate red": "Lamp and plate red",
    "Gauge cream": "Gauge cream",
}

# Drop legacy materials that no car mesh references anymore.
for mat in list(bpy.data.materials):
    if mat.users == 0:
        bpy.data.materials.remove(mat)

for mat in list(bpy.data.materials):
    base = mat.name.replace(".001", "").replace(".002", "")
    if base in RENAMES.values() and mat.name != base:
        target = bpy.data.materials.get(base)
        if target is None:
            mat.name = base
        else:
            # Merge: retarget users then delete the duplicate.
            for obj in bpy.data.objects:
                if obj.type != "MESH":
                    continue
                for slot in obj.material_slots:
                    if slot.material == mat:
                        slot.material = target
            for mesh in bpy.data.meshes:
                for i, m in enumerate(mesh.materials):
                    if m == mat:
                        mesh.materials[i] = target
            bpy.data.materials.remove(mat)

used = sorted({s.material.name for o in bpy.data.objects if o.type == "MESH"
               for s in o.material_slots if s.material})
print("[alfa-clean] materials in use:", used)
bpy.ops.wm.save_mainfile()
print("[alfa-clean] saved")
