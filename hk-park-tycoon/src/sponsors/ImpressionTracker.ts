/**
 * ImpressionTracker — Client-side analytics collection.
 *
 * Tracks visibility, clicks, hovers, and VIP mentions for all
 * sponsorable surfaces. Data is buffered client-side and batch-sent
 * to /api/impressions periodically.
 *
 * Even before sponsors exist, this collects baseline data:
 * - How often each shop/ride appears on screen
 * - Which surfaces get clicked/hovered most
 * - Average session duration and surfaces-per-session
 */

import { ImpressionEvent } from '../engine/types';
import { v4 as uuidv4 } from 'uuid';

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BUFFER_SIZE = 500;

export class ImpressionTracker {
  private buffer: ImpressionEvent[] = [];
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private unloadHandler: (() => void) | null = null;

  constructor() {
    this.sessionId = uuidv4();
    this.startAutoFlush();
    this.setupUnloadFlush();
  }

  /** Get the current session ID. */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Add an impression event to the buffer. */
  track(event: ImpressionEvent): void {
    this.buffer.push(event);

    // Force flush if buffer is full
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  /** Send buffered events to the API. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await fetch('/api/impressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, sessionId: this.sessionId }),
      });
    } catch {
      // Re-add events if send failed (they'll be retried next flush)
      this.buffer.unshift(...events);
      // But cap at max to prevent unbounded growth
      if (this.buffer.length > MAX_BUFFER_SIZE * 2) {
        this.buffer = this.buffer.slice(-MAX_BUFFER_SIZE);
      }
    }
  }

  /** Get number of buffered events. */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /** Cleanup timers and flush remaining events. */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private setupUnloadFlush(): void {
    if (typeof window === 'undefined') return;

    this.unloadHandler = () => {
      // Use sendBeacon for reliable delivery on page unload
      if (this.buffer.length > 0 && navigator.sendBeacon) {
        const payload = JSON.stringify({
          events: this.buffer,
          sessionId: this.sessionId,
        });
        navigator.sendBeacon('/api/impressions', payload);
        this.buffer = [];
      }
    };

    window.addEventListener('beforeunload', this.unloadHandler);
  }
}
