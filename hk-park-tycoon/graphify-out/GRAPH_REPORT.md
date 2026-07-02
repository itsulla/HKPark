# Graph Report - /home/muffinman/HKThemePark/hk-park-tycoon  (2026-07-02)

## Corpus Check
- 68 files · ~436,480 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 587 nodes · 1247 edges · 37 communities (26 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.61)
- Token cost: 38,915 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Guest Simulation Engine|Guest Simulation Engine]]
- [[_COMMUNITY_Event Bus & Game Loop|Event Bus & Game Loop]]
- [[_COMMUNITY_Impressions Ingestion API|Impressions Ingestion API]]
- [[_COMMUNITY_Engine Type Definitions|Engine Type Definitions]]
- [[_COMMUNITY_Sponsorship & Business Docs|Sponsorship & Business Docs]]
- [[_COMMUNITY_Blender Procedural Sprites|Blender Procedural Sprites]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Staff Simulation|Staff Simulation]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Landing Page & Saves|Landing Page & Saves]]
- [[_COMMUNITY_Camera Controller|Camera Controller]]
- [[_COMMUNITY_Building Sprite Rendering|Building Sprite Rendering]]
- [[_COMMUNITY_Blender GLB Renderer|Blender GLB Renderer]]
- [[_COMMUNITY_Game Page Orchestrator|Game Page Orchestrator]]
- [[_COMMUNITY_Terrain & Grid Rendering|Terrain & Grid Rendering]]
- [[_COMMUNITY_Staff Layer Rendering|Staff Layer Rendering]]
- [[_COMMUNITY_Staff UI & Toolbar|Staff UI & Toolbar]]
- [[_COMMUNITY_VIP Persona Manager|VIP Persona Manager]]
- [[_COMMUNITY_Guest Layer Rendering|Guest Layer Rendering]]
- [[_COMMUNITY_Info Panel UI|Info Panel UI]]
- [[_COMMUNITY_Ambient Weather FX|Ambient Weather FX]]
- [[_COMMUNITY_HUD Overlay Widgets|HUD Overlay Widgets]]
- [[_COMMUNITY_Shop Picker UI|Shop Picker UI]]
- [[_COMMUNITY_Game Canvas Input|Game Canvas Input]]
- [[_COMMUNITY_Finance Window UI|Finance Window UI]]
- [[_COMMUNITY_Ride Picker UI|Ride Picker UI]]
- [[_COMMUNITY_Admin Stats API|Admin Stats API]]
- [[_COMMUNITY_Building Layer Class|Building Layer Class]]
- [[_COMMUNITY_District Panel UI|District Panel UI]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Admin Dashboard Page|Admin Dashboard Page]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_PM2 Deploy Config|PM2 Deploy Config]]
- [[_COMMUNITY_Top Bar UI|Top Bar UI]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]

## God Nodes (most connected - your core abstractions)
1. `Grid` - 47 edges
2. `Position` - 33 edges
3. `useGameStore` - 29 edges
4. `Guest` - 28 edges
5. `Ride` - 27 edges
6. `EventBus` - 26 edges
7. `GuestManager` - 23 edges
8. `GameDate` - 19 edges
9. `GameStoreState` - 19 edges
10. `RideDefinition` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Blender Sprite Pipeline (Headless)` --semantically_similar_to--> `Sprite Fallback to Coloured Rects`  [INFERRED] [semantically similar]
  tools/blender/README.md → README.md
- `Procedural Placeholders Strategy` --semantically_similar_to--> `Poly Pizza (CC-BY 3.0 Model Source)`  [INFERRED] [semantically similar]
  tools/blender/README.md → ATTRIBUTION.md
- `Third-Party Model Attribution (CC-BY)` --conceptually_related_to--> `Asset Pipeline (Sprites by Definition ID)`  [INFERRED]
  ATTRIBUTION.md → README.md
- `render_sprites.py (Headless Render Script)` --shares_data_with--> `Asset Pipeline (Sprites by Definition ID)`  [INFERRED]
  tools/blender/README.md → README.md
- `Blender Sprite Pipeline (Headless)` --references--> `Neon-Noir Hong Kong Aesthetic`  [EXTRACTED]
  tools/blender/README.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sponsorship Impression Tracking Flow** — readme_layer_3_sponsorship_surfaces, readme_api_impressions, readme_impressions_log, readme_api_admin_stats, readme_admin_dashboard [EXTRACTED 1.00]
- **Sprite Asset Production Pipeline** — readme_asset_pipeline, readme_art_direction_doc, readme_import_pipeline_process_py, tools_blender_readme_blender_sprite_pipeline, readme_sprite_fallback [EXTRACTED 1.00]
- **Three-Layer Native Advertising Platform** — readme_layer_1_the_game, readme_layer_2_ai_vip_guests, readme_layer_3_sponsorship_surfaces, readme_native_advertising_platform [EXTRACTED 1.00]

## Communities (37 total, 11 thin omitted)

### Community 0 - "Guest Simulation Engine"
Cohesion: 0.08
Nodes (21): clamp(), gaussianRandom(), GuestManager, GuestTimers, manhattan(), moveAlongPath(), ALL_NAMES, CANTONESE_NAMES (+13 more)

### Community 1 - "Event Bus & Game Loop"
Cohesion: 0.06
Nodes (21): EventBus, EventCallback, GameEvents, InternalCallback, GameLoop, SPEED_MS_PER_TICK, CATEGORY_WEIGHTS, CategoryWeights (+13 more)

### Community 2 - "Impressions Ingestion API"
Cohesion: 0.06
Nodes (25): clientIp(), globalWindow, ImpressionBatch, isValidEvent(), POST(), rateBuckets, rateLimited(), VALID_EVENT_TYPES (+17 more)

### Community 3 - "Engine Type Definitions"
Cohesion: 0.09
Nodes (26): ActiveParkEvent, DecorationDefinition, District, FinancialReport, GameEvent, GameOverState, GameSpeed, GameState (+18 more)

### Community 4 - "Sponsorship & Business Docs"
Cohesion: 0.06
Nodes (38): CC-BY 3.0 Licensing Policy, Poly Pizza (CC-BY 3.0 Model Source), Third-Party Model Attribution (CC-BY), Admin Sponsor Impressions Dashboard (/admin), ADMIN_TOKEN (Fail-Closed Admin Auth), /api/admin/stats (Aggregated Impression Stats), /api/impressions (Impression Ingestion), /api/sponsors (Active Sponsor Campaigns) (+30 more)

### Community 5 - "Blender Procedural Sprites"
Cohesion: 0.19
Nodes (32): build_bamboo_garden(), build_boat(), build_bonsai(), build_carousel(), build_coaster(), build_drop_tower(), build_ferris(), build_fountain() (+24 more)

### Community 6 - "Package Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, howler, immer, next, pixi.js, @pixi/react, react, react-dom (+21 more)

### Community 7 - "Staff Simulation"
Cohesion: 0.15
Nodes (7): STAFF_NAME_MAP, StaffManager, Position, Staff, HeapNode, MinHeap, Pathfinder

### Community 8 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 9 - "Landing Page & Saves"
Cohesion: 0.15
Nodes (11): autoSave(), listSaves(), loadAutoSave(), loadGame(), openDB(), SaveData, saveGame(), saveManager (+3 more)

### Community 11 - "Building Sprite Rendering"
Cohesion: 0.13
Nodes (14): BROKEN_MARKER_STYLE, CachedLabel, DEFAULT_RIDE_SCALE, RIDE_CATEGORY_COLORS, RIDE_LABEL_STYLE, RIDE_SCALE, rideDefMap, SHOP_CATEGORY_COLORS (+6 more)

### Community 12 - "Blender GLB Renderer"
Cohesion: 0.29
Nodes (13): add_shadow_catcher(), clear_scene(), get_args(), import_glb(), main(), pick_pose(), Render imported GLB models into game sprites (HK neon-noir rig).  Usage:   blend, render_one() (+5 more)

### Community 13 - "Game Page Orchestrator"
Cohesion: 0.17
Nodes (7): GameCanvas, GamePageInner(), RIDE_DEFS, SHOP_DEFS, NotificationToast(), typeIcons, typeStyles

### Community 14 - "Terrain & Grid Rendering"
Cohesion: 0.27
Nodes (4): Tile, ViewportBounds, TerrainLayer, TILE_COLORS

### Community 15 - "Staff Layer Rendering"
Cohesion: 0.24
Nodes (7): StaffType, LETTER_STYLE, PoolEntry, STAFF_COLORS, STAFF_LETTERS, STAFF_SPRITE_FILES, StaffLayer

### Community 16 - "Staff UI & Toolbar"
Cohesion: 0.18
Nodes (8): STAFF_META, StaffDef, staffDefs, StaffPicker(), Toolbar(), ToolbarProps, ToolButton, toolButtons

### Community 17 - "VIP Persona Manager"
Cohesion: 0.31
Nodes (5): SponsoredSurfaceRef, VIPComment, VIPCommentContext, VIPManager, VIPPersona

### Community 18 - "Guest Layer Rendering"
Cohesion: 0.27
Nodes (6): BRACKET_COLORS, drawStar(), getHappinessBracket(), GuestLayer, HappinessBracket, PoolEntry

### Community 21 - "HUD Overlay Widgets"
Cohesion: 0.43
Nodes (4): useGameStore, GameEndOverlay(), ObjectivesWidget(), VIPFeed()

### Community 22 - "Shop Picker UI"
Cohesion: 0.33
Nodes (5): ShopCategory, categories, categoryColors, ShopPicker(), shops

### Community 23 - "Game Canvas Input"
Cohesion: 0.40
Nodes (3): findRideDef(), getPlacementFootprint(), rideDefMap

### Community 24 - "Finance Window UI"
Cohesion: 0.40
Nodes (3): FinanceWindow(), FinanceWindowProps, formatMoney()

### Community 25 - "Ride Picker UI"
Cohesion: 0.33
Nodes (4): categories, categoryColors, RidePicker(), rides

### Community 26 - "Admin Stats API"
Cohesion: 0.50
Nodes (4): GET(), isAuthorized(), LoggedEvent, SponsorStats

### Community 28 - "District Panel UI"
Cohesion: 0.40
Nodes (3): DistrictPanel(), DistrictPanelProps, terrainColors

### Community 29 - "ESLint Config"
Cohesion: 0.50
Nodes (3): extends, rules, @typescript-eslint/no-unused-vars

## Knowledge Gaps
- **141 isolated node(s):** `extends`, `@typescript-eslint/no-unused-vars`, `{ readFileSync }`, `{ join }`, `nextConfig` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Grid` connect `Guest Simulation Engine` to `Engine Type Definitions`, `Game Page Orchestrator`, `Terrain & Grid Rendering`, `Staff Simulation`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Camera` connect `Camera Controller` to `Terrain & Grid Rendering`, `Game Canvas Input`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Position` connect `Staff Simulation` to `Guest Simulation Engine`, `Staff UI & Toolbar`, `Engine Type Definitions`, `Game Canvas Input`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `extends`, `@typescript-eslint/no-unused-vars`, `{ readFileSync }` to the rest of the system?**
  _147 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Guest Simulation Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07971014492753623 - nodes in this community are weakly interconnected._
- **Should `Event Bus & Game Loop` be split into smaller, more focused modules?**
  _Cohesion score 0.05573770491803279 - nodes in this community are weakly interconnected._
- **Should `Impressions Ingestion API` be split into smaller, more focused modules?**
  _Cohesion score 0.06382978723404255 - nodes in this community are weakly interconnected._