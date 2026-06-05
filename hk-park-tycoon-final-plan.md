# HK Theme Park Tycoon: Final Build Plan
## Park Builder + AI VIPs + Sponsorable Digital Real Estate

---

## Vision in One Sentence

A free browser-based theme park tycoon set in Hong Kong where AI characters react to your park, designed so every surface in the game (shops, rides, billboards, districts) can later become rentable digital real estate for real brands, without any architectural changes.

---

## The Three Layers

**Layer 1: Park Builder** — The tycoon simulation. Build, manage, profit. This hooks people.

**Layer 2: AI VIP Guests** — Named characters with Claude-driven personalities who react to your park. This makes it shareable and sticky.

**Layer 3: Sponsorship Surfaces** — Every shop, ride, billboard, and district has a `sponsor` config slot that ships empty (using default HK-themed branding). When a real brand pays, their assets swap in seamlessly. Players experience it as "realism." This is invisible until activated.

---

## How Sponsorship Surfaces Work (Technical)

The core idea: every placeable entity in the game has a dual identity.

```typescript
interface SponsorableEntity {
  // Default identity (ships with game, always exists)
  defaultName: string;          // "Bubble Tea Bar"
  defaultIcon: string;          // 🧋
  defaultDescription: string;   // "Refreshing pearl milk tea"
  defaultColorScheme: string;   // "#8B6914"

  // Sponsor overlay (null = use defaults, filled = brand takes over)
  sponsor: SponsorConfig | null;
}

interface SponsorConfig {
  sponsorId: string;            // "vita-lemon-tea"
  brandName: string;            // "Vita Lemon Tea"
  displayName: string;          // "Vita Lemon Tea Stand"
  logoUrl: string;              // CDN-hosted brand logo
  colorScheme: string;          // Brand colors
  description: string;          // "Official Vita Lemon Tea — refreshing since 1940"
  clickUrl: string | null;      // Optional: link to brand site/promo
  impressionTrackingId: string; // For analytics
  tier: 'shop' | 'ride' | 'billboard' | 'district' | 'event';
  startDate: string;            // Campaign start
  endDate: string;              // Campaign end
}
```

At render time, one simple function:

```typescript
function getEntityDisplay(entity: SponsorableEntity): DisplayConfig {
  if (entity.sponsor && isActiveCampaign(entity.sponsor)) {
    return {
      name: entity.sponsor.displayName,
      icon: entity.sponsor.logoUrl,
      color: entity.sponsor.colorScheme,
      description: entity.sponsor.description,
    };
  }
  return {
    name: entity.defaultName,
    icon: entity.defaultIcon,
    color: entity.defaultColorScheme,
    description: entity.defaultDescription,
  };
}
```

That's it. The entire sponsorship system is a null check on a config field. No special rendering code, no ad SDK, no third-party scripts injected into the game.

---

## Sponsorable Surface Inventory

Every one of these ships with a beautiful default HK identity. The sponsor slot is just an empty config field waiting to be filled.

### Shops (8 slots)

| Default Name | Default Identity | Sponsor Fit |
|---|---|---|
| Bubble Tea Bar | Generic HK bubble tea | Vita, Pocari Sweat, Hey Tea |
| Dai Pai Dong | Street food stall | Fairwood, Café de Coral, Tam Jai |
| Egg Waffle Stand | Classic street snack | Lee Keung Kee, Mammy Pancake |
| Milk Tea Shop | HK-style milk tea | Lan Fong Yuen, Cha Chaan Teng |
| Noodle House | Wonton noodle shop | Tsim Chai Kee, Mak's Noodle |
| Souvenir Pagoda | Tourist gifts | G.O.D. (Goods of Desire), Cathay |
| Ice Cream Junk | Boat-shaped ice cream | Häagen-Dazs, XTC Gelato |
| First Aid Station | Medical tent | Mannings, Watsons |

### Rides (12 slots)

| Default Name | Sponsor Fit |
|---|---|
| Dragon Coaster | MTR Corporation, Dragonair |
| Harbour Ferris Wheel | AIA, HSBC |
| Peak Tram Drop | The Peak Tram Company |
| Junk Boat Cruise | Star Ferry, Cathay Pacific |
| Neon Night Flyer | Samsung, Sony |
| Typhoon Twister | Red Bull, Monster Energy |
| Temple Garden Train | Swire Properties |
| Dim Sum Spinner | Maxim's, Tim Ho Wan |
| Bamboo Scaffold Climb | Sun Hung Kai |
| Lion Dance Carousel | Ocean Park (meta-sponsor) |
| Star Ferry Splash | Star Ferry Company |
| Kowloon Walled City Maze | HK Tourism Board |

### Billboards (unlimited, placeable decoration type)

This is the most flexible surface. Billboards are a decoration type players can place in their park. Each billboard:
- Costs the player $300 in-game (gives +0.1 scenery score)
- Shows a default decorative HK neon sign
- Has a sponsor slot that can show a real brand ad
- When sponsored, the player gets a small in-game bonus (extra revenue from nearby shops) as a reward for placing it, encouraging more billboard placement

### Districts (6 slots)

Each district can have a "presenting sponsor":
- "Mong Kok Market" → "Mong Kok Market presented by Octopus Card"
- Shows sponsor logo on district unlock screen and minimap
- Highest-tier sponsorship, most expensive

### Events (rotating)

Random events can be sponsored:
- "Festival Season" → "Festival Season brought to you by Swire Coca-Cola"
- "Celebrity Visit" → "Samsung Galaxy Celebrity Visit"
- Weather overlay: "Typhoon update brought to you by HK Observatory" (tongue-in-cheek)

### VIP Guests (special tier)

VIPs can have "brand affinity" where they naturally mention products:
- Mei: "I could really use a Vita Lemon Tea right now" (instead of generic "I'm thirsty")
- Big Mike: "Back home we have Whataburger but this Fairwood is pretty solid"
- This is the premium tier. Brands pay for a VIP to have genuine affinity, not forced mentions. The AI prompt includes the brand naturally in the character's preferences.

---

## Impression Tracking (Analytics for Future Sponsors)

Build this from day one even though you have zero sponsors. When you do approach brands, you'll have data.

```typescript
interface ImpressionEvent {
  timestamp: number;
  surfaceType: 'shop' | 'ride' | 'billboard' | 'district' | 'event' | 'vip';
  surfaceId: string;
  sponsorId: string | null;     // null = default branding (unsponsored)
  eventType: 'view' | 'click' | 'hover' | 'vip_mention';
  sessionId: string;
  duration?: number;            // ms the surface was visible on screen
}
```

Track these client-side into a simple array per session. On session end (or periodically), batch-send to your backend. Even before sponsors exist, you're collecting:

- How often each shop/ride appears on screen
- Which surfaces get clicked/hovered most
- Which VIP mentions get the most engagement (clicks on the chat message)
- Average session duration and surfaces-per-session

When you pitch to a brand, you show: "The Bubble Tea Bar appears on screen for an average of 4.2 minutes per session across 15,000 monthly players. That's 63,000 minutes of brand exposure per month."

---

## Sponsor Configuration Flow (Future)

When you're ready to sell (10k+ monthly players), the flow is:

1. **Admin dashboard** (simple Next.js page, auth-protected):
   - List all sponsorable surfaces with current status (default/sponsored)
   - Upload brand assets (logo, colors, display name, description)
   - Set campaign dates
   - Preview how the brand looks in-game
   - View impression analytics per surface

2. **Config served via API:**
   - Game fetches `/api/sponsors` on load
   - Returns array of active SponsorConfig objects
   - Game applies overlays to matching entities
   - Cached aggressively (sponsors change monthly, not per-session)

3. **Zero player disruption:**
   - Players never see an "ad" UI element
   - Sponsored shops look and function identically to default shops
   - The only difference is the name, icon, and colors match a real brand
   - If anything, it makes the game feel more realistic

---

## VIP Brand Integration (The Premium Product)

This is the most valuable sponsorship tier because it's native to the gameplay and inherently shareable.

When a brand sponsors a VIP character, their product gets woven into the personality prompt:

**Unsuponsored Mei:**
```
You love: street food, Instagram moments, thrill rides
Dislikes: long queues, overpriced souvenirs
```

**Mei sponsored by Vita Lemon Tea:**
```
You love: street food, Instagram moments, thrill rides, Vita Lemon Tea (it's your go-to drink, you always have one)
Dislikes: long queues, overpriced souvenirs, when shops don't carry Vita
```

This means Mei might naturally say: "I need a Vita Lemon Tea after that ride, where's the nearest drink stand?" Players screenshot this. They share it. The brand gets organic social media distribution from player-generated content. That's worth 10x a static billboard.

**Pricing model for VIP sponsorship:**
- Brand affinity woven into 1 VIP character's personality
- Guaranteed X mentions per Y play sessions (tunable via prompt frequency)
- Monthly impression + screenshot analytics
- This is the $2,000-5,000/month tier when you have scale

---

## Updated Architecture (additions from merged plan)

```
hk-park-tycoon/
  src/
    ...everything from merged plan...

    sponsors/                     # NEW: Sponsorship layer
      SponsorManager.ts           # Loads sponsor configs, applies overlays
      SponsorConfig.ts            # Types and validation
      ImpressionTracker.ts        # Client-side analytics collection
      defaults.ts                 # Default branding for all entities

    api/                          # NEW: Backend routes
      sponsors/
        route.ts                  # GET /api/sponsors (active configs)
      impressions/
        route.ts                  # POST /api/impressions (batch analytics)
      admin/                      # Future: sponsor management dashboard
        route.ts
```

The SponsorManager is loaded once at game start. It's ~20 lines of code:

```typescript
class SponsorManager {
  private configs: Map<string, SponsorConfig> = new Map();

  async loadSponsors(): Promise<void> {
    const res = await fetch('/api/sponsors');
    const sponsors: SponsorConfig[] = await res.json();
    sponsors.forEach(s => this.configs.set(s.sponsorId, s));
  }

  getSponsor(entityId: string): SponsorConfig | null {
    return this.configs.get(entityId) || null;
  }

  trackImpression(event: ImpressionEvent): void {
    // Batch and send periodically
  }
}
```

---

## Updated Claude Code Prompts

The original 10 prompts from the merged plan stay identical. We add sponsor hooks in two places:

### Addition to PROMPT 1 (Types):

Add to the existing prompt:
```
Add these types to src/engine/types/index.ts:

- SponsorConfig { sponsorId, brandName, displayName, logoUrl, colorScheme,
  description, clickUrl: string|null, impressionTrackingId, 
  tier: 'shop'|'ride'|'billboard'|'district'|'event'|'vip',
  startDate, endDate }

- ImpressionEvent { timestamp, surfaceType, surfaceId, sponsorId: string|null,
  eventType: 'view'|'click'|'hover'|'vip_mention', sessionId, duration?: number }

Add to RideDefinition and ShopDefinition:
- sponsor: SponsorConfig | null  (default: null)

Add to District:
- sponsor: SponsorConfig | null  (default: null)

Create src/sponsors/SponsorManager.ts:
- loadSponsors(): fetches from /api/sponsors, stores in Map
- getSponsorForEntity(entityId: string): SponsorConfig | null
- getDisplayConfig(entity): returns sponsor branding if active, else default
- This is a thin layer, under 50 lines of code

Create src/sponsors/ImpressionTracker.ts:
- track(event: ImpressionEvent): void — adds to buffer
- flush(): sends buffered events to /api/impressions
- Auto-flushes every 30 seconds and on page unload
- Buffer max 500 events before force-flush

Create src/sponsors/defaults.ts:
- Default branding for every shop, ride, and district
- Each has: defaultName, defaultIcon, defaultDescription, defaultColorScheme
- This is the source of truth for "what things look like without sponsors"
```

### Addition to PROMPT 6 (VIP System):

Add to VIPPromptBuilder.ts:
```
When building VIP prompts, check if any shops/rides have active sponsors.
If a VIP's persona has a brandAffinity field (optional), weave it into the
personality section of the system prompt naturally.

The brandAffinity field is NOT in the base persona data. It's injected by
SponsorManager when a VIP sponsorship is active:

interface VIPBrandAffinity {
  brand: string;           // "Vita Lemon Tea"
  product: string;         // "lemon tea drink"
  relationship: string;    // "your favorite drink, you always have one"
  mentionFrequency: number; // 0.0-1.0, chance of mentioning per prompt
}

When generating a prompt, if Math.random() < mentionFrequency:
- Add brand affinity to the "loves" section of the persona
- The AI naturally incorporates it (or doesn't, it's probabilistic)
- Track as a 'vip_mention' impression event when the response includes
  the brand name
```

### Addition to PROMPT 7 (Renderer):

Add to BuildingLayer.ts rendering logic:
```
When rendering a shop or ride, call SponsorManager.getDisplayConfig(entity).
Use the returned name, icon, and colorScheme for rendering.

When a sponsored entity is visible on screen for the first time in a session,
fire an ImpressionTracker.track() event with type 'view'.

When a sponsored entity is clicked, fire a 'click' event.

For billboards (decoration subtype), render the sponsor logo if present,
or the default neon sign graphic if not.
```

### NEW PROMPT 11: Analytics Dashboard & Sponsor Admin

```
Build a simple analytics and sponsor management system:

1. src/app/api/sponsors/route.ts:
   - GET: returns array of active SponsorConfig objects
   - For now, read from a JSON file (sponsors.json in project root)
   - Later: migrate to database (Supabase, Postgres, etc.)

2. src/app/api/impressions/route.ts:
   - POST: accepts batch of ImpressionEvent objects
   - Store in a simple append-only log (JSON lines file or database)
   - No processing needed yet, just collect

3. src/app/admin/page.tsx (protected route, simple password auth):
   - Dashboard showing:
     * Total sessions today/week/month
     * Total impressions by surface type (chart)
     * Top 10 most-viewed surfaces with impression counts
     * Average session duration
     * Player count over time
   
   - Sponsor management:
     * List all sponsorable surfaces (shops, rides, districts, billboards, events, VIPs)
     * Each row shows: default name, current sponsor (or "Available"), impressions
     * "Add Sponsor" form: upload logo, set display name, colors, dates
     * Preview: renders a mock of how the sponsor looks in-game
     * "Deactivate" button to revert to default branding

   - Pitch deck data export:
     * "Export Report" button generates a PDF/CSV with:
       - Monthly unique players
       - Impressions per surface
       - Average visibility duration per surface
       - VIP mention count (if applicable)
       - Formatted for sending to potential sponsors

Style the admin dashboard clean and professional (not the game's neon aesthetic).
This is a business tool, not a player-facing page.
```

---

## The Sales Pitch (When You Have Numbers)

At 10,000+ monthly players, approach HK brands with this deck:

**Slide 1:** "HK Theme Park Tycoon: X,000 monthly players build and manage virtual Hong Kong theme parks."

**Slide 2:** "Your brand lives naturally in the game." Show screenshots of their brand on a shop/ride, looking authentic, not like an ad.

**Slide 3:** Impression data. "The Bubble Tea Bar is visible on screen for 4.2 minutes per average session. That's X0,000 minutes of brand exposure monthly."

**Slide 4:** VIP integration. "AI characters in the game naturally reference your product. Players screenshot and share these moments." Show example Mei quote.

**Slide 5:** Pricing tiers.
- Billboard placement: $500/month (logo on decorative billboards)
- Shop branding: $1,000/month (full shop takeover with brand name, logo, colors)
- Ride sponsorship: $2,000/month (ride name includes brand, appears in VIP dialogue)
- District presenting sponsor: $3,000/month (premium, only 6 available)
- VIP brand affinity: $3,000-5,000/month (AI character naturally mentions brand)

**Slide 6:** "No intrusive ads. No popups. No banners. Your brand exists in the game world the same way it exists in a real theme park. Players experience it as authenticity, not advertising."

---

## Timeline with Sponsorship Milestones

**Months 1-3: Build the game.** All 10 Claude Code prompts. Ship MVP with zero sponsors but all sponsor hooks in place. Impression tracking collecting data from day one.

**Months 3-6: Grow audience.** Submit to indie game directories, HK Reddit/forums, gaming YouTubers. Target: 1,000 monthly players. Use impression data to understand which surfaces get most visibility.

**Months 6-9: Pilot at HKU.** Package simulation mode for a Business & Economics class. This gives you an institutional user base (200+ students per semester) and a credibility badge.

**Month 9-12: First sponsors.** Approach 3-5 local HK brands with real data. Offer first campaigns at 50% discount as "founding sponsors." Target: $2,000-5,000/month total sponsorship revenue.

**Year 2+: Scale.** If the game grows, sponsorship inventory becomes genuinely valuable. 6 district slots + 12 ride slots + 8 shop slots + VIP tiers = 30+ sponsorable surfaces. At scale pricing, that's $30,000-50,000/month potential. Very few indie games reach this, but the ceiling is real.

---

## What Makes This Defensible

The reason this isn't just "banner ads in a game" (which nobody would pay for):

1. **Brand integration is native.** A Vita Lemon Tea shop in a HK theme park game isn't an ad. It's world-building. Players prefer sponsored shops because they feel more realistic than "Generic Drink Stand #3."

2. **AI characters create shareable branded content.** When Mei says she wants a Vita Lemon Tea, players screenshot it. That's user-generated branded content that costs the brand nothing extra. No other ad format does this.

3. **Limited inventory creates scarcity.** There are only 8 shop slots, 12 ride slots, 6 district slots. When one brand takes a slot, competitors can't. This drives pricing up as the game grows.

4. **Data is rich.** You don't just track "impressions." You track visibility duration, click-through, VIP mention engagement, and which surfaces correlate with longer play sessions. This is analytics that traditional game ads can't provide.

5. **The game works perfectly without sponsors.** Unlike ad-supported games that feel broken without ads loading, your game ships with beautiful default HK branding. Sponsors are a premium overlay, not a dependency.
