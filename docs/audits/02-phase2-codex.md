## VERDICT

Phase 2 is **not correct**. The litter model is mostly coherent, and `breakRide`/`repairRide` mostly avoid the bulk merge problem, but mechanic targeting has a real reachability bug that can leave rides broken indefinitely in normal play. Old saves with raw UUID ride ids also break mechanic routing.

## CRITICAL

- `src/engine/simulation/StaffManager.ts:126-132` + `src/engine/world/Pathfinder.ts:288-312` + `src/app/game/page.tsx:248-257`

  Mechanics are told that broken rides exist, but `processMechanicTick` does not target those ride ids. It calls `Pathfinder.findNearestEntity(grid, staff.tile, 'ride-', ...)`, which returns the nearest ride footprint with a `ride-` entity id, broken or not. If a non-broken ride is nearer than the broken ride, the mechanic walks to that non-broken ride forever and the repair loop at `page.tsx:259-278` never marks the broken ride repaired unless the mechanic happens to end adjacent to the broken footprint.

  Concrete fix: pass broken ride positions or ids into `StaffManager`, and target only tiles whose `entityId` is in the `brokenRides` set. Better: change the signature to accept `brokenRideEntities: Ride[]`, choose the nearest reachable adjacent path tile to any broken ride footprint/entrance, and move toward that.

- `src/state/gameStore.ts:478-509` + `src/engine/simulation/StaffManager.ts:126-132`

  Old saves with raw UUID ride ids are hydrated unchanged. Their grid `tile.entityId` values do not start with `ride-`, so mechanics using `findNearestEntity(..., 'ride-')` cannot find those rides at all. A broken ride from an old save can therefore remain broken forever even if a mechanic exists.

  Concrete fix: add save migration in `hydrateGame`: for each ride id not starting with `ride-`, create a new id or preserve a compatibility index, update `state.rides`, `ride.id`, every matching grid `entityId`, guest `currentRideId`, guest `ridesRidden`, selected ids if ever persisted, and queues/riders as needed. Simpler fix: stop relying on id prefixes for mechanics and target `state.rides[brokenId].tiles`.

## HIGH

- `src/app/game/page.tsx:314-322` + `src/state/gameStore.ts:867-873`

  `repairRide` always reopens a repaired ride. If the player intended the ride to be closed before it broke, that state is lost. Today `breakRide` only breaks open rides, so this mainly affects any future manual close/repair interaction while broken is a distinct status. There is no stored “pre-breakdown status” or “closed by player while broken” state.

  Concrete fix: represent ride availability separately, e.g. `status: 'open' | 'closed'` plus `breakdown: 'ok' | 'broken'`, or store `preBreakdownStatus` and repair back to that. Also allow the UI to mark a broken ride as player-closed if that is expected.

- `src/engine/simulation/StaffManager.ts:138-150`

  Even after finding a ride footprint, the mechanic picks `walkableNeighbors[0]` of the nearest footprint tile, not the closest reachable neighbor around the whole ride. On multi-tile rides, the nearest footprint tile may have no walkable neighbor while another footprint tile does, causing patrol fallback and no repair progress.

  Concrete fix: for the selected broken ride, scan all footprint tiles, collect all walkable adjacent path/entrance tiles, choose the closest reachable target to the mechanic, and move/path toward that.

## MEDIUM

- `src/app/game/page.tsx:324-332`

  Park rating uses the cloned `rides` object from before mechanic repairs are applied. On a tick where a mechanic repairs a ride, `store.repairRide` opens the store ride at `315-316`, but rating calculation at `326-331` still sees the cloned ride as `broken`. The committed store and rating can disagree for up to `PARK_RATING_INTERVAL`.

  Concrete fix: either apply repairs to the local `rides` clone before rating, or calculate rating from `useGameStore.getState().rides` after repair.

- `src/app/game/page.tsx:280-311` + `src/state/gameStore.ts:1056`

  Litter is computed from the pre-commit `store.litter`, then committed once. That is fine for the normal synchronous tick loop, but `hydrateGame` accepts persisted `litter` without validation. A corrupt/old save with `NaN`, negative, or non-number litter will poison the rating because `Math.max(0, NaN + ...)` returns `NaN`, and `setParkRating` also clamps with `Math.max/Math.min` in a way that preserves `NaN`.

  Concrete fix: sanitize in `hydrateGame` and before commit: `state.litter = Number.isFinite(result.litter) ? Math.max(0, result.litter) : 0`.

- `src/app/game/page.tsx:349-353` + `src/engine/simulation/RideManager.ts:172-194`

  `checkBreakdown` mutates the clone and emits `ride-broke`; then `store.breakRide` re-applies only if the real store ride is still open. If the real ride was closed between clone creation and `breakRide`, the toast/event may still have fired even though the store does not break the ride. In the current synchronous handler this is unlikely, but the API shape is brittle.

  Concrete fix: make `checkBreakdown` pure: return a boolean without mutating or emitting. Emit only after `store.breakRide` actually changed state, ideally by returning success from `breakRide`.

## LOW

- `src/app/game/page.tsx:264-272`

  `Math.round(member.tile.x/y)` is harmless with current staff movement because staff positions are effectively integer steps, but it is misleading with the comment saying staff can be fractional. If fractional movement is restored, `round` can report adjacency before the mechanic actually reaches the adjacent tile.

  Concrete fix: keep staff tile positions integral, or use exact path tile arrival checks before repairing.

- `src/state/gameStore.ts:854-865`

  `breakRide` clears queues and riders but does not update affected guests. Queuing guests recover on their next processed tick, but riders whose ids are removed from `ridersOnBoard` can remain in `GuestState.RIDING` until their ride timer completes against a broken ride.

  Concrete fix: when breaking a ride, also transition queued/riding guests for that ride back to walking, clear `currentRideId`, and place riders at the exit or entrance tile.
