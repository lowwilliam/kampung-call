import math
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
from create_remaining_assets import (
    reset, empty, cube, cyl, ico, label, cable, export_asset,
    INK, CREAM, CHALK, TEAL, TEAL2, CORAL, YELLOW, GLASS, CONCRETE,
    METAL, WOOD, WOOD2, GREEN, GREEN2, GREEN3, RED, BLUE,
)


def torus(name, loc, major, minor, mat, parent, rot=(0, 0, 0), major_segments=32):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=8, location=loc, rotation=rot)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat);o.parent=parent
    return o


def sphere(name, loc, radius, mat, parent, scale=(1,1,1), segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, radius=radius, location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);o.parent=parent
    return o


def cone(name, loc, r1, r2, depth, mat, parent, vertices=12, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2,
        depth=depth, location=loc, rotation=rot)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat);o.parent=parent
    return o


# ---------------------------------------------------------------------------
# PRIORITY 2 — LANDMARKS
# ---------------------------------------------------------------------------
def build_merlion():
    r=empty("MERLION WATERFRONT KIT")
    cyl("Wave pedestal",(0,0,.32),1.45,.55,TEAL,r,20)
    for a in range(8):
        torus("Water ripple",(math.cos(a*.78)*1.15,math.sin(a*.78)*.75,.55),.24,.045,CHALK,r,
              rot=(math.radians(90),0,0),major_segments=14)
    sphere("Fish body",(0,.15,1.65),.92,CHALK,r,scale=(.82,.72,1.25))
    for z in (1.08,1.38,1.68):
        torus("Fish scales",(0,-.55,z),.45,.035,TEAL2,r,rot=(math.radians(90),0,0),major_segments=12)
    sphere("Lion head",(0,-.05,2.72),.78,CHALK,r,scale=(1,.92,.95))
    for a in range(10):
        ico("Mane lock",(math.cos(a*.628)*.72,-.03,2.72+math.sin(a*.628)*.72),.32,CORAL,r,scale=(.75,.55,1.05))
    sphere("Muzzle",(0,-.68,2.57),.38,CREAM,r,scale=(1,.62,.65))
    for x in (-.25,.25):
        sphere("Eye",(x,-.67,2.91),.09,INK,r)
    cone("Nose",(0,-.97,2.66),.13,.04,.20,INK,r,8,rot=(math.radians(90),0,0))
    cable("Water stream",[(0,-.98,2.48),(0,-1.5,2.18),(0,-2.05,1.55),(0,-2.55,.78)],.10,BLUE,r)
    label("MERLION",(0,-1.48,.34),.22,CHALK,r)
    return r


def build_mbs():
    r=empty("MARINA BAY SANDS SKYLINE KIT")
    for i,x in enumerate((-2.25,0,2.25)):
        cube("Hotel tower",(x,.25,3.4),(1.7,2.5,6.6),CHALK,r,rot=(0,math.radians((i-1)*-3),0),edge=.18)
        cube("Glass face",(x,-1.03,3.45),(1.22,.08,5.9),GLASS,r,edge=.035)
        for f in range(7):
            cube("Hotel floor band",(x,-1.09,1.05+f*.75),(1.28,.045,.055),INK,r,edge=.008)
    cube("SkyPark hull",(0,.18,7.12),(7.6,2.65,.48),TEAL,r,edge=.22)
    cube("SkyPark deck",(.45,.18,7.50),(7.2,2.45,.22),CHALK,r,edge=.12)
    for x in (-2.7,2.7):
        ico("SkyPark tree",(x,-.2,7.92),.43,(GREEN2 if x<0 else GREEN3),r,scale=(1.4,.8,.75))
    cube("Infinity pool",(.7,-.55,7.68),(3.4,.72,.10),BLUE,r,edge=.05)
    # ArtScience Museum silhouette beside the towers.
    cyl("Museum base",(-4.2,.15,.42),.62,.54,CONCRETE,r,18)
    for a in range(8):
        cone("Lotus petal",(-4.2+math.cos(a*.785)*.52,.15+math.sin(a*.785)*.52,1.15),.38,.10,1.45,CHALK,r,10,
             rot=(math.sin(a*.785)*.35,math.cos(a*.785)*.35,0))
    return r


def build_flyer():
    r=empty("SINGAPORE FLYER KIT")
    for x in (-1.2,1.2):
        cube("A-frame leg",(x*.55,0,2.35),(.24,.35,4.9),METAL,r,rot=(0,math.radians(x*8),math.radians(-x*7)),edge=.06)
    torus("Observation wheel",(0,0,4.5),3.05,.16,CHALK,r,rot=(math.radians(90),0,0),major_segments=40)
    cyl("Wheel hub",(0,-.12,4.5),.34,.5,CORAL,r,18,rot=(math.radians(90),0,0))
    for i in range(12):
        a=i*math.tau/12
        x,z=math.cos(a)*3.05,4.5+math.sin(a)*3.05
        cube("Wheel spoke",(x*.5,-.02,(z+4.5)*.5),(.055,.09,3.05),METAL,r,
             rot=(0,0,a-math.pi/2),edge=.008)
        cube("Flyer capsule",(x,-.18,z),(.52,.38,.38),TEAL2 if i%2 else CORAL,r,edge=.12)
        cube("Capsule glass",(x,-.40,z),(.34,.06,.20),GLASS,r,edge=.035)
    cube("Flyer terminal",(0,.55,.42),(4.8,2.0,.72),TEAL,r,edge=.14)
    label("SINGAPORE FLYER",(0,-.48,.48),.25,CHALK,r)
    return r


def build_supertree():
    r=empty("SUPERTREE GROVE KIT")
    cone("Flared trunk",(0,0,2.5),.78,.32,5.0,CORAL,r,18)
    for a in range(10):
        cable("Trunk lattice",[(math.cos(a*.628)*.55,math.sin(a*.628)*.55,.25),
            (math.cos(a*.628)*.30,math.sin(a*.628)*.30,3.6),
            (math.cos(a*.628)*1.35,math.sin(a*.628)*1.35,5.2)],.055,TEAL,r)
    torus("Canopy rim",(0,0,5.25),1.65,.13,CHALK,r,major_segments=28)
    for ring,rad,z in ((0,1.35,5.12),(1,.88,5.58)):
        for i in range(10 if ring==0 else 7):
            a=i*math.tau/(10 if ring==0 else 7)
            ico("Vertical garden",(math.cos(a)*rad,math.sin(a)*rad,z),.55,(GREEN,GREEN2,GREEN3)[i%3],r,scale=(1.2,1.0,.65))
    cyl("Canopy crown",(0,0,5.76),.42,.32,YELLOW,r,18)
    return r


def build_esplanade():
    r=empty("ESPLANADE TWIN DOME KIT")
    cube("Waterfront plinth",(0,.25,.30),(6.8,4.1,.55),CONCRETE,r,edge=.18)
    for x in (-1.7,1.7):
        sphere("Durian dome",(x,.1,1.55),1.55,CHALK,r,scale=(1.12,.92,.72))
        for ring in range(4):
            z=.82+ring*.44
            count=8+ring*2
            rad=1.35*(1-ring*.12)
            for i in range(count):
                a=i*math.tau/count
                cone("Sunshade spike",(x+math.cos(a)*rad,math.sin(a)*rad*.76,z),.11,.015,.52,METAL,r,6,
                     rot=(math.cos(a)*.35,math.sin(a)*.35,0))
    cube("Theatre link",(0,.72,.98),(1.2,2.4,1.2),TEAL,r,edge=.14)
    label("ESPLANADE",(0,-1.94,.48),.24,CORAL,r)
    return r


# ---------------------------------------------------------------------------
# PRIORITY 3 — NEIGHBOURHOODS AND INFRASTRUCTURE
# ---------------------------------------------------------------------------
def build_mrt():
    r=empty("NEIGHBOURHOOD MRT ENTRANCE")
    cube("Station plinth",(0,.2,.18),(5.5,4.2,.32),CONCRETE,r,edge=.15)
    for i in range(6):
        cube("Descending stair",(0,-1.6+i*.42,.34+i*.18),(2.45,.48,.16),CHALK,r,edge=.035)
    cube("Entrance portal",(0,.3,1.85),(3.6,2.1,2.9),TEAL,r,edge=.14)
    cube("Portal void",(0,-.79,1.55),(2.55,.16,1.95),INK,r,edge=.06)
    cube("Glass canopy",(0,-1.28,3.18),(4.4,2.5,.20),GLASS,r,rot=(math.radians(-6),0,0),edge=.09)
    for x in (-1.7,1.7):
        cyl("Canopy column",(x,-1.0,1.72),.10,2.8,METAL,r)
    cube("MRT roundel",(-1.55,-1.58,2.45),(.85,.16,.85),CORAL,r,edge=.16)
    label("MRT",(-1.55,-1.69,2.47),.25,CHALK,r)
    label("KAMPUNG CENTRAL",(.35,-1.68,2.72),.18,CHALK,r)
    return r


def build_shophouse():
    r=empty("HERITAGE SHOPHOUSE")
    cube("Shophouse body",(0,.25,2.15),(3.2,3.0,4.1),CREAM,r,edge=.12)
    cube("Five-foot way",(0,-1.5,.38),(3.55,1.0,.28),CONCRETE,r,edge=.08)
    for x in (-1.25,1.25):
        cyl("Arcade column",(x,-1.58,1.25),.13,2.25,TEAL,r,16)
    for floor,z in enumerate((2.2,3.35)):
        for x in (-.82,.82):
            cube("Window recess",(x,-1.30,z),(.78,.10,.78),INK,r,edge=.04)
            cube("Timber shutter",(x,-1.37,z),(.58,.08,.62),TEAL2 if (floor+int(x>0))%2 else CORAL,r,edge=.035)
            torus("Window arch",(x,-1.39,z+.34),.39,.055,CHALK,r,rot=(math.radians(90),0,0),major_segments=16)
    cube("Shopfront",(0,-1.34,1.03),(2.45,.12,1.12),GLASS,r,edge=.045)
    cube("Striped awning",(0,-1.78,1.72),(2.75,.88,.16),CORAL,r,rot=(math.radians(-8),0,0),edge=.055)
    cube("Peranakan parapet",(0,.20,4.42),(3.45,3.15,.45),TEAL,r,edge=.10)
    for x in (-1.0,0,1.0):
        ico("Parapet ornament",(x,-1.25,4.75),.24,YELLOW,r,scale=(1,.55,1))
    label("KEDAI 88",(0,-1.46,1.28),.22,CHALK,r)
    return r


def build_hawker():
    r=empty("HAWKER CENTRE KIT")
    cube("Hawker slab",(0,.15,.22),(7.2,5.0,.38),CONCRETE,r,edge=.14)
    for x in (-3.0,3.0):
        for y in (-1.8,1.8):
            cyl("Hawker column",(x,y,2.25),.14,4.15,TEAL,r,16)
    cube("Ventilated roof",(0,.1,4.18),(7.7,5.5,.30),CHALK,r,edge=.13)
    for i,(x,col,name) in enumerate(((-2.4,CORAL,"SATAY"),(-.8,TEAL2,"NOODLES"),(.8,YELLOW,"RICE"),(2.4,BLUE,"DRINKS"))):
        cube("Food stall",(x,1.45,1.28),(1.42,1.45,2.0),CREAM,r,edge=.07)
        cube("Stall hatch",(x,.69,1.50),(1.08,.10,.75),INK,r,edge=.035)
        cube("Stall fascia",(x,.60,2.28),(1.34,.16,.42),col,r,edge=.045)
        label(name,(x,.49,2.30),.13,CHALK if col!=YELLOW else INK,r)
    for x in (-2,-.65,.65,2):
        cube("Hawker table",(x,-1.15,.83),(1.0,.72,.12),CHALK,r,edge=.06)
        cyl("Table stem",(x,-1.15,.48),.11,.67,METAL,r)
    cube("Hawker sign",(0,-2.48,3.72),(4.2,.16,.72),TEAL,r,edge=.08)
    label("KAMPUNG HAWKER",(0,-2.59,3.75),.28,CHALK,r)
    return r


def build_temple():
    r=empty("NEIGHBOURHOOD TEMPLE KIT")
    cube("Temple podium",(0,.25,.30),(5.4,4.3,.55),CONCRETE,r,edge=.14)
    cube("Temple hall",(0,.4,1.85),(4.4,3.2,2.65),CORAL,r,edge=.10)
    for x in (-1.65,1.65):
        cyl("Red column",(x,-1.37,1.78),.16,2.85,RED,r,16)
        cyl("Stone guardian",(x,-1.82,.82),.34,1.05,CHALK,r,14)
    cube("Temple door",(0,-1.25,1.55),(1.55,.12,2.05),INK,r,edge=.055)
    label("福",(0,-1.34,1.72),.58,YELLOW,r)
    for level,(z,w) in enumerate(((3.35,5.3),(4.05,4.3))):
        cube("Layered roof",(0,.2,z),(w,4.0-level*.65,.22),TEAL,r,edge=.10)
        for x in (-w/2,w/2):
            cone("Upturned eave",(x,.2,z+.20),.25,.02,.62,YELLOW,r,8,rot=(0,math.radians(90),0))
    for x in (-1.25,1.25):
        cyl("Lantern",(x,-1.65,2.65),.22,.48,CORAL,r,14)
        cable("Lantern cord",[(x,-1.65,3.20),(x,-1.65,2.90)],.025,INK,r)
    return r


def build_mamashop():
    r=empty("MAMA SHOP KIT")
    cube("Shop shell",(0,.3,1.45),(4.1,2.8,2.7),CREAM,r,edge=.11)
    cube("Open storefront",(0,-1.14,1.35),(3.4,.14,1.85),INK,r,edge=.055)
    cube("Counter",(0,-1.48,.82),(3.2,.62,.82),TEAL,r,edge=.08)
    for i,(x,col) in enumerate(((-1.1,CORAL),(-.36,YELLOW),(.36,BLUE),(1.1,TEAL2))):
        cube("Goods shelf",(x,-1.57,1.65),(.56,.14,.72),col,r,edge=.035)
        for z in (1.48,1.70,1.92):
            cube("Shelf line",(x,-1.67,z),(.45,.04,.035),CHALK,r,edge=.006)
    cube("Shop awning",(0,-1.62,2.83),(4.5,1.0,.18),CORAL,r,rot=(math.radians(-8),0,0),edge=.06)
    cube("Mama sign",(0,-1.34,2.58),(3.0,.12,.52),TEAL,r,edge=.055)
    label("MAMA SHOP",(0,-1.44,2.60),.24,CHALK,r)
    for x in (-1.65,1.65):
        cyl("Snack jar",(x,-1.72,1.18),.18,.40,CHALK,r,14)
        cyl("Jar lid",(x,-1.72,1.42),.20,.08,YELLOW,r,14)
    return r


def build_busstop():
    r=empty("SINGAPORE BUS STOP")
    cube("Bus stop pad",(0,0,.15),(5.6,2.2,.26),CONCRETE,r,edge=.12)
    for x in (-2.2,2.2):
        cyl("Shelter post",(x,.35,1.65),.09,3.0,METAL,r)
    cube("Curved shelter",(0,.3,3.12),(5.2,2.05,.22),TEAL,r,rot=(math.radians(-4),0,0),edge=.12)
    cube("Glass windscreen",(2.18,.80,1.65),(.10,1.25,2.25),GLASS,r,edge=.04)
    cube("Bench",(-.35,.10,.72),(3.2,.62,.18),WOOD2,r,edge=.07)
    cube("Route pylon",(-2.42,-.55,1.55),(.55,.35,2.65),CORAL,r,edge=.09)
    label("65\n97\n143",(-2.42,-.76,1.58),.18,CHALK,r)
    label("BUS STOP",(.45,-.84,2.73),.24,CHALK,r)
    return r


def build_bridge():
    r=empty("PEDESTRIAN OVERHEAD BRIDGE")
    cube("Bridge deck",(0,0,3.05),(8.2,1.6,.28),CONCRETE,r,edge=.10)
    for side in (-1,1):
        cube("Bridge rail",(0,side*.72,3.72),(8.1,.10,1.12),TEAL,r,edge=.045)
        for x in (-3.5,-2.5,-1.5,-.5,.5,1.5,2.5,3.5):
            cube("Rail opening",(x,side*.79,3.72),(.55,.04,.58),GLASS,r,edge=.025)
    for x in (-3.25,3.25):
        cyl("Bridge pier",(x,0,1.48),.20,2.95,METAL,r,16)
    for side in (-1,1):
        for i in range(7):
            x=side*(4.25+i*.45)
            cube("Bridge stair",(x,0,2.75-i*.38),(.62,1.48,.20),CHALK,r,edge=.035)
    cube("Bridge sign",(0,-.84,3.70),(2.6,.10,.56),CORAL,r,edge=.055)
    label("CROSS SAFELY",(0,-.91,3.72),.20,CHALK,r)
    return r


def build_controltower():
    r=empty("CHANGI CONTROL TOWER")
    cone("Tapered shaft",(0,0,3.3),.70,.38,6.6,CHALK,r,16)
    cyl("Cab collar",(0,0,6.65),1.05,.42,CONCRETE,r,16)
    cyl("Control cab",(0,0,7.12),1.18,.78,GLASS,r,16)
    cone("Cab roof",(0,0,7.72),1.28,.55,.42,CORAL,r,16)
    cyl("Beacon mast",(0,0,8.38),.07,1.1,METAL,r,10)
    sphere("Beacon",(0,0,8.98),.13,YELLOW,r)
    for a in range(8):
        cube("Cab mullion",(math.cos(a*.785)*1.02,math.sin(a*.785)*1.02,7.12),(.08,.08,.72),INK,r,
             rot=(0,0,a*.785),edge=.012)
    label("CHANGI",(0,-.72,3.75),.22,TEAL,r)
    return r


def build_bg_hdb():
    r=empty("BACKGROUND HDB FAMILY")
    cube("HDB slab",(0,.4,3.9),(5.0,2.7,7.4),CREAM,r,edge=.13)
    cube("Stair core",(-2.75,.55,3.75),(.65,2.5,7.0),TEAL,r,edge=.11)
    for f in range(6):
        z=1.25+f*.98
        cube("Corridor ledge",(0,-1.15,z),(4.85,.38,.10),CONCRETE,r,edge=.025)
        cube("Corridor rail",(0,-1.37,z+.25),(4.75,.06,.40),INK,r,edge=.015)
        for x in (-1.65,0,1.65):
            cube("HDB door",(x,-1.02,z+.13),(.52,.08,.72),TEAL2 if (f+int(x))%2 else CORAL,r,edge=.035)
    cube("Void deck",(0,-.80,.55),(4.8,.45,.80),INK,r,edge=.08)
    cube("Block panel",(1.85,-1.12,.82),(.72,.10,.82),CORAL,r,edge=.06)
    label("BLK",(1.85,-1.20,.83),.22,CHALK,r)
    cube("Roof cap",(0,.4,7.68),(5.3,3.0,.22),CHALK,r,edge=.10)
    return r


def build_bg_condo():
    r=empty("BACKGROUND CONDO FAMILY")
    for i,(x,h) in enumerate(((-1.2,6.8),(1.0,5.7))):
        cube("Condo wing",(x,.4,h/2),(2.15,2.7,h),CHALK if i else CREAM,r,edge=.13)
        cube("Glass spine",(x,-.98,h/2),(.72,.08,h-.5),GLASS,r,edge=.03)
        for f in range(int(h/.85)):
            cube("Condo balcony",(x,-1.16,.65+f*.85),(1.65,.35,.10),CONCRETE,r,edge=.025)
            cube("Condo rail",(x,-1.36,.83+f*.85),(1.58,.04,.30),TEAL,r,edge=.012)
    cube("Condo lobby",(0,-.15,.52),(4.8,3.5,.90),TEAL2,r,edge=.12)
    cube("Lobby glass",(0,-1.92,.75),(2.4,.10,1.15),GLASS,r,edge=.04)
    return r


def build_bg_landed():
    r=empty("BACKGROUND LANDED HOME FAMILY")
    cube("House plinth",(0,.2,.18),(4.5,3.6,.30),CONCRETE,r,edge=.11)
    cube("House body",(0,.45,1.65),(3.9,3.0,2.8),CREAM,r,edge=.12)
    cube("Porch recess",(-.85,-1.15,1.10),(1.5,.35,1.55),TEAL,r,edge=.06)
    cube("Front window",(.85,-1.11,1.72),(1.25,.08,1.08),GLASS,r,edge=.04)
    for s in (-1,1):
        cube("Pitched roof",(s*.82,.4,3.22),(2.2,3.55,.18),CORAL,r,rot=(0,s*math.radians(24),0),edge=.07)
    cube("Gate",(0,-1.62,.78),(4.0,.10,1.1),INK,r,edge=.035)
    for x in (-1.6,-.8,0,.8,1.6):
        cube("Gate slat",(x,-1.68,.78),(.08,.04,1.0),CHALK,r,edge=.01)
    return r


# ---------------------------------------------------------------------------
# PRIORITY 4 — AMBIENT LIFE
# ---------------------------------------------------------------------------
def build_palm():
    r=empty("TROPICAL PALM")
    cable("Curved palm trunk",[(0,0,0),(.10,0,1.4),(-.10,.02,2.8),(.18,0,4.0)],.16,WOOD2,r)
    for i in range(8):
        a=i*math.tau/8
        cable("Palm frond",[(.18,0,4.0),(.18+math.cos(a)*.75,math.sin(a)*.75,4.25),
            (.18+math.cos(a)*1.45,math.sin(a)*1.45,3.82)],.08,(GREEN,GREEN2,GREEN3)[i%3],r)
        for j in range(3):
            ico("Palm leaflet",(.18+math.cos(a)*(.75+j*.28),math.sin(a)*(.75+j*.28),4.16-j*.12),.34,
                (GREEN,GREEN2,GREEN3)[(i+j)%3],r,scale=(1.5,.38,.18))
    for a in (0,2.1,4.2):
        sphere("Coconut",(.18+math.cos(a)*.30,math.sin(a)*.30,3.86),.18,WOOD,r)
    return r


def build_cat():
    r=empty("NEIGHBOURHOOD CAT")
    sphere("Cat body",(0,.05,.58),.48,CORAL,r,scale=(.72,1.15,.72))
    sphere("Cat head",(0,-.42,1.00),.38,CORAL,r,scale=(1,.86,.92))
    for x in (-.22,.22):
        cone("Cat ear",(x,-.40,1.37),.18,.02,.42,CORAL,r,6)
        sphere("Cat eye",(x*.68,-.75,1.08),.055,GREEN3,r)
    sphere("Cat muzzle",(0,-.74,.91),.16,CHALK,r,scale=(1,.55,.65))
    cable("Curled tail",[(.35,.35,.58),(.78,.68,.80),(.72,.75,1.28),(.42,.65,1.42)],.095,CORAL,r)
    for x in (-.22,.22):
        cyl("Cat paw",(x,-.34,.18),.10,.34,CHALK,r,10)
    return r


def build_bicycle():
    r=empty("KAMPUNG BICYCLE")
    for x in (-.82,.82):
        torus("Bicycle wheel",(x,0,.72),.62,.055,INK,r,rot=(math.radians(90),0,0),major_segments=24)
        cyl("Wheel hub",(x,0,.72),.07,.16,YELLOW,r,10,rot=(math.radians(90),0,0))
    cable("Bicycle frame",[(-.82,0,.72),(0,0,.72),(.42,0,1.30),(-.35,0,1.30),(-.82,0,.72)],.055,TEAL2,r)
    cable("Front fork",[(.82,0,.72),(.55,0,1.48),(.68,0,1.72)],.045,METAL,r)
    cube("Bicycle seat",(-.32,0,1.48),(.42,.22,.10),CORAL,r,edge=.04)
    cable("Handlebar",[(.56,0,1.55),(.78,0,1.78),(.98,0,1.78)],.04,METAL,r)
    cube("Delivery basket",(.88,-.02,1.38),(.55,.48,.42),CHALK,r,edge=.065)
    return r


def build_birdcage():
    r=empty("BIRD CAGE CLUSTER")
    for idx,x in enumerate((-.65,.65)):
        torus("Cage base",(x,0,.48),.42,.055,WOOD2,r,major_segments=18)
        torus("Cage crown",(x,0,1.45),.28,.045,WOOD2,r,major_segments=18)
        for i in range(10):
            a=i*math.tau/10
            cable("Cage bar",[(x+math.cos(a)*.40,math.sin(a)*.40,.48),
                (x+math.cos(a)*.28,math.sin(a)*.28,1.45),(x,0,1.78)],.018,INK,r)
        cable("Cage hanger",[(x,0,1.78),(x,0,2.18),(x+.16,0,2.35)],.035,METAL,r)
        sphere("Song bird",(x+(idx*2-1)*.10,-.10,1.05),.13,(YELLOW if idx==0 else TEAL2),r,scale=(1,.7,.8))
        cyl("Perch",(x,0,1.02),.025,.72,WOOD,r,8,rot=(0,math.radians(90),0))
    return r


def build_bumboat():
    r=empty("SINGAPORE RIVER BUMBOAT")
    cube("Boat hull",(0,0,.55),(3.8,1.45,.78),TEAL,r,edge=.24)
    cube("Hull stripe",(0,-.76,.63),(3.0,.08,.26),YELLOW,r,edge=.035)
    cube("Boat cabin",(.25,.05,1.28),(2.15,1.18,1.0),CHALK,r,edge=.12)
    cube("Cabin windows",(.25,-.57,1.35),(1.72,.08,.48),GLASS,r,edge=.035)
    cube("Canopy",(.12,.05,1.93),(2.65,1.55,.16),CORAL,r,edge=.08)
    for x in (-1.15,1.15):
        cyl("Tyre fender",(x,-.78,.50),.24,.12,INK,r,14,rot=(math.radians(90),0,0))
    cube("Bow eye",(-1.90,-.02,.74),(.16,.42,.24),METAL,r,edge=.05)
    label("SG RIVER",(.25,-.64,1.35),.15,CHALK,r)
    return r


# ---------------------------------------------------------------------------
# PRIORITY 5 — FIELD-SERVICE PROPS
# ---------------------------------------------------------------------------
def build_routerkit():
    r=empty("ROUTER INSTALLATION KIT")
    cube("Equipment mat",(0,0,.10),(2.3,1.7,.18),CONCRETE,r,edge=.10)
    cube("WiFi router",(0,.05,.58),(1.25,.65,.38),CHALK,r,edge=.10)
    for x in (-.45,-.15,.15,.45):
        cyl("Router antenna",(x,.18,1.06),.025,.78,INK,r,8)
    for i,c in enumerate((GREEN2,GREEN2,YELLOW,BLUE)):
        sphere("Router LED",(-.36+i*.24,-.30,.62),.035,c,r)
    cube("Engineer toolkit",(.72,.48,.38),(.65,.48,.55),CORAL,r,edge=.08)
    cube("Toolkit handle",(.72,.48,.72),(.38,.12,.18),INK,r,edge=.04)
    cable("WAN patch lead",[(-.50,.32,.52),(-.78,.58,.30),(-.55,.82,.18),(.15,.72,.20)],.035,TEAL2,r)
    return r


def build_fibrekit():
    r=empty("FIBRE ONT DIAGNOSTIC KIT")
    cube("Diagnostic mat",(0,0,.10),(2.3,1.7,.18),CONCRETE,r,edge=.10)
    cube("ONT",(-.35,.05,.62),(1.05,.62,.72),CHALK,r,edge=.10)
    label("ONT",(-.35,-.30,.72),.14,TEAL,r)
    for i,c in enumerate((GREEN2,YELLOW,CORAL)):
        sphere("ONT LED",(-.62+i*.27,-.32,.48),.04,c,r)
    cube("Optical meter",(.62,.08,.52),(.58,.42,.90),BLUE,r,edge=.09)
    cube("Meter screen",(.62,-.15,.70),(.38,.05,.28),INK,r,edge=.025)
    label("-18.4",(.62,-.19,.70),.10,YELLOW,r)
    cable("Fibre patch",[(-.78,.30,.54),(-.95,.62,.28),(-.30,.72,.18),(.55,.40,.30),(.65,.25,.42)],.025,YELLOW,r)
    return r


def build_wifikit():
    r=empty("WIFI MESH SURVEY KIT")
    cube("Survey mat",(0,0,.10),(2.5,1.8,.18),CONCRETE,r,edge=.10)
    for i,x in enumerate((-.72,0,.72)):
        cyl("Mesh node",(x,.08,.62),.20,.82,CHALK,r,16)
        cyl("Node status ring",(x,.08,.72),.22,.07,(TEAL2,YELLOW,GREEN2)[i],r,16)
    cube("WiFi analyser",(0,-.55,.52),(.72,.28,.78),BLUE,r,edge=.09)
    cube("Analyser screen",(0,-.72,.62),(.48,.05,.34),INK,r,edge=.03)
    for k,h in enumerate((.30,.48,.70)):
        cube("Signal bar",(-.16+k*.16,-.76,.54+h*.18),(.08,.04,h*.28),GREEN2 if k>0 else YELLOW,r,edge=.01)
    cable("Charging lead",[(.72,.30,.40),(1.0,.62,.22),(.45,.76,.16),(-.05,.64,.25)],.028,INK,r)
    return r


JOBS = [
    # P2
    ("merlion-v2",build_merlion,(0,-.1,1.7),(8,-12,6.5),4.0),
    ("mbs-v2",build_mbs,(0,0,3.7),(14,-19,11),6.5),
    ("flyer-v2",build_flyer,(0,0,4.1),(13,-18,10),6.0),
    ("supertree-v2",build_supertree,(0,0,3.0),(9,-13,7.5),4.0),
    ("esplanade-v2",build_esplanade,(0,0,1.6),(11,-16,7),5.5),
    # P3
    ("mrt-v2",build_mrt,(0,0,1.7),(10,-14,7),4.5),
    ("shophouse-v2",build_shophouse,(0,0,2.2),(9,-13,7),4.0),
    ("hawker-v2",build_hawker,(0,0,2.1),(12,-16,8),6.0),
    ("temple-v2",build_temple,(0,0,2.3),(11,-15,8),5.0),
    ("mamashop-v2",build_mamashop,(0,0,1.5),(9,-13,6),4.0),
    ("busstop-v2",build_busstop,(0,0,1.5),(10,-14,6.5),4.0),
    ("overheadbridge-v2",build_bridge,(0,0,2.5),(13,-18,8),7.0),
    ("controltower-v2",build_controltower,(0,0,4.5),(11,-16,9),4.0),
    ("hdb-bg-v2",build_bg_hdb,(0,0,3.7),(11,-16,9),4.5),
    ("condo-bg-v2",build_bg_condo,(0,0,3.3),(11,-16,8),4.5),
    ("landed-bg-v2",build_bg_landed,(0,0,1.7),(9,-13,6),4.0),
    # P4
    ("palm-v2",build_palm,(0,0,2.3),(7,-10,6),3.0),
    ("cat-v2",build_cat,(0,0,.8),(5,-7,3.4),2.0),
    ("bicycle-v2",build_bicycle,(0,0,.9),(6,-8,4),2.5),
    ("birdcage-v2",build_birdcage,(0,0,1.1),(6,-8,4),2.5),
    ("bumboat-v2",build_bumboat,(0,0,1.0),(8,-11,5),3.5),
    # P5
    ("router-kit-v2",build_routerkit,(0,0,.55),(5,-7,3.3),2.0),
    ("fibre-kit-v2",build_fibrekit,(0,0,.55),(5,-7,3.3),2.0),
    ("wifi-kit-v2",build_wifikit,(0,0,.55),(5,-7,3.3),2.0),
]


if __name__ == "__main__":
    for slug,builder,target,camera,ground in JOBS:
        reset()
        export_asset(builder(),slug,target,camera,ground)
    print("Priority 2–5 Blender assets created")
