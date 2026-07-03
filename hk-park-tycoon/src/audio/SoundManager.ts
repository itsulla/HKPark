// =============================================================================
// HK Theme Park Tycoon - Sound Manager (Howler)
// =============================================================================
//
// Small synthesized UI/feedback sounds (public/audio/, CC0 — generated with
// ffmpeg) plus a soft ambient night-city loop. Browsers block audio until the
// first user gesture, so everything routes through unlock-on-first-interaction.
// Mute state persists in localStorage; toggle with the M key.
// =============================================================================

import { Howl, Howler } from 'howler';

type SoundName =
  | 'click'
  | 'build'
  | 'demolish'
  | 'cash'
  | 'error'
  | 'success'
  | 'break';

const MUTE_KEY = 'hk-park-muted';

class SoundManagerImpl {
  private sounds: Partial<Record<SoundName, Howl>> = {};
  private ambient: Howl | null = null;
  private unlocked = false;
  private _muted = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this._muted = localStorage.getItem(MUTE_KEY) === '1';
    Howler.mute(this._muted);

    const names: SoundName[] = [
      'click', 'build', 'demolish', 'cash', 'error', 'success', 'break',
    ];
    for (const name of names) {
      this.sounds[name] = new Howl({ src: [`/audio/${name}.mp3`], volume: 0.7 });
    }
    this.ambient = new Howl({
      src: ['/audio/ambient.mp3'],
      loop: true,
      volume: 0.25,
    });

    // Start ambient on the first user interaction (autoplay policy).
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      if (this.ambient && !this.ambient.playing()) this.ambient.play();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  play(name: SoundName): void {
    this.sounds[name]?.play();
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    Howler.mute(this._muted);
    try {
      localStorage.setItem(MUTE_KEY, this._muted ? '1' : '0');
    } catch {
      // localStorage unavailable — mute just won't persist.
    }
    return this._muted;
  }
}

// Singleton; safe to import from anywhere client-side.
const SoundManager = new SoundManagerImpl();
export default SoundManager;
