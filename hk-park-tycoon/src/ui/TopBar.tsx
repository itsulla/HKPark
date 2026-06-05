'use client';

import { useGameStore } from '../state/gameStore';
import { GameSpeed } from '../engine/types';

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-HK');
  return amount < 0 ? `-HK$ ${formatted}` : `HK$ ${formatted}`;
}

export default function TopBar() {
  const parkName = useGameStore((s) => s.parkName);
  const money = useGameStore((s) => s.money);
  const date = useGameStore((s) => s.date);
  const guests = useGameStore((s) => s.guests);
  const parkRating = useGameStore((s) => s.parkRating);
  const speed = useGameStore((s) => s.speed);
  const monthlyReports = useGameStore((s) => s.monthlyReports);
  const setSpeed = useGameStore((s) => s.setSpeed);

  const guestCount = Object.keys(guests).length;

  // Determine monthly money trend from last two reports
  let trend: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (monthlyReports.length >= 2) {
    const latest = monthlyReports[monthlyReports.length - 1];
    const prev = monthlyReports[monthlyReports.length - 2];
    if (latest.cashBalance > prev.cashBalance) trend = 'positive';
    else if (latest.cashBalance < prev.cashBalance) trend = 'negative';
  } else if (monthlyReports.length === 1) {
    trend = monthlyReports[0].netProfit >= 0 ? 'positive' : 'negative';
  }

  const moneyColor =
    trend === 'positive'
      ? 'text-green-400'
      : trend === 'negative'
        ? 'text-red-400'
        : 'text-green-400';

  const moneyGlow =
    trend === 'positive'
      ? 'drop-shadow-[0_0_6px_rgba(74,222,128,0.4)]'
      : trend === 'negative'
        ? 'drop-shadow-[0_0_6px_rgba(248,113,113,0.4)]'
        : '';

  const trendArrow =
    trend === 'positive' ? '\u25B2' : trend === 'negative' ? '\u25BC' : '';

  const speeds: { value: GameSpeed; label: string; title: string }[] = [
    { value: GameSpeed.PAUSED, label: '\u23F8', title: 'Pause' },
    { value: GameSpeed.NORMAL, label: '\u25B6', title: 'Normal speed' },
    { value: GameSpeed.FAST, label: '\u25B6\u25B6', title: 'Fast speed' },
    { value: GameSpeed.ULTRA, label: '\u25B6\u25B6\u25B6', title: 'Ultra speed' },
  ];

  // Rating color based on value
  const ratingPct = parkRating / 1000;
  const ratingColor =
    ratingPct >= 0.7
      ? 'text-[#f0c040]'
      : ratingPct >= 0.4
        ? 'text-orange-400'
        : 'text-red-400';

  return (
    <div
      className="fixed top-0 left-0 right-0 h-topbar bg-[#1a1a2e]/90 backdrop-blur-md z-topbar flex items-center px-4 border-b border-[#2a2a4a]"
      style={{
        boxShadow:
          '0 1px 0 rgba(8,217,214,0.15), 0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Left: Park name */}
      <div className="flex-shrink-0 w-48">
        <span className="text-lg font-bold text-[#f0c040] truncate drop-shadow-[0_0_8px_rgba(240,192,64,0.3)]">
          {parkName}
        </span>
      </div>

      {/* Center: Money + Date */}
      <div className="flex-1 flex items-center justify-center gap-6">
        {/* Money display with trend indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0a0a1a]/50 border border-[#2a2a4a]">
          <span className={`font-mono text-sm font-bold tracking-wide ${moneyColor} ${moneyGlow}`}>
            {formatMoney(money)}
          </span>
          {trendArrow && (
            <span
              className={`text-[10px] ${
                trend === 'positive' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {trendArrow}
            </span>
          )}
        </div>

        {/* Date display */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#94a3b8]">Day</span>
          <span className="font-mono text-white font-medium">{date.day}</span>
          <span className="text-[#2a2a4a]">|</span>
          <span className="text-[#94a3b8]">Month</span>
          <span className="font-mono text-white font-medium">{date.month}</span>
          <span className="text-[#2a2a4a]">|</span>
          <span className="text-[#94a3b8]">Year</span>
          <span className="font-mono text-white font-medium">{date.year}</span>
        </div>
      </div>

      {/* Right: Guests, Rating, Speed */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {/* Guest count */}
        <div className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-[#0a0a1a]/40 border border-[#2a2a4a]/60">
          <span role="img" aria-label="guests" className="text-xs">
            &#x1F9D1;
          </span>
          <span className="font-mono text-[#08d9d6] font-medium">
            {guestCount.toLocaleString()}
          </span>
        </div>

        {/* Park Rating */}
        <div className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-[#0a0a1a]/40 border border-[#2a2a4a]/60">
          <span role="img" aria-label="rating" className="text-xs">
            &#x2B50;
          </span>
          <span className={`font-mono font-medium ${ratingColor}`}>
            {Math.round(parkRating)}
          </span>
          <span className="text-[#94a3b8] text-xs">/1000</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2a2a4a]" />

        {/* Speed controls */}
        <div className="flex items-center gap-1">
          {speeds.map((s) => {
            const isActive = speed === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                title={s.title}
                className={`px-2 py-1 text-xs rounded-md transition-all duration-200 ${
                  isActive
                    ? 'bg-[#08d9d6]/20 text-[#08d9d6] ring-1 ring-[#08d9d6]/70 speed-active-glow'
                    : 'bg-[#16213e] text-[#94a3b8] hover:bg-[#16213e]/80 hover:text-white hover:shadow-[0_0_8px_rgba(8,217,214,0.15)]'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
