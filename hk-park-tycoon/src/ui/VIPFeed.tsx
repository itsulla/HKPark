'use client';

import { useGameStore } from '../state/gameStore';

/**
 * VIPFeed — a live feed of VIP commentary (Layer 2). Shows the most recent
 * lines from named VIP personas walking the park. Sponsor mentions are tagged,
 * which is what makes the dialogue shareable (and monetizable).
 */
export default function VIPFeed() {
  const vipDialogue = useGameStore((s) => s.vipDialogue);

  if (vipDialogue.length === 0) return null;

  // Most recent first, capped to a few lines.
  const recent = vipDialogue.slice(-3).reverse();

  return (
    <div className="fixed left-3 bottom-toolbar mb-3 z-panel w-72 max-w-[80vw] flex flex-col gap-2 pointer-events-none">
      {recent.map((line, i) => (
        <div
          key={line.id}
          className="rounded-lg border border-[#2a2a4a] bg-[#1a1a2e]/95 backdrop-blur-md px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-opacity"
          style={{ opacity: 1 - i * 0.25 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base leading-none">{line.avatarEmoji}</span>
            <span className="text-xs font-bold text-white">{line.vipName}</span>
            {line.sponsored && (
              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#FFD400] border border-[#FFD400]/40 bg-[#FFD400]/10 rounded-full px-1.5 py-0.5">
                ✦ Sponsored
              </span>
            )}
          </div>
          <p className="text-xs text-[#cbd5e1] italic leading-relaxed">
            &ldquo;{line.text}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}
