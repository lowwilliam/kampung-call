import bpy
import math
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ASSETS, exist_ok=True)

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        pass

def mat(name, color, metallic=0.0, rough=.68):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=(*color,1)
    p.inputs["Roughness"].default_value=rough
    p.inputs["Metallic"].default_value=metallic
    return m

def cube(name,loc,scale,material,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new("Architectural edge","BEVEL");mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material);return o

def cylinder(name,loc,radius,depth,material,vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(material);return o

CONCRETE=mat("Warm concrete",(.72,.68,.60))
WHITE=mat("Off white",(.9,.88,.81))
GLASS=mat("Blue green glass",(.16,.42,.48),metallic=.15,rough=.24)
DARK=mat("Charcoal frame",(.055,.075,.08),metallic=.25,rough=.42)
TEAL=mat("Feature teal",(.04,.39,.43))
RED=mat("Terracotta",(.58,.16,.09))
WOOD=mat("Timber",(.36,.18,.075))
GREEN=mat("Planting",(.08,.38,.14))
PAVING=mat("Paving",(.48,.47,.43))
WATER=mat("Pool water",(.06,.48,.62),metallic=.1,rough=.2)

def export_asset(name):
    blend=os.path.join(ASSETS,name+".blend")
    glb=os.path.join(ASSETS,name+".glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=glb,export_format="GLB",use_selection=True,
        export_animations=False,export_yup=True,export_apply=True)
    print("Created",blend);print("Created",glb)

def build_condo():
    reset()
    root=bpy.data.objects.new("Condo Residence",None);bpy.context.collection.objects.link(root)
    items=[]
    items.append(cube("Podium",(0,0,.35),(2.45,1.8,.35),CONCRETE,.09))
    items.append(cube("Tower",(0,0,3.55),(1.72,1.32,2.85),WHITE,.11))
    # continuous curtain wall and strong vertical fins
    for side in (-1,1):
        items.append(cube("CurtainWall",(0,side*1.34,3.55),(1.48,.035,2.52),GLASS,.015))
    for x in (-1.48,-.74,0,.74,1.48):
        items.append(cube("VerticalFin",(x,-1.40,3.55),(.035,.08,2.65),DARK,.012))
    # six inhabited balcony levels
    for floor in range(6):
        z=1.25+floor*.82
        for x in (-.87,.87):
            items.append(cube("BalconyDeck",(x,-1.62,z),(0.66,.36,.055),CONCRETE,.025))
            items.append(cube("GlassRail",(x,-1.98,z+.22),(0.64,.025,.19),GLASS,.012))
        items.append(cube("FloorBand",(0,-1.41,z-.23),(1.72,.07,.055),TEAL,.015))
    # sheltered arrival, columns, rooftop pavilion
    items.append(cube("ArrivalCanopy",(0,-2.05,.88),(1.25,.82,.10),DARK,.045))
    for x in (-1.05,1.05):items.append(cylinder("CanopyColumn",(x,-2.62,.43),.07,.86,DARK,12))
    items.append(cube("RoofPavilion",(0,0,6.72),(.76,.68,.62),CONCRETE,.07))
    items.append(cube("RoofShade",(0,0,7.42),(1.05,.92,.09),TEAL,.04))
    # pool terrace and planting make the typology unmistakably private condo
    items.append(cube("PoolDeck",(3.0,0,.12),(1.22,1.28,.12),PAVING,.06))
    items.append(cube("Pool",(3.0,0,.24),(.92,.92,.08),WATER,.13))
    for x,y in ((2.0,-1.1),(4.0,-1.05),(2.0,1.1),(4.0,1.05)):
        items.append(cylinder("Planter",(x,y,.25),.23,.5,CONCRETE,12))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.34,location=(x,y,.66))
        shrub=bpy.context.object;shrub.name="Landscape shrub";shrub.data.materials.append(GREEN);items.append(shrub)
    for o in items:o.parent=root
    export_asset("condo")

def build_landed():
    reset()
    root=bpy.data.objects.new("Landed Residence",None);bpy.context.collection.objects.link(root)
    items=[]
    items.append(cube("Site slab",(0,0,.12),(2.25,1.72,.12),PAVING,.06))
    items.append(cube("Ground floor",(.35,0,.85),(1.55,1.35,.73),WHITE,.09))
    items.append(cube("Upper floor",(-.15,0,2.05),(1.82,1.30,.68),CONCRETE,.1))
    # deep tropical overhang and car porch
    items.append(cube("Car porch canopy",(-1.10,-1.55,.98),(1.18,.75,.10),DARK,.045))
    for x in (-2.05,-.15):items.append(cylinder("Porch column",(x,-2.05,.48),.065,.96,DARK,12))
    # front glazing, sliding door and timber privacy fins
    items.append(cube("Living glass",(.75,-1.37,1.02),(.82,.035,.56),GLASS,.015))
    items.append(cube("Entry door",(-.65,-1.38,.78),(.38,.04,.64),WOOD,.025))
    for x in (-1.65,-1.43,-1.21,-.99):
        items.append(cube("Privacy fin",(x,-1.39,2.13),(.045,.08,.62),WOOD,.012))
    # balcony and planter ledge
    items.append(cube("Balcony",(.82,-1.58,1.83),(.88,.42,.065),WHITE,.03))
    items.append(cube("Balcony rail",(.82,-1.99,2.08),(.86,.025,.22),GLASS,.012))
    items.append(cube("Planter ledge",(.82,-1.95,1.72),(.85,.16,.15),CONCRETE,.025))
    for x in (.2,.55,.9,1.25):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.17,location=(x,-1.96,1.94))
        plant=bpy.context.object;plant.name="Balcony planting";plant.data.materials.append(GREEN);items.append(plant)
    # pitched roof as two rotated slabs
    for s in (-1,1):
        roof=cube("Tiled roof",(s*.82,0,3.02),(1.03,1.58,.09),RED,.025)
        roof.rotation_euler.y=s*math.radians(27);items.append(roof)
    items.append(cube("Roof ridge",(0,0,3.48),(.10,1.60,.10),RED,.025))
    # side service yard / AC condenser cues
    for z in (.65,1.18):
        items.append(cube("AC condenser",(1.98,.72,z),(.23,.34,.20),DARK,.04))
    for o in items:o.parent=root
    export_asset("landed")

build_condo()
build_landed()
