'use client';

// =============================================================================
// Objectives widget: shows the three victory milestones + active park event.
// Collapsible chip in the top-right, under the TopBar.
// =============================================================================

import { useState } from 'react';
import { useGameStore } from '../state/gameStore';

const VICTORY_RATING = 800;
const VICTORY_MONEY = 1_000_000;
const VICTORY_TOTAL_GUESTS = 1_000;

export default function ObjectivesWidget() {
  const parkRating = useGameStore((s) => s.parkRating);
  const money = useGameStore((s) => s.money);
  const totalGuests = useGameStore((s) => s.totalGuestsAllTime);
  const activeEvent = useGameStore((s) => s.activeEvent);
  const victoryAchieved = useGameStore((s) => s.victoryAchieved);
  const daysInDebt = useGameStore((s) => s.daysInDebt);

  const [collapsed, setCollapsed] = useState(false);

  const objectives = [
    {
      label: `Park rating ${VICTORY_RATING}+`,
      progress: Math.min(1, parkRating / VICTORY_RATING),
      done: parkRating >= VICTORY_RATING,
      value: `${Math.round(parkRating)} / ${VICTORY_RATING}`,
    },
    {
      label: `HK$ ${(VICTORY_MONEY / 1_000_000).toFixed(0)}M in the bank`,
      progress: Math.min(1, Math.max(0, money) / VICTORY_MONEY),
      done: money >= VICTORY_MONEY,
      value: `HK$ ${Math.round(Math.max(0, money)).toLocaleString('en-HK')}`,
    },
    {
      label: `${VICTORY_TOTAL_GUESTS.toLocaleString()} lifetime guests`,
      progress: Math.min(1, totalGuests / VICTORY_TOTAL_GUESTS),
      done: totalGuests >= VICTORY_TOTAL_GUESTS,
      value: `${totalGuests.toLocaleString()} / ${VICTORY_TOTAL_GUESTS.toLocaleString()}`,
    },
  ];

  return (
    <div className="fixed top-12 right-3 z-[15] w-60 select-none pointer-events-auto">
      {/* Active event banner */}
      {activeEvent && (
        <div className="mb-1.5 px-3 py-1.5 rounded-lg bg-[#f0c040]/15 border border-[#f0c040]/40 text-[11px] font-semibold text-[#f0c040] shadow-[0_0_12px_rgba(240,192,64,0.15)]">
          ✨ {activeEvent.name} — {activeEvent.daysRemaining}d left
        </div>
      )}

      {/* Debt warning */}
      {daysInDebt > 0 && (
        <div className="mb-1.5 px-3 py-1.5 rounded-lg bg-[#ff2e63]/15 border border-[#ff2e63]/40 text-[11px] font-semibold text-[#ff2e63]">
          ⚠ In debt {daysInDebt}d — bankruptcy at 30d
        </div>
      )}

      <div className="rounded-lg bg-[#1a1a2e]/85 backdrop-blur-md border border-[#2a2a4a] overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-[#94a3b8] hover:text-white transition-colors"
        >
          <span>
            {victoryAchieved ? '🏆 Objectives complete' : '🎯 Objectives'}
          </span>
          <span className="text-[9px]">{collapsed ? '▼' : '▲'}</span>
        </button>

        {!collapsed && (
          <div className="px-3 pb-2.5 space-y-2">
            {objectives.map((obj) => (
              <div key={obj.label}>
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className={obj.done ? 'text-green-400' : 'text-gray-300'}>
                    {obj.done ? '✓ ' : ''}
                    {obj.label}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#0a0a1a]/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      obj.done ? 'bg-green-400' : 'bg-[#08d9d6]'
                    }`}
                    style={{ width: `${obj.progress * 100}%` }}
                  />
                </div>
                <div className="text-[9px] font-mono text-[#94a3b8]/70 mt-0.5">
                  {obj.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
