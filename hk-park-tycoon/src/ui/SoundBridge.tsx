'use client';

// =============================================================================
// SoundBridge — plays feedback sounds off game events, handles the M mute key.
// Renders nothing; mounts once on the game page.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import SoundManager from '../audio/SoundManager';

export default function SoundBridge() {
  const lastNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Seed with the current newest notification so loading a park doesn't
    // replay a stale sound.
    const initial = useGameStore.getState().notifications;
    lastNotifIdRef.current = initial.length
      ? initial[initial.length - 1].id
      : null;

    const unsub = useGameStore.subscribe((state) => {
      const notifs = state.notifications;
      if (!notifs.length) return;
      const newest = notifs[notifs.length - 1];
      if (newest.id === lastNotifIdRef.current) return;
      lastNotifIdRef.current = newest.id;

      const text = newest.message.toLowerCase();
      if (newest.type === 'error') {
        SoundManager.play(text.includes('broke') ? 'break' : 'error');
      } else if (newest.type === 'success') {
        SoundManager.play(text.includes('profit') ? 'cash' : 'success');
      }
      // 'info'/'warning' toasts stay silent — they fire too often.
    });

    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        const muted = SoundManager.toggleMute();
        useGameStore
          .getState()
          .addNotification(muted ? 'Sound muted (M)' : 'Sound on (M)', 'info');
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsub();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
