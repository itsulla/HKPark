// =============================================================================
// HK Theme Park Tycoon - Terrain Layer (textured)
// =============================================================================
//
// Renders the ground with tiled textures (grass / asphalt / path / water) and
// decoration sprites, with a coloured-rect fallback while textures load.
//
// Performance:
//   - Dirty flag: only redraws when the grid changes or the camera moves
//   - Frustum culling: only the visible tile region is drawn
//   - Ground sprites are pooled and reused across redraws (no per-frame alloc)
// =============================================================================

import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { Tile, TileType } from '../../engine/types';
import { TILE_SIZE, ViewportBounds } from '../Camera';

/** Fallback colours (used until textures finish loading). */
const TILE_COLORS: Record<string, number> = {
  EMPTY_BUILDABLE: 0x7ec850,
  EMPTY_UNBUILDABLE: 0x3a3a3a,
  PATH: 0xd4a574,
  DECORATION: 0x4a9a4a,
  WATER: 0x4a90d9,
  TERRAIN_HILL: 0x5a9a3a,
  ENTRANCE: 0xf0c040,
};

const ENTRANCE_TINT = 0xf0c040;

export class TerrainLayer extends Container {
  private gfx: Graphics;
  private groundContainer: Container;
  private decoContainer: Container;

  private groundPool: Sprite[] = [];
  private decoSprites: Map<string, Sprite> = new Map();

  private textures: Partial<Record<string, Texture>> = {};
  private decoTexture: Texture | null = null;
  private texturesReady = false;

  // Dirty tracking
  private _dirty = true;
  private _lastGridVersion = -1;
  private _lastViewX = NaN;
  private _lastViewY = NaN;
  private _lastViewW = NaN;
  private _lastViewH = NaN;
  private _lastZoom = NaN;

  constructor() {
    super();
    this.gfx = new Graphics();
    this.groundContainer = new Container();
    this.decoContainer = new Container();
    this.addChild(this.gfx);
    this.addChild(this.groundContainer);
    this.addChild(this.decoContainer);
    void this.loadTextures();
  }

  private async loadTextures(): Promise<void> {
    const load = async (key: string, url: string) => {
      try {
        this.textures[key] = (await Assets.load(url)) as Texture;
      } catch {
        // Missing texture -> the coloured-rect fallback handles it.
      }
    };
    await Promise.all([
      load('grass', '/sprites/tiles/grass.png'),
      load('asphalt', '/sprites/tiles/asphalt.png'),
      load('path', '/sprites/tiles/path.png'),
      load('water', '/sprites/tiles/water.png'),
    ]);
    try {
      this.decoTexture = (await Assets.load('/sprites/decorations/lantern.png')) as Texture;
    } catch {
      this.decoTexture = null;
    }
    this.texturesReady = !!this.textures.grass;
    this.markDirty();
  }

  markDirty(): void {
    this._dirty = true;
  }

  /** Pick the ground texture + tint for a tile type. */
  private groundTextureFor(tile: Tile): { tex?: Texture; tint: number } {
    const t = this.textures;
    switch (tile.type) {
      case TileType.EMPTY:
        return { tex: tile.buildable ? t.grass : t.asphalt, tint: 0xffffff };
      case TileType.PATH:
        return { tex: t.path, tint: 0xffffff };
      case TileType.WATER:
        return { tex: t.water, tint: 0xffffff };
      case TileType.TERRAIN_HILL:
        return { tex: t.grass, tint: 0xcfe8a0 };
      case TileType.ENTRANCE:
        return { tex: t.path, tint: ENTRANCE_TINT };
      case TileType.DECORATION:
        return { tex: t.grass, tint: 0xffffff };
      default:
        return { tex: t.asphalt, tint: 0xffffff };
    }
  }

  update(
    grid: Tile[][],
    viewportBounds: ViewportBounds,
    zoom: number,
    gridVersion: number,
  ): void {
    const viewChanged =
      viewportBounds.x !== this._lastViewX ||
      viewportBounds.y !== this._lastViewY ||
      viewportBounds.w !== this._lastViewW ||
      viewportBounds.h !== this._lastViewH ||
      zoom !== this._lastZoom;
    const gridChanged = gridVersion !== this._lastGridVersion;
    if (!this._dirty && !viewChanged && !gridChanged) return;

    this.gfx.clear();

    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length ?? 0;
    const startY = Math.max(0, viewportBounds.y);
    const startX = Math.max(0, viewportBounds.x);
    const endY = Math.min(gridHeight, viewportBounds.y + viewportBounds.h);
    const endX = Math.min(gridWidth, viewportBounds.x + viewportBounds.w);

    let poolIndex = 0;
    const usedDeco = new Set<string>();

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = grid[y][x];
        // Footprints are drawn by BuildingLayer.
        if (
          tile.type === TileType.RIDE_FOOTPRINT ||
          tile.type === TileType.SHOP_FOOTPRINT
        ) {
          continue;
        }

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const { tex, tint } = this.groundTextureFor(tile);

        if (this.texturesReady && tex) {
          let sprite = this.groundPool[poolIndex];
          if (!sprite) {
            sprite = new Sprite(tex);
            this.groundContainer.addChild(sprite);
            this.groundPool[poolIndex] = sprite;
          }
          sprite.texture = tex;
          sprite.x = px;
          sprite.y = py;
          sprite.width = TILE_SIZE;
          sprite.height = TILE_SIZE;
          sprite.tint = tint;
          sprite.visible = true;
          poolIndex++;
        } else {
          // Fallback: coloured rect
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
          this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
          this.gfx.fill({ color });
        }

        // Decoration object on top (bottom-anchored so it stands up).
        if (tile.type === TileType.DECORATION && this.decoTexture) {
          const key = `${x},${y}`;
          usedDeco.add(key);
          let deco = this.decoSprites.get(key);
          if (!deco) {
            deco = new Sprite(this.decoTexture);
            deco.anchor.set(0.5, 1);
            this.decoContainer.addChild(deco);
            this.decoSprites.set(key, deco);
          }
          const size = TILE_SIZE * 1.7;
          deco.width = size;
          deco.height = size;
          deco.x = px + TILE_SIZE / 2;
          deco.y = py + TILE_SIZE;
          deco.visible = true;
        }
      }
    }

    // Hide unused pooled ground sprites.
    for (let i = poolIndex; i < this.groundPool.length; i++) {
      this.groundPool[i].visible = false;
    }
    // Remove decoration sprites no longer visible/present.
    this.decoSprites.forEach((sp, key) => {
      if (!usedDeco.has(key)) {
        this.decoContainer.removeChild(sp);
        sp.destroy();
        this.decoSprites.delete(key);
      }
    });

    this._dirty = false;
    this._lastGridVersion = gridVersion;
    this._lastViewX = viewportBounds.x;
    this._lastViewY = viewportBounds.y;
    this._lastViewW = viewportBounds.w;
    this._lastViewH = viewportBounds.h;
    this._lastZoom = zoom;
  }
}
