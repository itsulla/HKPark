'use client';

// =============================================================================
// HK Theme Park Tycoon - Main Game Page
// =============================================================================
// Assembles the full game: PixiJS canvas + UI overlays + game loop + simulation.
// Layout architecture:
//   z-canvas(0)  -- PixiJS renderer fills the viewport
//   z-ui(10)     -- TopBar, Toolbar (fixed top/bottom)
//   z-panel(20)  -- InfoPanel (right side or bottom sheet)
//   z-modal(50+) -- FinanceWindow, DistrictPanel (centered overlay)
//   z-notification(100) -- toast notifications

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '../../state/gameStore';
import { GameLoop } from '../../engine/core/GameLoop';
import { EventBus } from '../../engine/core/EventBus';
import { ParkRating } from '../../engine/simulation/ParkRating';
import { WeatherManager } from '../../engine/simulation/WeatherManager';
import { loadAutoSave, loadGame, autoSave } from '../../state/saveManager';
import { GameSpeed, ToolType } from '../../engine/types';
import TopBar from '../../ui/TopBar';
import Toolbar from '../../ui/Toolbar';
import InfoPanel from '../../ui/InfoPanel';
import FinanceWindow from '../../ui/FinanceWindow';
import DistrictPanel from '../../ui/DistrictPanel';
import NotificationToast from '../../ui/NotificationToast';

// Dynamic import for PixiJS (no SSR)
const GameCanvas = dynamic(
  () =>
    import('../../renderer/GameCanvas').then((mod) => ({
      default: mod.default,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-darkest">
        <div className="text-gray-500 text-sm">Loading renderer...</div>
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARK_RATING_INTERVAL = 30; // recalculate every 30 ticks
const AUTO_SAVE_INTERVAL_MS = 60_000; // auto-save every 60 seconds of real time

// ---------------------------------------------------------------------------
// Game Page (inner component that reads search params)
// ---------------------------------------------------------------------------

function GamePageInner() {
  const searchParams = useSearchParams();
  const isNewGame = searchParams.get('new') === 'true';
  const loadSlot = searchParams.get('slot');

  // Modal state
  const [showFinance, setShowFinance] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Refs for game systems (persist across renders)
  const gameLoopRef = useRef<GameLoop | null>(null);
  const eventBusRef = useRef<EventBus>(EventBus.getInstance());
  const parkRatingRef = useRef<ParkRating | null>(null);
  const weatherManagerRef = useRef<WeatherManager | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store action (stable reference for initialization)
  const initGame = useGameStore((s) => s.initGame);

  // -------------------------------------------------------------------------
  // Initialize game on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (isNewGame) {
        // Start a fresh game
        initGame('My HK Park');
      } else if (loadSlot) {
        // Load specific save slot
        const savedState = await loadGame(loadSlot);
        if (savedState && !cancelled) {
          initGame(savedState.parkName || 'My HK Park');
        } else if (!cancelled) {
          initGame('My HK Park');
        }
      } else {
        // Try to load auto-save, fall back to new game
        const savedState = await loadAutoSave();
        if (savedState && !cancelled) {
          initGame(savedState.parkName || 'My HK Park');
        } else if (!cancelled) {
          initGame('My HK Park');
        }
      }

      if (!cancelled) {
        setInitialized(true);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [isNewGame, loadSlot, initGame]);

  // -------------------------------------------------------------------------
  // Start game loop and simulation after initialization
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!initialized) return;

    const eventBus = eventBusRef.current;

    // Create simulation managers
    const parkRating = new ParkRating(eventBus);
    const weatherManager = new WeatherManager(eventBus);
    parkRatingRef.current = parkRating;
    weatherManagerRef.current = weatherManager;

    // Create and start game loop
    const gameLoop = new GameLoop(eventBus);
    gameLoopRef.current = gameLoop;

    // Subscribe to tick events for simulation orchestration
    const onTick = ({ tick }: { tick: number }) => {
      const store = useGameStore.getState();

      // Advance the store's tick counter
      store.advanceTick();

      // Recalculate park rating periodically
      if (tick % PARK_RATING_INTERVAL === 0) {
        const rating = parkRating.calculate(
          store.guests,
          store.rides,
          store.districts,
          0, // litter count (TODO: track litter)
        );
        store.setParkRating(rating);
      }
    };

    const onDay = ({ date }: { date: { day: number; month: number; year: number } }) => {
      const store = useGameStore.getState();

      // Process weather on each new day
      if (weatherManagerRef.current) {
        const result = weatherManagerRef.current.processDay(date);
        store.updateWeather(result.weather);
        store.updateSeason(result.season);
      }
    };

    const onMonth = ({ date }: { date: { day: number; month: number; year: number } }) => {
      const store = useGameStore.getState();

      // Age rides monthly
      for (const rideId of Object.keys(store.rides)) {
        const ride = store.rides[rideId];
        if (ride) {
          store.updateRide(rideId, { monthsOld: ride.monthsOld + 1 });
        }
      }

      store.addNotification(
        `Month ${date.month} of Year ${date.year} has ended.`,
        'info',
      );
    };

    eventBus.on('tick', onTick);
    eventBus.on('day', onDay);
    eventBus.on('month', onMonth);

    // Sync game loop speed with store speed
    let prevSpeed = useGameStore.getState().speed;
    gameLoop.setSpeed(prevSpeed);

    const unsubSpeed = useGameStore.subscribe((state) => {
      if (state.speed !== prevSpeed) {
        prevSpeed = state.speed;
        if (gameLoopRef.current) {
          gameLoopRef.current.setSpeed(state.speed);
        }
      }
    });

    // Start the loop
    gameLoop.start();

    // Auto-save timer
    autoSaveTimerRef.current = setInterval(() => {
      const state = useGameStore.getState();
      autoSave(state).catch(() => {
        // Silently fail auto-save
      });
    }, AUTO_SAVE_INTERVAL_MS);

    // Cleanup
    return () => {
      gameLoop.stop();
      gameLoopRef.current = null;

      eventBus.off('tick', onTick);
      eventBus.off('day', onDay);
      eventBus.off('month', onMonth);

      unsubSpeed();

      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      parkRatingRef.current = null;
      weatherManagerRef.current = null;
    };
  }, [initialized]);

  // -------------------------------------------------------------------------
  // Toggle callbacks for modals
  // -------------------------------------------------------------------------

  const toggleFinance = useCallback(() => {
    setShowFinance((prev) => !prev);
  }, []);

  const toggleDistricts = useCallback(() => {
    setShowDistricts((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // Global keyboard shortcuts
  // -------------------------------------------------------------------------
  // Space = toggle pause, Esc = cancel placement / close modals,
  // R = rotate placement, 1-7 = select tools, +/- = cycle speed

  useEffect(() => {
    if (!initialized) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing into inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const store = useGameStore.getState();

      switch (e.key) {
        // ---- Pause / unpause ----
        case ' ': {
          e.preventDefault();
          if (store.speed === GameSpeed.PAUSED) {
            store.setSpeed(GameSpeed.NORMAL);
          } else {
            store.setSpeed(GameSpeed.PAUSED);
          }
          break;
        }

        // ---- Escape: close modals, cancel placement ----
        case 'Escape': {
          if (showFinance) {
            setShowFinance(false);
          } else if (showDistricts) {
            setShowDistricts(false);
          } else if (store.selectedEntityId) {
            store.setSelectedEntity(null);
          } else if (store.placementDefinitionId) {
            store.setPlacementDefinition(null);
            store.setTool(ToolType.SELECT);
          }
          break;
        }

        // ---- Rotate placement ----
        case 'r':
        case 'R': {
          const nextRotation = ((store.placementRotation + 1) % 4) as 0 | 1 | 2 | 3;
          store.setPlacementRotation(nextRotation);
          break;
        }

        // ---- Speed up ----
        case '+':
        case '=': {
          if (store.speed < GameSpeed.ULTRA) {
            store.setSpeed(store.speed + 1);
          }
          break;
        }

        // ---- Speed down ----
        case '-':
        case '_': {
          if (store.speed > GameSpeed.PAUSED) {
            store.setSpeed(store.speed - 1);
          }
          break;
        }

        // ---- Tool shortcuts 1-7 are handled by Toolbar component ----
        // We do not duplicate them here to avoid conflicts.

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialized, showFinance, showDistricts]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!initialized) {
    return (
      <div className="h-screen w-screen bg-darkest flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">
          Initializing park...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-darkest game-ui">
      {/* Layer 0: PixiJS Canvas -- fills entire viewport behind everything */}
      <div className="absolute inset-0 z-canvas">
        <GameCanvas />
      </div>

      {/* Layer 10-30: Fixed UI chrome */}
      <TopBar />
      <Toolbar
        onOpenFinance={toggleFinance}
        onOpenDistricts={toggleDistricts}
      />

      {/* Layer 20: InfoPanel (right side on desktop, bottom sheet on mobile) */}
      <InfoPanel />

      {/* Layer 50+: Modal overlays */}
      {showFinance && <FinanceWindow onClose={() => setShowFinance(false)} />}
      {showDistricts && <DistrictPanel onClose={() => setShowDistricts(false)} />}

      {/* Layer 100: Toast notifications */}
      <NotificationToast />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper with Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-darkest flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading game...</div>
        </div>
      }
    >
      <GamePageInner />
    </Suspense>
  );
}
