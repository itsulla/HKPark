// =============================================================================
// HK Theme Park Tycoon - Zustand Game Store (with Immer middleware)
// =============================================================================

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';

import type {
  Tile,
  Position,
  GameDate,
  Guest,
  Ride,
  RideDefinition,
  Shop,
  ShopDefinition,
  Staff,
  District,
  FinancialReport,
  DecorationDefinition,
  Notification,
  VIPDialogueLine,
} from '../engine/types';

import {
  TileType,
  GameSpeed,
  StaffType,
  Weather,
  Season,
  ToolType,
} from '../engine/types';

import districtsData from '../data/districts.json';
import ridesData from '../data/rides.json';
import shopsData from '../data/shops.json';
import decorationsData from '../data/decorations.json';
import staffData from '../data/staff.json';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const GRID_WIDTH = 60;
const GRID_HEIGHT = 60;
const INITIAL_MONEY = 500000;
const PATH_COST = 50;
const DEMOLISH_REFUND_RATE = 0.5;

// -----------------------------------------------------------------------------
// Store State Interface (uses Record instead of Map for immer compatibility)
// -----------------------------------------------------------------------------

export interface GameStoreState {
  // World
  grid: Tile[][];
  districts: District[];

  // Economy
  money: number;
  loanAmount: number;
  loanInterestRate: number;
  monthlyReports: FinancialReport[];

  // Time
  date: GameDate;
  speed: GameSpeed;
  currentTick: number;

  // Entities (Record for immer compatibility)
  guests: Record<string, Guest>;
  rides: Record<string, Ride>;
  shops: Record<string, Shop>;
  staff: Record<string, Staff>;

  // Park
  parkRating: number;
  parkName: string;
  totalGuestsAllTime: number;
  maxGuestsAtOnce: number;
  /** Accumulated litter; higher = dirtier park, lowers the cleanliness rating. */
  litter: number;

  // Environment
  weather: Weather;
  season: Season;

  // VIP commentary feed (Layer 2)
  vipDialogue: VIPDialogueLine[];

  // UI state
  selectedTool: ToolType;
  selectedEntityId: string | null;
  hoveredTile: Position | null;
  placementRotation: 0 | 1 | 2 | 3;
  placementDefinitionId: string | null;
  notifications: Notification[];
}

// -----------------------------------------------------------------------------
// Actions Interface
// -----------------------------------------------------------------------------

export interface GameStoreActions {
  // Initialization
  initGame: (parkName: string) => void;
  hydrateGame: (saved: Partial<GameStoreState>) => void;

  // Speed / Tool / UI
  setSpeed: (speed: GameSpeed) => void;
  setTool: (tool: ToolType) => void;
  setSelectedEntity: (entityId: string | null) => void;
  setHoveredTile: (pos: Position | null) => void;
  setPlacementRotation: (r: 0 | 1 | 2 | 3) => void;
  setPlacementDefinition: (defId: string | null) => void;

  // Building
  buildPath: (x: number, y: number) => boolean;
  placeRide: (
    definitionId: string,
    x: number,
    y: number,
    rotation: 0 | 1 | 2 | 3,
  ) => boolean;
  placeShop: (definitionId: string, x: number, y: number) => boolean;
  placeDecoration: (definitionId: string, x: number, y: number) => boolean;
  demolish: (x: number, y: number) => boolean;

  // Ride management
  openRide: (rideId: string) => void;
  closeRide: (rideId: string) => void;
  setTicketPrice: (rideId: string, price: number) => void;
  breakRide: (rideId: string) => void;
  repairRide: (rideId: string) => void;

  // Staff
  hireStaff: (type: StaffType, position: Position) => void;
  fireStaff: (staffId: string) => void;

  // Districts
  unlockDistrict: (districtId: string) => boolean;

  // Money
  addMoney: (amount: number, category: string, description: string) => void;
  spendMoney: (amount: number, category: string, description: string) => boolean;

  // Notifications
  addNotification: (
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
    entityId?: string,
  ) => void;

  // Environment
  updateWeather: (weather: Weather) => void;
  updateSeason: (season: Season) => void;

  // Time / Tick
  advanceTick: () => void;
  setDate: (date: GameDate) => void;

  // Simulation commit (bulk entity + money update from one game-loop tick)
  applySimulationResult: (result: SimulationResult) => void;

  // Entity updates
  updateGuest: (guestId: string, updates: Partial<Guest>) => void;
  addGuest: (guest: Guest) => void;
  removeGuest: (guestId: string) => void;
  updateRide: (rideId: string, updates: Partial<Ride>) => void;

  // Financial reports
  addMonthlyReport: (report: FinancialReport) => void;
  setParkRating: (rating: number) => void;

  // VIP commentary
  addVipDialogue: (line: VIPDialogueLine) => void;
}

export type GameStore = GameStoreState & GameStoreActions;

/**
 * Result of one simulation tick, computed by the game loop on cloned entities
 * and committed back to the store in a single update.
 */
export interface SimulationResult {
  guests: Record<string, Guest>;
  rides: Record<string, Ride>;
  shops: Record<string, Shop>;
  staff: Record<string, Staff>;
  /** Net revenue (ride tickets + shop sales) earned this tick. */
  revenue: number;
  /** Number of guests spawned this tick (for lifetime stats). */
  newGuestCount: number;
  /** New accumulated litter value after this tick's generation + cleaning. */
  litter: number;
}

// -----------------------------------------------------------------------------
// Grid Helpers (operate on raw Tile[][] without needing the Grid class)
// -----------------------------------------------------------------------------

function createEmptyGrid(width: number, height: number): Tile[][] {
  const tiles: Tile[][] = [];
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
    tiles.push(row);
  }
  return tiles;
}

function isInBounds(grid: Tile[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0);
}

function getTile(grid: Tile[][], x: number, y: number): Tile | null {
  if (!isInBounds(grid, x, y)) return null;
  return grid[y][x];
}

function isAreaFree(
  grid: Tile[][],
  startX: number,
  startY: number,
  w: number,
  h: number,
): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tile = getTile(grid, startX + dx, startY + dy);
      if (!tile || tile.type !== TileType.EMPTY || !tile.buildable) {
        return false;
      }
    }
  }
  return true;
}

function isAdjacentToPath(
  grid: Tile[][],
  x: number,
  y: number,
  w: number = 1,
  h: number = 1,
): boolean {
  const directions: Position[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      for (const dir of directions) {
        const tile = getTile(grid, x + dx + dir.x, y + dy + dir.y);
        if (tile && (tile.type === TileType.PATH || tile.type === TileType.ENTRANCE)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Find a PATH/ENTRANCE tile adjacent to a footprint — where guests stand to
 * queue. Returns null if none is adjacent (should not happen after the
 * isAdjacentToPath placement check).
 */
function findAdjacentPathTile(
  grid: Tile[][],
  x: number,
  y: number,
  w: number,
  h: number,
): Position | null {
  const directions: Position[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      for (const dir of directions) {
        const tile = getTile(grid, x + dx + dir.x, y + dy + dir.y);
        if (
          tile &&
          (tile.type === TileType.PATH || tile.type === TileType.ENTRANCE)
        ) {
          return { x: tile.x, y: tile.y };
        }
      }
    }
  }
  return null;
}

function markDistrictTiles(grid: Tile[][], district: District): void {
  const { x: startX, y: startY, w, h } = district.tiles;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = startX + dx;
      const ty = startY + dy;
      if (isInBounds(grid, tx, ty)) {
        grid[ty][tx].buildable = true;
      }
    }
  }
}

function placeEntityOnGrid(
  grid: Tile[][],
  startX: number,
  startY: number,
  w: number,
  h: number,
  entityId: string,
  tileType: TileType,
): boolean {
  if (!isAreaFree(grid, startX, startY, w, h)) {
    return false;
  }

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      grid[startY + dy][startX + dx].type = tileType;
      grid[startY + dy][startX + dx].entityId = entityId;
    }
  }

  return true;
}

function removeEntityFromGrid(grid: Tile[][], entityId: string): Position[] {
  const freed: Position[] = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x++) {
      const tile = grid[y][x];
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
 * Compute footprint w/h based on rotation.
 * Rotation 0 and 2 keep original w/h; rotation 1 and 3 swap them.
 */
function rotatedFootprint(
  w: number,
  h: number,
  rotation: 0 | 1 | 2 | 3,
): { w: number; h: number } {
  if (rotation === 1 || rotation === 3) {
    return { w: h, h: w };
  }
  return { w, h };
}

// -----------------------------------------------------------------------------
// Data Lookup Helpers
// -----------------------------------------------------------------------------

function findRideDefinition(definitionId: string): RideDefinition | undefined {
  return (ridesData as RideDefinition[]).find((r) => r.id === definitionId);
}

function findShopDefinition(definitionId: string): ShopDefinition | undefined {
  return (shopsData as ShopDefinition[]).find((s) => s.id === definitionId);
}

function findDecorationDefinition(
  definitionId: string,
): DecorationDefinition | undefined {
  return (decorationsData as DecorationDefinition[]).find(
    (d) => d.id === definitionId,
  );
}

function findStaffData(
  type: StaffType,
): { id: string; name: string; type: string; salary: number } | undefined {
  return staffData.find((s) => s.type === type);
}

// -----------------------------------------------------------------------------
// Default Initial State
// -----------------------------------------------------------------------------

function createInitialState(): GameStoreState {
  return {
    grid: createEmptyGrid(GRID_WIDTH, GRID_HEIGHT),
    money: INITIAL_MONEY,
    date: { day: 1, month: 1, year: 1 },
    speed: GameSpeed.NORMAL,
    guests: {},
    rides: {},
    shops: {},
    staff: {},
    districts: (districtsData as District[]).map((d) => ({ ...d })),
    parkRating: 0,
    parkName: 'My HK Park',
    litter: 0,
    selectedTool: ToolType.SELECT,
    loanAmount: 0,
    loanInterestRate: 0.1,
    monthlyReports: [],
    totalGuestsAllTime: 0,
    maxGuestsAtOnce: 0,
    weather: Weather.CLEAR,
    season: Season.SPRING,
    currentTick: 0,
    vipDialogue: [],
    notifications: [],
    selectedEntityId: null,
    hoveredTile: null,
    placementRotation: 0,
    placementDefinitionId: null,
  };
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    // Spread default state
    ...createInitialState(),

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    initGame: (parkName: string) => {
      set((state) => {
        // Reset to initial state
        const fresh = createInitialState();
        Object.assign(state, fresh);

        state.parkName = parkName;

        // Unlock Mong Kok (first district)
        const mongKok = state.districts.find((d) => d.id === 'mong-kok');
        if (mongKok) {
          mongKok.unlocked = true;
          markDistrictTiles(state.grid, mongKok);

          // Place entrance at bottom-center of Mong Kok area
          const entranceX = mongKok.tiles.x + Math.floor(mongKok.tiles.w / 2);
          const entranceY = mongKok.tiles.y + mongKok.tiles.h - 1;

          if (isInBounds(state.grid, entranceX, entranceY)) {
            state.grid[entranceY][entranceX].type = TileType.ENTRANCE;
            state.grid[entranceY][entranceX].entityId = 'entrance-main';
          }
        }
      });
    },

    /**
     * Restore a previously saved game. Starts from fresh defaults (so any
     * fields missing from an older save get sane values) and overlays the
     * persisted gameplay data. Transient UI/selection state is reset rather
     * than restored.
     */
    hydrateGame: (saved: Partial<GameStoreState>) => {
      set((state) => {
        Object.assign(state, createInitialState());

        const PERSIST_KEYS: (keyof GameStoreState)[] = [
          'grid',
          'districts',
          'money',
          'loanAmount',
          'loanInterestRate',
          'monthlyReports',
          'date',
          'speed',
          'currentTick',
          'guests',
          'rides',
          'shops',
          'staff',
          'parkRating',
          'parkName',
          'totalGuestsAllTime',
          'maxGuestsAtOnce',
          'litter',
          'weather',
          'season',
        ];

        for (const key of PERSIST_KEYS) {
          if (saved[key] !== undefined) {
            (state as Record<string, unknown>)[key] = saved[key];
          }
        }

        // Sanitize numeric fields a corrupt/old save could poison.
        state.litter = Number.isFinite(state.litter)
          ? Math.max(0, state.litter)
          : 0;

        // Reset transient UI / selection state — never restored from a save.
        state.selectedTool = ToolType.SELECT;
        state.selectedEntityId = null;
        state.hoveredTile = null;
        state.placementRotation = 0;
        state.placementDefinitionId = null;
        state.notifications = [];
      });
    },

    // -------------------------------------------------------------------------
    // Speed / Tool / UI
    // -------------------------------------------------------------------------

    setSpeed: (speed: GameSpeed) => {
      set((state) => {
        state.speed = speed;
      });
    },

    setTool: (tool: ToolType) => {
      set((state) => {
        state.selectedTool = tool;
      });
    },

    setSelectedEntity: (entityId: string | null) => {
      set((state) => {
        state.selectedEntityId = entityId;
      });
    },

    setHoveredTile: (pos: Position | null) => {
      set((state) => {
        state.hoveredTile = pos;
      });
    },

    setPlacementRotation: (r: 0 | 1 | 2 | 3) => {
      set((state) => {
        state.placementRotation = r;
      });
    },

    setPlacementDefinition: (defId: string | null) => {
      set((state) => {
        state.placementDefinitionId = defId;
      });
    },

    // -------------------------------------------------------------------------
    // Building
    // -------------------------------------------------------------------------

    buildPath: (x: number, y: number): boolean => {
      let success = false;

      set((state) => {
        const tile = getTile(state.grid, x, y);
        if (!tile) return;
        if (!tile.buildable) return;
        if (tile.type !== TileType.EMPTY) return;
        if (state.money < PATH_COST) return;

        state.grid[y][x].type = TileType.PATH;
        state.money -= PATH_COST;
        success = true;
      });

      return success;
    },

    placeRide: (
      definitionId: string,
      x: number,
      y: number,
      rotation: 0 | 1 | 2 | 3,
    ): boolean => {
      let success = false;

      set((state) => {
        const def = findRideDefinition(definitionId);
        if (!def) return;
        if (state.money < def.baseCost) return;

        const { w, h } = rotatedFootprint(
          def.footprint.w,
          def.footprint.h,
          rotation,
        );

        // Check area is free
        if (!isAreaFree(state.grid, x, y, w, h)) return;

        // Check adjacent to path
        if (!isAdjacentToPath(state.grid, x, y, w, h)) return;

        const rideId = uuidv4();

        // Collect tile positions for the ride footprint
        const tiles: Position[] = [];
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            tiles.push({ x: x + dx, y: y + dy });
          }
        }

        // Place on grid
        const placed = placeEntityOnGrid(
          state.grid,
          x,
          y,
          w,
          h,
          rideId,
          TileType.RIDE_FOOTPRINT,
        );
        if (!placed) return;

        // Entrance/exit: the adjacent PATH tile guests walk to and queue on.
        // Falls back to the bottom-center edge if (somehow) no path is adjacent.
        const pathTile = findAdjacentPathTile(state.grid, x, y, w, h);
        const entranceTile: Position = pathTile ?? {
          x: x + Math.floor(w / 2),
          y: y + h,
        };
        const exitTile: Position = { x: entranceTile.x, y: entranceTile.y };

        // Create ride entity
        const ride: Ride = {
          id: rideId,
          definitionId: def.id,
          name: def.name,
          tiles,
          entranceTile,
          exitTile,
          rotation,
          excitement: def.baseExcitement,
          intensity: def.baseIntensity,
          nausea: def.baseNausea,
          maxQueue: def.capacity * 3,
          currentQueue: [],
          ridersOnBoard: [],
          status: 'closed',
          monthlyMaintenanceCost: def.monthlyMaintenance,
          monthsOld: 0,
          totalCustomers: 0,
          totalRevenue: 0,
          ticketPrice: def.suggestedPrice,
          lastBreakdown: null,
          rideTimer: 0,
        };

        state.rides[rideId] = ride;
        state.money -= def.baseCost;
        success = true;
      });

      return success;
    },

    placeShop: (definitionId: string, x: number, y: number): boolean => {
      let success = false;

      set((state) => {
        const def = findShopDefinition(definitionId);
        if (!def) return;
        if (state.money < def.cost) return;

        // Shops are 1x1
        if (!isAreaFree(state.grid, x, y, 1, 1)) return;
        if (!isAdjacentToPath(state.grid, x, y, 1, 1)) return;

        const shopId = uuidv4();

        const placed = placeEntityOnGrid(
          state.grid,
          x,
          y,
          1,
          1,
          shopId,
          TileType.SHOP_FOOTPRINT,
        );
        if (!placed) return;

        const shop: Shop = {
          id: shopId,
          definitionId: def.id,
          name: def.name,
          tile: { x, y },
          revenue: 0,
          monthlyMaintenance: def.monthlyMaintenance,
          stock: def.maxStock,
          maxStock: def.maxStock,
        };

        state.shops[shopId] = shop;
        state.money -= def.cost;
        success = true;
      });

      return success;
    },

    placeDecoration: (definitionId: string, x: number, y: number): boolean => {
      let success = false;

      set((state) => {
        const def = findDecorationDefinition(definitionId);
        if (!def) return;
        if (state.money < def.cost) return;

        // Decorations are 1x1
        if (!isAreaFree(state.grid, x, y, 1, 1)) return;

        const decoId = uuidv4();

        const placed = placeEntityOnGrid(
          state.grid,
          x,
          y,
          1,
          1,
          decoId,
          TileType.DECORATION,
        );
        if (!placed) return;

        // Update scenery scores for nearby tiles
        const radius = 3;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const tile = getTile(state.grid, x + dx, y + dy);
            if (tile) {
              tile.sceneryScore += def.sceneryValue;
            }
          }
        }

        state.money -= def.cost;
        success = true;
      });

      return success;
    },

    demolish: (x: number, y: number): boolean => {
      let success = false;

      set((state) => {
        const tile = getTile(state.grid, x, y);
        if (!tile) return;
        if (tile.type === TileType.EMPTY || tile.type === TileType.ENTRANCE) return;

        // Handle path demolition
        if (tile.type === TileType.PATH) {
          state.grid[y][x].type = TileType.EMPTY;
          state.grid[y][x].entityId = null;
          // Refund 50% of path cost
          state.money += Math.floor(PATH_COST * DEMOLISH_REFUND_RATE);
          success = true;
          return;
        }

        const entityId = tile.entityId;
        if (!entityId) return;

        // Check if it's a ride
        const ride = state.rides[entityId];
        if (ride) {
          const def = findRideDefinition(ride.definitionId);
          removeEntityFromGrid(state.grid, entityId);
          delete state.rides[entityId];
          if (def) {
            state.money += Math.floor(def.baseCost * DEMOLISH_REFUND_RATE);
          }
          success = true;
          return;
        }

        // Check if it's a shop
        const shop = state.shops[entityId];
        if (shop) {
          const def = findShopDefinition(shop.definitionId);
          removeEntityFromGrid(state.grid, entityId);
          delete state.shops[entityId];
          if (def) {
            state.money += Math.floor(def.cost * DEMOLISH_REFUND_RATE);
          }
          success = true;
          return;
        }

        // Decoration
        if (tile.type === TileType.DECORATION) {
          // For decorations we don't track them in a map, so refund based on tile.
          // We use a flat refund rate since we don't store the definition reference.
          removeEntityFromGrid(state.grid, entityId);
          // Small flat refund for decorations since we don't store their definition
          state.money += 100;
          success = true;
          return;
        }
      });

      return success;
    },

    // -------------------------------------------------------------------------
    // Ride Management
    // -------------------------------------------------------------------------

    openRide: (rideId: string) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (ride && (ride.status === 'closed' || ride.status === 'building')) {
          ride.status = 'open';
        }
      });
    },

    closeRide: (rideId: string) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (ride && ride.status === 'open') {
          ride.status = 'closed';
        }
      });
    },

    setTicketPrice: (rideId: string, price: number) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (ride) {
          ride.ticketPrice = Math.max(0, price);
        }
      });
    },

    breakRide: (rideId: string) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (ride && ride.status === 'open') {
          ride.status = 'broken';
          ride.currentQueue = [];
          ride.ridersOnBoard = [];
          ride.rideTimer = 0;
          ride.lastBreakdown = { ...state.date };
        }
      });
    },

    repairRide: (rideId: string) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (ride && ride.status === 'broken') {
          ride.status = 'open';
        }
      });
    },

    // -------------------------------------------------------------------------
    // Staff
    // -------------------------------------------------------------------------

    hireStaff: (type: StaffType, position: Position) => {
      set((state) => {
        const staffDef = findStaffData(type);
        if (!staffDef) return;

        const staffId = uuidv4();
        const member: Staff = {
          id: staffId,
          name: `${staffDef.name} ${Object.keys(state.staff).length + 1}`,
          type,
          tile: position,
          patrolArea: null,
          salary: staffDef.salary,
        };

        state.staff[staffId] = member;
      });
    },

    fireStaff: (staffId: string) => {
      set((state) => {
        delete state.staff[staffId];
      });
    },

    // -------------------------------------------------------------------------
    // Districts
    // -------------------------------------------------------------------------

    unlockDistrict: (districtId: string): boolean => {
      let success = false;

      set((state) => {
        const district = state.districts.find((d) => d.id === districtId);
        if (!district) return;
        if (district.unlocked) return;
        if (state.money < district.unlockCost) return;

        district.unlocked = true;
        state.money -= district.unlockCost;

        // Mark tiles as buildable
        markDistrictTiles(state.grid, district);

        success = true;
      });

      return success;
    },

    // -------------------------------------------------------------------------
    // Money
    // -------------------------------------------------------------------------

    addMoney: (amount: number, _category: string, _description: string) => {
      set((state) => {
        state.money += amount;
      });
    },

    spendMoney: (
      amount: number,
      _category: string,
      _description: string,
    ): boolean => {
      let success = false;

      set((state) => {
        if (state.money < amount) return;
        state.money -= amount;
        success = true;
      });

      return success;
    },

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    addNotification: (
      message: string,
      type: 'info' | 'warning' | 'error' | 'success',
      entityId?: string,
    ) => {
      set((state) => {
        const notification: Notification = {
          id: uuidv4(),
          message,
          type,
          timestamp: { ...state.date },
          entityId,
          read: false,
        };

        state.notifications.push(notification);

        // Keep only the last 50 notifications
        if (state.notifications.length > 50) {
          state.notifications = state.notifications.slice(-50);
        }
      });
    },

    // -------------------------------------------------------------------------
    // Environment
    // -------------------------------------------------------------------------

    updateWeather: (weather: Weather) => {
      set((state) => {
        state.weather = weather;
      });
    },

    updateSeason: (season: Season) => {
      set((state) => {
        state.season = season;
      });
    },

    // -------------------------------------------------------------------------
    // Tick
    // -------------------------------------------------------------------------

    advanceTick: () => {
      set((state) => {
        state.currentTick += 1;
      });
    },

    setDate: (date: GameDate) => {
      set((state) => {
        state.date = date;
      });
    },

    applySimulationResult: (result: SimulationResult) => {
      set((state) => {
        // Guests are entirely simulation-owned — replace wholesale.
        state.guests = result.guests;

        // Rides/shops/staff are ALSO player-owned (open/close, ticket price,
        // hiring, demolition). Merge only the simulation-owned fields into
        // entities that still exist; never resurrect ones the player removed
        // since the tick snapshot, and never overwrite player-owned fields
        // like status / ticketPrice.
        for (const id of Object.keys(result.rides)) {
          const cur = state.rides[id];
          if (!cur) continue;
          const sim = result.rides[id];
          cur.currentQueue = sim.currentQueue;
          cur.ridersOnBoard = sim.ridersOnBoard;
          cur.rideTimer = sim.rideTimer;
          cur.totalRevenue = sim.totalRevenue;
          cur.totalCustomers = sim.totalCustomers;
          cur.lastBreakdown = sim.lastBreakdown;
        }
        for (const id of Object.keys(result.shops)) {
          const cur = state.shops[id];
          if (!cur) continue;
          cur.revenue = result.shops[id].revenue;
          cur.stock = result.shops[id].stock;
        }
        for (const id of Object.keys(result.staff)) {
          const cur = state.staff[id];
          if (!cur) continue;
          cur.tile = result.staff[id].tile;
          cur.patrolArea = result.staff[id].patrolArea;
        }

        if (result.revenue !== 0) {
          state.money += result.revenue;
        }
        if (result.newGuestCount > 0) {
          state.totalGuestsAllTime += result.newGuestCount;
        }
        state.litter = result.litter;

        const count = Object.keys(result.guests).length;
        if (count > state.maxGuestsAtOnce) {
          state.maxGuestsAtOnce = count;
        }
      });
    },

    // -------------------------------------------------------------------------
    // Entity Updates
    // -------------------------------------------------------------------------

    updateGuest: (guestId: string, updates: Partial<Guest>) => {
      set((state) => {
        const guest = state.guests[guestId];
        if (!guest) return;
        Object.assign(guest, updates);
      });
    },

    addGuest: (guest: Guest) => {
      set((state) => {
        state.guests[guest.id] = guest;
        state.totalGuestsAllTime += 1;

        const currentCount = Object.keys(state.guests).length;
        if (currentCount > state.maxGuestsAtOnce) {
          state.maxGuestsAtOnce = currentCount;
        }
      });
    },

    removeGuest: (guestId: string) => {
      set((state) => {
        delete state.guests[guestId];
      });
    },

    updateRide: (rideId: string, updates: Partial<Ride>) => {
      set((state) => {
        const ride = state.rides[rideId];
        if (!ride) return;
        Object.assign(ride, updates);
      });
    },

    // -------------------------------------------------------------------------
    // Financial Reports
    // -------------------------------------------------------------------------

    addMonthlyReport: (report: FinancialReport) => {
      set((state) => {
        state.monthlyReports.push(report);
      });
    },

    setParkRating: (rating: number) => {
      set((state) => {
        state.parkRating = Math.max(0, Math.min(1000, rating));
      });
    },

    addVipDialogue: (line: VIPDialogueLine) => {
      set((state) => {
        state.vipDialogue.push(line);
        // Keep only the most recent lines.
        if (state.vipDialogue.length > 12) {
          state.vipDialogue = state.vipDialogue.slice(-12);
        }
      });
    },
  })),
);

export default useGameStore;
