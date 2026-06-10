# HK Theme Park Tycoon - Art Direction & Asset Guide

## Visual Identity

**Style:** Neon-noir Hong Kong isometric tycoon. Think Kowloon Walled City meets
Ocean Park meets the neon-drenched signage of Mong Kok, rendered in a detailed
semi-realistic isometric style. NOT pixel art, NOT low-poly, NOT cartoon — the
look is *illustrated realism* with vibrant lighting and atmospheric depth.

**Perspective:** 3/4 isometric (approx 30-degree top-down angle). Every object is
seen from the **same camera angle** — slightly above and to the south-east. This
is critical for visual coherence. All assets must share this perspective.

**Lighting:** Golden-hour sunset base (warm amber key light from the west) with
strong neon accent lighting (cyan, magenta, hot-pink, gold). Surfaces should
catch both the warm ambient and the cool neon spill. Night-mode readiness: every
asset should look good against a dark ground plane.

**Colour Palette:**
| Role           | Hex       | Name               |
|----------------|-----------|---------------------|
| Neon Cyan      | `#08d9d6` | Victoria Harbour    |
| Neon Pink      | `#ff2e63` | Neon Alley          |
| Gold           | `#f0c040` | Temple Incense      |
| Jade Green     | `#2ecc71` | Bamboo              |
| Deep Navy      | `#0a0a16` | Night Sky           |
| Warm Asphalt   | `#2a2a3e` | Kowloon Concrete    |

---

## Technical Specs

### Rides (12 total)
- **Canvas size:** 1024 x 1024 px
- **Format:** PNG with transparent background
- **Subject fills** 85-90% of the canvas (allow small margin for glow/shadow)
- **Perspective:** Isometric 3/4 view, south-east facing
- **Ground plane:** The ride should appear to *sit on* a ground surface at the
  bottom ~10% of the canvas. Include a subtle ground shadow/reflection.
- **Detail level:** High. Individual structural members, gondolas, cars, track
  segments, bolts, rivets, neon signage, painted surfaces — all visible.
- **Lighting:** Neon accent lights built into the ride structure (LED strips,
  spotlights, tube lights). Warm ambient from the west.

### Shops (8 total)
- **Canvas size:** 768 x 768 px
- **Format:** PNG with transparent background
- **Subject fills** 80-85% of the canvas
- **Perspective:** Isometric 3/4 view, same angle as rides
- **Design:** Small stall/kiosk structures — open-front, with counters, awnings,
  signage in Chinese + English, visible menu boards or product displays.
- **Lighting:** Warm interior glow spilling out of the service window, neon
  accent sign on the awning/fascia.

### Decorations (6 total)
- **Canvas size:** 512 x 512 px
- **Format:** PNG with transparent background
- **Subject fills** 75-80% of the canvas
- **Perspective:** Isometric 3/4 view
- **Design:** Environmental set-dressing — these fill empty spaces and add
  atmosphere. Should feel like street furniture from a HK night market.

### Tiles (4 types)
- **Canvas size:** 256 x 256 px (seamlessly tileable)
- **Format:** PNG, fully opaque (no transparency)
- **Types:** Grass, Asphalt, Path (stone/brick), Water
- **Must tile seamlessly** in all 4 directions
- **Subtle texture variation** — not flat colour. Grass should have individual
  blades; asphalt should have fine aggregate; paths should show individual
  bricks/stones; water should have gentle ripples.

### Characters (guests + staff)
- **Canvas size:** 384 x 384 px
- **Format:** PNG with transparent background
- **Perspective:** Isometric 3/4 view facing south-east (same as buildings)
- **Design:** Simple but recognisable human figures. Guests are casual visitors;
  staff wear colour-coded uniforms (janitor=green, mechanic=orange,
  security=blue, entertainer=purple).

---

## Master Prompt Template

Use this as the base for every asset. Replace `{SUBJECT}` and `{DETAILS}` per
entity.

```
Isometric 3/4 view game asset, semi-realistic illustrated style, Hong Kong
neon-noir theme park. {SUBJECT}. {DETAILS}. Warm golden-hour sunset ambient
lighting from the west, with vivid neon accent lights (cyan #08d9d6, hot-pink
#ff2e63, gold #f0c040) built into the structure. Atmospheric haze and subtle
ground shadow. Highly detailed — visible structural elements, textures, signage.
Dark/black background for easy extraction. Single isolated object, no
surrounding environment. Professional game art quality.
```

---

## All 26 Entity Prompts

### RIDES (12)

**1. Dragon Coaster** (`rides/dragon-coaster.png`)
- Subject: A looping roller coaster shaped like a Chinese dragon
- Details: Crimson-red dragon-head lead car with golden horns and glowing eyes.
  Track sections visible with golden support pylons. Loop section in the
  background. Neon strip lights along the track rails in hot-pink. Dragon-scale
  texture on the car bodies. 3x5 tile footprint (wide and long).
```
{SUBJECT}: A looping roller coaster with a Chinese dragon-head lead car
{DETAILS}: Crimson-red dragon head with golden horns and glowing cyan eyes leading 6 cars along a twisting track. Golden support pylons, hot-pink neon strip lights along the rails, dragon-scale texture on car bodies. A dramatic loop section visible in the background. The track curves in an S-shape across the scene. Chinese character signage reading "Dragon" (龍) on an illuminated entrance arch.
```

**2. Junk Boat Cruise** (`rides/junk-boat-cruise.png`)
- Subject: A traditional Hong Kong junk boat water ride
- Details: Classic red-sailed junk boat floating on dark water with neon
  reflections. Wooden hull with ornate carvings. The boat sits in a narrow
  canal/channel with stone embankment walls. Passengers visible in the boat.
  Paper lanterns strung along the canal. 4x4 tile footprint.
```
{SUBJECT}: A traditional Hong Kong junk boat floating in a narrow canal water ride
{DETAILS}: Classic red-sailed junk boat with ornate wooden hull carvings, floating on dark water reflecting cyan and pink neon lights. Stone embankment walls line the canal. Paper lanterns (gold and red) are strung above on wires. Tiny passengers sit inside the boat. A decorative torii-style gate marks the canal entrance with the ride name in Chinese characters.
```

**3. Peak Tram Drop Tower** (`rides/peak-tram-drop.png`)
- Subject: A drop tower themed as the Victoria Peak funicular tram
- Details: A tall vertical tower with a replica Peak Tram car (green and cream
  livery) as the gondola. The tower structure uses Hong Kong's bamboo scaffolding
  aesthetic. Neon height markers along the tower. Warning lights at the top.
  Narrow and very tall (2x2 footprint but rendered tall).
```
{SUBJECT}: A drop tower ride themed as Hong Kong's Peak Tram funicular
{DETAILS}: A tall vertical tower clad in bamboo-scaffolding texture with a green-and-cream Peak Tram car as the gondola, currently near the top. Neon height markers in cyan glow along the tower's edge. Red warning lights pulse at the summit. The base has a Victorian-style station entrance with "Peak Tram" signage. Visitors queue behind rope barriers at ground level.
```

**4. Dim Sum Spinner** (`rides/dim-sum-spinner.png`)
- Subject: A spinning teacup-style ride with dim sum baskets instead of cups
- Details: Bamboo steamer baskets as the ride pods, spinning on a circular
  platform shaped like a giant dim sum tray. Each basket has different dim sum
  characters (siu mai, har gow) peeking out. Central spindle is a giant
  chopstick pair. 2x2 footprint.
```
{SUBJECT}: A spinning teacup ride with dim sum bamboo steamer baskets as pods
{DETAILS}: Circular ride platform shaped like a giant round dim sum tray. 6 bamboo steamer baskets serve as spinning passenger pods, each with cute dim sum characters (siu mai, har gow, char siu bao) peeking over the rim. The central spindle is a pair of giant crossed chopsticks. Steam wisps rise from the baskets. Gold and jade neon accents on the platform edge. A small signboard reads "Dim Sum Spinner" in English and Chinese.
```

**5. Neon Night Flyer** (`rides/neon-night-flyer.png`)
- Subject: A high-speed inverted coaster with neon light trails
- Details: Sleek black track with riders hanging below in neon-lit chairs.
  Intense cyan and magenta LED strips along the entire track. The coaster
  sweeps through a dramatic banking turn. Support structure in matte black
  with glowing cyan connection points. 3x3 footprint.
```
{SUBJECT}: A high-speed inverted roller coaster covered in neon light trails
{DETAILS}: Sleek matte-black track with riders hanging below in glowing cyan-lit chairs. Intense LED strips in cyan and magenta run along the entire track length. The coaster is captured mid-banking-turn at a dramatic angle. Support pylons are matte black with glowing cyan bolts at connection points. Trails of light blur behind the lead car suggesting speed. A holographic entrance sign flickers "Neon Night Flyer" in both English and Chinese neon lettering.
```

**6. Temple Garden Train** (`rides/temple-garden-train.png`)
- Subject: A scenic miniature railway through a Chinese temple garden
- Details: A small green-and-gold steam locomotive pulling open-air passenger
  cars along narrow-gauge track. The train passes through a miniature moon
  gate, bonsai trees, and a koi pond with a red bridge. Lanterns line the
  track. Long and low (2x8 footprint).
```
{SUBJECT}: A scenic miniature railway passing through a Chinese temple garden
{DETAILS}: A small green-and-gold steam locomotive with 3 open-air passenger cars on narrow-gauge track. The route passes through a miniature moon gate (circular stone archway), past bonsai trees and a koi pond with a red arched bridge. Gold paper lanterns hang from bamboo poles along the trackside. Tiny wisps of steam from the locomotive. The scene stretches horizontally — long and low composition.
```

**7. Harbour Ferris Wheel** (`rides/harbour-ferris-wheel.png`) - ALREADY DONE
- Using AI-generated art from Dropbox (img2.png). No regeneration needed unless
  quality doesn't match other new assets.

**8. Typhoon Twister** (`rides/typhoon-twister.png`)
- Subject: A top-spin / twisting pendulum ride themed around a typhoon
- Details: A massive arm swings a circular passenger platform that also spins.
  The arm and base are styled as storm clouds and wind swirls. Water spray
  effects. LED rain-effect strips in cyan. Weather warning signal lights at
  the top. 2x2 footprint, rendered tall.
```
{SUBJECT}: A typhoon-themed top-spin pendulum ride with spinning platform
{DETAILS}: A massive chrome arm swings a circular passenger platform that rotates independently. The base is sculpted as stormy waves and cloud formations. Water spray mist effects surround the platform. Cyan LED strips create a rain-curtain effect down the arm. Red typhoon-warning signal lights flash at the pivot point. Wind-swept banners and a "Typhoon Twister" sign in distressed metal lettering. The composition is tall and dynamic.
```

**9. Bamboo Scaffold Climb** (`rides/bamboo-scaffold-climb.png`)
- Subject: An adventure climbing attraction on Hong Kong-style bamboo scaffolding
- Details: A towering structure of authentic-looking bamboo scaffolding (lashed
  with cord) with climbing routes, rope bridges, and platforms at various levels.
  Climbers visible at different heights. Safety nets in neon green. Narrow and
  very tall. 2x3 footprint.
```
{SUBJECT}: A tall adventure climbing structure made of Hong Kong bamboo scaffolding
{DETAILS}: Authentic bamboo poles lashed together with cord in the traditional HK construction style, forming a towering climbing structure with multiple platforms, rope bridges between sections, and cargo net climbing walls. Tiny climbers at various heights. Safety nets glow neon-green under UV lights. Construction warning signs and a "Bamboo Scaffold Climb" banner in red Chinese calligraphy. Very tall narrow vertical composition.
```

**10. Lion Dance Carousel** (`rides/lion-dance-carousel.png`)
- Subject: A merry-go-round where the horses are replaced by lion dance lions
- Details: Traditional carousel canopy with Chinese temple roof styling (upturned
  eaves, painted beams). Instead of horses, riders sit on colourful lion dance
  figures in red, gold, green, and white. Mirrors and lanterns on the central
  column. 2x2 footprint, wide and low.
```
{SUBJECT}: A carousel with Chinese lion dance figures instead of horses
{DETAILS}: Traditional carousel platform with an ornate Chinese temple-style canopy (upturned eaves with dragon finials, painted red and gold beams). Riders sit on colorful lion dance figures — red with gold trim, green with silver trim, white with pink accents. The central column is decorated with mirrors and hanging red lanterns. Warm golden lights ring the canopy edge. A wide, low composition emphasizing the circular shape.
```

**11. Star Ferry Splash** (`rides/star-ferry-splash.png`)
- Subject: A Star Ferry-themed splash/log flume water ride
- Details: Replica Star Ferry boats (green-and-white double-decker) going down
  a flume drop, with a big splash at the bottom. The flume channel is lined
  with Victoria Harbour-themed scenery (mini skyline silhouettes). 3x5 footprint.
```
{SUBJECT}: A log flume water ride using Hong Kong Star Ferry boats
{DETAILS}: Green-and-white double-decker Star Ferry replica boats descend a steep flume drop, creating a dramatic splash at the bottom. The flume channel is lined with miniature Victoria Harbour skyline silhouettes (Bank of China tower, ICC). Blue-lit water cascades. The top of the flume has a "Star Ferry Splash" entrance arch with nautical rope details. Spectators get sprayed at the splash zone. Wide composition showing the full drop.
```

**12. Kowloon Walled City Maze** (`rides/kowloon-walled-city-maze.png`)
- Subject: A walk-through dark ride/maze themed as the demolished Kowloon Walled City
- Details: Dense, stacked concrete buildings with narrow alleys, exposed wiring,
  air conditioning units, neon signage in Chinese, laundry hanging between
  buildings. The maze entrance is a dark alleyway. Atmospheric with cyan/pink
  neon glow seeping from windows. 4x4 footprint.
```
{SUBJECT}: A walk-through maze attraction themed as Kowloon Walled City
{DETAILS}: Dense, vertically stacked concrete buildings forming a maze, viewed from above showing the labyrinthine alley layout. Exposed electrical wiring, dripping air conditioning units, neon signs in Chinese characters glowing cyan and pink from narrow windows. Laundry lines strung between buildings. The entrance is a dark narrow alleyway with a flickering "Enter if you dare" sign. Atmospheric fog seeps from the alleys. The composition shows the dense urban block from an isometric birds-eye angle.
```

---

### SHOPS (8)

**13. Dai Pai Dong** (`shops/dai-pai-dong.png`)
- Subject: A traditional HK street food stall (dai pai dong)
```
{SUBJECT}: A traditional Hong Kong dai pai dong street food stall
{DETAILS}: Open-front metal-frame stall with corrugated awning, wok station with visible flames, hanging roast meats (char siu, roast duck) in the window. Plastic stools and fold-out tables in front. Hand-painted Chinese menu board with prices. A single fluorescent tube light and a red "大排檔" neon sign. Steam rising from the wok. Bottles of sauce on the counter.
```

**14. Egg Waffle Stand** (`shops/egg-waffle-stand.png`)
- Subject: A Hong Kong egg waffle (gai daan jai) street vendor cart
```
{SUBJECT}: A Hong Kong egg waffle vendor cart
{DETAILS}: A compact street vendor cart with a distinctive egg waffle iron visible on the counter, golden bubble-shaped waffles displayed on the shelf. Toppings in small containers (chocolate, strawberry, matcha). The cart has a striped awning in gold and red, a small illuminated "Egg Waffle" sign in English and "雞蛋仔" in Chinese neon. A stack of paper cones for serving. The cart sits on small wheels.
```

**15. Milk Tea Shop** (`shops/milk-tea-shop.png`)
- Subject: A classic HK-style milk tea (silk stocking tea) stall
```
{SUBJECT}: A traditional Hong Kong milk tea stall
{DETAILS}: A small enclosed kiosk with a service window, showing the iconic silk-stocking tea filter and metal teapots behind the counter. Cups stacked in rows. A vintage-style signboard reads "絲襪奶茶" (Silk Stocking Milk Tea). The exterior is tiled in classic HK cafe green-and-white tiles. A small neon "OPEN" sign glows in the window. A laminated menu with prices is taped to the glass.
```

**16. Souvenir Pagoda** (`shops/souvenir-pagoda.png`)
- Subject: A souvenir shop shaped like a miniature Chinese pagoda
```
{SUBJECT}: A souvenir shop built in the shape of a miniature Chinese pagoda
{DETAILS}: A small 3-tier pagoda structure with traditional upturned eaves and red-and-gold paint. The ground floor is open as a shop with shelves of souvenirs visible — miniature junk boats, dragon figurines, folding fans, T-shirts. A "Souvenirs" sign hangs from the second tier in English and Chinese. Red lanterns at each corner. Gold neon accent strips along the eaves.
```

**17. Bubble Tea Bar** (`shops/bubble-tea-bar.png`) - ALREADY DONE
- Using AI-generated art from Dropbox (img3.png).

**18. Noodle House** (`shops/noodle-house.png`)
- Subject: A noodle shop with visible kitchen
```
{SUBJECT}: A Hong Kong noodle house with open kitchen
{DETAILS}: A compact restaurant stall with the kitchen visible through a wide service window. A chef pulls hand-made noodles behind the counter. Stacks of noodle bowls. Hanging menu boards with Chinese calligraphy and photos of dishes. The exterior has classic red-and-gold HK restaurant styling with a "Noodle House" (麵家) neon sign. Steam clouds rising from boiling pots.
```

**19. Ice Cream Junk** (`shops/ice-cream-junk.png`)
- Subject: An ice cream stall shaped like a mini junk boat
```
{SUBJECT}: An ice cream stall built from a mini Hong Kong junk boat hull
{DETAILS}: A small junk boat hull repurposed as an ice cream counter, with the hull forming the base and a red sail used as a shade awning. Glass display case showing colorful ice cream flavors. Waffle cone holders. A "冰淇淋" (Ice Cream) sign in neon pink attached to the mast. Wooden hull with ornate carvings visible on the side. Small anchor decoration.
```

**20. First Aid Station** (`shops/first-aid-station.png`)
- Subject: A park first-aid/medical station
```
{SUBJECT}: A small park first-aid station with Red Cross styling
{DETAILS}: A clean white kiosk with a green cross symbol and "First Aid" / "急救站" signage. A small service window with a nurse character visible inside. Medical supply shelves visible through the window. Clean, well-lit interior glow. The exterior has a small covered waiting bench. AED and fire extinguisher mounted on the outside wall. Subtle green neon cross illuminated at night.
```

---

### DECORATIONS (6)

**21. Lantern** (`decorations/lantern.png`) - ALREADY DONE
- Using AI-generated art from Dropbox (img4.png).

**22. Bamboo Garden** (`decorations/bamboo-garden.png`)
```
{SUBJECT}: A small decorative bamboo garden patch
{DETAILS}: A cluster of tall green bamboo stalks growing from a raised stone planter with ornamental rocks. Some bamboo shoots are young and bright green, others are mature and darker. A small wooden "Garden" (園) sign. Subtle ground-level accent lights in warm gold. Fallen bamboo leaves scattered on the stone base.
```

**23. Fountain** (`decorations/fountain.png`)
```
{SUBJECT}: A decorative Chinese-themed water fountain
{DETAILS}: A round stone fountain with a central dragon sculpture spouting water from its mouth. The water catches cyan neon light from below (underwater LEDs). The stone basin has traditional cloud-pattern carvings. A gentle mist hangs around the water surface. Koi fish visible in the shallow pool. The base is hexagonal granite.
```

**24. Neon Sign** (`decorations/neon-sign.png`)
```
{SUBJECT}: A classic Hong Kong neon street sign
{DETAILS}: A tall vertical neon sign on a metal bracket, styled like the iconic Mong Kok neon signage. Chinese characters glow in hot-pink and cyan. The sign reads something evocative like "Theme Park" (主題公園) vertically in traditional neon tube lettering. The metal bracket is rusted. A warm glow spills from the tubes. Some tubes flicker slightly. The sign stands on a simple pole mount.
```

**25. Bonsai Tree** (`decorations/bonsai-tree.png`)
```
{SUBJECT}: An ornamental bonsai tree on a stone pedestal
{DETAILS}: A carefully pruned Chinese penjing (bonsai) tree with a twisted trunk and tiered foliage canopy. The tree sits on an ornate stone pedestal with carved lion-paw feet. A tiny red ribbon is tied around the trunk for luck. Warm golden spotlight illuminates the tree from below. Moss grows on the pedestal base. A small bronze plaque identifies the species.
```

**26. Stone Lion** (`decorations/stone-lion.png`)
```
{SUBJECT}: A traditional Chinese guardian lion (foo dog) stone statue
{DETAILS}: A carved stone guardian lion (石獅子) in the traditional pose — one paw on an orb, fierce expression with curly mane. The stone is weathered grey granite with moss in the crevices. Gold-painted accents on the orb and the base platform. Subtle warm uplighting from a recessed ground light. The base is a square granite pedestal with Chinese text carved into it.
```

---

### CHARACTERS

**27. Guest** (`characters/guest.png`) - ALREADY DONE
- Using AI-generated art from Dropbox (img5.png).

**28. Janitor** (`characters/janitor-green.png`)
```
{SUBJECT}: A theme park janitor character in isometric view
{DETAILS}: A small human figure wearing a green uniform with a cap, pushing a wheeled trash bin. Holding a broom. The uniform has a small park logo patch. Friendly expression. Green colour scheme matches the park's janitorial staff colour coding. Simple but recognisable at small scale.
```

**29. Mechanic** (`characters/mechanic-orange.png`)
```
{SUBJECT}: A theme park ride mechanic character in isometric view
{DETAILS}: A small human figure wearing an orange jumpsuit/coveralls with tool belt. Holding a wrench. Hard hat with a headlamp. The jumpsuit has grease stains. Orange colour scheme matches park mechanic colour coding. Utility belt with visible tools.
```

**30. Security Guard** (`characters/security-blue.png`)
```
{SUBJECT}: A theme park security guard character in isometric view
{DETAILS}: A small human figure wearing a navy blue security uniform with peaked cap. Walkie-talkie on shoulder strap. Flashlight on belt. Badge visible on chest. Professional stance. Blue colour scheme matches park security colour coding.
```

**31. Entertainer** (`characters/entertainer-purple.png`)
```
{SUBJECT}: A theme park entertainer character in isometric view
{DETAILS}: A small human figure in a colorful purple costume with theatrical flair — top hat, bow tie, and a cape. Holding a magic wand or balloon animal. Exaggerated happy expression. Purple colour scheme matches park entertainer colour coding. Slightly more whimsical than other staff.
```

---

## What You Need to Generate

### Priority Order

1. **Rides (11 remaining)** — these are the centerpiece of every screenshot and
   the first thing players build. They need to look impressive. Replace all 11
   Blender procedural sprites.

2. **Shops (6 remaining)** — visible on every path, players build many of these.

3. **Staff characters (4 new)** — small but add life to the park. Currently not
   rendered as sprites at all.

4. **Decorations (4 remaining)** — nice-to-have, fill visual gaps. The lantern
   is already done.

### Image Generation Settings

- **Model:** Use the best available (Midjourney v6, DALL-E 3, Flux Pro, Ideogram
  2.0 — whichever produces the most consistent isometric game assets)
- **Negative prompt (if supported):** "pixel art, low-poly, cartoon, chibi,
  flat shading, white background, multiple objects, text overlay, watermark"
- **Aspect ratio:** 1:1 (square)
- **Resolution:** Highest available, minimum 1024x1024
- **Background:** Dark/black (for easy transparent extraction)

### Batch Workflow

1. Generate all 11 ride images first as a batch
2. Send me the raw images (Dropbox folder or direct upload)
3. I'll run them through the processing pipeline (background removal, autocrop,
   resize, rename) and wire them into the game
4. We'll review together, then do shops, then staff, then decorations

### Consistency Tips

- **Same prompt prefix** for every asset — use the Master Prompt Template above
- **Same lighting angle** — golden hour from the west, neon accents
- **Same perspective** — isometric 3/4 view, camera south-east
- **Same dark background** — makes extraction consistent
- **Generate 2-3 variants of each** and pick the best one
- If your model supports style references, use img2 (ferris wheel) or img3
  (bubble tea bar) as the style anchor for all remaining assets

---

## Processing Pipeline

Once you upload raw images, I run:

```bash
python3 ~/incoming-art/process.py
```

This script:
1. Flood-fill removes the dark background (corner-seeded)
2. Auto-crops to the subject bounding box
3. Adds small padding (4%)
4. Resizes to target dimensions (1024 for rides, 768 for shops, etc.)
5. Saves to the correct filename in `public/sprites/`

The renderer automatically picks up new sprites by filename convention —
`/sprites/rides/{definition-id}.png`, `/sprites/shops/{definition-id}.png`, etc.

---

## File Naming Convention

Every file must match its entity `id` from the game data files:

| Entity ID                     | File Path                                           |
|-------------------------------|-----------------------------------------------------|
| `dragon-coaster`              | `public/sprites/rides/dragon-coaster.png`           |
| `junk-boat-cruise`            | `public/sprites/rides/junk-boat-cruise.png`         |
| `peak-tram-drop`              | `public/sprites/rides/peak-tram-drop.png`           |
| `dim-sum-spinner`             | `public/sprites/rides/dim-sum-spinner.png`          |
| `neon-night-flyer`            | `public/sprites/rides/neon-night-flyer.png`         |
| `temple-garden-train`         | `public/sprites/rides/temple-garden-train.png`      |
| `harbour-ferris-wheel`        | `public/sprites/rides/harbour-ferris-wheel.png`     |
| `typhoon-twister`             | `public/sprites/rides/typhoon-twister.png`          |
| `bamboo-scaffold-climb`       | `public/sprites/rides/bamboo-scaffold-climb.png`    |
| `lion-dance-carousel`         | `public/sprites/rides/lion-dance-carousel.png`      |
| `star-ferry-splash`           | `public/sprites/rides/star-ferry-splash.png`        |
| `kowloon-walled-city-maze`    | `public/sprites/rides/kowloon-walled-city-maze.png` |
| `dai-pai-dong`                | `public/sprites/shops/dai-pai-dong.png`             |
| `egg-waffle-stand`            | `public/sprites/shops/egg-waffle-stand.png`         |
| `milk-tea-shop`               | `public/sprites/shops/milk-tea-shop.png`            |
| `souvenir-pagoda`             | `public/sprites/shops/souvenir-pagoda.png`          |
| `bubble-tea-bar`              | `public/sprites/shops/bubble-tea-bar.png`           |
| `noodle-house`                | `public/sprites/shops/noodle-house.png`             |
| `ice-cream-junk`              | `public/sprites/shops/ice-cream-junk.png`           |
| `first-aid-station`           | `public/sprites/shops/first-aid-station.png`        |
| `lantern`                     | `public/sprites/decorations/lantern.png`            |
| `bamboo-garden`               | `public/sprites/decorations/bamboo-garden.png`      |
| `fountain`                    | `public/sprites/decorations/fountain.png`           |
| `neon-sign`                   | `public/sprites/decorations/neon-sign.png`          |
| `bonsai-tree`                 | `public/sprites/decorations/bonsai-tree.png`        |
| `stone-lion`                  | `public/sprites/decorations/stone-lion.png`         |
