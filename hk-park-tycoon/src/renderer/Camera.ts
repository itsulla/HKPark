// =============================================================================
// HK Theme Park Tycoon - Camera Controller
// =============================================================================

import { Container } from 'pixi.js';

export const TILE_SIZE = 32;
const LERP_FACTOR = 0.15;
const LERP_SNAP_THRESHOLD = 0.5; // Stop lerping when close enough

export interface ViewportBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Camera {
  public worldContainer: Container;

  // Current interpolated values (used for rendering)
  public x: number = 0;
  public y: number = 0;
  public zoom: number = 1;

  // Target values (what we lerp toward)
  public targetX: number = 0;
  public targetY: number = 0;
  public targetZoom: number = 1;

  public readonly minZoom: number = 0.5;
  public readonly maxZoom: number = 3;

  // Middle-mouse drag state
  public isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Space+left-click drag state
  public isSpaceDragging: boolean = false;
  public spaceHeld: boolean = false;

  // Track whether camera moved since last frame (for dirty detection)
  private _dirty: boolean = true;

  constructor(worldContainer: Container) {
    this.worldContainer = worldContainer;
  }

  // ---------------------------------------------------------------------------
  // Drag (middle-mouse)
  // ---------------------------------------------------------------------------

  /** Begin a middle-mouse drag. */
  startDrag(screenX: number, screenY: number): void {
    this.isDragging = true;
    this.lastMouseX = screenX;
    this.lastMouseY = screenY;
  }

  /** Continue dragging -- move the world container. */
  drag(screenX: number, screenY: number): void {
    if (!this.isDragging && !this.isSpaceDragging) return;

    const dx = screenX - this.lastMouseX;
    const dy = screenY - this.lastMouseY;

    this.targetX += dx;
    this.targetY += dy;

    this.lastMouseX = screenX;
    this.lastMouseY = screenY;
    this._dirty = true;
  }

  /** End the middle-mouse drag. */
  endDrag(): void {
    this.isDragging = false;
  }

  // ---------------------------------------------------------------------------
  // Space+left-click drag
  // ---------------------------------------------------------------------------

  startSpaceDrag(screenX: number, screenY: number): void {
    this.isSpaceDragging = true;
    this.lastMouseX = screenX;
    this.lastMouseY = screenY;
  }

  endSpaceDrag(): void {
    this.isSpaceDragging = false;
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  /**
   * Zoom toward a specific screen position.
   * @param screenX - cursor X in screen pixels
   * @param screenY - cursor Y in screen pixels
   * @param delta - wheel delta (positive = zoom out, negative = zoom in)
   */
  zoomAt(screenX: number, screenY: number, delta: number): void {
    const oldZoom = this.targetZoom;
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, oldZoom * zoomFactor),
    );

    if (newZoom === oldZoom) return;

    // Standard zoom-toward-cursor formula:
    // Keep the world point under the cursor fixed.
    // worldPoint = (screenX - camX) / camZoom
    // After zoom: screenX - newCamX = worldPoint * newZoom
    // => newCamX = screenX - worldPoint * newZoom
    const worldX = (screenX - this.targetX) / oldZoom;
    const worldY = (screenY - this.targetY) / oldZoom;

    this.targetZoom = newZoom;
    this.targetX = screenX - worldX * newZoom;
    this.targetY = screenY - worldY * newZoom;
    this._dirty = true;
  }

  // ---------------------------------------------------------------------------
  // Keyboard pan
  // ---------------------------------------------------------------------------

  /** Keyboard pan (WASD / arrow keys). dx and dy are in screen pixels. */
  pan(dx: number, dy: number): void {
    this.targetX += dx;
    this.targetY += dy;
    this._dirty = true;
  }

  // ---------------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------------

  /** Smoothly interpolate current values toward targets. Call every frame. */
  update(): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dz = this.targetZoom - this.zoom;

    // Snap to target when close enough to avoid perpetual micro-updates
    if (Math.abs(dx) < LERP_SNAP_THRESHOLD &&
        Math.abs(dy) < LERP_SNAP_THRESHOLD &&
        Math.abs(dz) < 0.001) {
      if (this.x !== this.targetX ||
          this.y !== this.targetY ||
          this.zoom !== this.targetZoom) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.zoom = this.targetZoom;
        this._dirty = true;
      }
    } else {
      this.x += dx * LERP_FACTOR;
      this.y += dy * LERP_FACTOR;
      this.zoom += dz * LERP_FACTOR;
      this._dirty = true;
    }

    this.worldContainer.x = this.x;
    this.worldContainer.y = this.y;
    this.worldContainer.scale.set(this.zoom);
  }

  // ---------------------------------------------------------------------------
  // Coordinate conversion
  // ---------------------------------------------------------------------------

  /**
   * Convert screen pixel coordinates to tile coordinates.
   * Uses TARGET position (not interpolated) for accurate click-to-tile mapping.
   * Returns integer tile indices (floored).
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Use current interpolated values for smooth visual feedback,
    // but for click actions the caller can use screenToWorldTarget.
    const worldPixelX = (screenX - this.x) / this.zoom;
    const worldPixelY = (screenY - this.y) / this.zoom;

    return {
      x: Math.floor(worldPixelX / TILE_SIZE),
      y: Math.floor(worldPixelY / TILE_SIZE),
    };
  }

  /**
   * Convert screen pixel coordinates to tile coordinates using TARGET values.
   * This gives the "true" tile position without lerp lag -- use for clicks.
   */
  screenToWorldTarget(screenX: number, screenY: number): { x: number; y: number } {
    const worldPixelX = (screenX - this.targetX) / this.targetZoom;
    const worldPixelY = (screenY - this.targetY) / this.targetZoom;

    return {
      x: Math.floor(worldPixelX / TILE_SIZE),
      y: Math.floor(worldPixelY / TILE_SIZE),
    };
  }

  /** Convert tile coordinates to screen pixel coordinates. */
  worldToScreen(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * TILE_SIZE * this.zoom + this.x,
      y: tileY * TILE_SIZE * this.zoom + this.y,
    };
  }

  /** Current zoom level. */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Compute the visible area in tile coordinates, with a margin
   * for partially visible tiles at the edges.
   */
  getViewportBounds(canvasWidth: number, canvasHeight: number): ViewportBounds {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);

    return {
      x: topLeft.x - 1,
      y: topLeft.y - 1,
      w: bottomRight.x - topLeft.x + 3,
      h: bottomRight.y - topLeft.y + 3,
    };
  }

  /** Whether the camera moved since the last consumeDirty() call. */
  get dirty(): boolean {
    return this._dirty;
  }

  /** Consume the dirty flag (call after re-rendering). */
  consumeDirty(): void {
    this._dirty = false;
  }
}
