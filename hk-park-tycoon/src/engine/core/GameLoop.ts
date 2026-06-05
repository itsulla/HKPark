// =============================================================================
// HK Theme Park Tycoon - GameLoop (Game Loop Manager)
// =============================================================================

import { GameSpeed, GameDate } from '../types';
import { EventBus } from './EventBus';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TICKS_PER_DAY = 30;
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

/** Maps each GameSpeed to the number of milliseconds per tick. */
const SPEED_MS_PER_TICK: Record<GameSpeed, number> = {
  [GameSpeed.PAUSED]: Infinity,
  [GameSpeed.NORMAL]: 100,
  [GameSpeed.FAST]: 50,
  [GameSpeed.ULTRA]: 25,
};

// -----------------------------------------------------------------------------
// GameLoop
// -----------------------------------------------------------------------------

export class GameLoop {
  private speed: GameSpeed = GameSpeed.NORMAL;
  private currentTick: number = 0;
  private date: GameDate = { day: 1, month: 1, year: 1 };
  private running: boolean = false;
  private lastTimestamp: number = 0;
  private tickAccumulator: number = 0;
  private animationFrameId: number = 0;

  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = 0;
    this.tickAccumulator = 0;
    this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
  }

  getDate(): GameDate {
    return { ...this.date };
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ---------------------------------------------------------------------------
  // Private Loop
  // ---------------------------------------------------------------------------

  private loop(timestamp: number): void {
    if (!this.running) return;

    // First frame -- seed lastTimestamp, no delta to process
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
      return;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const msPerTick = SPEED_MS_PER_TICK[this.speed];

    // When paused, just keep the rAF alive but don't advance time
    if (msPerTick === Infinity) {
      this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
      return;
    }

    this.tickAccumulator += delta;

    while (this.tickAccumulator >= msPerTick) {
      this.tickAccumulator -= msPerTick;
      this.currentTick++;

      // --- Tick event ---
      this.eventBus.emit('tick', { tick: this.currentTick });

      // --- Day boundary ---
      if (this.currentTick % TICKS_PER_DAY === 0) {
        this.date.day++;

        this.eventBus.emit('day', { date: this.getDate() });

        // --- Week boundary (every 7 days) ---
        if (this.date.day % 7 === 0) {
          this.eventBus.emit('week', { date: this.getDate() });
        }

        // --- Month boundary ---
        if (this.date.day > DAYS_PER_MONTH) {
          this.date.day = 1;
          this.date.month++;

          this.eventBus.emit('month', { date: this.getDate() });

          // --- Year boundary ---
          if (this.date.month > MONTHS_PER_YEAR) {
            this.date.month = 1;
            this.date.year++;

            this.eventBus.emit('year', { date: this.getDate() });
          }
        }
      }
    }

    this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }
}
