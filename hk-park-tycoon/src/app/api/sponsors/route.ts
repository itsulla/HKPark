import { NextResponse } from 'next/server';
import type { SponsorConfig } from '../../../engine/types';

/**
 * GET /api/sponsors — Returns array of active SponsorConfig objects.
 *
 * For now, returns an empty array (no sponsors yet).
 * When sponsors are sold, configs will be stored in a database
 * or JSON file and served here. The game handles empty gracefully —
 * all entities fall back to their beautiful default HK branding.
 */
export async function GET() {
  // Future: read from database or sponsors.json config file
  const activeSponsors: SponsorConfig[] = [];

  return NextResponse.json(activeSponsors, {
    headers: {
      // Sponsors change monthly, not per-session — cache aggressively
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
