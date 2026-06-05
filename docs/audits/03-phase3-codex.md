## VERDICT

Not ready as-is. The ad layer is mostly isolated, but `/api/impressions` is now a public disk-writing endpoint with weak abuse controls. The JSONL serialization itself is not newline-injection vulnerable because `JSON.stringify` escapes control characters, but disk growth, rate-limit bypass, and rate bucket retention are real issues.

## CRITICAL

None found in the provided code.

## HIGH

- `src/app/api/impressions/route.ts:19, 29, 150, 168` — Public endpoint can drive large sustained disk growth.
  
  A single accepted request can append up to 500 events, and the rate limit allows 60 requests/min/IP. With `MAX_BODY_BYTES = 256KB`, one spoofable/effective IP can push roughly 15MB/minute, and distributed clients can grow `hk-impressions.jsonl` indefinitely. There is no max log size, rotation, retention, filesystem quota handling, or backpressure.

  Concrete fix: write to a managed store with retention, or implement hard local controls: lower batch/request limits, cap bytes per IP per window, rotate logs by size/date, refuse writes when the log directory is near quota, and expose persistence failure telemetry instead of silently swallowing all write errors.

- `src/app/api/impressions/route.ts:42-45, 101-107` — Rate limiting trusts spoofable forwarding headers.

  `clientIp()` uses `x-forwarded-for` directly. If the app is reachable without a trusted proxy normalizing this header, clients can rotate arbitrary IP strings and bypass the limiter entirely. Even behind a proxy, this should only trust the proxy-provided client IP if the deployment guarantees header sanitization.

  Concrete fix: derive IP from the platform’s trusted request metadata/proxy config, or only trust `x-forwarded-for` when the immediate sender is a trusted proxy. Otherwise key on a server-derived remote address, plus add session/user-agent or token-based throttles.

## MEDIUM

- `src/app/api/impressions/route.ts:30-40` — `rateBuckets` grows without eviction.

  Every distinct IP string creates a `Map` entry and expired entries are only replaced when the same IP appears again. Attackers can send many unique spoofed `x-forwarded-for` values and grow process memory over time.

  Concrete fix: periodically sweep expired buckets, cap total bucket count, and normalize/validate IP strings before using them as keys. For production, move this to Redis/platform rate limiting.

- `src/app/api/impressions/route.ts:157-166` — Payload session ID validation is mostly bypassed by event-level session IDs.

  The route validates `batch.sessionId`, but `isValidEvent()` also accepts each event’s own `sessionId`, then persistence overwrites it with `batch.sessionId`. This is not a direct security bug, but it makes validation misleading and permits inconsistent event payloads.

  Concrete fix: remove `sessionId` from client-supplied events and validate only the top-level batch session, or require each event session to equal `batch.sessionId`.

- `src/app/api/sponsors/route.ts:18-31` — Route trusts the entire imported JSON shape and returns every field.

  The comment says only display-safe fields are returned, but the code returns whole `SponsorConfig` objects, including `clickUrl` and `impressionTrackingId` at `src/data/sponsors.json:10-11`. Today’s demo data is harmless, but the route will leak any future admin/billing/internal fields accidentally added to this config.

  Concrete fix: validate and project an explicit public response shape: `sponsorId`, `surfaceId`, `brandName`, `displayName`, `logoUrl`, `colorScheme`, `description`, `tier`, `startDate`, `endDate` only if those are all intended public fields.

- `src/sponsors/SponsorManager.ts:36-44` — `loadSponsors()` accumulates stale configs and duplicate surfaces are silent last-write-wins.

  The method never clears `configs` before loading. If sponsors change, expired/removed surfaces remain in memory; `getSponsor()` date-filters but removed same-window sponsors can persist until reload with replacement. Multiple active campaigns for the same `surfaceId` silently overwrite based on API array order.

  Concrete fix: build a fresh `Map`, detect duplicate `surfaceId`s, and either reject/log duplicates or choose deterministically by priority/start date. Then atomically replace `this.configs`.

- `src/sponsors/SponsorManager.ts:19-23` and `src/app/api/sponsors/route.ts:20-28` — Active-window filtering uses server/client wall-clock twice.

  The API already filters active campaigns, then the client filters again using the browser clock. A user with a wrong local clock can hide valid sponsors or show inconsistent behavior around boundaries. This also makes cached `/api/sponsors` responses interact badly with client-side time.

  Concrete fix: trust the server-filtered result for display, or include a server timestamp in the API response and evaluate activity against that consistently.

- `src/ui/InfoPanel.tsx:404-422` — The click impression effect can record against stale ride/shop data.

  The effect depends only on `selectedEntityId` while reading `rides` and `shops`. If selection changes before the selected entity has appeared in the store, or if the selected ID is reused/rehydrated with a different definition, the effect can miss the impression or record the old surface. The disabled exhaustive-deps comment hides that risk.

  Concrete fix: derive `selectedRide`/`selectedShop` before the effect and include the selected entity’s stable `definitionId`/type in the dependency list. Track once per selected entity transition using a ref if needed.

## LOW

- `src/sponsors/ImpressionTracker.ts:87-90` — Timer starts even when constructed outside the browser.

  `SponsorManager` is imported by client modules here, but the singleton has no hard client guard. If this module is ever imported server-side, `setInterval` starts in the server process.

  Concrete fix: only start auto-flush and unload handling when `typeof window !== 'undefined'`, or make `SponsorManager` client-only by construction.

- `src/app/game/page.tsx:471-472` and `src/sponsors/SponsorManager.ts:126-130` — Tracker lifecycle is inconsistent.

  Game unmount flushes the singleton tracker but does not destroy it. `destroy()` exists but is never used here, so the interval and unload listener remain alive for the page lifetime after navigation. Because the manager is a singleton, remounting reuses the same tracker rather than creating duplicate timers, but it still keeps background flushing active after leaving the game.

  Concrete fix: either intentionally keep a global tracker and document it, or call `SponsorManager.destroy()` on final game teardown and make the manager recreate its tracker on the next load.

- `src/sponsors/ImpressionTracker.ts:96-103` — `sendBeacon` omits the JSON content type.

  The route reads raw text and `JSON.parse`s it, so this works, but observability/middleware that expects `application/json` may not classify it correctly.

  Concrete fix: send a `Blob` with `type: 'application/json'`.

- `src/app/api/impressions/route.ts:123` — Body size check uses string length, not byte length.

  `raw.length` counts UTF-16 code units, while `MAX_BODY_BYTES` is a byte limit. The header check helps when present, but chunked requests without `content-length` can exceed the intended byte cap with multi-byte characters.

  Concrete fix: use `new TextEncoder().encode(raw).byteLength` or read the stream with an actual byte counter.

- `src/ui/InfoPanel.tsx:12-23, 123, 259` — Sponsor color is used directly in inline CSS.

  Since sponsor data is local JSON today, this is low risk. If sponsor data later becomes admin-editable, invalid CSS values can break styling or enable CSS injection-like UI manipulation.

  Concrete fix: validate `colorScheme` server-side as a strict hex color before serving or using it.

- `src/ui/InfoPanel.tsx:110, 247` — Defaults are not passed into `getDisplayConfig`.

  Unsponsored rendering uses `ride.name`/`shop.name`, so the visible name is fine. But icon/color/description defaults from the entity are unavailable in these calls, relying entirely on `allDefaults` if future UI uses them.

  Concrete fix: pass the sponsorable entity/default definition into `getDisplayConfig`, or keep display concerns explicitly split between sponsored and unsponsored branches.
