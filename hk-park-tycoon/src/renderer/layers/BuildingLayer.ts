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

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
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
  private labelsContainer: Container;

  // Label cache keyed by entity ID
  private rideLabelCache: Map<string, CachedLabel> = new Map();
  private shopLabelCache: Map<string, CachedLabel> = new Map();

  // Dirty tracking
  private _dirty: boolean = true;
  private _lastRideKeys: string = '';
  private _lastShopKeys: string = '';
  private _lastRideStatuses: string = '';

  constructor() {
    super();
    this.gfx = new Graphics();
    this.labelsContainer = new Container();
    this.addChild(this.gfx);
    this.addChild(this.labelsContainer);
  }

  /** Force a full redraw on next update. */
  markDirty(): void {
    this._dirty = true;
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

    // Track which labels are still in use this frame
    const usedRideLabels = new Set<string>();
    const usedShopLabels = new Set<string>();

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
        // Hide the label if it exists
        const cached = this.rideLabelCache.get(rideId);
        if (cached) cached.text.visible = false;
        continue;
      }

      const px = minX * TILE_SIZE;
      const py = minY * TILE_SIZE;
      const pw = (maxX - minX + 1) * TILE_SIZE;
      const ph = (maxY - minY + 1) * TILE_SIZE;

      // Fill
      const fillColor = RIDE_CATEGORY_COLORS[category] ?? 0x3498db;
      this.gfx.rect(px, py, pw, ph);
      this.gfx.fill({ color: fillColor, alpha: 0.85 });

      // Status border
      const borderColor = STATUS_COLORS[ride.status] ?? 0x95a5a6;
      this.gfx.rect(px + 1, py + 1, pw - 2, ph - 2);
      this.gfx.stroke({ color: borderColor, width: 2 });

      // Cached label
      usedRideLabels.add(rideId);
      let cached = this.rideLabelCache.get(rideId);

      if (!cached) {
        const label = new Text({
          text: ride.name,
          style: RIDE_LABEL_STYLE,
        });
        label.anchor.set(0.5);
        this.labelsContainer.addChild(label);
        cached = { text: label, entityId: rideId };
        this.rideLabelCache.set(rideId, cached);
      }

      // Update position (ride may have been rebuilt in a different spot)
      cached.text.text = ride.name;
      cached.text.x = px + pw / 2;
      cached.text.y = py + ph / 2;
      cached.text.visible = true;

      // Clamp word wrap width to footprint
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
        continue;
      }

      const px = tileX * TILE_SIZE;
      const py = tileY * TILE_SIZE;

      // Fill
      const fillColor = SHOP_CATEGORY_COLORS[category] ?? 0xe67e22;
      this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
      this.gfx.fill({ color: fillColor, alpha: 0.9 });

      // Border
      this.gfx.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      this.gfx.stroke({ color: 0xffffff, width: 1 });

      // Cached label
      usedShopLabels.add(shopId);
      let cached = this.shopLabelCache.get(shopId);

      if (!cached) {
        const label = new Text({
          text: SHOP_LABELS[category] ?? '?',
          style: SHOP_LABEL_STYLE,
        });
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

    // Remove labels for demolished buildings
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

    // Update tracking
    this._dirty = false;
    this._lastRideKeys = rideKeys;
    this._lastShopKeys = shopKeys;
    this._lastRideStatuses = rideStatuses;
  }
}
