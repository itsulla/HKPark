'use client';

import { useState } from 'react';
import { useGameStore } from '../state/gameStore';

interface FinanceWindowProps {
  onClose: () => void;
}

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-HK');
  return amount < 0 ? `-HK$ ${formatted}` : `HK$ ${formatted}`;
}

// ---------------------------------------------------------------------------
// Simple div-based bar chart for last 6 months with neon gradient bars
// ---------------------------------------------------------------------------

function MonthlyChart({
  reports,
}: {
  reports: { month: number; year: number; totalRevenue: number; totalExpenses: number; netProfit: number }[];
}) {
  const last6 = reports.slice(-6);
  if (last6.length === 0) {
    return (
      <div className="text-center text-sm text-[#94a3b8] py-6">
        <span className="text-2xl block mb-2 opacity-40">&#x1F4C8;</span>
        No monthly data yet. Complete your first month to see charts.
      </div>
    );
  }

  // Determine the max absolute value for scaling
  const allValues = last6.flatMap((r) => [r.totalRevenue, r.totalExpenses, Math.abs(r.netProfit)]);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="flex items-end gap-3 h-36">
      {last6.map((report, i) => {
        const revHeight = (report.totalRevenue / maxVal) * 100;
        const expHeight = (report.totalExpenses / maxVal) * 100;

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-1 h-28 w-full">
              {/* Revenue bar */}
              <div className="flex-1 flex flex-col justify-end">
                <div
                  className="neon-bar-green rounded-t-sm w-full min-h-[2px] transition-all duration-500"
                  style={{
                    height: `${revHeight}%`,
                    boxShadow: revHeight > 5 ? '0 0 8px rgba(8,217,214,0.3)' : 'none',
                  }}
                  title={`Revenue: ${formatMoney(report.totalRevenue)}`}
                />
              </div>
              {/* Expense bar */}
              <div className="flex-1 flex flex-col justify-end">
                <div
                  className="neon-bar-red rounded-t-sm w-full min-h-[2px] transition-all duration-500"
                  style={{
                    height: `${expHeight}%`,
                    boxShadow: expHeight > 5 ? '0 0 8px rgba(255,46,99,0.3)' : 'none',
                  }}
                  title={`Expenses: ${formatMoney(report.totalExpenses)}`}
                />
              </div>
            </div>
            {/* Label */}
            <span className="text-[10px] text-[#94a3b8] font-mono">
              M{report.month}
            </span>
            {/* Net */}
            <span
              className={`text-[10px] font-mono font-bold ${
                report.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {report.netProfit >= 0 ? '+' : ''}
              {(report.netProfit / 1000).toFixed(0)}k
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FinanceWindow
// ---------------------------------------------------------------------------

export default function FinanceWindow({ onClose }: FinanceWindowProps) {
  const money = useGameStore((s) => s.money);
  const loanAmount = useGameStore((s) => s.loanAmount);
  const loanInterestRate = useGameStore((s) => s.loanInterestRate);
  const monthlyReports = useGameStore((s) => s.monthlyReports);
  const addMoney = useGameStore((s) => s.addMoney);
  const spendMoney = useGameStore((s) => s.spendMoney);

  const [loanInput, setLoanInput] = useState(10000);

  const latestReport =
    monthlyReports.length > 0
      ? monthlyReports[monthlyReports.length - 1]
      : null;

  // Debt level for warning styling
  const isHighDebt = loanAmount > 50000;
  const isCriticalDebt = loanAmount > 100000;

  function handleBorrow() {
    if (loanInput <= 0) return;
    addMoney(loanInput, 'loan', 'Borrowed funds');
    useGameStore.setState((state) => ({
      loanAmount: state.loanAmount + loanInput,
    }));
  }

  function handleRepay() {
    if (loanInput <= 0) return;
    const repayAmount = Math.min(loanInput, loanAmount, money);
    if (repayAmount <= 0) return;
    const success = spendMoney(repayAmount, 'loan_repayment', 'Loan repayment');
    if (success) {
      useGameStore.setState((state) => ({
        loanAmount: Math.max(0, state.loanAmount - repayAmount),
      }));
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-backdrop-fade"
        onClick={onClose}
      />

      {/* Window */}
      <div className="relative bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl w-[620px] max-h-[85vh] overflow-y-auto custom-scrollbar animate-modal-enter"
        style={{
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 1px rgba(240,192,64,0.3)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a4a]">
          <div className="flex items-center gap-3">
            <span className="text-xl">&#x1F4CA;</span>
            <h2 className="text-lg font-bold text-[#f0c040] drop-shadow-[0_0_8px_rgba(240,192,64,0.3)]">
              Financial Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#0a0a1a]/60 border border-[#2a2a4a] hover:bg-[#ff2e63]/20 hover:border-[#ff2e63]/40 hover:text-[#ff2e63] text-[#94a3b8] flex items-center justify-center text-base font-bold transition-all duration-200 hover:shadow-[0_0_12px_rgba(255,46,99,0.2)]"
          >
            &times;
          </button>
        </div>

        {/* Cash Summary */}
        <div className="px-6 py-4 border-b border-[#2a2a4a]/50">
          <div className="flex justify-between items-center p-3 rounded-lg bg-[#0a0a1a]/50 border border-[#2a2a4a]">
            <span className="text-sm text-[#94a3b8] font-medium">Cash Balance</span>
            <span
              className="text-xl font-bold font-mono text-green-400"
              style={{ textShadow: '0 0 12px rgba(74,222,128,0.3)' }}
            >
              {formatMoney(money)}
            </span>
          </div>
        </div>

        {/* Revenue & Expenses */}
        {latestReport ? (
          <div className="px-6 py-4 space-y-5 border-b border-[#2a2a4a]/50">
            <div className="text-[10px] text-[#94a3b8] uppercase tracking-widest font-semibold">
              Month {latestReport.month}, Year {latestReport.year}
            </div>

            {/* Revenue Section */}
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                Revenue
              </h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Ride Revenue</span>
                  <span className="font-mono text-green-400">
                    {formatMoney(latestReport.rideRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Shop Revenue</span>
                  <span className="font-mono text-green-400">
                    {formatMoney(latestReport.shopRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Entrance Fees</span>
                  <span className="font-mono text-green-400">
                    {formatMoney(latestReport.entranceFeeRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-white font-semibold border-t border-green-500/10 pt-1.5 mt-1.5">
                  <span>Total Revenue</span>
                  <span className="font-mono text-green-400 font-bold">
                    {formatMoney(latestReport.totalRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Expense Section */}
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                Expenses
              </h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Staff Wages</span>
                  <span className="font-mono text-red-400">
                    {formatMoney(latestReport.staffWages)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Maintenance</span>
                  <span className="font-mono text-red-400">
                    {formatMoney(latestReport.rideMaintenance)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Loan Interest</span>
                  <span className="font-mono text-red-400">
                    {formatMoney(latestReport.loanInterest)}
                  </span>
                </div>
                <div className="flex justify-between text-white font-semibold border-t border-red-500/10 pt-1.5 mt-1.5">
                  <span>Total Expenses</span>
                  <span className="font-mono text-red-400 font-bold">
                    {formatMoney(latestReport.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div
              className="flex justify-between items-center p-3 rounded-lg border"
              style={{
                background:
                  latestReport.netProfit >= 0
                    ? 'rgba(8,217,214,0.05)'
                    : 'rgba(255,46,99,0.05)',
                borderColor:
                  latestReport.netProfit >= 0
                    ? 'rgba(8,217,214,0.2)'
                    : 'rgba(255,46,99,0.2)',
              }}
            >
              <span className="text-base font-bold text-white">Net Profit</span>
              <span
                className={`text-lg font-bold font-mono ${
                  latestReport.netProfit >= 0 ? 'text-[#08d9d6]' : 'text-[#ff2e63]'
                }`}
                style={{
                  textShadow: latestReport.netProfit >= 0
                    ? '0 0 12px rgba(8,217,214,0.4)'
                    : '0 0 12px rgba(255,46,99,0.4)',
                }}
              >
                {formatMoney(latestReport.netProfit)}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center border-b border-[#2a2a4a]/50">
            <span className="text-3xl block mb-3 opacity-30">&#x1F4C9;</span>
            <p className="text-sm text-[#94a3b8]">
              No financial reports yet. Complete your first month to see data.
            </p>
          </div>
        )}

        {/* 6-Month Chart */}
        <div className="px-6 py-4 border-b border-[#2a2a4a]/50">
          <h4 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-3">
            Last 6 Months
          </h4>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 neon-bar-green rounded-sm" />
              <span className="text-[10px] text-[#94a3b8]">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 neon-bar-red rounded-sm" />
              <span className="text-[10px] text-[#94a3b8]">Expenses</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0a1a]/40 border border-[#2a2a4a]/50">
            <MonthlyChart reports={monthlyReports} />
          </div>
        </div>

        {/* Loan Section */}
        <div className="px-6 py-4">
          <h4 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-3 flex items-center gap-2">
            Loans
            {isHighDebt && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isCriticalDebt
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[#f0c040]/20 text-[#f0c040] border border-[#f0c040]/30'
                }`}
              >
                {isCriticalDebt ? 'CRITICAL' : 'HIGH'}
              </span>
            )}
          </h4>

          <div
            className={`p-3 rounded-lg border mb-4 transition-all duration-300 ${
              isCriticalDebt
                ? 'bg-red-500/5 border-red-500/20 debt-warning-pulse'
                : isHighDebt
                  ? 'bg-[#f0c040]/5 border-[#f0c040]/15'
                  : 'bg-[#0a0a1a]/40 border-[#2a2a4a]'
            }`}
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Current Loan</span>
                <span
                  className={`font-mono font-bold ${
                    isCriticalDebt
                      ? 'text-red-400'
                      : isHighDebt
                        ? 'text-[#f0c040]'
                        : loanAmount > 0
                          ? 'text-red-400'
                          : 'text-[#94a3b8]'
                  }`}
                >
                  {formatMoney(loanAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Interest Rate</span>
                <span className="font-mono text-gray-300 font-medium">
                  {(loanInterestRate * 100).toFixed(1)}%/mo
                </span>
              </div>
              {loanAmount > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-[#94a3b8]">Monthly Interest</span>
                  <span className="font-mono text-red-400 text-xs">
                    {formatMoney(Math.round(loanAmount * loanInterestRate))}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8]/60 font-mono">
                HK$
              </span>
              <input
                type="number"
                min={1000}
                max={500000}
                step={1000}
                value={loanInput}
                onChange={(e) =>
                  setLoanInput(Math.max(0, Number(e.target.value)))
                }
                className="w-full pl-11 pr-3 py-2 rounded-lg bg-[#0a0a1a]/60 border border-[#2a2a4a] text-sm font-mono text-white focus:outline-none focus:border-[#08d9d6]/50 focus:shadow-[0_0_12px_rgba(8,217,214,0.1)] transition-all duration-200"
              />
            </div>
            <button
              onClick={handleBorrow}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 hover:shadow-[0_0_12px_rgba(74,222,128,0.15)] transition-all duration-200"
            >
              Borrow
            </button>
            <button
              onClick={handleRepay}
              disabled={loanAmount <= 0}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                loanAmount > 0
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(248,113,113,0.15)]'
                  : 'bg-[#2a2a4a]/30 text-[#94a3b8]/40 border border-[#2a2a4a]/30 cursor-not-allowed'
              }`}
            >
              Repay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
