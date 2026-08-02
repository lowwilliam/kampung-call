"""Build the transit hero assets used by the Singapore transit pass.

Run from Blender's background Python environment:

    blender --background --python blender/create_transit_assets.py

The web game currently keeps a procedural fallback, so the scene remains
playable when these optional exports are not present.  The exported assets use
local +Z as forward, sit on the ground plane, and keep detail concentrated on
the readable silhouette and interaction side.
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from create_remaining_assets import (  # noqa: E402
    CHALK,
    CREAM,
    GLASS,
    INK,
    METAL,
    RED,
    TEAL,
    TEAL2,
    YELLOW,
    box,
    cube,
    cyl,
    empty,
    export_asset,
    label,
    reset,
)


def wheel(name, loc, parent):
    cyl(name, loc, .38, .18, INK, parent, vertices=16, rot=(0, math.radians(90), 0))
    cyl(f"{name} hub", (loc[0] + (.1 if loc[0] > 0 else -.1), loc[1], loc[2]), .15, .20, METAL, parent,
        vertices=12, rot=(0, math.radians(90), 0))


def route_board(root, route, loc, name="Route display"):
    # Runtime Three.js may replace this board with a canvas-textured route
    # number for each of the three bus instances.
    label(f"{route}", loc, .34, CHALK, root, rot=(math.radians(90), 0, 0))


def build_bus():
    root = empty("SINGAPORE DOUBLE-DECKER BUS")
    cube("Lower body", (0, 1.12, 0), (1.65, 1.55, 5.40), CREAM, root, edge=.12)
    cube("Upper body", (0, 2.55, -.12), (1.58, 1.10, 5.10), TEAL, root, edge=.10)
    cube("Lower red belt", (0, 1.62, .05), (1.72, .18, 5.46), RED, root, edge=.035)
    cube("Upper window band", (0, 2.78, -.08), (1.62, .52, 5.14), GLASS, root, edge=.04)
    cube("Roof cap", (0, 3.18, -.12), (1.72, .18, 5.22), CHALK, root, edge=.06)
    cube("Front destination panel", (0, 2.78, 2.70), (1.12, .30, .08), INK, root, edge=.02)
    cube("Front lower windscreen", (0, 1.62, 2.73), (1.05, .52, .08), GLASS, root, edge=.03)
    cube("Door", (0.86, 1.13, 1.35), (.05, 1.12, .75), TEAL2, root, edge=.02)
    for x in (-.84, .84):
        for z in (-1.75, 1.75):
            wheel(f"Bus wheel {x:g} {z:g}", (x, .43, z), root)
    for x in (-.58, .58):
        cyl("Mirror arm", (x, 2.35, 2.86), .035, .55, METAL, root, vertices=8, rot=(math.radians(70), 0, 0))
    route_board(root, "65", (0, 2.80, 2.76))
    label("KAMPUNG TRANSIT", (0, .55, 2.76), .12, INK, root)
    return root


def build_mrt_train():
    root = empty("KAMPUNG CENTRAL MRT TRAIN")
    cube("Car body", (0, 1.45, 0), (2.95, 2.45, 9.40), CHALK, root, edge=.16)
    cube("Teal belt", (0, 1.55, 0), (3.02, .26, 9.42), TEAL, root, edge=.035)
    cube("Red line", (0, 1.31, 0), (3.04, .12, 9.44), RED, root, edge=.02)
    cube("Window band", (0, 2.05, -.03), (2.72, .62, 8.90), GLASS, root, edge=.04)
    for z in (-2.5, 0, 2.5):
        cube("Door seam", (0, 1.55, z), (2.76, 1.45, .035), INK, root, edge=.01)
    cube("Cab nose", (0, 1.45, 4.78), (2.80, 2.20, .38), CHALK, root, edge=.12)
    cube("Destination display", (0, 2.15, 4.99), (1.22, .28, .05), INK, root, edge=.02)
    label("KAMPUNG CENTRAL", (0, 2.16, 5.02), .12, CHALK, root)
    for x in (-1.05, 1.05):
        for z in (-3.2, 3.2):
            wheel(f"Train undercarriage {x:g} {z:g}", (x, .20, z), root)
    return root


def main():
    reset()
    bus = build_bus()
    export_asset(bus, "singapore-bus-v1", camera_target=(0, 1.55, 0), camera=(8, -11, 6), ground=5.5)
    reset()
    train = build_mrt_train()
    export_asset(train, "mrt-train-v1", camera_target=(0, 1.45, 0), camera=(8, -12, 7), ground=5.5)


if __name__ == "__main__":
    main()
