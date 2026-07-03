"""Generate final HK Theme Park Tycoon sprites via OpenRouter image models.

Uses google/gemini-3.1-flash-image with the AI ferris wheel as a style
reference on every request, so all 27 assets share one visual identity.

Usage:
  python3 generate.py test          # one entity, one variant (sanity check)
  python3 generate.py all           # full batch: 27 entities x 3 variants
  python3 generate.py retry a b c   # regenerate specific entities
"""
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

KEY = Path.home().joinpath(".config/openrouter.key").read_text().strip()
MODEL = "google/gemini-3.1-flash-image"
STYLE_REF = Path.home() / "incoming-art/img2.png"  # original AI ferris wheel
OUT = Path.home() / "ai-art/raw"
OUT.mkdir(parents=True, exist_ok=True)
VARIANTS = 3

MASTER = (
    "Create a video-game asset in the EXACT same painted illustration art style, "
    "color palette, lighting mood, and isometric three-quarter perspective as the "
    "reference image provided. {subject}. {details} "
    "Neon accent lighting in cyan (#08d9d6), hot-pink (#ff2e63) and gold (#f0c040) "
    "built into the structure, with a warm golden-hour key light. Hong Kong "
    "neon-noir theme park setting. "
    "STRICT REQUIREMENTS: one single isolated object, centered, filling about 85% "
    "of the frame; plain flat very dark navy background (#0a0a16) with NO ground "
    "scene, NO streets, NO other buildings, NO people crowds around it; no text, "
    "no watermark, no signature; highly detailed."
)

ENTITIES = {
    # ---- rides (11) ----
    "dragon-coaster": (
        "A looping roller coaster whose lead car is a Chinese dragon head",
        "Crimson-red dragon head with golden horns and glowing cyan eyes pulling six scale-covered cars along a twisting golden track with one dramatic loop. Hot-pink neon strips along the rails.",
    ),
    "junk-boat-cruise": (
        "A traditional Hong Kong junk boat water ride in a short canal",
        "Classic junk boat with ribbed red sails and ornate carved wooden hull, floating on dark water that reflects cyan and pink neon. Small stone canal walls and red paper lanterns strung above.",
    ),
    "peak-tram-drop": (
        "A tall drop-tower ride themed as the Victoria Peak funicular tram",
        "Narrow vertical tower clad in bamboo-scaffold lattice with a green-and-cream tram car as the gondola near the top. Cyan neon height markers up the tower edge, red beacon at the summit, small Victorian station at the base.",
    ),
    "dim-sum-spinner": (
        "A spinning teacup-style ride with bamboo dim sum steamer baskets as pods",
        "Round platform shaped like a giant dim sum tray holding six bamboo steamer baskets as passenger seats, cute dumplings peeking over rims, giant crossed chopsticks as the central spindle, steam wisps, jade and gold neon rim.",
    ),
    "neon-night-flyer": (
        "A sleek high-speed inverted roller coaster drenched in neon light",
        "Matte-black track banking through a dramatic curve with riders hanging below in glowing seats, intense cyan and magenta LED strips tracing the entire track, light streaks suggesting speed.",
    ),
    "temple-garden-train": (
        "A scenic miniature steam train ride through a tiny Chinese temple garden",
        "Small green-and-gold locomotive with three open passenger cars passing a miniature stone moon gate, a red arched bridge over a koi pond, and bonsai trees, gold lanterns on bamboo poles along the track. Long low composition.",
    ),
    "typhoon-twister": (
        "A typhoon-themed pendulum top-spin thrill ride",
        "Massive chrome swing arm holding a spinning circular passenger platform, base sculpted as storm waves, cyan LED rain-curtain strips down the arm, red typhoon warning beacons, wind-torn banners. Tall dynamic composition.",
    ),
    "bamboo-scaffold-climb": (
        "A tall climbing attraction built from Hong Kong bamboo scaffolding",
        "Authentic bamboo poles lashed with cord forming a towering climb structure with platforms, rope bridges and cargo nets, neon-green glowing safety nets, red calligraphy banner. Very tall narrow composition.",
    ),
    "lion-dance-carousel": (
        "A carousel whose mounts are colorful Chinese lion dance figures",
        "Ornate carousel with a Chinese temple roof canopy with upturned eaves and dragon finials, riders on red-gold, green-silver and white-pink lion dance figures, mirrored central column with red lanterns, warm golden bulbs around the rim.",
    ),
    "star-ferry-splash": (
        "A log flume water ride with Hong Kong Star Ferry boats",
        "Green-and-white double-decker Star Ferry replica boat plunging down a steep water flume with a big splash, miniature harbour skyline silhouettes along the channel, blue-lit cascading water, nautical rope entrance arch.",
    ),
    "kowloon-walled-city-maze": (
        "A walk-through maze attraction themed as the Kowloon Walled City",
        "Dense block of stacked concrete tenement buildings forming a maze, air conditioners, tangled wires, laundry lines between windows, glowing Chinese neon signs in cyan and pink, a dark narrow alley entrance with fog.",
    ),
    # ---- shops (7) ----
    "dai-pai-dong": (
        "A traditional Hong Kong dai pai dong street food stall",
        "Open-front green metal stall with corrugated awning, wok station with visible flame, roast ducks hanging in the window, plastic stools, hand-painted Chinese menu board, red neon sign, steam rising.",
    ),
    "egg-waffle-stand": (
        "A Hong Kong egg waffle vendor cart",
        "Compact wheeled cart with golden bubble waffles on display, waffle irons on the counter, topping jars, striped gold-and-red awning, small neon sign with Chinese characters, paper cones stacked.",
    ),
    "milk-tea-shop": (
        "A classic Hong Kong milk tea kiosk",
        "Small kiosk tiled in vintage green-and-white cha chaan teng tiles, service window showing metal teapots and a silk-stocking tea filter, stacked cups, glowing OPEN sign, laminated menu taped to the glass.",
    ),
    "souvenir-pagoda": (
        "A souvenir shop shaped like a small three-tier Chinese pagoda",
        "Red-and-gold pagoda with upturned eaves, open ground floor showing shelves of souvenirs (mini junk boats, dragon figurines, folding fans), red lanterns at each corner, gold neon strips along the eaves.",
    ),
    "noodle-house": (
        "A Hong Kong noodle house with an open kitchen front",
        "Compact restaurant stall with a wide service window revealing a chef pulling noodles, stacked bowls, steam clouds from boiling pots, hanging menu boards with photos, red-and-gold facade, glowing noodle-bowl neon sign.",
    ),
    "ice-cream-junk": (
        "An ice cream stall built from a mini junk boat hull",
        "Small wooden junk boat hull converted to an ice cream counter, red sail as shade awning, glass case of colorful ice cream tubs, waffle cones, pink neon ice-cream sign on the mast, tiny anchor.",
    ),
    "first-aid-station": (
        "A small clean park first-aid station kiosk",
        "White kiosk with a glowing green cross, service window with medical shelves visible inside, small covered bench, mounted fire extinguisher, soft clean interior light. Reads instantly as medical aid.",
    ),
    # ---- decorations (5) ----
    "bamboo-garden": (
        "A small ornamental bamboo garden planter",
        "Cluster of tall green bamboo stalks in a raised stone planter with ornamental rocks, some young bright shoots, warm gold ground-accent lights, a small wooden garden sign.",
    ),
    "fountain": (
        "A round Chinese dragon fountain",
        "Stone fountain with a central dragon sculpture spouting water, cyan underwater LED glow, cloud-pattern carvings on the hexagonal granite basin, gentle mist, koi visible in the pool.",
    ),
    "neon-sign": (
        "A classic Hong Kong vertical neon street sign on a pole",
        "Tall vertical neon signboard on a rusted metal bracket and pole, glowing Chinese characters in hot-pink and cyan tube lettering, slight flicker glow, Mong Kok style.",
    ),
    "bonsai-tree": (
        "An ornamental penjing bonsai tree on a stone pedestal",
        "Carefully pruned bonsai with twisted trunk and tiered foliage, ornate stone pedestal with carved lion-paw feet, tiny red lucky ribbon on the trunk, warm uplight, moss on the base.",
    ),
    "stone-lion": (
        "A traditional Chinese guardian lion statue",
        "Weathered grey granite foo dog with curly mane, one paw on a gold orb, moss in crevices, gold-painted accents, square carved pedestal, warm ground uplight.",
    ),
    # ---- staff characters (4) ----
    "janitor-green": (
        "A friendly theme park janitor character, full body",
        "Cartoon-proportioned worker in a bright GREEN uniform and cap pushing a small wheeled trash bin with a broom, park logo patch, cheerful face. Full body visible, standing on nothing (no ground).",
    ),
    "mechanic-orange": (
        "A theme park ride mechanic character, full body",
        "Cartoon-proportioned mechanic in a bright ORANGE jumpsuit with tool belt, hard hat with headlamp, holding a big wrench, grease smudges, confident grin. Full body visible, no ground.",
    ),
    "security-blue": (
        "A theme park security guard character, full body",
        "Cartoon-proportioned guard in a navy BLUE uniform with peaked cap, walkie-talkie on shoulder, badge on chest, flashlight on belt, calm professional stance. Full body visible, no ground.",
    ),
    "entertainer-purple": (
        "A theme park entertainer character, full body",
        "Cartoon-proportioned performer in a flamboyant PURPLE costume with top hat, bow tie and short cape, holding a balloon animal, big theatrical smile. Full body visible, no ground.",
    ),
}


def style_ref_b64() -> str:
    return base64.b64encode(STYLE_REF.read_bytes()).decode()


REF_B64 = style_ref_b64()


def generate(entity: str, variant: int) -> bool:
    subject, details = ENTITIES[entity]
    prompt = MASTER.format(subject=subject, details=details)
    body = {
        "model": MODEL,
        "modalities": ["image", "text"],
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{REF_B64}"},
                    },
                ],
            }
        ],
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            resp = json.loads(r.read())
    except Exception as e:
        print(f"  FAIL {entity} v{variant}: {e}", flush=True)
        return False
    try:
        images = resp["choices"][0]["message"].get("images") or []
        if not images:
            print(f"  FAIL {entity} v{variant}: no image in response "
                  f"({str(resp)[:150]})", flush=True)
            return False
        data_url = images[0]["image_url"]["url"]
        b64 = data_url.split(",", 1)[1]
        dest = OUT / f"{entity}-v{variant}.png"
        dest.write_bytes(base64.b64decode(b64))
        print(f"  OK {entity} v{variant} ({dest.stat().st_size // 1024}KB)", flush=True)
        return True
    except Exception as e:
        print(f"  FAIL {entity} v{variant}: parse error {e}", flush=True)
        return False


def run(entities: list[str], variants: int) -> None:
    total = len(entities) * variants
    done = 0
    for entity in entities:
        for v in range(1, variants + 1):
            dest = OUT / f"{entity}-v{v}.png"
            if dest.exists():
                done += 1
                continue
            ok = generate(entity, v)
            if not ok:
                time.sleep(3)
                generate(entity, v)  # one retry
            done += 1
            print(f"  progress {done}/{total}", flush=True)
            time.sleep(1)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode == "test":
        generate("dai-pai-dong", 0)
    elif mode == "retry":
        run(sys.argv[2:], VARIANTS)
    else:
        run(list(ENTITIES), VARIANTS)
