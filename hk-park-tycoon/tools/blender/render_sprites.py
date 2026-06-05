"""
HK Theme Park Tycoon - procedural sprite renderer (headless Blender).

Builds simple, recognizable procedural geometry for park objects and renders
top-down 3/4 sprites to transparent PNGs via Cycles (CPU, headless-safe).

Single object:
  blender -b --python render_sprites.py -- --archetype ferris --accent cyan \
      --out public/sprites/rides/harbour-ferris-wheel.png --size 512 --samples 96

Whole manifest (one Blender session, many renders):
  blender -b --python render_sprites.py -- --manifest tools/blender/manifest.json
"""

import bpy
import sys
import json
import math
import mathutils


# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

def get_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default="")
    p.add_argument("--archetype", default="stall")
    p.add_argument("--accent", default="cyan")
    p.add_argument("--out", default="")
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--elevation", type=float, default=58.0)
    p.add_argument("--azimuth", type=float, default=45.0)
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Palette (HK neon-noir)
# ---------------------------------------------------------------------------

PALETTE = {
    "dark": (0.06, 0.07, 0.12),
    "jade": (0.05, 0.5, 0.42),
    "red": (0.75, 0.12, 0.12),
    "gold": (0.95, 0.75, 0.18),
    "cyan": (0.03, 0.85, 0.84),
    "magenta": (0.95, 0.18, 0.55),
    "teal": (0.10, 0.55, 0.55),
    "stone": (0.30, 0.32, 0.38),
    "wood": (0.45, 0.28, 0.16),
    "white": (0.92, 0.92, 0.95),
    "water": (0.10, 0.35, 0.65),
    "green": (0.18, 0.42, 0.22),
}


def col(name_or_rgb):
    if isinstance(name_or_rgb, (list, tuple)):
        return tuple(name_or_rgb)
    return PALETTE.get(name_or_rgb, (0.5, 0.5, 0.5))


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


def cube(name, scale, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(material)
    return o


def cyl(name, radius, depth, loc, material, verts=40, rot=(0, 0, 0)):
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
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=20, ring_count=10)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def cone(name, r1, depth, loc, material, verts=28):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=0.0, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o


# ---------------------------------------------------------------------------
# Builders — each builds around the origin, ~2-3 unit footprint.
# `a` is the accent rgb (the neon-glow colour).
# ---------------------------------------------------------------------------

def build_stall(a):
    base = mat("base", a, rough=0.5)
    roof = mat("roof", "gold" and col("gold"), rough=0.4)
    counter = mat("counter", col("wood"))
    sign = mat("sign", a, emission=4.0, emission_color=a)
    cube("body", (1.4, 1.0, 0.9), (0, 0, 0.45), base)
    cube("counter", (1.5, 0.3, 0.35), (0, -0.7, 0.32), counter)
    cube("roof", (1.8, 1.4, 0.18), (0, 0, 1.0), roof, rot=(math.radians(4), 0, 0))
    cube("roof2", (1.2, 0.95, 0.14), (0, 0, 1.22), roof)
    cube("sign", (1.0, 0.08, 0.34), (0, -0.55, 1.05), sign)


def build_carousel(a):
    plat = mat("plat", col("teal"), rough=0.4)
    pole = mat("pole", col("gold"), metallic=0.8, rough=0.3)
    canopy = mat("canopy", col("red"), rough=0.4)
    horse = mat("horse", col("white"))
    trim = mat("trim", a, emission=3.0, emission_color=a)
    cyl("platform", 1.5, 0.3, (0, 0, 0.15), plat)
    cyl("pole", 0.1, 2.4, (0, 0, 1.3), pole)
    cone("canopy", 1.45, 0.7, (0, 0, 2.55), canopy)
    torus("trim", 1.4, 0.07, (0, 0, 2.2), trim)
    for i in range(6):
        ang = math.radians(i * 60)
        x, y = 1.3 * math.cos(ang), 1.3 * math.sin(ang)
        cyl("hp%d" % i, 0.04, 1.6, (x, y, 1.1), pole)
        cube("horse%d" % i, (0.35, 0.16, 0.3), (x, y, 1.5), horse, rot=(0, 0, ang + math.pi / 2))


def build_ferris(a):
    frame = mat("frame", col("stone"), metallic=0.6, rough=0.4)
    ring = mat("ring", a, emission=3.5, emission_color=a)
    cabin = mat("cabin", col("gold"), rough=0.4)
    R = 1.5
    torus("wheel", R, 0.07, (0, 0, R + 0.2), ring, rot=(math.radians(90), 0, 0))
    torus("wheel2", R * 0.66, 0.05, (0, 0, R + 0.2), ring, rot=(math.radians(90), 0, 0))
    for i in range(4):
        ang = i * 45
        s = cyl("spoke%d" % i, 0.025, 2 * R, (0, 0, R + 0.2), frame)
        s.rotation_euler = (0, math.radians(90 - ang), 0)
    cyl("hub", 0.18, 0.3, (0, 0, R + 0.2), frame, rot=(math.radians(90), 0, 0))
    for i in range(8):
        ang = math.radians(i * 45)
        cube("cabin%d" % i, (0.28, 0.22, 0.28), (R * math.cos(ang), 0, R + 0.2 + R * math.sin(ang)), cabin)
    cube("legL", (0.12, 0.12, 2.2), (-0.9, 0, 1.0), frame)
    cube("legR", (0.12, 0.12, 2.2), (0.9, 0, 1.0), frame)
    cube("base", (2.4, 0.5, 0.2), (0, 0, 0.1), frame)


def build_coaster(a):
    track = mat("track", a, emission=2.6, emission_color=a)
    support = mat("support", col("stone"), metallic=0.5)
    base = mat("base", col("dark"))
    cube("base", (2.2, 2.2, 0.12), (0, 0, 0.06), base)
    pts = [(-1.6, -1.2, 0.5), (-0.8, -0.4, 1.5), (0.0, 0.4, 0.8), (0.8, 1.0, 1.7), (1.6, 1.4, 0.7)]
    for i, p in enumerate(pts):
        cube("sup%d" % i, (0.07, 0.07, p[2]), (p[0], p[1], p[2] / 2), support)
    # rails as tubes connecting points
    for i in range(len(pts) - 1):
        x0, y0, z0 = pts[i]
        x1, y1, z1 = pts[i + 1]
        mid = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        v = mathutils.Vector((x1 - x0, y1 - y0, z1 - z0))
        length = v.length
        r = cyl("rail%d" % i, 0.06, length, mid, track)
        r.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
    sphere("car", 0.18, pts[1], track)


def build_drop_tower(a):
    base = mat("base", col("dark"))
    mast = mat("mast", col("stone"), metallic=0.6)
    glow = mat("glow", a, emission=3.0, emission_color=a)
    car = mat("car", col("gold"))
    cube("base", (1.6, 1.6, 0.2), (0, 0, 0.1), base)
    cyl("mast", 0.16, 3.4, (0, 0, 1.8), mast)
    for z in (0.9, 1.7, 2.5, 3.2):
        torus("ring%.0f" % (z * 10), 0.3, 0.04, (0, 0, z), glow)
    cube("car", (0.7, 0.7, 0.3), (0, 0.0, 2.4), car)
    cube("seatglow", (0.72, 0.1, 0.32), (0, 0.36, 2.4), glow)


def build_spinner(a):
    plat = mat("plat", col("teal"), rough=0.4)
    cupc = mat("cup", a, emission=1.6, emission_color=a)
    rim = mat("rim", col("gold"), metallic=0.7)
    cyl("platform", 1.5, 0.3, (0, 0, 0.15), plat)
    torus("rim", 1.5, 0.06, (0, 0, 0.32), rim)
    for i in range(4):
        ang = math.radians(i * 90 + 45)
        x, y = 0.85 * math.cos(ang), 0.85 * math.sin(ang)
        c = cyl("cup%d" % i, 0.42, 0.5, (x, y, 0.55), cupc)
        c.scale = (1, 1, 1)


def build_boat(a):
    water = mat("water", col("water"), rough=0.2, emission=0.25, emission_color=col("water"))
    hull = mat("hull", col("wood"))
    sail = mat("sail", col("red"), rough=0.5)
    glow = mat("glow", a, emission=2.5, emission_color=a)
    cyl("pool", 1.6, 0.18, (0, 0, 0.09), water, verts=48)
    h = cube("hull", (1.6, 0.6, 0.4), (0, 0, 0.42), hull)
    h.rotation_euler = (0, math.radians(-6), 0)
    cube("cabin", (0.7, 0.5, 0.35), (0.1, 0, 0.7), hull)
    cyl("mast", 0.05, 1.4, (-0.2, 0, 1.1), hull)
    cube("sail", (0.05, 0.5, 0.8), (-0.2, 0, 1.2), sail)
    cube("trim", (1.62, 0.06, 0.08), (0, 0.3, 0.5), glow)


def build_train(a):
    base = mat("base", col("green"))
    rail = mat("rail", col("stone"), metallic=0.6)
    loco = mat("loco", col("red"))
    glow = mat("glow", a, emission=2.5, emission_color=a)
    cube("base", (2.2, 2.2, 0.12), (0, 0, 0.06), base)
    torus("track", 1.4, 0.05, (0, 0, 0.2), rail)
    # loco + 2 carriages along the track
    for i, (ang, m) in enumerate([(0, loco), (40, glow), (80, loco)]):
        r = math.radians(ang)
        x, y = 1.4 * math.cos(r), 1.4 * math.sin(r)
        cube("car%d" % i, (0.5, 0.32, 0.34), (x, y, 0.42), m, rot=(0, 0, r + math.pi / 2))
    cyl("funnel", 0.08, 0.3, (1.4, 0.0, 0.7), glow)


def build_scaffold(a):
    pole = mat("pole", col("gold"), rough=0.5)
    glow = mat("glow", a, emission=2.2, emission_color=a)
    base = mat("base", col("dark"))
    cube("base", (1.8, 1.8, 0.15), (0, 0, 0.07), base)
    for sx in (-0.7, 0.7):
        for sy in (-0.7, 0.7):
            cyl("leg_%d_%d" % (sx * 10, sy * 10), 0.06, 3.0, (sx, sy, 1.6), pole)
    for z in (0.8, 1.6, 2.4, 3.0):
        cube("rungA%.0f" % (z * 10), (1.5, 0.05, 0.05), (0, 0.7, z), pole)
        cube("rungB%.0f" % (z * 10), (1.5, 0.05, 0.05), (0, -0.7, z), pole)
        cube("rungC%.0f" % (z * 10), (0.05, 1.5, 0.05), (0.7, 0, z), pole)
        cube("rungD%.0f" % (z * 10), (0.05, 1.5, 0.05), (-0.7, 0, z), pole)
    cube("flag", (0.5, 0.05, 0.3), (0, 0, 3.2), glow)


def build_maze(a):
    wall = mat("wall", col("stone"), rough=0.7)
    glow = mat("glow", a, emission=2.0, emission_color=a)
    base = mat("base", col("dark"))
    cube("base", (2.4, 2.4, 0.12), (0, 0, 0.06), base)
    segs = [
        (-0.8, -0.8, 1.6, 0.12), (0.8, -0.4, 0.12, 1.2), (-0.2, 0.2, 1.2, 0.12),
        (0.6, 0.8, 0.12, 1.0), (-0.9, 0.5, 0.12, 1.0), (0.2, -0.9, 0.12, 0.9),
    ]
    for i, (x, y, sx, sy) in enumerate(segs):
        cube("w%d" % i, (sx, sy, 0.6), (x, y, 0.36), wall)
    cube("gate", (0.5, 0.1, 0.7), (0, -1.2, 0.42), glow)


def build_lantern(a):
    body = mat("body", col("red"), emission=2.6, emission_color=(1.0, 0.3, 0.2))
    cap = mat("cap", col("gold"), metallic=0.7)
    s = sphere("lantern", 0.6, (0, 0, 0.9), body)
    s.scale = (1.0, 1.0, 1.15)
    cyl("capTop", 0.25, 0.12, (0, 0, 1.55), cap)
    cyl("capBot", 0.25, 0.12, (0, 0, 0.28), cap)


def build_fountain(a):
    stone = mat("stone", col("stone"), rough=0.6)
    water = mat("water", col("water"), emission=0.6, emission_color=a)
    cyl("basin", 1.1, 0.4, (0, 0, 0.2), stone, verts=40)
    cyl("water", 1.0, 0.1, (0, 0, 0.42), water, verts=40)
    cyl("tier", 0.5, 0.4, (0, 0, 0.6), stone)
    cyl("water2", 0.42, 0.08, (0, 0, 0.82), water)
    cyl("jet", 0.06, 0.7, (0, 0, 1.1), water)


def build_bonsai(a):
    pot = mat("pot", col("red"), rough=0.6)
    trunk = mat("trunk", col("wood"))
    leaf = mat("leaf", col("jade"), emission=0.3, emission_color=col("jade"))
    cyl("pot", 0.45, 0.4, (0, 0, 0.2), pot)
    cyl("trunk", 0.08, 0.7, (0, 0, 0.7), trunk)
    sphere("leafA", 0.45, (0.1, 0, 1.1), leaf)
    sphere("leafB", 0.3, (-0.25, 0.1, 0.95), leaf)


def build_stone_lion(a):
    stone = mat("stone", col("stone"), rough=0.7)
    glow = mat("glow", a, emission=1.5, emission_color=a)
    cube("plinth", (0.9, 0.6, 0.4), (0, 0, 0.2), stone)
    cube("body", (0.7, 0.4, 0.6), (0, 0, 0.7), stone)
    sphere("head", 0.32, (0, 0.3, 1.0), stone)
    sphere("eye", 0.06, (0.12, 0.55, 1.05), glow)


def build_neon_sign(a):
    pole = mat("pole", col("stone"), metallic=0.6)
    n1 = mat("n1", a, emission=5.0, emission_color=a)
    n2 = mat("n2", col("magenta"), emission=5.0, emission_color=col("magenta"))
    cyl("pole", 0.06, 2.0, (0, 0, 1.0), pole)
    torus("ring", 0.5, 0.06, (0, 0, 1.7), n1, rot=(math.radians(90), 0, 0))
    cube("bar", (0.06, 0.06, 0.8), (0.0, 0, 1.2), n2)
    cube("bar2", (0.5, 0.06, 0.06), (0.25, 0, 0.9), n1)


def build_bamboo_garden(a):
    soil = mat("soil", col("wood"), rough=0.8)
    stalk = mat("stalk", col("jade"), emission=0.25, emission_color=col("jade"))
    cube("soil", (1.4, 1.4, 0.16), (0, 0, 0.08), soil)
    import random
    random.seed(7)
    for i in range(7):
        x = random.uniform(-0.5, 0.5)
        y = random.uniform(-0.5, 0.5)
        h = random.uniform(1.2, 2.0)
        cyl("stalk%d" % i, 0.05, h, (x, y, h / 2 + 0.1), stalk, verts=8)


def build_tile(color):
    def _b(a):
        m = mat("tile", col(color), rough=0.75, emission=(0.3 if color == "water" else 0.0), emission_color=col(color))
        cube("tile", (2.0, 2.0, 0.12), (0, 0, 0.06), m)
    return _b


ARCHETYPES = {
    "stall": build_stall,
    "carousel": build_carousel,
    "ferris": build_ferris,
    "coaster": build_coaster,
    "drop_tower": build_drop_tower,
    "spinner": build_spinner,
    "boat": build_boat,
    "train": build_train,
    "scaffold": build_scaffold,
    "maze": build_maze,
    "lantern": build_lantern,
    "fountain": build_fountain,
    "bonsai": build_bonsai,
    "stone_lion": build_stone_lion,
    "neon_sign": build_neon_sign,
    "bamboo_garden": build_bamboo_garden,
    "tile-grass": build_tile("green"),
    "tile-path": build_tile("wood"),
    "tile-water": build_tile("water"),
}


# ---------------------------------------------------------------------------
# Camera / lights / render
# ---------------------------------------------------------------------------

def scene_bounds():
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


def setup_camera(elevation, azimuth):
    mn, mx = scene_bounds()
    center = (mn + mx) / 2
    extent = max((mx - mn).x, (mx - mn).y, (mx - mn).z)
    target = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(target)
    target.location = center
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = extent * 1.5
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    el = math.radians(elevation)
    az = math.radians(azimuth)
    cam.location = center + mathutils.Vector((
        12 * math.cos(el) * math.cos(az),
        12 * math.cos(el) * math.sin(az),
        12 * math.sin(el),
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
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.02, 0.02, 0.04, 1.0)
    bg.inputs[1].default_value = 0.4
    bpy.context.scene.world = world


def setup_render(size, samples):
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


def render_one(archetype, accent, out, size, samples, elevation, azimuth):
    clear_scene()
    builder = ARCHETYPES.get(archetype)
    if builder is None:
        print("Unknown archetype: %s" % archetype)
        return
    builder(col(accent))
    setup_camera(elevation, azimuth)
    setup_lights()
    setup_render(size, samples)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print("RENDERED -> %s" % out)


def main():
    args = get_args()
    if args.manifest:
        with open(args.manifest) as f:
            items = json.load(f)
        for it in items:
            render_one(
                it["archetype"], it.get("accent", "cyan"), it["out"],
                it.get("size", args.size), it.get("samples", args.samples),
                it.get("elevation", args.elevation), it.get("azimuth", args.azimuth),
            )
    else:
        render_one(args.archetype, args.accent, args.out, args.size, args.samples,
                   args.elevation, args.azimuth)


main()
