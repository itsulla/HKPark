'use client';

// =============================================================================
// OnboardingHint — three-step guide for a brand-new park.
// Derives the current step from live state; disappears once the park has a
// path, a ride, and a shop (or when dismissed).
// =============================================================================

import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { TileType } from '../engine/types';

export default function OnboardingHint() {
  const grid = useGameStore((s) => s.grid);
  const rides = useGameStore((s) => s.rides);
  const shops = useGameStore((s) => s.shops);
  const [dismissed, setDismissed] = useState(false);

  const hasPath = useMemo(() => {
    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === TileType.PATH) return true;
      }
    }
    return false;
  }, [grid]);

  const hasRide = Object.keys(rides).length > 0;
  const hasShop = Object.keys(shops).length > 0;

  if (dismissed || (hasPath && hasRide && hasShop)) return null;

  const steps = [
    {
      done: hasPath,
      text: 'Build a path from the park entrance',
      hint: 'Press 2 or click 🛤️ Path, then drag along the ground',
    },
    {
      done: hasRide,
      text: 'Place your first ride next to the path',
      hint: 'Press 3 or click 🎢 Rides and pick one you can afford',
    },
    {
      done: hasShop,
      text: 'Add a shop so guests can eat and drink',
      hint: 'Press 4 or click 🏪 Shops',
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="fixed left-3 top-12 z-[15] w-72 rounded-xl bg-[#1a1a2e]/90 backdrop-blur-md border border-[#08d9d6]/30 shadow-[0_0_24px_rgba(8,217,214,0.15)] p-4 select-none">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#08d9d6]">
          🏗️ Getting started
        </h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-500 hover:text-white text-sm leading-none"
          title="Dismiss"
        >
          &times;
        </button>
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.text} className="flex gap-2 items-start">
            <span
              className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                step.done
                  ? 'bg-green-400 text-[#0a0a1a]'
                  : i === current
                    ? 'bg-[#08d9d6] text-[#0a0a1a] animate-pulse'
                    : 'bg-[#2a2a4a] text-gray-400'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </span>
            <div>
              <div
                className={`text-xs font-medium ${
                  step.done
                    ? 'text-gray-500 line-through'
                    : i === current
                      ? 'text-white'
                      : 'text-gray-400'
                }`}
              >
                {step.text}
              </div>
              {i === current && (
                <div className="text-[10px] text-[#94a3b8] mt-0.5">
                  {step.hint}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
