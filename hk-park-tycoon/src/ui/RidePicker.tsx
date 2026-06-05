'use client';

import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { ToolType, RideCategory } from '../engine/types';
import type { RideDefinition } from '../engine/types';
import ridesData from '../data/rides.json';

const rides = ridesData as RideDefinition[];

const categories: { value: RideCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: RideCategory.THRILL, label: 'Thrill' },
  { value: RideCategory.FAMILY, label: 'Family' },
  { value: RideCategory.GENTLE, label: 'Gentle' },
  { value: RideCategory.WATER, label: 'Water' },
  { value: RideCategory.TRANSPORT, label: 'Transport' },
];

const categoryColors: Record<string, string> = {
  THRILL: 'bg-[#ff2e63]/80 text-white',
  FAMILY: 'bg-[#08d9d6]/80 text-[#0a0a1a]',
  GENTLE: 'bg-green-500/80 text-white',
  WATER: 'bg-cyan-500/80 text-white',
  TRANSPORT: 'bg-[#f0c040]/80 text-[#0a0a1a]',
};

function RatingBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const gradientClass =
    label === 'E'
      ? 'neon-bar-green'
      : label === 'I'
        ? 'neon-bar-orange'
        : 'neon-bar-red';

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-[#94a3b8] w-3 font-mono font-bold">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full ${gradientClass} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[#94a3b8] font-mono w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function RidePicker({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<RideCategory | 'ALL'>('ALL');
  const setTool = useGameStore((s) => s.setTool);
  const setPlacementDefinition = useGameStore((s) => s.setPlacementDefinition);
  const money = useGameStore((s) => s.money);

  const filtered = filter === 'ALL' ? rides : rides.filter((r) => r.category === filter);

  function handleSelect(ride: RideDefinition) {
    setPlacementDefinition(ride.id);
    setTool(ToolType.PLACE_RIDE);
    onClose();
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[580px] max-h-[420px] bg-[#1a1a2e]/95 backdrop-blur-md rounded-xl border border-[#2a2a4a] overflow-hidden flex flex-col animate-slide-up"
      style={{
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4), 0 0 1px rgba(8,217,214,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="text-base">&#x1F3A2;</span>
          <h3 className="text-sm font-bold text-[#f0c040] drop-shadow-[0_0_6px_rgba(240,192,64,0.3)]">
            Select Ride
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[#0a0a1a]/40 border border-[#2a2a4a] hover:bg-[#ff2e63]/20 hover:border-[#ff2e63]/40 hover:text-[#ff2e63] text-[#94a3b8] flex items-center justify-center text-sm transition-all duration-200"
        >
          &times;
        </button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#2a2a4a]/50">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
              filter === cat.value
                ? 'bg-[#08d9d6]/15 text-[#08d9d6] ring-1 ring-[#08d9d6]/50 shadow-[0_0_8px_rgba(8,217,214,0.15)]'
                : 'bg-[#16213e] text-[#94a3b8] hover:text-white hover:bg-[#16213e]/90'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Ride grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 grid grid-cols-2 gap-2">
        {filtered.map((ride) => {
          const canAfford = money >= ride.baseCost;
          return (
            <button
              key={ride.id}
              onClick={() => handleSelect(ride)}
              disabled={!canAfford}
              className={`text-left p-3 rounded-lg border transition-all duration-200 group ${
                canAfford
                  ? 'bg-[#16213e]/70 border-[#2a2a4a] hover:border-[#08d9d6]/40 hover:bg-[#16213e] hover:shadow-[0_0_16px_rgba(8,217,214,0.1)]'
                  : 'bg-[#16213e]/30 border-[#2a2a4a]/30 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className={`text-sm font-bold leading-tight transition-colors duration-200 ${canAfford ? 'text-white group-hover:text-[#08d9d6]' : 'text-gray-400'}`}>
                  {ride.name}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-2 flex-shrink-0 uppercase tracking-wider ${
                    categoryColors[ride.category] ?? 'bg-[#2a2a4a] text-white'
                  }`}
                >
                  {ride.category}
                </span>
              </div>

              <div className="text-xs font-mono text-[#f0c040] font-bold mb-2">
                HK$ {ride.baseCost.toLocaleString('en-HK')}
              </div>

              <div className="space-y-0.5 mb-2">
                <RatingBar label="E" value={ride.baseExcitement} max={10} />
                <RatingBar label="I" value={ride.baseIntensity} max={10} />
                <RatingBar label="N" value={ride.baseNausea} max={10} />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#94a3b8]">
                <span className="font-mono">
                  {ride.footprint.w}x{ride.footprint.h}
                </span>
                <span className="font-mono">Cap: {ride.capacity}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
