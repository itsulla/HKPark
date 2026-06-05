import { NextResponse } from 'next/server';
import { appendFile, stat, rename } from 'node:fs/promises';
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

// Append-only analytics log (override path via IMPRESSIONS_LOG). Rotated once it
// exceeds MAX_LOG_BYTES so a hostile client cannot grow it without bound.
const LOG_PATH = process.env.IMPRESSIONS_LOG ?? join(tmpdir(), 'hk-impressions.jsonl');
const MAX_LOG_BYTES = 50 * 1024 * 1024; // 50 MB

// In-memory rate limit (fixed window). Resets on server restart — adequate for
// abuse mitigation on anonymous client telemetry. We keep a per-IP limit AND a
// global backstop so spoofed x-forwarded-for values can't bypass throttling.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_IP = 60; // per IP per window
const RATE_MAX_GLOBAL = 6_000; // total requests/window across all IPs
const MAX_BUCKETS = 10_000; // cap the IP map to bound memory
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let globalWindow = { count: 0, resetAt: 0 };

function rateLimited(ip: string, now: number): boolean {
  // Global backstop first — bounds total work regardless of IP spoofing.
  if (now >= globalWindow.resetAt) {
    globalWindow = { count: 1, resetAt: now + RATE_WINDOW_MS };
  } else {
    globalWindow.count += 1;
    if (globalWindow.count > RATE_MAX_GLOBAL) return true;
  }

  // Evict expired buckets (and hard-cap the map) to prevent unbounded growth.
  if (rateBuckets.size > MAX_BUCKETS) {
    rateBuckets.forEach((b, key) => {
      if (now >= b.resetAt) rateBuckets.delete(key);
    });
    if (rateBuckets.size > MAX_BUCKETS) rateBuckets.clear();
  }

  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_PER_IP;
}

function clientIp(request: Request): string {
  // NOTE: x-forwarded-for is client-settable when not behind a trusted proxy,
  // so the per-IP limit is best-effort; the global backstop above is the real
  // guarantee. Behind a proxy, configure it to set a trustworthy value.
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, MAX_ID_LEN);
  return (request.headers.get('x-real-ip') ?? 'unknown').slice(0, MAX_ID_LEN);
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

  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
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
    // JSON.stringify escapes control chars, so newlines in string fields can't
    // break the JSONL format.
    const lines =
      validEvents
        .map((e) => JSON.stringify({ ...e, sessionId: batch.sessionId, ip }))
        .join('\n') + '\n';
    try {
      // Rotate the log if it has grown past the cap (bounds disk usage).
      try {
        const { size } = await stat(LOG_PATH);
        if (size > MAX_LOG_BYTES) {
          await rename(LOG_PATH, `${LOG_PATH}.1`);
        }
      } catch {
        // File may not exist yet — that's fine.
      }
      await appendFile(LOG_PATH, lines, 'utf8');
    } catch {
      // Swallow — analytics persistence is best-effort.
    }
  }

  return NextResponse.json({ ok: true, received: validEvents.length, rejected });
}
