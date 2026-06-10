// =============================================================================
// HK Theme Park Tycoon - Ambient Layer (day/night cycle + weather FX)
// =============================================================================
//
// A SCREEN-SPACE overlay (added to the stage above the world container) that
// provides:
//   - A slow day/night tint cycle. Nights go deep navy-blue, letting the
//     neon-noir art glow; days stay clear.
//   - Weather effects: rain/typhoon darkening + animated rain streaks.
//
// One game day is only 30 ticks (~3s real time), which would strobe if mapped
// 1:1, so the visual cycle runs over AMBIENT_CYCLE_TICKS instead.
// =============================================================================

import { Container, Graphics } from 'pixi.js';
import { Weather } from '../../engine/types';

/** Ticks for one full visual day/night cycle (~20 game days). */
const AMBIENT_CYCLE_TICKS = 600;

/** Max darkness of the night tint (0 = none, 1 = black). */
const NIGHT_MAX_ALPHA = 0.38;
const NIGHT_COLOR = 0x0a1030;

const RAIN_COLOR = 0xa8c8e8;
const RAIN_COUNT_RAIN = 90;
const RAIN_COUNT_TYPHOON = 220;

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

export class AmbientLayer extends Container {
  private nightOverlay: Graphics;
  private weatherOverlay: Graphics;
  private rainGfx: Graphics;
  private drops: RainDrop[] = [];

  private screenW = 0;
  private screenH = 0;

  constructor() {
    super();
    // Don't block clicks — this overlay is purely visual.
    this.eventMode = 'none';
    this.nightOverlay = new Graphics();
    this.weatherOverlay = new Graphics();
    this.rainGfx = new Graphics();
    this.addChild(this.nightOverlay);
    this.addChild(this.weatherOverlay);
    this.addChild(this.rainGfx);
  }

  private rebuildOverlays(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.nightOverlay.clear();
    this.nightOverlay.rect(0, 0, w, h);
    this.nightOverlay.fill({ color: NIGHT_COLOR });
    this.weatherOverlay.clear();
    this.weatherOverlay.rect(0, 0, w, h);
    this.weatherOverlay.fill({ color: 0x303a50 });
  }

  private ensureDrops(count: number): void {
    while (this.drops.length < count) {
      this.drops.push({
        x: Math.random() * this.screenW,
        y: Math.random() * this.screenH,
        speed: 9 + Math.random() * 8,
        len: 10 + Math.random() * 14,
      });
    }
    if (this.drops.length > count) {
      this.drops.length = count;
    }
  }

  /**
   * Update the ambient overlay. Call once per frame.
   *
   * @param tick    current game tick (drives the day/night cycle)
   * @param weather current weather
   * @param w       canvas width in CSS pixels
   * @param h       canvas height in CSS pixels
   * @param paused  when true, rain still animates but the cycle holds
   */
  update(tick: number, weather: Weather, w: number, h: number): void {
    if (w !== this.screenW || h !== this.screenH) {
      this.rebuildOverlays(w, h);
    }

    // --- Day/night tint: smooth sinusoid; phase 0 = noon, 0.5 = midnight ---
    const phase = (tick % AMBIENT_CYCLE_TICKS) / AMBIENT_CYCLE_TICKS;
    // cos starts at 1 (noon, no tint) and dips to -1 (midnight, max tint).
    const nightAmount = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    this.nightOverlay.alpha = nightAmount * NIGHT_MAX_ALPHA;

    // --- Weather darkening + rain ---
    let rainCount = 0;
    if (weather === Weather.RAIN) {
      this.weatherOverlay.alpha = 0.18;
      rainCount = RAIN_COUNT_RAIN;
    } else if (weather === Weather.TYPHOON_WARNING) {
      this.weatherOverlay.alpha = 0.26;
      rainCount = Math.floor(RAIN_COUNT_RAIN / 2);
    } else if (weather === Weather.TYPHOON) {
      this.weatherOverlay.alpha = 0.42;
      rainCount = RAIN_COUNT_TYPHOON;
    } else {
      this.weatherOverlay.alpha = 0;
    }

    this.rainGfx.clear();
    if (rainCount > 0 && this.screenW > 0) {
      this.ensureDrops(rainCount);
      const windX = weather === Weather.TYPHOON ? 6 : 2;
      for (const drop of this.drops) {
        drop.y += drop.speed;
        drop.x += windX;
        if (drop.y > this.screenH) {
          drop.y = -drop.len;
          drop.x = Math.random() * this.screenW;
        }
        if (drop.x > this.screenW) drop.x -= this.screenW;
        this.rainGfx.moveTo(drop.x, drop.y);
        this.rainGfx.lineTo(drop.x - windX * 1.5, drop.y - drop.len);
      }
      this.rainGfx.stroke({
        color: RAIN_COLOR,
        width: 1,
        alpha: weather === Weather.TYPHOON ? 0.55 : 0.4,
      });
    }
  }
}
