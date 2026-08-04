import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from create_remaining_assets import (
    BLUE,
    CHALK,
    CONCRETE,
    CORAL,
    CREAM,
    GLASS,
    GREEN,
    GREEN2,
    INK,
    METAL,
    RED,
    TEAL,
    TEAL2,
    YELLOW,
    cube,
    cyl,
    empty,
    export_asset,
    ico,
    label,
    reset,
)


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


def build_campus(code, accent, modern=False):
    root = empty(code + " CAMPUS")
    cube("Campus lawn", (0, .25, .12), (7.4, 5.2, .22), GREEN2, root, edge=.14)
    positions = (-2.35, 0, 2.35)
    for index, x in enumerate(positions):
        height = 2.25 + ((index + int(modern)) % 2) * .55
        cube("Academic block", (x, .35, height / 2 + .24), (1.75, 3.15, height), CREAM, root, edge=.12)
        cube("Window wall", (x, -1.25, height / 2 + .32), (1.35, .08, height * .58), GLASS, root, edge=.03)
        for z in (.72, 1.24, 1.76):
            cube("Sunshade", (x, -1.34, z), (1.48, .18, .08), accent, root, edge=.025)
        cube("Campus roof", (x, .35, height + .28), (1.95, 3.35, .18), accent, root, edge=.09)
    cube("Learning bridge", (0, -1.0, 1.48), (5.3, .75, .32), CHALK, root, edge=.08)
    cube("Campus sign", (0, -2.05, .72), (4.4, .22, .92), TEAL, root, edge=.08)
    label(code, (0, -2.18, .82), .38, CHALK, root)
    for x in (-3.0, 3.0):
        cyl("Tree trunk", (x, 1.65, .52), .10, .92, METAL, root, 12)
        ico("Campus tree", (x, 1.65, 1.32), .62, GREEN if x < 0 else GREEN2, root, scale=(1.0, .85, 1.15))
    return root


def build_primary_school():
    root = empty("NATIONAL SCHOOL SCHOOL")
    cube("School court", (0, .35, .12), (7.2, 5.0, .22), CONCRETE, root, edge=.13)
    cube("School block", (0, .55, 1.75), (6.3, 2.8, 3.25), CREAM, root, edge=.14)
    for floor, z in enumerate((.85, 1.62, 2.39)):
        cube("Open corridor", (0, -.91, z), (5.72, .34, .34), TEAL2, root, edge=.05)
        for x in (-2.4, -1.2, 0, 1.2, 2.4):
            cube("Classroom window", (x, -1.10, z + .22), (.72, .08, .38), GLASS, root, edge=.025)
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
    ("national-university-v2", lambda: build_campus("National University", TEAL, False), (0, 0, 1.5), (11, -16, 8), 5.0),
    ("technological-university-v2", lambda: build_campus("Technological University", CORAL, True), (0, 0, 1.5), (11, -16, 8), 5.0),
    ("management-university-v2", lambda: build_campus("Management University", BLUE, False), (0, 0, 1.5), (11, -16, 8), 5.0),
    ("design-university-v2", lambda: build_campus("Design University", TEAL2, True), (0, 0, 1.5), (11, -16, 8), 5.0),
    ("national-school-v2", build_primary_school, (0, 0, 1.6), (11, -16, 8), 5.0),
]


if __name__ == "__main__":
    for slug, builder, target, camera, ground in ASSETS:
        reset()
        export_asset(builder(), slug, target, camera, ground)
