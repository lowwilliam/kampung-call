import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
REVIEWS = os.path.join(ROOT, "research", "img2threejs", "alfa-romeo-giulia-spider", "reviews")
BLEND = os.path.join(ASSETS, "alfa-romeo-giulia-spider-v2.blend")
GLB = os.path.join(ASSETS, "alfa-romeo-giulia-spider-v2.glb")
FRONT = os.path.join(REVIEWS, "blender-front-three-quarter.png")
REAR = os.path.join(REVIEWS, "blender-rear-three-quarter.png")


def material(name, color, roughness=.4, metallic=0.0, coat=0.0, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, alpha)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = max(.04, roughness * .35)
    if transmission and "Transmission Weight" in p.inputs:
        p.inputs["Transmission Weight"].default_value = transmission
        p.inputs["IOR"].default_value = 1.45
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "DITHERED"
    return m


PAINT = material("Black lacquer clearcoat", (.006, .008, .009), .17, .28, 1.0)
PAINT_DARK = material("Body panel shadow", (.003, .004, .004), .25, .18, .75)
CHROME = material("Polished chrome", (.62, .66, .69), .105, 1.0, .5)
STEEL = material("Satin wheel steel", (.48, .51, .53), .28, .88, .25)
RUBBER = material("Tire rubber", (.012, .014, .014), .68)
TREAD = material("Tire tread", (.006, .007, .007), .82)
LEATHER = material("Oxblood leather", (.36, .018, .018), .36, 0, .28)
LEATHER_DARK = material("Oxblood piping", (.17, .006, .006), .43)
DASH = material("Black dashboard", (.013, .014, .014), .42)
GLASS = material("Windshield glass", (.22, .36, .40), .08, .0, .15, .68, .27)
LENS = material("Headlamp glass", (.78, .84, .82), .12, .0, .18, .42, .72)
AMBER = material("Amber lens", (.92, .20, .015), .24, .0, .15)
RED = material("Red lens", (.46, .008, .006), .25, .0, .15)
CREAM = material("Gauge cream", (.88, .84, .70), .55)
BLACK = material("Grille black", (.006, .007, .007), .72)
PLATE = material("Singapore red plate", (.48, .015, .012), .34, .08, .25)
WHITE = material("Lettering", (.88, .80, .59), .44)


def empty(name, parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o


def smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def add_bevel(obj, width=.02, segments=3):
    mod = obj.modifiers.new("Coachbuilt edge radius", "BEVEL")
    mod.width = width
    mod.segments = segments
    return obj


def cube(name, loc, scale, mat, bevel=.025, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        add_bevel(o, bevel)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def uv(name, loc, scale, mat, parent=None, segments=64, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.data.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=48, rot=(math.pi/2, 0, 0), bevel=.012):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.name = name
    if bevel:
        add_bevel(o, bevel, 2)
    smooth(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def torus(name, loc, major, minor, mat, parent=None, rot=(math.pi/2, 0, 0), major_segments=64, minor_segments=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments,
                                    minor_segments=minor_segments, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.name = name
    smooth(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def curve_tube(name, points, radius, mat, parent=None, cyclic=False, resolution=2):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def mesh_object(name, vertices, faces, mat, parent=None, smooth_faces=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if smooth_faces:
        smooth(o)
    if parent:
        o.parent = parent
    return o


def loft(name, sections, mat, parent=None, radial=20):
    """Closed coachwork loft. Each section is (x, half_width, bottom_z, shoulder_z, crown_z)."""
    verts, faces = [], []
    for x, width, bottom, shoulder, crown in sections:
        for i in range(radial):
            angle = -math.pi + (2 * math.pi * i / radial)
            y = math.sin(angle) * width
            c = math.cos(angle)
            if c >= 0:
                z = shoulder + (c ** .72) * (crown - shoulder)
            else:
                z = shoulder + (-c) * (bottom - shoulder)
            verts.append((x, y, z))
    for s in range(len(sections) - 1):
        for i in range(radial):
            a = s * radial + i
            b = s * radial + (i + 1) % radial
            c = (s + 1) * radial + (i + 1) % radial
            d = (s + 1) * radial + i
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(radial))))
    last = (len(sections)-1)*radial
    faces.append(tuple(last+i for i in range(radial)))
    return mesh_object(name, verts, faces, mat, parent)


def fender_surface(name, wheel_x, side, mat, parent, front=True):
    """Open, integrated arch surface around the wheel, extended into the bonnet/tail."""
    verts, faces = [], []
    angles = [math.radians(8 + i * 164 / 32) for i in range(33)]
    bands = [0.0, .33, .66, 1.0]
    for band in bands:
        for angle in angles:
            radius = .385 + .175 * band
            x = wheel_x + math.cos(angle) * radius
            z = .38 + math.sin(angle) * radius
            y = side * (.705 + band * .065)
            # taper outboard flare near the arch apex
            y += side * .020 * math.sin(angle)
            verts.append((x, y, z))
    cols = len(angles)
    for b in range(len(bands)-1):
        for i in range(cols-1):
            a=b*cols+i; c=(b+1)*cols+i
            faces.append((a,a+1,c+1,c))
    arch = mesh_object(name, verts, faces, mat, parent)
    solid = arch.modifiers.new("Pressed steel thickness", "SOLIDIFY")
    solid.thickness = .025
    add_bevel(arch, .012, 2)
    # Longitudinal fender crown is a subtle continuation, not a separate pod.
    if front:
        points=[(wheel_x-.08, side*.735, .86),(wheel_x+.42,side*.72,.82),(1.72,side*.62,.71)]
    else:
        points=[(-1.72,side*.59,.66),(wheel_x-.42,side*.71,.76),(wheel_x+.08,side*.735,.85),(-.52,side*.70,.77)]
    curve_tube(name+" crown", points, .055, mat, parent)
    return arch


def fender_solid(name, wheel_x, side, mat, parent, front=True):
    """Elongated pressed-steel fender with a boolean wheel opening."""
    if front:
        scale=(.62,.245,.34); loc=(wheel_x+.08,side*.60,.50)
    else:
        scale=(.56,.255,.34); loc=(wheel_x-.02,side*.60,.50)
    fender=uv(name,loc,scale,mat,parent,72,36)
    bpy.ops.mesh.primitive_cylinder_add(vertices=72,radius=.345,depth=.62,
                                       location=(wheel_x,side*.69,.36),rotation=(math.pi/2,0,0))
    cutter=bpy.context.object; cutter.name=name+" wheel arch cutter"
    mod=fender.modifiers.new("True wheel arch","BOOLEAN"); mod.operation="DIFFERENCE"; mod.solver="EXACT"; mod.object=cutter
    bpy.context.view_layer.objects.active=fender
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    finally:
        bpy.data.objects.remove(cutter,do_unlink=True)
    add_bevel(fender,.010,2)
    return fender


def coachbuilt_fender(name, wheel_x, side, mat, parent, front=True):
    """Continuous quad fender patch with an authored outer wheel opening.

    This follows the real-time automotive pattern used by commercial glTF cars:
    a broad crown patch flows from the central body to a separate outer side skin,
    rather than relying on an intersecting ellipsoid or a narrow torus-like arch.
    """
    if front:
        x0,x1=.38,1.79
        inner_width=.565
        def inner_z(x):
            u=(x-x0)/(x1-x0)
            return .742-.155*(u**1.35)
        def crown_z(x):
            bump=.205*math.exp(-((x-wheel_x)/.47)**4)
            nose=.025*math.exp(-((x-1.68)/.24)**2)
            return .625+bump+nose
        def outer_width(x):
            # The photographed fender pinches inward ahead of the headlamp.
            nose_t=max(0,min(1,(x-1.48)/(x1-1.48)))
            return .795-.105*(nose_t*nose_t*(3-2*nose_t))
    else:
        x0,x1=-1.79,-.50
        inner_width=.555
        def inner_z(x):
            u=(x-x0)/(x1-x0)
            return .650+.085*math.sin(u*math.pi*.85)
        def crown_z(x):
            bump=.175*math.exp(-((x-wheel_x)/.45)**4)
            return .625+bump
        def outer_width(x):
            # Rear quarter narrows into the short tail and relaxes at the door.
            tail_t=max(0,min(1,(-1.48-x)/(-1.48-x0)))
            return .795-.115*(tail_t*tail_t*(3-2*tail_t))

    x_segments=34
    lateral_segments=8
    vertical_segments=5
    xs=[x0+(x1-x0)*i/x_segments for i in range(x_segments+1)]
    verts=[]; faces=[]
    # Crown patch: tight inner tangent at the bonnet/deck, broad outer highlight roll.
    for x in xs:
        iz=inner_z(x); oz=crown_z(x)
        for j in range(lateral_segments+1):
            t=j/lateral_segments
            eased=math.sin(t*math.pi*.5)**1.25
            y=side*(inner_width+(outer_width(x)-inner_width)*t)
            z=iz+(oz-iz)*eased
            verts.append((x,y,z))
    ring=lateral_segments+1
    for i in range(x_segments):
        for j in range(lateral_segments):
            a=i*ring+j; b=a+ring
            faces.append((a,a+1,b+1,b))

    # Outer side skin; the lower edge is the actual wheel-opening curve.
    side_start=len(verts)
    for x in xs:
        dx=x-wheel_x
        radial=abs(dx)
        if radial<.348:
            bottom=.36+math.sqrt(max(0,.348*.348-dx*dx))
        else:
            # Continuous shoulder transition: .36 at the arch tangent, then
            # ease into the lower valance instead of creating a rectangular flap.
            bottom=.145+.215*math.exp(-((radial-.348)/.105)**2)
        if front and x>1.52:
            nose_t=(x-1.52)/(x1-1.52)
            # Pinch the lower return into the lamp nacelle.  Commercial car
            # meshes avoid a full-height, guillotine-like panel at the nose.
            smooth_t=nose_t*nose_t*(3-2*nose_t)
            bottom=max(bottom,.145+.455*smooth_t)
        if not front and x<-1.52:
            tail_t=(-1.52-x)/(-1.52-x0)
            # The rear wing dissolves into the tail instead of ending as a
            # vertical mudguard slab.
            smooth_t=tail_t*tail_t*(3-2*tail_t)
            bottom=max(bottom,.145+.380*smooth_t)
        top=crown_z(x)
        for j in range(vertical_segments+1):
            t=j/vertical_segments
            # Slight convexity prevents a slab-like door/fender reflection.
            y=side*(outer_width(x)+.014*math.sin(t*math.pi))
            z=bottom+(top-bottom)*t
            verts.append((x,y,z))
    side_ring=vertical_segments+1
    for i in range(x_segments):
        for j in range(vertical_segments):
            a=side_start+i*side_ring+j; b=a+side_ring
            faces.append((a,b,b+1,a+1))

    fender=mesh_object(name,verts,faces,mat,parent)
    solid=fender.modifiers.new("Coachwork gauge","SOLIDIFY"); solid.thickness=.018; solid.offset=0
    bevel=fender.modifiers.new("Panel edge softening","BEVEL"); bevel.width=.006; bevel.segments=2
    return fender


def panel(name, points_xz, y, thickness, mat, parent):
    verts=[]
    for yy in (y-thickness/2,y+thickness/2):
        verts += [(x,yy,z) for x,z in points_xz]
    n=len(points_xz); faces=[]
    faces.append(tuple(range(n))); faces.append(tuple(reversed(range(n,2*n))))
    for i in range(n): faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    o=mesh_object(name,verts,faces,mat,parent,False)
    add_bevel(o,.014,3)
    return o


def quarter_panel(name, outer_xz, wheel_x, side, mat, parent):
    """Pressed side panel with a real wheel-arch opening, authored as a 2D curve with a hole."""
    curve=bpy.data.curves.new(name,"CURVE")
    curve.dimensions="2D"; curve.resolution_u=2; curve.fill_mode="BOTH"; curve.extrude=.018; curve.bevel_depth=.004; curve.bevel_resolution=2
    outer=curve.splines.new("POLY"); outer.points.add(len(outer_xz)-1)
    for p,(x,z) in zip(outer.points,outer_xz): p.co=(x,z,0,1)
    outer.use_cyclic_u=True
    opening=[]
    for i in reversed(range(48)):
        a=2*math.pi*i/48
        opening.append((wheel_x+math.cos(a)*.330,.36+math.sin(a)*.330))
    inner=curve.splines.new("POLY"); inner.points.add(len(opening)-1)
    for p,(x,z) in zip(inner.points,opening): p.co=(x,z,0,1)
    inner.use_cyclic_u=True
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o)
    o.location=(0,side*.785,0); o.rotation_euler=(math.pi/2,0,0); o.data.materials.append(mat); o.parent=parent
    return o


def make_wheel(root, name, x, y):
    g=empty(name,root)
    cylinder(name+" inner tire",(x,y,.36),.305,.17,RUBBER,g,64,bevel=.018)
    torus(name+" rounded tire",(x,y,.36),.252,.070,RUBBER,g)
    cylinder(name+" steel disc",(x,y + math.copysign(.095,y),.36),.205,.026,STEEL,g,64,bevel=.009)
    # Ten true-looking dark punched apertures with chrome lips.
    outward=math.copysign(1,y)
    for i in range(10):
        a=2*math.pi*i/10
        px=x+math.cos(a)*.153; pz=.36+math.sin(a)*.153
        cylinder(name+f" vent {i:02}",(px,y+outward*.109,pz),.024,.014,BLACK,g,18,bevel=.004)
        torus(name+f" vent lip {i:02}",(px,y+outward*.119,pz),.024,.004,CHROME,g,major_segments=18,minor_segments=6)
    uv(name+" domed hubcap",(x,y+outward*.135,.36),(.128,.046,.128),CHROME,g,48,24)
    cylinder(name+" Alfa hub badge",(x,y+outward*.184,.36),.038,.010,LEATHER_DARK,g,32,bevel=.004)
    # Fine longitudinal tread grooves, kept subtle like the museum car's road tires.
    for offset in (-.045,0,.045):
        torus(name+f" tread groove {offset:+.3f}",(x,y+offset,.36),.315,.004,TREAD,g,major_segments=64,minor_segments=6)
    return g


def build_car():
    root=empty("1963 Alfa Romeo Giulia Spider")
    root["asset_id"]="1963-alfa-romeo-giulia-spider-v2"
    root["disclosure"]="Reference-led procedural reconstruction; underside, engine bay, folded roof and hidden compartments are inferred."

    body=empty("body-shell",root)
    # Lower shell and tapered tail establish the unbroken beltline.
    loft("Continuous lower coachwork",[
        (-1.82,.44,.18,.49,.58),(-1.63,.68,.14,.57,.69),(-1.18,.80,.12,.66,.76),
        (-.58,.79,.12,.66,.73),(.02,.79,.12,.65,.71),(.58,.79,.12,.64,.72),
        (1.08,.80,.12,.64,.70),(1.55,.70,.15,.55,.64),(1.78,.40,.20,.46,.55)
    ],PAINT,body,24)
    # Long flat bonnet with a modest centre crown.
    hood=loft("hood",[(.00,.585,.675,.715,.76),(.42,.62,.66,.73,.79),(.95,.61,.61,.70,.77),(1.43,.55,.55,.63,.69),(1.66,.42,.49,.56,.60)],PAINT,root,22)
    hood["animation_role"]="hinged-hood"
    # Short deck, flatter than the previous dome.
    trunk=loft("trunk-lid",[(-1.66,.50,.57,.64,.69),(-1.35,.61,.62,.69,.75),(-.96,.62,.65,.72,.78),(-.68,.57,.66,.71,.75)],PAINT,root,22)
    trunk["animation_role"]="hinged-trunk"
    curve_tube("Bonnet centre spear",[(.05,0,.787),(.75,0,.805),(1.48,0,.695)],.014,CHROME,hood)
    curve_tube("Bonnet leading trim",[(1.50,-.46,.66),(1.62,0,.64),(1.50,.46,.66)],.018,CHROME,hood)
    for side in (-1,1):
        coachbuilt_fender(("Left" if side>0 else "Right")+" front fender",1.08,side,PAINT,body,True)
        coachbuilt_fender(("Left" if side>0 else "Right")+" rear fender",-1.10,side,PAINT,body,False)
        # Door panels follow the beltline and tuck under the shoulder.
        d=panel(("left-door" if side>0 else "right-door"),[(-.56,.23),(.34,.23),(.35,.68),(-.50,.70)],side*.765,.035,PAINT,root)
        d["animation_role"]="hinged-door"
        curve_tube(("Left" if side>0 else "Right")+" sill trim",[(-.60,side*.792,.22),(.42,side*.792,.22)],.014,CHROME,body)
        curve_tube(("Left" if side>0 else "Right")+" belt trim",[(-.60,side*.790,.704),(.38,side*.790,.688)],.012,CHROME,body)
        cube(("Left" if side>0 else "Right")+" door handle",(-.18,side*.815,.65),(.095,.018,.022),CHROME,.012,parent=d)

    wheels=empty("running-gear",root)
    for name,x in (("front-wheel",1.08),("rear-wheel",-1.10)):
        for side,y in (("left",.785),("right",-.785)):
            make_wheel(wheels,f"{name}-{side}",x,y)

    front=empty("front-fascia",root)
    # Headlamps sit upright in the fender noses.
    for side in (-1,1):
        y=side*.585
        cylinder(("Left" if side>0 else "Right")+" headlamp bucket",(1.748,y,.625),.181,.105,PAINT_DARK,front,64,(0,math.pi/2,0),.018)
        cylinder(("Left" if side>0 else "Right")+" headlamp bezel",(1.795,y,.625),.168,.072,CHROME,front,64,(0,math.pi/2,0),.016)
        cylinder(("Left" if side>0 else "Right")+" headlamp lens",(1.841,y,.625),.145,.018,LENS,front,64,(0,math.pi/2,0),.006)
        cylinder(("Left" if side>0 else "Right")+" indicator",(1.79,side*.49,.375),.064,.035,LENS,front,32,(0,math.pi/2,0),.008)
    # Alfa shield outline plus horizontal side intakes.
    shield=[(1.80,-.18,.51),(1.83,-.13,.66),(1.85,0,.76),(1.83,.13,.66),(1.80,.18,.51),(1.80,.13,.30),(1.80,0,.20),(1.80,-.13,.30),(1.80,-.18,.51)]
    curve_tube("Alfa shield grille frame",shield,.025,CHROME,front,True)
    for z in (.34,.41,.48,.55,.62):
        half=.125*(1-abs(z-.50)*1.8)
        curve_tube(f"Shield horizontal bar {z:.2f}",[(1.815,-half,z),(1.815,half,z)],.010,CHROME,front)
    for y in (-.07,0,.07):
        curve_tube(f"Shield vertical bar {y:.2f}",[(1.816,y,.30),(1.816,y,.64)],.009,CHROME,front)
    for side in (-1,1):
        curve_tube(("Left" if side>0 else "Right")+" intake brow",[(1.77,side*.19,.46),(1.79,side*.39,.48),(1.74,side*.62,.48)],.023,CHROME,front)
        curve_tube(("Left" if side>0 else "Right")+" intake lower",[(1.76,side*.20,.34),(1.78,side*.42,.33),(1.72,side*.65,.35)],.021,CHROME,front)
    curve_tube("Front bumper",[(1.72,-.72,.25),(1.87,-.48,.20),(1.91,0,.18),(1.87,.48,.20),(1.72,.72,.25)],.048,CHROME,front)
    for label,y in (("Right",-.27),("Left",.27)):
        uv(label+" front bumper overrider",(1.91,y,.26),(.07,.055,.15),CHROME,front,40,20)
    cylinder("Nose badge",(1.86,0,.735),.054,.025,LEATHER_DARK,front,36,(0,math.pi/2,0),.006)

    rear=empty("rear-fascia",root)
    for side in (-1,1):
        y=side*.655
        cube(("Left" if side>0 else "Right")+" tail lamp chrome",(-1.695,y,.50),(.045,.06,.16),CHROME,.018,parent=rear)
        cube(("Left" if side>0 else "Right")+" amber tail lens",(-1.746,y,.57),(.016,.052,.072),AMBER,.010,parent=rear)
        cube(("Left" if side>0 else "Right")+" red tail lens",(-1.746,y,.43),(.016,.052,.060),RED,.010,parent=rear)
    curve_tube("Rear bumper",[(-1.68,-.71,.25),(-1.84,-.48,.20),(-1.88,0,.18),(-1.84,.48,.20),(-1.68,.71,.25)],.046,CHROME,rear)
    for label,y in (("Right",-.38),("Left",.38)):
        uv(label+" rear bumper overrider",(-1.85,y,.27),(.07,.05,.15),CHROME,rear,40,20)
    cube("SP 7655 E plate",(-1.815,0,.37),(.025,.31,.105),PLATE,.008,parent=rear)
    curve_tube("Left exhaust",[(-1.70,-.42,.17),(-2.02,-.45,.13)],.032,CHROME,rear)

    cabin=empty("cabin",root)
    cube("Cockpit well",(-.45,0,.60),(.66,.58,.09),DASH,.06,parent=cabin)
    # A recessed, upholstered rear bolster integrated with the cockpit rim.
    # The former ellipsoid read as a detached capsule from the rear view.
    cube("Rear leather squab",(-.74,0,.705),(.105,.54,.115),LEATHER,.085,(0,-.10,0),cabin)
    for side in (-1,1):
        y=side*.29
        uv(("Left" if side>0 else "Right")+" seat cushion",(-.35,y,.66),(.30,.22,.078),LEATHER,cabin,48,24)
        back=uv(("Left" if side>0 else "Right")+" seat back",(-.55,y,.84),(.105,.22,.245),LEATHER,cabin,48,24)
        back.rotation_euler[1]=-.18
        for p in range(5):
            curve_tube(("Left" if side>0 else "Right")+f" seat pleat {p}",[(-.50+p*.07,y-.16,.748),(-.50+p*.07,y+.16,.748)],.006,LEATHER_DARK,cabin)
        panel(("Left" if side>0 else "Right")+" oxblood door card",[(-.50,.34),(.30,.34),(.30,.61),(-.48,.62)],side*.735,.025,LEATHER,cabin)
    cube("Dashboard",(.04,0,.83),(.18,.59,.12),DASH,.055,(0,-.04,0),cabin)
    # Right-hand drive instrument cluster and steering wheel.
    for i,(y,r) in enumerate(((-.30,.085),(-.43,.070),(-.17,.070))):
        cylinder(f"Gauge {i+1}",(.225,y,.86),r,.026,CHROME,cabin,40,(0,math.pi/2,0),.005)
        cylinder(f"Gauge face {i+1}",(.240,y,.86),r*.82,.010,DASH,cabin,40,(0,math.pi/2,0),.003)
    steering=empty("steering-system",root)
    torus("Steering wheel rim",(.00,-.38,1.00),.205,.023,DASH,steering,(0,math.pi/2,0),56,10)
    cylinder("Steering hub",(.00,-.38,1.00),.052,.055,CHROME,steering,40,(0,math.pi/2,0),.008)
    for i,a in enumerate((0,2*math.pi/3,4*math.pi/3),1):
        curve_tube(f"Steering spoke {i}",[(.005,-.38,1.00),(.005,-.38+math.cos(a)*.17,1.00+math.sin(a)*.17)],.014,CHROME,steering)
    curve_tube("Gear lever",[(-.05,-.10,.68),(-.12,-.10,.83)],.015,CHROME,cabin)
    uv("Gear knob",(-.12,-.10,.85),(.035,.035,.035),DASH,cabin,32,16)

    screen=empty("windshield",root)
    # Lower and more raked than v1: 0.49 m above the cowl, 11 degrees aft.
    left_base=(.18,.67,.78); left_top=(.07,.60,1.19); right_top=(.07,-.60,1.19); right_base=(.18,-.67,.78)
    curve_tube("Windshield perimeter",[left_base,left_top,right_top,right_base],.024,CHROME,screen)
    curve_tube("Windshield centre divider",[(.18,0,.78),(.07,0,1.19)],.014,CHROME,screen)
    verts=[left_base,left_top,(.07,0,1.19),(.18,0,.78),right_base,right_top,(.07,0,1.19),(.18,0,.78)]
    mesh_object("Left windshield glass",verts[:4],[(0,1,2,3)],GLASS,screen,False)
    mesh_object("Right windshield glass",verts[4:],[(0,1,2,3)],GLASS,screen,False)
    for label,y in (("Right",-.27),("Left",.27)):
        curve_tube(label+" wiper",[(.21,y,.80),(.13,y*.45,1.02)],.009,CHROME,screen)
    return root


def descendants(root):
    out=[root]
    for child in root.children: out.extend(descendants(child))
    return out


def export(root):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root): obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=GLB,export_format="GLB",use_selection=True,export_animations=False,
                              export_yup=True,export_apply=True)


def point_camera(camera, target):
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()


def setup_scene():
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE"
    scene.render.resolution_x=1200; scene.render.resolution_y=850; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    scene.world.color=(.025,.028,.03)
    scene.view_settings.look="AgX - Medium High Contrast"
    ground=material("Studio floor",(.12,.13,.13),.58)
    cube("Studio cyclorama",(0,0,-.06),(3.2,2.8,.06),ground,.04)
    bpy.ops.object.camera_add(location=(5.3,-5.7,3.45))
    cam=bpy.context.object; cam.name="Review camera"; cam.data.lens=74
    point_camera(cam,(0,0,.57)); scene.camera=cam
    for loc,energy,size,color in (
        ((2.5,-3.4,5.2),1450,4.0,(1.0,.88,.73)),((-3.2,2.5,3.8),1050,3.0,(.60,.76,1.0)),
        ((0,3.4,4.4),1250,3.5,(1.0,.98,.93)),((0,-.6,5.5),950,2.5,(1.0,1.0,1.0))):
        bpy.ops.object.light_add(type="AREA",location=loc)
        light=bpy.context.object; light.data.energy=energy; light.data.shape="DISK"; light.data.size=size; light.data.color=color
        light.rotation_euler=(Vector((0,0,.55))-light.location).to_track_quat("-Z","Y").to_euler()
    return cam


def main():
    os.makedirs(ASSETS,exist_ok=True); os.makedirs(REVIEWS,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    car=build_car(); cam=setup_scene()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    export(car)
    bpy.context.scene.render.filepath=FRONT; bpy.ops.render.render(write_still=True)
    cam.location=(-5.1,5.4,3.25); point_camera(cam,(-.05,0,.58))
    bpy.context.scene.render.filepath=REAR; bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("Created",BLEND); print("Created",GLB); print("Created",FRONT); print("Created",REAR)


if __name__ == "__main__":
    main()
