// =============================================================================
// HK Theme Park Tycoon - Guest Layer (optimized)
// =============================================================================
//
// Performance features:
//   - Object pooling: Graphics objects are pre-created and reused
//   - Avoid clearing/redrawing every frame: each pooled object caches its
//     last-drawn happiness bracket and radius so we only call clear()+circle()
//     when the visual actually changes
//   - Frustum culling: guests outside the viewport are hidden
//   - At low zoom (<0.8x), guests render as 2px dots instead of 4px
//   - Pool cap of 500 objects; excess guests beyond pool size are not drawn
// =============================================================================

import { Container, Graphics } from 'pixi.js';
import { Guest } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';

const POOL_SIZE = 500;

/** Happiness color brackets. */
const enum HappinessBracket {
  HIGH = 0,   // > 180  -> green
  MEDIUM = 1, // > 120  -> yellow
  LOW = 2,    // > 80   -> orange
  VERY_LOW = 3, //       -> red
}

const BRACKET_COLORS: Record<HappinessBracket, number> = {
  [HappinessBracket.HIGH]: 0x27ae60,
  [HappinessBracket.MEDIUM]: 0xf1c40f,
  [HappinessBracket.LOW]: 0xe67e22,
  [HappinessBracket.VERY_LOW]: 0xe74c3c,
};

function getHappinessBracket(happiness: number): HappinessBracket {
  if (happiness > 180) return HappinessBracket.HIGH;
  if (happiness > 120) return HappinessBracket.MEDIUM;
  if (happiness > 80) return HappinessBracket.LOW;
  return HappinessBracket.VERY_LOW;
}

/** Per-pool-entry cached state. */
interface PoolEntry {
  gfx: Graphics;
  lastBracket: HappinessBracket | -1;
  lastRadius: number;
}

export class GuestLayer extends Container {
  private pool: PoolEntry[] = [];

  constructor() {
    super();

    // Pre-create the pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const gfx = new Graphics();
      gfx.visible = false;
      this.addChild(gfx);
      this.pool.push({
        gfx,
        lastBracket: -1,
        lastRadius: -1,
      });
    }
  }

  /**
   * Update guest dot positions and colors.
   *
   * @param guests         - Record of all active guests
   * @param zoom           - current camera zoom level (affects dot size)
   * @param viewportBounds - visible region in tile coordinates for frustum culling
   */
  update(
    guests: Record<string, Guest>,
    zoom: number,
    viewportBounds: ViewportBounds,
  ): void {
    const radius = zoom < 0.8 ? 2 : 4;

    // Viewport bounds in tile coords (with a small margin)
    const vMinX = viewportBounds.x - 1;
    const vMinY = viewportBounds.y - 1;
    const vMaxX = viewportBounds.x + viewportBounds.w + 1;
    const vMaxY = viewportBounds.y + viewportBounds.h + 1;

    let poolIdx = 0;

    for (const guestId in guests) {
      if (poolIdx >= POOL_SIZE) break;

      const guest = guests[guestId];

      // Frustum culling: skip guests outside the visible area
      if (
        guest.x < vMinX ||
        guest.x > vMaxX ||
        guest.y < vMinY ||
        guest.y > vMaxY
      ) {
        continue;
      }

      const entry = this.pool[poolIdx];
      const bracket = getHappinessBracket(guest.happiness);

      // Only redraw the circle graphic when its visual properties change
      if (entry.lastBracket !== bracket || entry.lastRadius !== radius) {
        entry.gfx.clear();
        entry.gfx.circle(0, 0, radius);
        entry.gfx.fill({ color: BRACKET_COLORS[bracket] });
        entry.lastBracket = bracket;
        entry.lastRadius = radius;
      }

      // Position update is cheap (just sets x/y transform, no GPU work)
      entry.gfx.x = guest.x * TILE_SIZE + TILE_SIZE / 2;
      entry.gfx.y = guest.y * TILE_SIZE + TILE_SIZE / 2;
      entry.gfx.visible = true;

      poolIdx++;
    }

    // Hide unused pool entries
    for (let i = poolIdx; i < POOL_SIZE; i++) {
      const entry = this.pool[i];
      if (entry.gfx.visible) {
        entry.gfx.visible = false;
        // Reset cached state so next activation redraws
        entry.lastBracket = -1;
        entry.lastRadius = -1;
      }
    }
  }
}
