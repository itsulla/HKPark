# HK Theme Park Tycoon

A browser-based theme park tycoon game set in neon-noir Hong Kong — and a
native advertising platform underneath.

## The three layers

1. **Layer 1 — The game.** A RollerCoaster Tycoon-style management sim:
   build paths, rides, and shops; hire staff; manage finances, weather,
   breakdowns, and park rating. Built with Next.js 14, PixiJS 8, and
   Zustand.
2. **Layer 2 — AI VIP guests.** Named influencer personas occasionally visit
   the park and post commentary to the VIP feed. When a sponsor matching a
   persona's brand affinity is active, their commentary organically mentions
   the brand (tagged "✦ Sponsored").
3. **Layer 3 — Sponsorship surfaces.** Rides, shops, and districts can be
   branded by sponsor campaigns (`src/data/sponsors.json`). Every view,
   click, and VIP mention is batched client-side and logged server-side as
   JSONL for reporting.

## Quick start

```bash
bun install        # npm has a peer-dep conflict (@pixi/react wants React 19)
bun run dev        # http://localhost:3000
```

Production:

```bash
bun run build
bun run start
```

## Environment variables

| Variable          | Purpose                                              | Default                        |
|-------------------|------------------------------------------------------|--------------------------------|
| `IMPRESSIONS_LOG` | Path of the append-only impressions JSONL log        | `$TMPDIR/hk-impressions.jsonl` |
| `ADMIN_TOKEN`     | Bearer token for `/admin` + `/api/admin/stats`. Unset = admin disabled (fail closed). | unset |

For production, point `IMPRESSIONS_LOG` at persistent storage — the default
tmpdir does not survive reboots or redeploys.

## Key routes

| Route                | What it is                                          |
|----------------------|-----------------------------------------------------|
| `/`                  | Landing page (new game / continue / load)           |
| `/game`              | The game itself                                     |
| `/admin`             | Sponsor impressions dashboard (token-gated)         |
| `/api/sponsors`      | Active sponsor campaigns (public, cached, filtered) |
| `/api/impressions`   | Impression ingestion (rate-limited, validated)      |
| `/api/admin/stats`   | Aggregated impression stats (Bearer-token auth)     |

## Architecture

```
src/
├── engine/            # Pure simulation (no React/Pixi imports)
│   ├── core/          #   GameLoop (tick/day/month/year), EventBus
│   ├── simulation/    #   Guest/Ride/Staff/Economy/Weather/VIP managers, ParkRating
│   └── world/         #   Grid, A* Pathfinder, District
├── state/             # Zustand store (single source of truth) + save manager
├── renderer/          # PixiJS canvas, camera, layers (terrain/buildings/guests/staff/ambient)
├── sponsors/          # SponsorManager, ImpressionTracker, default branding
├── ui/                # React HUD (toolbar, panels, pickers, overlays)
├── app/               # Next.js pages + API routes
└── data/              # JSON definitions: rides, shops, staff, districts, vips, sponsors
```

**Simulation flow per tick:** the game loop clones store entities
(`structuredClone`), runs all managers on the mutable clones, then commits
everything back in a single `applySimulationResult` store update. Sim-owned
fields (queues, riders, revenue) are merged; player-owned fields (status,
ticket price) are never clobbered.

**Game pacing:** 1 tick = 100 ms at normal speed, 30 ticks = 1 day,
30 days = 1 month, 12 months = 1 year.

## Gameplay systems

- **Guests** — needs (hunger/thirst/energy/nausea), cash, age-restricted
  rides, pathfinding, happiness; tinted sprites by mood.
- **Staff** — janitors clean litter, mechanics walk to and repair broken
  rides, security guards and entertainers boost happiness of nearby guests
  (aura radius). Hire/fire from the Staff toolbar panel (`7`).
- **Weather** — seasonal probabilities; rain/typhoon reduce guest spawns and
  outdoor ride excitement; typhoons close the park. Visual rain + darkening.
- **Random events** — Festival Season, Holiday Rush, Celebrity Visit, Health
  Inspection (fines a dirty park); shown in the objectives widget.
- **Ride ratings** — recalculated daily from definition base values +
  scenery bonus + ride proximity + age decay + weather.
- **Win/lose** — victory at rating ≥ 800, HK$1M cash, and 1,000 lifetime
  guests; bankruptcy after 30 consecutive days in debt.
- **Day/night cycle** — ambient tint cycles over ~20 game days; nights make
  the neon pop.

## Asset pipeline

Sprites live in `public/sprites/{rides,shops,decorations,characters,tiles}/`
named by entity definition id (e.g. `rides/dragon-coaster.png`). The
renderer auto-loads them and falls back to coloured rects when missing.

- Art direction + all 26 generation prompts: `../docs/art-direction.md`
- Import pipeline (bg removal, crop, resize, install): `~/incoming-art/process.py`
- Procedural placeholder generator (headless Blender): `tools/blender/`

## Saves

IndexedDB via the save manager — auto-save every 60 s plus manual slots.
Versioned full-state snapshots; in-flight guests are normalized on load.

## Remaining work

- Audio (Howler.js is installed but unused — needs sound assets)
- Final art for 11 rides, 6 shops, 4 decorations, 4 staff types
  (see `../docs/art-direction.md`)
- Test suite
- Touch controls / mobile layout
- Sponsor self-serve portal + billing (currently sponsors.json + dashboard)
