import { NextResponse } from 'next/server';
import type { SponsorConfig } from '../../../engine/types';
import sponsorsData from '../../../data/sponsors.json';

/**
 * GET /api/sponsors — Returns currently-active SponsorConfig objects.
 *
 * Sponsors are stored in src/data/sponsors.json (demo data for now; swap for a
 * DB-backed admin later). We filter to campaigns whose date window is active so
 * the client only ever sees live sponsorships. The game handles an empty result
 * gracefully — every surface falls back to its default HK branding.
 *
 * Only sanitized public display fields are returned (the whole config here is
 * already display-safe; sensitive billing/admin data would live elsewhere).
 */
export async function GET() {
  const now = Date.now();
  const allSponsors = sponsorsData as SponsorConfig[];

  const activeSponsors = allSponsors.filter((s) => {
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    return (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      now >= start &&
      now <= end
    );
  });

  return NextResponse.json(activeSponsors, {
    headers: {
      // Sponsors change monthly, not per-session — cache aggressively.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
