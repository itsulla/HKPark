'use client';

// =============================================================================
// HK Theme Park Tycoon - Main PixiJS Canvas Component (optimized)
// =============================================================================
//
// Changes from original:
//   - Passes viewportBounds to ALL layers for frustum culling
//   - Tracks gridVersion counter for terrain/building dirty detection
//   - Uses screenToWorldTarget for click actions (no lerp lag)
//   - Supports space+left-click panning in addition to middle-mouse panning
//   - WASD keys for continuous camera movement
//   - Prevents context menu on right-click for clean middle-click behavior
// =============================================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import { useGameStore } from '../state/gameStore';
import { Camera } from './Camera';
import { TerrainLayer } from './layers/TerrainLayer';
import { BuildingLayer } from './layers/BuildingLayer';
import { GuestLayer } from './layers/GuestLayer';
import { StaffLayer } from './layers/StaffLayer';
import { UILayer } from './layers/UILayer';
import { AmbientLayer } from './layers/AmbientLayer';
import {
  ToolType,
  GameSpeed,
  Position,
  Tile,
  RideDefinition,
} from '../engine/types';
import ridesData from '../data/rides.json';
import SoundManager from '../audio/SoundManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a Map for O(1) ride definition lookup
const rideDefMap = new Map<string, RideDefinition>();
for (const r of ridesData as RideDefinition[]) {
  rideDefMap.set(r.id, r);
}

function findRideDef(defId: string): RideDefinition | undefined {
  return rideDefMap.get(defId);
}

/**
 * Compute the placement footprint for the current tool/definition, respecting
 * the current rotation.
 */
function getPlacementFootprint(
  tool: ToolType,
  definitionId: string | null,
  rotation: 0 | 1 | 2 | 3,
): { w: number; h: number } | null {
  switch (tool) {
    case ToolType.BUILD_PATH:
    case ToolType.PLACE_DECORATION:
    case ToolType.PLACE_SHOP:
      return { w: 1, h: 1 };

    case ToolType.DEMOLISH:
      // Demolish uses a single-tile highlight handled by UILayer directly,
      // not a placement footprint ghost. Return null so the ghost is skipped.
      return null;

    case ToolType.PLACE_RIDE: {
      if (!definitionId) return null;
      const def = findRideDef(definitionId);
      if (!def) return null;
      const { w, h } = def.footprint;
      if (rotation === 1 || rotation === 3) return { w: h, h: w };
      return { w, h };
    }

    default:
      return null;
  }
}

/**
 * Check if every tile in the footprint is within bounds, buildable, and empty
 * (or non-empty for demolish).
 */
function isPlacementValid(
  grid: Tile[][],
  tileX: number,
  tileY: number,
  footprint: { w: number; h: number },
  tool: ToolType,
): boolean {
  const gridH = grid.length;
  const gridW = grid[0]?.length ?? 0;

  for (let dy = 0; dy < footprint.h; dy++) {
    for (let dx = 0; dx < footprint.w; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) return false;

      const tile = grid[ty][tx];
      if (!tile.buildable) return false;

      if (tool === ToolType.DEMOLISH) {
        if (tile.type === 'EMPTY') return false;
      } else {
        if (tile.type !== 'EMPTY') return false;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const terrainLayerRef = useRef<TerrainLayer | null>(null);
  const buildingLayerRef = useRef<BuildingLayer | null>(null);
  const guestLayerRef = useRef<GuestLayer | null>(null);
  const staffLayerRef = useRef<StaffLayer | null>(null);
  const uiLayerRef = useRef<UILayer | null>(null);
  const ambientLayerRef = useRef<AmbientLayer | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  // Grid version counter: incremented whenever the grid changes so layers
  // can skip redraws when nothing changed. We track this by comparing the
  // grid reference (Immer produces new references on mutation).
  const gridVersionRef = useRef<number>(0);
  const lastGridRef = useRef<Tile[][] | null>(null);

  // Track held keys for continuous WASD panning
  const heldKeysRef = useRef<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // Event Handlers (stable references via useCallback)
  // -----------------------------------------------------------------------

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const camera = cameraRef.current;
    if (!camera) return;

    // Middle-button drag or space+left-click drag
    if (camera.isDragging || camera.isSpaceDragging) {
      camera.drag(e.clientX, e.clientY);
      return;
    }

    // Convert screen coords to tile coords for hover
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldPos = camera.screenToWorld(sx, sy);

    const store = useGameStore.getState();
    store.setHoveredTile({ x: worldPos.x, y: worldPos.y });
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const camera = cameraRef.current;
    if (!camera) return;

    // Middle mouse button (button 1) for panning
    if (e.button === 1) {
      e.preventDefault();
      camera.startDrag(e.clientX, e.clientY);
      return;
    }

    // Space+left-click for panning
    if (e.button === 0 && camera.spaceHeld) {
      e.preventDefault();
      camera.startSpaceDrag(e.clientX, e.clientY);
      return;
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (e.button === 1) {
      camera.endDrag();
    }
    if (e.button === 0 && camera.isSpaceDragging) {
      camera.endSpaceDrag();
    }
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    // Left click only, and not if we were space-dragging
    if (e.button !== 0) return;
    const camera = cameraRef.current;
    if (!camera) return;

    // If space is held, this click was for panning -- do not place anything
    if (camera.spaceHeld) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Use target-based conversion for accurate click-to-tile mapping
    const worldPos = camera.screenToWorldTarget(sx, sy);
    const store = useGameStore.getState();

    const tileX = worldPos.x;
    const tileY = worldPos.y;

    switch (store.selectedTool) {
      case ToolType.BUILD_PATH: {
        const ok = store.buildPath(tileX, tileY);
        if (ok) SoundManager.play('click');
        if (!ok) store.addNotification('Cannot build path here', 'warning');
        break;
      }

      case ToolType.PLACE_RIDE:
        if (store.placementDefinitionId) {
          const ok = store.placeRide(
            store.placementDefinitionId,
            tileX,
            tileY,
            store.placementRotation,
          );
          if (ok) SoundManager.play('build');
          if (!ok) store.addNotification('Must place ride on empty tiles adjacent to a path', 'warning');
        }
        break;

      case ToolType.PLACE_SHOP:
        if (store.placementDefinitionId) {
          const ok = store.placeShop(store.placementDefinitionId, tileX, tileY);
          if (ok) SoundManager.play('build');
          if (!ok) store.addNotification('Must place shop on empty tile adjacent to a path', 'warning');
        }
        break;

      case ToolType.PLACE_DECORATION:
        if (store.placementDefinitionId) {
          const ok = store.placeDecoration(store.placementDefinitionId, tileX, tileY);
          if (ok) SoundManager.play('build');
          if (!ok) store.addNotification('Cannot place decoration here', 'warning');
        }
        break;

      case ToolType.DEMOLISH: {
        const ok = store.demolish(tileX, tileY);
        if (ok) SoundManager.play('demolish');
        if (!ok) store.addNotification('Nothing to demolish here', 'warning');
        break;
      }

      case ToolType.SELECT: {
        const grid = store.grid;
        if (
          tileY >= 0 &&
          tileY < grid.length &&
          tileX >= 0 &&
          tileX < (grid[0]?.length ?? 0)
        ) {
          const tile = grid[tileY][tileX];
          store.setSelectedEntity(tile.entityId);
        } else {
          store.setSelectedEntity(null);
        }
        break;
      }

      default:
        break;
    }
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const camera = cameraRef.current;
    if (!camera) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    camera.zoomAt(sx, sy, e.deltaY);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Do not capture keys when an input or textarea is focused
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = e.key.toLowerCase();
    const store = useGameStore.getState();
    const camera = cameraRef.current;

    // Track held keys for continuous WASD panning
    heldKeysRef.current.add(key);

    // Space key: toggle pause OR enable space-drag mode
    if (key === ' ') {
      e.preventDefault();
      if (camera) camera.spaceHeld = true;
      return; // Space toggle-pause is handled on keyUp to avoid conflict with drag
    }

    switch (key) {
      case 'r':
        store.setPlacementRotation(
          ((store.placementRotation + 1) % 4) as 0 | 1 | 2 | 3,
        );
        break;

      case 'escape':
        store.setTool(ToolType.SELECT);
        store.setSelectedEntity(null);
        store.setPlacementDefinition(null);
        break;

      // Tool shortcuts 1-7
      case '1':
        store.setTool(ToolType.SELECT);
        break;
      case '2':
        store.setTool(ToolType.BUILD_PATH);
        break;
      case '3':
        store.setTool(ToolType.PLACE_RIDE);
        break;
      case '4':
        store.setTool(ToolType.PLACE_SHOP);
        break;
      case '5':
        store.setTool(ToolType.PLACE_DECORATION);
        break;
      case '6':
        store.setTool(ToolType.DEMOLISH);
        break;
      // '7' opens the Staff panel — handled by the Toolbar component.

      default:
        break;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    heldKeysRef.current.delete(key);

    const camera = cameraRef.current;

    if (key === ' ') {
      if (camera) {
        // If we were space-dragging, just end the drag without toggling pause
        if (camera.isSpaceDragging) {
          camera.endSpaceDrag();
        } else {
          // Space was pressed and released without dragging = toggle pause
          const store = useGameStore.getState();
          if (store.speed === GameSpeed.PAUSED) {
            store.setSpeed(GameSpeed.NORMAL);
          } else {
            store.setSpeed(GameSpeed.PAUSED);
          }
        }
        camera.spaceHeld = false;
      }
    }
  }, []);

  // Prevent context menu on canvas so middle-click works cleanly
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // -----------------------------------------------------------------------
  // PixiJS Initialization & Render Loop
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    mountedRef.current = true;

    let app: Application;

    const init = async () => {
      app = new Application();

      await app.init({
        antialias: false,
        background: 0x4a7c59,
        resizeTo: container,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (!mountedRef.current) {
        app.destroy(true);
        return;
      }

      // Append the canvas element to the container div
      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Create world container (Camera will transform this)
      const world = new Container();
      app.stage.addChild(world);

      // Camera
      const camera = new Camera(world);
      cameraRef.current = camera;

      // Create layers in render order
      const terrainLayer = new TerrainLayer();
      const buildingLayer = new BuildingLayer();
      const guestLayer = new GuestLayer();
      const staffLayer = new StaffLayer();
      const uiLayer = new UILayer();

      world.addChild(terrainLayer);
      world.addChild(buildingLayer);
      world.addChild(guestLayer);
      world.addChild(staffLayer);
      world.addChild(uiLayer);

      // Ambient overlay lives in SCREEN space (above the world), so the
      // day/night tint and rain cover the whole canvas regardless of camera.
      const ambientLayer = new AmbientLayer();
      app.stage.addChild(ambientLayer);

      terrainLayerRef.current = terrainLayer;
      buildingLayerRef.current = buildingLayer;
      guestLayerRef.current = guestLayer;
      staffLayerRef.current = staffLayer;
      uiLayerRef.current = uiLayer;
      ambientLayerRef.current = ambientLayer;

      // Bind DOM events
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      // -----------------------------------------------------------------
      // Main render loop
      // -----------------------------------------------------------------

      const PAN_SPEED = 6; // pixels per frame for WASD movement

      const tick = () => {
        if (!mountedRef.current) return;

        const state = useGameStore.getState();

        // --- Continuous WASD / arrow-key camera panning ---
        const held = heldKeysRef.current;
        if (held.has('w') || held.has('arrowup')) camera.pan(0, PAN_SPEED);
        if (held.has('s') || held.has('arrowdown')) camera.pan(0, -PAN_SPEED);
        if (held.has('a') || held.has('arrowleft')) camera.pan(PAN_SPEED, 0);
        if (held.has('d') || held.has('arrowright')) camera.pan(-PAN_SPEED, 0);

        // Update camera (lerp)
        camera.update();

        // Grid version tracking: if Immer produced a new grid reference,
        // bump the version counter
        if (state.grid !== lastGridRef.current) {
          gridVersionRef.current++;
          lastGridRef.current = state.grid;
        }

        // Compute viewport bounds in tile coordinates for frustum culling
        const canvasWidth = app.screen.width;
        const canvasHeight = app.screen.height;
        const viewportBounds = camera.getViewportBounds(
          canvasWidth,
          canvasHeight,
        );

        const zoom = camera.getZoom();

        // Update layers
        terrainLayer.update(
          state.grid,
          viewportBounds,
          zoom,
          gridVersionRef.current,
        );
        buildingLayer.update(state.rides, state.shops, viewportBounds);
        // Idle sway (paused game = frozen park).
        if (state.speed !== GameSpeed.PAUSED) {
          buildingLayer.animate(performance.now());
        }
        guestLayer.update(state.guests, zoom, viewportBounds);
        staffLayer.update(state.staff, viewportBounds);
        ambientLayer.update(
          state.currentTick,
          state.weather,
          canvasWidth,
          canvasHeight,
        );

        // UI layer: determine placement validity
        const hoveredTile = state.hoveredTile;
        const footprint = getPlacementFootprint(
          state.selectedTool,
          state.placementDefinitionId,
          state.placementRotation,
        );
        const validPlacement =
          hoveredTile && footprint
            ? isPlacementValid(
                state.grid,
                hoveredTile.x,
                hoveredTile.y,
                footprint,
                state.selectedTool,
              )
            : false;

        // Gather selected entity tiles
        let selectedEntityTiles: Position[] | null = null;
        if (state.selectedEntityId) {
          const ride = state.rides[state.selectedEntityId];
          if (ride) {
            selectedEntityTiles = ride.tiles;
          } else {
            const shop = state.shops[state.selectedEntityId];
            if (shop) {
              selectedEntityTiles = [shop.tile];
            }
          }
        }

        uiLayer.update(
          hoveredTile,
          state.selectedTool,
          validPlacement,
          footprint,
          state.selectedEntityId,
          selectedEntityTiles,
        );

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    init();

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);

      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);

        appRef.current.destroy(true);
        appRef.current = null;
      }

      // Remove any leftover canvas from the container
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }

      cameraRef.current = null;
      terrainLayerRef.current = null;
      buildingLayerRef.current = null;
      guestLayerRef.current = null;
      uiLayerRef.current = null;
    };
  }, [
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleClick,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    handleContextMenu,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    />
  );
}
