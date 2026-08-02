"""Inspect existing production GLBs: dimensions, materials, polygon counts."""
import bpy, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
TARGETS = ["shophouse-v2.glb", "kampung-call-v2.glb", "hdb-call-v2.glb",
           "hawker-v2.glb", "temple-v2.glb", "kopitiam-v2.glb"]

for name in TARGETS:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    path = os.path.join(ASSETS, name)
    bpy.ops.import_scene.gltf(filepath=path)
    deps = bpy.context.evaluated_depsgraph_get()
    tris = 0
    mats = set()
    meshes = 0
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        meshes += 1
        ev = o.evaluated_get(deps)
        mesh = ev.to_mesh()
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        ev.to_mesh_clear()
        for slot in o.material_slots:
            if slot.material:
                mats.add(slot.material.name)
    minx = miny = minz = 1e9
    maxx = maxy = maxz = -1e9
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            w = o.matrix_world @ bpy.mathutils_Vector(corner) if False else None
    import mathutils
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(corner)
            minx, maxx = min(minx, w.x), max(maxx, w.x)
            miny, maxy = min(miny, w.y), max(maxy, w.y)
            minz, maxz = min(minz, w.z), max(maxz, w.z)
    size = os.path.getsize(path)
    print(f"INSPECT {name}: size={size/1024:.0f}KB meshes={meshes} tris={tris} "
          f"materials={len(mats)} dims=({maxx-minx:.2f},{maxy-miny:.2f},{maxz-minz:.2f}) "
          f"minz={minz:.2f} mats={sorted(mats)[:8]}")
