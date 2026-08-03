import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
BLEND = os.path.join(ASSETS, "hdb-call-kit.blend")
GLB = os.path.join(ASSETS, "hdb-call-v2.glb")
PREVIEW = os.path.join(ASSETS, "hdb-call-kit-preview.png")


def mat(name, color, rough=.78, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    return m


INK = mat("Ink charcoal", (.035, .045, .045), .58)
CREAM = mat("HDB cream", (.88, .82, .66), .86)
WHITE = mat("Chalk white", (.94, .91, .80), .86)
TEAL = mat("Block teal", (.04, .40, .39), .72)
CORAL = mat("Corridor coral", (.68, .20, .13), .78)
YELLOW = mat("Wayfinding yellow", (.95, .60, .09), .72)
GLASS = mat("Smoky glass", (.06, .24, .28), .24, .1)
CONCRETE = mat("Warm concrete", (.53, .53, .46), .92)
METAL = mat("Service metal", (.27, .32, .31), .42, .24)
GREEN1 = mat("Plant deep", (.06, .28, .15), .88)
GREEN2 = mat("Plant light", (.28, .55, .23), .88)
BLUE = mat("Laundry blue", (.11, .39, .57), .8)
PINK = mat("Laundry pink", (.80, .36, .40), .8)
ROAD = mat("Void deck asphalt", (.17, .20, .19), .94)


def bevel(obj, width=.06, segments=3):
    mod = obj.modifiers.new("Soft illustrated edge", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cube(name, loc, scale, material, width=.06, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if width:
        bevel(o, width)
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def cylinder(name, loc, radius, depth, material, vertices=16, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bevel(o, min(radius * .22, .05), 2)
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def ico(name, loc, radius, material, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def text(body, loc, size, material, rot=(math.radians(90), 0, 0), parent=None, align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = "Sign " + body
    o.data.body = body
    o.data.align_x = align
    o.data.size = size
    o.data.extrude = .018
    o.data.bevel_depth = .008
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def empty(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    return o


def descendants(root):
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def optimise_static_kit(root):
    """Collapse the static kit to one mesh per material for cheap web rendering."""
    # Text exports as many tiny primitives, so make it ordinary mesh geometry first.
    for obj in list(descendants(root)):
        if obj.type in {"FONT", "CURVE"}:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.convert(target="MESH")
            obj.select_set(False)

    groups = {}
    for obj in descendants(root):
        if obj.type != "MESH":
            continue
        material = obj.data.materials[0] if obj.data.materials else None
        groups.setdefault(material, []).append(obj)

    for material, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = "HDB " + (material.name if material else "unpainted")
        active.parent = root


def build_hdb():
    h = empty("BLK 65 HDB CALL KIT")
    # Ground and strong vertical massing.
    cube("Main residential slab", (0, .45, 5.0), (3.15, 1.55, 3.95), CREAM, .14, parent=h)
    cube("Stair core", (-3.55, .58, 4.65), (.62, 1.40, 4.25), TEAL, .16, parent=h)
    cube("Lift core", (3.18, 1.02, 4.65), (.55, 1.0, 4.25), CORAL, .14, parent=h)
    # Open void deck gives the block a Island silhouette.
    cube("Void deck shadow", (0, -.10, .92), (3.02, 1.36, .70), ROAD, .12, parent=h)
    for x in (-2.55, -1.25, .05, 1.35, 2.55):
        cylinder("Void deck column", (x, -.45, 1.05), .15, 1.92, WHITE, 14, parent=h)
        cube("Column mosaic", (x, -.61, 1.05), (.18, .05, .42), TEAL if int((x+3)*10)%2 else CORAL, .025, parent=h)
    # Five corridor levels, deep ledges, and readable rail rhythm.
    for floor in range(5):
        z = 2.25 + floor * 1.35
        cube("Corridor slab", (0, -1.45, z-.56), (3.05, .48, .08), CONCRETE, .035, parent=h)
        cube("Corridor shadow band", (0, -1.03, z), (3.05, .05, .50), TEAL if floor % 2 else CORAL, .02, parent=h)
        cube("Corridor rail cap", (0, -1.92, z-.12), (3.0, .04, .04), INK, .012, parent=h)
        for x in (-2.75, -2.25, -1.75, -1.25, -.75, -.25, .25, .75, 1.25, 1.75, 2.25, 2.75):
            cube("Corridor baluster", (x, -1.91, z-.33), (.025, .03, .23), INK, .008, parent=h)
        # Three homes per corridor.
        for unit, x in enumerate((-2.0, 0, 2.0), start=1):
            cube("Unit door", (x, -1.13, z), (.35, .035, .47), INK, .025, parent=h)
            cube("Door inset", (x, -1.18, z), (.29, .018, .40), TEAL if (unit+floor)%2 else CORAL, .015, parent=h)
            text(str(650 + floor*3 + unit), (x, -1.205, z+.26), .10, YELLOW, parent=h)
            cube("Louvre window", (x+.67, -1.12, z+.02), (.25, .035, .30), GLASS, .018, parent=h)
            for l in (-.18, -.06, .06, .18):
                cube("Window louvre", (x+.67, -1.17, z+l), (.24, .015, .012), WHITE, .006, parent=h)
        # AC units and laundry make floors feel inhabited.
        for i, x in enumerate((-2.55, -1.15, 1.05, 2.52)):
            cube("AC condenser", (x, 2.05, z), (.24, .25, .20), METAL, .045, parent=h)
            cylinder("AC fan", (x, 1.79, z), .13, .025, INK, 12, parent=h, rot=(math.radians(90), 0, 0))
        for i, x in enumerate((-1.55, .55, 1.55)):
            colour = (BLUE, PINK, WHITE)[(i+floor)%3]
            cube("Laundry", (x, -2.02, z+.22), (.25, .025, .24), colour, .012,
                 rot=(0, 0, math.radians((-4+i*5))), parent=h)
    # Stair perforations and rooftop services.
    for floor in range(6):
        z = 1.85 + floor * 1.22
        for xoff in (-.18, .18):
            cube("Stair breeze block", (-3.55+xoff, -1.0, z), (.11, .035, .22), INK, .025, rot=(0, 0, math.radians(45)), parent=h)
    cube("Roof crown", (0, .45, 9.10), (3.28, 1.68, .16), WHITE, .10, parent=h)
    cylinder("Roof water tank", (1.75, .55, 9.78), .62, 1.08, METAL, 18, parent=h)
    cylinder("Tank cap", (1.75, .55, 10.38), .66, .12, TEAL, 18, parent=h)
    cube("Lift motor room", (-.15, .6, 9.70), (.75, .78, .48), CORAL, .10, parent=h)
    # Hero signage and service interaction area at the void deck.
    cube("Block sign panel", (-2.0, -1.62, 1.15), (.78, .08, .58), TEAL, .07, parent=h)
    text("BLK\n65", (-2.0, -1.72, 1.20), .34, WHITE, parent=h)
    cube("Fibre riser cabinet", (.95, -1.62, 1.20), (.42, .12, .68), METAL, .07, parent=h)
    cube("Riser inset", (.95, -1.76, 1.23), (.34, .02, .55), INK, .02, parent=h)
    text("FIBRE\nRISER", (.95, -1.80, 1.25), .12, YELLOW, parent=h)
    cube("ONT shelf", (1.95, -1.62, 1.05), (.48, .18, .10), WHITE, .035, parent=h)
    cube("ONT", (1.95, -1.82, 1.40), (.34, .08, .24), WHITE, .055, parent=h)
    for i, colour in enumerate((GREEN2, YELLOW, CORAL)):
        cylinder("ONT status LED", (1.77+i*.18, -1.92, 1.42), .025, .025, colour, 10, parent=h, rot=(math.radians(90),0,0))
    # Void deck social detail.
    cylinder("Stone table", (-.20, -.65, .82), .52, .12, CONCRETE, 18, parent=h)
    cylinder("Table leg", (-.20, -.65, .52), .10, .58, CONCRETE, 14, parent=h)
    for angle in (0, math.pi/2, math.pi, math.pi*1.5):
        x, y = -.20 + math.cos(angle)*.92, -.65 + math.sin(angle)*.72
        cylinder("Stone stool", (x, y, .52), .24, .42, CONCRETE, 14, parent=h)
    for x in (-2.65, 2.62):
        cube("Planter", (x, -1.72, .48), (.38, .34, .30), CONCRETE, .07, parent=h)
        ico("Planter foliage", (x, -1.72, .98), .48, GREEN1 if x < 0 else GREEN2, (1.0,.82,1.2), parent=h)
    return h


def export_root(root):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True,
                              export_animations=False, export_yup=True, export_apply=True,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6)


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1050
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW
    scene.world.color = (.06, .27, .29)
    scene.view_settings.look = "AgX - Medium High Contrast"
    cube("Preview ground", (0, 0, -.28), (5.5, 4.4, .24), CONCRETE, .28)
    cube("Preview road", (0, -3.2, .02), (5.2, 1.1, .10), ROAD, .18)
    bpy.ops.object.camera_add(location=(14.5, -19.0, 12.5))
    cam = bpy.context.object
    cam.data.lens = 58
    target = Vector((0, .1, 4.5))
    cam.rotation_euler = (target-cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for kind, loc, energy, size, colour in (
        ("AREA", (-7,-8,17), 1700, 9, (1.0,.72,.50)),
        ("AREA", (8,2,12), 1150, 10, (.42,.72,1.0)),
        ("AREA", (0,8,8), 900, 7, (.58,1.0,.72)),
    ):
        bpy.ops.object.light_add(type=kind, location=loc)
        l=bpy.context.object;l.data.energy=energy;l.data.size=size;l.data.color=colour


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    root = build_hdb()
    setup_render()
    optimise_static_kit(root)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    export_root(root)
    bpy.context.scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("Created", BLEND)
    print("Created", GLB)
    print("Created", PREVIEW)


main()
