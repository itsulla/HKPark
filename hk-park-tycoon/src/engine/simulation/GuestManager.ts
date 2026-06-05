// =============================================================================
// HK Theme Park Tycoon - Guest AI Manager
// =============================================================================

import {
  Guest,
  GuestState,
  Ride,
  RideDefinition,
  Shop,
  ShopDefinition,
  ShopCategory,
  Position,
  TileType,
} from '../types';
import { Grid } from '../world/Grid';
import { Pathfinder } from '../world/Pathfinder';
import { EventBus } from '../core/EventBus';
import { getRandomGuestName } from './GuestNameGenerator';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Helper: Gaussian random using Box-Muller, clamped to [min, max]
// -----------------------------------------------------------------------------

function gaussianRandom(mean: number, stddev: number, min: number, max: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const value = mean + z * stddev;
  return Math.max(min, Math.min(max, value));
}

// -----------------------------------------------------------------------------
// Helper: Manhattan distance
// -----------------------------------------------------------------------------

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// -----------------------------------------------------------------------------
// Helper: Clamp a value to [min, max]
// -----------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// -----------------------------------------------------------------------------
// Helper: Move guest toward next waypoint along currentPath
// Returns true if guest has arrived at the end of the path
// -----------------------------------------------------------------------------

function moveAlongPath(guest: Guest, speed: number): boolean {
  if (guest.currentPath.length === 0) {
    return true;
  }

  const target = guest.currentPath[0];
  const dx = target.x - guest.x;
  const dy = target.y - guest.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= speed) {
    // Snap to waypoint and advance to next
    guest.x = target.x;
    guest.y = target.y;
    guest.currentPath.shift();
    return guest.currentPath.length === 0;
  }

  // Move toward waypoint
  guest.x += (dx / dist) * speed;
  guest.y += (dy / dist) * speed;
  return false;
}

// -----------------------------------------------------------------------------
// Internal interface for tracking per-guest timers
// (not on the Guest type itself to keep it serializable)
// -----------------------------------------------------------------------------

interface GuestTimers {
  queueStartTick: number;
  rideStartTick: number;
  rideDuration: number;
  shoppingTimer: number;
  sittingTimer: number;
  lostTimer: number;
}

// -----------------------------------------------------------------------------
// GuestManager
// -----------------------------------------------------------------------------

export class GuestManager {
  private readonly eventBus: EventBus;
  private readonly timers: Map<string, GuestTimers> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Spawn
  // ---------------------------------------------------------------------------

  spawnGuest(entranceTile: Position): Guest {
    const guest: Guest = {
      id: uuidv4(),
      name: getRandomGuestName(),
      x: entranceTile.x,
      y: entranceTile.y,
      state: GuestState.ENTERING,
      happiness: 180 + Math.random() * 40,
      happinessTarget: 150 + Math.random() * 50,
      hunger: 20 + Math.random() * 40,
      thirst: 20 + Math.random() * 40,
      nausea: 0,
      energy: 200 + Math.random() * 55,
      intensityTolerance: gaussianRandom(5, 2, 1, 10),
      nauseaTolerance: gaussianRandom(5, 2, 1, 10),
      cash: 80 + Math.random() * 220,
      currentPath: [],
      targetTile: null,
      currentRideId: null,
      ridesRidden: [],
      thoughtBubble: null,
      timeInPark: 0,
      pathfindFailures: 0,
    };

    this.timers.set(guest.id, {
      queueStartTick: 0,
      rideStartTick: 0,
      rideDuration: 0,
      shoppingTimer: 0,
      sittingTimer: 0,
      lostTimer: 0,
    });

    this.eventBus.emit('guest-entered', { guestId: guest.id });

    return guest;
  }

  // ---------------------------------------------------------------------------
  // Main tick processor for a single guest
  // ---------------------------------------------------------------------------

  processGuest(
    guest: Guest,
    grid: Grid,
    rides: Record<string, Ride>,
    shops: Record<string, Shop>,
    rideDefinitions: Record<string, RideDefinition>,
    shopDefinitions: Record<string, ShopDefinition>,
    currentTick: number,
  ): Guest {
    // Ensure we have timers for this guest
    if (!this.timers.has(guest.id)) {
      this.timers.set(guest.id, {
        queueStartTick: 0,
        rideStartTick: 0,
        rideDuration: 0,
        shoppingTimer: 0,
        sittingTimer: 0,
        lostTimer: 0,
      });
    }

    const timers = this.timers.get(guest.id)!;

    // --- State handlers ---
    switch (guest.state) {
      case GuestState.ENTERING:
        this.processEntering(guest, grid);
        break;

      case GuestState.WALKING:
        this.processWalking(guest, grid, rides, shops, rideDefinitions, shopDefinitions, timers, currentTick);
        break;

      case GuestState.QUEUING:
        this.processQueuing(guest, rides, rideDefinitions, timers, currentTick);
        break;

      case GuestState.RIDING:
        this.processRiding(guest, rides, rideDefinitions, timers, currentTick);
        break;

      case GuestState.SHOPPING:
        this.processShopping(guest, shops, shopDefinitions, timers);
        break;

      case GuestState.SITTING:
        this.processSitting(guest, timers);
        break;

      case GuestState.LEAVING:
        this.processLeaving(guest, grid);
        break;

      case GuestState.LOST:
        this.processLost(guest, grid, timers);
        break;

      default:
        break;
    }

    // --- Passive updates (every tick, all states) ---
    guest.hunger += 0.15;
    guest.thirst += 0.2;
    guest.nausea = Math.max(0, guest.nausea - 0.1);
    guest.energy -= 0.05;
    guest.happiness += (guest.happinessTarget - guest.happiness) * 0.003;
    guest.timeInPark++;

    // Clamp all values to valid ranges (0-255)
    guest.happiness = clamp(guest.happiness, 0, 255);
    guest.hunger = clamp(guest.hunger, 0, 255);
    guest.thirst = clamp(guest.thirst, 0, 255);
    guest.nausea = clamp(guest.nausea, 0, 255);
    guest.energy = clamp(guest.energy, 0, 255);
    guest.cash = Math.max(0, guest.cash);

    // --- Leave conditions (check every 30 ticks) ---
    if (
      guest.timeInPark % 30 === 0 &&
      guest.state !== GuestState.LEAVING &&
      guest.state !== GuestState.RIDING
    ) {
      if (guest.happiness < 80) {
        guest.state = GuestState.LEAVING;
        guest.currentPath = [];
        guest.targetTile = null;
        guest.thoughtBubble = 'Not having fun...';
      } else if (guest.cash < 10) {
        guest.state = GuestState.LEAVING;
        guest.currentPath = [];
        guest.targetTile = null;
        guest.thoughtBubble = 'Running out of money!';
      } else if (guest.timeInPark > 600) {
        guest.state = GuestState.LEAVING;
        guest.currentPath = [];
        guest.targetTile = null;
        guest.thoughtBubble = 'Time to go home.';
      }
    }

    return guest;
  }

  // ---------------------------------------------------------------------------
  // Process all guests (batch)
  // ---------------------------------------------------------------------------

  processAllGuests(
    guests: Record<string, Guest>,
    grid: Grid,
    rides: Record<string, Ride>,
    shops: Record<string, Shop>,
    rideDefinitions: Record<string, RideDefinition>,
    shopDefinitions: Record<string, ShopDefinition>,
    currentTick: number,
  ): { updated: Record<string, Guest>; removed: string[] } {
    const updated: Record<string, Guest> = {};
    const removed: string[] = [];
    let processed = 0;

    const guestIds = Object.keys(guests);
    for (const guestId of guestIds) {
      if (processed >= 100) break;

      const guest = guests[guestId];
      const result = this.processGuest(
        guest,
        grid,
        rides,
        shops,
        rideDefinitions,
        shopDefinitions,
        currentTick,
      );

      // Check if guest has reached the entrance while leaving
      if (result.state === GuestState.LEAVING && this.isAtEntrance(result, grid)) {
        this.eventBus.emit('guest-left', {
          guestId: result.id,
          reason: result.thoughtBubble ?? 'finished visit',
        });
        removed.push(result.id);
        this.timers.delete(result.id);
      } else {
        updated[guestId] = result;
      }

      processed++;
    }

    // Carry forward any unprocessed guests
    for (const guestId of guestIds) {
      if (!(guestId in updated) && !removed.includes(guestId)) {
        updated[guestId] = guests[guestId];
      }
    }

    return { updated, removed };
  }

  // ---------------------------------------------------------------------------
  // Spawn timing helper
  // ---------------------------------------------------------------------------

  shouldSpawn(currentTick: number, spawnInterval: number): boolean {
    return spawnInterval > 0 && currentTick % spawnInterval === 0;
  }

  // ---------------------------------------------------------------------------
  // Clean up timers for a removed guest
  // ---------------------------------------------------------------------------

  removeGuestTimers(guestId: string): void {
    this.timers.delete(guestId);
  }

  // ---------------------------------------------------------------------------
  // State: ENTERING
  // ---------------------------------------------------------------------------

  private processEntering(guest: Guest, grid: Grid): void {
    if (guest.currentPath.length === 0) {
      // Find nearest PATH tile from entrance
      const guestPos: Position = { x: Math.round(guest.x), y: Math.round(guest.y) };
      const nearestPath = Pathfinder.findNearestOfType(grid, guestPos, TileType.PATH, 20);

      if (nearestPath) {
        const path = Pathfinder.findPath(grid, guestPos, nearestPath);
        if (path) {
          guest.currentPath = path;
        }
      }
    }

    if (guest.currentPath.length > 0) {
      moveAlongPath(guest, 0.1);
    }

    // Check if guest is now on a PATH tile
    const currentTile = grid.getTile(Math.round(guest.x), Math.round(guest.y));
    if (currentTile && currentTile.type === TileType.PATH) {
      guest.state = GuestState.WALKING;
      guest.currentPath = [];
    }
  }

  // ---------------------------------------------------------------------------
  // State: WALKING
  // ---------------------------------------------------------------------------

  private processWalking(
    guest: Guest,
    grid: Grid,
    rides: Record<string, Ride>,
    shops: Record<string, Shop>,
    rideDefinitions: Record<string, RideDefinition>,
    shopDefinitions: Record<string, ShopDefinition>,
    timers: GuestTimers,
    currentTick: number,
  ): void {
    // Decision-making every 10 ticks
    if (guest.timeInPark % 10 === 0 && guest.currentPath.length === 0) {
      const guestPos: Position = { x: Math.round(guest.x), y: Math.round(guest.y) };

      // Priority 1: Nausea high AND energy low -> sit
      if (guest.nausea > 170 && guest.energy < 80) {
        guest.state = GuestState.SITTING;
        timers.sittingTimer = 30 + Math.floor(Math.random() * 30);
        guest.thoughtBubble = 'Feeling sick...need to sit down';
        return;
      }

      // Priority 2: Hungry -> find food shop
      if (guest.hunger > 180) {
        const target = this.findNearestShopOfCategory(
          guestPos, grid, shops, shopDefinitions, ShopCategory.FOOD,
        );
        if (target) {
          const path = Pathfinder.findPath(grid, guestPos, target.adjacentPath);
          if (path) {
            guest.currentPath = path;
            guest.targetTile = target.shopTile;
            guest.state = GuestState.SHOPPING;
            timers.shoppingTimer = 0;
            guest.thoughtBubble = 'So hungry!';
            return;
          }
        }
      }

      // Priority 3: Thirsty -> find drink shop
      if (guest.thirst > 180) {
        const target = this.findNearestShopOfCategory(
          guestPos, grid, shops, shopDefinitions, ShopCategory.DRINK,
        );
        if (target) {
          const path = Pathfinder.findPath(grid, guestPos, target.adjacentPath);
          if (path) {
            guest.currentPath = path;
            guest.targetTile = target.shopTile;
            guest.state = GuestState.SHOPPING;
            timers.shoppingTimer = 0;
            guest.thoughtBubble = 'So thirsty!';
            return;
          }
        }
      }

      // Priority 4: Low happiness and has ridden rides -> leave
      if (guest.happiness < 100 && guest.ridesRidden.length > 0) {
        guest.state = GuestState.LEAVING;
        guest.currentPath = [];
        guest.targetTile = null;
        guest.thoughtBubble = 'This park is boring...';
        return;
      }

      // Priority 5: Very low energy -> sit
      if (guest.energy < 50) {
        guest.state = GuestState.SITTING;
        timers.sittingTimer = 30 + Math.floor(Math.random() * 30);
        guest.thoughtBubble = 'Need to rest my legs';
        return;
      }

      // Priority 6: 60% chance pick a ride
      const roll = Math.random();
      if (roll < 0.6) {
        const selectedRide = this.selectRide(guest, guestPos, grid, rides, rideDefinitions, currentTick);
        if (selectedRide) {
          const path = Pathfinder.findPath(grid, guestPos, selectedRide.entranceTile);
          if (path) {
            guest.currentPath = path;
            guest.targetTile = selectedRide.entranceTile;
            guest.currentRideId = selectedRide.id;
            guest.thoughtBubble = `Going to ${selectedRide.name}!`;
            // Stay in WALKING until we arrive, then switch to QUEUING
            return;
          }
        }
      }

      // Priority 7: 20% chance pick a shop
      if (roll >= 0.6 && roll < 0.8) {
        const shopEntries = Object.values(shops);
        if (shopEntries.length > 0) {
          const randomShop = shopEntries[Math.floor(Math.random() * shopEntries.length)];
          const shopAdjacentPath = this.findAdjacentPath(grid, randomShop.tile);
          if (shopAdjacentPath) {
            const path = Pathfinder.findPath(grid, guestPos, shopAdjacentPath);
            if (path) {
              guest.currentPath = path;
              guest.targetTile = randomShop.tile;
              guest.state = GuestState.SHOPPING;
              timers.shoppingTimer = 0;
              guest.thoughtBubble = 'Let me check out that shop';
              return;
            }
          }
        }
      }

      // Otherwise: wander randomly to a nearby PATH tile
      this.wanderRandom(guest, grid);
    }

    // Movement
    if (guest.currentPath.length > 0) {
      const arrived = moveAlongPath(guest, 0.1);

      if (arrived) {
        // Check if we arrived at a ride entrance -> QUEUING
        if (guest.currentRideId) {
          const ride = rides[guest.currentRideId];
          if (ride && ride.status === 'open') {
            guest.state = GuestState.QUEUING;
            const t = this.timers.get(guest.id);
            if (t) {
              t.queueStartTick = currentTick;
            }
          } else {
            // Ride closed/broken
            guest.currentRideId = null;
            guest.thoughtBubble = 'Ride is closed!';
          }
        }
      }
    } else if (guest.currentRideId === null) {
      // No path and no target - increment pathfind failures
      guest.pathfindFailures++;
      if (guest.pathfindFailures >= 3) {
        guest.state = GuestState.LOST;
        const t = this.timers.get(guest.id);
        if (t) {
          t.lostTimer = 0;
        }
        guest.thoughtBubble = "I'm lost!";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State: QUEUING
  // ---------------------------------------------------------------------------

  private processQueuing(
    guest: Guest,
    rides: Record<string, Ride>,
    rideDefinitions: Record<string, RideDefinition>,
    timers: GuestTimers,
    currentTick: number,
  ): void {
    if (!guest.currentRideId) {
      guest.state = GuestState.WALKING;
      return;
    }

    const ride = rides[guest.currentRideId];
    if (!ride || ride.status !== 'open') {
      guest.currentRideId = null;
      guest.state = GuestState.WALKING;
      guest.thoughtBubble = 'Ride broke down!';
      return;
    }

    // Add to queue if not already there
    if (!ride.currentQueue.includes(guest.id)) {
      ride.currentQueue.push(guest.id);
    }

    // Per-tick queue effects
    guest.happiness -= 0.05;
    guest.energy -= 0.02;

    // Patience check
    const patience = ride.excitement * 15;
    if (currentTick - timers.queueStartTick > patience) {
      // Leave queue
      ride.currentQueue = ride.currentQueue.filter((id) => id !== guest.id);
      guest.currentRideId = null;
      guest.state = GuestState.WALKING;
      guest.currentPath = [];
      guest.thoughtBubble = 'Queue is too long!';
      return;
    }

    // Check if at front of queue and ride has capacity
    const rideDef = rideDefinitions[ride.definitionId];
    if (!rideDef) {
      // Can't find definition, leave queue
      ride.currentQueue = ride.currentQueue.filter((id) => id !== guest.id);
      guest.currentRideId = null;
      guest.state = GuestState.WALKING;
      return;
    }

    if (
      ride.currentQueue[0] === guest.id &&
      ride.ridersOnBoard.length < rideDef.capacity &&
      ride.rideTimer === 0
    ) {
      // Board the ride
      ride.currentQueue.shift();
      ride.ridersOnBoard.push(guest.id);
      guest.state = GuestState.RIDING;
      timers.rideStartTick = currentTick;
      timers.rideDuration = rideDef.rideDurationTicks;
    }
  }

  // ---------------------------------------------------------------------------
  // State: RIDING
  // ---------------------------------------------------------------------------

  private processRiding(
    guest: Guest,
    rides: Record<string, Ride>,
    rideDefinitions: Record<string, RideDefinition>,
    timers: GuestTimers,
    currentTick: number,
  ): void {
    if (!guest.currentRideId) {
      guest.state = GuestState.WALKING;
      return;
    }

    const ride = rides[guest.currentRideId];
    if (!ride) {
      guest.currentRideId = null;
      guest.state = GuestState.WALKING;
      return;
    }

    // Check if ride duration is complete
    if (currentTick - timers.rideStartTick >= timers.rideDuration) {
      // Ride complete - apply effects
      const happinessBefore = guest.happiness;
      guest.happiness += ride.excitement * 8;
      guest.nausea += ride.nausea * 6;
      guest.energy -= ride.intensity * 3;
      guest.cash -= ride.ticketPrice;

      // Track ride
      guest.ridesRidden.push(ride.id);

      // Remove from riders
      ride.ridersOnBoard = ride.ridersOnBoard.filter((id) => id !== guest.id);

      // Set thought bubble based on happiness change
      const happinessGain = guest.happiness - happinessBefore;
      if (happinessGain > 30) {
        guest.thoughtBubble = `${ride.name} was amazing!`;
      } else if (happinessGain > 10) {
        guest.thoughtBubble = `${ride.name} was fun!`;
      } else if (happinessGain > 0) {
        guest.thoughtBubble = `${ride.name} was okay.`;
      } else {
        guest.thoughtBubble = `${ride.name} was not great...`;
      }

      // Move to exit tile
      guest.x = ride.exitTile.x;
      guest.y = ride.exitTile.y;
      guest.currentRideId = null;
      guest.state = GuestState.WALKING;
      guest.currentPath = [];
    }
  }

  // ---------------------------------------------------------------------------
  // State: SHOPPING
  // ---------------------------------------------------------------------------

  private processShopping(
    guest: Guest,
    shops: Record<string, Shop>,
    shopDefinitions: Record<string, ShopDefinition>,
    timers: GuestTimers,
  ): void {
    // Move toward shop if still traveling
    if (guest.currentPath.length > 0) {
      moveAlongPath(guest, 0.1);
      return;
    }

    // At the shop: purchasing takes 5 ticks
    timers.shoppingTimer++;

    if (timers.shoppingTimer >= 5) {
      // Find which shop we're at
      const shop = this.findShopNear(guest, shops);
      if (shop) {
        const shopDef = shopDefinitions[shop.definitionId];
        if (shopDef) {
          switch (shopDef.category) {
            case ShopCategory.FOOD:
              guest.hunger -= 120;
              guest.cash -= 15;
              shop.revenue += 15;
              guest.thoughtBubble = 'That hit the spot!';
              break;
            case ShopCategory.DRINK:
              guest.thirst -= 100;
              guest.cash -= 10;
              shop.revenue += 10;
              guest.thoughtBubble = 'Refreshing!';
              break;
            case ShopCategory.SOUVENIR:
              guest.happiness += 15;
              guest.cash -= 25;
              shop.revenue += 25;
              guest.thoughtBubble = 'Nice souvenir!';
              break;
            case ShopCategory.FACILITY:
              guest.nausea -= 100;
              guest.thoughtBubble = 'Feeling better.';
              break;
          }

          // Decrement stock if applicable
          if (shop.stock > 0) {
            shop.stock--;
          }
        }
      }

      // Done shopping
      guest.state = GuestState.WALKING;
      guest.targetTile = null;
      guest.currentPath = [];
      timers.shoppingTimer = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // State: SITTING
  // ---------------------------------------------------------------------------

  private processSitting(guest: Guest, timers: GuestTimers): void {
    guest.energy += 2;
    guest.nausea -= 1;

    timers.sittingTimer--;

    if (timers.sittingTimer <= 0) {
      guest.state = GuestState.WALKING;
      guest.currentPath = [];
      guest.thoughtBubble = 'Feeling rested!';
    }
  }

  // ---------------------------------------------------------------------------
  // State: LEAVING
  // ---------------------------------------------------------------------------

  private processLeaving(guest: Guest, grid: Grid): void {
    if (guest.currentPath.length === 0) {
      const guestPos: Position = { x: Math.round(guest.x), y: Math.round(guest.y) };
      const entrance = Pathfinder.findNearestOfType(grid, guestPos, TileType.ENTRANCE, 100);
      if (entrance) {
        const path = Pathfinder.findPath(grid, guestPos, entrance);
        if (path) {
          guest.currentPath = path;
        }
      }
    }

    if (guest.currentPath.length > 0) {
      moveAlongPath(guest, 0.1);
    }
  }

  // ---------------------------------------------------------------------------
  // State: LOST
  // ---------------------------------------------------------------------------

  private processLost(guest: Guest, grid: Grid, timers: GuestTimers): void {
    timers.lostTimer++;
    guest.happiness -= 2;

    // Check adjacent tiles for a PATH
    const guestTileX = Math.round(guest.x);
    const guestTileY = Math.round(guest.y);
    const adjacent = grid.getAdjacentTiles(guestTileX, guestTileY);

    for (const tile of adjacent) {
      if (tile.type === TileType.PATH) {
        guest.x = tile.x;
        guest.y = tile.y;
        guest.state = GuestState.WALKING;
        guest.currentPath = [];
        guest.pathfindFailures = 0;
        guest.thoughtBubble = 'Found my way!';
        return;
      }
    }

    // Wander randomly
    const dirs: Position[] = [
      { x: 0.1, y: 0 }, { x: -0.1, y: 0 },
      { x: 0, y: 0.1 }, { x: 0, y: -0.1 },
    ];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const newX = guest.x + dir.x;
    const newY = guest.y + dir.y;
    if (grid.isInBounds(Math.round(newX), Math.round(newY))) {
      guest.x = newX;
      guest.y = newY;
    }

    // Mercy mechanic: after 50 ticks, teleport to nearest PATH
    if (timers.lostTimer >= 50) {
      const guestPos: Position = { x: guestTileX, y: guestTileY };
      const nearestPath = Pathfinder.findNearestOfType(grid, guestPos, TileType.PATH, 50);
      if (nearestPath) {
        guest.x = nearestPath.x;
        guest.y = nearestPath.y;
        guest.state = GuestState.WALKING;
        guest.currentPath = [];
        guest.pathfindFailures = 0;
        guest.thoughtBubble = 'Where am I?';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ride selection logic
  // ---------------------------------------------------------------------------

  private selectRide(
    guest: Guest,
    guestPos: Position,
    grid: Grid,
    rides: Record<string, Ride>,
    _rideDefinitions: Record<string, RideDefinition>,
    _currentTick: number,
  ): Ride | null {
    const rideList = Object.values(rides);

    // We only know the ride ID and the current tick, not when each ride was ridden.
    // Use ridesRidden: most recent N rides (approximate by last 900-tick window).
    // Since we don't store timestamps per ride, treat the last entries as "recent."
    const recentCount = Math.min(guest.ridesRidden.length, 5);
    const recentRideIds = new Set(guest.ridesRidden.slice(-recentCount));

    const candidates: Array<{ ride: Ride; score: number }> = [];

    for (const ride of rideList) {
      // Must be open
      if (ride.status !== 'open') continue;

      // Queue not full
      if (ride.currentQueue.length >= ride.maxQueue) continue;

      // Intensity check
      if (ride.intensity > guest.intensityTolerance + 2) continue;

      // Nausea check
      if (ride.nausea > guest.nauseaTolerance + 1) continue;

      // Skip recently ridden
      if (recentRideIds.has(ride.id)) continue;

      // Score
      const dist = manhattan(guestPos, ride.entranceTile);
      const score =
        ride.excitement * 2 -
        dist * 0.1 -
        ride.currentQueue.length * 0.5;

      candidates.push({ ride, score });
    }

    if (candidates.length === 0) return null;

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Pick from top 3 (or fewer)
    const topN = Math.min(3, candidates.length);
    const pick = Math.floor(Math.random() * topN);
    return candidates[pick].ride;
  }

  // ---------------------------------------------------------------------------
  // Shop finding helpers
  // ---------------------------------------------------------------------------

  private findNearestShopOfCategory(
    guestPos: Position,
    grid: Grid,
    shops: Record<string, Shop>,
    shopDefinitions: Record<string, ShopDefinition>,
    category: ShopCategory,
  ): { shopTile: Position; adjacentPath: Position } | null {
    let bestShop: Shop | null = null;
    let bestDist = Infinity;

    for (const shop of Object.values(shops)) {
      const shopDef = shopDefinitions[shop.definitionId];
      if (!shopDef || shopDef.category !== category) continue;
      if (shop.stock <= 0 && category !== ShopCategory.FACILITY) continue;

      const dist = manhattan(guestPos, shop.tile);
      if (dist < bestDist) {
        bestDist = dist;
        bestShop = shop;
      }
    }

    if (!bestShop) return null;

    const adjacentPath = this.findAdjacentPath(grid, bestShop.tile);
    if (!adjacentPath) return null;

    return { shopTile: bestShop.tile, adjacentPath };
  }

  private findAdjacentPath(grid: Grid, tile: Position): Position | null {
    const adjacent = grid.getAdjacentTiles(tile.x, tile.y);
    for (const adj of adjacent) {
      if (adj.type === TileType.PATH) {
        return { x: adj.x, y: adj.y };
      }
    }
    return null;
  }

  private findShopNear(guest: Guest, shops: Record<string, Shop>): Shop | null {
    const gx = Math.round(guest.x);
    const gy = Math.round(guest.y);

    // Check the target tile first
    if (guest.targetTile) {
      for (const shop of Object.values(shops)) {
        if (shop.tile.x === guest.targetTile.x && shop.tile.y === guest.targetTile.y) {
          return shop;
        }
      }
    }

    // Fallback: find nearest shop within 2 tiles
    let bestShop: Shop | null = null;
    let bestDist = Infinity;

    for (const shop of Object.values(shops)) {
      const dist = manhattan({ x: gx, y: gy }, shop.tile);
      if (dist <= 2 && dist < bestDist) {
        bestDist = dist;
        bestShop = shop;
      }
    }

    return bestShop;
  }

  // ---------------------------------------------------------------------------
  // Wander helpers
  // ---------------------------------------------------------------------------

  private wanderRandom(guest: Guest, grid: Grid): void {
    const guestPos: Position = { x: Math.round(guest.x), y: Math.round(guest.y) };
    const walkable = grid.getWalkableNeighbors(guestPos.x, guestPos.y);

    if (walkable.length === 0) return;

    // Pick a random walkable neighbor, then try to pathfind a few tiles further
    const target = walkable[Math.floor(Math.random() * walkable.length)];

    // Try to find a PATH tile a few steps away for variety
    const farTarget = Pathfinder.findNearestOfType(
      grid,
      target,
      TileType.PATH,
      5 + Math.floor(Math.random() * 10),
    );

    if (farTarget) {
      const path = Pathfinder.findPath(grid, guestPos, farTarget);
      if (path) {
        guest.currentPath = path;
        guest.pathfindFailures = 0;
        return;
      }
    }

    // Fallback: just move to the immediate neighbor
    guest.currentPath = [target];
    guest.pathfindFailures = 0;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  private isAtEntrance(guest: Guest, grid: Grid): boolean {
    const tile = grid.getTile(Math.round(guest.x), Math.round(guest.y));
    return tile !== null && tile.type === TileType.ENTRANCE;
  }
}

export default GuestManager;
