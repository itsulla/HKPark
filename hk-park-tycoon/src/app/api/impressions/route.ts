import { NextResponse } from 'next/server';
import type {
  ImpressionEvent,
  SponsorTier,
  ImpressionEventType,
} from '../../../engine/types';

// -----------------------------------------------------------------------------
// Limits & allow-lists
// -----------------------------------------------------------------------------

const MAX_EVENTS_PER_BATCH = 500;
const MAX_BODY_BYTES = 256 * 1024; // 256 KB
const MAX_ID_LEN = 128;

const VALID_SURFACE_TYPES: readonly SponsorTier[] = [
  'shop',
  'ride',
  'billboard',
  'district',
  'event',
  'vip',
];
const VALID_EVENT_TYPES: readonly ImpressionEventType[] = [
  'view',
  'click',
  'hover',
  'vip_mention',
];

interface ImpressionBatch {
  events: ImpressionEvent[];
  sessionId: string;
}

function isValidEvent(value: unknown): value is ImpressionEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;

  if (typeof e.timestamp !== 'number' || !Number.isFinite(e.timestamp)) return false;
  if (typeof e.surfaceId !== 'string' || e.surfaceId.length > MAX_ID_LEN) return false;
  if (typeof e.sessionId !== 'string' || e.sessionId.length > MAX_ID_LEN) return false;
  if (!VALID_SURFACE_TYPES.includes(e.surfaceType as SponsorTier)) return false;
  if (!VALID_EVENT_TYPES.includes(e.eventType as ImpressionEventType)) return false;
  if (
    e.sponsorId !== null &&
    (typeof e.sponsorId !== 'string' || (e.sponsorId as string).length > MAX_ID_LEN)
  ) {
    return false;
  }
  if (
    e.duration !== undefined &&
    (typeof e.duration !== 'number' || !Number.isFinite(e.duration) || e.duration < 0)
  ) {
    return false;
  }
  return true;
}

/**
 * POST /api/impressions — accepts a batch of ImpressionEvent objects.
 *
 * Hardened in the baseline-audit pass: payload-size cap, batch-length cap,
 * per-field validation with enum allow-lists, and correct 400-vs-500 status
 * codes. Authentication, per-session rate limiting, and durable persistence
 * are intentionally deferred to Phase 3 (when the sponsorship layer goes live).
 */
export async function POST(request: Request) {
  // Reject obviously oversized payloads up front (when the header is present).
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let batch: ImpressionBatch;
  try {
    batch = JSON.parse(raw) as ImpressionBatch;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  if (!batch || !Array.isArray(batch.events)) {
    return NextResponse.json(
      { error: 'Invalid payload: events array required' },
      { status: 400 },
    );
  }
  if (
    typeof batch.sessionId !== 'string' ||
    batch.sessionId.length === 0 ||
    batch.sessionId.length > MAX_ID_LEN
  ) {
    return NextResponse.json(
      { error: 'Invalid payload: sessionId required' },
      { status: 400 },
    );
  }
  if (batch.events.length > MAX_EVENTS_PER_BATCH) {
    return NextResponse.json(
      { error: `Too many events (max ${MAX_EVENTS_PER_BATCH})` },
      { status: 400 },
    );
  }

  const validEvents = batch.events.filter(isValidEvent);
  const rejected = batch.events.length - validEvents.length;

  // TODO(Phase 3): persist validEvents (Supabase/Postgres) behind auth +
  // per-session/IP rate limiting.
  if (process.env.NODE_ENV === 'development') {
    console.log('[Impressions]', {
      sessionId: batch.sessionId,
      accepted: validEvents.length,
      rejected,
      surfaceTypes: Array.from(new Set(validEvents.map((e) => e.surfaceType))),
      receivedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, received: validEvents.length, rejected });
}
