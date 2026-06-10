// =============================================================================
// HK Theme Park Tycoon - Staff Layer
// =============================================================================
//
// Renders staff members as colour-coded badges (circle + type letter) so the
// player can see janitors patrolling, mechanics walking to broken rides, etc.
//
// If character sprites exist at /sprites/characters/{type}.png (e.g.
// janitor-green.png), they are used instead of the badge automatically.
//
// Performance: pooled display objects, frustum culling, draw-once badges.
// =============================================================================

import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  Assets,
} from 'pixi.js';
import { Staff, StaffType } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';

const POOL_SIZE = 64;
const STAFF_SPRITE_SIZE = TILE_SIZE * 0.8;
const BADGE_RADIUS = TILE_SIZE * 0.22;

const STAFF_COLORS: Record<StaffType, number> = {
  [StaffType.JANITOR]: 0x2ecc71,
  [StaffType.MECHANIC]: 0xe67e22,
  [StaffType.SECURITY]: 0x2980b9,
  [StaffType.ENTERTAINER]: 0x9b59b6,
};

const STAFF_LETTERS: Record<StaffType, string> = {
  [StaffType.JANITOR]: 'J',
  [StaffType.MECHANIC]: 'M',
  [StaffType.SECURITY]: 'S',
  [StaffType.ENTERTAINER]: 'E',
};

/** Sprite filenames per staff type (used when the art exists). */
const STAFF_SPRITE_FILES: Record<StaffType, string> = {
  [StaffType.JANITOR]: 'janitor-green.png',
  [StaffType.MECHANIC]: 'mechanic-orange.png',
  [StaffType.SECURITY]: 'security-blue.png',
  [StaffType.ENTERTAINER]: 'entertainer-purple.png',
};

const LETTER_STYLE = new TextStyle({
  fontFamily: 'Arial',
  fontSize: 11,
  fill: 0xffffff,
  fontWeight: 'bold',
});

interface PoolEntry {
  badge: Graphics;
  letter: Text;
  sprite: Sprite | null;
  lastType: StaffType | null;
}

export class StaffLayer extends Container {
  private pool: PoolEntry[] = [];
  private textures: Partial<Record<StaffType, Texture>> = {};

  constructor() {
    super();
    for (let i = 0; i < POOL_SIZE; i++) {
      const badge = new Graphics();
      badge.visible = false;
      const letter = new Text({ text: '', style: LETTER_STYLE });
      letter.anchor.set(0.5);
      letter.visible = false;
      this.addChild(badge);
      this.addChild(letter);
      this.pool.push({ badge, letter, sprite: null, lastType: null });
    }
    void this.loadTextures();
  }

  private async loadTextures(): Promise<void> {
    const types = Object.keys(STAFF_SPRITE_FILES) as StaffType[];
    await Promise.all(
      types.map(async (type) => {
        try {
          const tex = (await Assets.load(
            `/sprites/characters/${STAFF_SPRITE_FILES[type]}`,
          )) as Texture;
          if (tex) this.textures[type] = tex;
        } catch {
          // No art for this type yet — the badge fallback handles it.
        }
      }),
    );
  }

  update(staff: Record<string, Staff>, viewportBounds: ViewportBounds): void {
    const vMinX = viewportBounds.x - 1;
    const vMinY = viewportBounds.y - 1;
    const vMaxX = viewportBounds.x + viewportBounds.w + 1;
    const vMaxY = viewportBounds.y + viewportBounds.h + 1;

    let poolIdx = 0;

    for (const staffId in staff) {
      if (poolIdx >= POOL_SIZE) break;
      const member = staff[staffId];

      if (
        member.tile.x < vMinX ||
        member.tile.x > vMaxX ||
        member.tile.y < vMinY ||
        member.tile.y > vMaxY
      ) {
        continue;
      }

      const entry = this.pool[poolIdx];
      const px = member.tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = member.tile.y * TILE_SIZE + TILE_SIZE;
      const tex = this.textures[member.type];

      if (tex) {
        // Character sprite available
        if (!entry.sprite) {
          entry.sprite = new Sprite(tex);
          entry.sprite.anchor.set(0.5, 1);
          this.addChild(entry.sprite);
        }
        entry.sprite.texture = tex;
        entry.sprite.width = STAFF_SPRITE_SIZE;
        entry.sprite.height = STAFF_SPRITE_SIZE;
        entry.sprite.x = px;
        entry.sprite.y = py;
        entry.sprite.visible = true;
        entry.badge.visible = false;
        entry.letter.visible = false;
      } else {
        // Badge fallback: coloured circle with the type letter
        if (entry.lastType !== member.type) {
          entry.badge.clear();
          entry.badge.circle(0, 0, BADGE_RADIUS);
          entry.badge.fill({ color: STAFF_COLORS[member.type] });
          entry.badge.circle(0, 0, BADGE_RADIUS);
          entry.badge.stroke({ color: 0xffffff, width: 1.5 });
          entry.letter.text = STAFF_LETTERS[member.type];
          entry.lastType = member.type;
        }
        const cy = py - TILE_SIZE / 2;
        entry.badge.x = px;
        entry.badge.y = cy;
        entry.letter.x = px;
        entry.letter.y = cy;
        entry.badge.visible = true;
        entry.letter.visible = true;
        if (entry.sprite) entry.sprite.visible = false;
      }

      poolIdx++;
    }

    // Hide unused pool entries
    for (let i = poolIdx; i < POOL_SIZE; i++) {
      const entry = this.pool[i];
      if (entry.badge.visible) entry.badge.visible = false;
      if (entry.letter.visible) entry.letter.visible = false;
      if (entry.sprite?.visible) entry.sprite.visible = false;
    }
  }
}
