# Audit Report

## 1. Verdict

This codebase is **a disconnected shell, not a production-ready or meaningfully playable tycoon simulation**. The PixiJS renderer, build tools, store mutations, and UI chrome exist, so the player can place paths/rides/shops and open panels, but the actual simulation is mostly dead code. In the running game loop, [src/app/game/page.tsx:16](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx) imports only `GameLoop`, `EventBus`, `ParkRating`, and `WeatherManager`; refs are only created for `GameLoop`, `ParkRating`, and `WeatherManager` at [src/app/game/page.tsx:69](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx); and the initialization effect only constructs `ParkRating`, `WeatherManager`, and `GameLoop` at [src/app/game/page.tsx:127](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx). `GuestManager`, `RideManager`, `StaffManager`, and `EconomyManager` are not instantiated or ticked by the live loop. Guests do **not** ever spawn in the running game, because `GuestManager.spawnGuest()` exists at [src/engine/simulation/GuestManager.ts:89](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/GuestManager.ts) and `useGameStore.addGuest()` exists at [src/state/gameStore.ts:881](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts), but neither is called from the game loop. Revenue does **not** reach park money: guest ride/shop spending mutates guest/shop/ride-local fields in dead manager code, while the live monthly handler only ages rides and posts a notification at [src/app/game/page.tsx:166](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).

## 2. Critical Findings

- **Simulation managers are dead code.**  
  Evidence: the game page imports only `ParkRating` and `WeatherManager` from simulation at [src/app/game/page.tsx:20](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx), stores refs only for those managers at [src/app/game/page.tsx:69](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx), and constructs only those managers at [src/app/game/page.tsx:127](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: instantiate `GuestManager`, `RideManager`, `StaffManager`, and `EconomyManager` in `page.tsx`; on each tick, build or wrap the Zustand grid into the `Grid` API those managers expect, call guest spawn/processing, ride processing, staff processing, and commit results back through store actions.

- **Guests never spawn.**  
  Evidence: `GuestManager.spawnGuest()` exists at [src/engine/simulation/GuestManager.ts:89](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/GuestManager.ts), `ParkRating.getSpawnRate()` exists at [src/engine/simulation/ParkRating.ts:139](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/ParkRating.ts), and `addGuest()` exists at [src/state/gameStore.ts:881](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts), but `page.tsx` tick handling only calls `store.advanceTick()` and periodic rating calculation at [src/app/game/page.tsx:137](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: in `onTick`, find the entrance tile, compute spawn interval from rating/district/weather, call `guestManager.shouldSpawn()`, then `store.addGuest(guestManager.spawnGuest(entrance))`.

- **Revenue never reaches park cash.**  
  Evidence: guest ride completion subtracts `guest.cash` at [src/engine/simulation/GuestManager.ts:484](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/GuestManager.ts), shop purchases increment only `shop.revenue` at [src/engine/simulation/GuestManager.ts:548](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/GuestManager.ts), `EconomyManager.recordTransaction()` only stores an internal transaction and emits balance `0` at [src/engine/simulation/EconomyManager.ts:102](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/EconomyManager.ts), and the live month handler never calls `EconomyManager.processMonth()` or `store.addMoney()` at [src/app/game/page.tsx:166](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: define one money path. On ride/shop purchase, call `store.addMoney(amount, 'ride-revenue' | 'shop-revenue', ...)`, increment entity totals, and record transactions. On month, call `processMonth()`, add the report, and apply `netProfit` or apply expenses/revenue incrementally, not both.

- **Save/load loses nearly all game state.**  
  Evidence: `SaveData` contains only `parkName`, `money`, and `date` at [src/state/saveManager.ts:27](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/saveManager.ts), while `page.tsx` loads a save and calls `initGame(savedState.parkName...)`, discarding saved money/date and every entity/grid change at [src/app/game/page.tsx:89](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: create a serializable full `GameStoreState` save schema, version it, validate it on load, and add a `hydrateGame(savedState)` action instead of calling `initGame()`.

- **Public `/api/impressions` accepts unbounded unauthenticated analytics input.**  
  Evidence: `POST` calls `await request.json()` without auth, body-size protection, schema validation, or rate limiting at [src/app/api/impressions/route.ts:16](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts), then maps arbitrary `events` at [src/app/api/impressions/route.ts:29](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts).  
  Fix: enforce request size limits, require a session token or signed client key, validate with `zod`, cap batch length, reject unknown enum values, add IP/session rate limiting, and return `400` for malformed JSON instead of generic `500`.

## 3. High Findings

- **Game date displayed in UI never advances.**  
  Evidence: `GameLoop` owns a private `date` at [src/engine/core/GameLoop.ts:31](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/core/GameLoop.ts), emits day/month events at [src/engine/core/GameLoop.ts:107](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/core/GameLoop.ts), but Zustand `advanceTick()` only increments `currentTick` at [src/state/gameStore.ts:866](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts), while `TopBar` reads `date` from the store at [src/ui/TopBar.tsx:15](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/TopBar.tsx).  
  Fix: add `setDate(date)` to the store and call it on day/month/year events, or move authoritative date state fully into Zustand.

- **Monthly finance reports are never generated.**  
  Evidence: `FinanceWindow` reads `monthlyReports` at [src/ui/FinanceWindow.tsx:105](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/FinanceWindow.tsx), but the live month handler only ages rides and adds a notification at [src/app/game/page.tsx:166](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: instantiate `EconomyManager`, call `processMonth()` on month, then `store.addMonthlyReport(report)` and apply expenses.

- **Ride operation is split between incompatible systems.**  
  Evidence: store `placeRide()` creates rides directly at [src/state/gameStore.ts:473](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts), while `RideManager.placeRide()` has a separate implementation at [src/engine/simulation/RideManager.ts:36](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/RideManager.ts). The store sets rides to `closed` at [src/state/gameStore.ts:537](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts), but no live `processRideTick()` runs.  
  Fix: choose one ride placement/operation implementation. Prefer making store actions thin wrappers around `RideManager`, then tick all open rides each game tick.

- **Ride entrance/exit placement is wrong for rotations and can be non-path.**  
  Evidence: store `placeRide()` always sets entrance to `{ x + floor(w / 2), y + h }` and exit equal to entrance at [src/state/gameStore.ts:520](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts). `RideManager` has rotation-aware entrance/exit methods at [src/engine/simulation/RideManager.ts:230](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/RideManager.ts), but they are unused.  
  Fix: reuse `RideManager.calculateEntranceTile()` logic or port it into store placement, and verify the computed entrance/exit tiles are valid path tiles.

- **Staff UI is a non-functional button.**  
  Evidence: toolbar defines a Staff button with `tool: null` and no modal handler at [src/ui/Toolbar.tsx:25](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/Toolbar.tsx); `handleClick()` only handles modal/submenu/tool cases at [src/ui/Toolbar.tsx:60](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/Toolbar.tsx).  
  Fix: add a staff panel/modal, route Staff button clicks to it, expose hire/fire actions, and tick `StaffManager`.

## 4. Medium Findings

- **Weather effects are calculated but not applied to spawning, rides, or park closure.**  
  Evidence: `WeatherManager.getWeatherEffects()` exists at [src/engine/simulation/WeatherManager.ts:149](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/WeatherManager.ts), but page day handling only stores weather/season at [src/app/game/page.tsx:151](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: feed weather modifiers into guest spawn rate, ride excitement, and park-open rules.

- **EventBus notifications are emitted but not bridged into UI notifications.**  
  Evidence: `EventBus` supports `'notification'` at [src/engine/core/EventBus.ts:20](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/core/EventBus.ts), and `RideManager` emits notifications at [src/engine/simulation/RideManager.ts:120](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/RideManager.ts), but `page.tsx` subscribes only to `tick`, `day`, and `month` at [src/app/game/page.tsx:181](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx).  
  Fix: subscribe to `'notification'` and call `store.addNotification()`.

- **Finance loan interest display disagrees with finance engine.**  
  Evidence: `FinanceWindow` displays monthly interest as `loanAmount * loanInterestRate` at [src/ui/FinanceWindow.tsx:320](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/FinanceWindow.tsx), while `EconomyManager` computes `loanAmount * (loanInterestRate / 12)` at [src/engine/simulation/EconomyManager.ts:138](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/simulation/EconomyManager.ts).  
  Fix: decide whether `loanInterestRate` is annual or monthly and use the same formula everywhere.

- **Decorations are not stored as entities, so demolition cannot restore scenery accurately.**  
  Evidence: `placeDecoration()` increases nearby `sceneryScore` but stores no decoration record at [src/state/gameStore.ts:618](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts); demolition comments admit no definition is stored and refunds a flat amount at [src/state/gameStore.ts:678](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/state/gameStore.ts).  
  Fix: add a `decorations` record with `definitionId`, tile, cost, and scenery radius; subtract scenery on demolition.

- **Guest rendering exists but can never show anything in the live game.**  
  Evidence: `GuestLayer.update()` renders `state.guests` at [src/renderer/GameCanvas.tsx:429](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/renderer/GameCanvas.tsx), but live state never receives spawned guests.  
  Fix: wire guest spawning/processing first; then selection and guest info become meaningful.

## 5. Low Findings

- **Default README is still the stock Next.js README.**  
  Evidence: [hk-park-tycoon/README.md:1](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/README.md) still says this is a generated Next.js project and tells users to edit `app/page.tsx`.  
  Fix: replace it with project-specific setup, architecture, and known limitations.

- **Sponsorship types are embedded in core game types but no real sponsor integration exists.**  
  Evidence: `SponsorConfig`, `ImpressionEvent`, and sponsor fields appear in core types at [src/engine/types/index.ts:275](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/engine/types/index.ts), while `/api/sponsors` returns an empty array at [src/app/api/sponsors/route.ts:12](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/sponsors/route.ts).  
  Fix: either remove dormant sponsorship fields until implemented or build a real sponsor config loader, validation layer, and display/tracking integration.

- **Toolbar and canvas both handle some keyboard shortcuts.**  
  Evidence: `page.tsx` handles space/escape/rotation at [src/app/game/page.tsx:235](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/game/page.tsx), `GameCanvas` handles space/escape/rotation/tool keys at [src/renderer/GameCanvas.tsx:254](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/renderer/GameCanvas.tsx), and `Toolbar` also handles shortcut keys at [src/ui/Toolbar.tsx:69](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/ui/Toolbar.tsx).  
  Fix: centralize keyboard handling in one hook and dispatch typed actions.

## 6. Security

- **`POST /api/impressions` has no authentication.**  
  Evidence: no token/session validation before accepting `request.json()` at [src/app/api/impressions/route.ts:16](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts).  
  Fix: require a signed session token or server-issued anonymous session ID; reject unauthenticated writes.

- **`POST /api/impressions` has no rate limiting or batch cap.**  
  Evidence: it accepts any `events` array and returns `received: batch.events.length` at [src/app/api/impressions/route.ts:21](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts).  
  Fix: cap batches, reject oversized payloads, rate-limit by IP/session/sponsor, and add abuse logging.

- **`POST /api/impressions` has weak input validation.**  
  Evidence: it only checks that `events` is an array at [src/app/api/impressions/route.ts:19](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts), then trusts `surfaceType` values at [src/app/api/impressions/route.ts:29](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts).  
  Fix: validate every field: enum values, string lengths, timestamps, IDs, duration bounds, and session consistency.

- **`POST /api/impressions` returns `500` for malformed JSON.**  
  Evidence: the catch block returns “Failed to process impressions” with status `500` at [src/app/api/impressions/route.ts:39](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/impressions/route.ts).  
  Fix: distinguish parse/validation errors as `400`; reserve `500` for server faults.

- **`GET /api/sponsors` is harmless now but unsafe as a future config endpoint.**  
  Evidence: it is public and says future configs will come from a database or JSON file at [src/app/api/sponsors/route.ts:11](https://github.com/larrythelobsterbot/HKThemePark/blob/master/hk-park-tycoon/src/app/api/sponsors/route.ts).  
  Fix: keep public read access only for sanitized active sponsor display configs; put sponsor admin/config mutation behind separate authenticated routes.

## 7. Top 5 Things To Fix First

1. **Wire the simulation managers into `src/app/game/page.tsx`.** Guests, rides, staff, and economy must be instantiated and ticked from the live loop.

2. **Implement real guest spawning and guest processing.** Without this, the “tycoon” loop never starts.

3. **Implement a single authoritative money/economy flow.** Ride/shop purchases, expenses, monthly reports, and cash balance need one consistent transaction path.

4. **Fix save/load hydration.** Current saves discard the built park; this is a data-loss bug.

5. **Secure `/api/impressions`.** Add auth/session validation, schema validation, batch limits, rate limiting, and correct error handling before storing analytics anywhere.
