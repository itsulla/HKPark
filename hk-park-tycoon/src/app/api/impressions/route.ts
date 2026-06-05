import { NextResponse } from 'next/server';
import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ImpressionEvent,
  SponsorTier,
  ImpressionEventType,
} from '../../../engine/types';

// Run on the Node.js runtime (needs fs); never cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Limits & allow-lists
// -----------------------------------------------------------------------------

const MAX_EVENTS_PER_BATCH = 500;
const MAX_BODY_BYTES = 256 * 1024; // 256 KB
const MAX_ID_LEN = 128;

// Append-only analytics log (override path via IMPRESSIONS_LOG).
const LOG_PATH = process.env.IMPRESSIONS_LOG ?? join(tmpdir(), 'hk-impressions.jsonl');

// In-memory per-IP rate limit (fixed window). Resets on server restart — fine
// for abuse mitigation on anonymous client telemetry.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60; // per IP per window
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string, now: number): boolean {
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_REQUESTS;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

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
  // Per-IP rate limit before doing any work.
  const ip = clientIp(request);
  if (rateLimited(ip, Date.now())) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

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

  // Persist accepted events as newline-delimited JSON (append-only). A failed
  // write must not fail the request — telemetry is best-effort.
  if (validEvents.length > 0) {
    const lines =
      validEvents
        .map((e) => JSON.stringify({ ...e, sessionId: batch.sessionId, ip }))
        .join('\n') + '\n';
    try {
      await appendFile(LOG_PATH, lines, 'utf8');
    } catch {
      // Swallow — analytics persistence is best-effort.
    }
  }

  return NextResponse.json({ ok: true, received: validEvents.length, rejected });
}
