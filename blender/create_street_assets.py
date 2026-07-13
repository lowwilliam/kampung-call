import bpy, os, math
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),".."));OUT=os.path.join(ROOT,"assets")
def reset():bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
def mat(n,c,metal=0,rough=.7):
 m=bpy.data.materials.get(n) or bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get("Principled BSDF");p.inputs["Base Color"].default_value=(*c,1);p.inputs["Roughness"].default_value=rough;p.inputs["Metallic"].default_value=metal;return m
def cube(n,l,s,m,b=.03):
 bpy.ops.mesh.primitive_cube_add(location=l);o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:md=o.modifiers.new("Soft edge","BEVEL");md.width=b;md.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=md.name)
 o.data.materials.append(m);return o
def cyl(n,l,r,d,m,v=16):bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=l);o=bpy.context.object;o.name=n;o.data.materials.append(m);return o
def export(n):
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,n+".blend"));bpy.ops.object.select_all(action="SELECT");bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,n+".glb"),export_format="GLB",use_selection=True,export_animations=False,export_yup=True,export_apply=True)

WHITE=mat("Warm white",(.9,.88,.81));STEEL=mat("Dark steel",(.08,.11,.12),.5,.35);GLASS=mat("Transit glass",(.16,.46,.54),.1,.22);RED=mat("Transit red",(.78,.025,.018));YELLOW=mat("Wayfinding",(.96,.58,.04));GREEN=mat("Shutter green",(.04,.34,.20));CORAL=mat("Plaster coral",(.84,.35,.28));CREAM=mat("Plaster cream",(.88,.78,.58));TILE=mat("Roof tile",(.53,.16,.09));WOOD=mat("Timber",(.35,.17,.06));DARK=mat("Interior",(.035,.03,.026))

def mrt():
 reset();root=bpy.data.objects.new("MRT Entrance",None);bpy.context.collection.objects.link(root);p=[]
 p+=[cube("Station base",(0,0,.14),(2.25,1.65,.14),WHITE,.06),cube("Concourse",(0,.18,1.30),(1.95,1.35,1.12),WHITE,.09)]
 p+=[cube("Glass front",(0,-1.20,1.35),(1.58,.035,.78),GLASS,.015),cube("Entrance opening",(0,-1.27,.72),(.56,.035,.62),STEEL,.015)]
 for x in (-1.48,-.74,0,.74,1.48):p.append(cube("Mullion",(x,-1.25,1.42),(.035,.06,.82),STEEL,.01))
 # curved-looking canopy made from overlapping eased roof plates
 for i in range(7):
  x=(i-3)*.62;z=2.48+.22*(1-(abs(i-3)/3)**1.6);p.append(cube("Canopy rib",(x,-.02,z),(.34,1.62,.08),GLASS,.035))
 for x in (-1.78,1.78):p.append(cyl("Canopy column",(x,-1.05,1.30),.075,2.45,STEEL,12))
 p+=[cube("MRT roundel",(0,-1.48,2.43),(.68,.055,.32),RED,.035),cube("Station label",(0,-1.55,2.43),(.40,.018,.09),WHITE,.012)]
 # fare gates and tactile path
 for x in (-.62,0,.62):p.append(cube("Fare gate",(x,.34,.66),(.14,.48,.47),STEEL,.045))
 for y in (-1.35,-.88,-.41,.06):p.append(cube("Tactile paving",(0,y,.31),(.22,.18,.025),YELLOW,.01))
 for o in p:o.parent=root
 export("mrt")

def shophouse():
 reset();root=bpy.data.objects.new("Conservation Shophouse",None);bpy.context.collection.objects.link(root);p=[]
 p+=[cube("Facade",(0,0,1.72),(1.34,1.12,1.72),CREAM,.07),cube("Five foot way",(0,-1.46,.12),(1.54,.42,.12),WHITE,.045)]
 # arcade columns and arched impression through layered frames
 for x in (-1.10,0,1.10):p.append(cyl("Arcade column",(x,-1.18,.72),.09,1.42,WHITE,14))
 p.append(cube("Arcade beam",(0,-1.18,1.42),(1.34,.10,.12),WHITE,.03))
 # upper windows with shutters, fanlights and plaster frames
 for x in (-.72,.72):
  p+=[cube("Window recess",(x,-1.14,2.30),(.43,.035,.62),DARK,.025),cube("Shutter left",(x-.25,-1.19,2.30),(.17,.035,.56),GREEN,.018),cube("Shutter right",(x+.25,-1.19,2.30),(.17,.035,.56),GREEN,.018)]
  for z in (1.86,2.12,2.38,2.64):p.append(cube("Shutter slat",(x,-1.235,z),(.39,.015,.025),WOOD,.008))
 # ground shopfront and traditional signboard
 p+=[cube("Shop opening",(0,-1.15,.75),(.72,.035,.58),DARK,.025),cube("Timber doors",(0,-1.20,.68),(.58,.035,.48),WOOD,.02),cube("Signboard",(0,-1.28,1.53),(.82,.055,.20),CORAL,.025),cube("Sign lettering",(0,-1.34,1.53),(.52,.018,.055),WHITE,.008)]
 # tiled pitched roof, ridge and decorative end caps
 for s in (-1,1):
  r=cube("Tiled roof",(s*.60,0,3.66),(.80,1.40,.10),TILE,.025);r.rotation_euler.y=s*math.radians(30);p.append(r)
 p.append(cube("Roof ridge",(0,0,4.04),(.10,1.42,.10),TILE,.02))
 for x in (-1.32,1.32):p.append(cube("Facade pilaster",(x,-1.16,2.38),(.10,.10,1.10),CORAL,.025))
 for o in p:o.parent=root
 export("shophouse")
mrt();shophouse()
