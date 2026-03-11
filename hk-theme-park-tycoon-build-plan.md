# HK Theme Park Tycoon: Complete Build Plan & Claude Code Prompts

## Project Overview

A browser-based theme park management game set in an expanding Hong Kong-inspired world. Players build rides, manage finances, and grow from a tiny carnival into a mega-park. The game uses a simplified version of the RollerCoaster Tycoon simulation model, adapted for browser performance.

**Stack:** Next.js 14 + TypeScript + PixiJS 8 (2D rendering) + Zustand (state) + Howler.js (audio)

---

## Key References & What to Borrow

### OpenRCT2 (github.com/OpenRCT2/OpenRCT2)
This is the goldmine. It's a C++ re-implementation of RCT2, but the simulation logic translates directly to TypeScript. Key systems to study and adapt:

**Guest AI (src/openrct2/peep/):**
- Guests ("peeps") have a state machine: ENTERING, WALKING, QUEUING, RIDING, SHOPPING, EATING, SITTING, LEAVING
- Pathfinding uses a scored edge-walking algorithm with junction limits (15,000 junction checks for guests). For our browser game, we simplify this to cached A* with a lower limit
- Each guest has: happiness (0-255), hunger, thirst, nausea, energy, ride intensity tolerance, cash budget
- Guest decision-making: needs-based priority system. Hungry guests seek food, tired guests seek benches, thrill-seekers pick intense rides, families pick gentle rides
- "Happiness target" concept: guests have a target happiness that actual happiness gravitates toward based on experiences

**Ride Ratings (wiki: Ride-rating-calculation):**
- Three ratings: Excitement, Intensity, Nausea (each 0-10+ scale)
- In RCT2 these are calculated from G-forces, drops, inversions, speed, track length, scenery proximity, and ride proximity. For our simplified game with pre-built rides (no track editor), we use static base ratings modified by:
  - Scenery within 5 tiles of station (adds up to ~0.4 excitement per nearby decoration)
  - Proximity to other rides (adds excitement)
  - Age of ride (novelty decay: new rides get a bonus that fades over months)
  - Maintenance level (poorly maintained rides lose excitement, gain intensity/nausea)

**Finance (src/openrct2/park/):**
- Ride pricing formula: guests compare ticket price against a "ride value" derived from excitement/intensity ratings weighted by ride type multipliers
- Revenue = ticket sales + shop sales. Expenses = staff wages + maintenance + loan interest + land
- Monthly financial reports with category breakdowns

**Ride Value Formula (adapted from OpenRCT2):**
```
rideValue = ((excitement * excitementMultiplier * 32) >> 15)
          + ((intensity * intensityMultiplier * 32) >> 15)
          + ((nausea * nauseaMultiplier * 32) >> 15)
```
Each ride type has different multipliers. Thrill rides weight intensity higher, gentle rides weight excitement higher.

### micropolisJS (github.com/graememcc/micropolisJS)
Browser-based SimCity clone. Borrow patterns for:
- Tile-based map rendering with HTML5 Canvas
- Budget/taxation simulation loop
- Zone-based building mechanics
- Game speed controls and time progression

### MicropolisCore (github.com/SimHacker/MicropolisCore)
Newer C++/Emscripten/TypeScript/SvelteKit rewrite. Shows how to structure a simulation engine that's UI-independent, which is exactly the pattern we want (engine/ separate from renderer/).

---

## Architecture

```
hk-park-tycoon/
  src/
    app/                        # Next.js app router
      page.tsx                  # Landing page
      game/page.tsx             # Game client
    engine/                     # Pure game logic (zero rendering deps)
      core/
        GameLoop.ts             # requestAnimationFrame loop, tick management
        EventBus.ts             # Pub/sub for game events
      simulation/
        EconomyManager.ts       # Revenue, expenses, loans, reports
        GuestManager.ts         # Spawning, AI state machine, needs
        RideManager.ts          # Ride operations, queues, breakdowns
        StaffManager.ts         # Janitors, mechanics, security
        WeatherManager.ts       # Typhoons, seasons, random events
        ParkRating.ts           # Overall park rating calculation
      world/
        Grid.ts                 # 2D tile array, placement validation
        Pathfinder.ts           # A* with caching
        District.ts             # HK zone definitions and unlocking
      types/
        index.ts                # All interfaces and enums
    renderer/                   # PixiJS rendering
      GameCanvas.tsx            # Main PIXI.Application wrapper
      layers/
        TerrainLayer.ts         # Ground tiles
        BuildingLayer.ts        # Rides, shops, decorations
        GuestLayer.ts           # Guest sprites (pooled)
        UILayer.ts              # Selection highlights, placement ghosts
      Camera.ts                 # Pan, zoom, smooth interpolation
      IsometricUtils.ts         # Coordinate transforms
    ui/                         # React overlay components
      Toolbar.tsx               # Bottom build tools
      TopBar.tsx                # Money, date, speed, guests
      InfoPanel.tsx             # Selected entity details
      FinanceWindow.tsx         # Monthly reports
      DistrictPanel.tsx         # Map overview, unlock zones
    state/
      gameStore.ts              # Zustand store
      actions.ts                # Store action creators
      saveManager.ts            # IndexedDB save/load
    data/
      rides.json                # Ride definitions with base ratings
      shops.json                # Shop definitions
      districts.json            # HK district configs
      events.json               # Random events
      staff.json                # Staff type definitions
    assets/                     # Sprites, sounds (placeholder initially)
```

---

## Phased Claude Code Prompts

Each prompt is designed to be self-contained enough for a single Claude Code session. They build on each other sequentially.

---

### PROMPT 1: Project Setup & Core Types

```
I'm building a browser-based theme park tycoon game called "HK Theme Park Tycoon" set in Hong Kong. Initialize the project:

1. Create a Next.js 14 project with TypeScript strict mode, App Router
2. Install: pixi.js @pixi/react zustand immer uuid howler
3. Install dev: @types/uuid

Create the full type system in src/engine/types/index.ts. This is the foundation everything builds on. Include:

ENUMS:
- TileType: EMPTY, PATH, RIDE_FOOTPRINT, SHOP_FOOTPRINT, DECORATION, WATER, TERRAIN_HILL, ENTRANCE
- GuestState: ENTERING, WALKING, QUEUING, RIDING, SHOPPING, EATING, SITTING, LEAVING, LOST
- RideCategory: THRILL, FAMILY, GENTLE, WATER, TRANSPORT
- ShopCategory: FOOD, DRINK, SOUVENIR, FACILITY
- StaffType: JANITOR, MECHANIC, SECURITY, ENTERTAINER
- Weather: CLEAR, CLOUDY, RAIN, TYPHOON_WARNING, TYPHOON
- GameSpeed: PAUSED = 0, NORMAL = 1, FAST = 2, ULTRA = 3
- Season: SPRING, SUMMER, AUTUMN, WINTER
- ToolType: SELECT, BUILD_PATH, PLACE_RIDE, PLACE_SHOP, PLACE_DECORATION, DEMOLISH, TERRAFORM

INTERFACES:
- Tile { x, y, type, elevation (0-3), buildable, entityId: string|null, sceneryScore: number }
- GameDate { day (1-30), month (1-12), year: number }
- Ride { id, definitionId, name, tiles: {x,y}[], entranceTile: {x,y}, exitTile: {x,y}, rotation: 0|1|2|3, excitement: number, intensity: number, nausea: number, maxQueue: number, currentQueue: string[], ridersOnBoard: string[], status: 'building'|'open'|'closed'|'broken', monthlyMaintenanceCost: number, monthsOld: number, totalCustomers: number, totalRevenue: number, ticketPrice: number, lastBreakdown: GameDate|null }
- RideDefinition { id, name, category: RideCategory, baseCost: number, monthlyMaintenance: number, capacity: number, rideDurationTicks: number, baseExcitement: number, baseIntensity: number, baseNausea: number, footprint: {w: number, h: number}, minAge: number, maxAge: number, suggestedPrice: number, breakdownChance: number (0-1 per month) }
- Shop { id, definitionId, name, tile: {x,y}, revenue: number, monthlyMaintenance: number, stock: number, maxStock: number }
- ShopDefinition { id, name, category: ShopCategory, cost: number, monthlyMaintenance: number, revenuePerCustomer: number, restockCost: number, maxStock: number }
- Guest { id, name, x: number, y: number, state: GuestState, happiness: number (0-255), happinessTarget: number, hunger: number (0-255), thirst: number (0-255), nausea: number (0-255), energy: number (0-255), intensityTolerance: number (1-10), nauseaTolerance: number (1-10), cash: number, currentPath: {x,y}[], targetTile: {x,y}|null, currentRideId: string|null, ridesRidden: string[], thoughtBubble: string|null, timeInPark: number }
- Staff { id, name, type: StaffType, tile: {x,y}, patrolArea: {x,y}[]|null, salary: number }
- District { id, name, description, unlockCost: number, tiles: {x: number, y: number, w: number, h: number}, unlocked: boolean, terrain: 'flat'|'hilly'|'coastal', guestMultiplier: number }
- FinancialReport { month, year, rideRevenue, shopRevenue, entranceFeeRevenue, totalRevenue, staffWages, rideMaintenance, loanInterest, landPurchases, totalExpenses, netProfit, cashBalance }
- GameState { grid: Tile[][], money: number, date: GameDate, speed: GameSpeed, guests: Map<string, Guest>, rides: Map<string, Ride>, shops: Map<string, Shop>, staff: Map<string, Staff>, districts: District[], parkRating: number (0-1000), parkName: string, selectedTool: ToolType, loanAmount: number, loanInterestRate: number, monthlyReports: FinancialReport[], totalGuestsAllTime: number, maxGuestsAtOnce: number }

Create the directory structure as shown in the architecture above (empty files with TODO comments are fine for directories we haven't built yet).

Create src/data/rides.json with 12 HK-themed ride definitions:
1. Dragon Coaster (thrill) - cost 45000, excitement 7.2, intensity 6.8, nausea 4.5, 3x5 footprint
2. Junk Boat Cruise (gentle) - cost 18000, excitement 4.5, intensity 2.1, nausea 1.8, 4x4 footprint
3. Peak Tram Drop Tower (thrill) - cost 38000, excitement 8.1, intensity 7.5, nausea 5.2, 2x2 footprint
4. Dim Sum Spinner (family) - cost 12000, excitement 4.8, intensity 3.5, nausea 4.0, 2x2 footprint
5. Neon Night Flyer (thrill) - cost 52000, excitement 8.5, intensity 8.0, nausea 6.1, 3x3 footprint
6. Temple Garden Train (transport) - cost 8000, excitement 3.2, intensity 1.5, nausea 0.8, 2x8 footprint
7. Harbour Ferris Wheel (family) - cost 22000, excitement 5.5, intensity 2.8, nausea 2.0, 3x3 footprint
8. Typhoon Twister (thrill) - cost 35000, excitement 7.8, intensity 7.2, nausea 6.5, 2x2 footprint
9. Bamboo Scaffold Climb (family) - cost 15000, excitement 5.0, intensity 4.2, nausea 1.5, 2x3 footprint
10. Lion Dance Carousel (gentle) - cost 9000, excitement 3.8, intensity 1.8, nausea 2.5, 2x2 footprint
11. Star Ferry Splash (water) - cost 28000, excitement 6.2, intensity 5.0, nausea 3.8, 3x5 footprint
12. Kowloon Walled City Maze (family) - cost 20000, excitement 5.8, intensity 3.0, nausea 1.0, 4x4 footprint

Create src/data/shops.json with 8 shops:
1. Dai Pai Dong (food) - cost 5000, revenue 15/customer
2. Egg Waffle Stand (food) - cost 3000, revenue 8/customer
3. Milk Tea Shop (drink) - cost 4000, revenue 10/customer
4. Souvenir Pagoda (souvenir) - cost 6000, revenue 25/customer
5. Bubble Tea Bar (drink) - cost 3500, revenue 12/customer
6. Noodle House (food) - cost 7000, revenue 18/customer
7. Ice Cream Junk (food) - cost 4500, revenue 10/customer
8. First Aid Station (facility) - cost 8000, revenue 0/customer

Create src/data/districts.json with 6 HK districts:
1. "Mong Kok Market" - starter (free, unlocked), 20x20, flat, 1.0x guests. "A bustling street market area. Cheap land, high foot traffic."
2. "Tsim Sha Tsui Waterfront" - 80000, 20x20, coastal, 1.3x. "Premium tourist district along Victoria Harbour."
3. "Lantau Highlands" - 40000, 25x25, hilly, 0.7x. "Remote and spacious. Cheap to unlock but needs transport links."
4. "Central Business District" - 120000, 15x15, flat, 1.5x. "The most expensive land in Hong Kong. Corporate events boost revenue."
5. "Aberdeen Fishing Village" - 60000, 20x15, coastal, 1.0x. "Traditional fishing village. Water rides get a bonus here."
6. "Kowloon Peak" - 100000, 20x20, hilly, 1.2x. "Elevation changes create natural thrill ride opportunities."

No rendering code yet, just the data foundation and types. Make sure everything compiles with zero TypeScript errors.
```

---

### PROMPT 2: Grid System & Pathfinding

```
Continuing HK Theme Park Tycoon. The type system and data files are in place.

Build the world/grid system:

1. src/engine/world/Grid.ts - Grid class:
   - Constructor takes width, height. Creates 2D Tile array initialized to EMPTY
   - getTile(x, y): Tile | null (bounds checked)
   - setTileType(x, y, type): void
   - isInBounds(x, y): boolean
   - isAreaFree(startX, startY, width, height): boolean - checks all tiles in rect are EMPTY and buildable
   - placeEntity(startX, startY, width, height, entityId, tileType): boolean - marks tiles as occupied
   - removeEntity(entityId): {x,y}[] - finds and clears all tiles with this entityId, returns freed tiles
   - getAdjacentTiles(x, y): Tile[] - returns up to 4 cardinal neighbors
   - isAdjacentToPath(x, y): boolean
   - isConnectedToEntrance(x, y): boolean - BFS from tile to any ENTRANCE tile via PATH tiles
   - getSceneryScore(x, y, radius: number): number - count DECORATION tiles within radius
   - markDistrict(district: District): void - sets buildable=true for tiles in district bounds

2. src/engine/world/Pathfinder.ts - A* pathfinding:
   - findPath(grid: Grid, start: {x,y}, end: {x,y}, maxIterations?: number): {x,y}[] | null
   - Only traverses tiles where type === PATH or type === ENTRANCE
   - Uses Manhattan distance heuristic
   - maxIterations defaults to 2000 (performance cap for browser)
   - Path cache: Map<string, {x,y}[]> keyed by "startX,startY-endX,endY"
   - invalidateCache(): void - called when paths are built/demolished
   - invalidateNear(x, y, radius: number): void - partial cache invalidation
   - findNearestOfType(grid: Grid, from: {x,y}, tileType: TileType, maxDistance: number): {x,y} | null
   - findNearestEntity(grid: Grid, from: {x,y}, entityType: 'ride'|'shop', maxDistance: number): {x,y} | null

3. src/engine/world/District.ts - DistrictManager:
   - constructor(grid: Grid, districts: District[])
   - unlockDistrict(districtId: string, money: number): boolean - checks cost, marks grid tiles as buildable
   - getDistrictAt(x, y): District | null
   - getUnlockedDistricts(): District[]
   - isInUnlockedArea(x, y): boolean

Write unit tests in src/engine/world/__tests__/ for:
   - Grid: placement, bounds checking, adjacency, connectivity
   - Pathfinder: basic pathing, no-path scenarios, cache invalidation
   - Run with: npx jest (set up jest config if not present)

The Grid starts with District 1 (Mong Kok) unlocked. Place the park entrance at the south-center edge of District 1's area. All other district tiles start as non-buildable.
```

---

### PROMPT 3: Economy & Time Engine

```
Continuing HK Theme Park Tycoon. Grid and pathfinding are built.

Build the economy and time simulation:

1. src/engine/core/GameLoop.ts:
   - Uses requestAnimationFrame
   - Tracks deltaTime, converts to game ticks
   - Speed 0 = no ticks, Speed 1 = 1 tick per 100ms, Speed 2 = 1 tick per 50ms, Speed 3 = 1 tick per 25ms
   - 30 ticks = 1 game day. 30 days = 1 month. 12 months = 1 year
   - Emits via EventBus: 'tick', 'day', 'week', 'month', 'year'
   - Methods: start(), stop(), setSpeed(speed), getDate(): GameDate

2. src/engine/core/EventBus.ts:
   - Simple pub/sub: on(event, callback), off(event, callback), emit(event, data)
   - Events: 'tick', 'day', 'week', 'month', 'year', 'guest-entered', 'guest-left', 'ride-broke', 'money-changed', 'rating-changed'

3. src/engine/simulation/EconomyManager.ts:

   Based on OpenRCT2's finance system, simplified:

   - Properties: money, loanAmount, loanInterestRate (0.08-0.15), monthlyTransactions: {category, amount, description}[]
   
   - calculateRideValue(ride: Ride): number
     Adapted from OpenRCT2:
     For each ride, compute:
       adjustedExcitement = baseExcitement + sceneryBonus + proximityBonus - ageDecay
       adjustedIntensity = baseIntensity + (maintenanceNeglect * 0.5)
       adjustedNausea = baseNausea + (maintenanceNeglect * 0.3)
     
     rideValue = (adjustedExcitement * rideTypeExcitementWeight)
               + (adjustedIntensity * rideTypeIntensityWeight)  
               + (adjustedNausea * rideTypeNauseaWeight)
     
     Weights by category:
       THRILL: excitement=1.0, intensity=1.2, nausea=0.5
       FAMILY: excitement=1.3, intensity=0.8, nausea=0.3
       GENTLE: excitement=1.5, intensity=0.5, nausea=0.2
       WATER: excitement=1.2, intensity=1.0, nausea=0.8
       TRANSPORT: excitement=0.8, intensity=0.3, nausea=0.1
     
     Apply age penalty: rides lose 5% value per 6 months, capped at 50% loss
     Apply duplicate penalty: each same-type ride in park reduces value by 15%
     
     Return final value in dollars (this is max price guests will pay without complaining)

   - processDay(gameState): DayResult
     * Sum all ride ticket revenue (guests who completed rides today)
     * Sum all shop revenue
     * Deduct daily staff wages (monthly salary / 30)
     * Track all transactions
   
   - processMonth(gameState): FinancialReport
     * Calculate ride maintenance costs
     * Calculate loan interest: loanAmount * (interestRate / 12)
     * Generate FinancialReport object
     * Add to monthlyReports array
   
   - canAfford(amount): boolean
   - spend(amount, category, description): boolean
   - earn(amount, category, description): void
   - takeLoan(amount): boolean - max loan = 2,000,000
   - repayLoan(amount): boolean
   - getMonthlyReport(month, year): FinancialReport | null

4. src/engine/simulation/ParkRating.ts:
   
   Park rating 0-1000, calculated from:
   - Guest happiness average (0-400 points)
   - Ride variety: unique ride categories * 50 (max 250 points)
   - Park cleanliness: 150 - (litterCount * 5) (min 0)
   - Ride uptime: (openRides / totalRides) * 200
   - Park size bonus: min(districts.length * 30, 150)
   
   Guest spawn rate scales with park rating:
   - Rating 0-200: 1 guest per 5 days
   - Rating 200-500: 1 guest per 2 days
   - Rating 500-800: 1 guest per day
   - Rating 800-1000: 2 guests per day
   
   District multiplier applies on top of base rate

Include comprehensive JSDoc comments explaining the formulas and their OpenRCT2 origins.
```

---

### PROMPT 4: Guest AI System

```
Continuing HK Theme Park Tycoon. Economy and time systems are built.

Build the guest simulation. This is the most complex system, adapted from OpenRCT2's peep AI:

src/engine/simulation/GuestManager.ts:

SPAWNING:
- spawnGuest(entranceTile): Guest
  * Name: random from a list of 200 common HK/international names
  * happiness: random 180-220 (out of 255)
  * happinessTarget: random 150-200
  * hunger/thirst: random 20-60
  * nausea: 0
  * energy: random 200-255
  * intensityTolerance: weighted random 1-10 (bell curve centered at 5)
  * nauseaTolerance: weighted random 1-10 (bell curve centered at 5)  
  * cash: random 80-300

STATE MACHINE (processGuest called each tick):

ENTERING:
  - Walk from entrance tile toward the nearest path junction
  - Transition to WALKING once on main path

WALKING:
  - Every 10 ticks, evaluate needs and pick action:
    
    Priority system (check in order, pick first that applies):
    1. nausea > 170 AND energy < 80: find bench -> SITTING
    2. hunger > 180: find nearest FOOD shop -> SHOPPING  
    3. thirst > 180: find nearest DRINK shop -> SHOPPING
    4. happiness < 100 AND ridesRidden.length > 0: -> LEAVING
    5. energy < 50: find bench/decoration to sit near -> SITTING
    6. wants ride (60% chance per decision): pick ride -> QUEUING
    7. wants to shop (20% chance): pick shop -> SHOPPING
    8. wander randomly along paths -> continue WALKING
  
  - Ride selection logic (adapted from OpenRCT2):
    * Filter rides: status === 'open', queue not full
    * Filter by tolerance: ride.intensity <= guest.intensityTolerance + 2
    * Filter by nausea: ride.nausea <= guest.nauseaTolerance + 1
    * Exclude rides ridden in last 30 minutes (game time)
    * Score remaining: excitement * 2 - (distance * 0.1) - (queueLength * 0.5)
    * Pick highest scoring ride, or random from top 3
    * If no valid ride found, continue WALKING

  - Movement: follow currentPath array, moving 0.1 tiles per tick
    If no path or path blocked, recalculate
    If pathfinding fails 3 times, guest becomes LOST

QUEUING:
  - Join ride queue (add to ride.currentQueue)
  - Wait. Each tick in queue: happiness -= 0.05, energy -= 0.02
  - If wait exceeds patience (based on ride excitement): leave queue -> WALKING
  - Patience = ride.excitement * 15 ticks (so exciting rides tolerate longer waits)
  - When reaching front of queue and ride has capacity: -> RIDING

RIDING:
  - Lock guest for ride.rideDurationTicks
  - On completion:
    * happiness += ride.excitement * 8
    * nausea += ride.nausea * 6
    * energy -= ride.intensity * 3
    * cash -= ride.ticketPrice
    * Add to ridesRidden
    * Generate thought: "Dragon Coaster was great!" or "I feel sick from Typhoon Twister"
  - Transition to WALKING

SHOPPING:
  - Walk to target shop
  - "Purchase" takes 5 ticks
  - If FOOD: hunger -= 120, cash -= shop cost
  - If DRINK: thirst -= 100, cash -= shop cost
  - If SOUVENIR: happiness += 15, cash -= shop cost
  - If FACILITY (first aid): nausea -= 100
  - Transition to WALKING

SITTING:
  - Stay for 30-60 ticks
  - energy += 2 per tick, nausea -= 1 per tick
  - Transition to WALKING

LEAVING:
  - Pathfind to entrance
  - On reaching entrance: remove from game
  - Reasons to leave: happiness < 80, cash < 10, been in park > 600 ticks

LOST:
  - Wander randomly for 50 ticks
  - happiness -= 2 per tick
  - If finds a path: -> WALKING
  - If still lost after 50 ticks: teleport to nearest path tile (mercy mechanic)

PASSIVE UPDATES (every tick regardless of state):
  - hunger += 0.15 per tick
  - thirst += 0.2 per tick  
  - nausea -= 0.1 per tick (natural recovery)
  - energy -= 0.05 per tick
  - happiness gravitates toward happinessTarget at rate of 0.1 per tick
  - If guest sees litter (within 2 tiles): happinessTarget -= 5 (check once per 30 ticks)
  - If near decoration (2 tiles): happinessTarget += 2 (check once per 30 ticks)

PERFORMANCE:
  - Process max 100 guests per tick (spread across frames if more)
  - Guest pool: reuse Guest objects, don't GC them
  - Share pathfinding cache across all guests
  - Only update guests visible on screen at full detail, others get simplified updates
  - Cap total guests at 500 for browser performance

Also create a simple GuestNameGenerator.ts with 200 names mixing:
- Common Cantonese names (Wing, Mei, Siu, Ho, etc.)
- International tourist names
- Fun theme park names ("Happy Harry", "Thrillseeker Tina")

Write tests for the state machine transitions and need calculations.
```

---

### PROMPT 5: Ride Manager & Staff

```
Continuing HK Theme Park Tycoon. Guest AI is built.

1. src/engine/simulation/RideManager.ts:

   - placeRide(definitionId, x, y, rotation, grid, economy): Ride | null
     * Validate area is free on grid
     * Validate adjacent to path
     * Validate player can afford
     * Create Ride entity, mark grid tiles
     * Calculate initial ratings based on definition + scenery
     * Return created ride
   
   - openRide(rideId): void - sets status to 'open'
   - closeRide(rideId): void - ejects all guests from queue
   
   - processRideTick(ride, guests): void
     * If ride has capacity and queue is not empty:
       - Move guests from queue to ridersOnBoard (up to capacity)
       - Start ride timer
     * If ride is mid-cycle:
       - Decrement timer
       - When timer hits 0, process ride completion for all riders
     * Breakdown check: once per day, random check against breakdownChance
       - If broken: status = 'broken', eject queue, notify mechanics
   
   - repairRide(rideId): void - takes 30-90 ticks, then status = 'open'
   
   - calculateRideRatings(ride, grid): {excitement, intensity, nausea}
     Adapted from OpenRCT2's ride_ratings system:
     Start with base stats from RideDefinition
     sceneryBonus = grid.getSceneryScore(ride.entranceTile.x, ride.entranceTile.y, 5) * 0.08
     Excitement += sceneryBonus (capped at +0.4)
     
     Proximity bonus: for each other ride within 8 tiles, excitement += 0.1 (max +0.5)
     
     Age decay: monthsOld > 6 ? excitement -= min(monthsOld * 0.02, 1.0) : 0
     
     Maintenance factor: if status was 'broken' recently, nausea += 0.3, intensity += 0.2
     
     Return clamped values (min 0, excitement max 10, intensity max 15, nausea max 15)
   
   - recalculateAllRatings(grid): void - batch update, called when scenery/rides change

2. src/engine/simulation/StaffManager.ts:

   Staff types and behaviors:
   
   JANITOR:
   - Patrols assigned area or wanders park
   - Automatically cleans "litter" tiles within 2 tiles
   - Salary: 500/month
   
   MECHANIC:
   - When a ride breaks: pathfinds to broken ride
   - Repair takes 30-90 ticks based on ride complexity
   - If no patrol area set, responds to any breakdown in park
   - Salary: 700/month
   
   SECURITY:
   - Presence reduces vandalism chance in 10-tile radius
   - Increases guest happiness slightly when nearby (+1 per 30 ticks)
   - Salary: 600/month
   
   ENTERTAINER:
   - Wanders and boosts happiness of nearby guests (+3 per 20 ticks within 5 tiles)
   - Salary: 400/month
   
   - hireStaff(type, position): Staff
   - fireStaff(staffId): void
   - processStaffTick(staff, gameState): void
   - assignPatrolArea(staffId, tiles): void
   - getStaffCosts(): number (total monthly wages)

3. src/engine/simulation/WeatherManager.ts:

   HK weather system (monthly probabilities):
   - Spring (Mar-May): 60% clear, 30% cloudy, 10% rain
   - Summer (Jun-Sep): 30% clear, 30% cloudy, 25% rain, 15% typhoon_warning
   - Autumn (Oct-Nov): 70% clear, 20% cloudy, 10% rain
   - Winter (Dec-Feb): 50% clear, 40% cloudy, 10% rain
   
   Weather effects:
   - CLEAR: normal operations
   - CLOUDY: no effect on gameplay, visual only
   - RAIN: guest spawn rate -30%, outdoor ride excitement -0.5, guests seek shelter
   - TYPHOON_WARNING: guest spawn rate -60%, all outdoor rides close
   - TYPHOON: park closes for 1-3 days, possible ride damage (10% chance per ride)
   
   Weather changes once per day with above probabilities.
   Typhoons only in summer, 5% daily chance during typhoon season, last 1-3 days.
   
   Random events (checked monthly):
   - "Festival Season" (Oct): +50% guests for 7 days
   - "Holiday Rush" (Dec-Jan): +30% guests
   - "Celebrity Visit": random, +20% rating for 3 days
   - "Health Inspection": random, if cleanliness low, fine $5000
```

---

### PROMPT 6: PixiJS Renderer

```
Continuing HK Theme Park Tycoon. All simulation systems are built.

Build the rendering layer using PixiJS 8. The game uses a top-down 2D view (not isometric, to simplify). Each tile is 32x32 pixels.

1. src/renderer/GameCanvas.tsx:
   - React component wrapping PIXI.Application
   - Canvas fills viewport (100vw x 100vh minus UI bars)
   - Initialize PIXI app with: antialias: false, backgroundColor: 0x4a7c59 (grass green)
   - Mount rendering layers in order: TerrainLayer, BuildingLayer, GuestLayer, UILayer
   - Handle window resize
   - Pass game state updates to layers via a render() method called 30fps

2. src/renderer/Camera.ts:
   - Controls PIXI.Container transform (the "world" container that holds all layers)
   - Pan: mouse drag (middle button or hold space + left click), WASD keys
   - Zoom: scroll wheel, min 0.5x max 3x, zoom toward cursor position
   - Smooth interpolation: lerp toward target position/zoom each frame (factor 0.15)
   - Bounds clamping: don't let camera go too far outside the grid
   - screenToWorld(screenX, screenY): {x, y} - convert screen coords to tile coords
   - worldToScreen(tileX, tileY): {x, y}

3. src/renderer/layers/TerrainLayer.ts:
   - Renders the tile grid
   - Use colored rectangles for now (sprites later):
     * EMPTY (unlocked): light green #7ec850
     * EMPTY (locked/unbuildable): dark gray #3a3a3a
     * PATH: sandy brown #d4a574
     * WATER: blue #4a90d9
     * TERRAIN_HILL: darker green #5a9a3a
     * ENTRANCE: yellow #f0c040
   - Only render tiles visible in viewport (frustum culling)
   - Grid lines: 1px gray lines between tiles at zoom > 1.5x
   - Update when grid changes (dirty flag system)

4. src/renderer/layers/BuildingLayer.ts:
   - Renders rides and shops on the grid
   - Rides: colored rectangles matching their footprint with the ride name as text
     * THRILL: red-orange tones
     * FAMILY: blue tones
     * GENTLE: green tones
     * WATER: cyan tones
     * TRANSPORT: yellow tones
   - Shops: smaller squares with icons (use emoji as placeholder: food shops get a bowl emoji text, drinks get a cup, etc.)
   - Decorations: small green circles
   - Show ride status: green border = open, red = broken, gray = closed
   - Ride queues: render a line of dots from entrance along path showing queue length

5. src/renderer/layers/GuestLayer.ts:
   - Render guests as small circles (4px radius at 1x zoom)
   - Color by happiness: green (>180), yellow (120-180), orange (80-120), red (<80)
   - Only render guests in viewport
   - Object pooling: pre-create 500 PIXI.Graphics objects, show/hide as needed
   - At low zoom (<0.8x), render guests as 2px dots for performance
   - At high zoom (>2x), show guest name on hover

6. src/renderer/layers/UILayer.ts:
   - Tile highlight: colored border on tile under cursor
     * Green when valid placement, red when invalid
   - Ghost preview: semi-transparent version of what you're about to build
   - Selection box: blue border around selected entity
   - District borders: dashed white lines showing district boundaries
   - Path connectivity: when building paths, show which tiles are connected to entrance (green) vs disconnected (orange)

7. Input handling in GameCanvas:
   - Click: if tool selected, perform action (build/demolish/select). If select tool, pick entity under cursor
   - Right-click: cancel current tool, switch to SELECT
   - Hover: update UILayer highlight
   - Keyboard: 1-7 for tool shortcuts, R to rotate placement, +/- for game speed, Space to pause

All rendering should be decoupled from simulation. The renderer reads from the Zustand store, it never modifies game state directly.
```

---

### PROMPT 7: React UI & Zustand Store

```
Continuing HK Theme Park Tycoon. Renderer is built.

Build the React UI overlay and wire everything together with Zustand:

1. src/state/gameStore.ts - Zustand store with Immer middleware:
   - Full GameState as defined in types
   - Actions:
     * initGame(): set up initial grid, unlock first district, place entrance
     * setSpeed(speed): void
     * setTool(tool): void
     * buildPath(x, y): validate and place path
     * placeRide(definitionId, x, y, rotation): validate, deduct cost, place
     * placeShop(definitionId, x, y): validate, deduct cost, place
     * demolish(x, y): remove entity, refund 50%
     * openRide(rideId) / closeRide(rideId)
     * setTicketPrice(rideId, price): void
     * hireStaff(type, position): void
     * unlockDistrict(districtId): void
     * tick(): process one game tick (called by GameLoop)
   
   tick() orchestrates all managers in order:
   1. GameLoop time advance
   2. WeatherManager.processTick()
   3. GuestManager.processAllGuests()
   4. RideManager.processAllRides()
   5. StaffManager.processAllStaff()
   6. EconomyManager.processDay() (if new day)
   7. EconomyManager.processMonth() (if new month)
   8. ParkRating.recalculate() (every 30 ticks)

2. src/ui/TopBar.tsx:
   - Fixed bar at top of screen, 48px height
   - Left: Park name (editable on click)
   - Center: Money display (green if positive monthly, red if negative), formatted as HK$ with commas
   - Center-right: Date display "Day X, Month Y, Year Z"
   - Right: Guest count (icon + number), Park Rating (star icon + number/1000)
   - Far right: Speed controls (pause, 1x, 2x, 4x buttons)
   - Style: dark semi-transparent background, white text, HK neon-sign aesthetic with a subtle glow

3. src/ui/Toolbar.tsx:
   - Fixed bar at bottom, 64px height
   - Horizontal tool buttons with icons:
     * Pointer/Select (default)
     * Build Path (footpath icon)
     * Place Ride (roller coaster icon) - opens ride picker submenu
     * Place Shop (shop icon) - opens shop picker submenu
     * Place Decoration (tree icon)
     * Demolish (bulldozer icon)
     * Staff (person icon) - opens staff hire menu
     * Finance (chart icon) - opens finance window
     * District Map (map icon) - opens district panel
   - Active tool highlighted with accent color
   - Submenus appear above toolbar when ride/shop selected: grid of available items with name, cost, and mini preview
   - Style: dark background matching TopBar

4. src/ui/InfoPanel.tsx:
   - Right side panel, 280px wide, slides in when entity selected
   - Shows contextual info:
     * Ride: name, status, ratings (E/I/N with colored bars), queue length, ticket price (editable slider), monthly revenue, total customers, open/close toggle, breakdown history
     * Shop: name, stock level, revenue, restock button
     * Guest: name, happiness bar, needs bars (hunger/thirst/energy/nausea), cash, current thought, rides ridden list
     * Staff: name, type, salary, patrol area toggle
   - Close button (X) to dismiss

5. src/ui/FinanceWindow.tsx:
   - Modal overlay
   - Monthly P&L breakdown: revenue categories, expense categories, net profit
   - Bar chart of last 12 months net profit (use simple div-based chart, no library needed)
   - Loan management: current loan, interest rate, borrow/repay buttons with amount input
   - Cash flow forecast (simple: if current trajectory continues, months until bankrupt or target)

6. src/ui/DistrictPanel.tsx:
   - Modal overlay with minimap of all districts
   - Shows each district: name, unlocked/locked, cost, terrain type, guest multiplier
   - "Unlock" button for locked districts (grayed out if can't afford)
   - Clicking an unlocked district centers camera on it

7. src/app/game/page.tsx:
   - Assembles everything: GameCanvas as base, TopBar/Toolbar/InfoPanel as React overlays
   - On mount: initialize game store, start game loop
   - Handle keyboard shortcuts globally

Style everything with a cohesive HK neon-noir aesthetic:
- Dark backgrounds (#1a1a2e, #16213e)
- Neon accent colors: hot pink #ff2e63, electric blue #08d9d6, golden yellow #f0c040
- Font: system monospace for numbers, sans-serif for labels
- Subtle CSS glow effects on active elements
- All panels have slight transparency and backdrop-blur

Make sure the full game loop works end-to-end: you can place paths, build rides, guests spawn and interact, money flows, time passes.
```

---

### PROMPT 8: Building System Polish & Placement UX

```
Continuing HK Theme Park Tycoon. Core game loop is working.

Polish the building experience:

1. Path auto-connection system:
   - When placing a path tile, check all 4 neighbors
   - Assign path visual variant based on connections:
     * 0 connections: standalone dot
     * 1 connection: dead end (show warning indicator)
     * 2 opposite connections: straight (horizontal or vertical)
     * 2 adjacent connections: corner
     * 3 connections: T-junction
     * 4 connections: crossroad
   - When placing/removing paths, update all neighbor variants
   - Click-and-drag path building: hold mouse and drag to paint paths
   - Path cost: $50 per tile
   - Show path connectivity: tiles connected to entrance pulse green briefly on placement

2. Ride placement UX:
   - Ride picker submenu: grid layout showing ride cards
   - Each card: name, category icon, cost, mini excitement/intensity/nausea bars, footprint size
   - Filter buttons: All, Thrill, Family, Gentle, Water, Transport
   - Sort by: Cost, Excitement, Category
   - When placing: show footprint ghost on grid (green/red for valid/invalid)
   - R key rotates 90 degrees
   - After placing, auto-prompt: "Set ticket price" with suggested price from calculateRideValue()
   - Entrance/exit auto-placed on the path-adjacent side

3. Demolish tool:
   - Click to demolish single tile
   - Shows refund amount before confirming (50% of build cost)
   - Cannot demolish entrance
   - When demolishing a ride: ejects all guests, removes from grid, clears queue
   - When demolishing a path: check if it disconnects other buildings. If so, show warning "This will disconnect X rides/shops. Continue?"

4. Decoration system:
   - 6 decoration types: Lantern ($200), Bamboo Garden ($500), Fountain ($800), Neon Sign ($400), Bonsai Tree ($300), Stone Lion ($600)
   - 1x1 tile each
   - Must be placed adjacent to path
   - Each adds scenery score to nearby rides (recalculate ratings on placement)
   - Visual: colored circles with emoji placeholder (lantern, bamboo, etc.)

5. Terraform tool (simple):
   - Raise/lower terrain elevation (0-3)
   - Cost: $200 per tile per level change
   - Cannot terraform tiles with entities on them
   - Higher elevation tiles: slight visual darkening
   - Some rides get bonuses on elevated terrain (thrill rides: +0.2 excitement per elevation level)
```

---

### PROMPT 9: Save/Load & Game Balance

```
Continuing HK Theme Park Tycoon. Building system is polished.

1. src/state/saveManager.ts:
   - Save to IndexedDB using 'idb' library (or raw IndexedDB API)
   - Serialize full GameState to JSON
   - Auto-save every 5 minutes (game time)
   - Manual save/load from UI
   - Up to 5 save slots
   - Save metadata: park name, money, date, rating, timestamp
   - Load restores all state and resumes game loop
   - Export save as JSON file (download)
   - Import save from JSON file

2. Game balance pass - adjust these values to create a satisfying difficulty curve:

   Starting conditions:
   - Money: $500,000 HKD
   - First district unlocked (Mong Kok, 20x20)
   - No loans
   
   Target progression:
   - Month 1-3: Build 2-3 rides, 2 shops, basic path network. Should be slightly profitable.
   - Month 4-6: Afford second district or bigger rides. 50-100 guests.
   - Month 6-12: 3-4 districts, 8+ rides, steady profit. 200+ guests.
   - Year 2+: Competing with "Ocean Park" rival (rating milestone). 400+ guests.
   
   Key balance levers:
   - Guest cash (80-300): determines total spend per visit
   - Guest spawn rate: tied to park rating, most impactful lever
   - Ride ticket pricing: OpenRCT2-style "value" formula prevents overcharging
   - Maintenance costs: should be ~20-30% of ride revenue
   - Staff wages: meaningful but not crushing
   - Loan interest: high enough to discourage permanent debt (10%/year)
   
   Win condition: reach park rating 900+ and $2M cash balance
   Loss condition: go bankrupt (negative money with max loan for 3 consecutive months)

3. New Game flow:
   - Landing page with: "New Game", "Continue", "Load Game" buttons
   - New Game: enter park name, difficulty (Easy/Normal/Hard)
   - Difficulty affects: starting money (Easy: 750k, Normal: 500k, Hard: 300k), loan limit, guest cash range, breakdown frequency
   - Tutorial overlay for first game: 5 step walkthrough (build entrance path, place first ride, set price, build shop, open park)

4. Notification system:
   - Toast notifications in top-right corner
   - Events: "Ride X has broken down!", "Monthly Report: Net profit $X", "New district available!", "Typhoon warning!", "Guest milestone: 100 guests!"
   - Click notification to center camera on relevant entity
   - History log accessible from a button
```

---

### PROMPT 10: Audio, Polish & Visual Upgrade

```
Continuing HK Theme Park Tycoon. Game is playable with all core systems.

Final polish pass:

1. Audio system using Howler.js:
   - Background music: royalty-free Chinese-inspired ambient loop (provide placeholder with a simple oscillator-generated tune if no asset available)
   - Sound effects (generate simple Web Audio API tones as placeholders):
     * Path placed: soft click
     * Ride placed: construction sound (hammer)
     * Ride opened: cheerful chime
     * Ride broken: alarm buzzer
     * Guest entering: quiet "welcome" ding
     * Cash register: ka-ching on purchase
     * Demolish: crunch
     * Error/invalid: low buzz
     * Typhoon: wind howling
   - Volume controls in settings
   - Mute toggle

2. Visual improvements:
   - Rides: replace colored rectangles with simple but recognizable shapes:
     * Roller coasters: wavy line pattern
     * Ferris wheel: circle with spokes
     * Spinner rides: rotating diamond
     * Boats: boat shape
     * Carousel: circular with inner pattern
   - Guest sprites: tiny animated dots that "bob" while walking
   - Water tiles: subtle animated blue with wave pattern (CSS or PIXI filter)
   - Rain effect: particle overlay when weather is RAIN
   - Day/night cycle: subtle tint change. Morning = warm, afternoon = bright, evening = orange, night = blue-dark (purely cosmetic, 1 cycle per game month)

3. Performance optimization:
   - Profile and fix any frame drops with 300+ guests
   - Ensure guest processing is spread across frames (process 50 per frame, not all at once)
   - Implement dirty rectangle rendering: only redraw changed tiles
   - Texture atlas: combine all tile graphics into single spritesheet
   - Debounce UI updates: info panel refreshes at 10fps max, not every frame

4. Responsive layout:
   - Works on screens 1024px+ wide
   - Toolbar collapses to icons-only below 1280px
   - InfoPanel becomes a bottom sheet on narrow screens
   - Touch support: pinch to zoom, two-finger drag to pan, tap to place

5. Final integration test:
   - Run through full game loop: new game -> build path -> place rides -> guests spawn -> earn money -> unlock district -> survive typhoon -> reach rating 500
   - Fix any bugs found during playtest
   - Ensure save/load preserves all state correctly
```

---

## Post-MVP Enhancement Prompts (Future)

These can be tackled after the core game is solid:

### PROMPT 11: Sprite Assets & Visual Identity
```
Replace all placeholder rectangles and circles with proper pixel art sprites.
Create a 32x32 tile spritesheet with: 15 terrain variants, 12 ride sprites, 8 shop sprites, 6 decoration sprites, 4 guest animations (walking N/S/E/W), staff sprites.
Use a consistent HK neon-noir pixel art style.
```

### PROMPT 12: Scenario Mode
```
Add 5 pre-built scenarios with specific objectives:
1. "Mong Kok Madness" - reach 200 guests in 2 years with only $200k
2. "Typhoon Season" - survive 3 typhoons and maintain rating 500+
3. "Budget Builder" - profit $500k in 1 year with no loans
4. "The Great Expansion" - unlock all 6 districts in 3 years
5. "Five Star Park" - reach rating 999
```

### PROMPT 13: Multiplayer Leaderboard
```
Add a competitive element: submit park score to a simple leaderboard.
Score = (parkRating * totalGuestsAllTime * netProfit) / daysPlayed.
Use Supabase or a simple API endpoint to store/retrieve scores.
Show global leaderboard on landing page.
```

---

## Summary of Borrowed Patterns from Open Source

| System | Source | What We Took | How We Adapted |
|--------|--------|-------------|----------------|
| Guest AI state machine | OpenRCT2 peep/ | State transitions, need priorities | Simplified from 20+ states to 9, removed sub-states |
| Pathfinding | OpenRCT2 GuestPathfinding.cpp | Junction-limited search, path caching | Switched from edge-walk to standard A* with iteration cap |
| Ride ratings | OpenRCT2 RideRatings.cpp + wiki | Excitement/Intensity/Nausea model, scenery bonus, proximity bonus, age decay | Static base ratings instead of physics simulation (no track editor) |
| Ride pricing | OpenRCT2 RideRatings.cpp | Weighted value formula with type multipliers | Simplified weights, removed some edge cases |
| Finance | OpenRCT2 park/ | Revenue/expense categories, monthly reports, loan system | Reduced categories, simplified interest calculation |
| Grid/tile system | micropolisJS | 2D grid, tile types, zone-based building | Adapted from city zones to theme park entities |
| Game loop | micropolisJS + MicropolisCore | Speed controls, tick-based simulation, event system | Same pattern, different tick rates |

None of this is copy-pasted code. It's all re-implemented in TypeScript based on studying the algorithms and game design patterns. OpenRCT2 is GPL-3 licensed and we're learning from the design, not linking their code.
