// =============================================================================
// HK Theme Park Tycoon - EconomyManager (Financial Simulation)
// =============================================================================

import { Ride, RideCategory, FinancialReport, Transaction, GameDate, Staff } from '../types';
import { EventBus } from '../core/EventBus';

// -----------------------------------------------------------------------------
// Category Weights (adapted from OpenRCT2)
// -----------------------------------------------------------------------------

interface CategoryWeights {
  excitement: number;
  intensity: number;
  nausea: number;
}

const CATEGORY_WEIGHTS: Record<RideCategory, CategoryWeights> = {
  [RideCategory.THRILL]:    { excitement: 1.0, intensity: 1.2, nausea: 0.5 },
  [RideCategory.FAMILY]:    { excitement: 1.3, intensity: 0.8, nausea: 0.3 },
  [RideCategory.GENTLE]:    { excitement: 1.5, intensity: 0.5, nausea: 0.2 },
  [RideCategory.WATER]:     { excitement: 1.2, intensity: 1.0, nausea: 0.8 },
  [RideCategory.TRANSPORT]: { excitement: 0.8, intensity: 0.3, nausea: 0.1 },
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RIDE_VALUE_MULTIPLIER = 5;
const MINIMUM_RIDE_VALUE = 1;
const AGE_PENALTY_THRESHOLD_MONTHS = 6;
const AGE_PENALTY_PER_PERIOD = 0.05;
const MAX_AGE_PENALTY = 0.50;
const DUPLICATE_PENALTY_PER_EXTRA = 0.15;
const MAX_LOAN = 2_000_000;

// -----------------------------------------------------------------------------
// EconomyManager
// -----------------------------------------------------------------------------

export class EconomyManager {
  private transactions: Transaction[] = [];
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Ride Value Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate the perceived dollar value of a ride, adapted from OpenRCT2.
   *
   * The ride value is a weighted sum of excitement, intensity, and nausea
   * (weights vary by category), with penalties for age and duplicates.
   */
  calculateRideValue(
    ride: Ride,
    category: RideCategory,
    sceneryBonus: number,
    sameTypeCount: number,
  ): number {
    const adjustedExcitement = ride.excitement + sceneryBonus;
    const adjustedIntensity = ride.intensity;
    const adjustedNausea = ride.nausea;

    const weights = CATEGORY_WEIGHTS[category];

    let rideValue =
      adjustedExcitement * weights.excitement +
      adjustedIntensity * weights.intensity +
      adjustedNausea * weights.nausea;

    // Age penalty: lose 5% per 6-month period after the first 6 months, max 50%
    if (ride.monthsOld > AGE_PENALTY_THRESHOLD_MONTHS) {
      const agePeriods = Math.floor(
        (ride.monthsOld - AGE_PENALTY_THRESHOLD_MONTHS) / AGE_PENALTY_THRESHOLD_MONTHS,
      ) + 1;
      const agePenalty = Math.min(agePeriods * AGE_PENALTY_PER_PERIOD, MAX_AGE_PENALTY);
      rideValue *= 1 - agePenalty;
    }

    // Duplicate penalty: 15% reduction per duplicate beyond the first
    if (sameTypeCount > 1) {
      const duplicatePenalty = (sameTypeCount - 1) * DUPLICATE_PENALTY_PER_EXTRA;
      rideValue *= Math.max(1 - duplicatePenalty, 0);
    }

    return Math.max(rideValue * RIDE_VALUE_MULTIPLIER, MINIMUM_RIDE_VALUE);
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * Record a financial transaction and emit a money-changed event.
   */
  recordTransaction(amount: number, category: string, description: string): void {
    const transaction: Transaction = { amount, category, description };
    this.transactions.push(transaction);
    this.eventBus.emit('money-changed', { amount, balance: 0, category });
  }

  /**
   * Return a copy of the current month's transactions.
   */
  getMonthlyTransactions(): Transaction[] {
    return [...this.transactions];
  }

  // ---------------------------------------------------------------------------
  // Monthly Processing
  // ---------------------------------------------------------------------------

  /**
   * Process end-of-month finances: sum revenue and expenses, produce a
   * FinancialReport, clear the transaction log, and emit the month event.
   */
  processMonth(
    rides: Record<string, Ride>,
    staff: Record<string, Staff>,
    loanAmount: number,
    loanInterestRate: number,
    money: number,
    date: GameDate,
  ): FinancialReport {
    // --- Revenue ---
    const rideRevenue = this.sumByCategory('ride-revenue');
    const shopRevenue = this.sumByCategory('shop-revenue');
    const entranceFeeRevenue = this.sumByCategory('entrance-fee');
    const totalRevenue = rideRevenue + shopRevenue + entranceFeeRevenue;

    // --- Expenses ---
    let staffWages = 0;
    for (const staffId of Object.keys(staff)) {
      staffWages += staff[staffId].salary ?? 0;
    }

    let rideMaintenance = 0;
    for (const rideId of Object.keys(rides)) {
      rideMaintenance += rides[rideId].monthlyMaintenanceCost;
    }

    const loanInterest = loanAmount * (loanInterestRate / 12);

    // Land purchases recorded as transactions during the month
    const landPurchases = Math.abs(this.sumByCategory('land-purchase'));

    const totalExpenses = staffWages + rideMaintenance + loanInterest + landPurchases;
    const netProfit = totalRevenue - totalExpenses;
    const cashBalance = money + netProfit;

    const report: FinancialReport = {
      month: date.month,
      year: date.year,
      rideRevenue,
      shopRevenue,
      entranceFeeRevenue,
      totalRevenue,
      staffWages,
      rideMaintenance,
      loanInterest,
      landPurchases,
      totalExpenses,
      netProfit,
      cashBalance,
    };

    // Clear transactions for the new month
    this.transactions = [];

    // NOTE: time events (day/month/year) are owned by GameLoop. EconomyManager
    // must NOT emit 'month' here, or it would re-enter the game loop's month
    // handler (which calls processMonth) and recurse infinitely.

    return report;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Check whether the player can afford a given expense.
   */
  canAfford(money: number, amount: number): boolean {
    return money >= amount;
  }

  /**
   * Return the maximum loan the player can take out.
   */
  getMaxLoan(): number {
    return MAX_LOAN;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Sum all transaction amounts matching a given category.
   */
  private sumByCategory(category: string): number {
    let total = 0;
    for (const tx of this.transactions) {
      if (tx.category === category) {
        total += tx.amount;
      }
    }
    return total;
  }
}
