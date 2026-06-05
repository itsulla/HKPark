'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { loadAutoSave, listSaves, type SaveMetadata } from '../state/saveManager';

// ---------------------------------------------------------------------------
// Particle background
// ---------------------------------------------------------------------------

function Particles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const particles = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 10}s`,
      duration: `${8 + Math.random() * 12}s`,
      size: `${2 + Math.random() * 4}px`,
      color: Math.random() > 0.5 ? '#ff2e63' : '#08d9d6',
      opacity: 0.2 + Math.random() * 0.4,
    }));
  }, [mounted]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save Slot Picker (simple modal)
// ---------------------------------------------------------------------------

function SaveSlotPicker({
  saves,
  onSelect,
  onClose,
}: {
  saves: SaveMetadata[];
  onSelect: (slotId: string) => void;
  onClose: () => void;
}) {
  const nonAutoSaves = saves.filter((s) => s.slotId !== '__autosave__');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl w-96 max-h-[70vh] overflow-y-auto custom-scrollbar shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Load Game</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="p-4 space-y-2">
          {nonAutoSaves.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              No saved games found.
            </p>
          )}

          {nonAutoSaves.map((save) => (
            <button
              key={save.slotId}
              onClick={() => onSelect(save.slotId)}
              className="w-full text-left p-3 rounded-lg bg-[#16213e]/60 border border-white/10 hover:border-[#08d9d6]/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">
                  {save.parkName}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(save.timestamp).toLocaleDateString()}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Day {save.date.day}, Month {save.date.month}, Year{' '}
                {save.date.year} | HK${' '}
                {save.money.toLocaleString('en-HK')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const router = useRouter();
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [showLoadPicker, setShowLoadPicker] = useState(false);
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [checking, setChecking] = useState(true);

  // Check for auto-save on mount
  useEffect(() => {
    async function check() {
      try {
        const autoSave = await loadAutoSave();
        setHasAutoSave(autoSave !== null);
      } catch {
        setHasAutoSave(false);
      }
      setChecking(false);
    }
    check();
  }, []);

  function handleNewGame() {
    router.push('/game?new=true');
  }

  function handleContinue() {
    router.push('/game');
  }

  async function handleLoadGame() {
    try {
      const allSaves = await listSaves();
      setSaves(allSaves);
      setShowLoadPicker(true);
    } catch {
      setSaves([]);
      setShowLoadPicker(true);
    }
  }

  function handleSelectSave(slotId: string) {
    setShowLoadPicker(false);
    router.push(`/game?slot=${encodeURIComponent(slotId)}`);
  }

  return (
    <div className="h-screen w-screen animated-bg flex flex-col items-center justify-center relative select-none overflow-hidden">
      {/* Key-art background with a dark overlay for legibility */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: 'url(/key-art.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a16]/75 via-[#0a0a16]/55 to-[#0a0a16]/90" />

      <Particles />

      {/* Title */}
      <div className="relative z-10 text-center mb-12">
        <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-white neon-glow-title mb-4">
          HK Theme Park
          <br />
          Tycoon
        </h1>
        <p className="text-lg sm:text-xl text-gray-300/80 font-light max-w-md mx-auto">
          Build your dream theme park in the heart of Hong Kong
        </p>
      </div>

      {/* Buttons */}
      <div className="relative z-10 flex flex-col gap-4 w-64">
        {/* New Game */}
        <button
          onClick={handleNewGame}
          className="w-full py-3 px-6 rounded-lg text-lg font-bold text-white bg-[#ff2e63] hover:bg-[#ff2e63]/90 transition-all neon-pulse"
        >
          New Game
        </button>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={checking || !hasAutoSave}
          className={`w-full py-3 px-6 rounded-lg text-lg font-bold transition-all ${
            hasAutoSave && !checking
              ? 'text-white bg-[#08d9d6] hover:bg-[#08d9d6]/90 shadow-lg shadow-[#08d9d6]/20'
              : 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
          }`}
        >
          Continue
        </button>

        {/* Load Game */}
        <button
          onClick={handleLoadGame}
          className="w-full py-3 px-6 rounded-lg text-lg font-bold text-gray-300 border border-gray-600 hover:border-gray-400 hover:text-white transition-all bg-transparent"
        >
          Load Game
        </button>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-gray-600 z-10">
        A browser-based RollerCoaster Tycoon tribute
      </p>

      {/* Save Slot Picker Modal */}
      {showLoadPicker && (
        <SaveSlotPicker
          saves={saves}
          onSelect={handleSelectSave}
          onClose={() => setShowLoadPicker(false)}
        />
      )}
    </div>
  );
}
