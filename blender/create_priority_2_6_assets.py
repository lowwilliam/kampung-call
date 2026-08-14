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


def torus(name, loc, major, minor, mat, parent, rot=(0, 0, 0), major_segments=20,
          minor_segments=4):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=minor_segments,
        location=loc, rotation=rot)
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
def build_harbour_statue():
    r=empty("HARBOUR STATUE WATERFRONT KIT")
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
    label("HARBOUR STATUE",(0,-1.48,.34),.22,CHALK,r)
    return r


def build_skypark_hotel():
    r=empty("SKYPARK HOTEL SKYLINE KIT")
    for i,x in enumerate((-2.25,0,2.25)):
        cube("Hotel tower",(x,.25,3.4),(1.7,2.5,6.6),CHALK,r,rot=(0,math.radians((i-1)*-3),0),edge=.18)
        cube("Glass face",(x,-1.03,3.45),(1.22,.08,5.9),GLASS,r,edge=.035)
        # The reference establishes the harbour elevation, not a blank back.
        # A quieter guest-room curtain wall keeps the inferred rear credible
        # during a full orbit without pretending to reproduce exact plans.
        cube("Rear glass face",(x,1.53,3.45),(1.22,.08,5.9),GLASS,r,edge=.035)
        for f in range(7):
            cube("Hotel floor band",(x,-1.09,1.05+f*.75),(1.28,.045,.055),INK,r,edge=.008)
            cube("Rear hotel floor band",(x,1.59,1.05+f*.75),(1.28,.045,.055),INK,r,edge=.008)
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
    r=empty("SINGAPORE FLYER ASSEMBLY")
    hub_z=4.45
    radius=3.05
    # Double rim, radial cables and a real axle make the wheel read from every orbit.
    for y in (-.12,.12):
        torus("Wheel rim",(0,y,hub_z),radius,.12,CHALK,r,
              rot=(math.radians(90),0,0),major_segments=36)
        for i in range(12):
            a=i*math.tau/12
            cable("Radial spoke",[(0,y,hub_z),
                (math.cos(a)*radius,y,hub_z+math.sin(a)*radius)],.026,TEAL,r)
    cyl("Wheel axle",(0,0,hub_z),.30,.72,TEAL,r,20,rot=(math.radians(90),0,0))
    torus("Hub collar",(0,-.38,hub_z),.38,.055,TEAL,r,
          rot=(math.radians(90),0,0),major_segments=20)
    # Four endpoint-connected A-frame legs; each root overlaps the base and hub.
    for y in (-.46,.46):
        for side in (-1,1):
            cable("A-frame support",[(side*1.55,y,.32),(side*.22,y,hub_z)],.13,TEAL,r)
    cable("Support cross brace",[(-1.18,-.46,1.15),(1.18,-.46,1.15)],.075,TEAL,r)
    # The real Flyer has 28 capsules; 16 preserve the identity at this browser budget.
    for i in range(16):
        a=i*math.tau/16
        x,z=math.cos(a)*(radius+.02),hub_z+math.sin(a)*(radius+.02)
        cable("Capsule hanger",[(x,-.13,z),(x,-.30,z-.20)],.028,TEAL,r)
        cube("Observation capsule",(x,-.34,z-.36),(.50,.42,.38),TEAL2,r,edge=.12)
        cube("Capsule glazing",(x,-.57,z-.36),(.34,.055,.22),GLASS,r,edge=.03)
        cube("Capsule floor",(x,-.34,z-.56),(.34,.32,.055),TEAL,r,edge=.02)
    # Keep the terminal low and offset so it no longer masks the wheel silhouette.
    cube("Flyer terminal",(-2.35,.58,.42),(2.65,1.65,.70),TEAL,r,edge=.14)
    cube("Terminal glass",(-2.35,-.27,.48),(2.12,.08,.38),GLASS,r,edge=.035)
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


def build_concert_hall():
    r=empty("CONCERT HALL TWIN DOME KIT")
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
    label("CONCERT HALL",(0,-1.94,.48),.24,CORAL,r)
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
    # Inferred service elevation: rear shutters, back door, rain canopy and
    # drain stack replace the single-image reconstruction's empty wall.
    for x in (-1.05,1.05):
        for z in (2.2,3.35):
            cube("Rear window recess",(x,1.78,z),(.72,.10,.66),INK,r,edge=.035)
            cube("Rear timber shutter",(x,1.84,z),(.56,.06,.54),TEAL2,r,edge=.025)
    cube("Rear service door",(0,1.79,1.12),(.82,.12,1.82),WOOD,r,edge=.045)
    cube("Rear rain canopy",(0,2.08,2.08),(1.65,.66,.12),CORAL,r,
         rot=(math.radians(8),0,0),edge=.035)
    cyl("Rear drain stack",(2.72,1.84,2.15),.055,3.65,METAL,r,10)
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
    # A small loading/service elevation is a safer hidden-side inference than
    # the previous featureless box.
    cube("Rear service door",(-1.0,1.72,1.12),(1.05,.12,1.85),METAL,r,edge=.045)
    cube("Rear stockroom window",(.95,1.72,1.65),(1.15,.10,.82),GLASS,r,edge=.035)
    cube("Rear service canopy",(-.25,1.98,2.45),(3.3,.62,.14),TEAL,r,
         rot=(math.radians(7),0,0),edge=.045)
    for x in (.55,1.2):
        cube("Rear ventilation grille",(x,1.79,.70),(.42,.06,.22),INK,r,edge=.015)
    return r


def build_busstop():
    r=empty("SINGAPORE BUS STOP ASSEMBLY")
    cube("Bus stop pad",(0,0,.15),(5.8,2.3,.26),CONCRETE,r,edge=.12)
    for x in (-2.25,0,2.25):
        cyl("Shelter post",(x,.42,1.66),.075,3.0,TEAL,r,8)
    cube("Shelter canopy",(0,.34,3.16),(5.45,2.05,.20),TEAL,r,
         rot=(math.radians(-3),0,0),edge=.12)
    cube("Canopy fascia",(0,-.70,3.02),(5.35,.12,.34),TEAL,r,edge=.045)
    cube("Rear glass screen",(.45,.88,1.73),(3.45,.08,2.35),GLASS,r,edge=.035)
    cube("Side glass screen",(2.23,.42,1.73),(.08,.92,2.35),GLASS,r,edge=.035)
    cube("Bench seat",(-.25,.05,.72),(3.25,.64,.16),WOOD2,r,edge=.07)
    cube("Bench back",(-.25,.34,1.08),(3.25,.12,.54),WOOD2,r,
         rot=(math.radians(-7),0,0),edge=.055)
    for x in (-1.45,.95):
        cube("Bench leg",(x,.05,.47),(.11,.11,.42),TEAL,r,edge=0)
    # Solid route tiles replace the free-floating white text that produced artifacts.
    cube("Route pylon",(-2.48,-.48,1.55),(.50,.30,2.68),TEAL,r,edge=.09)
    cube("Route pylon cap",(-2.48,-.48,2.97),(.62,.36,.18),CONCRETE,r,edge=.065)
    for index,colour in enumerate((GLASS,WOOD2,CONCRETE)):
        cube("Route colour tile",(-2.48,-.66,2.25-index*.36),(.31,.045,.22),colour,r,edge=.025)
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
    r=empty("AIRPORT CONTROL TOWER")
    cone("Tapered shaft",(0,0,3.3),.70,.38,6.6,CHALK,r,16)
    cyl("Cab collar",(0,0,6.65),1.05,.42,CONCRETE,r,16)
    cyl("Control cab",(0,0,7.12),1.18,.78,GLASS,r,16)
    cone("Cab roof",(0,0,7.72),1.28,.55,.42,CORAL,r,16)
    cyl("Beacon mast",(0,0,8.38),.07,1.1,METAL,r,10)
    sphere("Beacon",(0,0,8.98),.13,YELLOW,r)
    for a in range(8):
        cube("Cab mullion",(math.cos(a*.785)*1.02,math.sin(a*.785)*1.02,7.12),(.08,.08,.72),INK,r,
             rot=(0,0,a*.785),edge=.012)
    label("AIRPORT",(0,-.72,3.75),.22,TEAL,r)
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
    # Inferred service-yard elevation, deliberately simpler than the public
    # corridor but complete enough to survive a rear camera.
    for f in range(6):
        z=1.25+f*.98
        cube("Rear service ledge",(0,1.78,z),(4.65,.22,.09),CONCRETE,r,edge=.02)
        for x in (-1.65,0,1.65):
            cube("Rear service window",(x,1.82,z+.12),(.58,.07,.54),GLASS,r,edge=.025)
            cube("Rear AC shelf",(x+.38,1.92,z-.18),(.28,.30,.08),TEAL,r,edge=.018)
    for z in (2.0,3.5,5.0,6.5):
        cube("Stair-core vent",(-3.09,.55,z),(.08,1.25,.32),INK,r,edge=.018)
    cube("Roof cap",(0,.4,7.68),(5.3,3.0,.22),CHALK,r,edge=.10)
    return r


def build_bg_condo():
    r=empty("BACKGROUND CONDO FAMILY")
    for i,(x,h) in enumerate(((-1.2,6.8),(1.0,5.7))):
        cube("Condo wing",(x,.4,h/2),(2.15,2.7,h),CHALK if i else CREAM,r,edge=.13)
        cube("Glass spine",(x,-.98,h/2),(.72,.08,h-.5),GLASS,r,edge=.03)
        cube("Rear glass spine",(x,1.78,h/2),(.72,.08,h-.5),GLASS,r,edge=.03)
        for f in range(int(h/.85)):
            cube("Condo balcony",(x,-1.16,.65+f*.85),(1.65,.35,.10),CONCRETE,r,edge=.025)
            cube("Condo rail",(x,-1.36,.83+f*.85),(1.58,.04,.30),TEAL,r,edge=.012)
            cube("Rear condo balcony",(x,1.96,.65+f*.85),(1.65,.35,.10),CONCRETE,r,edge=.025)
            cube("Rear condo rail",(x,2.16,.83+f*.85),(1.58,.04,.30),TEAL,r,edge=.012)
    cube("Condo lobby",(0,-.15,.52),(4.8,3.5,.90),TEAL2,r,edge=.12)
    cube("Lobby glass",(0,-1.92,.75),(2.4,.10,1.15),GLASS,r,edge=.04)
    cube("Rear lobby service entry",(0,1.66,.75),(2.4,.10,1.15),GLASS,r,edge=.04)
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
    cube("Rear kitchen door",(-1.0,1.98,1.22),(1.0,.12,1.85),WOOD,r,edge=.045)
    cube("Rear kitchen window",(.82,1.98,1.70),(1.25,.10,.92),GLASS,r,edge=.035)
    cube("Rear utility canopy",(-.15,2.28,2.45),(3.6,.70,.14),TEAL,r,
         rot=(math.radians(8),0,0),edge=.045)
    for z in (.65,1.15):
        cube("Rear AC condenser",(1.62,2.09,z),(.48,.30,.34),METAL,r,edge=.035)
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
    r=empty("COMMUNITY CAT ASSEMBLY")
    ico("Cat torso",(0,.08,.62),.52,CORAL,r,scale=(.72,1.18,.78))
    ico("Cat chest",(0,-.34,.66),.36,CHALK,r,scale=(.72,.68,1.05))
    ico("Cat head",(0,-.54,1.12),.39,CORAL,r,scale=(1,.86,.94))
    for x in (-.23,.23):
        cone("Cat ear",(x,-.48,1.49),.19,.025,.44,CORAL,r,6)
        ico("Cat eye",(x*.66,-.86,1.18),.060,GREEN3,r,scale=(1,.55,1))
        cyl("Front leg",(x,-.30,.34),.10,.52,CHALK,r,10)
        ico("Front paw",(x,-.42,.10),.13,CHALK,r,scale=(1.2,1.3,.55))
        cyl("Hind leg",(x,.40,.31),.12,.42,CORAL,r,10)
        ico("Hind paw",(x,.24,.10),.14,CORAL,r,scale=(1.35,1.4,.55))
    ico("Cat muzzle",(0,-.88,1.01),.18,CHALK,r,scale=(1,.55,.66))
    ico("Cat nose",(0,-.99,1.08),.055,INK,r,scale=(1,.65,.75))
    for x in (-1,1):
        for z in (.96,1.04):
            cable("Whisker",[(x*.08,-.98,z),(x*.44,-1.03,z+(z-1.0)*.35)],.010,INK,r)
    cable("Attached curled tail",[(.34,.42,.62),(.73,.66,.76),(.83,.60,1.22),
        (.55,.48,1.48),(.34,.36,1.35)],.10,CORAL,r)
    return r


def build_bicycle():
    r=empty("KAMPUNG BICYCLE ASSEMBLY")
    wheel_z=.84
    for cx in (-1.03,1.03):
        torus("Rubber tyre",(cx,0,wheel_z),.70,.060,INK,r,
              rot=(math.radians(90),0,0),major_segments=16)
        torus("Wheel rim",(cx,0,wheel_z),.60,.025,CHALK,r,
              rot=(math.radians(90),0,0),major_segments=16)
        cyl("Wheel hub",(cx,0,wheel_z),.075,.22,CHALK,r,12,
            rot=(math.radians(90),0,0))
        for i in range(6):
            a=i*math.tau/6
            cable("Wheel spoke",[(cx,0,wheel_z),
                (cx+math.cos(a)*.59,0,wheel_z+math.sin(a)*.59)],.009,INK,r)
    rear=(-1.03,0,wheel_z); crank=(-.18,0,.82); seat=(-.42,0,1.58); head=(.58,0,1.48)
    for name,start,end in (
        ("Chain stay",rear,crank),("Seat stay",rear,seat),("Seat tube",crank,seat),
        ("Down tube",crank,head),("Top tube",seat,head)):
        cable(name,[start,end],.050,TEAL2,r)
    for y in (-.07,.07):
        cable("Front fork",[(head[0],y,head[2]),(1.03,y,wheel_z)],.042,INK,r)
    cyl("Crankset",crank,.13,.18,INK,r,14,rot=(math.radians(90),0,0))
    cable("Seat post",[seat,(-.45,0,1.78)],.040,INK,r)
    cube("Bicycle saddle",(-.50,0,1.83),(.48,.24,.11),TEAL2,r,edge=.05)
    cable("Handle stem",[head,(.68,0,1.82)],.045,INK,r)
    cable("Handlebar",[(.68,-.34,1.82),(.68,0,1.82),(.83,.30,1.82)],.035,INK,r)
    # Open slatted basket, attached at both the handle stem and front fork.
    cube("Basket floor",(.91,-.20,1.33),(.62,.56,.07),WOOD2,r,edge=.025)
    for x in (.63,.79,.95,1.11,1.19):
        cable("Basket rail",[(x,-.46,1.34),(x,-.46,1.68)],.018,WOOD2,r)
    for z in (1.36,1.66):
        cable("Basket edge",[(.61,-.46,z),(1.21,-.46,z)],.022,WOOD2,r)
    cable("Basket upper stay",[(.68,-.10,1.79),(.91,-.20,1.66)],.026,INK,r)
    cable("Basket lower stay",[(.80,-.08,1.19),(.91,-.20,1.34)],.026,INK,r)
    return r


def build_birdcage():
    r=empty("TRADITIONAL BIRD CAGE ASSEMBLY")
    cyl("Carved cage base",(0,0,.24),.72,.22,WOOD2,r,16)
    torus("Lower bamboo ring",(0,0,.38),.69,.050,WOOD2,r,major_segments=14)
    torus("Middle bamboo ring",(0,0,1.16),.64,.038,WOOD2,r,major_segments=14)
    torus("Upper bamboo ring",(0,0,1.55),.50,.045,WOOD2,r,major_segments=14)
    for i in range(10):
        a=i*math.tau/10
        cable("Domed cage bar",[(math.cos(a)*.68,math.sin(a)*.68,.38),
            (math.cos(a)*.63,math.sin(a)*.63,1.22),
            (math.cos(a)*.48,math.sin(a)*.48,1.58),(0,0,2.02)],.017,INK,r)
    cable("Cage hanger stem",[(0,0,2.00),(0,0,2.31)],.035,INK,r)
    torus("Cage hanger loop",(0,0,2.47),.21,.035,INK,r,
          rot=(math.radians(90),0,0),major_segments=18)
    cyl("Bird perch",(0,0,1.02),.030,1.02,WOOD2,r,10,rot=(0,math.radians(90),0))
    ico("Songbird body",(-.10,-.13,1.10),.18,CHALK,r,scale=(1.25,.72,.86))
    ico("Songbird head",(-.22,-.20,1.28),.12,TEAL,r)
    cone("Songbird beak",(-.22,-.36,1.27),.060,.005,.18,WOOD2,r,6,
         rot=(math.radians(90),0,0))
    cone("Songbird tail",(.10,-.05,.98),.12,.025,.42,TEAL,r,6,
         rot=(0,math.radians(-55),0))
    for x in (-.43,.43):
        cyl("Feed cup",(x,-.32,.86),.10,.16,CHALK,r,8)
        cable("Feed cup bracket",[(x,-.32,.78),(x,-.58,.82)],.020,TEAL,r)
    return r


def build_bumboat():
    r=empty("ISLAND RIVER BUMBOAT")
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
    r=empty("HOME ROUTER INSTALLATION ASSEMBLY")
    cube("Equipment mat",(0,.08,.08),(3.15,2.05,.14),CONCRETE,r,edge=.10)
    cube("WiFi router",(.12,.06,.54),(1.75,.82,.48),CHALK,r,edge=.12)
    cube("Router front fascia",(.12,-.37,.51),(1.48,.055,.25),TEAL,r,edge=.035)
    for i in range(6):
        cube("Router vent",(-.48+i*.24,-.02,.80),(.12,.30,.025),INK,r,edge=.008)
    for i in range(4):
        ico("Router status LED",(-.23+i*.22,-.42,.56),.034,TEAL,r,scale=(1,.60,1))
    for i,x in enumerate((-.55,-.10,.35,.80)):
        ico("Antenna hinge",(x,.34,.76),.075,INK,r)
        cable("Router antenna",[(x,.34,.76),(x+(.08 if i>1 else -.08),.36,1.47)],.040,INK,r)
    cube("Engineer toolkit",(-1.12,.48,.38),(.62,.54,.54),TEAL,r,edge=.08)
    torus("Toolkit handle",(-1.12,.45,.73),.19,.045,INK,r,
          rot=(math.radians(90),0,0),major_segments=14)
    torus("Coiled WAN lead",(1.03,-.28,.33),.34,.030,TEAL,r,
          rot=(math.radians(90),0,0),major_segments=22)
    cable("WAN lead tail",[(.72,-.28,.33),(.53,-.05,.35),(.56,.33,.44)],.030,TEAL,r)
    cube("RJ45 connector",(.56,.36,.45),(.16,.18,.11),TEAL,r,edge=.025)
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
    ("harbour-statue-v2",build_harbour_statue,(0,-.1,1.7),(8,-12,6.5),4.0),
    ("skypark-hotel-v2",build_skypark_hotel,(0,0,3.7),(14,-19,11),6.5),
    ("flyer-v2",build_flyer,(0,0,4.1),(13,-18,10),6.0),
    ("supertree-v2",build_supertree,(0,0,3.0),(9,-13,7.5),4.0),
    ("concert-hall-v2",build_concert_hall,(0,0,1.6),(11,-16,7),5.5),
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
    requested = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else None
    for slug,builder,target,camera,ground in JOBS:
        if requested and slug not in requested:
            continue
        reset()
        export_asset(builder(),slug,target,camera,ground)
    print("Priority 2–5 Blender assets created")
