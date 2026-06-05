// =============================================================================
// HK Theme Park Tycoon - Terrain Layer (optimized)
// =============================================================================
//
// Performance features:
//   - Dirty flag: only redraws when the grid actually changes or camera moves
//   - Frustum culling: only draws tiles visible in the current viewport
//   - Grid line detail-level: grid lines only rendered at high zoom (>1.5x)
// =============================================================================

import { Container, Graphics } from 'pixi.js';
import { Tile, TileType } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';

/** Color mapping for each tile type / state. */
const TILE_COLORS: Record<string, number> = {
  EMPTY_BUILDABLE: 0x7ec850,
  EMPTY_UNBUILDABLE: 0x3a3a3a,
  PATH: 0xd4a574,
  DECORATION: 0x4a9a4a,
  WATER: 0x4a90d9,
  TERRAIN_HILL: 0x5a9a3a,
  ENTRANCE: 0xf0c040,
};

const GRID_LINE_COLOR = 0x888888;
const DECORATION_DOT_COLOR = 0x2e7a2e;

export class TerrainLayer extends Container {
  private gfx: Graphics;

  // Dirty tracking: avoid full redraw every frame
  private _dirty: boolean = true;
  private _lastGridVersion: number = -1;
  private _lastViewX: number = NaN;
  private _lastViewY: number = NaN;
  private _lastViewW: number = NaN;
  private _lastViewH: number = NaN;
  private _lastZoom: number = NaN;

  constructor() {
    super();
    this.gfx = new Graphics();
    this.addChild(this.gfx);
  }

  /** Mark the terrain as needing a redraw (call when grid tiles change). */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Redraw the visible portion of the tile grid, but only when something changed.
   *
   * @param grid           - full 2D tile array
   * @param viewportBounds - visible region in tile coordinates {x, y, w, h}
   * @param zoom           - current camera zoom level
   * @param gridVersion    - monotonically increasing counter bumped when grid changes
   */
  update(
    grid: Tile[][],
    viewportBounds: ViewportBounds,
    zoom: number,
    gridVersion: number,
  ): void {
    // Check if we actually need to redraw
    const viewChanged =
      viewportBounds.x !== this._lastViewX ||
      viewportBounds.y !== this._lastViewY ||
      viewportBounds.w !== this._lastViewW ||
      viewportBounds.h !== this._lastViewH ||
      zoom !== this._lastZoom;

    const gridChanged = gridVersion !== this._lastGridVersion;

    if (!this._dirty && !viewChanged && !gridChanged) {
      return; // Nothing to do
    }

    this.gfx.clear();

    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length ?? 0;

    // Clamp viewport to grid bounds
    const startY = Math.max(0, viewportBounds.y);
    const startX = Math.max(0, viewportBounds.x);
    const endY = Math.min(gridHeight, viewportBounds.y + viewportBounds.h);
    const endX = Math.min(gridWidth, viewportBounds.x + viewportBounds.w);

    const showGridLines = zoom > 1.5;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Skip tiles whose rendering is handled by BuildingLayer
        if (
          tile.type === TileType.RIDE_FOOTPRINT ||
          tile.type === TileType.SHOP_FOOTPRINT
        ) {
          continue;
        }

        // Determine fill color
        let color: number;
        switch (tile.type) {
          case TileType.EMPTY:
            color = tile.buildable
              ? TILE_COLORS.EMPTY_BUILDABLE
              : TILE_COLORS.EMPTY_UNBUILDABLE;
            break;
          case TileType.PATH:
            color = TILE_COLORS.PATH;
            break;
          case TileType.DECORATION:
            color = TILE_COLORS.DECORATION;
            break;
          case TileType.WATER:
            color = TILE_COLORS.WATER;
            break;
          case TileType.TERRAIN_HILL:
            color = TILE_COLORS.TERRAIN_HILL;
            break;
          case TileType.ENTRANCE:
            color = TILE_COLORS.ENTRANCE;
            break;
          default:
            color = TILE_COLORS.EMPTY_UNBUILDABLE;
            break;
        }

        // Draw the tile fill
        this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
        this.gfx.fill({ color });

        // Decoration dot overlay
        if (tile.type === TileType.DECORATION) {
          const dotRadius = 4;
          this.gfx.circle(
            px + TILE_SIZE / 2,
            py + TILE_SIZE / 2,
            dotRadius,
          );
          this.gfx.fill({ color: DECORATION_DOT_COLOR });
        }

        // Grid lines at high zoom
        if (showGridLines) {
          this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
          this.gfx.stroke({ color: GRID_LINE_COLOR, width: 1, alpha: 0.3 });
        }
      }
    }

    // Update tracking state
    this._dirty = false;
    this._lastGridVersion = gridVersion;
    this._lastViewX = viewportBounds.x;
    this._lastViewY = viewportBounds.y;
    this._lastViewW = viewportBounds.w;
    this._lastViewH = viewportBounds.h;
    this._lastZoom = zoom;
  }
}
