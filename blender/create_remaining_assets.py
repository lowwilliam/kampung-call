import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
PREVIEWS = os.path.join(ASSETS, "previews")
os.makedirs(PREVIEWS, exist_ok=True)


def material(name, colour, rough=.8, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*colour, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*colour, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    return m


INK = material("Ink", (.025, .035, .035), .62)
CREAM = material("Warm plaster", (.77, .68, .49), .9)
CHALK = material("Chalk", (.92, .87, .72), .88)
TEAL = material("Deep teal", (.02, .26, .27), .76)
TEAL2 = material("Weathered teal", (.04, .46, .42), .8)
CORAL = material("Terracotta", (.62, .14, .09), .82)
YELLOW = material("Signal yellow", (.95, .53, .05), .74)
GLASS = material("Graphic glass", (.04, .24, .31), .25, .08)
CONCRETE = material("Concrete", (.48, .48, .42), .94)
METAL = material("Dark metal", (.18, .23, .23), .42, .28)
WOOD = material("Timber", (.37, .18, .08), .88)
WOOD2 = material("Sun timber", (.60, .34, .14), .86)
GREEN = material("Plant deep", (.035, .25, .12), .9)
GREEN2 = material("Plant mid", (.17, .46, .18), .9)
GREEN3 = material("Plant lime", (.43, .62, .18), .9)
RED = material("Singapore red", (.71, .05, .035), .75)
BLUE = material("Utility blue", (.08, .32, .54), .76)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def empty(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    return o


def bevel(obj, width=.05, segments=2):
    if width <= 0:
        return obj
    mod = obj.modifiers.new("Illustrated bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cube(name, loc, size, mat, parent, rot=(0, 0, 0), edge=.05):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(o, edge)
    o.data.materials.append(mat)
    o.parent = parent
    return o


def cyl(name, loc, radius, depth, mat, parent, vertices=14, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                       location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bevel(o, min(.045, radius*.18), 2)
    o.data.materials.append(mat)
    o.parent = parent
    return o


def ico(name, loc, radius, mat, parent, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    o.parent = parent
    return o


def label(body, loc, size, mat, parent, rot=(math.radians(90), 0, 0), align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = "Sign " + body.replace("\n", " ")
    o.data.body = body
    o.data.align_x = align
    o.data.align_y = "CENTER"
    o.data.size = size
    o.data.extrude = .018
    o.data.bevel_depth = .006
    o.data.materials.append(mat)
    o.parent = parent
    return o


def cable(name, points, radius, mat, parent):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = "AUTO"
        p.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    curve.materials.append(mat)
    o.parent = parent
    return o


def descendants(root):
    out = []
    for child in root.children:
        out.append(child)
        out.extend(descendants(child))
    return out


def optimise(root):
    for obj in list(descendants(root)):
        if obj.type in {"FONT", "CURVE"}:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
    groups = {}
    for obj in descendants(root):
        if obj.type == "MESH":
            key = obj.data.materials[0] if obj.data.materials else None
            groups.setdefault(key, []).append(obj)
    for mat, objs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        objs[0].name = root.name + " · " + (mat.name if mat else "Mesh")
        objs[0].parent = root


def export_asset(root, slug, camera_target=(0, 0, 2.5), camera=(11, -15, 9), ground=5.2):
    optimise(root)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 840
    scene.render.resolution_y = 680
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(PREVIEWS, slug + ".png")
    scene.world.color = (.045, .20, .21)
    scene.view_settings.look = "AgX - Medium High Contrast"

    preview = empty("PREVIEW ONLY")
    cube("Ground", (0, 0, -.18), (ground*2, ground*1.55, .3), CONCRETE, preview, edge=.22)
    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.data.lens = 55
    cam.rotation_euler = (Vector(camera_target)-cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for loc, energy, size, colour in (
        ((-7,-8,15), 1500, 8, (1,.72,.50)),
        ((8,2,11), 1050, 9, (.40,.72,1)),
        ((0,7,8), 700, 7, (.50,1,.70)),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = colour

    blend = os.path.join(ASSETS, slug + ".blend")
    glb = os.path.join(ASSETS, slug + ".glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True,
        export_animations=False, export_yup=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    bpy.ops.render.render(write_still=True)
    print("Created", glb)


def build_kampung():
    r = empty("UNCLE LIM KAMPUNG CALL KIT")
    # Raised timber house and deep shaded veranda.
    for x in (-2.2, -1.0, 1.0, 2.2):
        cyl("Hardwood stilt", (x, .45, .75), .13, 1.5, WOOD, r)
    cube("Raised floor", (0, .35, 1.48), (5.4, 3.7, .24), WOOD2, r, edge=.09)
    cube("Timber house", (0, .72, 2.72), (4.9, 2.7, 2.35), CREAM, r, edge=.10)
    # Board rhythm and shutters.
    for x in (-2.15,-1.65,-1.15,-.65,-.15,.35,.85,1.35,1.85,2.25):
        cube("Timber seam", (x, -.67, 2.72), (.035,.035,2.05), WOOD, r, edge=.006)
    for x in (-1.4, 1.35):
        cube("Window recess", (x, -.71, 2.92), (1.05,.08,.9), INK, r, edge=.035)
        for side in (-1, 1):
            cube("Painted shutter", (x+side*.48, -.80, 2.92), (.38,.08,.88), TEAL2, r,
                 rot=(0,0,side*math.radians(3)), edge=.035)
        for z in (2.64,2.84,3.04,3.24):
            cube("Window louvre", (x, -.79, z), (.85,.05,.035), CHALK, r, edge=.008)
    cube("Front door", (0, -.72, 2.62), (.85,.10,1.75), CORAL, r, edge=.055)
    label("37", (0, -.81, 3.18), .23, YELLOW, r)
    # Gable roof with broad tropical eaves.
    cube("Left roof sheet", (-1.42,.42,4.18), (3.25,4.25,.16), TEAL, r,
         rot=(0,math.radians(-25),0), edge=.07)
    cube("Right roof sheet", (1.42,.42,4.18), (3.25,4.25,.16), TEAL, r,
         rot=(0,math.radians(25),0), edge=.07)
    for y in (-1.35,-.55,.25,1.05,1.85):
        cube("Roof rib L", (-1.42,y,4.25), (3.1,.035,.04), CHALK, r,
             rot=(0,math.radians(-25),0), edge=.006)
        cube("Roof rib R", (1.42,y,4.25), (3.1,.035,.04), CHALK, r,
             rot=(0,math.radians(25),0), edge=.006)
    # Veranda, steps, fibre termination and cable drop.
    cube("Veranda deck", (0,-1.65,1.68), (5.1,1.15,.18), WOOD2, r, edge=.07)
    for x in (-2.2,-1.1,1.1,2.2):
        cyl("Veranda post", (x,-2.05,2.55), .075, 2.0, WOOD, r)
    cube("Veranda rail", (-1.55,-2.08,2.14), (1.25,.07,.07), INK, r, edge=.015)
    cube("Veranda rail", (1.55,-2.08,2.14), (1.25,.07,.07), INK, r, edge=.015)
    for i in range(3):
        cube("Entry step", (0,-2.35-i*.32,1.42-i*.22), (1.3,.42,.18), CONCRETE, r, edge=.055)
    cube("Fibre splice box", (2.02,-.82,2.18), (.48,.14,.60), METAL, r, edge=.055)
    label("FIBRE", (2.02,-.91,2.18), .10, YELLOW, r)
    cable("Fibre drop cable", [(-3.0,1.6,5.3),(-2.5,.7,4.8),(-1.0,-.4,4.5),(2.0,-.85,2.55)], .025, INK, r)
    cyl("Water drum", (-2.15,1.95,.75), .52, 1.25, BLUE, r, 18)
    for x in (-3.0,3.0):
        cyl("Banana trunk", (x,.7,1.05), .13, 2.1, WOOD2, r)
        for a in range(5):
            ico("Banana leaf", (x+math.cos(a*1.25)*.45,.7+math.sin(a*1.25)*.35,2.2), .62,
                (GREEN,GREEN2,GREEN3)[a%3], r, scale=(1.0,.28,.35))
    return r


def tower_shell(root, name, sign, accent, garden=False, point=False):
    # A readable skyline mass with a service-rich arrival zone.
    if point:
        cube("Point block shaft", (0,.55,4.8), (4.2,3.0,8.2), CREAM, root, edge=.15)
        cube("Lift core", (0,1.65,4.9), (1.2,1.05,8.4), accent, root, edge=.12)
        floor_count, start, gap = 8, 1.55, .95
        for f in range(floor_count):
            z = start + f*gap
            for side in (-1,1):
                cube("Corner balcony", (side*1.75,-1.25,z), (.78,.48,.14), CONCRETE, root, edge=.035)
                cube("Balcony rail", (side*1.75,-1.53,z+.28), (.72,.045,.42), INK, root, edge=.018)
            cube("Window band", (0,-.98,z+.10), (1.75,.07,.48), GLASS, root, edge=.025)
        cube("Roof crown", (0,.5,9.1), (4.45,3.2,.22), CHALK, root, edge=.10)
        cyl("Comms antenna", (0,.6,10.0), .10, 1.75, METAL, root)
        for z in (9.65,10.15):
            cyl("Antenna ring", (0,.6,z), .32,.05,YELLOW,root,18)
    else:
        heights = (7.4, 6.2, 5.0) if garden else (8.0, 7.2, 6.4)
        xs = (-1.55, 0, 1.55)
        for i,(x,h) in enumerate(zip(xs,heights)):
            cube("Stepped tower", (x,.6,1.05+h/2), (1.72,2.8,h), CREAM if i!=1 else CHALK, root, edge=.13)
            cube("Vertical glass fin", (x,-.84,1.1+h/2), (.62,.08,h-.4), GLASS, root, edge=.03)
            cube("Accent spine", (x+.58,-.90,1.1+h/2), (.16,.09,h-.2), accent, root, edge=.025)
            floors = int(h/.9)
            for f in range(floors):
                z=1.55+f*.90
                cube("Balcony ledge", (x,-1.04,z), (1.38,.35,.10), CONCRETE, root, edge=.025)
                cube("Balcony rail", (x,-1.24,z+.18), (1.28,.035,.28), INK, root, edge=.012)
        if garden:
            for i,(x,z) in enumerate(((-2.05,5.6),(-.55,4.7),(1.0,3.9),(2.05,2.8))):
                cube("Sky planter", (x,-1.42,z), (.72,.36,.25), CONCRETE, root, edge=.04)
                for j in range(3):
                    ico("Sky garden", (x+(j-1)*.22,-1.45,z+.35), .30,
                        (GREEN,GREEN2,GREEN3)[(i+j)%3], root, scale=(1,.65,1.15))
        cube("Roof screen", (0,.65,9.25 if not garden else 8.7), (4.9,2.95,.20), CHALK, root, edge=.09)
    # Lobby podium and network service props.
    cube("Arrival podium", (0,-.10,.62), (5.5,3.9,1.1), CONCRETE, root, edge=.14)
    cube("Lobby glass", (0,-2.06,.92), (2.35,.10,1.55), GLASS, root, edge=.045)
    cube("Lobby canopy", (0,-2.35,1.72), (3.5,1.0,.16), accent, root, edge=.07)
    cube("Address panel", (-2.18,-2.08,1.05), (.78,.12,1.35), accent, root, edge=.065)
    label(sign, (-2.18,-2.16,1.08), .28 if len(sign)<8 else .18, CHALK, root)
    cube("Network riser", (1.82,-2.08,1.02), (.72,.16,1.24), METAL, root, edge=.065)
    label("COMMS", (1.82,-2.18,1.04), .12, YELLOW, root)
    for i,c in enumerate((GREEN2,YELLOW,CORAL)):
        cyl("Riser LED", (1.63+i*.18,-2.29,.83), .025,.025,c,root,10,rot=(math.radians(90),0,0))
    return root


def build_marina_condo():
    r=empty("DEVI MARINA CONDO CALL KIT")
    tower_shell(r,"Marina View","MARINA\nVIEW",TEAL2,garden=False)
    # AP scan beacons make the Wi-Fi call readable.
    for x in (-1.15,1.15):
        cube("WiFi access point", (x,-2.25,2.03), (.42,.12,.16), CHALK, r, edge=.06)
        for k in range(2):
            cyl("AP aerial", (x+(-.13 if k==0 else .13),-2.28,2.22), .018,.30,INK,r,8)
    return r


def build_pointblock():
    r=empty("MR TAN POINT BLOCK CALL KIT")
    tower_shell(r,"Point Block","BLK\n18",CORAL,point=True)
    cube("Line test pedestal", (2.55,-1.75,.55), (.55,.45,.90), TEAL, r, edge=.07)
    label("LINE\nTEST", (2.55,-2.00,.58), .11, YELLOW, r)
    cable("Intermittent line loop", [(2.5,-1.9,1.05),(2.85,-2.1,1.3),(3.1,-1.8,.9),(2.75,-1.65,.4)], .028, CORAL, r)
    return r


def build_holland_condo():
    r=empty("SOFIA HOLLAND CONDO CALL KIT")
    tower_shell(r,"Holland View","HOLLAND\nVIEW",GREEN2,garden=True)
    for x in (-1.0,0,1.0):
        cube("Mesh node plinth", (x,-2.6,.38), (.48,.48,.25), CONCRETE, r, edge=.055)
        cyl("Mesh WiFi node", (x,-2.6,.72), .17,.55,CHALK,r,16)
        cyl("Mesh status ring", (x,-2.6,.82), .19,.06,TEAL2 if x else YELLOW,r,16)
    return r


def build_kopitiam():
    r=empty("FIELD CALL KOPITIAM HUB")
    # Open-sided neighbourhood pavilion.
    cube("Raised tiled floor", (0,.15,.22), (6.8,5.2,.38), CONCRETE, r, edge=.15)
    for x in (-2.85,2.85):
        for y in (-1.8,1.8):
            cyl("Pavilion column", (x,y,2.25), .16,4.1,TEAL,r,16)
    cube("Roof fascia", (0,.15,4.15), (7.25,5.65,.34), CORAL, r, edge=.12)
    cube("Roof crown", (0,.15,4.65), (6.7,5.1,.85), CHALK, r, edge=.16)
    cube("Main sign", (0,-2.78,4.38), (4.6,.16,.88), TEAL, r, edge=.08)
    label("KAMPUNG KOPI", (0,-2.89,4.40), .38, CHALK, r)
    # Three colourful hawker stalls.
    for i,(x,accent,title) in enumerate(((-2.0,CORAL,"KOPI"),(0,TEAL2,"MEE"),(2.0,YELLOW,"RICE"))):
        cube("Stall body", (x,1.32,1.38), (1.72,1.35,2.1), CREAM, r, edge=.085)
        cube("Stall front", (x,.62,1.50), (1.52,.10,1.55), accent, r, edge=.045)
        cube("Stall hatch", (x,.54,1.62), (1.14,.08,.70), INK, r, edge=.03)
        cube("Stall awning", (x,.25,2.43), (1.72,.82,.14), accent, r,
             rot=(math.radians(-7),0,0),edge=.045)
        label(title,(x,.46,2.22),.20,CHALK if accent!=YELLOW else INK,r)
    # Communal tables, stools, tray-return and field dispatch board.
    for x in (-1.75,1.75):
        cube("Marble table", (x,-1.18,1.02), (1.35,.82,.12), CHALK, r, edge=.08)
        cyl("Table pedestal", (x,-1.18,.62), .13,.78,METAL,r)
        for sx,sy in ((-.82,0),(.82,0),(0,-.72),(0,.72)):
            cyl("Kopitiam stool", (x+sx,-1.18+sy,.52), .24,.42,(CORAL,TEAL2,YELLOW)[i%3],r,14)
    cube("Tray return", (2.75,-1.65,1.08), (.82,.58,1.55), METAL, r, edge=.07)
    label("RETURN",(2.75,-1.96,1.12),.11,YELLOW,r)
    cube("Dispatch board", (-2.75,-1.68,1.22), (.92,.14,1.65), TEAL, r, edge=.075)
    label("FIELD\nCALL",(-2.75,-1.78,1.28),.20,CHALK,r)
    cable("Hub fibre cable", [(-3.4,2.3,4.6),(-2.6,1.3,4.0),(-2.7,-.2,2.8),(-2.75,-1.7,2.05)],.027,INK,r)
    return r


def build_streetlamp():
    r=empty("TROPICAL STREETLAMP")
    cyl("Fluted base",(0,0,.38),.32,.76,TEAL,r,16)
    cyl("Lamp pole",(0,0,2.45),.095,4.25,METAL,r,14)
    cable("Swan neck",[(0,0,4.45),(0,0,4.85),(.30,0,5.10),(.75,0,5.10)],.075,METAL,r)
    cube("Lamp shade",(.92,0,5.04),(.62,.44,.20),TEAL2,r,rot=(0,math.radians(-5),0),edge=.07)
    cube("Warm lamp",(.92,-.01,4.91),(.42,.30,.08),YELLOW,r,edge=.035)
    cube("Route plate",(0,-.14,2.75),(.52,.08,.78),CORAL,r,edge=.055)
    label("FC",(0,-.20,2.76),.22,CHALK,r)
    return r


def build_postbox():
    r=empty("SINGAPORE POSTBOX")
    cube("Postbox body",(0,0,1.08),(1.0,.72,1.85),RED,r,edge=.15)
    cube("Postbox crown",(0,0,2.06),(1.08,.80,.30),CHALK,r,edge=.12)
    cube("Posting slot",(0,-.39,1.55),(.65,.06,.14),INK,r,edge=.035)
    cube("Collection plate",(0,-.40,1.13),(.62,.05,.40),CHALK,r,edge=.035)
    label("SINGAPORE\nPOST",(0,-.44,1.15),.14,RED,r)
    cyl("Postbox foot",(0,0,.18),.32,.36,METAL,r,16)
    return r


def build_bench():
    r=empty("NEIGHBOURHOOD BENCH")
    for x in (-1.55,1.55):
        cube("Planter end",(x,0,.55),(.75,.82,1.05),CONCRETE,r,edge=.12)
        for j in range(3):
            ico("Planter foliage",(x+(j-1)*.18,0,.98+j*.08),.38,(GREEN,GREEN2,GREEN3)[j],r,scale=(1,.75,1.1))
    for z in (.58,.83):
        cube("Timber seat slat",(0,0,z),(2.75,.68,.16),WOOD2,r,edge=.065)
    cube("Bench back",(0,.31,1.25),(2.75,.14,.72),TEAL,r,rot=(math.radians(-8),0,0),edge=.07)
    cube("Bench badge",(0,-.08,1.28),(.62,.06,.32),CORAL,r,edge=.045)
    label("REST",(0,-.12,1.29),.11,CHALK,r)
    return r


ASSET_JOBS = [
    ("kampung-call-v2", build_kampung, (0,0,2.4), (11,-15,8), 5.5),
    ("condo-marina-v2", build_marina_condo, (0,0,4.3), (13,-18,11), 6.0),
    ("pointblock-call-v2", build_pointblock, (0,0,4.7), (13,-18,11), 6.0),
    ("condo-holland-v2", build_holland_condo, (0,0,4.1), (13,-18,10.5), 6.0),
    ("kopitiam-v2", build_kopitiam, (0,0,2.2), (12,-16,8.5), 6.0),
    ("streetlamp-v2", build_streetlamp, (0,0,2.6), (7,-10,6), 2.5),
    ("postbox-v2", build_postbox, (0,0,1.1), (5,-7,3.8), 2.0),
    ("bench-v2", build_bench, (0,0,.9), (6,-8,4.2), 3.0),
]


if __name__ == "__main__":
    for slug, builder, target, camera, ground in ASSET_JOBS:
        reset()
        root = builder()
        export_asset(root, slug, target, camera, ground)

    print("All remaining assets created")
