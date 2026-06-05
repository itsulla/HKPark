**VERDICT**

Integrated core is not safe for save/load continuity. Live tick cash banking is mostly coherent, but manager/game-loop state is split from persisted store state, so loading mid-simulation can corrupt time, reports, VIP spawning, and in-flight ride revenue. The partial ride merge mostly protects `status`, but it also makes day-breakdown queue cleanup depend on event ordering and leaves stale manager state as the biggest cross-phase risk.

**CRITICAL**

- `src/engine/core/GameLoop.ts:29`, `src/app/game/page.tsx:188`, `src/state/gameStore.ts:486`
  Loaded saves restore `state.date` and `state.currentTick`, but `GameLoop` always starts at tick `0`, date `{day:1, month:1, year:1}`. The next day/month event overwrites the loaded store date via `store.setDate(date)` at `page.tsx:433`, and tick-driven VIP/rating/spawn schedules use the loop tick, not the restored store tick.
  Concrete fix: add `GameLoop.hydrate({ currentTick, date })` or constructor params and initialize it from `useGameStore.getState()` before `start()`.

- `src/engine/simulation/GuestManager.ts:168`, `src/engine/simulation/GuestManager.ts:621`, `src/state/saveManager.ts:126`
  Guest ride/shop timers are not persisted, but guests and ride queues are. After load, a guest saved in `RIDING` gets a default timer with `rideStartTick = 0` and `rideDuration = 0`; `processRiding` immediately completes the ride, charges cash again, increments `ride.totalRevenue`, and `applySimulationResult` banks that diff. This can double-count ride revenue and inflate customers after every load.
  Concrete fix: persist timer state, or make timers serializable on `Guest`, or normalize loaded guests by ejecting `RIDING`/`QUEUING` guests from rides without charging and clearing `ridersOnBoard/currentQueue` consistently.

**HIGH**

- `src/app/game/page.tsx:461`, `src/engine/simulation/EconomyManager.ts:42`, `src/state/saveManager.ts:126`
  Monthly revenue reports depend on `EconomyManager.transactions`, but transactions are in-memory only. A save/load mid-month preserves banked cash and ride/shop cumulative revenue, yet loses month-to-date transaction history, so the next monthly report underreports revenue and can show a false loss while cash only pays expenses.
  Concrete fix: persist current-month transactions or store month-start cumulative ride/shop totals and derive monthly revenue from persisted entity totals.

- `src/app/game/page.tsx:442`, `src/state/gameStore.ts:866`, `src/state/gameStore.ts:1028`
  Breakdown handling rolls on a clone, emits `ride-broke`, then calls `store.breakRide`. The store action clears queue/riders, but the next `applySimulationResult` can later merge cloned `currentQueue/ridersOnBoard/rideTimer` fields for the same ride if a breakdown is triggered outside the current shown day ordering or if this logic is reused in tick scope. The invariant “broken rides have empty queues/riders” is not enforced by the partial merge.
  Concrete fix: in `applySimulationResult`, if `cur.status === 'broken'`, force `currentQueue = []`, `ridersOnBoard = []`, `rideTimer = 0`, or include a status-aware merge policy.

- `src/state/gameStore.ts:857`, `src/engine/simulation/GuestManager.ts:631`, `src/state/gameStore.ts:1062`
  Money can become `NaN`: `setTicketPrice(rideId, NaN)` stores `NaN` because `Math.max(0, NaN)` is `NaN`; later `paid = Math.min(guest.cash, ride.ticketPrice)` becomes `NaN`, then guest cash, ride revenue, tick revenue, and `state.money` become `NaN`.
  Concrete fix: guard all money inputs with `Number.isFinite`, especially `setTicketPrice`, `addMoney`, `spendMoney`, and `applySimulationResult.revenue`.

**MEDIUM**

- `src/engine/simulation/GuestManager.ts:104`, `src/engine/simulation/GuestManager.ts:323`
  `timers` can leak for guests replaced or removed outside `processAllGuests` (`hydrateGame`, `initGame`, `removeGuest`, wholesale guest replace). The map is only cleaned when `processAllGuests` sees a leaving guest. Over long sessions with resets/loads, stale timers accumulate and can be accidentally reused only if IDs collide, but primarily it is unbounded manager drift.
  Concrete fix: expose `GuestManager.resetFromGuests(guests)` and call it after hydrate/init, or keep timers in persisted/store-owned state.

- `src/engine/simulation/VIPManager.ts:49`, `src/app/game/page.tsx:243`
  VIP spawn cadence is based on volatile loop tick. After load, `presentVipIds` prevents duplicate personas currently in the park, but the spawn interval restarts from zero, changing VIP timing and potentially spawning new VIPs much sooner/later than the saved timeline intended.
  Concrete fix: use persisted `store.currentTick` after fixing loop hydration, or persist VIP manager scheduling state.

- `src/app/game/page.tsx:406`
  VIP dialogue timestamp uses the stale `store.date` captured before `advanceTick`, `setDate`, day/month handlers, and any subsequent same-frame date mutation. On boundary ticks, dialogue/feed entries can carry the previous date.
  Concrete fix: call `useGameStore.getState().date` at dialogue insertion time, or make `addVipDialogue` stamp with current store date.

- `src/engine/simulation/WeatherManager.ts:76`, `src/state/gameStore.ts:508`
  Store weather/season are persisted, but `WeatherManager.currentWeather/currentSeason/typhoonDaysRemaining` are not hydrated. On the first loaded day, weather simulation starts from clear/spring and can overwrite persisted weather continuity, especially typhoon duration.
  Concrete fix: hydrate weather manager from store and persist `typhoonDaysRemaining`.

**LOW**

- `src/app/game/page.tsx:104` through `src/app/game/page.tsx:110`
  Manager refs are assigned but never used except cleanup nulling. This is vestigial and signals no component can actually resync/reset manager internals after store hydrate/reset.
  Concrete fix: either remove unused refs or use them deliberately for manager hydration/reset lifecycle.

- `src/engine/simulation/StaffManager.ts:28`
  `staffRegistry` is mutated by `hireStaff/fireStaff`, but store hiring does not use this manager path, and tick processing uses store staff directly. It is dead state that can diverge from the actual staff roster.
  Concrete fix: remove the registry or make staff ownership consistently store-backed.
