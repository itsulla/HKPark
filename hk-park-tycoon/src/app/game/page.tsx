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
import { VIPManager } from '../../engine/simulation/VIPManager';
import { Grid } from '../../engine/world/Grid';
import SponsorManager from '../../sponsors/SponsorManager';
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
import VIPFeed from '../../ui/VIPFeed';
import GameEndOverlay from '../../ui/GameEndOverlay';
import ObjectivesWidget from '../../ui/ObjectivesWidget';
import SoundBridge from '../../ui/SoundBridge';
import OnboardingHint from '../../ui/OnboardingHint';

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

// How often (ticks) a VIP pipes up with a line of commentary.
const VIP_COMMENT_INTERVAL = 120;

// Staff aura: tiles within which entertainers/security lift guest happiness.
const STAFF_AURA_RADIUS = 6;
const ENTERTAINER_HAPPINESS_PER_TICK = 0.4;
const SECURITY_HAPPINESS_PER_TICK = 0.15;

// Win/lose tuning.
const BANKRUPTCY_DEBT_DAYS = 30; // days continuously in debt before game over
const VICTORY_RATING = 800;
const VICTORY_MONEY = 1_000_000;
const VICTORY_TOTAL_GUESTS = 1_000;

// Health-inspection event: fine applied when the park is too dirty.
const HEALTH_INSPECTION_LITTER_THRESHOLD = 30;
const HEALTH_INSPECTION_FINE = 2_000;

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
  const vipManagerRef = useRef<VIPManager | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store actions (stable references for initialization)
  const initGame = useGameStore((s) => s.initGame);
  const hydrateGame = useGameStore((s) => s.hydrateGame);

  // -------------------------------------------------------------------------
  // Initialize game on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    // Load active sponsor campaigns once (safe to fire-and-forget; the game
    // works with zero sponsors).
    void SponsorManager.loadSponsors();

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
    const vipManager = new VIPManager();
    parkRatingRef.current = parkRating;
    weatherManagerRef.current = weatherManager;
    guestManagerRef.current = guestManager;
    rideManagerRef.current = rideManager;
    staffManagerRef.current = staffManager;
    economyManagerRef.current = economyManager;
    vipManagerRef.current = vipManager;

    // Create the game loop.
    const gameLoop = new GameLoop(eventBus);
    gameLoopRef.current = gameLoop;

    // Seed the loop + weather from restored state so a loaded save continues
    // from its real date/tick/weather instead of restarting at day 1 / clear.
    const seed = useGameStore.getState();
    gameLoop.hydrate({ currentTick: seed.currentTick, date: seed.date });
    weatherManager.hydrate(seed.weather, seed.season);

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
        // Active park events (festival, holiday rush) boost the spawn rate.
        const eventSpawnMultiplier = store.activeEvent?.spawnMultiplier ?? 1;
        const interval = Math.max(
          1,
          Math.round(
            baseInterval /
              (weatherEffects.spawnRateMultiplier * eventSpawnMultiplier),
          ),
        );

        if (guestManager.shouldSpawn(tick, interval)) {
          const guest = guestManager.spawnGuest(entrance);
          guests[guest.id] = guest;
          newGuestCount++;
        }
      }

      // --- VIP spawning (rare, named personas; Layer 2) ---
      if (entrance && weatherEffects.parkOpen) {
        const presentVipIds = new Set<string>();
        for (const g of Object.values(guests)) {
          if (g.vipPersonaId) presentVipIds.add(g.vipPersonaId);
        }
        const persona = vipManager.pickSpawnPersona(tick, presentVipIds);
        if (persona) {
          const vipGuest = vipManager.applyPersona(
            guestManager.spawnGuest(entrance),
            persona,
          );
          guests[vipGuest.id] = vipGuest;
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

      // --- Staff aura effects: entertainers and security lift nearby guests ---
      // Entertainers cheer guests up; security makes guests feel safe (smaller
      // bonus). Without these, hiring either type is a pure money sink.
      const entertainerTiles: { x: number; y: number }[] = [];
      const securityTiles: { x: number; y: number }[] = [];
      for (const member of Object.values(staff)) {
        if (member.type === StaffType.ENTERTAINER) {
          entertainerTiles.push(member.tile);
        } else if (member.type === StaffType.SECURITY) {
          securityTiles.push(member.tile);
        }
      }
      if (entertainerTiles.length > 0 || securityTiles.length > 0) {
        for (const guest of Object.values(updated)) {
          let boost = 0;
          for (const t of entertainerTiles) {
            if (Math.abs(t.x - guest.x) + Math.abs(t.y - guest.y) <= STAFF_AURA_RADIUS) {
              boost += ENTERTAINER_HAPPINESS_PER_TICK;
              break; // one entertainer aura at a time
            }
          }
          for (const t of securityTiles) {
            if (Math.abs(t.x - guest.x) + Math.abs(t.y - guest.y) <= STAFF_AURA_RADIUS) {
              boost += SECURITY_HAPPINESS_PER_TICK;
              break;
            }
          }
          if (boost > 0) {
            guest.happiness = Math.min(255, guest.happiness + boost);
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
        const baseRating = parkRating.calculate(
          updated,
          rides,
          store.districts,
          newLitter,
        );
        // Celebrity visits and similar events boost the visible rating.
        const ratingMultiplier =
          useGameStore.getState().activeEvent?.ratingMultiplier ?? 1;
        useGameStore.getState().setParkRating(baseRating * ratingMultiplier);
      }

      // --- VIP commentary (Layer 2 + premium sponsor mentions) ---
      if (tick % VIP_COMMENT_INTERVAL === 0) {
        const vipGuests = Object.values(updated).filter((g) => g.vipPersonaId);
        if (vipGuests.length > 0) {
          const vipGuest =
            vipGuests[Math.floor(Math.random() * vipGuests.length)];
          const persona = vipGuest.vipPersonaId
            ? vipManager.getPersona(vipGuest.vipPersonaId)
            : undefined;
          if (persona) {
            // Sponsored surfaces currently present in the park.
            const surfaceIds = new Set<string>();
            for (const s of Object.values(shops)) surfaceIds.add(s.definitionId);
            for (const r of Object.values(rides)) surfaceIds.add(r.definitionId);
            const sponsoredSurfaces: {
              surfaceId: string;
              sponsorId: string;
              brandName: string;
            }[] = [];
            for (const defId of Array.from(surfaceIds)) {
              const sp = SponsorManager.getSponsor(defId);
              if (sp) {
                sponsoredSurfaces.push({
                  surfaceId: defId,
                  sponsorId: sp.sponsorId,
                  brandName: sp.brandName,
                });
              }
            }

            const comment = vipManager.generateComment(persona, {
              rideCount: Object.keys(rides).length,
              litterHigh: newLitter > 20,
              sponsoredSurfaces,
            });

            useGameStore.getState().addVipDialogue({
              id: `${tick}-${persona.id}-${Math.floor(Math.random() * 1e6)}`,
              personaId: persona.id,
              vipName: persona.name,
              avatarEmoji: persona.avatarEmoji,
              text: comment.text,
              sponsored: comment.sponsored,
              timestamp: useGameStore.getState().date,
            });

            if (comment.sponsored && comment.surfaceId && comment.sponsorId) {
              SponsorManager.trackImpression({
                surfaceType: 'vip',
                surfaceId: comment.surfaceId,
                sponsorId: comment.sponsorId,
                eventType: 'vip_mention',
              });
            }
          }
        }
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

      // Daily ride-breakdown rolls (per-definition breakdownChance). The
      // 'ride-broke' event is bridged to a toast below; breakRide persists.
      const ridesClone = structuredClone(store.rides);
      for (const rideId of Object.keys(ridesClone)) {
        const def = RIDE_DEFS[ridesClone[rideId].definitionId];
        if (rideManager.checkBreakdown(ridesClone[rideId], date.day, def)) {
          store.breakRide(rideId);
        }
      }

      // Daily ride-rating recalculation: scenery, ride proximity, age decay,
      // and weather all feed into excitement/intensity/nausea. Ratings are
      // rebuilt from definition base values so they never compound.
      const weatherMod = weatherManager.getWeatherEffects(
        result.weather,
      ).outdoorRideExcitementMod;
      const ratingGrid = Grid.fromTiles(store.grid);
      for (const rideId of Object.keys(ridesClone)) {
        const ride = ridesClone[rideId];
        const def = RIDE_DEFS[ride.definitionId];
        if (!def) continue;
        const ratings = rideManager.calculateRatings(
          ride,
          def,
          ratingGrid,
          ridesClone,
          weatherMod,
        );
        store.updateRide(rideId, ratings);
      }

      // Count down the active park event.
      const activeEvent = store.activeEvent;
      if (activeEvent) {
        const daysRemaining = activeEvent.daysRemaining - 1;
        if (daysRemaining <= 0) {
          store.setActiveEvent(null);
          store.addNotification(`${activeEvent.name} has ended.`, 'info');
        } else {
          store.setActiveEvent({ ...activeEvent, daysRemaining });
        }
      }

      // --- Lose condition: sustained bankruptcy ---
      if (!store.gameOver) {
        if (store.money < 0) {
          const days = store.daysInDebt + 1;
          store.setDaysInDebt(days);
          if (days === Math.floor(BANKRUPTCY_DEBT_DAYS / 2)) {
            store.addNotification(
              `The park is in debt! ${BANKRUPTCY_DEBT_DAYS - days} days to recover before bankruptcy.`,
              'error',
            );
          }
          if (days >= BANKRUPTCY_DEBT_DAYS) {
            store.setGameOver({
              reason: `The park stayed in debt for ${BANKRUPTCY_DEBT_DAYS} consecutive days and has gone bankrupt.`,
            });
          }
        } else if (store.daysInDebt > 0) {
          store.setDaysInDebt(0);
        }
      }

      // --- Win condition: rating + cash + lifetime guests milestones ---
      if (!store.victoryAchieved && !store.gameOver) {
        if (
          store.parkRating >= VICTORY_RATING &&
          store.money >= VICTORY_MONEY &&
          store.totalGuestsAllTime >= VICTORY_TOTAL_GUESTS
        ) {
          store.setVictoryAchieved(true);
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

      // --- Monthly random-event roll (festival, holiday rush, etc.) ---
      // Only one event runs at a time; a new roll is skipped while one is live.
      if (!store.activeEvent) {
        const rolled = weatherManager.checkRandomEvents(date);
        if (rolled) {
          switch (rolled.event) {
            case 'Festival Season':
              store.setActiveEvent({
                name: 'Festival Season',
                spawnMultiplier: 1.5,
                ratingMultiplier: 1,
                daysRemaining: 7,
              });
              store.addNotification(
                '🏮 Festival Season! Guest arrivals up 50% for 7 days.',
                'success',
              );
              break;
            case 'Holiday Rush':
              store.setActiveEvent({
                name: 'Holiday Rush',
                spawnMultiplier: 1.3,
                ratingMultiplier: 1,
                daysRemaining: 30,
              });
              store.addNotification(
                '🎉 Holiday Rush! Guest arrivals up 30% this month.',
                'success',
              );
              break;
            case 'Celebrity Visit':
              store.setActiveEvent({
                name: 'Celebrity Visit',
                spawnMultiplier: 1.1,
                ratingMultiplier: 1.2,
                daysRemaining: 3,
              });
              store.addNotification(
                '⭐ A celebrity is visiting! Park rating boosted for 3 days.',
                'success',
              );
              break;
            case 'Health Inspection': {
              if (store.litter > HEALTH_INSPECTION_LITTER_THRESHOLD) {
                store.addMoney(
                  -HEALTH_INSPECTION_FINE,
                  'expenses',
                  'Health inspection fine',
                );
                store.addNotification(
                  `🧪 Health inspection failed — fined $${HEALTH_INSPECTION_FINE.toLocaleString()}. Hire more janitors!`,
                  'error',
                );
              } else {
                store.addNotification(
                  '🧪 Health inspection passed. The park is clean.',
                  'success',
                );
              }
              break;
            }
          }
        }
      }
    };

    // Annual summary at the start of each new year.
    const onYear = ({ date }: { date: GameDate }) => {
      const store = useGameStore.getState();
      store.addNotification(
        `🎆 Year ${date.year}! Park rating ${Math.round(store.parkRating)}, ` +
          `${store.totalGuestsAllTime.toLocaleString()} lifetime guests, ` +
          `$${Math.round(store.money).toLocaleString()} in the bank.`,
        'info',
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
    eventBus.on('year', onYear);
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
      eventBus.off('year', onYear);
      eventBus.off('notification', onNotification);
      eventBus.off('ride-broke', onRideBroke);

      unsubSpeed();

      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Flush any buffered impression events before tearing down.
      SponsorManager.getTracker().flush();

      parkRatingRef.current = null;
      weatherManagerRef.current = null;
      guestManagerRef.current = null;
      rideManagerRef.current = null;
      staffManagerRef.current = null;
      economyManagerRef.current = null;
      vipManagerRef.current = null;
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

      {/* VIP commentary feed (bottom-left) */}
      <VIPFeed />

      {/* Objectives + active event (top-right) */}
      <ObjectivesWidget />

      {/* New-park onboarding steps (top-left) */}
      <OnboardingHint />

      {/* Layer 100: Toast notifications */}
      <NotificationToast />

      {/* Layer 200: bankruptcy / victory overlays */}
      <GameEndOverlay />

      {/* Audio: notification sounds + ambient loop + M mute key */}
      <SoundBridge />
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
