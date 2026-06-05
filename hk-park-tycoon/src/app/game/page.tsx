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
import { GuestManager } from '../../engine/simulation/GuestManager';
import { RideManager } from '../../engine/simulation/RideManager';
import { StaffManager } from '../../engine/simulation/StaffManager';
import { EconomyManager } from '../../engine/simulation/EconomyManager';
import { Grid } from '../../engine/world/Grid';
import { loadAutoSave, loadGame, autoSave } from '../../state/saveManager';
import { GameSpeed, ToolType, TileType, StaffType } from '../../engine/types';
import type { RideDefinition, ShopDefinition, GameDate } from '../../engine/types';
import ridesData from '../../data/rides.json';
import shopsData from '../../data/shops.json';
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

// Litter model: guests drop litter; janitors clean it. Aggregate (not per-tile).
const LITTER_PER_GUEST_TICK = 0.02;
const JANITOR_CLEAN_PER_TICK = 1.5;

// Definition lookup maps (keyed by definition id), built once at module load.
const RIDE_DEFS: Record<string, RideDefinition> = {};
(ridesData as RideDefinition[]).forEach((d) => {
  RIDE_DEFS[d.id] = d;
});
const SHOP_DEFS: Record<string, ShopDefinition> = {};
(shopsData as ShopDefinition[]).forEach((d) => {
  SHOP_DEFS[d.id] = d;
});

const sumRideRevenue = (rides: Record<string, { totalRevenue: number }>): number =>
  Object.values(rides).reduce((acc, r) => acc + r.totalRevenue, 0);
const sumShopRevenue = (shops: Record<string, { revenue: number }>): number =>
  Object.values(shops).reduce((acc, s) => acc + s.revenue, 0);

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
  const guestManagerRef = useRef<GuestManager | null>(null);
  const rideManagerRef = useRef<RideManager | null>(null);
  const staffManagerRef = useRef<StaffManager | null>(null);
  const economyManagerRef = useRef<EconomyManager | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store actions (stable references for initialization)
  const initGame = useGameStore((s) => s.initGame);
  const hydrateGame = useGameStore((s) => s.hydrateGame);

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
        // Load specific save slot — restore the full park, not just its name.
        const savedState = await loadGame(loadSlot);
        if (savedState && !cancelled) {
          hydrateGame(savedState);
        } else if (!cancelled) {
          initGame('My HK Park');
        }
      } else {
        // Try to load auto-save, fall back to new game
        const savedState = await loadAutoSave();
        if (savedState && !cancelled) {
          hydrateGame(savedState);
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
  }, [isNewGame, loadSlot, initGame, hydrateGame]);

  // -------------------------------------------------------------------------
  // Start game loop and simulation after initialization
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!initialized) return;

    const eventBus = eventBusRef.current;

    // Create simulation managers
    const parkRating = new ParkRating(eventBus);
    const weatherManager = new WeatherManager(eventBus);
    const guestManager = new GuestManager(eventBus);
    const rideManager = new RideManager(eventBus);
    const staffManager = new StaffManager();
    const economyManager = new EconomyManager(eventBus);
    parkRatingRef.current = parkRating;
    weatherManagerRef.current = weatherManager;
    guestManagerRef.current = guestManager;
    rideManagerRef.current = rideManager;
    staffManagerRef.current = staffManager;
    economyManagerRef.current = economyManager;

    // Create and start game loop
    const gameLoop = new GameLoop(eventBus);
    gameLoopRef.current = gameLoop;

    // ---- Per-tick simulation orchestration ----
    // Reads a fresh store snapshot, runs all managers on UNFROZEN clones, then
    // commits guests/rides/shops/staff + revenue back in a single store update.
    const onTick = ({ tick }: { tick: number }) => {
      const store = useGameStore.getState();
      store.advanceTick();

      // Bridge the store's grid (read-only) into the Grid API the managers use.
      const grid = Grid.fromTiles(store.grid);

      const guests = structuredClone(store.guests);
      const rides = structuredClone(store.rides);
      const shops = structuredClone(store.shops);
      const staff = structuredClone(store.staff);

      const rideRevenueBefore = sumRideRevenue(rides);
      const shopRevenueBefore = sumShopRevenue(shops);

      // --- Guest spawning (driven by park rating, district, and weather) ---
      let newGuestCount = 0;
      const weatherEffects = weatherManager.getWeatherEffects(store.weather);
      const entrance = grid.findTilesOfType(TileType.ENTRANCE)[0];

      if (
        entrance &&
        weatherEffects.parkOpen &&
        weatherEffects.spawnRateMultiplier > 0
      ) {
        const unlockedMultipliers = store.districts
          .filter((d) => d.unlocked)
          .map((d) => d.guestMultiplier ?? 1);
        const districtMultiplier = unlockedMultipliers.length
          ? Math.max(...unlockedMultipliers)
          : 1;

        const baseInterval = parkRating.getSpawnRate(
          store.parkRating,
          districtMultiplier,
        );
        const interval = Math.max(
          1,
          Math.round(baseInterval / weatherEffects.spawnRateMultiplier),
        );

        if (guestManager.shouldSpawn(tick, interval)) {
          const guest = guestManager.spawnGuest(entrance);
          guests[guest.id] = guest;
          newGuestCount++;
        }
      }

      // --- Guests: needs, pathfinding, queueing, riding, shopping ---
      const { updated } = guestManager.processAllGuests(
        guests,
        grid,
        rides,
        shops,
        RIDE_DEFS,
        SHOP_DEFS,
        tick,
      );

      // NOTE: ride queueing/boarding/cycle/completion is owned end-to-end by
      // GuestManager (processQueuing boards riders and starts the ride timer;
      // processRiding completes the ride and charges the guest). We deliberately
      // do NOT also call RideManager.processRideTick here — running both created
      // a second, conflicting boarding system. RideManager is still used for
      // monthly aging, breakdowns, and rating math.

      // --- Staff: mechanics seek breakdowns, others patrol ---
      const brokenRides = Object.keys(rides).filter(
        (id) => rides[id].status === 'broken',
      );
      // Mechanics head toward each broken ride's access (entrance) tile.
      const brokenRideTargets = brokenRides.map((id) => rides[id].entranceTile);
      for (const staffId of Object.keys(staff)) {
        staff[staffId] = staffManager.processStaffTick(
          staff[staffId],
          grid,
          brokenRideTargets,
        );
      }

      // --- Mechanic repair: a mechanic adjacent to a broken ride fixes it ---
      const repairedRideIds = new Set<string>();
      for (const staffId of Object.keys(staff)) {
        const member = staff[staffId];
        if (member.type !== StaffType.MECHANIC) continue;
        const sx = Math.round(member.tile.x);
        const sy = Math.round(member.tile.y);
        for (const rideId of brokenRides) {
          if (repairedRideIds.has(rideId)) continue;
          const ride = rides[rideId];
          if (!ride) continue;
          const adjacent = ride.tiles.some(
            (t) => Math.abs(t.x - sx) + Math.abs(t.y - sy) <= 1,
          );
          if (adjacent) {
            repairedRideIds.add(rideId);
            break;
          }
        }
      }

      // --- Litter: guests generate it, janitors clean it (aggregate model) ---
      const guestCount = Object.keys(updated).length;
      const janitorCount = Object.values(staff).filter(
        (s) => s.type === StaffType.JANITOR,
      ).length;
      const baseLitter = Number.isFinite(store.litter) ? store.litter : 0;
      const newLitter = Math.max(
        0,
        baseLitter +
          guestCount * LITTER_PER_GUEST_TICK -
          janitorCount * JANITOR_CLEAN_PER_TICK,
      );

      // --- Revenue: diff the running ride/shop totals accrued this tick ---
      const rideIncome = sumRideRevenue(rides) - rideRevenueBefore;
      const shopIncome = sumShopRevenue(shops) - shopRevenueBefore;
      const revenue = rideIncome + shopIncome;
      if (rideIncome > 0) {
        economyManager.recordTransaction(rideIncome, 'ride-revenue', 'Ride tickets');
      }
      if (shopIncome > 0) {
        economyManager.recordTransaction(shopIncome, 'shop-revenue', 'Shop sales');
      }

      // --- Commit the whole tick in one store update ---
      store.applySimulationResult({
        guests: updated,
        rides,
        shops,
        staff,
        revenue,
        newGuestCount,
        litter: newLitter,
      });

      // --- Apply mechanic repairs (status is player/sim-shared, set explicitly) ---
      for (const rideId of Array.from(repairedRideIds)) {
        store.repairRide(rideId);
        const ride = rides[rideId];
        // Keep the local clone in sync so this tick's rating sees the repair.
        if (ride) ride.status = 'open';
        store.addNotification(
          `${ride ? ride.name : 'A ride'} was repaired by a mechanic.`,
          'success',
        );
      }

      // --- Periodic park-rating recalculation (now with real litter) ---
      if (tick % PARK_RATING_INTERVAL === 0) {
        const rating = parkRating.calculate(
          updated,
          rides,
          store.districts,
          newLitter,
        );
        useGameStore.getState().setParkRating(rating);
      }
    };

    const onDay = ({ date }: { date: GameDate }) => {
      const store = useGameStore.getState();

      // Keep the store clock in sync so the UI date advances.
      store.setDate(date);

      // Process weather on each new day.
      const result = weatherManager.processDay(date);
      store.updateWeather(result.weather);
      store.updateSeason(result.season);

      // Daily ride-breakdown rolls. checkBreakdown emits 'ride-broke' (bridged
      // to a toast below); breakRide persists the broken status to the store.
      const ridesClone = structuredClone(store.rides);
      for (const rideId of Object.keys(ridesClone)) {
        if (rideManager.checkBreakdown(ridesClone[rideId], date.day)) {
          store.breakRide(rideId);
        }
      }
    };

    const onMonth = ({ date }: { date: GameDate }) => {
      const store = useGameStore.getState();

      // Age all rides by one month (excitement decay, etc.).
      const agedRides = rideManager.ageRides(structuredClone(store.rides));
      for (const rideId of Object.keys(agedRides)) {
        store.updateRide(rideId, agedRides[rideId]);
      }

      // Settle monthly finances. Per-tick revenue is already banked, so apply
      // only the month's EXPENSES here; keep the report for the Finance panel.
      const report = economyManager.processMonth(
        store.rides,
        store.staff,
        store.loanAmount,
        store.loanInterestRate,
        store.money,
        date,
      );
      // Revenue is already banked per tick, so the true end-of-month cash is
      // current money minus this month's expenses. (processMonth's own
      // cashBalance = money + netProfit would double-count the banked revenue.)
      report.cashBalance = store.money - report.totalExpenses;
      store.addMonthlyReport(report);
      if (report.totalExpenses > 0) {
        store.addMoney(-report.totalExpenses, 'expenses', 'Monthly expenses');
      }

      store.addNotification(
        `Month ${date.month}, Year ${date.year}: ${
          report.netProfit >= 0 ? 'profit' : 'loss'
        } of $${Math.abs(Math.round(report.netProfit)).toLocaleString()}.`,
        report.netProfit >= 0 ? 'success' : 'warning',
      );
    };

    // Bridge engine notifications into UI toasts.
    const onNotification = ({
      message,
      type,
      entityId,
    }: {
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
      entityId?: string;
    }) => {
      useGameStore.getState().addNotification(message, type, entityId);
    };

    // Bridge ride breakdowns into a toast.
    const onRideBroke = ({ rideName }: { rideId: string; rideName: string }) => {
      useGameStore
        .getState()
        .addNotification(`${rideName} broke down! Send a mechanic.`, 'error');
    };

    eventBus.on('tick', onTick);
    eventBus.on('day', onDay);
    eventBus.on('month', onMonth);
    eventBus.on('notification', onNotification);
    eventBus.on('ride-broke', onRideBroke);

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
      eventBus.off('notification', onNotification);
      eventBus.off('ride-broke', onRideBroke);

      unsubSpeed();

      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      parkRatingRef.current = null;
      weatherManagerRef.current = null;
      guestManagerRef.current = null;
      rideManagerRef.current = null;
      staffManagerRef.current = null;
      economyManagerRef.current = null;
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
