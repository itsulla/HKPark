// =============================================================================
// HK Theme Park Tycoon - RideManager (Ride Simulation)
// =============================================================================

import { Ride, RideDefinition, Position, TileType } from '../types';
import { Grid } from '../world/Grid';
import { EventBus } from '../core/EventBus';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCENERY_BONUS_MULTIPLIER = 0.08;
const SCENERY_BONUS_CAP = 0.4;
const SCENERY_RADIUS = 5;
const PROXIMITY_RADIUS = 8;
const PROXIMITY_EXCITEMENT_BONUS = 0.1;
const PROXIMITY_BONUS_CAP = 0.5;
const AGE_DECAY_THRESHOLD_MONTHS = 6;
const AGE_DECAY_PER_MONTH = 0.02;
const AGE_DECAY_MAX = 1.0;

// -----------------------------------------------------------------------------
// RideManager
// -----------------------------------------------------------------------------

export class RideManager {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Place Ride
  // ---------------------------------------------------------------------------

  /**
   * Attempt to place a ride on the grid. Returns the new Ride entity on
   * success, or null if placement is invalid (area not free, not adjacent
   * to a path, or out of bounds).
   */
  placeRide(
    definition: RideDefinition,
    x: number,
    y: number,
    rotation: 0 | 1 | 2 | 3,
    grid: Grid,
  ): Ride | null {
    // Determine effective footprint based on rotation
    const isRotated90or270 = rotation === 1 || rotation === 3;
    const w = isRotated90or270 ? definition.footprint.h : definition.footprint.w;
    const h = isRotated90or270 ? definition.footprint.w : definition.footprint.h;

    // Validate placement area
    if (!grid.isAreaFree(x, y, w, h)) {
      return null;
    }

    if (!grid.isAdjacentToPath(x, y, w, h)) {
      return null;
    }

    const rideId = `ride-${uuidv4()}`;

    // Compute entrance and exit tiles based on rotation.
    // The entrance is placed on the path-adjacent side of the footprint.
    // rotation 0 = entrance at bottom, exit at top
    // rotation 1 = entrance at left, exit at right
    // rotation 2 = entrance at top, exit at bottom
    // rotation 3 = entrance at right, exit at left
    const entranceTile = this.calculateEntranceTile(x, y, w, h, rotation);
    const exitTile = this.calculateExitTile(x, y, w, h, rotation);

    // Build tile list for the footprint
    const tiles: Position[] = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        tiles.push({ x: x + dx, y: y + dy });
      }
    }

    // Place on grid
    const placed = grid.placeEntity(x, y, w, h, rideId, TileType.RIDE_FOOTPRINT);
    if (!placed) {
      return null;
    }

    const ride: Ride = {
      id: rideId,
      definitionId: definition.id,
      name: definition.name,
      tiles,
      entranceTile,
      exitTile,
      rotation,
      excitement: definition.baseExcitement,
      intensity: definition.baseIntensity,
      nausea: definition.baseNausea,
      maxQueue: definition.capacity * 3,
      currentQueue: [],
      ridersOnBoard: [],
      status: 'open',
      monthlyMaintenanceCost: definition.monthlyMaintenance,
      monthsOld: 0,
      totalCustomers: 0,
      totalRevenue: 0,
      ticketPrice: definition.suggestedPrice,
      lastBreakdown: null,
      rideTimer: 0,
    };

    return ride;
  }

  // ---------------------------------------------------------------------------
  // Process Ride Tick
  // ---------------------------------------------------------------------------

  /**
   * Advance ride simulation by one tick. Handles timer countdown, rider
   * unloading, and guest boarding.
   */
  processRideTick(ride: Ride, definition: RideDefinition): Ride {
    if (ride.status !== 'open') {
      return ride;
    }

    // If riders are on board and timer is counting down
    if (ride.ridersOnBoard.length > 0 && ride.rideTimer > 0) {
      ride.rideTimer--;

      // Ride cycle complete
      if (ride.rideTimer === 0) {
        const finishedRiders = [...ride.ridersOnBoard];
        ride.totalCustomers += finishedRiders.length;
        ride.ridersOnBoard = [];

        this.eventBus.emit('notification', {
          message: `${ride.name} cycle complete with ${finishedRiders.length} riders`,
          type: 'info',
          entityId: ride.id,
        });
      }

      return ride;
    }

    // Board new guests if ride is empty and queue has guests and timer is at 0
    if (
      ride.ridersOnBoard.length === 0 &&
      ride.currentQueue.length > 0 &&
      ride.rideTimer === 0
    ) {
      const boardCount = Math.min(ride.currentQueue.length, definition.capacity);
      ride.ridersOnBoard = ride.currentQueue.splice(0, boardCount);
      ride.rideTimer = definition.rideDurationTicks;
    }

    return ride;
  }

  // ---------------------------------------------------------------------------
  // Breakdown Logic
  // ---------------------------------------------------------------------------

  /**
   * Check whether a ride breaks down on this day. Should be called once per
   * game day. Returns true if the ride broke down.
   *
   * The base monthly chance comes from the ride definition's breakdownChance
   * (so a rickety drop tower at 0.10 really is riskier than a garden train at
   * 0.02), and rides get less reliable as they age.
   */
  checkBreakdown(ride: Ride, _dayOfMonth: number, definition?: RideDefinition): boolean {
    if (ride.status !== 'open') {
      return false;
    }

    const baseChance = definition?.breakdownChance ?? 0.05;
    const monthlyChance = baseChance + ride.monthsOld * 0.002;
    const dailyChance = monthlyChance / 30;

    if (Math.random() < dailyChance) {
      ride.status = 'broken';
      ride.currentQueue = [];
      ride.ridersOnBoard = [];
      ride.rideTimer = 0;

      this.eventBus.emit('ride-broke', {
        rideId: ride.id,
        rideName: ride.name,
      });

      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Repair
  // ---------------------------------------------------------------------------

  /**
   * Repair a broken ride and emit the ride-fixed event.
   */
  repairRide(ride: Ride): Ride {
    ride.status = 'open';
    this.eventBus.emit('ride-fixed', { rideId: ride.id });
    return ride;
  }

  // ---------------------------------------------------------------------------
  // Rating Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate the current excitement, intensity, and nausea ratings for a
   * ride, factoring in scenery, proximity to other rides, age decay, and
   * weather.
   *
   * Ratings are rebuilt from the DEFINITION's base values each call (not the
   * ride's current values) so repeated recalculation never compounds bonuses
   * or decay.
   *
   * @param weatherExcitementMod Additive excitement modifier from current
   *   weather (e.g. -0.5 in rain). All rides are treated as outdoor.
   */
  calculateRatings(
    ride: Ride,
    definition: RideDefinition,
    grid: Grid,
    allRides: Record<string, Ride>,
    weatherExcitementMod = 0,
  ): { excitement: number; intensity: number; nausea: number } {
    let excitement = definition.baseExcitement + weatherExcitementMod;
    let intensity = definition.baseIntensity;
    let nausea = definition.baseNausea;

    // Scenery bonus from nearby decorations
    const sceneryScore = grid.getSceneryScore(
      ride.entranceTile.x,
      ride.entranceTile.y,
      SCENERY_RADIUS,
    );
    const sceneryBonus = Math.min(
      sceneryScore * SCENERY_BONUS_MULTIPLIER,
      SCENERY_BONUS_CAP,
    );
    excitement += sceneryBonus;

    // Proximity bonus from nearby rides
    let proximityBonus = 0;
    for (const otherRideId of Object.keys(allRides)) {
      if (otherRideId === ride.id) {
        continue;
      }
      const otherRide = allRides[otherRideId];
      const distance =
        Math.abs(otherRide.entranceTile.x - ride.entranceTile.x) +
        Math.abs(otherRide.entranceTile.y - ride.entranceTile.y);
      if (distance <= PROXIMITY_RADIUS) {
        proximityBonus += PROXIMITY_EXCITEMENT_BONUS;
      }
    }
    excitement += Math.min(proximityBonus, PROXIMITY_BONUS_CAP);

    // Age decay
    if (ride.monthsOld > AGE_DECAY_THRESHOLD_MONTHS) {
      const decay = Math.min(ride.monthsOld * AGE_DECAY_PER_MONTH, AGE_DECAY_MAX);
      excitement -= decay;
    }

    // Clamp values to valid ranges
    excitement = Math.max(0, Math.min(10, excitement));
    intensity = Math.max(0, Math.min(15, intensity));
    nausea = Math.max(0, Math.min(15, nausea));

    return { excitement, intensity, nausea };
  }

  // ---------------------------------------------------------------------------
  // Age Rides
  // ---------------------------------------------------------------------------

  /**
   * Called monthly. Increments monthsOld for all rides.
   */
  ageRides(rides: Record<string, Ride>): Record<string, Ride> {
    for (const rideId of Object.keys(rides)) {
      rides[rideId].monthsOld++;
    }
    return rides;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate the entrance tile position based on rotation.
   * The entrance is placed at the center of the path-adjacent edge.
   *
   * rotation 0: entrance on the south (bottom) edge, one tile below
   * rotation 1: entrance on the west (left) edge, one tile to the left
   * rotation 2: entrance on the north (top) edge, one tile above
   * rotation 3: entrance on the east (right) edge, one tile to the right
   */
  private calculateEntranceTile(
    x: number,
    y: number,
    w: number,
    h: number,
    rotation: 0 | 1 | 2 | 3,
  ): Position {
    switch (rotation) {
      case 0: // South edge
        return { x: x + Math.floor(w / 2), y: y + h };
      case 1: // West edge
        return { x: x - 1, y: y + Math.floor(h / 2) };
      case 2: // North edge
        return { x: x + Math.floor(w / 2), y: y - 1 };
      case 3: // East edge
        return { x: x + w, y: y + Math.floor(h / 2) };
    }
  }

  /**
   * Calculate the exit tile position based on rotation.
   * The exit is on the opposite side from the entrance.
   */
  private calculateExitTile(
    x: number,
    y: number,
    w: number,
    h: number,
    rotation: 0 | 1 | 2 | 3,
  ): Position {
    switch (rotation) {
      case 0: // Exit on north edge
        return { x: x + Math.floor(w / 2), y: y - 1 };
      case 1: // Exit on east edge
        return { x: x + w, y: y + Math.floor(h / 2) };
      case 2: // Exit on south edge
        return { x: x + Math.floor(w / 2), y: y + h };
      case 3: // Exit on west edge
        return { x: x - 1, y: y + Math.floor(h / 2) };
    }
  }
}
