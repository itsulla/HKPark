// =============================================================================
// HK Theme Park Tycoon - Building Layer (Rides + Shops) - Optimized
// =============================================================================
//
// Performance features:
//   - Dirty flag: only redraws when rides/shops actually change
//   - Label caching: Text objects are created once and reused, not recreated
//     every frame. Only destroyed/recreated when the set of buildings changes.
//   - Definition lookup via Map (O(1)) instead of array scan (O(n))
//   - Frustum culling: buildings outside the viewport are not drawn
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
import { Ride, Shop, RideDefinition, ShopDefinition } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';
import ridesData from '../../data/rides.json';
import shopsData from '../../data/shops.json';

/** Ride category colors. */
const RIDE_CATEGORY_COLORS: Record<string, number> = {
  THRILL: 0xe74c3c,
  FAMILY: 0x3498db,
  GENTLE: 0x2ecc71,
  WATER: 0x00bcd4,
  TRANSPORT: 0xf39c12,
};

/** Ride status border colors. */
const STATUS_COLORS: Record<string, number> = {
  open: 0x27ae60,
  broken: 0xe74c3c,
  closed: 0x95a5a6,
  building: 0xf39c12,
};

/** Shop category letter labels. */
const SHOP_LABELS: Record<string, string> = {
  FOOD: 'F',
  DRINK: 'D',
  SOUVENIR: 'S',
  FACILITY: '+',
};

/** Shop category colors. */
const SHOP_CATEGORY_COLORS: Record<string, number> = {
  FOOD: 0xe67e22,
  DRINK: 0x2980b9,
  SOUVENIR: 0x9b59b6,
  FACILITY: 0x1abc9c,
};

// ---------------------------------------------------------------------------
// Per-entity sprite scale multipliers (relative to footprint pixel size)
// ---------------------------------------------------------------------------
// wMul × footprintWidth, hMul × footprintHeight. Rides overshoot their
// footprint so they look imposing. Tall structures (towers, ferris wheels)
// get extra height; wide ones (coasters, boats) get extra width.
// ---------------------------------------------------------------------------

interface SpriteScale {
  wMul: number;
  hMul: number;
}

// Tuned for the dense AI-painted art (fills its canvas far more than the old
// low-poly renders did) — roughly 0.8x the previous multipliers so rides stop
// swallowing adjacent paths while still overshooting their footprint a little.
const RIDE_SCALE: Record<string, SpriteScale> = {
  'harbour-ferris-wheel':      { wMul: 1.3, hMul: 1.75 }, // tall circle
  'dragon-coaster':            { wMul: 1.45, hMul: 1.25 }, // wide track
  'peak-tram-drop':            { wMul: 1.05, hMul: 2.2 },  // narrow + very tall
  'dim-sum-spinner':           { wMul: 1.3, hMul: 1.3 },  // medium circle
  'neon-night-flyer':          { wMul: 1.45, hMul: 1.45 }, // big coaster
  'temple-garden-train':       { wMul: 1.3, hMul: 1.0 },  // long + low
  'typhoon-twister':           { wMul: 1.2, hMul: 1.75 }, // tall spinner
  'bamboo-scaffold-climb':     { wMul: 1.05, hMul: 2.0 },  // narrow + very tall
  'lion-dance-carousel':       { wMul: 1.3, hMul: 1.15 }, // wide + short
  'star-ferry-splash':         { wMul: 1.3, hMul: 1.15 }, // wide water
  'junk-boat-cruise':          { wMul: 1.3, hMul: 1.15 }, // wide water
  'kowloon-walled-city-maze':  { wMul: 1.2, hMul: 1.2 },  // big square
};
const DEFAULT_RIDE_SCALE: SpriteScale = { wMul: 1.3, hMul: 1.45 };

/** Shop sprites overshoot their single tile so details are visible. */
const SHOP_SPRITE_SCALE: SpriteScale = { wMul: 1.6, hMul: 2.0 };

// ---------------------------------------------------------------------------
// Definition lookup maps (built once at import time)
// ---------------------------------------------------------------------------

const rideDefMap = new Map<string, RideDefinition>();
for (const r of ridesData as RideDefinition[]) {
  rideDefMap.set(r.id, r);
}

const shopDefMap = new Map<string, ShopDefinition>();
for (const s of shopsData as ShopDefinition[]) {
  shopDefMap.set(s.id, s);
}

// ---------------------------------------------------------------------------
// Shared text styles (created once, reused)
// ---------------------------------------------------------------------------

const RIDE_LABEL_STYLE = new TextStyle({
  fontFamily: 'Arial',
  fontSize: 10,
  fill: 0xffffff,
  align: 'center',
});

const SHOP_LABEL_STYLE = new TextStyle({
  fontFamily: 'Arial',
  fontSize: 14,
  fill: 0xffffff,
  fontWeight: 'bold',
});

const BROKEN_MARKER_STYLE = new TextStyle({
  fontFamily: 'Arial',
  fontSize: 22,
  fill: 0xff2e2e,
  fontWeight: 'bold',
  stroke: { color: 0x000000, width: 4 },
});

// ---------------------------------------------------------------------------
// Cached label entry
// ---------------------------------------------------------------------------

interface CachedLabel {
  text: Text;
  entityId: string;
}

// ---------------------------------------------------------------------------
// BuildingLayer
// ---------------------------------------------------------------------------

export class BuildingLayer extends Container {
  private gfx: Graphics;
  private spritesContainer: Container;
  private labelsContainer: Container;

  // Label cache keyed by entity ID
  private rideLabelCache: Map<string, CachedLabel> = new Map();
  private shopLabelCache: Map<string, CachedLabel> = new Map();

  // Broken-ride warning markers keyed by ride ID
  private brokenMarkers: Map<string, Text> = new Map();

  // Rides currently broken (frozen — excluded from the idle sway animation)
  private brokenRideIds: Set<string> = new Set();

  // Sprite instances keyed by entity ID, and the loaded textures by definition ID
  private rideSprites: Map<string, Sprite> = new Map();
  private shopSprites: Map<string, Sprite> = new Map();
  private rideTextures: Map<string, Texture> = new Map();
  private shopTextures: Map<string, Texture> = new Map();
  private texturesReady = false;

  // Dirty tracking
  private _dirty: boolean = true;
  private _lastRideKeys: string = '';
  private _lastShopKeys: string = '';
  private _lastRideStatuses: string = '';

  constructor() {
    super();
    this.gfx = new Graphics();
    this.spritesContainer = new Container();
    this.labelsContainer = new Container();
    this.addChild(this.gfx);
    this.addChild(this.spritesContainer);
    this.addChild(this.labelsContainer);
    void this.loadTextures();
  }

  /** Preload ride/shop sprites; missing ones simply fall back to coloured rects. */
  private async loadTextures(): Promise<void> {
    const load = async (id: string, url: string, into: Map<string, Texture>) => {
      try {
        const tex = (await Assets.load(url)) as Texture;
        if (tex) into.set(id, tex);
      } catch {
        // No sprite for this entity — the coloured-rect fallback handles it.
      }
    };
    const jobs: Promise<void>[] = [];
    for (const id of Array.from(rideDefMap.keys())) {
      jobs.push(load(id, `/sprites/rides/${id}.png`, this.rideTextures));
    }
    for (const id of Array.from(shopDefMap.keys())) {
      jobs.push(load(id, `/sprites/shops/${id}.png`, this.shopTextures));
    }
    await Promise.all(jobs);
    this.texturesReady = true;
    this.markDirty();
  }

  /** Force a full redraw on next update. */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Idle sway animation — call every frame. Sprites are bottom-anchored so a
   * tiny rotation reads as the ride gently operating. Runs on the transform
   * only (no redraw). Broken rides stay frozen.
   */
  animate(timeMs: number): void {
    const t = timeMs / 900;
    this.rideSprites.forEach((sprite, id) => {
      if (!sprite.visible) return;
      if (this.brokenRideIds.has(id)) {
        sprite.rotation = 0;
        return;
      }
      // Deterministic phase per ride so they don't sway in lockstep.
      let phase = 0;
      for (let i = 0; i < id.length; i++) phase = (phase + id.charCodeAt(i)) % 97;
      sprite.rotation = Math.sin(t + phase) * 0.02;
    });
    this.shopSprites.forEach((sprite, id) => {
      if (!sprite.visible) return;
      let phase = 0;
      for (let i = 0; i < id.length; i++) phase = (phase + id.charCodeAt(i)) % 97;
      sprite.rotation = Math.sin(t * 0.7 + phase) * 0.008;
    });
  }

  /**
   * Redraw rides and shops, but only when something actually changed.
   *
   * @param rides           - Record of all rides
   * @param shops           - Record of all shops
   * @param viewportBounds  - visible region in tile coordinates
   */
  update(
    rides: Record<string, Ride>,
    shops: Record<string, Shop>,
    viewportBounds: ViewportBounds,
  ): void {
    // Quick-check whether the set of buildings or their statuses changed
    const rideKeys = Object.keys(rides).sort().join(',');
    const shopKeys = Object.keys(shops).sort().join(',');
    const rideStatuses = Object.keys(rides)
      .sort()
      .map((k) => rides[k].status)
      .join(',');

    const changed =
      this._dirty ||
      rideKeys !== this._lastRideKeys ||
      shopKeys !== this._lastShopKeys ||
      rideStatuses !== this._lastRideStatuses;

    if (!changed) return;

    this.gfx.clear();

    // Track which labels/sprites are still in use this frame
    const usedRideLabels = new Set<string>();
    const usedShopLabels = new Set<string>();
    const usedRideSprites = new Set<string>();
    const usedShopSprites = new Set<string>();
    const usedBrokenMarkers = new Set<string>();

    // Refresh the broken set for the sway animation.
    this.brokenRideIds.clear();
    for (const rideId in rides) {
      if (rides[rideId].status === 'broken') this.brokenRideIds.add(rideId);
    }

    // -- Rides --
    for (const rideId in rides) {
      const ride = rides[rideId];
      const def = rideDefMap.get(ride.definitionId);
      const category = def?.category ?? 'FAMILY';

      // Compute bounding box from tile array
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const t of ride.tiles) {
        if (t.x < minX) minX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.x > maxX) maxX = t.x;
        if (t.y > maxY) maxY = t.y;
      }

      // Frustum culling: skip rides entirely outside viewport
      if (
        maxX < viewportBounds.x ||
        minX > viewportBounds.x + viewportBounds.w ||
        maxY < viewportBounds.y ||
        minY > viewportBounds.y + viewportBounds.h
      ) {
        const cached = this.rideLabelCache.get(rideId);
        if (cached) cached.text.visible = false;
        const sp = this.rideSprites.get(rideId);
        if (sp) sp.visible = false;
        continue;
      }

      const px = minX * TILE_SIZE;
      const py = minY * TILE_SIZE;
      const pw = (maxX - minX + 1) * TILE_SIZE;
      const ph = (maxY - minY + 1) * TILE_SIZE;
      const borderColor = STATUS_COLORS[ride.status] ?? 0x95a5a6;
      const tex = this.texturesReady ? this.rideTextures.get(ride.definitionId) : undefined;

      if (tex) {
        // Sprite, bottom-centre anchored so tall rides rise out of the tile.
        let sprite = this.rideSprites.get(rideId);
        if (!sprite) {
          sprite = new Sprite(tex);
          sprite.anchor.set(0.5, 1);
          this.spritesContainer.addChild(sprite);
          this.rideSprites.set(rideId, sprite);
        }
        const scale = RIDE_SCALE[ride.definitionId] ?? DEFAULT_RIDE_SCALE;
        sprite.texture = tex;
        sprite.width = pw * scale.wMul;
        sprite.height = ph * scale.hMul;
        sprite.x = px + pw / 2;
        sprite.y = py + ph;
        sprite.visible = true;
        usedRideSprites.add(rideId);
        // Footprint status outline on the ground (open/broken/closed cue).
        this.gfx.rect(px + 1, py + 1, pw - 2, ph - 2);
        this.gfx.stroke({ color: borderColor, width: 2, alpha: 0.7 });
        // Broken rides get an unmissable warning marker.
        if (ride.status === 'broken') {
          usedBrokenMarkers.add(rideId);
          let marker = this.brokenMarkers.get(rideId);
          if (!marker) {
            marker = new Text({ text: '⚠ BROKEN', style: BROKEN_MARKER_STYLE });
            marker.anchor.set(0.5, 1);
            this.labelsContainer.addChild(marker);
            this.brokenMarkers.set(rideId, marker);
          }
          marker.x = px + pw / 2;
          marker.y = py - 4;
          marker.visible = true;
        }
        const cached = this.rideLabelCache.get(rideId);
        if (cached) cached.text.visible = false;
        continue;
      }

      // Broken marker for the rect-fallback path too.
      if (ride.status === 'broken') {
        usedBrokenMarkers.add(rideId);
        let marker = this.brokenMarkers.get(rideId);
        if (!marker) {
          marker = new Text({ text: '⚠ BROKEN', style: BROKEN_MARKER_STYLE });
          marker.anchor.set(0.5, 1);
          this.labelsContainer.addChild(marker);
          this.brokenMarkers.set(rideId, marker);
        }
        marker.x = px + pw / 2;
        marker.y = py - 4;
        marker.visible = true;
      }

      // Fallback: coloured rect + name label
      const fillColor = RIDE_CATEGORY_COLORS[category] ?? 0x3498db;
      this.gfx.rect(px, py, pw, ph);
      this.gfx.fill({ color: fillColor, alpha: 0.85 });
      this.gfx.rect(px + 1, py + 1, pw - 2, ph - 2);
      this.gfx.stroke({ color: borderColor, width: 2 });

      usedRideLabels.add(rideId);
      let cached = this.rideLabelCache.get(rideId);
      if (!cached) {
        const label = new Text({ text: ride.name, style: RIDE_LABEL_STYLE });
        label.anchor.set(0.5);
        this.labelsContainer.addChild(label);
        cached = { text: label, entityId: rideId };
        this.rideLabelCache.set(rideId, cached);
      }
      cached.text.text = ride.name;
      cached.text.x = px + pw / 2;
      cached.text.y = py + ph / 2;
      cached.text.visible = true;
      cached.text.style.wordWrap = true;
      cached.text.style.wordWrapWidth = pw - 4;
    }

    // -- Shops --
    for (const shopId in shops) {
      const shop = shops[shopId];
      const def = shopDefMap.get(shop.definitionId);
      const category = def?.category ?? 'FOOD';

      const tileX = shop.tile.x;
      const tileY = shop.tile.y;

      // Frustum culling
      if (
        tileX < viewportBounds.x ||
        tileX > viewportBounds.x + viewportBounds.w ||
        tileY < viewportBounds.y ||
        tileY > viewportBounds.y + viewportBounds.h
      ) {
        const cached = this.shopLabelCache.get(shopId);
        if (cached) cached.text.visible = false;
        const sp = this.shopSprites.get(shopId);
        if (sp) sp.visible = false;
        continue;
      }

      const px = tileX * TILE_SIZE;
      const py = tileY * TILE_SIZE;
      const tex = this.texturesReady ? this.shopTextures.get(shop.definitionId) : undefined;

      if (tex) {
        let sprite = this.shopSprites.get(shopId);
        if (!sprite) {
          sprite = new Sprite(tex);
          sprite.anchor.set(0.5, 1);
          this.spritesContainer.addChild(sprite);
          this.shopSprites.set(shopId, sprite);
        }
        sprite.texture = tex;
        sprite.width = TILE_SIZE * SHOP_SPRITE_SCALE.wMul;
        sprite.height = TILE_SIZE * SHOP_SPRITE_SCALE.hMul;
        sprite.x = px + TILE_SIZE / 2;
        sprite.y = py + TILE_SIZE;
        sprite.visible = true;
        usedShopSprites.add(shopId);
        const cached = this.shopLabelCache.get(shopId);
        if (cached) cached.text.visible = false;
        continue;
      }

      // Fallback: coloured rect + letter label
      const fillColor = SHOP_CATEGORY_COLORS[category] ?? 0xe67e22;
      this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
      this.gfx.fill({ color: fillColor, alpha: 0.9 });
      this.gfx.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      this.gfx.stroke({ color: 0xffffff, width: 1 });

      usedShopLabels.add(shopId);
      let cached = this.shopLabelCache.get(shopId);
      if (!cached) {
        const label = new Text({ text: SHOP_LABELS[category] ?? '?', style: SHOP_LABEL_STYLE });
        label.anchor.set(0.5);
        this.labelsContainer.addChild(label);
        cached = { text: label, entityId: shopId };
        this.shopLabelCache.set(shopId, cached);
      }
      cached.text.text = SHOP_LABELS[category] ?? '?';
      cached.text.x = px + TILE_SIZE / 2;
      cached.text.y = py + TILE_SIZE / 2;
      cached.text.visible = true;
    }

    // Remove labels/sprites for demolished buildings
    this.rideLabelCache.forEach((cached, id) => {
      if (!usedRideLabels.has(id)) {
        this.labelsContainer.removeChild(cached.text);
        cached.text.destroy();
        this.rideLabelCache.delete(id);
      }
    });
    this.shopLabelCache.forEach((cached, id) => {
      if (!usedShopLabels.has(id)) {
        this.labelsContainer.removeChild(cached.text);
        cached.text.destroy();
        this.shopLabelCache.delete(id);
      }
    });
    this.rideSprites.forEach((sp, id) => {
      if (!usedRideSprites.has(id) && !(id in rides)) {
        this.spritesContainer.removeChild(sp);
        sp.destroy();
        this.rideSprites.delete(id);
      }
    });
    this.shopSprites.forEach((sp, id) => {
      if (!usedShopSprites.has(id) && !(id in shops)) {
        this.spritesContainer.removeChild(sp);
        sp.destroy();
        this.shopSprites.delete(id);
      }
    });
    this.brokenMarkers.forEach((marker, id) => {
      if (!usedBrokenMarkers.has(id)) {
        this.labelsContainer.removeChild(marker);
        marker.destroy();
        this.brokenMarkers.delete(id);
      }
    });

    // Update tracking
    this._dirty = false;
    this._lastRideKeys = rideKeys;
    this._lastShopKeys = shopKeys;
    this._lastRideStatuses = rideStatuses;
  }
}
