import type { TrackStats } from "./stats";

/**
 * Readiness checks: what a simulated track record has to show before an agent could
 * be considered for real capital. Win rate alone is easy to game (take tiny profits,
 * never close losers), so it is one signal among several. All of these are computed
 * from the verified ledger, the same record published in the open dataset.
 */
export const READINESS = {
  minDays: 30, // calendar days since the account started
  minActiveDays: 15, // days with at least one closed trade
  minTrades: 100,
  minProfitFactor: 1.3, // gross profit ÷ gross loss
  maxDrawdown: 0.15, // worst peak-to-trough fall of realized equity
  maxBestTradeShare: 0.25, // no single trade may be more than this share of total profit
  minWinRate: 0.55,
} as const;

export type CheckId = "days" | "activeDays" | "trades" | "profitFactor" | "drawdown" | "concentration" | "winRate";

export interface Check {
  id: CheckId;
  label: string;
  /** What the check asks for, in words. */
  target: string;
  /** The account's current value, formatted. */
  value: string;
  pass: boolean;
  /**
   * "reach": a goal to build up to; `progress` is how far along (0..1).
   * "limit": a ceiling to stay under; `progress` is how much of it is used (0..1+).
   */
  kind: "reach" | "limit";
  progress: number;
  /** One line on what it means or what's missing. */
  note: string;
}

export interface Readiness {
  checks: Check[];
  passed: number;
  total: number;
  ready: boolean;
  /** Day N of the evaluation window. */
  day: number;
}

const pct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function readiness(stats: TrackStats, startedAt: number, now = Date.now()): Readiness {
  const R = READINESS;
  const day = Math.max(1, Math.floor((now - startedAt) / 86_400_000) + 1);
  const days = Math.floor((now - startedAt) / 86_400_000);
  const pf =
    stats.grossLoss > 0 ? stats.grossProfit / stats.grossLoss : stats.grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const left = (n: number, unit: string) => `${n} more ${unit}${n === 1 ? "" : "s"} to go`;

  const checks: Check[] = [
    {
      id: "days",
      kind: "reach",
      label: "Time",
      target: `${R.minDays} days`,
      value: `${Math.min(days, R.minDays)} of ${R.minDays} days`,
      pass: days >= R.minDays,
      progress: clamp01(days / R.minDays),
      note: days >= R.minDays ? "Long enough to see more than one kind of market" : left(R.minDays - days, "day"),
    },
    {
      id: "activeDays",
      kind: "reach",
      label: "Active days",
      target: `${R.minActiveDays} days with a closed trade`,
      value: `${stats.activeDays} of ${R.minActiveDays}`,
      pass: stats.activeDays >= R.minActiveDays,
      progress: clamp01(stats.activeDays / R.minActiveDays),
      note:
        stats.activeDays >= R.minActiveDays
          ? "Trading spread across the month, not one lucky session"
          : left(R.minActiveDays - stats.activeDays, "trading day"),
    },
    {
      id: "trades",
      kind: "reach",
      label: "Closed trades",
      target: `${R.minTrades} trades`,
      value: `${stats.trades} of ${R.minTrades}`,
      pass: stats.trades >= R.minTrades,
      progress: clamp01(stats.trades / R.minTrades),
      note: stats.trades >= R.minTrades ? "Enough trades for the numbers to mean something" : left(R.minTrades - stats.trades, "trade"),
    },
    {
      id: "profitFactor",
      kind: "reach",
      label: "Profit factor",
      target: `at least ${R.minProfitFactor}`,
      value: pf == null ? "No trades yet" : pf === Number.POSITIVE_INFINITY ? "No losing trades" : pf.toFixed(2),
      pass: pf != null && pf >= R.minProfitFactor,
      progress: pf == null ? 0 : clamp01(pf === Number.POSITIVE_INFINITY ? 1 : pf / R.minProfitFactor),
      note: "Gross profit divided by gross loss: what each dollar lost earned back",
    },
    {
      id: "drawdown",
      label: "Max drawdown",
      target: `under ${pct(R.maxDrawdown, 0)}`,
      value: pct(stats.maxDrawdown, 2),
      kind: "limit",
      pass: stats.trades > 0 && stats.maxDrawdown < R.maxDrawdown,
      progress: stats.maxDrawdown / R.maxDrawdown,
      note: "Worst fall from a peak in closed-trade equity. The bar shows how much of the limit is used",
    },
    {
      id: "concentration",
      label: "Best trade share",
      target: `under ${pct(R.maxBestTradeShare, 0)} of profit`,
      value: stats.bestTradeShare == null ? "No profit yet" : pct(stats.bestTradeShare),
      kind: "limit",
      pass: stats.bestTradeShare != null && stats.bestTradeShare < R.maxBestTradeShare,
      progress: stats.bestTradeShare == null ? 0 : stats.bestTradeShare / R.maxBestTradeShare,
      note: "Profit should come from many trades, not one big win",
    },
    {
      id: "winRate",
      kind: "reach",
      label: "Win rate",
      target: `at least ${pct(R.minWinRate, 0)}`,
      value: stats.winRate == null ? "No trades yet" : pct(stats.winRate),
      pass: stats.winRate != null && stats.winRate >= R.minWinRate,
      progress: stats.winRate == null ? 0 : clamp01(stats.winRate / R.minWinRate),
      note: "One signal among the others, never enough on its own",
    },
  ];
  const passed = checks.filter((c) => c.pass).length;
  return { checks, passed, total: checks.length, ready: passed === checks.length, day };
}
