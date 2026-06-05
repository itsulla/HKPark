// =============================================================================
// HK Theme Park Tycoon - A* Pathfinding
// =============================================================================

import { Position, TileType } from '../types';
import { Grid } from './Grid';

// -----------------------------------------------------------------------------
// MinHeap for A* open set (priority queue by f-score)
// -----------------------------------------------------------------------------

interface HeapNode {
  position: Position;
  f: number;
  g: number;
}

class MinHeap {
  private data: HeapNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: HeapNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.data.length === 0) {
      return undefined;
    }

    const top = this.data[0];
    const last = this.data.pop()!;

    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }

    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.data[parentIndex].f <= this.data[index].f) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.data.length;

    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < length && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const temp = this.data[a];
    this.data[a] = this.data[b];
    this.data[b] = temp;
  }
}

// -----------------------------------------------------------------------------
// Pathfinder
// -----------------------------------------------------------------------------

export class Pathfinder {
  private static cache: Map<string, Position[] | null> = new Map();

  /**
   * A* pathfinding from start to end on the given grid.
   * Only traverses tiles of type PATH or ENTRANCE.
   * Returns an array of positions from start to end inclusive, or null if no path.
   */
  static findPath(
    grid: Grid,
    start: Position,
    end: Position,
    maxIterations: number = 2000,
  ): Position[] | null {
    const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;

    // Check cache
    if (Pathfinder.cache.has(cacheKey)) {
      const cached = Pathfinder.cache.get(cacheKey);
      // Return a copy so callers cannot mutate the cached array
      return cached ? [...cached] : null;
    }

    // Validate start and end tiles
    const startTile = grid.getTile(start.x, start.y);
    const endTile = grid.getTile(end.x, end.y);
    if (!startTile || !endTile) {
      Pathfinder.cache.set(cacheKey, null);
      return null;
    }

    if (
      (startTile.type !== TileType.PATH && startTile.type !== TileType.ENTRANCE) ||
      (endTile.type !== TileType.PATH && endTile.type !== TileType.ENTRANCE)
    ) {
      Pathfinder.cache.set(cacheKey, null);
      return null;
    }

    // Same tile
    if (start.x === end.x && start.y === end.y) {
      const result = [{ x: start.x, y: start.y }];
      Pathfinder.cache.set(cacheKey, result);
      return [...result];
    }

    // A* search
    const openSet = new MinHeap();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const startKey = `${start.x},${start.y}`;
    const endKey = `${end.x},${end.y}`;

    gScore.set(startKey, 0);
    openSet.push({
      position: { x: start.x, y: start.y },
      g: 0,
      f: Pathfinder.manhattan(start, end),
    });

    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      const current = openSet.pop()!;
      const currentKey = `${current.position.x},${current.position.y}`;

      if (currentKey === endKey) {
        // Reconstruct path
        const path = Pathfinder.reconstructPath(cameFrom, endKey);
        Pathfinder.cache.set(cacheKey, path);
        return [...path];
      }

      if (closedSet.has(currentKey)) {
        continue;
      }
      closedSet.add(currentKey);

      const neighbors = grid.getWalkableNeighbors(current.position.x, current.position.y);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = current.g + 1;
        const existingG = gScore.get(neighborKey);

        if (existingG === undefined || tentativeG < existingG) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);

          const f = tentativeG + Pathfinder.manhattan(neighbor, end);
          openSet.push({ position: neighbor, g: tentativeG, f });
        }
      }
    }

    // No path found
    Pathfinder.cache.set(cacheKey, null);
    return null;
  }

  /**
   * Clears the entire path cache.
   */
  static invalidateCache(): void {
    Pathfinder.cache.clear();
  }

  /**
   * Removes cache entries whose start or end position falls within the
   * given radius of (x, y).
   */
  static invalidateNear(x: number, y: number, radius: number): void {
    const keysToRemove: string[] = [];

    for (const key of Array.from(Pathfinder.cache.keys())) {
      const [startPart, endPart] = key.split('-');
      const [sx, sy] = startPart.split(',').map(Number);
      const [ex, ey] = endPart.split(',').map(Number);

      const startDist = Math.abs(sx - x) + Math.abs(sy - y);
      const endDist = Math.abs(ex - x) + Math.abs(ey - y);

      if (startDist <= radius || endDist <= radius) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      Pathfinder.cache.delete(key);
    }
  }

  /**
   * BFS outward from `from` to find the nearest tile of the given TileType,
   * within maxDistance (Manhattan distance).
   * Returns the position of the nearest matching tile, or null if none found.
   */
  static findNearestOfType(
    grid: Grid,
    from: Position,
    tileType: TileType,
    maxDistance: number,
  ): Position | null {
    const visited = new Set<string>();
    const queue: { pos: Position; dist: number }[] = [{ pos: from, dist: 0 }];
    visited.add(`${from.x},${from.y}`);

    const directions: Position[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.dist > 0) {
        const tile = grid.getTile(current.pos.x, current.pos.y);
        if (tile && tile.type === tileType) {
          return { x: current.pos.x, y: current.pos.y };
        }
      }

      if (current.dist >= maxDistance) {
        continue;
      }

      for (const dir of directions) {
        const nx = current.pos.x + dir.x;
        const ny = current.pos.y + dir.y;
        const key = `${nx},${ny}`;

        if (!visited.has(key) && grid.isInBounds(nx, ny)) {
          visited.add(key);
          queue.push({ pos: { x: nx, y: ny }, dist: current.dist + 1 });
        }
      }
    }

    return null;
  }

  /**
   * BFS outward from `from` to find the nearest tile whose entityId starts
   * with the given prefix (e.g., "ride-" or "shop-"), within maxDistance.
   * Returns the position of the nearest matching tile, or null if none found.
   */
  static findNearestEntity(
    grid: Grid,
    from: Position,
    entityPrefix: string,
    maxDistance: number,
  ): Position | null {
    const visited = new Set<string>();
    const queue: { pos: Position; dist: number }[] = [{ pos: from, dist: 0 }];
    visited.add(`${from.x},${from.y}`);

    const directions: Position[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.dist > 0) {
        const tile = grid.getTile(current.pos.x, current.pos.y);
        if (tile && tile.entityId !== null && tile.entityId.startsWith(entityPrefix)) {
          return { x: current.pos.x, y: current.pos.y };
        }
      }

      if (current.dist >= maxDistance) {
        continue;
      }

      for (const dir of directions) {
        const nx = current.pos.x + dir.x;
        const ny = current.pos.y + dir.y;
        const key = `${nx},${ny}`;

        if (!visited.has(key) && grid.isInBounds(nx, ny)) {
          visited.add(key);
          queue.push({ pos: { x: nx, y: ny }, dist: current.dist + 1 });
        }
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static manhattan(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private static reconstructPath(
    cameFrom: Map<string, string>,
    endKey: string,
  ): Position[] {
    const path: Position[] = [];
    let current: string | undefined = endKey;

    while (current !== undefined) {
      const [cx, cy] = current.split(',').map(Number);
      path.push({ x: cx, y: cy });
      current = cameFrom.get(current);
    }

    path.reverse();
    return path;
  }
}
