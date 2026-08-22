"""Conservative geometry cleanup for shipping GLBs.

Per asset (only those listed as needing fixes):
  - delete zero-area (degenerate) faces
  - merge vertices closer than 1e-5 (welds cracks left by booleans)
  - recalculate outward normals ONLY on watertight-ish closed meshes whose
    signed volume is negative (clearly inward-facing shells)

Skips any file containing armatures/skinned meshes. Exports Draco GLB.

Usage:
  blender -b -P blender/cleanup_asset_geometry.py -- --assets a.glb b.glb
"""

import bpy
import bmesh
import json
import os
import sys


def parse_assets():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return [a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] != "--out")]


def has_rig(imported):
    if any(o.type == "ARMATURE" for o in imported):
        return True
    for o in imported:
        if o.type == "MESH" and (o.vertex_groups or o.parent and o.parent.type == "ARMATURE"):
            return True
    return False


def edge_face_counts(bm):
    counts = {}
    for f in bm.faces:
        for e in f.edges:
            counts[e.index] = counts.get(e.index, 0) + 1
    return counts


def cleanup_object(obj):
    """Returns dict of what was done."""
    done = {"degenerate": 0, "welded": 0, "normals_fixed": False}
    bm = bmesh.new()
    bm.from_mesh(obj.data)

    # Degenerate faces.
    degens = [f for f in bm.faces if f.calc_area() <= 1e-9]
    if degens:
        done["degenerate"] = len(degens)
        bmesh.ops.delete(bm, geom=degens, context="FACES_ONLY")

    # Weld micro-cracks.
    before_v = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    after_v = len(bm.verts)
    done["welded"] = max(0, before_v - after_v)

    # Normals: flip only clearly-inward closed shells.
    if len(bm.faces):
        counts = edge_face_counts(bm)
        total_edges = len(counts)
        closed_edges = sum(1 for c in counts.values() if c == 2)
        if total_edges > 0 and closed_edges / total_edges > 0.98:
            vol = bm.calc_volume(signed=True)
            if vol < 0:
                bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
                done["normals_fixed"] = True

    bm.to_mesh(obj.data)
    obj.data.update()
    bm.free()
    return done


def main():
    paths = parse_assets()
    summary = []
    for path in paths:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        before = set(bpy.data.objects)
        try:
            bpy.ops.import_scene.gltf(filepath=path)
        except Exception as exc:  # noqa: BLE001
            print(f"[cleanup] IMPORT FAIL {path}: {exc}")
            continue
        imported = [o for o in bpy.data.objects if o not in before]
        if has_rig(imported):
            print(f"[cleanup] SKIP rigged {path}")
            continue
        meshes = [o for o in imported if o.type == "MESH"]
        report = {"path": path, "objects": {}}
        for obj in meshes:
            res = cleanup_object(obj)
            if any(res.values()):
                report["objects"][obj.name] = res
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            export_animations=False,
            export_yup=True,
            export_apply=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
        )
        summary.append(report)
        changed = sum(len(r["objects"]) for r in [report])
        print(f"[cleanup] {path}: modified meshes={changed}")

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "review-shots", "commercial-review", "cleanup-report.json")
    with open(out, "w") as fh:
        json.dump(summary, fh, indent=1)
    print(f"[cleanup] wrote {out}")


main()
