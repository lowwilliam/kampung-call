"""Re-export the alfa GLB from the cleaned .blend (Draco, selection only)."""

import bpy
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GLB = os.path.join(ROOT, "assets", "alfa-romeo-giulia-spider-v2.glb")
CAR_ROOT_NAME = "1963 Alfa Romeo Giulia Spider"


def descendants(root):
    stack = [root]
    out = []
    while stack:
        obj = stack.pop()
        out.append(obj)
        stack.extend(obj.children)
    return out


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
print("[alfa-export] exported", GLB)
