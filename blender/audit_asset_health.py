"""Geometry-health audit for GLB assets (commercial-readiness signals).

Checks per asset:
  - flipped normals (negative signed volume on closed parts)
  - degenerate faces / loose edges
  - non-manifold edges
  - duplicate/coplanar object pairs (z-fighting candidates)
  - floating disconnected parts
  - placeholder/default materials (name or default-grey Principled)
  - triangle + material totals

Usage:
  blender -b -P blender/audit_asset_health.py -- [--all] [--assets a.glb ...] [--out path.json]
"""

import bpy
import json
import os
import sys
from mathutils import Vector

DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "review-shots", "commercial-review", "geometry-health.json"
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    assets, out, all_assets = [], DEFAULT_OUT, False
    i = 0
    while i < len(argv):
        if argv[i] == "--assets":
            i += 1
            while i < len(argv) and not argv[i].startswith("--"):
                assets.append(argv[i]); i += 1
        elif argv[i] == "--out":
            out = argv[i + 1]; i += 1
        elif argv[i] == "--all":
            all_assets = True; i += 1
        else:
            i += 1
    return assets, out, all_assets


def collect_glbs(all_assets):
    roots = ["assets", "assets/residents", "assets/lost-heritage"]
    glbs = []
    for r in roots:
        if not os.path.isdir(r):
            continue
        glbs.extend(sorted(os.path.join(r, f) for f in os.listdir(r) if f.endswith(".glb")))
    return glbs


def mesh_world_verts(obj, step=1):
    mesh = obj.data
    mat = obj.matrix_world
    verts = [v.co for v in mesh.vertices]
    return [mat @ v for v in verts[::step]]


def signed_volume(obj):
    """Signed volume of world-space mesh; negative suggests inward normals."""
    mesh = obj.data
    mat = obj.matrix_world
    total = 0.0
    verts = mesh.vertices
    for poly in mesh.polygons:
        idx = poly.vertices
        if len(idx) < 3:
            continue
        a = mat @ verts[idx[0]].co
        for i in range(1, len(idx) - 1):
            b = mat @ verts[idx[i]].co
            c = mat @ verts[idx[i + 1]].co
            total += a.dot(b.cross(c)) / 6.0
    return total


def bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def xy_overlap(a_lo, a_hi, b_lo, b_hi):
    dx = min(a_hi.x, b_hi.x) - max(a_lo.x, b_lo.x)
    dy = min(a_hi.y, b_hi.y) - max(a_lo.y, b_lo.y)
    if dx <= 0 or dy <= 0:
        return 0.0
    return dx * dy


def is_placeholder(mat):
    if mat is None:
        return True
    if mat.name in ("Material", "Material.001", "Default") or mat.name.startswith("Material."):
        return True
    if not mat.use_nodes:
        return False
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return False
    base = bsdf.inputs["Base Color"].default_value
    rough = bsdf.inputs["Roughness"].default_value
    metallic = bsdf.inputs["Metallic"].default_value
    has_texture = any(
        getattr(n, "image", None) is not None for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"
    )
    near_default = (
        abs(base[0] - 0.8) < 0.02 and abs(base[1] - 0.8) < 0.02 and abs(base[2] - 0.8) < 0.02
        and abs(rough - 0.5) < 0.02 and metallic == 0
    )
    return near_default and not has_texture


def audit_asset(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    if not meshes:
        return {"path": path, "error": "no meshes"}

    report = {"path": path, "meshes": len(meshes), "issues": [], "warnings": []}

    # Triangles + degenerate faces + non-manifold edges.
    tris = 0
    degenerate = 0
    nonmanifold_edges = 0
    flipped_volume = []
    for obj in meshes:
        mesh = obj.data
        tris += sum(len(p.vertices) - 2 for p in mesh.polygons)
        for p in mesh.polygons:
            if p.area <= 1e-9:
                degenerate += 1
        # count faces per edge key
        from collections import Counter
        edge_faces = Counter()
        for p in mesh.polygons:
            n = len(p.vertices)
            for i in range(n):
                a, b = p.vertices[i], p.vertices[(i + 1) % n]
                edge_faces[tuple(sorted((a, b)))] += 1
        nonmanifold_edges += sum(1 for c in edge_faces.values() if c > 2)
        vol = signed_volume(obj)
        if vol < 0:
            flipped_volume.append(obj.name)

    report["triangles"] = tris
    if degenerate:
        report["issues"].append(f"degenerate_faces:{degenerate}")
    if nonmanifold_edges:
        report["warnings"].append(f"nonmanifold_edges:{nonmanifold_edges}")
    if flipped_volume:
        closed_share = len(flipped_volume) / max(1, len(meshes))
        if closed_share > 0.5:
            report["issues"].append(f"flipped_normals_on_{len(flipped_volume)}_of_{len(meshes)}_meshes")
        elif flipped_volume:
            report["warnings"].append(f"negative_volume_parts:{len(flipped_volume)}")

    # Duplicate object geometry (z-fighting / double-mesh suspicion).
    sig_map = {}
    for obj in meshes:
        verts = mesh_world_verts(obj)
        n = len(verts)
        if n == 0:
            continue
        step = max(1, n // 64)
        sample = tuple(round(c, 3) for v in verts[::step] for c in (v.x, v.y, v.z))
        key = (obj.data.name, len(obj.data.polygons), sample)
        sig_map.setdefault(key, []).append(obj.name)
    dupes = [names for names in sig_map.values() if len(names) > 1]
    if dupes:
        report["warnings"].append(f"duplicate_mesh_instances:{len(dupes)}")

    # Floating disconnected parts: nothing below with overlapping XY footprint.
    boxes = {o.name: bbox(o) for o in meshes}
    all_lo_z = min(lo.z for lo, _ in boxes.values())
    all_hi_z = max(hi.z for _, hi in boxes.values())
    height = max(all_hi_z - all_lo_z, 1e-6)
    floating = []
    for name, (lo, hi) in boxes.items():
        if lo.z - all_lo_z < 0.12 * height:
            continue  # touches near ground level already
        area = max((hi.x - lo.x) * (hi.y - lo.y), 1e-9)
        supported = False
        for other, (plo, phi) in boxes.items():
            if other == name or phi.z <= lo.z + 1e-6:
                continue
            if phi.z > lo.z and plo.z < hi.z:
                supported = True  # vertically interleaved with other geometry
                break
            if xy_overlap(lo, hi, plo, phi) > 0.3 * area:
                supported = True
                break
        if not supported:
            floating.append(name)
    if floating:
        report["warnings"].append(f"floating_parts:{len(floating)}:{','.join(floating[:5])}")

    # Placeholder materials.
    mats = {s.material for o in meshes for s in o.material_slots if s.material}
    placeholders = sorted(m.name for m in mats if is_placeholder(m))
    if placeholders:
        report["issues"].append(f"placeholder_materials:{','.join(placeholders[:6])}")
    report["materials"] = sorted(m.name for m in mats)
    return report


def main():
    assets, out, all_assets = parse_args()
    if all_assets or not assets:
        assets = collect_glbs(True)
    results = []
    for path in assets:
        try:
            results.append(audit_asset(path))
            print(f"[geo] audited {path}")
        except Exception as exc:  # noqa: BLE001
            results.append({"path": path, "error": str(exc)})
            print(f"[geo] ERROR {path}: {exc}")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w") as fh:
        json.dump({"generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z", "assets": results}, fh, indent=1)
    bad = [r for r in results if r.get("issues")]
    print(f"[geo] done: {len(results)} assets, {len(bad)} with issues -> {out}")


main()
