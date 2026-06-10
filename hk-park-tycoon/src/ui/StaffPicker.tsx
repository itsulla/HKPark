'use client';

import { useMemo } from 'react';
import { useGameStore } from '../state/gameStore';
import { StaffType, TileType } from '../engine/types';
import type { Position, Tile } from '../engine/types';
import staffData from '../data/staff.json';

interface StaffDef {
  id: string;
  name: string;
  type: string;
  salary: number;
}

const staffDefs = staffData as StaffDef[];

const STAFF_META: Record<
  string,
  { emoji: string; color: string; blurb: string }
> = {
  JANITOR: {
    emoji: '🧹',
    color: 'text-green-400',
    blurb: 'Cleans litter. Dirty parks tank the rating.',
  },
  MECHANIC: {
    emoji: '🔧',
    color: 'text-orange-400',
    blurb: 'Walks to broken rides and repairs them.',
  },
  SECURITY: {
    emoji: '🛡️',
    color: 'text-blue-400',
    blurb: 'Guests near a guard feel safer (+happiness).',
  },
  ENTERTAINER: {
    emoji: '🎭',
    color: 'text-purple-400',
    blurb: 'Cheers up nearby guests (+happiness aura).',
  },
};

/** Find a sensible spawn tile for a new hire: the entrance, else any path. */
function findSpawnTile(grid: Tile[][]): Position | null {
  let firstPath: Position | null = null;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x++) {
      if (grid[y][x].type === TileType.ENTRANCE) {
        return { x, y };
      }
      if (!firstPath && grid[y][x].type === TileType.PATH) {
        firstPath = { x, y };
      }
    }
  }
  return firstPath;
}

export default function StaffPicker({ onClose }: { onClose: () => void }) {
  const staff = useGameStore((s) => s.staff);
  const grid = useGameStore((s) => s.grid);
  const hireStaff = useGameStore((s) => s.hireStaff);
  const fireStaff = useGameStore((s) => s.fireStaff);
  const addNotification = useGameStore((s) => s.addNotification);

  const staffList = useMemo(() => Object.values(staff), [staff]);
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of staffList) {
      counts[member.type] = (counts[member.type] ?? 0) + 1;
    }
    return counts;
  }, [staffList]);

  const totalWages = staffList.reduce((sum, m) => sum + m.salary, 0);

  function handleHire(def: StaffDef) {
    const spawn = findSpawnTile(grid);
    if (!spawn) {
      addNotification(
        'Build a path before hiring staff — they need somewhere to stand!',
        'warning',
      );
      return;
    }
    hireStaff(def.type as StaffType, spawn);
    addNotification(`${def.name} hired (HK$ ${def.salary}/month).`, 'success');
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[520px] max-h-[420px] bg-[#1a1a2e]/95 backdrop-blur-md rounded-xl border border-[#2a2a4a] overflow-hidden flex flex-col animate-slide-up"
      style={{
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4), 0 0 1px rgba(8,217,214,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="text-base">👥</span>
          <h3 className="text-sm font-bold text-[#f0c040] drop-shadow-[0_0_6px_rgba(240,192,64,0.3)]">
            Staff Management
          </h3>
          <span className="text-[10px] text-[#94a3b8] font-mono">
            {staffList.length} hired · HK$ {totalWages.toLocaleString('en-HK')}/mo
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[#0a0a1a]/40 border border-[#2a2a4a] hover:bg-[#ff2e63]/20 hover:border-[#ff2e63]/40 hover:text-[#ff2e63] text-[#94a3b8] flex items-center justify-center text-sm transition-all duration-200"
        >
          &times;
        </button>
      </div>

      {/* Hire grid */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-[#2a2a4a]/50">
        {staffDefs.map((def) => {
          const meta = STAFF_META[def.type] ?? {
            emoji: '👤',
            color: 'text-white',
            blurb: '',
          };
          const count = countByType[def.type] ?? 0;
          return (
            <div
              key={def.id}
              className="p-3 rounded-lg border bg-[#16213e]/70 border-[#2a2a4a]"
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-sm font-bold ${meta.color}`}>
                  {meta.emoji} {def.name}
                </span>
                <span className="text-[10px] font-mono text-[#94a3b8]">
                  x{count}
                </span>
              </div>
              <div className="text-[10px] text-[#94a3b8] mb-2 leading-snug">
                {meta.blurb}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#f0c040] font-bold">
                  HK$ {def.salary}/mo
                </span>
                <button
                  onClick={() => handleHire(def)}
                  className="px-2.5 py-1 text-xs rounded-md font-bold bg-[#08d9d6]/15 text-[#08d9d6] ring-1 ring-[#08d9d6]/50 hover:bg-[#08d9d6]/30 transition-all duration-200"
                >
                  Hire
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current staff list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
        {staffList.length === 0 && (
          <p className="text-xs text-[#94a3b8]/60 text-center py-3">
            No staff hired yet. Janitors and mechanics keep the park running.
          </p>
        )}
        {staffList.map((member) => {
          const meta = STAFF_META[member.type] ?? { emoji: '👤', color: '' };
          return (
            <div
              key={member.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-md bg-[#16213e]/50 border border-[#2a2a4a]/50"
            >
              <span className={`text-xs font-medium ${meta.color}`}>
                {meta.emoji} {member.name}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-[#94a3b8]">
                  HK$ {member.salary}/mo
                </span>
                <button
                  onClick={() => fireStaff(member.id)}
                  className="px-2 py-0.5 text-[10px] rounded font-bold bg-[#ff2e63]/10 text-[#ff2e63] ring-1 ring-[#ff2e63]/40 hover:bg-[#ff2e63]/25 transition-all duration-200"
                >
                  Fire
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
