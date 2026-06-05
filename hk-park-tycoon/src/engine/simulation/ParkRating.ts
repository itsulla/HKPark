// =============================================================================
// HK Theme Park Tycoon - ParkRating (Park Rating Calculation)
// =============================================================================

import { Guest, Ride, District } from '../types';
import { EventBus } from '../core/EventBus';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_RATING = 1000;
const MIN_RATING = 0;

// Happiness component
const MAX_HAPPINESS_POINTS = 400;
const HAPPINESS_MAX_VALUE = 255;
const DEFAULT_HAPPINESS_POINTS = 200;

// Ride variety component
const POINTS_PER_CATEGORY = 50;
const MAX_VARIETY_POINTS = 250;

// Cleanliness component
const MAX_CLEANLINESS_POINTS = 150;
const LITTER_PENALTY_PER_ITEM = 5;

// Ride uptime component
const MAX_UPTIME_POINTS = 200;

// Park size component
const POINTS_PER_DISTRICT = 30;
const MAX_SIZE_POINTS = 150;

// Guest spawn rates (in ticks)
const SPAWN_RATE_LOW = 150;     // rating 0-200: 1 guest per 5 days
const SPAWN_RATE_MEDIUM = 60;   // rating 200-500: 1 per 2 days
const SPAWN_RATE_HIGH = 30;     // rating 500-800: 1 per day
const SPAWN_RATE_VERY_HIGH = 15; // rating 800-1000: 2 per day

// -----------------------------------------------------------------------------
// ParkRating
// -----------------------------------------------------------------------------

export class ParkRating {
  private readonly eventBus: EventBus;
  private currentRating: number = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Rating Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate the park rating (0-1000) based on guest happiness, ride variety,
   * cleanliness, ride uptime, and park size.
   */
  calculate(
    guests: Record<string, Guest>,
    rides: Record<string, Ride>,
    districts: District[],
    litterCount: number,
  ): number {
    // --- Guest happiness (max 400 points) ---
    const guestIds = Object.keys(guests);
    let happinessPoints: number;

    if (guestIds.length === 0) {
      happinessPoints = DEFAULT_HAPPINESS_POINTS;
    } else {
      let happinessSum = 0;
      for (const id of guestIds) {
        happinessSum += guests[id].happiness;
      }
      const averageHappiness = happinessSum / guestIds.length;
      happinessPoints = (averageHappiness / HAPPINESS_MAX_VALUE) * MAX_HAPPINESS_POINTS;
    }

    // --- Ride variety (max 250 points) ---
    const rideIds = Object.keys(rides);
    const categories = new Set<string>();
    for (const id of rideIds) {
      // Rides store definitionId; we extract the category from the ride data.
      // Since Ride doesn't carry category directly, we count unique definitionIds
      // as a proxy for variety. The caller should map definitionId to category
      // for exact scoring, but we use definitionId uniqueness here.
      categories.add(rides[id].definitionId);
    }
    const varietyPoints = Math.min(categories.size * POINTS_PER_CATEGORY, MAX_VARIETY_POINTS);

    // --- Park cleanliness (max 150 points) ---
    const cleanlinessPoints = Math.max(
      MAX_CLEANLINESS_POINTS - litterCount * LITTER_PENALTY_PER_ITEM,
      0,
    );

    // --- Ride uptime (max 200 points) ---
    let uptimePoints: number;
    if (rideIds.length === 0) {
      uptimePoints = 0;
    } else {
      let openCount = 0;
      for (const id of rideIds) {
        if (rides[id].status === 'open') {
          openCount++;
        }
      }
      uptimePoints = (openCount / rideIds.length) * MAX_UPTIME_POINTS;
    }

    // --- Park size bonus (max 150 points) ---
    let unlockedCount = 0;
    for (const district of districts) {
      if (district.unlocked) {
        unlockedCount++;
      }
    }
    const sizePoints = Math.min(unlockedCount * POINTS_PER_DISTRICT, MAX_SIZE_POINTS);

    // --- Total (clamped 0-1000) ---
    const total = Math.min(
      Math.max(
        Math.round(happinessPoints + varietyPoints + cleanlinessPoints + uptimePoints + sizePoints),
        MIN_RATING,
      ),
      MAX_RATING,
    );

    // Emit event if rating changed
    if (total !== this.currentRating) {
      this.eventBus.emit('rating-changed', {
        oldRating: this.currentRating,
        newRating: total,
      });
    }

    this.currentRating = total;
    return total;
  }

  // ---------------------------------------------------------------------------
  // Guest Spawn Rate
  // ---------------------------------------------------------------------------

  /**
   * Return the number of ticks between guest spawns based on the park rating.
   * Lower values mean faster spawning. The district multiplier scales this
   * further (higher multiplier = faster spawns).
   */
  getSpawnRate(rating: number, districtMultiplier: number): number {
    let baseTicks: number;

    if (rating >= 800) {
      baseTicks = SPAWN_RATE_VERY_HIGH;
    } else if (rating >= 500) {
      baseTicks = SPAWN_RATE_HIGH;
    } else if (rating >= 200) {
      baseTicks = SPAWN_RATE_MEDIUM;
    } else {
      baseTicks = SPAWN_RATE_LOW;
    }

    // Apply district multiplier: higher multiplier = faster spawns
    const adjustedRate = baseTicks * (1 / districtMultiplier);

    return Math.max(Math.round(adjustedRate), 1);
  }

  // ---------------------------------------------------------------------------
  // Accessor
  // ---------------------------------------------------------------------------

  /**
   * Return the most recently calculated park rating.
   */
  getRating(): number {
    return this.currentRating;
  }
}
