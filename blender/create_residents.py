import bpy, math, os
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),".."));OUT=os.path.join(ROOT,"assets","residents")
os.makedirs(OUT,exist_ok=True)

PEOPLE=[
 dict(file="uncle-lim",shirt=(.86,.83,.72),pants=(.22,.16,.10),skin=(.64,.38,.22),hair=(.42,.42,.39),accent=(.70,.16,.08),kind="uncle"),
 dict(file="auntie-rosnah",shirt=(.40,.17,.60),pants=(.12,.12,.13),skin=(.55,.30,.16),hair=(.035,.028,.024),accent=(.95,.55,.12),kind="auntie"),
 dict(file="devi",shirt=(.88,.84,.73),pants=(.06,.11,.20),skin=(.40,.18,.085),hair=(.025,.018,.014),accent=(.05,.43,.48),kind="student"),
 dict(file="mr-tan",shirt=(.08,.30,.54),pants=(.44,.44,.42),skin=(.70,.44,.27),hair=(.10,.075,.06),accent=(.75,.12,.08),kind="glasses"),
 dict(file="kai",shirt=(.10,.43,.16),pants=(.27,.19,.12),skin=(.58,.31,.15),hair=(.08,.06,.045),accent=(.92,.53,.08),kind="young"),
 dict(file="sofia",shirt=(.88,.86,.79),pants=(.10,.13,.17),skin=(.48,.24,.12),hair=(.07,.05,.04),accent=(.94,.33,.04),kind="professional"),
]

def reset():
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get("Principled BSDF");p.inputs["Base Color"].default_value=(*c,1);p.inputs["Roughness"].default_value=.72;return m
def bevel(o,w=.025):
 md=o.modifiers.new("Soft tailored edge","BEVEL");md.width=w;md.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=md.name)
def cube(name,loc,scale,m,w=.025):
 bpy.ops.mesh.primitive_cube_add(location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel(o,w);o.data.materials.append(m);return o
def sphere(name,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=18,ring_count=10,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def cyl(name,loc,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;bevel(o,min(.02,r*.18));o.data.materials.append(m);return o

def make_person(cfg):
 reset();skin=mat("Skin",cfg["skin"]);shirt=mat("Top",cfg["shirt"]);pants=mat("Bottom",cfg["pants"]);hair=mat("Hair",cfg["hair"]);accent=mat("Accent",cfg["accent"])
 dark=mat("Shoes",(.025,.028,.03));white=mat("Badge",(.9,.91,.87));metal=mat("Metal",(.32,.35,.36));kind=cfg["kind"]
 eye=mat("Eyes",(.018,.014,.012));mouth=mat("Mouth",(.35,.055,.045));sole=mat("Soles",(.055,.06,.065))
 bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0));rig=bpy.context.object;rig.name="ResidentRig";a=rig.data
 root=a.edit_bones[0];root.name="Root";root.head=Vector((0,0,0));root.tail=Vector((0,0,.82))
 def bone(n,h,t,parent="Root"):
  b=a.edit_bones.new(n);b.head=Vector(h);b.tail=Vector(t);b.parent=a.edit_bones[parent];return b
 bone("Torso",(0,0,.72),(0,0,1.48));bone("Head",(0,0,1.45),(0,0,2.08),"Torso")
 bone("Arm.L",(-.30,0,1.38),(-.30,0,.72),"Torso");bone("Arm.R",(.30,0,1.38),(.30,0,.72),"Torso")
 bone("Leg.L",(-.14,0,.74),(-.14,0,.08));bone("Leg.R",(.14,0,.74),(.14,0,.08));bpy.ops.object.mode_set(mode="OBJECT")
 p=[];p+=[cube("Torso",(0,0,1.15),(.32,.21,.40),shirt,.065),sphere("Head",(0,0,1.78),(.25,.235,.285),skin)]
 p+=[cyl("Arm.L",(-.40,0,1.08),.095,.62,skin),cyl("Arm.R",(.40,0,1.08),.095,.62,skin)]
 p+=[cyl("Leg.L",(-.14,0,.43),.12,.66,pants),cyl("Leg.R",(.14,0,.43),.12,.66,pants)]
 p+=[cube("Shoe.L",(-.14,-.07,.09),(.15,.22,.10),dark,.04),cube("Shoe.R",(.14,-.07,.09),(.15,.22,.10),dark,.04)]
 # universal facial and tailoring details; kept chunky enough to survive the
 # game's toon outline and typical camera distance.
 for x in (-.09,.09):
  p.append(sphere("Eye",(x,-.255,1.84),(.042,.022,.052),eye))
  p.append(cube("Brow",(x,-.267,1.91),(.064,.014,.014),hair,.006))
 for x in (-.255,.255):p.append(sphere("Ear",(x,0,1.79),(.04,.032,.065),skin))
 p+=[sphere("Nose",(0,-.274,1.78),(.040,.030,.052),skin),cube("Mouth",(0,-.269,1.69),(.082,.014,.014),mouth,.006)]
 # collar, placket and sleeve cuffs give the clothes a constructed silhouette.
 for x,r in ((-.085,-18),(.085,18)):
  c=cube("Collar",(x,-.225,1.48),(.09,.018,.07),white,.012);c.rotation_euler.y=math.radians(r);p.append(c)
 p.append(cube("Shirt placket",(0,-.224,1.24),(.018,.012,.19),accent,.006))
 p+=[cube("Cuff.L",(-.40,0,.82),(.115,.115,.045),shirt,.02),cube("Cuff.R",(.40,0,.82),(.115,.115,.045),shirt,.02)]
 p+=[cube("Sole.L",(-.14,-.10,.025),(.155,.235,.035),sole,.018),cube("Sole.R",(.14,-.10,.025),(.155,.235,.035),sole,.018)]
 # hair silhouettes and identity-specific accessories
 if kind=="uncle":
  p+=[sphere("Side hair",(0,.02,1.93),(.255,.24,.105),hair),cube("Moustache",(0,-.255,1.73),(.11,.018,.025),hair,.012),cube("Shirt pocket",(.16,-.225,1.22),(.08,.018,.10),accent,.01)]
  p+=[cyl("Wrist watch",(-.40,-.01,.82),.115,.035,metal),cube("Pocket pen",(.18,-.247,1.26),(.012,.012,.09),accent,.005)]
 elif kind=="auntie":
  p+=[sphere("Hair",(0,.05,1.91),(.27,.25,.19),hair),sphere("Bun",(0,.20,2.02),(.13,.13,.14),hair),cube("Scarf",(0,-.22,1.40),(.29,.025,.10),accent,.02),cube("Handbag",(-.43,-.05,.76),(.18,.09,.22),accent,.035)]
  strap=cube("Handbag strap",(-.25,-.21,1.16),(.025,.018,.38),dark,.008);strap.rotation_euler.y=math.radians(-22);p.append(strap)
  for x in (-.18,0,.18):p.append(sphere("Floral motif",(x,-.225,1.18),(.045,.018,.045),accent))
 elif kind=="student":
  p+=[sphere("Long hair",(0,.08,1.78),(.28,.25,.42),hair),cube("Backpack",(0,.24,1.20),(.26,.13,.34),accent,.055),cube("Laptop sleeve",(.37,-.08,.93),(.09,.22,.28),dark,.035)]
  p+=[sphere("Hair flower",(.20,-.04,1.98),(.07,.035,.07),accent),cube("Headphone band",(0,.02,2.02),(.23,.035,.035),dark,.018)]
 elif kind=="glasses":
  p+=[sphere("Hair",(0,.04,1.96),(.255,.24,.13),hair)]
  for x in (-.105,.105):p.append(cube("Glasses",(x,-.245,1.82),(.085,.022,.065),dark,.012))
  p.append(cube("Glasses bridge",(0,-.252,1.82),(.035,.015,.012),dark,.006))
  p+=[cube("Phone",(.38,-.10,.93),(.075,.035,.14),dark,.018),cyl("Watch",(.40,-.01,.82),.115,.035,metal)]
 elif kind=="young":
  p+=[sphere("Hair",(0,.02,1.97),(.26,.24,.14),hair),cube("Crossbody bag",(.25,-.23,1.02),(.14,.07,.22),accent,.035),cube("Bag strap",(0,-.235,1.27),(.035,.018,.42),dark,.01)]
  p[-1].rotation_euler.y=math.radians(-28)
  p+=[cube("Bag buckle",(.25,-.305,1.03),(.045,.012,.035),metal,.006),cube("Sneaker stripe L",(-.14,-.295,.10),(.09,.012,.025),white,.006),cube("Sneaker stripe R",(.14,-.295,.10),(.09,.012,.025),white,.006)]
 else:
  p+=[sphere("Hair",(0,.05,1.94),(.26,.245,.16),hair),sphere("Ponytail",(0,.20,1.72),(.12,.12,.25),hair),cube("Work vest",(0,-.225,1.18),(.29,.025,.34),accent,.018),cube("ID badge",(.15,-.258,1.31),(.065,.012,.09),white,.008)]
  p+=[cube("Lanyard L",(.08,-.248,1.39),(.018,.012,.17),dark,.006),cube("Lanyard R",(-.08,-.248,1.39),(.018,.012,.17),dark,.006),cube("Tablet",(-.40,-.08,.96),(.075,.22,.27),dark,.025)]
 head_names={"Head","Side hair","Hair","Long hair","Bun","Ponytail","Moustache","Glasses","Glasses bridge","Eye","Brow","Ear","Nose","Mouth","Hair flower","Headphone band"}
 bone_map={n:"Head" for n in head_names}
 bone_map.update({"Arm.L":"Arm.L","Arm.R":"Arm.R","Cuff.L":"Arm.L","Cuff.R":"Arm.R","Wrist watch":"Arm.L","Watch":"Arm.R","Leg.L":"Leg.L","Leg.R":"Leg.R","Shoe.L":"Leg.L","Shoe.R":"Leg.R","Sole.L":"Leg.L","Sole.R":"Leg.R","Sneaker stripe L":"Leg.L","Sneaker stripe R":"Leg.R"})
 for o in p:
  w=o.matrix_world.copy();o.parent=rig;o.parent_type="BONE";o.parent_bone=bone_map.get(o.name,"Torso");o.matrix_world=w
 def action(name,frames,pose):
  ac=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=ac
  for f in frames:
   for bn,rot in pose(f).items():pb=rig.pose.bones[bn];pb.rotation_mode="XYZ";pb.rotation_euler=rot;pb.keyframe_insert("rotation_euler",frame=f,group=bn)
  ac.use_fake_user=True
 action("Idle",[1,20,40],lambda f:{"Torso":(0,0,math.radians(1.5 if f==20 else 0)),"Head":(math.radians(-2 if f==20 else 0),0,0),"Arm.L":(math.radians(3 if f==20 else 0),0,0),"Arm.R":(math.radians(-3 if f==20 else 0),0,0)})
 def wp(f):
  ph={1:0,7:1,13:0,19:-1,25:0}[f];v=math.radians(25*ph);return {"Arm.L":(v,0,0),"Arm.R":(-v,0,0),"Leg.L":(-v,0,0),"Leg.R":(v,0,0)}
 action("Walk",[1,7,13,19,25],wp);rig.animation_data.action=None
 blend=os.path.join(OUT,cfg["file"]+".blend");glb=os.path.join(OUT,cfg["file"]+".glb");bpy.ops.wm.save_as_mainfile(filepath=blend)
 bpy.ops.object.select_all(action="DESELECT");rig.select_set(True)
 for o in p:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=glb,export_format="GLB",use_selection=True,export_animations=True,export_animation_mode="ACTIONS",export_yup=True,export_apply=False)
 print("Created",glb)

for person in PEOPLE:make_person(person)
