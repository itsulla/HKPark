'use client';

// =============================================================================
// Sponsor impressions admin dashboard.
//
// Token-gated (ADMIN_TOKEN env var on the server). The token is entered once
// and kept in sessionStorage; all data comes from /api/admin/stats.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

interface SponsorStats {
  total: number;
  byEventType: Record<string, number>;
  bySurface: Record<string, number>;
  uniqueSessions: number;
}

interface StatsReport {
  logPath: string;
  totalEvents: number;
  uniqueSessions: number;
  byEventType: Record<string, number>;
  bySponsor: Record<string, SponsorStats>;
  byDay: Record<string, number>;
  generatedAt: string;
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [report, setReport] = useState<StatsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('hk-admin-token');
    if (saved) setToken(saved);
  }, []);

  const fetchStats = useCallback(async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('Invalid token (or ADMIN_TOKEN not set on the server).');
        setReport(null);
        return;
      }
      if (!res.ok) {
        setError(`Server error: ${res.status}`);
        return;
      }
      setReport((await res.json()) as StatsReport);
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void fetchStats(token);
  }, [token, fetchStats]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem('hk-admin-token', trimmed);
    setToken(trimmed);
  }

  // ---- Login screen ----
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a16] flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="w-96 rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-6"
        >
          <h1 className="text-lg font-bold text-white mb-1">
            Sponsor Dashboard
          </h1>
          <p className="text-xs text-gray-400 mb-4">
            Enter the admin token (ADMIN_TOKEN on the server).
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 mb-3 rounded-md bg-[#0a0a16] border border-[#2a2a4a] text-sm text-white placeholder-gray-600 focus:border-[#08d9d6]/50 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-md text-sm font-bold text-[#0a0a1a] bg-[#08d9d6] hover:bg-[#08d9d6]/90 transition-all"
          >
            View Dashboard
          </button>
        </form>
      </div>
    );
  }

  // ---- Dashboard ----
  const days = report ? Object.keys(report.byDay).sort() : [];
  const maxDayCount = report
    ? Math.max(1, ...Object.values(report.byDay))
    : 1;

  return (
    <div className="min-h-screen bg-[#0a0a16] text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold">
              Sponsor Impressions Dashboard
            </h1>
            {report && (
              <p className="text-xs text-gray-500 font-mono mt-1">
                {report.logPath} · generated {report.generatedAt}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void fetchStats(token)}
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-bold bg-[#08d9d6]/15 text-[#08d9d6] ring-1 ring-[#08d9d6]/50 hover:bg-[#08d9d6]/30 transition-all disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('hk-admin-token');
                setToken('');
                setReport(null);
              }}
              className="px-4 py-2 rounded-md text-sm font-bold bg-[#2a2a4a]/40 text-gray-300 hover:text-white transition-all"
            >
              Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-[#ff2e63]/10 border border-[#ff2e63]/40 text-sm text-[#ff2e63]">
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Headline numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Total events', value: report.totalEvents },
                { label: 'Unique sessions', value: report.uniqueSessions },
                {
                  label: 'Sponsors with traffic',
                  value: Object.keys(report.bySponsor).length,
                },
                {
                  label: 'VIP mentions',
                  value: report.byEventType['vip_mention'] ?? 0,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4"
                >
                  <div className="text-2xl font-extrabold text-[#08d9d6]">
                    {card.value.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {card.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Events per day */}
            <div className="rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4 mb-8">
              <h2 className="text-sm font-bold text-gray-300 mb-3">
                Events per day
              </h2>
              {days.length === 0 ? (
                <p className="text-xs text-gray-500">No events logged yet.</p>
              ) : (
                <div className="flex items-end gap-1 h-28">
                  {days.slice(-30).map((day) => (
                    <div
                      key={day}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                      title={`${day}: ${report.byDay[day].toLocaleString()} events`}
                    >
                      <div
                        className="w-full rounded-t bg-[#08d9d6]/70 group-hover:bg-[#08d9d6] transition-colors"
                        style={{
                          height: `${(report.byDay[day] / maxDayCount) * 100}%`,
                          minHeight: 2,
                        }}
                      />
                      <span className="text-[8px] text-gray-600 mt-1 rotate-0">
                        {day.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event type breakdown */}
            <div className="rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4 mb-8">
              <h2 className="text-sm font-bold text-gray-300 mb-3">
                Events by type
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.byEventType).map(([type, count]) => (
                  <span
                    key={type}
                    className="px-3 py-1.5 rounded-full bg-[#0a0a16] border border-[#2a2a4a] text-xs font-mono"
                  >
                    <span className="text-[#f0c040]">{type}</span>{' '}
                    <span className="text-gray-300">
                      {count.toLocaleString()}
                    </span>
                  </span>
                ))}
                {Object.keys(report.byEventType).length === 0 && (
                  <p className="text-xs text-gray-500">No events yet.</p>
                )}
              </div>
            </div>

            {/* Per-sponsor table */}
            <div className="rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4">
              <h2 className="text-sm font-bold text-gray-300 mb-3">
                Per-sponsor breakdown
              </h2>
              {Object.keys(report.bySponsor).length === 0 ? (
                <p className="text-xs text-gray-500">
                  No sponsored impressions yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#2a2a4a]">
                        <th className="py-2 pr-4">Sponsor</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-4">Sessions</th>
                        <th className="py-2 pr-4">Views</th>
                        <th className="py-2 pr-4">Clicks</th>
                        <th className="py-2 pr-4">VIP mentions</th>
                        <th className="py-2">Top surfaces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report.bySponsor).map(
                        ([sponsorId, s]) => {
                          const topSurfaces = Object.entries(s.bySurface)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([k, v]) => `${k} (${v})`)
                            .join(', ');
                          return (
                            <tr
                              key={sponsorId}
                              className="border-b border-[#2a2a4a]/40"
                            >
                              <td className="py-2 pr-4 font-bold text-[#08d9d6]">
                                {sponsorId}
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {s.total.toLocaleString()}
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {s.uniqueSessions.toLocaleString()}
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {(s.byEventType['view'] ?? 0).toLocaleString()}
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {(s.byEventType['click'] ?? 0).toLocaleString()}
                              </td>
                              <td className="py-2 pr-4 font-mono">
                                {(
                                  s.byEventType['vip_mention'] ?? 0
                                ).toLocaleString()}
                              </td>
                              <td className="py-2 text-gray-400 font-mono text-[10px]">
                                {topSurfaces}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
