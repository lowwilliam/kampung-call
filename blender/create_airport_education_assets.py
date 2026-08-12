import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from create_remaining_assets import (
    BLUE, CHALK, CONCRETE, CORAL, CREAM, GLASS, GREEN, GREEN2, INK,
    METAL, RED, TEAL, TEAL2, YELLOW, cable, cube, cyl, empty,
    export_asset, ico, label, material, reset,
)

HIVE_CONCRETE = material("Hive rib concrete", (.60, .49, .35), .90)
PEARL = material("Pearl shell", (.88, .87, .80), .52, .04)
SUTD_WHITE = material("SUTD facade white", (.82, .84, .78), .76)


def torus(name, loc, major, minor, mat, parent, rot=(0, 0, 0), major_segments=28):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=major_segments,
        minor_segments=8, location=loc, rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def sphere(name, loc, radius, mat, parent, scale=(1, 1, 1), rot=(0, 0, 0), segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=12, radius=radius, location=loc, rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def build_airport_terminal():
    root = empty("AIRPORT TERMINAL")
    cube("Terminal apron", (0, .45, .18), (9.8, 5.5, .32), CONCRETE, root, edge=.16)
    cube("Terminal hall", (0, .55, 1.55), (8.2, 3.5, 2.45), CREAM, root, edge=.18)
    cube("Glass frontage", (0, -1.23, 1.55), (7.45, .12, 1.62), GLASS, root, edge=.04)
    for x in (-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0):
        cube("Facade mullion", (x, -1.32, 1.55), (.055, .08, 1.55), METAL, root, edge=.008)
    for x, tilt in ((-3.1, -7), (-1.05, -3), (1.05, 3), (3.1, 7)):
        cube("Wave roof", (x, .45, 3.02), (2.35, 4.3, .24), CHALK, root,
             rot=(0, math.radians(tilt), 0), edge=.14)
    for x in (-2.65, 0, 2.65):
        cube("Jet bridge", (x, -2.25, 1.05), (.72, 2.05, .58), TEAL2, root, edge=.10)
        cube("Gate glass", (x, -3.26, 1.05), (.48, .08, .34), GLASS, root, edge=.025)
    label("AIRPORT", (0, -1.44, 2.55), .42, TEAL, root)
    label("ISLAND AIRPORT", (0, -1.45, 2.10), .18, CORAL, root)
    return root


def build_nus_sde4():
    """NUS SDE4; official reference: https://cde.nus.edu.sg/arch/cdig/cdig-sde-4/"""
    root = empty("NUS SDE4 ASSEMBLY")
    cube("SDE4 landscape", (0, .25, .10), (8.6, 5.5, .18), GREEN2, root, edge=.14)
    cube("Recessed glass volume", (0, .30, 2.42), (5.85, 2.55, 2.62), GLASS, root, edge=.08)
    for z in (1.18, 2.08, 2.98):
        cube("Exposed floor plate", (0, .18, z), (6.65, 3.12, .18), CHALK, root, edge=.055)
        cube("Shaded terrace edge", (0, -1.47, z + .16), (6.45, .20, .30), TEAL, root, edge=.035)
    for x in (-2.72, -.92, .92, 2.72):
        for y in (-1.12, 1.12):
            cyl("White structural column", (x, y, 2.08), .105, 3.75, CHALK, root, 14)
    for x in (-2.45, -1.48, -.50, .50, 1.48, 2.45):
        cube("Facade mullion", (x, -1.03, 2.42), (.055, .10, 2.44), METAL, root, edge=.008)
    cube("Deep overhanging roof", (0, .20, 4.02), (7.65, 3.75, .28), CHALK, root, edge=.12)
    cube("Vertical end fin", (-3.50, .18, 2.42), (.28, 3.55, 3.32), CREAM, root, edge=.065)
    for index in range(6):
        cube("External stair", (-3.18 + index*.34, -1.78, .34 + index*.18),
             (.42, .72, .12), CONCRETE, root, edge=.025)
    for x in (-2.15, 0, 2.15):
        cube("Terrace planter", (x, -1.68, 1.35), (1.08, .38, .27), TEAL2, root, edge=.05)
        for px in (-.30, 0, .30):
            ico("Terrace planting", (x+px, -1.68, 1.62), .25, GREEN, root,
                scale=(1.1, .65, .72))
    cube("NUS marker", (2.80, -2.02, .48), (1.45, .20, .65), TEAL, root, edge=.065)
    label("NUS SDE4", (2.80, -2.14, .52), .20, CHALK, root)
    return root


def build_ntu_hive():
    """NTU Hive; architect reference: https://heatherwick.com/project/learning-hub-the-hive/"""
    root = empty("NTU THE HIVE ASSEMBLY")
    cube("Hive landscape", (0, .25, .10), (8.4, 5.8, .18), GREEN2, root, edge=.16)
    cyl("Open central atrium", (0, .25, 1.42), .72, 2.70, INK, root, 20)
    for tower_index in range(12):
        angle = tower_index * math.tau / 12
        x = math.cos(angle) * (2.42 + .18*math.sin(tower_index*1.7))
        y = .22 + math.sin(angle) * (1.58 + .12*math.cos(tower_index*1.3))
        tower = empty("Learning tower %02d" % (tower_index+1))
        tower.parent = root
        cyl("Warm vertical core", (x, y, 1.72), .25, 3.05, CORAL, tower, 14)
        for level in range(4):
            z = .55 + level*.73
            radius = .72 - level*.025 + .05*math.sin(tower_index+level)
            offset = .08*math.sin(tower_index*.9+level)
            px = x + math.cos(angle+math.pi/2)*offset
            py = y + math.sin(angle+math.pi/2)*offset
            cyl("Curved glass pod", (px, py, z+.18), radius*.90, .44, GLASS, tower, 18)
            cyl("Ribbed concrete floor", (px, py, z), radius, .15, HIVE_CONCRETE, tower, 18)
        torus("Tower crown rib", (x, y, 3.08), .58, .060, CHALK, tower, major_segments=20)
    cube("NTU marker", (-2.75, -2.25, .46), (1.35, .20, .62), CORAL, root, edge=.065)
    label("NTU", (-2.75, -2.37, .50), .25, CHALK, root)
    return root


def build_smu_law():
    """SMU Law and pearl library; reference: https://library.smu.edu.sg/about-us/overview"""
    root = empty("SMU LAW AND PEARL LIBRARY ASSEMBLY")
    cube("Urban campus terrace", (0, .22, .10), (8.5, 5.4, .18), CONCRETE, root, edge=.14)
    cube("Law School glass body", (-1.38, .45, 1.82), (4.95, 2.95, 3.15), GLASS, root, edge=.12)
    for z in (.48, 1.18, 1.88, 2.58, 3.28):
        cube("Law School horizontal slab", (-1.38, .44, z), (5.25, 3.18, .16), CHALK, root, edge=.045)
    for x in (-3.30, -2.38, -1.46, -.54, .38):
        cube("Law School fin", (x, -1.05, 1.86), (.09, .18, 2.76), METAL, root, edge=.012)
    cube("Law School roof", (-1.38, .45, 3.55), (5.35, 3.24, .26), TEAL, root, edge=.10)
    cube("Library bridge", (1.20, .12, 1.66), (1.48, 1.04, .30), CHALK, root, edge=.08)
    sphere("Pearl library glass shell", (2.45, -.05, 1.52), 1.0, GLASS, root,
           scale=(1.50, 1.06, .92), rot=(0, math.radians(-11), 0), segments=24)
    for rib_index in range(-3, 4):
        x = rib_index*.29
        cable("Pearl shell rib", [(2.45+x*.72, -.66, .70), (2.45+x, -1.04, 1.46),
              (2.45+x*.72, -.66, 2.32)], .035, PEARL, root)
    for z, radius in ((1.00, 1.13), (1.49, 1.43), (1.98, 1.12)):
        torus("Pearl horizontal band", (2.45, -.05, z), radius, .035, PEARL, root,
              major_segments=28)
    for index in range(5):
        cube("Public terrace step", (1.35+index*.22, -1.70, .18+index*.10),
             (3.25-index*.30, .62, .10), CHALK, root, edge=.025)
    for x in (-3.65, 3.65):
        cyl("Campus tree trunk", (x, 1.68, .48), .08, .82, METAL, root, 12)
        ico("Campus tree crown", (x, 1.68, 1.15), .55, GREEN, root, scale=(1, .82, 1.05))
    cube("SMU marker", (-3.15, -2.05, .48), (1.25, .20, .62), BLUE, root, edge=.065)
    label("SMU", (-3.15, -2.17, .51), .25, CHALK, root)
    return root


def build_sutd_campus():
    """SUTD campus; reference: https://www.sutd.edu.sg/news-listing/modernity-and-tradition/"""
    root = empty("SUTD CONNECTED CAMPUS ASSEMBLY")
    cube("SUTD landscape", (0, .25, .10), (8.8, 5.8, .18), GREEN2, root, edge=.16)
    cube("Open central court", (0, .18, .18), (3.8, 2.25, .14), GREEN, root, edge=.12)
    for wing_index, y in enumerate((-1.48, 1.62)):
        cube("Rounded academic wing", (0, y, 1.78), (6.95, 1.28, 2.78), GLASS, root, edge=.28)
        for z in (.55, 1.34, 2.13, 2.92):
            cube("Continuous white ribbon", (0, y, z), (7.35, 1.48, .17),
                 SUTD_WHITE, root, edge=.085)
        for x in (-2.85, -1.72, -.58, .58, 1.72, 2.85):
            cube("Facade fin", (x, y-.66, 1.76), (.06, .12, 2.44), TEAL, root, edge=.010)
        cube("Planted roof insert", ((-1.65 if wing_index == 0 else 1.65), y, 3.14),
             (2.25, .88, .24), GREEN, root, edge=.10)
    cube("Learning spine bridge", (0, .08, 1.95), (1.60, 3.72, .48), CHALK, root, edge=.14)
    cube("Bridge glazing", (0, -.02, 2.02), (1.28, 3.45, .26), GLASS, root, edge=.08)
    for side in (-1, 1):
        cube("Perpendicular studio bar", (side*3.12, .08, 1.38),
             (1.08, 2.50, 2.10), GLASS, root, edge=.22)
        for z in (.52, 1.18, 1.84, 2.46):
            cube("Studio ribbon", (side*3.12, .08, z), (1.25, 2.70, .14),
                 SUTD_WHITE, root, edge=.06)
    cube("SUTD marker", (3.32, -2.28, .48), (1.40, .20, .62), TEAL2, root, edge=.065)
    label("SUTD", (3.32, -2.40, .51), .23, CHALK, root)
    return root


def build_primary_school():
    root = empty("NATIONAL SCHOOL SCHOOL")
    cube("School court", (0, .35, .12), (7.2, 5.0, .22), CONCRETE, root, edge=.13)
    cube("School block", (0, .55, 1.75), (6.3, 2.8, 3.25), CREAM, root, edge=.14)
    for z in (.85, 1.62, 2.39):
        cube("Open corridor", (0, -.91, z), (5.72, .34, .34), TEAL2, root, edge=.05)
        for x in (-2.4, -1.2, 0, 1.2, 2.4):
            cube("Classroom window", (x, -1.10, z+.22), (.72, .08, .38), GLASS, root, edge=.025)
    cube("School roof", (0, .55, 3.48), (6.7, 3.18, .22), RED, root, edge=.10)
    cube("Assembly canopy", (0, -1.62, .88), (3.4, 1.4, .18), YELLOW, root, edge=.08)
    cube("School sign", (0, -1.22, 3.02), (4.7, .18, .58), TEAL, root, edge=.07)
    label("NATIONAL SCHOOL", (0, -1.34, 3.06), .22, CHALK, root)
    for x in (-2.75, 2.75):
        cyl("Flag pole", (x, -2.0, 1.15), .045, 2.2, METAL, root, 12)
    cube("Island flag", (-2.38, -2.0, 1.88), (.72, .05, .42), RED, root, edge=.015)
    cube("Play court", (0, 1.82, .28), (4.7, 1.55, .08), BLUE, root, edge=.025)
    return root


ASSETS = [
    ("airport-terminal-v2", build_airport_terminal, (0, 0, 1.8), (13, -18, 10), 6.2),
    ("national-university-v2", build_nus_sde4, (0, 0, 2.0), (12, -17, 8.5), 5.3),
    ("technological-university-v2", build_ntu_hive, (0, 0, 1.7), (12, -17, 8.0), 5.3),
    ("management-university-v2", build_smu_law, (0, 0, 1.8), (12, -17, 8.2), 5.3),
    ("design-university-v2", build_sutd_campus, (0, 0, 1.7), (12, -17, 8.0), 5.3),
    ("national-school-v2", build_primary_school, (0, 0, 1.6), (11, -16, 8), 5.0),
]


if __name__ == "__main__":
    requested = set(sys.argv[sys.argv.index("--")+1:]) if "--" in sys.argv else None
    preserve = {"national-university-v2", "technological-university-v2",
                "management-university-v2", "design-university-v2"}
    for slug, builder, target, camera, ground in ASSETS:
        if requested and slug not in requested:
            continue
        reset()
        export_asset(builder(), slug, target, camera, ground,
                     preserve_parts=(slug in preserve))
    print("Airport and education assets created")
