"""Singapore Heritage Expansion Pack — reproducible Blender production script.

Builds six stylised low-poly/toon assets for the Kampung Call planet:

  peranakan-house-v2   colourful two-storey Peranakan terrace house
  kampong-house-v2     traditional stilted Malay kampong house
  hdb-voiddeck-v2      modular HDB void-deck environment
  kampong-props-v2     reusable grouped prop kit (named child nodes)
  sultan-mosque-v2     stylised Sultan Mosque for Kampong Gelam
  wetmarket-v2         open-sided wet-market environment

Conventions follow blender/create_remaining_assets.py:
  Blender Z-up, model front faces -Y, origin at logical ground centre,
  Draco-compressed GLB, preview PNG in assets/previews/, editable .blend
  beside every GLB.

Run:  Blender --background --python scripts/blender/build-singapore-heritage-pack.py
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLENDER_DIR = os.path.join(ROOT, "blender")
sys.path.insert(0, BLENDER_DIR)

from create_remaining_assets import (  # noqa: E402
    reset, empty, cube, cyl, ico, label, cable, descendants, optimise, ground_root,
    postprocess_glb,
    material, bevel,
    INK, CREAM, CHALK, TEAL, TEAL2, CORAL, YELLOW, GLASS, CONCRETE,
    METAL, WOOD, WOOD2, GREEN, GREEN2, GREEN3, RED, BLUE,
)

ASSETS = os.path.join(ROOT, "assets")
PREVIEWS = os.path.join(ASSETS, "previews")
os.makedirs(PREVIEWS, exist_ok=True)

R90 = math.radians(90)

# ---------------------------------------------------------------------------
# Heritage-pack materials (restrained tropical palette, reusable by name)
# ---------------------------------------------------------------------------
PERANAKAN_PINK = material("Peranakan blush", (.90, .60, .64), .85)
PERANAKAN_MINT = material("Peranakan mint", (.52, .76, .64), .85)
PERANAKAN_LILAC = material("Peranakan lilac", (.66, .58, .76), .85)
TILE_BLUE = material("Ceramic tile blue", (.10, .38, .62), .55)
GOLD = material("Mosque gold", (.85, .60, .12), .38, .45)
THATCH = material("Attap thatch", (.32, .21, .11), .95)
TERRAZZO = material("Terrazzo", (.70, .68, .61), .9)
ZINC = material("Weathered zinc", (.56, .61, .62), .5, .35)
CHICKEN_WHITE = material("Chicken white", (.93, .90, .82), .9)
CHICKEN_BROWN = material("Chicken brown", (.52, .32, .17), .9)
AWNING_CREAM = material("Awning cream", (.93, .86, .72), .85)
FISH_SILVER = material("Fish silver", (.60, .71, .75), .35, .25)
VEG_ORANGE = material("Pumpkin orange", (.86, .46, .10), .8)
MEAT_RED = material("Butcher red", (.60, .15, .14), .8)
CLAY = material("Fired clay", (.58, .30, .16), .9)


def warm_window():
    """Warm emissive evening window — survives glTF export as emissive."""
    m = bpy.data.materials.get("Window warm") or bpy.data.materials.new("Window warm")
    m.diffuse_color = (.98, .76, .40, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (.98, .76, .40, 1)
    p.inputs["Roughness"].default_value = .5
    emission = p.inputs.get("Emission Color") or p.inputs.get("Emission")
    if emission:
        emission.default_value = (1.0, .60, .22, 1)
    strength = p.inputs.get("Emission Strength")
    if strength:
        strength.default_value = 2.0
    return m


WARM = warm_window()


# ---------------------------------------------------------------------------
# Extra shape helpers
# ---------------------------------------------------------------------------
def sphere(name, loc, radius, mat, parent, scale=(1, 1, 1), segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10,
                                         radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    o.parent = parent
    return o


def cone(name, loc, r1, r2, depth, mat, parent, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    o.parent = parent
    return o


def torus(name, loc, major, minor, mat, parent, rot=(0, 0, 0), major_segments=20):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=8, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    o.parent = parent
    return o


def wedge(name, loc, w, d, h, mat, parent):
    """Triangular prism (gable infill), ridge along Y, base at local z=0."""
    verts = [(-w/2, -d/2, 0), (w/2, -d/2, 0), (w/2, d/2, 0), (-w/2, d/2, 0),
             (0, -d/2, h), (0, d/2, h)]
    faces = [(0, 3, 2, 1), (0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.data.materials.append(mat)
    o.parent = parent
    return o


def louvres(parent, x, y, z, w, count, mat, gap=.14):
    for i in range(count):
        cube("Louvre slat", (x, y, z + i*gap), (w, .05, .045), mat, parent,
             rot=(math.radians(-12), 0, 0), edge=.008)


def stats(root, slug):
    tris = 0
    mats = set()
    for o in descendants(root):
        if o.type != "MESH":
            continue
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
        for slot in o.material_slots:
            if slot.material:
                mats.add(slot.material.name)
    glb = os.path.join(ASSETS, slug + ".glb")
    size = os.path.getsize(glb) / 1024 if os.path.exists(glb) else 0
    print(f"STATS {slug}: tris={tris} materials={len(mats)} glbKB={size:.0f}")


def preview_setup(slug, camera_target, camera, ground):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 840
    scene.render.resolution_y = 680
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(PREVIEWS, slug + ".png")
    scene.world.color = (.045, .20, .21)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    preview = empty("PREVIEW ONLY")
    cube("Ground", (0, 0, -.18), (ground*2, ground*1.55, .3), CONCRETE, preview, edge=.22)
    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.data.lens = 55
    cam.rotation_euler = (Vector(camera_target)-cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for loc, energy, size, colour in (
        ((-7, -8, 15), 1500, 8, (1, .72, .50)),
        ((8, 2, 11), 1050, 9, (.40, .72, 1)),
        ((0, 7, 8), 700, 7, (.50, 1, .70)),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = colour


def export_asset(root, slug, camera_target=(0, 0, 2.5), camera=(11, -15, 9),
                 ground=5.2, join=True):
    """Match create_remaining_assets.export_asset; join=False keeps named nodes."""
    if join:
        optimise(root)
    ground_root(root)
    preview_setup(slug, camera_target, camera, ground)
    blend = os.path.join(ASSETS, slug + ".blend")
    glb = os.path.join(ASSETS, slug + ".glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True,
        export_animations=False, export_yup=True, export_apply=True)
    simplify = .35 if slug == "wetmarket-v2" else .70 if slug == "hdb-voiddeck-v2" else None
    postprocess_glb(glb, preserve_hierarchy=not join, simplify_ratio=simplify)
    bpy.ops.render.render(write_still=True)
    print("Created", glb)
    stats(root, slug)


# ---------------------------------------------------------------------------
# 1. PERANAKAN TERRACE HOUSE — narrow pastel frontage, five-foot way,
#    louvred shutters, ceramic tile band, pintu pagar, plaster ornament.
# ---------------------------------------------------------------------------
def build_peranakan():
    r = empty("PERANAKAN TERRACE HOUSE")
    W, D = 4.0, 6.5

    # A gallery orbit needs a complete end-bay object.  The public street
    # facade follows the photographed late-style Peranakan language; the side,
    # airwell and rear service elevations are deliberately quieter inference.
    cube("Deep narrow masonry shell", (0, .68, 2.85), (W, 4.75, 5.7),
         PERANAKAN_PINK, r, edge=.08)
    cube("Projecting upper facade", (0, -2.26, 4.28), (W, .34, 2.56),
         PERANAKAN_MINT, r, edge=.055)
    cube("Upper floor stringcourse", (0, -2.47, 3.03), (W + .18, .22, .20),
         CREAM, r, edge=.035)

    # Continuous five-footway.  Columns sit on the party-line edges rather
    # than blocking the entrance, which the previous centre column did.
    cube("Five-footway floor", (0, -2.77, .10), (W + .14, 1.35, .20),
         TERRAZZO, r, edge=.04)
    cube("Five-footway ceiling", (0, -2.72, 2.92), (W + .08, 1.30, .15),
         CREAM, r, edge=.035)
    for x in (-1.82, 1.82):
        cube("Five-footway column", (x, -3.20, 1.53), (.23, .23, 2.75),
             CREAM, r, edge=.035)
        cube("Column base", (x, -3.20, .30), (.38, .38, .44),
             CONCRETE, r, edge=.045)
        cube("Column capital", (x, -3.20, 2.82), (.38, .38, .24),
             CHALK, r, edge=.045)
    cube("Granite five-footway edge", (0, -3.45, .15), (W + .28, .20, .28),
         CONCRETE, r, edge=.035)

    # Recessed residential ground front: a double leaf door and a true
    # half-height pintu pagar between two inward-recessed casement windows.
    cube("Ground residential facade", (0, -2.12, 1.48), (W - .28, .22, 2.65),
         PERANAKAN_PINK, r, edge=.045)
    cube("Door recess", (0, -2.25, 1.45), (1.13, .10, 2.24), INK, r, edge=.025)
    for sx in (-1, 1):
        cube("Double leaf timber door", (sx*.275, -2.33, 1.43), (.51, .07, 2.12),
             WOOD2, r, edge=.025)
        cube("Door raised panel", (sx*.275, -2.38, 1.18), (.34, .035, .64),
             WOOD, r, edge=.018)
    for pane in range(5):
        cube("Door fanlight pane", (-.40 + pane*.20, -2.37, 2.62), (.17, .035, .26),
             (WARM, TILE_BLUE, PERANAKAN_LILAC, YELLOW, WARM)[pane], r, edge=.012)
    cube("Pintu pagar top rail", (0, -2.49, 1.17), (1.05, .055, .07),
         WOOD, r, edge=.012)
    cube("Pintu pagar lower rail", (0, -2.49, .47), (1.05, .055, .07),
         WOOD, r, edge=.012)
    for i in range(7):
        cube("Pintu pagar vertical", (-.45 + i*.15, -2.49, .82), (.055, .05, .72),
             WOOD2, r, edge=.01)
    for x in (-1.20, 1.20):
        cube("Ground casement recess", (x, -2.25, 1.53), (.92, .10, 1.32),
             INK, r, edge=.025)
        for sx in (-1, 1):
            cube("Ground casement leaf", (x + sx*.21, -2.34, 1.53), (.36, .055, 1.19),
                 PERANAKAN_MINT, r, edge=.018)
            for j in range(5):
                cube("Ground casement louvre", (x + sx*.21, -2.38, 1.20 + j*.16),
                     (.29, .025, .035), CHALK, r, rot=(math.radians(-10), 0, 0), edge=.006)

    # Upper French-window assemblies.  Each leaf owns its louvres, so the
    # opening reads as a hinged timber window instead of a flat ladder.
    def french_window(index, x):
        cube("French window recess", (x, -2.47, 4.38), (.96, .075, 1.78),
             INK, r, edge=.025)
        pane_mats = (PERANAKAN_LILAC, TILE_BLUE, WARM, PERANAKAN_MINT, YELLOW)
        for p, pane_x in enumerate((-0.34, -0.17, 0, .17, .34)):
            cube("Coloured fanlight pane", (x + pane_x, -2.56, 5.13),
                 (.145, .035, .28), pane_mats[(p + index) % len(pane_mats)], r, edge=.01)
        for direction in (-1, 1):
            pivot = empty("Left shutter pivot" if direction < 0 else "Right shutter pivot")
            pivot.parent = r
            pivot.location = (x + direction*.43, -2.57, 4.43)
            pivot.rotation_euler[2] = math.radians(direction*24)
            centre = -direction*.19
            for rail_x in (centre - .17, centre + .17):
                cube("Shutter stile", (rail_x, 0, 0), (.055, .055, 1.24),
                     PERANAKAN_MINT, pivot, edge=.01)
            for rail_z in (-.59, .59):
                cube("Shutter rail", (centre, 0, rail_z), (.39, .055, .055),
                     PERANAKAN_MINT, pivot, edge=.01)
            for j in range(7):
                cube("Jalousie slat", (centre, -.025, -.46 + j*.15), (.32, .035, .04),
                     CHALK, pivot, rot=(math.radians(-12), 0, 0), edge=.006)
        cube("Balustrade top rail", (x, -2.66, 3.96), (.88, .05, .055),
             WOOD, r, edge=.01)
        cube("Balustrade lower rail", (x, -2.66, 3.56), (.88, .05, .055),
             WOOD, r, edge=.01)
        for j in range(5):
            cube("Balustrade vertical", (x - .34 + j*.17, -2.66, 3.76),
                 (.045, .045, .42), WOOD2, r, edge=.008)
        # Floral ceramic spandrel — small colored relief pieces, not a broad
        # checkerboard band across the full house.
        cube("Floral tile field", (x, -2.50, 3.30), (.98, .055, .30),
             CHALK, r, edge=.012)
        for j in range(5):
            tile = (PERANAKAN_PINK, TILE_BLUE, PERANAKAN_MINT, YELLOW, PERANAKAN_PINK)[j]
            sphere("Floral tile motif", (x - .34 + j*.17, -2.55, 3.30), .065,
                   tile, r, scale=(1.2, .25, .75), segments=8)
        # Small oval vent above each rectangular fanlight.
        vent = torus("Oval ventilation frame", (x, -2.55, 5.48), .13, .032,
                     CREAM, r, rot=(R90, 0, 0), major_segments=16)
        vent.scale.x = 1.35
        vent.scale.y = .70

    for idx, x in enumerate((-1.25, 0, 1.25)):
        french_window(idx, x)

    # Pilasters, restrained capitals and layered cornice shadows frame the
    # window system without turning the roofline into an oversized signboard.
    for x in (-1.91, -.64, .64, 1.91):
        cube("Fluted facade pilaster", (x, -2.53, 4.43), (.16, .10, 2.10),
             CREAM, r, edge=.025)
        for dx in (-.045, .045):
            cube("Pilaster flute", (x + dx, -2.59, 4.42), (.025, .025, 1.68),
                 PERANAKAN_MINT, r, edge=.004)
        cube("Floral capital block", (x, -2.58, 5.54), (.31, .14, .22),
             CHALK, r, edge=.045)
        sphere("Capital flower", (x, -2.67, 5.55), .10, PERANAKAN_LILAC,
               r, scale=(1.15, .28, .72), segments=8)
    for z, depth, width in ((5.68, .16, W + .14), (5.82, .21, W + .28), (5.96, .26, W + .42)):
        cube("Layered plaster cornice", (0, -2.46 - depth*.40, z),
             (width, depth, .11), CREAM if z < 5.9 else CHALK, r, edge=.025)
    for x in (-1.70, -1.22, -.74, -.26, .26, .74, 1.22, 1.70):
        cube("Eaves bracket", (x, -2.59, 6.07), (.12, .18, .18),
             CREAM, r, rot=(math.radians(10), 0, 0), edge=.02)

    # End-wall fenestration and drainpipes keep three-quarter card views from
    # degenerating into a blank slab while remaining quieter than the facade.
    for side in (-1, 1):
        wall_x = side*(W/2 + .035)
        cube("Side stringcourse", (wall_x, .48, 3.02), (.07, 4.92, .15),
             CREAM, r, edge=.018)
        for y in (-1.0, .55, 2.10):
            cube("Side window recess", (wall_x, y, 4.18), (.065, .90, .92),
                 INK, r, edge=.018)
            for sy in (-1, 1):
                cube("Side casement shutter", (side*(W/2 + .085), y + sy*.23, 4.18),
                     (.045, .38, .82), PERANAKAN_MINT, r, edge=.016)
        cable("Rainwater downpipe", [(side*(W/2 + .12), -1.92, 5.74),
             (side*(W/2 + .12), -1.92, .32)], .038, TEAL, r)

    # Split roofs expose a real airwell.  The previous single slab made every
    # hidden view read like a featureless rectangular box.
    def roof_section(name, centre_y, depth):
        for side in (-1, 1):
            cube(name, (side*.99, centre_y, 6.15), (2.30, depth, .15),
                 CORAL, r, rot=(0, math.radians(side*23), 0), edge=.045)
            for row_y in [centre_y - depth*.36, centre_y, centre_y + depth*.36]:
                cube("Clay tile course", (side*.99, row_y, 6.20), (2.25, .055, .045),
                     CREAM, r, rot=(0, math.radians(side*23), 0), edge=.008)
        cube("Roof ridge", (0, centre_y, 6.58), (.22, depth + .08, .18),
             CORAL, r, edge=.035)

    roof_section("Front pitched roof", -.14, 3.82)
    roof_section("Rear service roof", 2.86, 1.55)
    cube("Airwell left parapet", (-1.80, 1.74, 5.86), (.20, .80, .44),
         CREAM, r, edge=.035)
    cube("Airwell right parapet", (1.80, 1.74, 5.86), (.20, .80, .44),
         CREAM, r, edge=.035)

    # Rear service elevation: casements, door, canopy and ventilation panels.
    rear_y = 3.08
    cube("Rear service door", (0, rear_y, 1.35), (.88, .08, 2.15),
         WOOD2, r, edge=.025)
    cube("Rear rain canopy", (0, rear_y + .28, 2.48), (1.45, .72, .12),
         CORAL, r, rot=(math.radians(7), 0, 0), edge=.025)
    for x in (-1.23, 1.23):
        for z in (1.48, 4.18):
            cube("Rear casement recess", (x, rear_y, z), (.78, .07, .90),
                 INK, r, edge=.018)
            for sx in (-1, 1):
                cube("Rear casement leaf", (x + sx*.19, rear_y + .055, z),
                     (.32, .045, .80), PERANAKAN_MINT, r, edge=.015)
    for x in (-1.25, -.75, .75, 1.25):
        cube("Rear ventilation block", (x, rear_y + .06, 2.82), (.30, .045, .16),
             TILE_BLUE, r, edge=.012)
    return r


# ---------------------------------------------------------------------------
# 2. KAMPONG HOUSE — stilts, steep attap gable roof, verandah, staircase,
#    timber boards, ventilation openings, pots and a clay water jar.
# ---------------------------------------------------------------------------
def build_kampong():
    r = empty("KAMPONG HOUSE")
    # Export a permanent patch of earth with the house.  The previous GLB
    # contained only stilts, so the library viewer made the whole building
    # read as if it were hovering in an empty sky.
    cube("Kampong earth pad", (0, 0, .10), (7.4, 6.5, .20), CLAY, r, edge=.16)
    cube("Packed earth footpath", (0, -2.45, .22), (1.65, 2.15, .10),
         AWNING_CREAM, r, edge=.08)
    for x, y, scale in ((-2.9, -2.1, 1.0), (-3.0, .6, .8), (2.85, .9, .9)):
        ico("Ground vegetation", (x, y, .30), .36, GREEN2, r,
            scale=(scale, scale*.72, .42))
    # stilts + cross bracing (two rows of three hardwood posts)
    for x in (-2.1, 0, 2.1):
        for y in (-1.5, 1.3):
            cyl("Mangrove stilt", (x, y, .8), .14, 1.6, WOOD, r, 10)
    for y in (-1.5, 1.3):
        cube("Stilt brace", (0, y, .85), (4.4, .09, .12), WOOD, r,
             rot=(0, 0, math.radians(4)), edge=.02)
    # raised timber floor + shaded verandah deck
    cube("Raised timber floor", (0, 0, 1.62), (5.6, 3.9, .22), WOOD2, r, edge=.07)
    cube("Verandah deck", (0, -2.35, 1.66), (5.6, 1.05, .18), WOOD2, r, edge=.06)
    # timber house body with board rhythm
    cube("Timber house body", (0, .15, 3.05), (5.0, 3.3, 2.65), WOOD2, r, edge=.08)
    for x in (-2.25, -1.8, -1.35, -.9, -.45, 0, .45, .9, 1.35, 1.8, 2.25):
        cube("Wall board seam", (x, -1.52, 3.05), (.04, .04, 2.5), WOOD, r, edge=.006)
    # gable ends with attap infill + ventilation slit near the apex
    wedge("Front gable", (0, -1.55, 4.38), 5.0, .16, 1.55, THATCH, r)
    wedge("Rear gable", (0, 1.85, 4.38), 5.0, .16, 1.55, THATCH, r)
    for y in (-1.62, 1.92):
        cube("Gable vent", (0, y, 5.35), (1.15, .06, .16), INK, r, edge=.02)
        louvres(r, 0, y - (.03 if y < 0 else -.03), 5.20, 1.0, 2, WOOD2, gap=.16)
    # steep attap roof with deep eaves
    cube("Attap roof L", (-1.55, .15, 5.05), (3.55, 4.6, .16), THATCH, r,
         rot=(0, math.radians(-33), 0), edge=.06)
    cube("Attap roof R", (1.55, .15, 5.05), (3.55, 4.6, .16), THATCH, r,
         rot=(0, math.radians(33), 0), edge=.06)
    cube("Roof ridge cap", (0, .15, 6.05), (.3, 4.7, .22), WOOD, r, edge=.06)
    # attap layer ribs
    for y in (-1.7, -.9, -.1, .7, 1.5):
        cube("Attap rib L", (-1.55, y, 5.12), (3.4, .06, .06), WOOD, r,
             rot=(0, math.radians(-33), 0), edge=.01)
        cube("Attap rib R", (1.55, y, 5.12), (3.4, .06, .06), WOOD, r,
             rot=(0, math.radians(33), 0), edge=.01)
    # front door + windows with propped-open timber shutters
    cube("Kampong door", (0, -1.55, 2.85), (.95, .12, 2.1), WOOD, r, edge=.04)
    cube("Door panel", (0, -1.62, 2.85), (.78, .06, 1.9), TEAL, r, edge=.02)
    for x in (-1.5, 1.5):
        cube("Kampong window", (x, -1.55, 3.2), (.95, .10, 1.0), INK, r, edge=.03)
        cube("Open shutter", (x, -1.75, 3.85), (.95, .06, .55), TEAL2, r,
             rot=(math.radians(-38), 0, 0), edge=.02)
        louvres(r, x, -1.62, 2.85, .8, 4, CHALK, gap=.22)
    # side windows
    for y in (-.5, .7):
        cube("Side window", (-2.52, y, 3.2), (.08, .8, .9), GLASS, r, edge=.02)
        cube("Side window", (2.52, y, 3.2), (.08, .8, .9), GLASS, r, edge=.02)
    # verandah posts, rail and front staircase
    for x in (-2.45, -1.2, 1.2, 2.45):
        cyl("Verandah post", (x, -2.75, 2.9), .08, 2.5, WOOD, r, 10)
    cube("Verandah roof", (0, -2.4, 4.25), (5.7, 1.5, .14), THATCH, r,
         rot=(math.radians(-10), 0, 0), edge=.05)
    for x in (-1.85, 1.85):
        cube("Verandah rail", (x, -2.82, 2.45), (1.1, .07, .07), WOOD, r, edge=.015)
        cube("Verandah baluster", (x - .45, -2.82, 2.1), (.06, .06, .7), WOOD, r, edge=.01)
        cube("Verandah baluster", (x + .45, -2.82, 2.1), (.06, .06, .7), WOOD, r, edge=.01)
    for i in range(4):
        cube("Front step", (0, -3.05 - i*.34, 1.5 - i*.36), (1.5, .44, .18), WOOD2, r, edge=.05)
    cube("Stair stringer L", (-.78, -3.55, .8), (.1, 1.6, .14), WOOD, r,
         rot=(math.radians(-43), 0, 0), edge=.02)
    cube("Stair stringer R", (.78, -3.55, .8), (.1, 1.6, .14), WOOD, r,
         rot=(math.radians(-43), 0, 0), edge=.02)
    # warm interior glow for evening
    cube("Warm doorway glow", (0, -1.60, 2.5), (.6, .04, .5), WARM, r, edge=.01)
    # surrounding details: clay water jar, pots with greenery, hanging lantern
    sphere("Clay water jar", (2.9, -2.2, .62), .52, CLAY, r, scale=(1, 1, 1.15), segments=14)
    torus("Jar rim", (2.9, -2.2, 1.08), .30, .09, CLAY, r, major_segments=14)
    sphere("Jar lid", (2.9, -2.2, 1.16), .26, WOOD2, r, scale=(1, 1, .45), segments=12)
    for i, (x, y) in enumerate(((-2.9, -2.0), (-3.15, -.6), (3.1, .2))):
        cyl("Plant pot", (x, y, .28), .30, .55, CLAY, r, 12)
        ico("Pot fern", (x, y, .75), .42, (GREEN, GREEN2, GREEN3)[i % 3], r, scale=(1, 1, .8))
    cyl("Lantern stem", (2.45, -2.75, 3.7), .03, .5, INK, r, 8)
    sphere("Verandah lantern", (2.45, -2.75, 3.35), .22, WARM, r, scale=(1, 1, 1.25), segments=12)
    return r


# ---------------------------------------------------------------------------
# 3. HDB VOID DECK — open walkable ground floor: columns, lift lobby,
#    letterboxes, noticeboard, terrazzo seating, walkway, bicycle parking.
# ---------------------------------------------------------------------------
def build_voiddeck():
    r = empty("HDB VOID DECK")
    W, D = 8.0, 6.4
    # terrazzo floor + void deck ceiling
    cube("Terrazzo floor", (0, 0, .12), (W, D, .24), TERRAZZO, r, edge=.05)
    cube("Void deck ceiling", (0, 0, 3.15), (W, D, .3), CREAM, r, edge=.06)
    # structural columns on a grid — the central front-to-back aisle stays open
    for x in (-3.2, -1.6, 1.6, 3.2):
        for y in (-2.4, 2.4):
            cube("Void deck column", (x, y, 1.62), (.34, .34, 2.8), CREAM, r, edge=.045)
            cube("Column skirt", (x, y, .42), (.48, .48, .6), CONCRETE, r, edge=.05)
    for x in (-3.2, 3.2):
        cube("Void deck column", (x, 0, 1.62), (.34, .34, 2.8), CREAM, r, edge=.045)
        cube("Column skirt", (x, 0, .42), (.48, .48, .6), CONCRETE, r, edge=.05)
    # residential slab above (3 floors) so it reads as an HDB block base
    cube("Upper residential slab", (0, .2, 5.2), (7.4, 5.6, 3.8), CREAM, r, edge=.10)
    for floor in range(3):
        z = 4.05 + floor*1.15
        cube("Corridor band", (0, -2.68, z - .35), (7.3, .1, .12), TEAL, r, edge=.02)
        for x in (-2.9, -2.05, -1.2, -.35, .5, 1.35, 2.2):
            cube("Flat window", (x, -2.65, z + .15), (.42, .06, .5), GLASS, r, edge=.015)
            cube("Window shade", (x, -2.72, z + .5), (.5, .18, .06), CREAM, r, edge=.012)
        # Rear service yards are inferred from the typology.  They use a
        # quieter rhythm than the public corridor but close the former blank
        # upper slab in a 360-degree inspection.
        cube("Rear service band", (0, 3.02, z - .35), (7.3, .10, .12), TEAL, r, edge=.02)
        for x in (-2.55, -1.7, -.85, 0, .85, 1.7, 2.55):
            cube("Rear service window", (x, 3.03, z + .15), (.42, .06, .5), GLASS, r, edge=.015)
            cube("Rear laundry shelf", (x, 3.16, z - .10), (.46, .28, .06), CONCRETE, r, edge=.012)
    for side in (-1, 1):
        for floor in range(3):
            z = 4.20 + floor*1.15
            for y in (-1.55, -.50, .55, 1.60):
                cube("End-wall ventilation", (side*3.72, y, z), (.07, .54, .30),
                     TEAL if (floor + int(y > 0)) % 2 else GLASS, r, edge=.015)
    cube("Lift core stripe", (3.1, -2.62, 5.2), (1.05, .16, 3.9), CORAL, r, edge=.04)
    cube("Roof parapet", (0, .2, 7.25), (7.6, 5.8, .3), CONCRETE, r, edge=.06)
    cyl("Roof water tank", (-2.2, .8, 7.75), .5, .8, METAL, r, 14)
    cyl("Roof water tank", (-.8, .8, 7.75), .5, .8, METAL, r, 14)
    # lift lobby entrance (front-right)
    cube("Lift lobby frame", (2.9, -2.9, 1.7), (1.5, .5, 2.9), CORAL, r, edge=.06)
    cube("Lift lobby glass", (2.9, -3.12, 1.6), (1.15, .08, 2.1), GLASS, r, edge=.02)
    cube("Lift lobby canopy", (2.9, -3.35, 3.0), (1.8, .9, .14), CORAL, r, edge=.04)
    label("LIFT", (2.9, -3.44, 3.02), .22, CHALK, r)
    # block number panel on the corner column
    cube("Block panel", (-3.2, -2.62, 2.35), (.75, .1, 1.15), CORAL, r, edge=.04)
    label("BLK\n238", (-3.2, -2.70, 2.38), .26, CHALK, r)
    # letterbox bank (front-left recess)
    cube("Letterbox wall", (-2.55, -2.75, 1.5), (1.7, .3, 1.9), CONCRETE, r, edge=.05)
    for row in range(4):
        for col in range(5):
            cube("Letterbox", (-3.15 + col*.30, -2.93, .95 + row*.38),
                 (.26, .06, .32), CHALK if (row + col) % 7 else YELLOW, r, edge=.012)
    # noticeboard with pinned notices (back-left bay, clear of the aisle)
    cube("Noticeboard frame", (-2.4, 2.72, 1.85), (1.5, .18, 1.1), TEAL, r, edge=.04)
    cube("Noticeboard cork", (-2.4, 2.62, 1.85), (1.3, .06, .9), CREAM, r, edge=.02)
    for i, (nx, nz, m) in enumerate(((-2.75, 2.05, PERANAKAN_PINK), (-2.25, 1.95, CHALK),
                                     (-2.5, 1.6, YELLOW), (-2.05, 2.15, PERANAKAN_MINT))):
        cube("Pinned notice", (nx, 2.58, nz), (.3, .02, .35), m, r, edge=.005)
    # terrazzo seating: chess table + stools, kept left of the aisle
    cyl("Chess table pedestal", (-2.2, -.3, .62), .16, .9, CONCRETE, r, 12)
    cube("Chess table top", (-2.2, -.3, 1.12), (1.0, 1.0, .1), TERRAZZO, r, edge=.03)
    for gx in range(2):
        for gy in range(2):
            cube("Chess square", (-2.42 + gx*.44, -.52 + gy*.44, 1.18), (.2, .2, .02), INK, r, edge=.004)
    for sx, sy in ((-2.9, -.3), (-1.5, -.3)):
        cyl("Terrazzo stool", (sx, sy, .45), .26, .5, CONCRETE, r, 12)
    # sheltered walkway connection extending from the front overhang
    cube("Linkway roof", (-1.2, -4.6, 2.95), (3.2, 3.4, .16), TEAL, r, edge=.05)
    cube("Linkway fascia", (-1.2, -6.25, 2.82), (3.2, .1, .3), CHALK, r, edge=.03)
    for x in (-2.4, 0):
        cyl("Linkway post", (x, -5.9, 1.5), .09, 2.9, METAL, r, 10)
    # bicycle parking with two parked bicycles (front-right corner)
    for x in (1.6, 2.2, 2.8):
        torus("Bicycle rack", (x, -4.3, .45), .32, .045, METAL, r, rot=(0, R90, 0), major_segments=12)
    for bx, col in ((1.9, RED), (2.9, BLUE)):
        torus("Bicycle wheel", (bx - .35, -4.75, .42), .30, .05, INK, r, rot=(0, R90, 0), major_segments=14)
        torus("Bicycle wheel", (bx + .35, -4.75, .42), .30, .05, INK, r, rot=(0, R90, 0), major_segments=14)
        cube("Bicycle frame", (bx, -4.75, .62), (.7, .05, .07), col, r,
             rot=(0, math.radians(12), 0), edge=.015)
        cube("Bicycle seat post", (bx - .1, -4.75, .85), (.05, .05, .4), METAL, r, edge=.012)
        cube("Bicycle handlebar", (bx + .38, -4.75, .95), (.05, .3, .05), METAL, r, edge=.012)
    # potted plants soften the deck edge
    for i, x in enumerate((-3.6, 3.6)):
        cyl("Void deck planter", (x, 2.6, .35), .4, .6, CONCRETE, r, 12)
        ico("Planter shrub", (x, 2.6, .9), .5, (GREEN, GREEN2)[i], r, scale=(1, 1, .8))
    return r


# ---------------------------------------------------------------------------
# 4. KAMPONG PROP KIT — nine named child nodes, each pivot at its base.
#    Exported WITHOUT material joining so every child stays independently
#    toggleable / clonable in Three.js. Arranged as a lived-in yard cluster.
# ---------------------------------------------------------------------------
def prop_empty(root, name, loc):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.parent = root
    return o


def build_kampong_props():
    r = empty("KAMPONG PROP KIT")

    # --- TimberFootbridge: arched plank bridge (pivot centre of span)
    fb = prop_empty(r, "TimberFootbridge", (-1.1, -.4, 0))
    for i in range(5):
        lift = math.sin((i/4)*math.pi)*.16
        cube("Bridge plank", (0, -.64 + i*.32, .18 + lift), (1.15, .28, .08), WOOD2, fb, edge=.025)
    for x in (-.52, .52):
        cube("Bridge rail", (x, 0, .55), (.07, 1.5, .07), WOOD, fb, edge=.015)
        for y in (-.62, 0, .62):
            cube("Bridge rail post", (x, y, .4), (.06, .06, .45), WOOD, fb, edge=.012)

    # --- OpenDrain: concrete U-channel with a water strip (pivot mid-channel)
    od = prop_empty(r, "OpenDrain", (-1.1, -1.6, 0))
    cube("Drain bed", (0, 0, .06), (1.0, 2.6, .12), CONCRETE, od, edge=.03)
    for x in (-.45, .45):
        cube("Drain wall", (x, 0, .22), (.14, 2.6, .32), CONCRETE, od, edge=.03)
    cube("Drain water", (0, 0, .13), (.72, 2.5, .06), BLUE, od, edge=.02)

    # --- LaundryPole: two posts, bamboo poles, hanging laundry (pivot mid)
    lp = prop_empty(r, "LaundryPole", (2.1, -.6, 0))
    for x in (-1.05, 1.05):
        cyl("Laundry post", (x, 0, 1.15), .07, 2.3, WOOD, lp, 10)
        cube("Post sock", (x, 0, .12), (.22, .22, .24), ZINC, lp, edge=.04)
    for z in (1.75, 2.15):
        cyl("Bamboo pole", (0, 0, z), .04, 2.5, WOOD2, lp, 8, rot=(0, R90, 0))
    for i, (x, m) in enumerate(((-.62, CORAL), (-.05, CHALK), (.52, BLUE))):
        cube("Hanging laundry", (x, 0, 1.52), (.48, .04, .5), m, lp,
             rot=(0, 0, math.radians(3 - i*3)), edge=.015)

    # --- ZincFence: corrugated panels between timber posts (pivot mid-run)
    zf = prop_empty(r, "ZincFence", (.4, 1.9, 0))
    for x in (-1.55, 0, 1.55):
        cyl("Fence post", (x, 0, .75), .07, 1.5, WOOD, zf, 8)
    for i, x in enumerate((-.78, .78)):
        cube("Zinc panel", (x, 0, .8), (1.5, .06, 1.2), ZINC, zf,
             rot=(0, 0, math.radians(2 if i else -2)), edge=.02)
        for rx in (-.5, -.17, .17, .5):
            cube("Zinc corrugation", (x + rx, -.045, .8), (.09, .03, 1.14), METAL, zf, edge=.008)

    # --- Chickens (pivot under body)
    ca = prop_empty(r, "ChickenA", (.55, -.75, 0))
    sphere("ChickenA body", (0, 0, .34), .26, CHICKEN_WHITE, ca, scale=(1.15, .9, .85), segments=12)
    sphere("ChickenA head", (.26, -.1, .30), .13, CHICKEN_WHITE, ca, segments=10)
    cone("ChickenA beak", (.38, -.12, .27), .05, .01, .12, YELLOW, ca, 8, rot=(0, R90, 0))
    cube("ChickenA tail", (-.24, .02, .48), (.16, .06, .22), CHICKEN_WHITE, ca,
         rot=(0, math.radians(35), 0), edge=.03)
    cube("ChickenA comb", (.26, -.1, .42), (.1, .04, .07), RED, ca, edge=.02)
    for x in (-.06, .08):
        cyl("ChickenA leg", (x, 0, .10), .025, .2, YELLOW, ca, 6)

    cb = prop_empty(r, "ChickenB", (1.25, -.15, 0))
    sphere("ChickenB body", (0, 0, .38), .27, CHICKEN_BROWN, cb, scale=(1.05, .85, 1.0), segments=12)
    sphere("ChickenB head", (0, -.02, .72), .13, CHICKEN_BROWN, cb, segments=10)
    cone("ChickenB beak", (0, -.14, .71), .05, .01, .12, YELLOW, cb, 8, rot=(R90, 0, 0))
    cube("ChickenB tail", (0, .18, .66), (.08, .14, .24), CHICKEN_BROWN, cb,
         rot=(math.radians(-30), 0, 0), edge=.03)
    cube("ChickenB comb", (0, -.02, .84), (.05, .1, .07), RED, cb, edge=.02)
    for x in (-.07, .07):
        cyl("ChickenB leg", (x, 0, .10), .025, .22, YELLOW, cb, 6)

    # --- CoconutTree: leaning trunk, fronds, coconuts (pivot at trunk base)
    ct = prop_empty(r, "CoconutTree", (-2.6, 1.0, 0))
    for i in range(4):
        cyl("Coconut trunk", (.09*i, 0, .75 + i*1.15), .17 - i*.015, 1.3, WOOD2, ct, 9,
            rot=(0, math.radians(-4), 0))
    top = (.27, 0, 5.1)
    for a in range(7):
        ang = a*(math.pi*2/7)
        ico("Coconut frond", (top[0] + math.cos(ang)*1.05, math.sin(ang)*1.05, top[2] + .12),
            .95, (GREEN, GREEN2, GREEN3)[a % 3], ct,
            scale=(1.15, .30, .16))
    for dx, dy in ((-.12, .1), (.14, -.08), (.02, -.16)):
        sphere("Coconut", (top[0] + dx, dy, top[2] - .25), .14, WOOD, ct, segments=10)

    # --- WoodenStool (pivot under seat centre)
    ws = prop_empty(r, "WoodenStool", (-.6, -1.5, 0))
    cyl("Stool seat", (0, 0, .52), .30, .09, WOOD2, ws, 14)
    for a in range(3):
        ang = a*(math.pi*2/3) + .5
        cyl("Stool leg", (math.cos(ang)*.18, math.sin(ang)*.18, .26), .045, .52, WOOD, ws, 8,
            rot=(math.radians(6)*math.sin(ang), math.radians(6)*math.cos(ang), 0))

    # --- ClayWaterJar (pivot under jar centre)
    cj = prop_empty(r, "ClayWaterJar", (.15, -1.55, 0))
    sphere("Water jar body", (0, 0, .48), .42, CLAY, cj, scale=(1, 1, 1.1), segments=14)
    torus("Water jar rim", (0, 0, .84), .24, .07, CLAY, cj, major_segments=14)
    sphere("Water jar lid", (0, 0, .92), .22, WOOD2, cj, scale=(1, 1, .4), segments=12)

    return r


# ---------------------------------------------------------------------------
# 5. SULTAN MOSQUE — golden domes, twin minarets, cream façade, arched
#    entrance rhythm. Respectful, stylised, readable at gameplay distance.
# ---------------------------------------------------------------------------
def mosque_arch(parent, x, y, z, w, h, face=1):
    """Arched bay: pilasters, dark recess and arch crown, proud of the wall."""
    proud = .05*face
    cube("Arch recess", (x, y + proud, z + h*.36), (w*.58, .10, h*.72), INK, parent, edge=.025)
    cyl("Arch crown", (x, y + proud, z + h*.72), w*.29, .10, INK, parent, 14, rot=(R90, 0, 0))
    cyl("Arch trim", (x, y + proud*.5, z + h*.72), w*.38, .07, CHALK, parent, 14, rot=(R90, 0, 0))
    for sx in (-1, 1):
        cube("Arch pilaster", (x + sx*w*.42, y + proud*.6, z + h*.38), (w*.15, .12, h*.76),
             CHALK, parent, edge=.025)


def build_sultan_mosque():
    r = empty("SULTAN MOSQUE")
    # plinth + main prayer hall
    cube("Mosque plinth", (0, 0, .18), (9.2, 7.2, .36), CONCRETE, r, edge=.07)
    cube("Prayer hall", (0, .3, 2.05), (8.2, 6.0, 3.4), CREAM, r, edge=.09)
    cube("Hall cornice", (0, .3, 3.85), (8.6, 6.4, .3), CHALK, r, edge=.06)
    cube("Hall parapet", (0, .3, 4.15), (8.4, 6.2, .35), CREAM, r, edge=.05)
    # arched entrance rhythm: 5 front bays, 4 side bays
    for i in range(5):
        mosque_arch(r, -2.8 + i*1.4, -2.74, .55, 1.3, 2.6)
    for side in (-1, 1):
        for i in range(4):
            x = side*4.14
            cube("Side arch recess", (x, -1.6 + i*1.5, 1.7), (.1, .75, 1.9), INK, r, edge=.025)
            cyl("Side arch crown", (x, -1.6 + i*1.5, 2.65), .38, .1, INK, r, 12,
                rot=(0, R90, 0))
    # upper arched windows between pilaster strips
    for i in range(5):
        x = -2.8 + i*1.4
        cube("Upper window", (x, -2.72, 3.0), (.6, .08, .7), GLASS, r, edge=.02)
        cyl("Upper window arch", (x, -2.72, 3.35), .3, .08, GLASS, r, 12, rot=(R90, 0, 0))
    # central entrance portal with grand arch
    cube("Entrance portal", (0, -3.15, 1.75), (2.6, 1.0, 3.5), CHALK, r, edge=.08)
    cube("Portal recess", (0, -3.55, 1.55), (1.7, .3, 2.7), INK, r, edge=.04)
    cyl("Portal arch", (0, -3.55, 2.85), .85, .3, INK, r, 16, rot=(R90, 0, 0))
    cyl("Portal arch trim", (0, -3.50, 2.85), 1.02, .12, GOLD, r, 16, rot=(R90, 0, 0))
    cube("Portal doors", (0, -3.45, 1.1), (1.3, .12, 1.7), WOOD2, r, edge=.03)
    for i in range(3):
        cube("Portal step", (0, -3.85 - i*.3, .10 + i*.12), (3.0 + i*.3, .42, .2), CONCRETE, r, edge=.04)
    # main golden dome on a cream drum, black base band, finial
    cyl("Dome drum", (0, .3, 4.75), (2.35), .9, CREAM, r, 24)
    cyl("Dome base band", (0, .3, 5.2), 2.42, .22, INK, r, 24)
    sphere("Golden dome", (0, .3, 6.05), 2.35, GOLD, r, scale=(1, 1, .82), segments=24)
    cone("Dome finial", (0, .3, 8.15), .22, .02, .85, GOLD, r, 10)
    sphere("Finial orb", (0, .3, 8.6), .16, GOLD, r, segments=10)
    # four corner turrets with small gold cupolas
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx*3.8, .3 + sy*2.7
            cyl("Corner turret", (x, y, 4.75), .55, 1.3, CREAM, r, 14)
            sphere("Corner cupola", (x, y, 5.6), .6, GOLD, r, scale=(1, 1, .8), segments=14)
            cone("Cupola finial", (x, y, 6.2), .1, .01, .4, GOLD, r, 8)
    # twin minarets flanking the front
    for sx in (-1, 1):
        x = sx*4.35
        cube("Minaret base", (x, -3.0, 1.9), (1.1, 1.1, 3.8), CREAM, r, edge=.07)
        cube("Minaret band", (x, -3.0, 3.9), (1.25, 1.25, .3), CHALK, r, edge=.05)
        cyl("Minaret shaft", (x, -3.0, 5.1), .42, 2.6, CREAM, r, 14)
        cyl("Minaret balcony", (x, -3.0, 6.35), .68, .3, CHALK, r, 14)
        cyl("Minaret upper", (x, -3.0, 6.95), .34, 1.0, CREAM, r, 12)
        sphere("Minaret cap", (x, -3.0, 7.65), .48, GOLD, r, scale=(1, 1, 1.0), segments=14)
        cone("Minaret spike", (x, -3.0, 8.35), .09, .01, .7, GOLD, r, 8)
        for wz in (1.4, 2.4):
            cube("Minaret window", (x, -3.56, wz), (.4, .06, .6), GLASS, r, edge=.015)
    return r


# ---------------------------------------------------------------------------
# 6. WET MARKET — open-sided hall: produce / fish / butcher zones, striped
#    awnings, hanging lights and fans, baskets and scales, tiled surfaces,
#    open central aisle (x in [-1.6, 1.6]) kept completely clear.
# ---------------------------------------------------------------------------
def market_stall(r, x, y, accent, title, goods):
    """One stall bay against a side wall; goods callback fills the counter."""
    cube("Stall counter", (x, y, .65), (1.9, 1.15, 1.05), CHALK, r, edge=.05)
    cube("Counter tile trim", (x, y - .58, 1.02), (1.9, .05, .14), TILE_BLUE, r, edge=.015)
    cube("Stall back shelf", (x, y + .62, 1.5), (1.9, .25, 1.9), CREAM, r, edge=.04)
    # striped awning (alternating colour / cream slats)
    for i in range(5):
        cube("Awning stripe", (x - .8 + i*.4, y - .45, 2.42), (.38, 1.25, .07),
             accent if i % 2 == 0 else AWNING_CREAM, r, rot=(math.radians(-14), 0, 0), edge=.015)
    cube("Stall lightbox", (x, y - .62, 2.72), (1.6, .1, .34), accent, r, edge=.03)
    label(title, (x, y - .69, 2.74), .17, CHALK if accent != YELLOW else INK, r)
    goods(x, y)


def build_wetmarket():
    r = empty("WET MARKET HALL")
    # washable tiled floor + wet sheen patches
    cube("Market floor", (0, 0, .12), (9.0, 7.0, .24), TERRAZZO, r, edge=.05)
    for fx, fy in ((-.6, .8), (.9, -1.1), (-.2, -2.2)):
        cube("Wet floor sheen", (fx, fy, .255), (1.3, 1.0, .03), GLASS, r, edge=.06)
    # perimeter columns + pitched roof with clerestory
    for x in (-4.1, 4.1):
        for y in (-3.0, 0, 3.0):
            cyl("Market column", (x, y, 1.65), .14, 3.1, TEAL, r, 12)
            cube("Column foot", (x, y, .3), (.4, .4, .35), CONCRETE, r, edge=.05)
    cube("Roof sheet L", (-2.3, 0, 3.95), (4.9, 7.6, .16), TEAL, r,
         rot=(0, math.radians(-13), 0), edge=.06)
    cube("Roof sheet R", (2.3, 0, 3.95), (4.9, 7.6, .16), TEAL, r,
         rot=(0, math.radians(13), 0), edge=.06)
    cube("Roof ridge", (0, 0, 4.5), (.4, 7.7, .3), CHALK, r, edge=.07)
    cube("Front fascia", (0, -3.75, 3.55), (9.2, .12, .5), CHALK, r, edge=.04)
    label("PASAR", (0, -3.84, 3.57), .3, TEAL, r)
    # hanging aisle lights + ceiling fans (above head height, aisle stays clear)
    for y in (-2.0, 0, 2.0):
        cable("Light cord", [(0, y, 4.15), (0, y, 3.3)], .02, INK, r)
        sphere("Aisle bulb", (0, y, 3.18), .13, WARM, r, segments=10)
    for y in (-1.0, 1.0):
        cyl("Fan stem", (0, y, 3.9), .035, .5, METAL, r, 8)
        for a in range(3):
            blade = cube("Fan blade", (0, y, 3.62), (1.15, .16, .04), METAL, r, edge=.02)
            blade.rotation_euler.z = a*(math.pi*2/3)
    # produce zone (left side, two bays)
    def produce(x, y):
        for i, (dx, m) in enumerate(((-.55, GREEN2), (0, VEG_ORANGE), (.55, GREEN3))):
            cube("Produce crate", (x + dx, y - .15, 1.28), (.5, .55, .22), WOOD2, r, edge=.03)
            for j in range(3):
                ico("Produce pile", (x + dx - .12 + j*.12, y - .15, 1.44), .11, m, r)
        cyl("Weighing scale post", (x + .75, y - .3, 1.45), .03, .5, METAL, r, 8)
        cyl("Scale dial", (x + .75, y - .3, 1.72), .14, .07, CHALK, r, 12, rot=(R90, 0, 0))
        cyl("Scale tray", (x + .75, y - .3, 1.28), .18, .05, METAL, r, 12)
    # fish zone (right side, front bay)
    def fish(x, y):
        cube("Ice bed", (x, y - .15, 1.26), (1.6, .8, .18), CHALK, r, edge=.04)
        for i in range(3):
            ico("Fish", (x - .5 + i*.5, y - .15, 1.42), .22, FISH_SILVER, r,
                scale=(1.5, .5, .45))
        cube("Fish tray", (x + .3, y + .25, 1.24), (.7, .45, .1), BLUE, r, edge=.03)
        cyl("Weighing scale post", (x - .75, y - .3, 1.45), .03, .5, METAL, r, 8)
        cyl("Scale dial", (x - .75, y - .3, 1.72), .14, .07, CHALK, r, 12, rot=(R90, 0, 0))
    # butcher zone (right side, back bay)
    def butcher(x, y):
        cube("Butcher block", (x, y - .2, 1.28), (.9, .6, .14), WOOD2, r, edge=.03)
        cyl("Hanging rail", (x, y - .1, 2.1), .035, 1.6, METAL, r, 8, rot=(0, R90, 0))
        for i in range(3):
            hx = x - .5 + i*.5
            cyl("Meat hook", (hx, y - .1, 1.95), .02, .2, INK, r, 6)
            ico("Hanging cut", (hx, y - .1, 1.72), .17, MEAT_RED, r, scale=(.8, .6, 1.3))
        ico("Chopped cut", (x - .2, y - .2, 1.4), .14, MEAT_RED, r, scale=(1.2, .9, .5))
    # dry goods (left side, back bay)
    def drygoods(x, y):
        for i, (dx, m) in enumerate(((-.5, CREAM), (0, CHALK), (.5, CREAM))):
            sphere("Rice sack", (x + dx, y - .1, 1.32), .24, m, r, scale=(1, .85, .75), segments=10)
        cone("Woven basket", (x + .7, y - .25, 1.35), .28, .2, .35, WOOD2, r, 12)
    market_stall(r, -3.0, -2.0, GREEN2, "SAYUR", produce)
    market_stall(r, -3.0, .2, YELLOW, "KEDAI", drygoods)
    market_stall(r, 3.0, -2.0, BLUE, "IKAN", fish)
    market_stall(r, 3.0, .2, RED, "DAGING", butcher)
    # baskets and crates along the stall fronts (outside the aisle)
    for x, y in ((-2.2, -3.0), (2.2, -3.1), (-2.4, 1.4), (2.5, 1.5)):
        cone("Market basket", (x, y, .45), .34, .24, .5, WOOD2, r, 12)
    # rear produce overflow crates (flanking the aisle exit, never blocking it)
    for sx in (-1, 1):
        cube("Rear crate stack", (sx*2.6, 2.9, .55), (1.1, .7, .85), WOOD2, r, edge=.05)
        for j in range(3):
            ico("Crate produce", (sx*2.6 - .25 + j*.25, 2.85, 1.05), .16,
                (GREEN2, VEG_ORANGE, GREEN3)[j % 3], r)
    return r


# ---------------------------------------------------------------------------
ASSET_JOBS = [
    ("peranakan-house-v2", build_peranakan, (0, -1, 3.0), (10, -14, 8), 5.2, True),
    ("kampong-house-v2", build_kampong, (0, -.5, 3.0), (11, -15, 9), 5.6, True),
    ("hdb-voiddeck-v2", build_voiddeck, (0, -.5, 3.6), (12, -16, 10), 6.6, True),
    ("kampong-props-v2", build_kampong_props, (-.3, -.2, 2.0), (8, -11, 7), 4.6, False),
    ("sultan-mosque-v2", build_sultan_mosque, (0, -.5, 4.0), (13, -17, 11), 7.0, True),
    ("wetmarket-v2", build_wetmarket, (0, 0, 2.2), (12, -15, 9), 6.4, True),
]

if __name__ == "__main__":
    only = set()
    for arg in sys.argv[1:]:
        if arg.startswith("--only="):
            only = set(arg.split("=", 1)[1].split(","))
    for slug, builder, target, camera, ground, join in ASSET_JOBS:
        if only and slug not in only:
            continue
        reset()
        root = builder()
        export_asset(root, slug, target, camera, ground, join=join)
    print("Heritage pack complete")
