"""Render imported GLB models into game sprites (HK neon-noir rig).

Usage:
  blender -b -P render_glb.py -- --manifest glb_manifest.json

Manifest entries:
  { "glb": "/path/model.glb", "out": "/path/sprite.png",
    "size": 1024, "samples": 96, "elevation": 58, "azimuth": 45,
    "tint": "stone" }            # optional: lerp materials toward a palette colour

Reuses the same camera framing, three-point neon lighting, and Cycles
settings as render_sprites.py so CC0 imports sit in the same visual world
as the procedural placeholders they replace. A shadow-catcher floor keeps a
soft contact shadow in the transparent PNG.
"""
import json
import math
import sys

import bpy
import mathutils

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

def get_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True)
    p.add_argument("--size", type=int, default=1024)
    p.add_argument("--samples", type=int, default=96)
    # 3/4 isometric view: lower elevation than the procedural archetypes so
    # imported models read as side-on objects, not top-down.
    p.add_argument("--elevation", type=float, default=32.0)
    p.add_argument("--azimuth", type=float, default=40.0)
    return p.parse_args(argv)


PALETTE = {
    "jade": (0.05, 0.5, 0.42),
    "red": (0.75, 0.12, 0.12),
    "gold": (0.95, 0.75, 0.18),
    "cyan": (0.03, 0.85, 0.84),
    "magenta": (0.95, 0.18, 0.55),
    "stone": (0.30, 0.32, 0.38),
    "green": (0.18, 0.42, 0.22),
    "orange": (0.95, 0.45, 0.10),
    "blue": (0.12, 0.35, 0.80),
    "purple": (0.55, 0.20, 0.75),
}

# ---------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.lights,
        bpy.data.cameras,
        bpy.data.images,
        bpy.data.armatures,
    ):
        for block in list(coll):
            try:
                coll.remove(block)
            except Exception:
                pass


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    # Apply transforms so bounds are correct, then sit the model on z=0.
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in meshes:
        o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        try:
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        except Exception:
            pass  # rigged/linked meshes can refuse; bounds still work via matrix_world
    mn, _ = scene_bounds()
    for o in meshes:
        if o.parent is None:
            o.location.z -= mn.z


def pick_pose():
    actions = list(bpy.data.actions)
    if not actions:
        return
    def score(a):
        n = a.name.lower()
        if "idle" in n:
            return 0
        if "walk" in n:
            return 1
        return 2
    actions.sort(key=score)
    chosen = actions[0]
    for o in bpy.context.scene.objects:
        if o.type == "ARMATURE":
            if o.animation_data is None:
                o.animation_data_create()
            o.animation_data.action = chosen
    start, end = chosen.frame_range
    bpy.context.scene.frame_set(int((start + end) / 2))
    print("POSE: %s (frame %d)" % (chosen.name, int((start + end) / 2)))


def tint_materials(color, amount=0.45):
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue
        base = b.inputs["Base Color"].default_value
        b.inputs["Base Color"].default_value = (
            base[0] * (1 - amount) + color[0] * amount,
            base[1] * (1 - amount) + color[1] * amount,
            base[2] * (1 - amount) + color[2] * amount,
            1.0,
        )


def add_shadow_catcher():
    mn, mx = scene_bounds()
    extent = max((mx - mn).x, (mx - mn).y, 1.0)
    bpy.ops.mesh.primitive_plane_add(size=extent * 4, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.is_shadow_catcher = True


def scene_bounds():
    mn = mathutils.Vector((1e9, 1e9, 1e9))
    mx = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in bpy.context.scene.objects:
        if o.type != "MESH" or getattr(o, "is_shadow_catcher", False):
            continue
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            mn = mathutils.Vector((min(mn[i], w[i]) for i in range(3)))
            mx = mathutils.Vector((max(mx[i], w[i]) for i in range(3)))
    return mn, mx


# ---------------------------------------------------------------------------
# Camera / lights / render (same rig as render_sprites.py)
# ---------------------------------------------------------------------------

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
    dist = max(extent * 3, 12)
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
    mn, mx = scene_bounds()
    extent = max((mx - mn).x, (mx - mn).y, (mx - mn).z, 1.0)
    s = extent / 4.0  # scale light positions with the model
    rim = bpy.data.lights.new("Rim", "AREA")
    rim.energy = 220 * s * s
    rim.color = (0.2, 0.9, 1.0)
    rim.size = 6 * s
    ro = bpy.data.objects.new("Rim", rim)
    bpy.context.collection.objects.link(ro)
    ro.location = (-4 * s, -5 * s, 5 * s)
    ro.rotation_euler = (math.radians(45), 0, math.radians(-30))
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 90 * s * s
    fill.color = (1.0, 0.4, 0.7)
    fill.size = 8 * s
    fo = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (5 * s, 4 * s, 3 * s)
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


def render_one(item, defaults):
    clear_scene()
    import_glb(item["glb"])
    # Animated models: pick a sensible pose. Prefer an "Idle" action (these
    # models often import with many clips and the default frame can land
    # mid-fall or mid-attack), then sample the middle of its range.
    if item.get("pose"):
        pick_pose()
    tint = item.get("tint")
    if tint and tint in PALETTE:
        tint_materials(PALETTE[tint], item.get("tint_amount", 0.45))
    setup_camera(
        item.get("elevation", defaults.elevation),
        item.get("azimuth", defaults.azimuth),
    )
    setup_lights()
    setup_render(item.get("size", defaults.size), item.get("samples", defaults.samples))
    bpy.context.scene.render.filepath = item["out"]
    bpy.ops.render.render(write_still=True)
    print("RENDERED -> %s" % item["out"])


def main():
    args = get_args()
    with open(args.manifest) as f:
        items = json.load(f)
    for item in items:
        try:
            render_one(item, args)
        except Exception as e:
            print("FAILED %s: %s" % (item.get("glb"), e))


main()
