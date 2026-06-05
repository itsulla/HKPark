# Blender sprite pipeline (headless)

Procedurally builds simple park objects and renders them to transparent PNG
sprites with a neon-noir HK look. Runs **headless** (no GPU/display needed) via
Cycles CPU — ~2s per sprite.

## Setup (already done on the build VPS)

Blender 4.5 was extracted to `~/blender/` (official tarball, no sudo). To install
elsewhere:

```bash
curl -sL -o blender.tar.xz \
  https://download.blender.org/release/Blender4.5/blender-4.5.9-linux-x64.tar.xz
tar xf blender.tar.xz && mv blender-4.5.9-linux-x64 ~/blender
```

## Render

```bash
~/blender/blender --background --python tools/blender/render_sprites.py -- \
  --object ferris --out public/sprites/rides/harbour-ferris-wheel.png \
  --size 512 --samples 96 --elevation 58 --azimuth 45
```

Objects: `stall`, `carousel`, `ferris`, `coaster`, `lantern`, `tile-grass`,
`tile-path`, `tile-water`. Add more by writing a `build_*()` function and
registering it in `BUILDERS`.

## Quality note

These are **procedural placeholders** — recognizable, consistent, and free, but
not artist-quality. For premium art, generate real 3D models (AI-3D tools like
Meshy/Tripo, or an artist) as `.glb` and render them through the same
camera/light rig instead of the procedural builders.
