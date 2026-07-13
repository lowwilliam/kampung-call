import bpy
import os

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),".."))
ASSETS=os.path.join(ROOT,"assets");os.makedirs(ASSETS,exist_ok=True)

def reset():
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)

def mat(name,color,metal=0,rough=.7):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=(*color,1);p.inputs["Roughness"].default_value=rough;p.inputs["Metallic"].default_value=metal
    return m

def cube(name,loc,scale,material,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(location=loc);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        md=o.modifiers.new("Soft edge","BEVEL");md.width=bevel;md.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=md.name)
    o.data.materials.append(material);return o

def cyl(name,loc,radius,depth,material,vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(material);return o

def export(name):
    blend=os.path.join(ASSETS,name+".blend");glb=os.path.join(ASSETS,name+".glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=glb,export_format="GLB",use_selection=True,export_animations=False,export_yup=True,export_apply=True)
    print("Created",blend);print("Created",glb)

CREAM=mat("HDB warm white",(.86,.83,.74));CORAL=mat("HDB coral",(.83,.20,.12))
TEAL=mat("HDB teal",(.05,.38,.38));DARK=mat("Window dark",(.055,.075,.075),.1,.35)
GLASS=mat("Window glass",(.20,.43,.47),.12,.25);CONCRETE=mat("Concrete",(.55,.54,.49))
YELLOW=mat("Wayfinding yellow",(.95,.55,.04));GREEN=mat("Plant green",(.08,.38,.13))
STEEL=mat("Steel",(.24,.28,.29),.55,.32);RED=mat("Singtel red",(.78,.025,.018))
WOOD=mat("Table wood",(.42,.23,.09));TILE=mat("Kopitiam tile",(.83,.80,.69))
WHITE=mat("Sign white",(.94,.93,.88));AWNING=mat("Awning green",(.04,.34,.22))

def build_hdb():
    reset();root=bpy.data.objects.new("HDB Block",None);bpy.context.collection.objects.link(root);p=[]
    # open void deck with structural columns and a distinct residential slab
    p.append(cube("Residential slab",(0,0,4.65),(2.65,1.35,3.35),CREAM,.10))
    p.append(cube("Lift core",(1.82,.15,3.65),(.54,1.50,3.65),CORAL,.07))
    p.append(cube("Roof slab",(0,0,8.10),(2.88,1.55,.16),CONCRETE,.05))
    for x in (-2.25,-.75,.75,2.25):
        p.append(cube("Void deck column",(x,0,.70),(.12,.12,.70),CONCRETE,.025))
    p.append(cube("Void deck ceiling",(0,0,1.45),(2.65,1.35,.12),CONCRETE,.035))
    # corridor bands, windows, sunshades and laundry poles
    for floor in range(7):
        z=2.05+floor*.82
        p.append(cube("Corridor band",(0,-1.40,z-.28),(2.64,.08,.07),TEAL,.015))
        for x in (-1.95,-1.30,-.65,0,.65,1.30):
            p.append(cube("Apartment window",(x,-1.37,z),(.22,.035,.25),GLASS,.012))
            p.append(cube("Sunshade",(x,-1.48,z+.30),(.27,.16,.035),CREAM,.012))
        # alternate service-yard windows on the rear
        for x in (-1.7,-.85,0,.85,1.7):p.append(cube("Rear window",(x,1.37,z),(.20,.035,.22),DARK,.01))
    # lift-lobby glazing, block-number panel and sheltered linkway
    p.append(cube("Lift lobby glass",(1.83,-1.52,1.00),(.42,.035,.58),GLASS,.015))
    p.append(cube("Block number panel",(-2.23,-1.47,2.30),(.34,.04,.72),CORAL,.018))
    p.append(cube("Linkway roof",(-3.55,0,.98),(1.05,.82,.10),TEAL,.04))
    for x in (-4.35,-2.75):p.append(cyl("Linkway post",(x,-.58,.46),.055,.92,STEEL))
    # rooftop water tanks and antenna/service cues
    for x in (-.65,.65):p.append(cyl("Roof tank",(x,0,8.62),.35,.72,STEEL,16))
    p.append(cyl("Antenna",(0,0,9.35),.025,1.25,STEEL,8))
    # modest ground planting softens the base
    for x in (-2.1,-1.55,1.15):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.24,location=(x,-1.62,.26))
        q=bpy.context.object;q.name="Estate shrub";q.scale.z=.7;q.data.materials.append(GREEN);p.append(q)
    for o in p:o.parent=root
    export("hdb")

def build_kopitiam():
    reset();root=bpy.data.objects.new("Neighbourhood Kopitiam",None);bpy.context.collection.objects.link(root);p=[]
    p.append(cube("Floor slab",(0,0,.10),(3.15,2.25,.10),TILE,.045))
    # open-sided pavilion with a generous tropical roof
    for x in (-2.75,2.75):
        for y in (-1.85,1.85):p.append(cyl("Pavilion post",(x,y,1.35),.075,2.70,STEEL,12))
    p.append(cube("Roof",(0,0,2.82),(3.42,2.50,.14),AWNING,.075))
    p.append(cube("Roof fascia",(0,-2.46,2.62),(3.35,.08,.26),RED,.025))
    # three recognisable food stalls with counters, menu boards and lightboxes
    stall_cols=[CORAL,TEAL,YELLOW]
    for i,x in enumerate((-1.95,0,1.95)):
        p.append(cube("Stall back",(x,1.68,1.25),(.88,.28,1.18),stall_cols[i],.055))
        p.append(cube("Stall counter",(x,1.05,.76),(.82,.54,.12),WHITE,.035))
        p.append(cube("Stall lightbox",(x,1.28,2.18),(.78,.08,.25),WHITE,.025))
        p.append(cube("Menu stripe",(x,1.18,2.18),(.64,.025,.055),stall_cols[i],.01))
        p.append(cyl("Stock pot",(x-.34,.66,.99),.17,.20,STEEL,16))
    # kopitiam tables, stools, tray-return station and ceiling fans
    for x,y in ((-1.65,-.65),(0,-.75),(1.65,-.65)):
        p.append(cube("Table",(x,y,.67),(.48,.42,.055),WOOD,.035))
        p.append(cyl("Table pedestal",(x,y,.34),.07,.65,STEEL))
        for dx in (-.62,.62):p.append(cyl("Stool",(x+dx,y,.39),.20,.08,TEAL,16))
    p.append(cube("Tray return",(2.65,-1.25,.82),(.40,.32,.76),STEEL,.055))
    p.append(cube("Tray sign",(2.65,-1.58,1.45),(.36,.035,.19),YELLOW,.02))
    for x in (-1.1,1.1):
        p.append(cyl("Fan stem",(x,0,2.40),.025,.48,STEEL,8))
        for a in (0,90):
            blade=cube("Fan blade",(x,0,2.16),(.62,.07,.025),DARK,.015);blade.rotation_euler.z=a*3.14159/180;p.append(blade)
    # unmistakable Singtel service cue without dominating the neighbourhood stall
    p.append(cube("Singtel hotspot sign",(-2.70,-2.38,1.82),(.42,.05,.30),RED,.025))
    for o in p:o.parent=root
    export("kopitiam")

build_hdb();build_kopitiam()
