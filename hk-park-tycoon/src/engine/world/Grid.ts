// =============================================================================
// HK Theme Park Tycoon - Grid System
// =============================================================================

import { Tile, TileType, Position, District } from '../types';

export class Grid {
  private tiles: Tile[][];
  private readonly _width: number;
  private readonly _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.tiles = [];

    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          x,
          y,
          type: TileType.EMPTY,
          elevation: 0,
          buildable: false,
          entityId: null,
          sceneryScore: 0,
        });
      }
      this.tiles.push(row);
    }
  }

  /**
   * Wrap an existing Tile[][] (e.g. the Zustand store's grid) in the Grid API
   * without copying. The caller must treat the resulting Grid as read-only when
   * the backing tiles are immutable (Immer-frozen) — guest/staff processing only
   * reads the grid, so this is safe for per-tick simulation.
   */
  static fromTiles(tiles: Tile[][]): Grid {
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    const grid = new Grid(width, height);
    grid.tiles = tiles;
    return grid;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /**
   * Returns the tile at (x, y), or null if out of bounds.
   */
  getTile(x: number, y: number): Tile | null {
    if (!this.isInBounds(x, y)) {
      return null;
    }
    return this.tiles[y][x];
  }

  /**
   * Sets the tile type at (x, y). No-op if out of bounds.
   */
  setTileType(x: number, y: number, type: TileType): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    this.tiles[y][x].type = type;
  }

  /**
   * Returns true if (x, y) is within the grid boundaries.
   */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this._width && y >= 0 && y < this._height;
  }

  /**
   * Checks whether every tile in the rectangular area starting at (startX, startY)
   * with dimensions w x h is EMPTY and buildable.
   */
  isAreaFree(startX: number, startY: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = this.getTile(startX + dx, startY + dy);
        if (!tile || tile.type !== TileType.EMPTY || !tile.buildable) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Places an entity over a rectangular footprint. Marks each tile with the
   * given entityId and tileType. Returns false if the area is not free.
   */
  placeEntity(
    startX: number,
    startY: number,
    w: number,
    h: number,
    entityId: string,
    tileType: TileType,
  ): boolean {
    if (!this.isAreaFree(startX, startY, w, h)) {
      return false;
    }

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = this.tiles[startY + dy][startX + dx];
        tile.type = tileType;
        tile.entityId = entityId;
      }
    }

    return true;
  }

  /**
   * Removes an entity by clearing every tile that references the given entityId.
   * Resets those tiles to EMPTY with null entityId and returns the freed positions.
   */
  removeEntity(entityId: string): Position[] {
    const freed: Position[] = [];

    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        const tile = this.tiles[y][x];
        if (tile.entityId === entityId) {
          tile.type = TileType.EMPTY;
          tile.entityId = null;
          freed.push({ x, y });
        }
      }
    }

    return freed;
  }

  /**
   * Returns up to 4 cardinal-direction neighbors of (x, y) that are in bounds.
   */
  getAdjacentTiles(x: number, y: number): Tile[] {
    const directions: Position[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    const neighbors: Tile[] = [];
    for (const dir of directions) {
      const tile = this.getTile(x + dir.x, y + dir.y);
      if (tile !== null) {
        neighbors.push(tile);
      }
    }

    return neighbors;
  }

  /**
   * Returns positions of adjacent tiles where the type is PATH or ENTRANCE.
   */
  getWalkableNeighbors(x: number, y: number): Position[] {
    const adjacent = this.getAdjacentTiles(x, y);
    return adjacent
      .filter(
        (tile) => tile.type === TileType.PATH || tile.type === TileType.ENTRANCE,
      )
      .map((tile) => ({ x: tile.x, y: tile.y }));
  }

  /**
   * Checks whether any tile within the footprint area (startX, startY, w, h)
   * has at least one adjacent tile of type PATH.
   * w and h default to 1 for single-tile checks.
   */
  isAdjacentToPath(x: number, y: number, w: number = 1, h: number = 1): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const adjacent = this.getAdjacentTiles(x + dx, y + dy);
        for (const neighbor of adjacent) {
          if (neighbor.type === TileType.PATH) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * BFS from (x, y) to determine if there is a connected path of PATH/ENTRANCE
   * tiles reaching any ENTRANCE tile.
   */
  isConnectedToEntrance(x: number, y: number): boolean {
    const startTile = this.getTile(x, y);
    if (!startTile) {
      return false;
    }

    // If the start tile itself is an entrance, it's connected
    if (startTile.type === TileType.ENTRANCE) {
      return true;
    }

    // Only start BFS from walkable tiles
    if (startTile.type !== TileType.PATH) {
      return false;
    }

    const visited = new Set<string>();
    const queue: Position[] = [{ x, y }];
    visited.add(`${x},${y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.getAdjacentTiles(current.x, current.y);

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (visited.has(key)) {
          continue;
        }

        if (neighbor.type === TileType.ENTRANCE) {
          return true;
        }

        if (neighbor.type === TileType.PATH) {
          visited.add(key);
          queue.push({ x: neighbor.x, y: neighbor.y });
        }
      }
    }

    return false;
  }

  /**
   * Counts the number of DECORATION tiles within the given radius of (x, y).
   */
  getSceneryScore(x: number, y: number, radius: number): number {
    let score = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const tile = this.getTile(x + dx, y + dy);
        if (tile && tile.type === TileType.DECORATION) {
          score++;
        }
      }
    }

    return score;
  }

  /**
   * Marks all tiles within the district's bounds as buildable.
   */
  markDistrict(district: District): void {
    const { x: startX, y: startY, w, h } = district.tiles;

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = startX + dx;
        const ty = startY + dy;
        if (this.isInBounds(tx, ty)) {
          this.tiles[ty][tx].buildable = true;
        }
      }
    }
  }

  /**
   * Sets the elevation at (x, y), clamped to the range [0, 3].
   */
  setElevation(x: number, y: number, elevation: number): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    this.tiles[y][x].elevation = Math.max(0, Math.min(3, elevation));
  }

  /**
   * Scans the entire grid and returns positions of all tiles matching the given type.
   */
  findTilesOfType(type: TileType): Position[] {
    const result: Position[] = [];

    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (this.tiles[y][x].type === type) {
          result.push({ x, y });
        }
      }
    }

    return result;
  }
}

export default Grid;
