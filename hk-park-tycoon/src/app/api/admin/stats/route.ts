import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run on the Node.js runtime (needs fs); never cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same log path convention as /api/impressions.
const LOG_PATH =
  process.env.IMPRESSIONS_LOG ?? join(tmpdir(), 'hk-impressions.jsonl');

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------
// Protected by a bearer token (ADMIN_TOKEN env var). With no token configured,
// the endpoint is disabled entirely — fail closed, never open.
// -----------------------------------------------------------------------------

function isAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${token}`;
}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

interface LoggedEvent {
  sessionId?: string;
  surfaceType?: string;
  surfaceId?: string;
  sponsorId?: string;
  eventType?: string;
  timestamp?: number;
  receivedAt?: number;
}

interface SponsorStats {
  total: number;
  byEventType: Record<string, number>;
  bySurface: Record<string, number>;
  uniqueSessions: number;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Set ADMIN_TOKEN and pass it as a Bearer token.' },
      { status: 401 },
    );
  }

  let raw = '';
  try {
    raw = await readFile(LOG_PATH, 'utf8');
  } catch {
    // No log yet — return an empty (but valid) report.
    return NextResponse.json({
      logPath: LOG_PATH,
      totalEvents: 0,
      uniqueSessions: 0,
      byEventType: {},
      bySponsor: {},
      byDay: {},
      generatedAt: new Date().toISOString(),
    });
  }

  const byEventType: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const sponsorAgg = new Map<
    string,
    SponsorStats & { sessions: Set<string> }
  >();
  const allSessions = new Set<string>();
  let totalEvents = 0;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev: LoggedEvent;
    try {
      ev = JSON.parse(line) as LoggedEvent;
    } catch {
      continue; // skip corrupt lines
    }
    totalEvents++;

    const eventType = ev.eventType ?? 'unknown';
    byEventType[eventType] = (byEventType[eventType] ?? 0) + 1;

    if (ev.sessionId) allSessions.add(ev.sessionId);

    const ts = ev.receivedAt ?? ev.timestamp;
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      const day = new Date(ts).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const sponsorId = ev.sponsorId;
    if (sponsorId) {
      let agg = sponsorAgg.get(sponsorId);
      if (!agg) {
        agg = {
          total: 0,
          byEventType: {},
          bySurface: {},
          uniqueSessions: 0,
          sessions: new Set<string>(),
        };
        sponsorAgg.set(sponsorId, agg);
      }
      agg.total++;
      agg.byEventType[eventType] = (agg.byEventType[eventType] ?? 0) + 1;
      const surface = `${ev.surfaceType ?? '?'}:${ev.surfaceId ?? '?'}`;
      agg.bySurface[surface] = (agg.bySurface[surface] ?? 0) + 1;
      if (ev.sessionId) agg.sessions.add(ev.sessionId);
    }
  }

  const bySponsor: Record<string, SponsorStats> = {};
  sponsorAgg.forEach((agg, sponsorId) => {
    bySponsor[sponsorId] = {
      total: agg.total,
      byEventType: agg.byEventType,
      bySurface: agg.bySurface,
      uniqueSessions: agg.sessions.size,
    };
  });

  return NextResponse.json({
    logPath: LOG_PATH,
    totalEvents,
    uniqueSessions: allSessions.size,
    byEventType,
    bySponsor,
    byDay,
    generatedAt: new Date().toISOString(),
  });
}
