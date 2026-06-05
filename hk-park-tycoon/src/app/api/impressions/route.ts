import { NextResponse } from 'next/server';
import type { ImpressionEvent } from '../../../engine/types';

interface ImpressionBatch {
  events: ImpressionEvent[];
  sessionId: string;
}

/**
 * POST /api/impressions — Accepts batch of ImpressionEvent objects.
 *
 * Stores impression data for analytics. Even before sponsors exist,
 * this collects baseline data on surface visibility and engagement.
 *
 * For now, logs to console. Future: store in database (Supabase/Postgres)
 * or append-only log file for analytics dashboards.
 */
export async function POST(request: Request) {
  try {
    const batch: ImpressionBatch = await request.json();

    if (!batch.events || !Array.isArray(batch.events)) {
      return NextResponse.json(
        { error: 'Invalid payload: events array required' },
        { status: 400 }
      );
    }

    // Future: persist to database
    // For now, just acknowledge receipt
    const summary = {
      sessionId: batch.sessionId,
      eventCount: batch.events.length,
      surfaceTypes: Array.from(new Set(batch.events.map((e) => e.surfaceType))),
      receivedAt: new Date().toISOString(),
    };

    // Log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Impressions]', summary);
    }

    return NextResponse.json({ ok: true, received: batch.events.length });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process impressions' },
      { status: 500 }
    );
  }
}
