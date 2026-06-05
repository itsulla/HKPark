// =============================================================================
// HK Theme Park Tycoon - UI Overlay Layer (improved)
// =============================================================================
//
// Renders:
//   - Placement ghost (semi-transparent footprint) for build tools
//   - Cursor tile highlight for SELECT, DEMOLISH, and build tools
//   - Selection highlight for the currently selected entity
//
// Fixes:
//   - SELECT tool now shows a neutral white hover highlight
//   - DEMOLISH tool shows a red-tinted hover highlight (single tile)
//   - Placement footprint ghost works correctly for all building tools
// =============================================================================

import { Container, Graphics } from 'pixi.js';
import { Position, ToolType } from '../../engine/types';
import { TILE_SIZE } from '../Camera';

const VALID_COLOR = 0x27ae60;
const INVALID_COLOR = 0xe74c3c;
const SELECT_HOVER_COLOR = 0xffffff;
const DEMOLISH_HOVER_COLOR = 0xe74c3c;
const SELECTION_COLOR = 0x3498db;

export class UILayer extends Container {
  private gfx: Graphics;

  constructor() {
    super();
    this.gfx = new Graphics();
    this.addChild(this.gfx);
  }

  /**
   * Draw hover highlights, placement ghosts, and selection indicators.
   *
   * @param hoveredTile        - the tile the cursor is over (or null)
   * @param selectedTool       - the currently active tool
   * @param isValidPlacement   - whether the hovered position is a valid placement
   * @param placementFootprint - footprint size when a building tool is active
   * @param selectedEntityId   - ID of the selected entity (for info panel)
   * @param selectedEntityTiles - tiles belonging to the selected entity
   */
  update(
    hoveredTile: Position | null,
    selectedTool: ToolType,
    isValidPlacement: boolean,
    placementFootprint: { w: number; h: number } | null,
    selectedEntityId: string | null,
    selectedEntityTiles: Position[] | null,
  ): void {
    this.gfx.clear();

    // --- Placement ghost (semi-transparent footprint) for build tools ---
    // Applies to: PLACE_RIDE, PLACE_SHOP, PLACE_DECORATION, BUILD_PATH
    if (
      hoveredTile &&
      placementFootprint &&
      selectedTool !== ToolType.SELECT &&
      selectedTool !== ToolType.DEMOLISH &&
      selectedTool !== ToolType.TERRAFORM
    ) {
      const px = hoveredTile.x * TILE_SIZE;
      const py = hoveredTile.y * TILE_SIZE;
      const pw = placementFootprint.w * TILE_SIZE;
      const ph = placementFootprint.h * TILE_SIZE;

      const ghostColor = isValidPlacement ? VALID_COLOR : INVALID_COLOR;

      // Filled ghost
      this.gfx.rect(px, py, pw, ph);
      this.gfx.fill({ color: ghostColor, alpha: 0.3 });

      // Border
      this.gfx.rect(px, py, pw, ph);
      this.gfx.stroke({ color: ghostColor, width: 2, alpha: 0.8 });
    }

    // --- Demolish tool: red-tinted single-tile hover ---
    if (hoveredTile && selectedTool === ToolType.DEMOLISH) {
      const px = hoveredTile.x * TILE_SIZE;
      const py = hoveredTile.y * TILE_SIZE;

      this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
      this.gfx.fill({ color: DEMOLISH_HOVER_COLOR, alpha: 0.2 });
      this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
      this.gfx.stroke({ color: DEMOLISH_HOVER_COLOR, width: 2, alpha: 0.8 });
    }

    // --- SELECT tool: neutral white hover highlight ---
    if (hoveredTile && selectedTool === ToolType.SELECT) {
      const px = hoveredTile.x * TILE_SIZE;
      const py = hoveredTile.y * TILE_SIZE;

      this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
      this.gfx.stroke({ color: SELECT_HOVER_COLOR, width: 2, alpha: 0.6 });
    }

    // --- Selected entity highlight ---
    if (
      selectedEntityId &&
      selectedEntityTiles &&
      selectedEntityTiles.length > 0
    ) {
      for (const tile of selectedEntityTiles) {
        const px = tile.x * TILE_SIZE;
        const py = tile.y * TILE_SIZE;

        this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
        this.gfx.fill({ color: SELECTION_COLOR, alpha: 0.15 });
        this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
        this.gfx.stroke({ color: SELECTION_COLOR, width: 2, alpha: 0.7 });
      }
    }
  }
}
