import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
BLEND = os.path.join(ASSETS, "hero-neighbourhood.blend")
GLB = os.path.join(ASSETS, "hero-neighbourhood.glb")
PREVIEW = os.path.join(ASSETS, "hero-neighbourhood-preview.png")
LANDED_V2 = os.path.join(ASSETS, "landed-v2.glb")
RAINTREE_V2 = os.path.join(ASSETS, "raintree-v2.glb")
VAN_V2 = os.path.join(ASSETS, "service-van-v2.glb")
ENGINEER_V2 = os.path.join(ASSETS, "engineer-v2.glb")


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass


def material(name, color, rough=.72, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    return m


INK = material("Ink charcoal", (.035, .045, .045), .58)
CREAM = material("Sun-warmed plaster", (.86, .80, .66), .82)
WHITE = material("Chalk white", (.92, .89, .78), .84)
TEAL = material("Weathered teal", (.055, .42, .40), .7)
DEEP_TEAL = material("Deep teal", (.025, .22, .23), .64)
CORAL = material("Terracotta coral", (.67, .18, .11), .78)
YELLOW = material("Signal yellow", (.94, .57, .08), .7)
WOOD = material("Dark meranti", (.30, .12, .055), .72)
GLASS = material("Smoky glass", (.06, .24, .27), .22, .12)
ROAD = material("Warm asphalt", (.17, .20, .19), .92)
CONCRETE = material("Concrete", (.54, .54, .47), .9)
GREEN1 = material("Rain tree green", (.13, .38, .19), .84)
GREEN2 = material("Sunlit leaf", (.30, .56, .25), .86)
GREEN3 = material("Deep leaf", (.055, .25, .15), .88)
SKIN = material("Warm skin", (.62, .34, .20), .8)
UNIFORM = material("Field navy", (.035, .12, .17), .78)
RUBBER = material("Tyre", (.018, .022, .022), .94)
METAL = material("Painted metal", (.22, .28, .27), .42, .28)
SOIL = material("Red earth", (.31, .14, .07), .98)


def apply_bevel(obj, width=.08, segments=3):
    bevel = obj.modifiers.new("Soft illustrated edge", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in obj.data.polygons:
        p.use_smooth = False
    return obj


def cube(name, loc, scale, mat, bevel=.08, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        apply_bevel(o, bevel)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def cylinder(name, loc, radius, depth, mat, vertices=16, rot=(0, 0, 0), parent=None, bevel=.03):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        apply_bevel(o, bevel, 2)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def ico(name, loc, radius, mat, subdivisions=2, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def curve_tube(name, points, radius, mat, parent=None):
    c = bpy.data.curves.new(name, "CURVE")
    c.dimensions = "3D"
    c.resolution_u = 2
    c.bevel_depth = radius
    c.bevel_resolution = 2
    spline = c.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def text_obj(body, loc, size, mat, extrude=.015, align="CENTER", rot=(math.radians(90), 0, 0), parent=None):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = "Lettering " + body
    o.data.body = body
    o.data.align_x = align
    o.data.size = size
    o.data.extrude = extrude
    o.data.bevel_depth = .008
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def empty(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    return o


def build_base(root):
    cylinder("Diorama earth", (0, 0, -.65), 8.4, 1.3, SOIL, 24, parent=root, bevel=.12)
    cylinder("Diorama turf", (0, 0, .02), 8.1, .25, GREEN2, 24, parent=root, bevel=.14)
    cube("Neighbourhood road", (0, -2.3, .22), (7.55, 2.0, .16), ROAD, .32, rot=(0, 0, math.radians(-5)), parent=root)
    cube("House verge", (1.2, 1.0, .30), (4.5, 2.55, .16), CONCRETE, .22, parent=root)
    for x in (-6.3, -3.3, -.3, 2.7, 5.7):
        cube("Broken centre line", (x, -2.3, .42), (.62, .06, .012), YELLOW, .025,
             rot=(0, 0, math.radians(-5)), parent=root)
    for x in (-6.8, 6.8):
        cube("Road edge marker", (x, -4.0, .43), (.58, .08, .025), WHITE, .025,
             rot=(0, 0, math.radians(-5)), parent=root)


def build_house(root):
    h = empty("Hero landed home")
    h.parent = root
    cube("Ground plaster", (1.55, 1.65, 1.45), (2.7, 1.75, 1.15), CREAM, .18, parent=h)
    cube("Upper volume", (1.1, 1.9, 3.45), (2.25, 1.45, .92), WHITE, .18, parent=h)
    cube("Recess shadow", (1.7, -.12, 1.45), (1.7, .08, .78), DEEP_TEAL, .025, parent=h)
    cube("Entry door", (.10, -.22, 1.35), (.48, .07, .88), WOOD, .045, parent=h)
    cube("Door frame", (.10, -.31, 1.35), (.62, .035, 1.02), INK, .025, parent=h)
    cube("Door leaf", (.10, -.38, 1.35), (.49, .035, .88), WOOD, .025, parent=h)
    cylinder("Door handle", (.38, -.44, 1.35), .035, .10, YELLOW, 12, rot=(math.radians(90), 0, 0), parent=h)
    for x in (1.0, 2.25, 3.5):
        cube("Living window", (x, -.25, 1.55), (.48, .045, .62), GLASS, .035, parent=h)
        cube("Window brow", (x, -.36, 2.24), (.60, .16, .07), CORAL, .035, parent=h)
        cube("Window mullion", (x, -.33, 1.55), (.025, .03, .61), WHITE, .012, parent=h)
    cube("Balcony slab", (1.6, .15, 2.77), (1.7, .62, .09), CORAL, .055, parent=h)
    for x in (.20, .60, 1.00, 1.40, 1.80, 2.20, 2.60, 3.00):
        cube("Balcony rail", (x, -.48, 3.13), (.025, .035, .34), INK, .01, parent=h)
    cube("Rail cap", (1.6, -.48, 3.48), (1.62, .035, .035), INK, .012, parent=h)
    for x in (-.65, -.32, .01):
        cube("Timber screen", (x, .02, 3.55), (.07, .16, .74), WOOD, .025, rot=(0, 0, math.radians(-5)), parent=h)
    # Strong, asymmetrical tropical roof silhouette.
    cube("Low roof left", (.10, 1.63, 4.67), (1.75, 2.0, .13), CORAL, .055,
         rot=(0, math.radians(-18), 0), parent=h)
    cube("High roof right", (2.55, 1.73, 4.82), (1.72, 2.05, .13), CORAL, .055,
         rot=(0, math.radians(22), 0), parent=h)
    for y in (.25, .75, 1.25, 1.75, 2.25, 2.75, 3.25):
        cube("Roof tile seam", (2.58, y, 4.86), (1.70, .018, .018), INK, .006,
             rot=(0, math.radians(22), 0), parent=h)
    cube("Car porch canopy", (-1.05, .65, 2.18), (1.28, 1.55, .12), DEEP_TEAL, .08, parent=h)
    for x in (-2.12, .02):
        cylinder("Porch post", (x, -.68, 1.25), .075, 1.86, INK, 12, parent=h)
    # Local service-story detail.
    cube("Fibre service box", (4.33, .45, 1.45), (.18, .09, .28), WHITE, .035, parent=h)
    text_obj("FIBRE", (4.34, .345, 1.48), .11, CORAL, .006, rot=(math.radians(90), 0, 0), parent=h)
    curve_tube("Fibre drop", [(4.35, .48, 1.65), (4.48, .8, 2.6), (4.30, 1.2, 4.45)], .018, INK, parent=h)
    for z in (1.2, 2.0):
        cube("Aircon condenser", (4.34, 2.6, z), (.28, .45, .25), METAL, .055, parent=h)
        cylinder("Aircon fan", (4.05, 2.6, z), .16, .035, INK, 12, rot=(0, math.radians(90), 0), parent=h)
    text_obj("17", (-.52, -.42, 1.85), .27, YELLOW, .025, rot=(math.radians(90), 0, 0), parent=h)
    # Planter rhythm softens the architecture.
    for i, x in enumerate((-.8, .15, 1.1, 2.05, 3.0, 3.95)):
        cube("Verge planter", (x, -.60, .68), (.32, .28, .24), CONCRETE, .07, parent=h)
        ico("Planter shrub", (x, -.60, 1.08), .42, GREEN1 if i % 2 else GREEN3, 2,
            scale=(1, .82, 1.15), parent=h)
    return h


def build_van(root):
    v = empty("Field service van")
    v.parent = root
    v.rotation_euler.z = math.radians(-7)
    cube("Van body", (-3.35, -2.25, 1.35), (1.55, .86, .88), CORAL, .22, parent=v)
    cube("Van cab", (-1.95, -2.25, 1.20), (.72, .84, .70), CORAL, .20, parent=v)
    cube("Windshield", (-1.91, -3.10, 1.52), (.48, .025, .35), GLASS, .04, rot=(math.radians(-8), 0, 0), parent=v)
    cube("Side window", (-1.90, -2.24, 1.52), (.025, .72, .34), GLASS, .04, parent=v)
    cube("Van cream panel", (-3.55, -3.12, 1.40), (.92, .025, .44), WHITE, .04, parent=v)
    text_obj("FIELD\nCALL", (-3.55, -3.16, 1.52), .28, DEEP_TEAL, .012,
             rot=(math.radians(90), 0, 0), parent=v)
    cube("Roof beacon", (-2.20, -2.25, 2.02), (.28, .22, .08), YELLOW, .045, parent=v)
    for x in (-3.95, -2.25, -1.65):
        for y in (-3.02, -1.48):
            cylinder("Van wheel", (x, y, .72), .37, .20, RUBBER, 20,
                     rot=(math.radians(90), 0, 0), parent=v)
            cylinder("Wheel hub", (x, y - (.12 if y < -2 else -.12), .72), .17, .22, YELLOW, 16,
                     rot=(math.radians(90), 0, 0), parent=v)
    cube("Rear bumper", (-4.92, -2.25, .82), (.12, .78, .12), INK, .05, parent=v)
    return v


def build_engineer(root):
    e = empty("Field engineer")
    e.parent = root
    e.rotation_euler.z = math.radians(-10)
    base = Vector((-1.0, -1.05, .5))
    cylinder("Engineer torso", base + Vector((0, 0, 1.35)), .42, 1.0, UNIFORM, 16, parent=e, bevel=.07)
    ico("Engineer head", base + Vector((0, 0, 2.22)), .39, SKIN, 2, scale=(.9, .84, 1.05), parent=e)
    cube("Engineer cap crown", base + Vector((0, 0, 2.55)), (.38, .34, .12), CORAL, .08, parent=e)
    cube("Engineer cap brim", base + Vector((0, -.32, 2.48)), (.30, .26, .04), CORAL, .04, parent=e)
    for x in (-.26, .26):
        cylinder("Engineer leg", base + Vector((x, 0, .58)), .15, .78, DEEP_TEAL, 12, parent=e, bevel=.05)
        cube("Work boot", base + Vector((x, -.11, .14)), (.23, .32, .14), INK, .07, parent=e)
    for x in (-.52, .52):
        cylinder("Engineer arm", base + Vector((x, 0, 1.42)), .12, .82, SKIN, 12,
                 rot=(0, math.radians(10 * (-1 if x < 0 else 1)), 0), parent=e, bevel=.04)
    cube("Tool satchel", base + Vector((.62, .05, 1.0)), (.24, .35, .42), YELLOW, .07, parent=e)
    curve_tube("Satchel strap", [base + Vector((-.18, 0, 1.82)), base + Vector((.2, -.08, 1.45)), base + Vector((.55, 0, 1.08))], .035, WOOD, parent=e)
    return e


def build_tree(root, x, y, s=1.0):
    t = empty("Layered rain tree")
    t.parent = root
    curve_tube("Curved trunk", [(x, y, .15), (x + .16*s, y, 1.45*s), (x - .10*s, y, 2.55*s)], .22*s, WOOD, parent=t)
    # Broad rain-tree limbs must remain visible beneath the crown from orbit views.
    curve_tube("Left scaffold limb", [(x, y, 2.05*s), (x-.55*s, y-.04*s, 2.62*s), (x-1.35*s, y+.02*s, 2.86*s)], .115*s, WOOD, parent=t)
    curve_tube("Right scaffold limb", [(x+.02*s, y, 2.18*s), (x+.62*s, y+.08*s, 2.72*s), (x+1.48*s, y-.05*s, 2.90*s)], .105*s, WOOD, parent=t)
    curve_tube("Rear scaffold limb", [(x, y+.02*s, 2.20*s), (x-.10*s, y+.62*s, 2.70*s), (x+.12*s, y+1.05*s, 2.92*s)], .09*s, WOOD, parent=t)
    clusters = [
        (-1.50, -.06, 3.02, .86), (-.82, -.12, 3.25, 1.02),
        (0.02, -.16, 3.48, 1.10), (.88, -.06, 3.29, .98),
        (1.55, .03, 3.02, .82), (-.62, .62, 3.12, .82),
        (.35, .72, 3.18, .90),
    ]
    for i, (dx, dy, z, r) in enumerate(clusters):
        ico("Canopy cluster", (x+dx*s, y+dy*s, z*s), r*s, (GREEN1, GREEN2, GREEN3)[i % 3], 2,
            scale=(1.28, .86, .58), parent=t)
    return t


def descendants(root):
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def export_component(root, filepath, offset):
    original = root.location.copy()
    root.location = Vector(offset)
    bpy.context.view_layer.update()
    lowest = min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in descendants(root)
        if obj.type in {"MESH", "CURVE", "FONT"}
        for corner in obj.bound_box
    )
    root.location.z -= lowest
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=filepath, export_format="GLB", use_selection=True,
                              export_animations=False, export_yup=True, export_apply=True,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6)
    root.location = original
    bpy.context.view_layer.update()


def build_street_details(root):
    # Utility pole and sagging cables frame the composition.
    cylinder("Utility pole", (5.85, -.15, 2.25), .12, 4.5, WOOD, 14, parent=root)
    cube("Utility crossbar", (5.85, -.15, 4.22), (.72, .10, .10), INK, .035, parent=root)
    for x in (5.25, 5.85, 6.45):
        cylinder("Ceramic insulator", (x, -.15, 4.42), .07, .22, WHITE, 12, parent=root)
    curve_tube("Street cable", [(-7, -.18, 4.65), (-1, -.42, 4.15), (5.85, -.15, 4.42), (8, .1, 4.55)], .025, INK, parent=root)
    # Graphic streetlight, post box and address sign.
    curve_tube("Streetlight neck", [(-5.7, -1.0, .5), (-5.7, -1.0, 3.25), (-5.1, -1.0, 3.55)], .07, INK, parent=root)
    cube("Streetlight head", (-4.87, -1.0, 3.53), (.32, .18, .11), YELLOW, .06, parent=root)
    cube("Post box", (5.2, -3.75, .92), (.42, .35, .72), TEAL, .12, parent=root)
    cube("Post slot", (5.2, -4.12, 1.05), (.24, .025, .04), INK, .015, parent=root)
    text_obj("17", (5.2, -4.15, .68), .19, WHITE, .01, rot=(math.radians(90), 0, 0), parent=root)
    # Small narrative props.
    cube("Tool case", (-.10, -1.48, .55), (.48, .22, .18), YELLOW, .07, rot=(0, 0, math.radians(8)), parent=root)
    curve_tube("Loose network lead", [(-.52, -1.55, .65), (-.15, -1.8, .48), (.36, -1.55, .55)], .025, CORAL, parent=root)


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 780
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW
    scene.render.film_transparent = False
    scene.world.color = (.055, .28, .30)
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.camera_add(location=(14.8, -17.8, 13.2))
    cam = bpy.context.object
    cam.name = "Hero isometric camera"
    cam.data.lens = 56
    target = Vector((.25, .20, 1.55))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    bpy.ops.object.light_add(type="AREA", location=(-6, -8, 15))
    key = bpy.context.object
    key.name = "Warm key"
    key.data.energy = 1500
    key.data.shape = "DISK"
    key.data.size = 8
    key.data.color = (1.0, .72, .50)
    key.rotation_euler = (math.radians(20), 0, math.radians(-25))

    bpy.ops.object.light_add(type="AREA", location=(8, 3, 10))
    fill = bpy.context.object
    fill.name = "Cool fill"
    fill.data.energy = 1050
    fill.data.size = 10
    fill.data.color = (.40, .72, 1.0)

    bpy.ops.object.light_add(type="AREA", location=(0, 7, 5))
    rim = bpy.context.object
    rim.name = "Neighbourhood rim"
    rim.data.energy = 850
    rim.data.size = 6
    rim.data.color = (.65, 1.0, .72)


def main():
    reset()
    root = empty("HERO NEIGHBOURHOOD — hand-inked direction")
    build_base(root)
    house = build_house(root)
    van = build_van(root)
    engineer = build_engineer(root)
    tree = build_tree(root, -5.4, 1.7, 1.05)
    build_tree(root, 6.1, 2.7, .78)
    build_street_details(root)
    setup_scene()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True,
                              export_animations=False, export_yup=True, export_apply=True)
    export_component(house, LANDED_V2, (-1.55, -1.65, 0))
    export_component(tree, RAINTREE_V2, (5.4, -1.7, 0))
    export_component(van, VAN_V2, (3.25, 2.25, -.35))
    export_component(engineer, ENGINEER_V2, (1.0, 1.05, -.5))
    bpy.context.scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("Created", BLEND)
    print("Created", GLB)
    print("Created", PREVIEW)
    print("Created", LANDED_V2)
    print("Created", RAINTREE_V2)
    print("Created", VAN_V2)
    print("Created", ENGINEER_V2)


if __name__ == "__main__":
    main()
