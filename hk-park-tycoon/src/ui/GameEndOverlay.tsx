'use client';

// =============================================================================
// Game-over (bankruptcy) and victory overlays.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../state/gameStore';

export default function GameEndOverlay() {
  const router = useRouter();
  const gameOver = useGameStore((s) => s.gameOver);
  const victoryAchieved = useGameStore((s) => s.victoryAchieved);
  const parkRating = useGameStore((s) => s.parkRating);
  const money = useGameStore((s) => s.money);
  const totalGuests = useGameStore((s) => s.totalGuestsAllTime);
  const date = useGameStore((s) => s.date);

  // Victory is shown once per session, then dismissible (sandbox continues).
  const [victoryDismissed, setVictoryDismissed] = useState(false);

  // If a save is loaded where victory was already achieved, don't re-show it.
  useEffect(() => {
    if (victoryAchieved) return;
    setVictoryDismissed(false);
  }, [victoryAchieved]);

  if (gameOver) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <div className="w-[460px] rounded-2xl border border-[#ff2e63]/40 bg-[#1a1a2e] p-8 text-center shadow-[0_0_60px_rgba(255,46,99,0.25)]">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="text-2xl font-extrabold text-[#ff2e63] mb-3">
            Bankrupt
          </h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            {gameOver.reason}
          </p>
          <div className="text-xs text-[#94a3b8] font-mono mb-6 space-y-1">
            <div>Final park rating: {Math.round(parkRating)}</div>
            <div>Lifetime guests: {totalGuests.toLocaleString()}</div>
            <div>
              Survived until Day {date.day}, Month {date.month}, Year {date.year}
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-lg text-base font-bold text-white bg-[#ff2e63] hover:bg-[#ff2e63]/90 transition-all"
          >
            Back to Main Menu
          </button>
        </div>
      </div>
    );
  }

  if (victoryAchieved && !victoryDismissed) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm">
        <div className="w-[460px] rounded-2xl border border-[#f0c040]/50 bg-[#1a1a2e] p-8 text-center shadow-[0_0_60px_rgba(240,192,64,0.3)]">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-extrabold text-[#f0c040] mb-3">
            Park of the Year!
          </h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Your park hit every milestone — a top-tier rating, a fortune in the
            bank, and over a thousand lifetime guests. Hong Kong&apos;s newest
            landmark is official.
          </p>
          <div className="text-xs text-[#94a3b8] font-mono mb-6 space-y-1">
            <div>Park rating: {Math.round(parkRating)}</div>
            <div>Cash: HK$ {Math.round(money).toLocaleString('en-HK')}</div>
            <div>Lifetime guests: {totalGuests.toLocaleString()}</div>
          </div>
          <button
            onClick={() => setVictoryDismissed(true)}
            className="w-full py-3 rounded-lg text-base font-bold text-[#0a0a1a] bg-[#f0c040] hover:bg-[#f0c040]/90 transition-all"
          >
            Keep Playing
          </button>
        </div>
      </div>
    );
  }

  return null;
}
