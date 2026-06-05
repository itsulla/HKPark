'use client';

import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import SponsorManager from '../sponsors/SponsorManager';
import type { Ride, Shop, Guest } from '../engine/types';

// ---------------------------------------------------------------------------
// Sponsor badge — shown when a surface is currently branded by a sponsor.
// ---------------------------------------------------------------------------

function SponsoredBadge({ color, brand }: { color: string; brand: string }) {
  return (
    <span
      className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border"
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}1a`,
        boxShadow: `0 0 8px ${color}33`,
      }}
    >
      Sponsored · {brand}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ProgressBar({
  label,
  value,
  max,
  gradientClass,
}: {
  label: string;
  value: number;
  max: number;
  gradientClass: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#94a3b8] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full ${gradientClass} transition-all duration-500 ease-out`}
          style={{
            width: `${pct}%`,
            boxShadow:
              pct > 0 ? `0 0 8px ${gradientClass.includes('green') ? 'rgba(8,217,214,0.3)' : gradientClass.includes('red') ? 'rgba(255,46,99,0.3)' : 'rgba(240,192,64,0.3)'}` : 'none',
          }}
        />
      </div>
      <span className="text-xs font-mono text-gray-300 w-12 text-right">
        {value % 1 !== 0 ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.15)]',
    closed: 'bg-[#2a2a4a]/60 text-[#94a3b8] border-[#2a2a4a]',
    broken: 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(248,113,113,0.15)]',
    building: 'bg-[#f0c040]/20 text-[#f0c040] border-[#f0c040]/30 shadow-[0_0_8px_rgba(240,192,64,0.15)]',
  };
  const cls = colors[status] ?? colors.closed;

  return (
    <span
      className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${cls}`}
    >
      {status}
    </span>
  );
}

function SectionDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#2a2a4a] to-transparent" />
        <span className="text-[9px] text-[#94a3b8] uppercase tracking-widest font-semibold">
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#2a2a4a] to-transparent" />
      </div>
    );
  }
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-[#2a2a4a] to-transparent" />
  );
}

// ---------------------------------------------------------------------------
// Ride Info
// ---------------------------------------------------------------------------

function RideInfo({ ride }: { ride: Ride }) {
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);
  const openRide = useGameStore((s) => s.openRide);
  const closeRide = useGameStore((s) => s.closeRide);

  const isOpen = ride.status === 'open';

  const display = SponsorManager.getDisplayConfig(ride.definitionId);
  const sponsor = SponsorManager.getSponsor(ride.definitionId);

  return (
    <div className="space-y-4">
      {/* Name + Status */}
      <div>
        <h3 className="text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
          {sponsor ? display.name : ride.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge status={ride.status} />
          {sponsor && (
            <SponsoredBadge color={display.color} brand={sponsor.brandName} />
          )}
        </div>
      </div>

      <SectionDivider label="Ratings" />

      {/* Ratings */}
      <div className="space-y-2">
        <ProgressBar
          label="Excitement"
          value={ride.excitement}
          max={10}
          gradientClass="neon-bar-green"
        />
        <ProgressBar
          label="Intensity"
          value={ride.intensity}
          max={10}
          gradientClass="neon-bar-orange"
        />
        <ProgressBar
          label="Nausea"
          value={ride.nausea}
          max={10}
          gradientClass="neon-bar-red"
        />
      </div>

      <SectionDivider label="Operations" />

      {/* Queue */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#94a3b8]">Queue</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-white font-medium">
            {ride.currentQueue.length}
          </span>
          <span className="text-[#94a3b8] text-xs">/</span>
          <span className="font-mono text-[#94a3b8] text-xs">
            {ride.maxQueue}
          </span>
        </div>
      </div>

      {/* Ticket Price */}
      <div className="p-3 rounded-lg bg-[#0a0a1a]/50 border border-[#2a2a4a]">
        <label className="text-xs text-[#94a3b8] flex items-center justify-between mb-2">
          <span>Ticket Price</span>
          <span className="text-[#f0c040] font-mono font-bold text-sm">
            HK$ {ride.ticketPrice}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={ride.ticketPrice}
          onChange={(e) => setTicketPrice(ride.id, Number(e.target.value))}
          className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#ff2e63]"
        />
        <div className="flex justify-between text-[10px] text-[#94a3b8]/60 mt-1 font-mono">
          <span>HK$ 1</span>
          <span>HK$ 100</span>
        </div>
      </div>

      <SectionDivider label="Financials" />

      {/* Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Monthly Revenue</span>
          <span className="font-mono text-green-400 font-medium">
            HK$ {ride.totalRevenue.toLocaleString('en-HK')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Total Customers</span>
          <span className="font-mono text-[#08d9d6] font-medium">
            {ride.totalCustomers.toLocaleString('en-HK')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Maintenance</span>
          <span className="font-mono text-red-400 font-medium">
            HK$ {ride.monthlyMaintenanceCost}/mo
          </span>
        </div>
      </div>

      {/* Open / Close toggle */}
      {ride.status !== 'broken' && ride.status !== 'building' && (
        <button
          onClick={() => (isOpen ? closeRide(ride.id) : openRide(ride.id))}
          className={`w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
            isOpen
              ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:shadow-[0_0_16px_rgba(239,68,68,0.15)]'
              : 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 hover:shadow-[0_0_16px_rgba(74,222,128,0.15)]'
          }`}
        >
          {isOpen ? 'Close Ride' : 'Open Ride'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop Info
// ---------------------------------------------------------------------------

function ShopInfo({ shop }: { shop: Shop }) {
  const stockPct =
    shop.maxStock > 0 ? (shop.stock / shop.maxStock) * 100 : 0;
  const stockGradient =
    stockPct > 50
      ? 'neon-bar-green'
      : stockPct > 20
        ? 'neon-bar-yellow'
        : 'neon-bar-red';

  // Sponsor branding swap: a sponsored shop shows the brand identity instead
  // of its default HK name; otherwise the default (== shop.name) is shown.
  const display = SponsorManager.getDisplayConfig(shop.definitionId);
  const sponsor = SponsorManager.getSponsor(shop.definitionId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
          {sponsor ? display.name : shop.name}
        </h3>
        {sponsor && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div>
              <SponsoredBadge color={display.color} brand={sponsor.brandName} />
            </div>
            <p className="text-xs text-[#94a3b8] italic">{display.description}</p>
          </div>
        )}
      </div>

      <SectionDivider label="Inventory" />

      <div className="p-3 rounded-lg bg-[#0a0a1a]/50 border border-[#2a2a4a]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#94a3b8]">Stock Level</span>
          <span className="text-xs font-mono text-white">
            {shop.stock} / {shop.maxStock}
          </span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full ${stockGradient} transition-all duration-500 ease-out`}
            style={{ width: `${stockPct}%` }}
          />
        </div>
      </div>

      <SectionDivider label="Financials" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Revenue</span>
          <span className="font-mono text-green-400 font-medium">
            HK$ {shop.revenue.toLocaleString('en-HK')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Maintenance</span>
          <span className="font-mono text-red-400 font-medium">
            HK$ {shop.monthlyMaintenance}/mo
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest Info (future use)
// ---------------------------------------------------------------------------

function GuestInfo({ guest }: { guest: Guest }) {
  const happinessGradient =
    guest.happiness > 70
      ? 'neon-bar-green'
      : guest.happiness > 40
        ? 'neon-bar-yellow'
        : 'neon-bar-red';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
        {guest.name}
      </h3>

      <div className="p-3 rounded-lg bg-[#0a0a1a]/50 border border-[#2a2a4a]">
        <ProgressBar
          label="Happiness"
          value={guest.happiness}
          max={100}
          gradientClass={happinessGradient}
        />
      </div>

      <SectionDivider label="Needs" />

      <div className="space-y-2">
        <ProgressBar
          label="Hunger"
          value={guest.hunger}
          max={100}
          gradientClass="neon-bar-orange"
        />
        <ProgressBar
          label="Thirst"
          value={guest.thirst}
          max={100}
          gradientClass="neon-bar-cyan"
        />
        <ProgressBar
          label="Energy"
          value={guest.energy}
          max={100}
          gradientClass="neon-bar-yellow"
        />
        <ProgressBar
          label="Nausea"
          value={guest.nausea}
          max={100}
          gradientClass="neon-bar-red"
        />
      </div>

      <SectionDivider label="Status" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">Cash</span>
          <span className="font-mono text-[#f0c040] font-medium">
            HK$ {guest.cash.toLocaleString('en-HK')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#94a3b8]">State</span>
          <span className="text-xs text-white uppercase font-semibold tracking-wide bg-[#2a2a4a]/60 px-2 py-0.5 rounded-full">
            {guest.state}
          </span>
        </div>
      </div>

      {guest.thoughtBubble && (
        <div className="bg-[#0a0a1a]/60 rounded-lg p-3 border border-[#2a2a4a]/50">
          <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold block mb-1">
            Thinking
          </span>
          <p className="text-xs text-[#08d9d6] italic leading-relaxed">
            &ldquo;{guest.thoughtBubble}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main InfoPanel
// ---------------------------------------------------------------------------

export default function InfoPanel() {
  const selectedEntityId = useGameStore((s) => s.selectedEntityId);
  const setSelectedEntity = useGameStore((s) => s.setSelectedEntity);
  const rides = useGameStore((s) => s.rides);
  const shops = useGameStore((s) => s.shops);
  const guests = useGameStore((s) => s.guests);

  // Resolve the selected sponsorable surface to a stable key so the impression
  // effect fires exactly once per distinct selection (not on every sim re-render
  // that re-creates the rides/shops objects).
  const selectedRide = selectedEntityId ? rides[selectedEntityId] : undefined;
  const selectedShop = selectedEntityId ? shops[selectedEntityId] : undefined;
  const trackedSurface = selectedRide
    ? `ride:${selectedRide.definitionId}`
    : selectedShop
      ? `shop:${selectedShop.definitionId}`
      : null;

  // Fire a 'click' impression when a ride/shop surface is selected — the player
  // engaging with a sponsorable surface is exactly the signal a brand pays for.
  // Runs before the early return to keep hook order stable.
  useEffect(() => {
    if (!trackedSurface) return;
    const [type, definitionId] = trackedSurface.split(':');
    const sponsor = SponsorManager.getSponsor(definitionId);
    SponsorManager.trackImpression({
      surfaceType: type as 'ride' | 'shop',
      surfaceId: definitionId,
      sponsorId: sponsor?.sponsorId ?? null,
      eventType: 'click',
    });
  }, [trackedSurface]);

  if (!selectedEntityId) return null;

  const ride: Ride | undefined = rides[selectedEntityId];
  const shop: Shop | undefined = shops[selectedEntityId];
  const guest: Guest | undefined = guests[selectedEntityId];

  const hasEntity = ride || shop || guest;
  if (!hasEntity) return null;

  // Determine panel header icon + accent color
  const headerIcon = ride ? '\uD83C\uDFA2' : shop ? '\uD83C\uDFEA' : '\uD83E\uDDD1';
  const accentColor = ride ? '#ff2e63' : shop ? '#f0c040' : '#08d9d6';

  return (
    <div
      className="fixed right-0 top-topbar bottom-toolbar w-info-panel bg-[#1a1a2e]/95 backdrop-blur-md z-panel border-l border-[#2a2a4a] overflow-hidden info-panel-responsive"
      style={{
        boxShadow: `-4px 0 16px rgba(0,0,0,0.3), -1px 0 0 ${accentColor}20`,
      }}
    >
      {/* Close button */}
      <button
        onClick={() => setSelectedEntity(null)}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-[#0a0a1a]/60 border border-[#2a2a4a] hover:bg-[#ff2e63]/20 hover:border-[#ff2e63]/40 hover:text-[#ff2e63] text-[#94a3b8] flex items-center justify-center text-base font-bold transition-all duration-200 z-10 hover:shadow-[0_0_12px_rgba(255,46,99,0.2)]"
      >
        &times;
      </button>

      {/* Header accent bar */}
      <div
        className="h-0.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      {/* Entity type badge */}
      <div className="px-4 pt-3 pb-0 flex items-center gap-2">
        <span className="text-sm">{headerIcon}</span>
        <span className="text-[10px] text-[#94a3b8] uppercase tracking-widest font-semibold">
          {ride ? 'Ride' : shop ? 'Shop' : 'Guest'}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="p-4 pt-2 overflow-y-auto h-[calc(100%-2.5rem)] custom-scrollbar">
        {ride && <RideInfo ride={ride} />}
        {shop && <ShopInfo shop={shop} />}
        {guest && <GuestInfo guest={guest} />}
      </div>
    </div>
  );
}
