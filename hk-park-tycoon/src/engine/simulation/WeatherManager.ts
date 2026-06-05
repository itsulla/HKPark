// =============================================================================
// HK Theme Park Tycoon - WeatherManager (Weather & Random Events)
// =============================================================================

import { Weather, Season, GameDate } from '../types';
import { EventBus } from '../core/EventBus';

// -----------------------------------------------------------------------------
// Weather Probability Tables (per-season)
// -----------------------------------------------------------------------------

interface WeatherProbability {
  weather: Weather;
  chance: number;
}

const WEATHER_PROBABILITIES: Record<Season, WeatherProbability[]> = {
  [Season.SPRING]: [
    { weather: Weather.CLEAR, chance: 0.60 },
    { weather: Weather.CLOUDY, chance: 0.30 },
    { weather: Weather.RAIN, chance: 0.10 },
  ],
  [Season.SUMMER]: [
    { weather: Weather.CLEAR, chance: 0.30 },
    { weather: Weather.CLOUDY, chance: 0.30 },
    { weather: Weather.RAIN, chance: 0.25 },
    { weather: Weather.TYPHOON_WARNING, chance: 0.10 },
    { weather: Weather.TYPHOON, chance: 0.05 },
  ],
  [Season.AUTUMN]: [
    { weather: Weather.CLEAR, chance: 0.70 },
    { weather: Weather.CLOUDY, chance: 0.20 },
    { weather: Weather.RAIN, chance: 0.10 },
  ],
  [Season.WINTER]: [
    { weather: Weather.CLEAR, chance: 0.50 },
    { weather: Weather.CLOUDY, chance: 0.40 },
    { weather: Weather.RAIN, chance: 0.10 },
  ],
};

// -----------------------------------------------------------------------------
// Weather Effect Presets
// -----------------------------------------------------------------------------

interface WeatherEffect {
  spawnRateMultiplier: number;
  outdoorRideExcitementMod: number;
  parkOpen: boolean;
}

const WEATHER_EFFECTS: Record<Weather, WeatherEffect> = {
  [Weather.CLEAR]:           { spawnRateMultiplier: 1.0, outdoorRideExcitementMod: 0,    parkOpen: true },
  [Weather.CLOUDY]:          { spawnRateMultiplier: 1.0, outdoorRideExcitementMod: 0,    parkOpen: true },
  [Weather.RAIN]:            { spawnRateMultiplier: 0.7, outdoorRideExcitementMod: -0.5, parkOpen: true },
  [Weather.TYPHOON_WARNING]: { spawnRateMultiplier: 0.4, outdoorRideExcitementMod: -1.0, parkOpen: true },
  [Weather.TYPHOON]:         { spawnRateMultiplier: 0,   outdoorRideExcitementMod: 0,    parkOpen: false },
};

// -----------------------------------------------------------------------------
// Random Event Definitions
// -----------------------------------------------------------------------------

interface RandomEvent {
  event: string;
  effect: string;
}

// -----------------------------------------------------------------------------
// WeatherManager
// -----------------------------------------------------------------------------

export class WeatherManager {
  private readonly eventBus: EventBus;

  currentWeather: Weather = Weather.CLEAR;
  currentSeason: Season = Season.SPRING;
  typhoonDaysRemaining: number = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Seed weather/season from restored state so a loaded save stays consistent. */
  hydrate(weather: Weather, season: Season): void {
    this.currentWeather = weather;
    this.currentSeason = season;
  }

  // ---------------------------------------------------------------------------
  // Season
  // ---------------------------------------------------------------------------

  /**
   * Determine the season for a given month number (1-12).
   */
  getSeason(month: number): Season {
    if (month >= 3 && month <= 5) {
      return Season.SPRING;
    }
    if (month >= 6 && month <= 9) {
      return Season.SUMMER;
    }
    if (month >= 10 && month <= 11) {
      return Season.AUTUMN;
    }
    // December, January, February
    return Season.WINTER;
  }

  // ---------------------------------------------------------------------------
  // Daily Processing
  // ---------------------------------------------------------------------------

  /**
   * Process weather for a new day. Updates the current season, handles
   * active typhoons, and rolls for new weather. Emits a 'weather-changed'
   * event when the weather changes.
   */
  processDay(date: GameDate): { weather: Weather; season: Season } {
    // Update season
    const newSeason = this.getSeason(date.month);
    if (newSeason !== this.currentSeason) {
      this.currentSeason = newSeason;
    }

    const previousWeather = this.currentWeather;

    // Handle ongoing typhoon
    if (this.typhoonDaysRemaining > 0) {
      this.typhoonDaysRemaining--;
      if (this.typhoonDaysRemaining === 0) {
        // Typhoon is over, clear weather
        this.currentWeather = Weather.CLEAR;
      }
      // Otherwise keep TYPHOON weather
    } else {
      // Roll new weather based on season probabilities
      this.currentWeather = this.rollWeather(this.currentSeason);

      // If typhoon was rolled, set duration
      if (this.currentWeather === Weather.TYPHOON) {
        this.typhoonDaysRemaining = 1 + Math.floor(Math.random() * 3);
      }
    }

    // Emit event if weather changed
    if (this.currentWeather !== previousWeather) {
      this.eventBus.emit('weather-changed', { weather: this.currentWeather });
    }

    return {
      weather: this.currentWeather,
      season: this.currentSeason,
    };
  }

  // ---------------------------------------------------------------------------
  // Weather Effects
  // ---------------------------------------------------------------------------

  /**
   * Return gameplay modifiers for the given weather condition.
   */
  getWeatherEffects(weather: Weather): WeatherEffect {
    return { ...WEATHER_EFFECTS[weather] };
  }

  // ---------------------------------------------------------------------------
  // Random Events
  // ---------------------------------------------------------------------------

  /**
   * Check for random events. Called once per month.
   *
   * Possible events:
   * - October: 30% chance "Festival Season" (+50% guests for 7 days)
   * - Dec-Jan: 30% chance "Holiday Rush" (+30% guests)
   * - Any month: 5% chance "Celebrity Visit" (+20% rating for 3 days)
   * - Any month: 5% chance "Health Inspection" (fine if cleanliness low)
   *
   * Returns the first event that triggers, or null if none do.
   */
  checkRandomEvents(date: GameDate): RandomEvent | null {
    // October: Festival Season
    if (date.month === 10 && Math.random() < 0.30) {
      return {
        event: 'Festival Season',
        effect: '+50% guest spawn rate for 7 days',
      };
    }

    // December or January: Holiday Rush
    if ((date.month === 12 || date.month === 1) && Math.random() < 0.30) {
      return {
        event: 'Holiday Rush',
        effect: '+30% guest spawn rate for the month',
      };
    }

    // Any month: Celebrity Visit (5%)
    if (Math.random() < 0.05) {
      return {
        event: 'Celebrity Visit',
        effect: '+20% park rating for 3 days',
      };
    }

    // Any month: Health Inspection (5%)
    if (Math.random() < 0.05) {
      return {
        event: 'Health Inspection',
        effect: 'Fine applied if park cleanliness is low',
      };
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Roll a weather outcome based on cumulative probability for the season.
   */
  private rollWeather(season: Season): Weather {
    const probabilities = WEATHER_PROBABILITIES[season];
    const roll = Math.random();
    let cumulative = 0;

    for (const entry of probabilities) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        return entry.weather;
      }
    }

    // Fallback (should not reach here with correct probability tables)
    return Weather.CLEAR;
  }
}
