// =============================================================================
// HK Theme Park Tycoon - Guest Layer (sprite-based, pooled)
// =============================================================================
//
// Renders guests as tiny character sprites (loaded from /sprites/characters/
// guest.png). Falls back to coloured happiness-dots when the texture is missing.
//
// Performance:
//   - Sprite pool (POOL_SIZE cap) — no per-frame allocations
//   - Frustum culling — guests outside the viewport are hidden
//   - Tint-only updates — only the colour (happiness bracket) changes per frame;
//     the sprite/geometry is reused
//   - At very low zoom (<0.5×), guests render as 3px dots for clarity
// =============================================================================

import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { Guest } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';

const POOL_SIZE = 500;
const GUEST_SPRITE_SIZE = TILE_SIZE * 0.7; // 70% of a tile — visible but not overwhelming

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
  sprite: Sprite | null;    // character sprite (null until texture loads)
  gfx: Graphics;            // fallback dot
  vipBadge: Graphics;       // gold star shown above VIP guests
  lastBracket: HappinessBracket | -1;
}

const VIP_GOLD = 0xf0c040;

/** Draw a small 5-point star into a Graphics object centred at (0,0). */
function drawStar(gfx: Graphics, radius: number): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  gfx.poly(points);
  gfx.fill({ color: VIP_GOLD });
  gfx.poly(points);
  gfx.stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
}

export class GuestLayer extends Container {
  private pool: PoolEntry[] = [];
  private guestTexture: Texture | null = null;
  private textureReady = false;

  constructor() {
    super();
    // Pre-create the fallback pool (Graphics dots) and VIP badges
    for (let i = 0; i < POOL_SIZE; i++) {
      const gfx = new Graphics();
      gfx.visible = false;
      this.addChild(gfx);
      const vipBadge = new Graphics();
      drawStar(vipBadge, 7);
      vipBadge.visible = false;
      this.addChild(vipBadge);
      this.pool.push({ sprite: null, gfx, vipBadge, lastBracket: -1 });
    }
    void this.loadTexture();
  }

  private async loadTexture(): Promise<void> {
    try {
      this.guestTexture = (await Assets.load('/sprites/characters/guest.png')) as Texture;
      if (this.guestTexture) {
        this.textureReady = true;
        // Create sprite instances in the pool
        for (const entry of this.pool) {
          const sp = new Sprite(this.guestTexture);
          sp.anchor.set(0.5, 1); // bottom-centre
          sp.width = GUEST_SPRITE_SIZE;
          sp.height = GUEST_SPRITE_SIZE;
          sp.visible = false;
          this.addChild(sp);
          entry.sprite = sp;
        }
      }
    } catch {
      // No guest sprite → keep using coloured dots.
    }
  }

  /**
   * Update guest positions and colors.
   */
  update(
    guests: Record<string, Guest>,
    zoom: number,
    viewportBounds: ViewportBounds,
  ): void {
    const useDots = !this.textureReady || zoom < 0.5;
    const dotRadius = zoom < 0.5 ? 3 : 5;

    // Viewport bounds in tile coords (with margin)
    const vMinX = viewportBounds.x - 1;
    const vMinY = viewportBounds.y - 1;
    const vMaxX = viewportBounds.x + viewportBounds.w + 1;
    const vMaxY = viewportBounds.y + viewportBounds.h + 1;

    let poolIdx = 0;

    for (const guestId in guests) {
      if (poolIdx >= POOL_SIZE) break;

      const guest = guests[guestId];

      // Frustum culling
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
      const px = guest.x * TILE_SIZE + TILE_SIZE / 2;
      const py = guest.y * TILE_SIZE + TILE_SIZE;

      const isVip = !!guest.vipPersonaId;

      if (useDots) {
        // Fallback: coloured dot
        if (entry.sprite) entry.sprite.visible = false;
        if (entry.lastBracket !== bracket) {
          entry.gfx.clear();
          entry.gfx.circle(0, 0, dotRadius);
          entry.gfx.fill({ color: BRACKET_COLORS[bracket] });
          entry.lastBracket = bracket;
        }
        entry.gfx.x = px;
        entry.gfx.y = py - TILE_SIZE / 2;
        entry.gfx.visible = true;
      } else {
        // Character sprite — tinted by happiness; VIPs stay untinted (gold star
        // marks them instead) so they pop against the crowd.
        entry.gfx.visible = false;
        const sp = entry.sprite!;
        sp.tint = isVip ? 0xffffff : BRACKET_COLORS[bracket];
        sp.x = px;
        sp.y = py;
        sp.visible = true;
        entry.lastBracket = bracket;
      }

      // VIP badge: gold star floating above the guest.
      if (isVip) {
        entry.vipBadge.x = px;
        entry.vipBadge.y = py - (useDots ? TILE_SIZE * 0.85 : GUEST_SPRITE_SIZE + 8);
        entry.vipBadge.visible = true;
      } else if (entry.vipBadge.visible) {
        entry.vipBadge.visible = false;
      }

      poolIdx++;
    }

    // Hide unused pool entries
    for (let i = poolIdx; i < POOL_SIZE; i++) {
      const entry = this.pool[i];
      if (entry.gfx.visible) {
        entry.gfx.visible = false;
        entry.lastBracket = -1;
      }
      if (entry.sprite?.visible) {
        entry.sprite.visible = false;
      }
      if (entry.vipBadge.visible) {
        entry.vipBadge.visible = false;
      }
    }
  }
}
