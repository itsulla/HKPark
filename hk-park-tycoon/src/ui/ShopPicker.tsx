'use client';

import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { ToolType, ShopCategory } from '../engine/types';
import type { ShopDefinition } from '../engine/types';
import shopsData from '../data/shops.json';

const shops = shopsData as ShopDefinition[];

const categories: { value: ShopCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: ShopCategory.FOOD, label: 'Food' },
  { value: ShopCategory.DRINK, label: 'Drink' },
  { value: ShopCategory.SOUVENIR, label: 'Souvenir' },
  { value: ShopCategory.FACILITY, label: 'Facility' },
];

const categoryColors: Record<string, string> = {
  FOOD: 'bg-orange-500/80 text-white',
  DRINK: 'bg-[#08d9d6]/80 text-[#0a0a1a]',
  SOUVENIR: 'bg-purple-500/80 text-white',
  FACILITY: 'bg-[#94a3b8]/60 text-white',
};

export default function ShopPicker({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<ShopCategory | 'ALL'>('ALL');
  const setTool = useGameStore((s) => s.setTool);
  const setPlacementDefinition = useGameStore((s) => s.setPlacementDefinition);
  const money = useGameStore((s) => s.money);

  const filtered = filter === 'ALL' ? shops : shops.filter((s) => s.category === filter);

  function handleSelect(shop: ShopDefinition) {
    setPlacementDefinition(shop.id);
    setTool(ToolType.PLACE_SHOP);
    onClose();
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[500px] max-h-[380px] bg-[#1a1a2e]/95 backdrop-blur-md rounded-xl border border-[#2a2a4a] overflow-hidden flex flex-col animate-slide-up"
      style={{
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4), 0 0 1px rgba(8,217,214,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="text-base">&#x1F3EA;</span>
          <h3 className="text-sm font-bold text-[#f0c040] drop-shadow-[0_0_6px_rgba(240,192,64,0.3)]">
            Select Shop
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

      {/* Shop grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 grid grid-cols-2 gap-2">
        {filtered.map((shop) => {
          const canAfford = money >= shop.cost;
          return (
            <button
              key={shop.id}
              onClick={() => handleSelect(shop)}
              disabled={!canAfford}
              className={`text-left p-3 rounded-lg border transition-all duration-200 group ${
                canAfford
                  ? 'bg-[#16213e]/70 border-[#2a2a4a] hover:border-[#08d9d6]/40 hover:bg-[#16213e] hover:shadow-[0_0_16px_rgba(8,217,214,0.1)]'
                  : 'bg-[#16213e]/30 border-[#2a2a4a]/30 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className={`text-sm font-bold leading-tight transition-colors duration-200 ${canAfford ? 'text-white group-hover:text-[#08d9d6]' : 'text-gray-400'}`}>
                  {shop.name}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-2 flex-shrink-0 uppercase tracking-wider ${
                    categoryColors[shop.category] ?? 'bg-[#2a2a4a] text-white'
                  }`}
                >
                  {shop.category}
                </span>
              </div>

              <div className="text-xs font-mono text-[#f0c040] font-bold mb-2.5">
                HK$ {shop.cost.toLocaleString('en-HK')}
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-[10px] text-[#94a3b8] mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-green-400 font-mono font-semibold">
                    HK$ {shop.revenuePerCustomer}
                  </span>
                  <span>/guest</span>
                </div>
                <span className="font-mono">
                  Stock: {shop.maxStock}
                </span>
              </div>

              {/* Maintenance */}
              <div className="text-[10px] text-[#94a3b8]/70 font-mono pt-1.5 border-t border-[#2a2a4a]/30">
                Maint: <span className="text-red-400/70">HK$ {shop.monthlyMaintenance}/mo</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
