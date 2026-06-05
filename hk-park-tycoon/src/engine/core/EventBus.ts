// =============================================================================
// HK Theme Park Tycoon - EventBus (Typed Event System)
// =============================================================================

import { GameDate, Weather } from '../types';

// -----------------------------------------------------------------------------
// Event Payload Definitions
// -----------------------------------------------------------------------------

export interface GameEvents {
  'tick': { tick: number };
  'day': { date: GameDate };
  'week': { date: GameDate };
  'month': { date: GameDate };
  'year': { date: GameDate };
  'guest-entered': { guestId: string };
  'guest-left': { guestId: string; reason: string };
  'ride-broke': { rideId: string; rideName: string };
  'ride-fixed': { rideId: string };
  'money-changed': { amount: number; balance: number; category: string };
  'rating-changed': { oldRating: number; newRating: number };
  'weather-changed': { weather: Weather };
  'district-unlocked': { districtId: string };
  'notification': {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    entityId?: string;
  };
}

// -----------------------------------------------------------------------------
// EventBus (Singleton)
// -----------------------------------------------------------------------------

type EventCallback<K extends keyof GameEvents> = (data: GameEvents[K]) => void;

/** Internal untyped callback representation used for the heterogeneous map. */
type InternalCallback = (data: GameEvents[keyof GameEvents]) => void;

export class EventBus {
  private static instance: EventBus | null = null;

  private listeners: Map<keyof GameEvents, Set<InternalCallback>>;

  private constructor() {
    this.listeners = new Map();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<K>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as InternalCallback);
  }

  off<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<K>,
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as InternalCallback);
    }
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
