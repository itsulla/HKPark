// =============================================================================
// HK Theme Park Tycoon - StaffManager (Staff Simulation)
// =============================================================================

import { Staff, StaffType, Position } from '../types';
import { Grid } from '../world/Grid';
import { Pathfinder } from '../world/Pathfinder';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STAFF_MOVE_SPEED = 0.05; // Tiles per tick
const MECHANIC_SEARCH_RADIUS = 50;

/** Default name templates by staff type */
const STAFF_NAME_MAP: Record<StaffType, string> = {
  [StaffType.JANITOR]: 'Janitor',
  [StaffType.MECHANIC]: 'Mechanic',
  [StaffType.SECURITY]: 'Security Guard',
  [StaffType.ENTERTAINER]: 'Entertainer',
};

// -----------------------------------------------------------------------------
// StaffManager
// -----------------------------------------------------------------------------

export class StaffManager {
  private staffRegistry: Record<string, Staff> = {};

  // ---------------------------------------------------------------------------
  // Hiring & Firing
  // ---------------------------------------------------------------------------

  /**
   * Hire a new staff member of the given type at the specified position.
   */
  hireStaff(type: StaffType, position: Position, salary: number): Staff {
    const id = `staff-${uuidv4()}`;

    const staff: Staff = {
      id,
      name: `${STAFF_NAME_MAP[type]} ${id.slice(-4).toUpperCase()}`,
      type,
      tile: { x: position.x, y: position.y },
      patrolArea: null,
      salary,
    };

    this.staffRegistry[id] = staff;
    return staff;
  }

  /**
   * Fire a staff member by id.
   */
  fireStaff(staffId: string): void {
    delete this.staffRegistry[staffId];
  }

  // ---------------------------------------------------------------------------
  // Tick Processing
  // ---------------------------------------------------------------------------

  /**
   * Process a single tick for a staff member. Movement behaviour depends on
   * staff type:
   * - JANITOR: wander within patrol area, "cleaning" tiles
   * - MECHANIC: pathfind toward the nearest broken ride if one exists
   * - SECURITY: wander patrol area (presence alone gives a happiness bonus)
   * - ENTERTAINER: wander patrol area
   *
   * All staff move at STAFF_MOVE_SPEED tiles per tick.
   */
  processStaffTick(
    staff: Staff,
    grid: Grid,
    brokenRides: string[],
  ): Staff {
    switch (staff.type) {
      case StaffType.MECHANIC:
        return this.processMechanicTick(staff, grid, brokenRides);

      case StaffType.JANITOR:
      case StaffType.SECURITY:
      case StaffType.ENTERTAINER:
        return this.processPatrolTick(staff, grid);
    }
  }

  // ---------------------------------------------------------------------------
  // Wages
  // ---------------------------------------------------------------------------

  /**
   * Sum all staff salaries to get the total monthly wage bill.
   */
  getMonthlyWages(allStaff: Record<string, Staff>): number {
    let total = 0;
    for (const staffId of Object.keys(allStaff)) {
      total += allStaff[staffId].salary;
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // Private: Mechanic Behaviour
  // ---------------------------------------------------------------------------

  /**
   * Mechanics seek out broken rides. If there are broken rides and the
   * mechanic has no current target, find the nearest broken ride (by
   * Manhattan distance on the grid) and move toward it.
   */
  private processMechanicTick(
    staff: Staff,
    grid: Grid,
    brokenRides: string[],
  ): Staff {
    if (brokenRides.length === 0) {
      // No broken rides -- wander as normal patrol
      return this.processPatrolTick(staff, grid);
    }

    // Find the nearest broken ride tile
    const nearestBrokenTile = Pathfinder.findNearestEntity(
      grid,
      staff.tile,
      'ride-',
      MECHANIC_SEARCH_RADIUS,
    );

    if (!nearestBrokenTile) {
      return this.processPatrolTick(staff, grid);
    }

    // Find the nearest walkable tile adjacent to the broken ride
    const walkableNeighbors = grid.getWalkableNeighbors(
      nearestBrokenTile.x,
      nearestBrokenTile.y,
    );

    if (walkableNeighbors.length === 0) {
      return this.processPatrolTick(staff, grid);
    }

    // Move toward the target path tile adjacent to the broken ride
    const targetTile = walkableNeighbors[0];
    return this.moveToward(staff, targetTile);
  }

  // ---------------------------------------------------------------------------
  // Private: Patrol Behaviour
  // ---------------------------------------------------------------------------

  /**
   * Wander around the patrol area (or randomly if no patrol area set).
   * Moves slowly along walkable path tiles.
   */
  private processPatrolTick(staff: Staff, grid: Grid): Staff {
    // Pick a random adjacent walkable tile to wander to
    const neighbors = grid.getWalkableNeighbors(staff.tile.x, staff.tile.y);

    if (neighbors.length === 0) {
      return staff;
    }

    // If the staff has a patrol area, prefer tiles within it
    let validTargets = neighbors;
    if (staff.patrolArea && staff.patrolArea.length > 0) {
      const inPatrol = neighbors.filter((n) =>
        staff.patrolArea!.some((p) => p.x === n.x && p.y === n.y),
      );
      if (inPatrol.length > 0) {
        validTargets = inPatrol;
      }
    }

    // Pick a random target from valid options
    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
    return this.moveToward(staff, target);
  }

  // ---------------------------------------------------------------------------
  // Private: Movement
  // ---------------------------------------------------------------------------

  /**
   * Move staff toward target tile at STAFF_MOVE_SPEED per tick.
   * Since staff positions are tile-based (integer positions), we snap to the
   * target when within movement speed distance.
   */
  private moveToward(staff: Staff, target: Position): Staff {
    const dx = target.x - staff.tile.x;
    const dy = target.y - staff.tile.y;
    const distance = Math.abs(dx) + Math.abs(dy);

    if (distance <= STAFF_MOVE_SPEED) {
      // Close enough to snap
      staff.tile = { x: target.x, y: target.y };
    }
    // If further away, move fractionally (but since tile is integer-based,
    // move one tile at a time on the slower tick cadence controlled by the
    // game loop calling this method less frequently)
    else if (distance > 0) {
      // Move one step in the direction with the largest delta
      if (Math.abs(dx) >= Math.abs(dy)) {
        staff.tile = {
          x: staff.tile.x + (dx > 0 ? 1 : -1),
          y: staff.tile.y,
        };
      } else {
        staff.tile = {
          x: staff.tile.x,
          y: staff.tile.y + (dy > 0 ? 1 : -1),
        };
      }
    }

    return staff;
  }
}
