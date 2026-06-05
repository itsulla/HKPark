/**
 * SponsorManager — Loads sponsor configs, applies overlays.
 *
 * At render time, call getDisplayConfig(entity) to get either
 * the sponsor branding (if an active campaign exists) or the
 * default HK-themed branding. The entire sponsorship system is
 * a null check on a config field — no ad SDK, no third-party scripts.
 */

import {
  SponsorConfig,
  SponsorableEntity,
  DisplayConfig,
  ImpressionEvent,
} from '../engine/types';
import { allDefaults } from './defaults';
import { ImpressionTracker } from './ImpressionTracker';

function isActiveCampaign(sponsor: SponsorConfig): boolean {
  const now = Date.now();
  const start = new Date(sponsor.startDate).getTime();
  const end = new Date(sponsor.endDate).getTime();
  return now >= start && now <= end;
}

class SponsorManagerClass {
  private configs: Map<string, SponsorConfig> = new Map();
  private tracker: ImpressionTracker;
  private loaded = false;

  constructor() {
    this.tracker = new ImpressionTracker();
  }

  /** Fetch active sponsor configs from the API. Call once at game start. */
  async loadSponsors(): Promise<void> {
    try {
      const res = await fetch('/api/sponsors');
      if (!res.ok) return;
      const sponsors: SponsorConfig[] = await res.json();
      sponsors.forEach((s) => this.configs.set(s.sponsorId, s));
      this.loaded = true;
    } catch {
      // Sponsors are optional — game works perfectly without them
      this.loaded = true;
    }
  }

  /** Get the sponsor config for an entity, if one exists and is active. */
  getSponsor(entityId: string): SponsorConfig | null {
    const config = this.configs.get(entityId);
    if (config && isActiveCampaign(config)) {
      return config;
    }
    return null;
  }

  /**
   * Get the display config for any sponsorable entity.
   * If a sponsor is active, returns sponsor branding.
   * Otherwise returns the default HK-themed branding.
   */
  getDisplayConfig(entityId: string, entity?: SponsorableEntity): DisplayConfig {
    // Check for active sponsor first
    const sponsor = this.getSponsor(entityId);
    if (sponsor) {
      return {
        name: sponsor.displayName,
        icon: sponsor.logoUrl,
        color: sponsor.colorScheme,
        description: sponsor.description,
      };
    }

    // Try entity-level defaults
    if (entity) {
      return {
        name: entity.defaultName,
        icon: entity.defaultIcon,
        color: entity.defaultColorScheme,
        description: entity.defaultDescription,
      };
    }

    // Fall back to global defaults registry
    const defaults = allDefaults[entityId];
    if (defaults) {
      return {
        name: defaults.defaultName,
        icon: defaults.defaultIcon,
        color: defaults.defaultColorScheme,
        description: defaults.defaultDescription,
      };
    }

    // Ultimate fallback
    return {
      name: entityId,
      icon: '🏗️',
      color: '#888888',
      description: '',
    };
  }

  /** Track an impression event. Batched and sent periodically. */
  trackImpression(event: Omit<ImpressionEvent, 'timestamp' | 'sessionId'>): void {
    this.tracker.track({
      ...event,
      timestamp: Date.now(),
      sessionId: this.tracker.getSessionId(),
    });
  }

  /** Check if sponsors have been loaded. */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** Get impression tracker for manual flush. */
  getTracker(): ImpressionTracker {
    return this.tracker;
  }

  /** Cleanup on unmount. */
  destroy(): void {
    this.tracker.flush();
    this.tracker.destroy();
  }
}

// Singleton instance
export const SponsorManager = new SponsorManagerClass();
export default SponsorManager;
