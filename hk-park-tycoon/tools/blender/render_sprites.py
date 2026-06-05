"""
HK Theme Park Tycoon — procedural sprite renderer (headless Blender).

Builds simple, recognizable procedural geometry for park objects and renders a
top-down-ish sprite to a transparent PNG via Cycles (CPU, headless-safe).

Usage:
  blender --background --python render_sprites.py -- \
      --object ferris --out public/sprites/rides/harbour-ferris-wheel.png \
      --size 512 --samples 96 --elevation 58 --azimuth 45

Objects: stall, carousel, ferris, coaster, lantern, tile-grass, tile-path, tile-water
"""

import bpy
import sys
import math
import argparse


# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

def get_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--object", default="stall")
    p.add_argument("--out", required=True)
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--elevation", type=float, default=58.0)  # deg above horizon
    p.add_argument("--azimuth", type=float, default=45.0)    # deg around Z
    p.add_argument("--orthoscale", type=float, default=0.0)  # 0 = auto-fit
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            coll.remove(block)


def mat(name, color, rough=0.55, metallic=0.0, emission=0.0, emission_color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emission > 0:
        ec = emission_color or color
        b.inputs["Emission Color"].default_value = (*ec, 1.0)
        b.inputs["Emission Strength"].default_value = emission
    return m


def cube(name, scale, loc, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(material)
    return o


def cylinder(name, radius, depth, loc, material, verts=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o


def torus(name, major, minor, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o


def sphere(name, radius, loc, material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=24, ring_count=12)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


# HK neon-noir palette
DARK = (0.06, 0.07, 0.12)
JADE = (0.05, 0.5, 0.42)
RED = (0.75, 0.12, 0.12)
GOLD = (0.95, 0.75, 0.18)
CYAN = (0.03, 0.85, 0.84)
MAGENTA = (0.95, 0.18, 0.55)
TEAL = (0.10, 0.55, 0.55)
STONE = (0.30, 0.32, 0.38)
WOOD = (0.45, 0.28, 0.16)


# ---------------------------------------------------------------------------
# Procedural builders (each builds around origin, ~2-unit footprint)
# ---------------------------------------------------------------------------

def build_stall():
    base = mat("base", RED, rough=0.5)
    roof = mat("roof", GOLD, rough=0.4)
    counter = mat("counter", WOOD)
    sign = mat("sign", CYAN, emission=4.0, emission_color=CYAN)
    cube("body", (1.4, 1.0, 0.9), (0, 0, 0.45), base)
    cube("counter", (1.5, 0.3, 0.35), (0, -0.7, 0.32), counter)
    # slanted pagoda-ish roof (two stacked, rotated cubes)
    r = cube("roof", (1.8, 1.4, 0.18), (0, 0, 1.0), roof)
    r.rotation_euler = (math.radians(4), 0, 0)
    cube("roof2", (1.2, 0.95, 0.14), (0, 0, 1.22), roof)
    cube("sign", (1.0, 0.08, 0.34), (0, -0.55, 1.05), sign)


def build_carousel():
    plat = mat("plat", TEAL, rough=0.4)
    pole = mat("pole", GOLD, metallic=0.8, rough=0.3)
    canopy = mat("canopy", RED, rough=0.4)
    horse = mat("horse", (0.9, 0.9, 0.95))
    trim = mat("trim", MAGENTA, emission=3.0, emission_color=MAGENTA)
    cylinder("platform", 1.5, 0.3, (0, 0, 0.15), plat)
    cylinder("pole", 0.1, 2.4, (0, 0, 1.3), pole)
    # conical canopy, lifted and narrowed so the horses below stay visible
    bpy.ops.mesh.primitive_cone_add(radius1=1.45, radius2=0.0, depth=0.7, location=(0, 0, 2.55), vertices=32)
    c = bpy.context.active_object
    c.name = "canopy"
    c.data.materials.append(canopy)
    torus("trim", 1.4, 0.07, (0, 0, 2.2), trim)
    # horses on poles around the rim, tall enough to read from above
    for i in range(6):
        a = math.radians(i * 60)
        x, y = 1.3 * math.cos(a), 1.3 * math.sin(a)
        cylinder("pole%d" % i, 0.04, 1.6, (x, y, 1.1), pole)
        b = cube("horse%d" % i, (0.35, 0.16, 0.3), (x, y, 1.5), horse)
        b.rotation_euler = (0, 0, a + math.pi / 2)


def build_ferris():
    frame = mat("frame", STONE, metallic=0.6, rough=0.4)
    ring = mat("ring", CYAN, emission=3.5, emission_color=CYAN)
    cabin = mat("cabin", GOLD, rough=0.4)
    R = 1.5
    torus("wheel", R, 0.07, (0, 0, R + 0.2), ring, rot=(math.radians(90), 0, 0))
    torus("wheel2", R * 0.66, 0.05, (0, 0, R + 0.2), ring, rot=(math.radians(90), 0, 0))
    # spokes — radiate in the wheel's XZ plane (cylinder +Z aligned to the rim)
    for i in range(4):
        a = i * 45
        spoke = cylinder("spoke%d" % i, 0.025, 2 * R, (0, 0, R + 0.2), frame)
        spoke.rotation_euler = (0, math.radians(90 - a), 0)
    cylinder("hub", 0.18, 0.3, (0, 0, R + 0.2), frame, rot=(math.radians(90), 0, 0))
    # cabins around the rim
    for i in range(8):
        a = math.radians(i * 45)
        cube("cabin%d" % i, (0.28, 0.22, 0.28), (R * math.cos(a), 0, R + 0.2 + R * math.sin(a)), cabin)
    # A-frame supports
    cube("legL", (0.12, 0.12, 2.2), (-0.9, 0, 1.0), frame)
    cube("legR", (0.12, 0.12, 2.2), (0.9, 0, 1.0), frame)
    cube("base", (2.4, 0.5, 0.2), (0, 0, 0.1), frame)


def build_coaster():
    track = mat("track", MAGENTA, emission=2.5, emission_color=MAGENTA)
    support = mat("support", STONE, metallic=0.5)
    base = mat("base", DARK)
    cube("base", (2.0, 2.0, 0.12), (0, 0, 0.06), base)
    # a wavy track from a series of torus arcs / cylinders
    pts = [(-1.6, -1.2, 0.5), (-0.8, -0.4, 1.4), (0.0, 0.4, 0.7), (0.8, 1.0, 1.6), (1.6, 1.4, 0.6)]
    for i, p in enumerate(pts):
        sphere("car%d" % i, 0.16, p, track)
        cube("sup%d" % i, (0.07, 0.07, p[2]), (p[0], p[1], p[2] / 2), support)
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
        cylinder("rail%d" % i, 0.05, 1.2, mid, track)


def build_lantern():
    body = mat("body", RED, emission=2.5, emission_color=(1.0, 0.3, 0.2))
    cap = mat("cap", GOLD, metallic=0.7)
    s = sphere("lantern", 0.6, (0, 0, 0.9), body)
    s.scale = (1.0, 1.0, 1.15)
    cylinder("capTop", 0.25, 0.12, (0, 0, 1.55), cap)
    cylinder("capBot", 0.25, 0.12, (0, 0, 0.28), cap)
    cylinder("pole", 0.05, 0.6, (0, 0, 0.0), cap)


def build_tile(color, emission=0.0):
    m = mat("tile", color, rough=0.7, emission=emission, emission_color=color)
    t = cube("tile", (2.0, 2.0, 0.12), (0, 0, 0.06), m)
    return t


BUILDERS = {
    "stall": build_stall,
    "carousel": build_carousel,
    "ferris": build_ferris,
    "coaster": build_coaster,
    "lantern": build_lantern,
    "tile-grass": lambda: build_tile((0.18, 0.42, 0.22)),
    "tile-path": lambda: build_tile((0.55, 0.45, 0.30)),
    "tile-water": lambda: build_tile((0.10, 0.35, 0.65), emission=0.3),
}


# ---------------------------------------------------------------------------
# Camera, lights, render
# ---------------------------------------------------------------------------

def scene_bounds():
    import mathutils
    mn = mathutils.Vector((1e9, 1e9, 1e9))
    mx = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            mn = mathutils.Vector((min(mn[i], w[i]) for i in range(3)))
            mx = mathutils.Vector((max(mx[i], w[i]) for i in range(3)))
    return mn, mx


def setup_camera(elevation, azimuth, orthoscale):
    import mathutils
    mn, mx = scene_bounds()
    center = (mn + mx) / 2
    extent = max((mx - mn).x, (mx - mn).y, (mx - mn).z)
    target = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(target)
    target.location = center

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = orthoscale if orthoscale > 0 else extent * 1.5
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    el = math.radians(elevation)
    az = math.radians(azimuth)
    dist = 12.0
    cam.location = center + mathutils.Vector((
        dist * math.cos(el) * math.cos(az),
        dist * math.cos(el) * math.sin(az),
        dist * math.sin(el),
    ))
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    bpy.context.scene.camera = cam


def setup_lights():
    key = bpy.data.lights.new("Key", "SUN")
    key.energy = 3.2
    key.angle = math.radians(8)
    ko = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(ko)
    ko.rotation_euler = (math.radians(50), math.radians(15), math.radians(40))
    # cyan rim + magenta fill for the neon-noir vibe
    rim = bpy.data.lights.new("Rim", "AREA")
    rim.energy = 220
    rim.color = (0.2, 0.9, 1.0)
    rim.size = 6
    ro = bpy.data.objects.new("Rim", rim)
    bpy.context.collection.objects.link(ro)
    ro.location = (-4, -5, 5)
    ro.rotation_euler = (math.radians(45), 0, math.radians(-30))
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 90
    fill.color = (1.0, 0.4, 0.7)
    fill.size = 8
    fo = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (5, 4, 3)
    # dim world ambient
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.02, 0.02, 0.04, 1.0)
    bg.inputs[1].default_value = 0.4
    bpy.context.scene.world = world


def setup_render(size, samples, out):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = out


def main():
    args = get_args()
    clear_scene()
    builder = BUILDERS.get(args.object)
    if builder is None:
        print("Unknown object: %s. Options: %s" % (args.object, ", ".join(BUILDERS)))
        sys.exit(1)
    builder()
    setup_camera(args.elevation, args.azimuth, args.orthoscale)
    setup_lights()
    setup_render(args.size, args.samples, args.out)
    bpy.ops.render.render(write_still=True)
    print("RENDERED -> %s" % args.out)


main()
