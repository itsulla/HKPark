// =============================================================================
// HK Theme Park Tycoon - District Manager
// =============================================================================

import { District } from '../types';
import { Grid } from './Grid';

export class DistrictManager {
  private grid: Grid;
  private districts: District[];

  constructor(grid: Grid, districts: District[]) {
    this.grid = grid;
    this.districts = districts;

    // Mark tiles as buildable for any districts that are already unlocked
    for (const district of this.districts) {
      if (district.unlocked) {
        this.grid.markDistrict(district);
      }
    }
  }

  /**
   * Attempts to unlock a district by its ID, given the player's available money.
   * Returns whether the unlock succeeded and the cost charged.
   * On success, marks the district's tiles as buildable on the grid.
   */
  unlockDistrict(
    districtId: string,
    money: number,
  ): { success: boolean; cost: number } {
    const district = this.districts.find((d) => d.id === districtId);

    if (!district) {
      return { success: false, cost: 0 };
    }

    if (district.unlocked) {
      return { success: false, cost: 0 };
    }

    if (money < district.unlockCost) {
      return { success: false, cost: district.unlockCost };
    }

    district.unlocked = true;
    this.grid.markDistrict(district);

    return { success: true, cost: district.unlockCost };
  }

  /**
   * Returns the district that contains the given (x, y) position, or null
   * if the position does not fall within any district's bounds.
   */
  getDistrictAt(x: number, y: number): District | null {
    for (const district of this.districts) {
      const { x: dx, y: dy, w, h } = district.tiles;
      if (x >= dx && x < dx + w && y >= dy && y < dy + h) {
        return district;
      }
    }
    return null;
  }

  /**
   * Returns all districts that have been unlocked.
   */
  getUnlockedDistricts(): District[] {
    return this.districts.filter((d) => d.unlocked);
  }

  /**
   * Returns true if the tile at (x, y) falls within any unlocked district.
   */
  isInUnlockedArea(x: number, y: number): boolean {
    for (const district of this.districts) {
      if (!district.unlocked) {
        continue;
      }
      const { x: dx, y: dy, w, h } = district.tiles;
      if (x >= dx && x < dx + w && y >= dy && y < dy + h) {
        return true;
      }
    }
    return false;
  }
}
