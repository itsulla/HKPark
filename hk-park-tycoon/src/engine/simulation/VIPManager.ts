// =============================================================================
// HK Theme Park Tycoon - VIPManager (Layer 2: AI VIP Guests)
// =============================================================================
// Template-driven VIP personas that walk the park and produce shareable
// commentary. No external LLM calls — dialogue is generated from each persona's
// personality + the current park context. Premium tier: VIPs with a brand
// affinity naturally mention an active sponsor's product (fires vip_mention).

import type { VIPPersona, Guest } from '../types';
import vipsData from '../../data/vips.json';

const VIP_SPAWN_INTERVAL = 450; // ticks between VIP spawn opportunities

/** A sponsored surface currently present in the park. */
export interface SponsoredSurfaceRef {
  surfaceId: string;
  sponsorId: string;
  brandName: string;
}

export interface VIPCommentContext {
  rideCount: number;
  litterHigh: boolean;
  sponsoredSurfaces: SponsoredSurfaceRef[];
}

export interface VIPComment {
  text: string;
  sponsored: boolean;
  surfaceId: string | null;
  sponsorId: string | null;
}

export class VIPManager {
  private readonly personas: VIPPersona[] = vipsData as VIPPersona[];

  getPersona(id: string): VIPPersona | undefined {
    return this.personas.find((p) => p.id === id);
  }

  /**
   * Decide whether to spawn a VIP this tick. Returns a persona that is not
   * already in the park, or null.
   */
  pickSpawnPersona(
    currentTick: number,
    presentPersonaIds: Set<string>,
  ): VIPPersona | null {
    if (currentTick <= 0 || currentTick % VIP_SPAWN_INTERVAL !== 0) return null;
    const available = this.personas.filter((p) => !presentPersonaIds.has(p.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  /** Stamp a freshly-spawned guest as the given VIP persona. */
  applyPersona(guest: Guest, persona: VIPPersona): Guest {
    guest.name = persona.name;
    guest.vipPersonaId = persona.id;
    guest.cash = Math.max(guest.cash, 400); // VIPs arrive flush
    return guest;
  }

  /** Generate a line of commentary for a VIP based on current park context. */
  generateComment(persona: VIPPersona, ctx: VIPCommentContext): VIPComment {
    // Premium sponsor mention: a VIP whose brand affinity matches an active
    // sponsored surface mentions the product (subject to mentionFrequency).
    const affinity = persona.brandAffinity;
    if (affinity) {
      const wanted = affinity.brand.trim().toLowerCase();
      const match = ctx.sponsoredSurfaces.find(
        (s) => s.brandName.trim().toLowerCase() === wanted,
      );
      if (match && Math.random() < affinity.mentionFrequency) {
        const product = affinity.product;
        const templates = [
          `Ahh, I could really go for a ${product} right now!`,
          `You know what makes this park? A cold ${product}.`,
          `${product} on a day like this — absolute perfection.`,
        ];
        return {
          text: templates[Math.floor(Math.random() * templates.length)],
          sponsored: true,
          surfaceId: match.surfaceId,
          sponsorId: match.sponsorId,
        };
      }
    }

    // Otherwise, characterful contextual flavour.
    let text: string;
    if (ctx.rideCount === 0) {
      text = 'Hmm, not much to ride here yet...';
    } else if (ctx.litterHigh && persona.loves.includes('GENTLE')) {
      text = 'Aiya, someone needs to clean up around here!';
    } else if (persona.catchphrases.length > 0) {
      text =
        persona.catchphrases[
          Math.floor(Math.random() * persona.catchphrases.length)
        ];
    } else {
      text = 'What a day at the park!';
    }

    return { text, sponsored: false, surfaceId: null, sponsorId: null };
  }
}

export default VIPManager;
