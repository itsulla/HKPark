**VERDICT**

Phase 1 is not correct yet. It wires managers into the loop, but the live game is only partially playable: guests can spawn and may reach path-adjacent ride entrances, but ride boarding/ride timing, monthly finance reporting, and whole-record simulation commits have correctness bugs. Money is not obviously applied twice to the store for normal ride/shop revenue, but the monthly report’s `cashBalance` double-counts revenue, and the simulation can clobber player actions made during a tick.

**CRITICAL**

- `src/engine/simulation/GuestManager.ts:571` and `src/engine/simulation/RideManager.ts:150`: ride boarding is split between two systems with incompatible ownership. `GuestManager.processQueuing` directly removes guests from `ride.currentQueue`, pushes them to `ridersOnBoard`, and sets guest state to `RIDING`, but it never starts `ride.rideTimer`. Then `RideManager.processRideTick` sees riders onboard with `rideTimer === 0` and does not advance the cycle. Guests eventually complete rides using their private guest timers, while the ride timer/cycle model is bypassed. If `RideManager` boards queued guests itself, guest states can remain `QUEUING`, creating desync.
  Fix: make one manager own boarding/cycle completion. Prefer `RideManager` owns queue -> onboard -> cycle -> completed rider ids, and `GuestManager` only joins/leaves queues and reacts to completed rider ids. Alternatively remove `RideManager` boarding entirely and set/decrement ride timer consistently in `GuestManager`.

- `src/state/gameStore.ts:984`: `applySimulationResult` replaces entire `guests`, `rides`, `shops`, and `staff` records every tick. Any player action that lands after the snapshot at `src/app/game/page.tsx:178` and before the commit at `src/app/game/page.tsx:269` can be overwritten: open/close ride, set ticket price, place/demolish ride/shop, hire/fire staff. This is exactly the clobber pattern called out in the prompt.
  Fix: commit a functional merge against the latest store state. Preserve entities added after the snapshot, drop entities demolished after the snapshot, and only apply simulation-owned fields. For rides, merge fields like `currentQueue`, `ridersOnBoard`, `rideTimer`, `totalRevenue`, `totalCustomers`, not `status`/`ticketPrice` blindly.

**HIGH**

- `src/engine/simulation/EconomyManager.ts:155` and `src/app/game/page.tsx:306`: monthly `cashBalance` is wrong. Per-tick revenue is already added to `state.money` at `src/state/gameStore.ts:991`, but `processMonth` computes `cashBalance = money + netProfit`, where `netProfit` includes the already-banked revenue. The store only deducts expenses, so persisted money avoids double-adding revenue, but the financial report overstates cash by monthly revenue.
  Fix: when revenue is banked live, report `cashBalance = money - totalExpenses`, or pass a pre-revenue opening balance/month-start balance into `processMonth`.

- `src/app/game/page.tsx:301`: monthly ride aging uses `store.rides` snapshot, then calls `store.updateRide` once per ride. A tick commit interleaving with these updates can overwrite aged rides, and each update is a separate set.
  Fix: age rides inside a single store transaction or include monthly aging in a simulation merge that operates on the latest state.

- `src/engine/simulation/GuestManager.ts:262`: `processAllGuests` always starts from `Object.keys(guests)` and stops after 100. Guests after the first 100 are carried forward unchanged every tick, so with stable insertion order they can starve forever. Their needs, leaving checks, queue state, and revenue completion do not progress.
  Fix: keep a rotating cursor or process all guests in chunks fairly. At minimum, store `lastProcessedGuestIndex` in `GuestManager`.

- `src/engine/simulation/GuestManager.ts:615` and `src/engine/simulation/GuestManager.ts:676`: guests can spend more cash than they have. Ride/shop revenue is credited even if `guest.cash < ticketPrice` or item price, and cash is clamped to 0 later.
  Fix: check affordability before boarding/purchase. If insufficient cash, leave queue/shop and do not increment revenue.

**MEDIUM**

- `src/app/game/page.tsx:177`: `store.advanceTick()` mutates state, but all subsequent reads use the pre-advance `store` object from `getState()`. In Zustand this object’s methods are fine, but data fields like `store.currentTick` would be stale if used. Current code uses the event `tick`, so this is not breaking now, but the pattern is fragile.
  Fix: either advance tick inside the final commit or reacquire `useGameStore.getState()` after `advanceTick()` before reading mutable state.

- `src/app/game/page.tsx:280`: park rating uses post-simulation cloned entities but stale `store.districts`. If a district unlock happens during the tick window, the rating calculation can use old district data and then write `parkRating` in a separate set.
  Fix: calculate rating inside the same final store update using latest state, or reacquire latest districts after the simulation commit.

- `src/app/game/page.tsx:184`: `structuredClone` of all guests/rides/shops/staff every tick is expensive. Data appears serializable from the provided types in practice, so cloneability is probably okay, but cloning every entity at 25-100ms cadence will become a major cost as guest counts grow.
  Fix: clone only simulation-owned slices, or mutate a draft in a single Zustand/Immer transaction, or keep simulation state outside React store and publish snapshots.

- `src/engine/simulation/StaffManager.ts:126`: mechanics search for entity ids starting with `'ride-'`, but store-created rides use raw `uuidv4()` at `src/state/gameStore.ts:600`, not `ride-${uuid}`. Mechanics will not find broken rides placed through the actual store.
  Fix: either prefix store ride ids consistently or search by the concrete `brokenRides` ids/ride footprint tiles.

- `src/app/game/page.tsx:246`: broken rides are only detected, never produced in the live loop. `RideManager.checkBreakdown` is not called on day/month ticks, and mechanics never call `repairRide`.
  Fix: call breakdown checks on day events and add mechanic repair behavior when reaching a broken ride.

**LOW**

- `src/engine/world/Grid.ts:186`: `Grid.isAdjacentToPath` only accepts `PATH`, while store placement allows `PATH` or `ENTRANCE` via `isAdjacentToPath` at `src/state/gameStore.ts:255`. Store placement is the live path, so guests can reach `entranceTile` when it is a path/entrance tile, but the duplicate `RideManager.placeRide` behavior is inconsistent.
  Fix: align both helpers to accept `PATH | ENTRANCE`.

- `src/state/gameStore.ts:848`: hiring staff does not charge upfront or validate affordable wages. Monthly wages are charged later, but hiring is otherwise free.
  Fix: add hire cost or salary affordability policy if intended.

- `src/state/gameStore.ts:877` and `src/engine/simulation/EconomyManager.ts:151`: land purchases are included in monthly reports only if a `land-purchase` transaction exists, but `unlockDistrict` does not record one. If added later, avoid also deducting it again through monthly `totalExpenses`.
  Fix: either report already-paid capital expenses without monthly settlement, or settle them only once.

- `src/state/saveManager.ts:126`: save serializes the whole Zustand state object passed from `useGameStore.getState()`. Functions are dropped by JSON, which is intended, but transient fields not excluded by `saveGame` can still enter the JSON if present on state.
  Fix: persist an explicit data-only object using the same whitelist as `hydrateGame`.

- `src/engine/simulation/WeatherManager.ts:159`: weather spawn gating is applied, but `outdoorRideExcitementMod` is unused, and typhoon closure only stops new spawns; existing guests continue normally.
  Fix: apply weather effects to ride selection/ratings and decide whether severe weather should force guests to leave or pause operations.
