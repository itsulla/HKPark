'use client';

import { useGameStore } from '../state/gameStore';

interface DistrictPanelProps {
  onClose: () => void;
}

function formatMoney(amount: number): string {
  return `HK$ ${amount.toLocaleString('en-HK')}`;
}

const terrainColors: Record<string, { bg: string; text: string; border: string }> = {
  flat: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  hilly: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/20' },
  coastal: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/20' },
};

export default function DistrictPanel({ onClose }: DistrictPanelProps) {
  const districts = useGameStore((s) => s.districts);
  const money = useGameStore((s) => s.money);
  const unlockDistrict = useGameStore((s) => s.unlockDistrict);

  function handleUnlock(districtId: string) {
    unlockDistrict(districtId);
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-backdrop-fade"
        onClick={onClose}
      />

      {/* Window */}
      <div
        className="relative bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl w-[660px] max-h-[85vh] overflow-y-auto custom-scrollbar animate-modal-enter"
        style={{
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 1px rgba(240,192,64,0.3)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a4a]">
          <div className="flex items-center gap-3">
            <span className="text-xl">&#x1F5FA;&#xFE0F;</span>
            <h2 className="text-lg font-bold text-[#f0c040] drop-shadow-[0_0_8px_rgba(240,192,64,0.3)]">
              District Map
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#0a0a1a]/60 border border-[#2a2a4a] hover:bg-[#ff2e63]/20 hover:border-[#ff2e63]/40 hover:text-[#ff2e63] text-[#94a3b8] flex items-center justify-center text-base font-bold transition-all duration-200 hover:shadow-[0_0_12px_rgba(255,46,99,0.2)]"
          >
            &times;
          </button>
        </div>

        {/* District grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {districts.map((district) => {
            const canAfford = money >= district.unlockCost;
            const terrain = terrainColors[district.terrain] ?? terrainColors.flat;

            return (
              <div
                key={district.id}
                className={`relative p-4 rounded-lg border transition-all duration-300 overflow-hidden ${
                  district.unlocked
                    ? 'bg-[#16213e]/70 border-[#08d9d6]/25 district-unlocked-glow'
                    : 'bg-[#16213e]/30 border-[#2a2a4a] hover:border-[#2a2a4a]/80'
                }`}
              >
                {/* Lock overlay for locked districts */}
                {!district.unlocked && (
                  <div className="absolute inset-0 bg-[#0a0a1a]/30 flex items-center justify-center pointer-events-none z-[1]">
                    <span
                      className="text-4xl opacity-10 select-none"
                      style={{ filter: 'grayscale(1)' }}
                    >
                      &#x1F512;
                    </span>
                  </div>
                )}

                {/* Content (above lock overlay) */}
                <div className="relative z-[2]">
                  {/* Name + unlocked badge */}
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className={`text-sm font-bold ${district.unlocked ? 'text-white' : 'text-gray-300'}`}>
                      {district.name}
                    </h3>
                    {district.unlocked && (
                      <span
                        className="text-[9px] text-[#08d9d6] font-bold px-2 py-0.5 bg-[#08d9d6]/10 rounded-full border border-[#08d9d6]/25 uppercase tracking-wider"
                        style={{ textShadow: '0 0 8px rgba(8,217,214,0.3)' }}
                      >
                        UNLOCKED
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#94a3b8] mb-3 leading-relaxed">
                    {district.description}
                  </p>

                  {/* Meta badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {/* Terrain */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${terrain.bg} ${terrain.text} ${terrain.border} border`}
                    >
                      {district.terrain}
                    </span>

                    {/* Size */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#94a3b8] border border-[#2a2a4a] font-mono">
                      {district.tiles.w} x {district.tiles.h}
                    </span>

                    {/* Guest multiplier */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold ${
                        district.guestMultiplier > 1
                          ? 'bg-[#f0c040]/10 text-[#f0c040] border-[#f0c040]/20'
                          : district.guestMultiplier < 1
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-white/5 text-[#94a3b8] border-[#2a2a4a]'
                      }`}
                    >
                      {district.guestMultiplier}x guests
                    </span>
                  </div>

                  {/* Cost / Unlock */}
                  {!district.unlocked && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#2a2a4a]/50">
                      <span className="text-xs font-mono text-[#f0c040] font-bold">
                        {formatMoney(district.unlockCost)}
                      </span>
                      <button
                        onClick={() => handleUnlock(district.id)}
                        disabled={!canAfford}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                          canAfford
                            ? 'bg-[#ff2e63]/15 text-[#ff2e63] border border-[#ff2e63]/30 hover:bg-[#ff2e63]/25 hover:shadow-[0_0_16px_rgba(255,46,99,0.2)] neon-pulse'
                            : 'bg-[#2a2a4a]/30 text-[#94a3b8]/40 border border-[#2a2a4a]/30 cursor-not-allowed'
                        }`}
                      >
                        &#x1F513; Unlock
                      </button>
                    </div>
                  )}

                  {/* Unlocked accent bar */}
                  {district.unlocked && (
                    <div className="mt-2 pt-2 border-t border-[#08d9d6]/10">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#08d9d6]/60">
                        <span>&#x2713;</span>
                        <span>Available for construction</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
