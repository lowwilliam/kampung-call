import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ASSETS, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0.0, roughness=0.72):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m

NAVY = material("Islandlink Navy", (0.035, 0.075, 0.12))
ORANGE = material("Hi-vis Orange", (1.0, 0.29, 0.045))
REFLECT = material("Reflective Tape", (0.78, 0.86, 0.82), metallic=0.15, roughness=0.3)
SKIN = material("Skin", (0.58, 0.29, 0.16))
HAIR = material("Hair", (0.035, 0.025, 0.02))
BLACK = material("Work Boots", (0.025, 0.03, 0.035))
TOOL = material("Tool Belt", (0.07, 0.06, 0.05))
METAL = material("Tool Metal", (0.28, 0.33, 0.35), metallic=0.6, roughness=0.3)
WHITE = material("Badge", (0.9, 0.93, 0.92))
RED = material("Islandlink Red", (0.78, 0.025, 0.02))

def bevel(obj, amount=0.035, segments=2):
    mod = obj.modifiers.new("Soft industrial edges", "BEVEL")
    mod.width = amount
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def cube(name, loc, scale, mat, bevel_width=0.035):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(o, bevel_width)
    o.data.materials.append(mat)
    return o

def uv_sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    return o

def cylinder(name, loc, radius, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    bevel(o, min(0.025, radius * 0.2), 2)
    o.data.materials.append(mat)
    return o

# Armature and a compact, readable game rig.
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
rig = bpy.context.object
rig.name = "CourierRig"
arm = rig.data
arm.name = "CourierRig"
root = arm.edit_bones[0]
root.name = "Root"
root.head, root.tail = Vector((0, 0, 0)), Vector((0, 0, 0.85))

def bone(name, head, tail, parent="Root"):
    b = arm.edit_bones.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.parent = arm.edit_bones[parent]
    return b

bone("Torso", (0, 0, .72), (0, 0, 1.52))
bone("Head", (0, 0, 1.48), (0, 0, 2.12), "Torso")
bone("Arm.L", (-.32, 0, 1.43), (-.32, 0, .72), "Torso")
bone("Arm.R", (.32, 0, 1.43), (.32, 0, .72), "Torso")
bone("Leg.L", (-.15, 0, .76), (-.15, 0, .08))
bone("Leg.R", (.15, 0, .76), (.15, 0, .08))
bpy.ops.object.mode_set(mode="OBJECT")
rig.show_in_front = True

parts = []
parts += [cube("Torso", (0, 0, 1.18), (.34, .22, .43), NAVY, .07)]
parts += [cube("VestFront", (0, -.235, 1.23), (.29, .025, .37), ORANGE, .018)]
parts += [cube("ReflectiveChest", (0, -.267, 1.24), (.30, .012, .035), REFLECT, .008)]
parts += [cube("ReflectiveWaist", (0, -.267, .99), (.30, .012, .03), REFLECT, .008)]
parts += [cube("Belt", (0, 0, .82), (.37, .235, .055), TOOL, .02)]
parts += [cube("Pouch.L", (-.27, -.23, .72), (.11, .07, .14), TOOL, .025)]
parts += [cube("Pouch.R", (.27, -.23, .72), (.11, .07, .14), TOOL, .025)]
parts += [uv_sphere("Head", (0, 0, 1.83), (.27, .25, .30), SKIN)]
parts += [uv_sphere("HairCap", (0, .015, 2.01), (.275, .255, .15), HAIR)]
parts += [cube("SafetyCap", (0, -.03, 2.09), (.29, .28, .055), ORANGE, .045)]
parts += [cube("CapBrim", (0, -.275, 2.065), (.25, .16, .025), ORANGE, .025)]
parts += [cube("IDBadge", (.15, -.276, 1.38), (.075, .012, .105), WHITE, .01)]
parts += [cube("BadgeStripe", (.15, -.29, 1.40), (.06, .008, .018), RED, .005)]
parts += [cylinder("Arm.L", (-.43, 0, 1.08), .105, .68, SKIN)]
parts += [cylinder("Arm.R", (.43, 0, 1.08), .105, .68, SKIN)]
parts += [cube("Sleeve.L", (-.43, 0, 1.38), (.14, .14, .18), NAVY, .05)]
parts += [cube("Sleeve.R", (.43, 0, 1.38), (.14, .14, .18), NAVY, .05)]
parts += [cylinder("Leg.L", (-.15, 0, .45), .13, .70, NAVY)]
parts += [cylinder("Leg.R", (.15, 0, .45), .13, .70, NAVY)]
parts += [cube("Boot.L", (-.15, -.07, .10), (.16, .25, .11), BLACK, .045)]
parts += [cube("Boot.R", (.15, -.07, .10), (.16, .25, .11), BLACK, .045)]
parts += [cylinder("Screwdriver", (.34, -.31, .79), .025, .34, RED, 10)]
parts[-1].rotation_euler.x = math.radians(90)
parts += [cylinder("ScrewdriverTip", (.34, -.49, .79), .017, .10, METAL, 10)]
parts[-1].rotation_euler.x = math.radians(90)

bone_map = {
    "Head": "Head", "HairCap": "Head", "SafetyCap": "Head", "CapBrim": "Head",
    "Arm.L": "Arm.L", "Sleeve.L": "Arm.L", "Arm.R": "Arm.R", "Sleeve.R": "Arm.R",
    "Leg.L": "Leg.L", "Boot.L": "Leg.L", "Leg.R": "Leg.R", "Boot.R": "Leg.R",
}
for obj in parts:
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_map.get(obj.name, "Torso")
    obj.matrix_world = world

def make_action(name, frames, poses):
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame in frames:
        for bone_name, rotation in poses(frame).items():
            pb = rig.pose.bones[bone_name]
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = rotation
            pb.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    action.use_fake_user = True
    return action

idle = make_action("Idle", [1, 20, 40], lambda f: {
    "Torso": (0, 0, math.radians(1.5 if f == 20 else 0)),
    "Head": (math.radians(-2 if f == 20 else 0), 0, 0),
    "Arm.L": (math.radians(3 if f == 20 else 0), 0, 0),
    "Arm.R": (math.radians(-3 if f == 20 else 0), 0, 0),
})

def walk_pose(frame):
    phase = {1: 0, 7: 1, 13: 0, 19: -1, 25: 0}[frame]
    a = math.radians(28 * phase)
    return {"Arm.L": (a, 0, 0), "Arm.R": (-a, 0, 0),
            "Leg.L": (-a, 0, 0), "Leg.R": (a, 0, 0),
            "Torso": (0, 0, math.radians(2 * phase))}

walk = make_action("Walk", [1, 7, 13, 19, 25], walk_pose)
rig.animation_data.action = None

bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 40
bpy.context.scene.render.fps = 24
bpy.context.scene.unit_settings.system = "METRIC"

blend_path = os.path.join(ASSETS, "courier.blend")
gltf_path = os.path.join(ASSETS, "courier.glb")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=gltf_path,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_yup=True,
    export_apply=False,
)
print(f"Created {blend_path}")
print(f"Created {gltf_path}")
