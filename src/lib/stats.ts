/**
 * Track-record statistics from closed trades. Used for the published dataset and,
 * later, for judging whether an agent is ready for real capital.
 */
export interface TradeLike {
  pnl: number;
  openedAt: number;
  closedAt: number;
}

export interface TrackStats {
  trades: number;
  wins: number;
  winRate: number | null;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  /** Gross profit ÷ gross loss; null with no losing trades. */
  profitFactor: number | null;
  /** Average P&L per trade. */
  expectancy: number | null;
  /** Largest peak-to-trough fall of realized equity, as a fraction of the peak. */
  maxDrawdown: number;
  /** Share of total profit that came from the single best trade. */
  bestTradeShare: number | null;
  returnPct: number;
  activeDays: number;
  avgHoldMs: number | null;
  firstTradeAt: number | null;
  lastTradeAt: number | null;
}

export function trackStats(trades: TradeLike[], startingBalance: number): TrackStats {
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let best = 0;
  let wins = 0;
  let held = 0;
  const days = new Set<string>();
  for (const t of sorted) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    if (t.pnl > 0) {
      wins++;
      grossProfit += t.pnl;
      best = Math.max(best, t.pnl);
    } else grossLoss += -t.pnl;
    held += t.closedAt - t.openedAt;
    days.add(new Date(t.closedAt).toISOString().slice(0, 10));
  }
  const n = sorted.length;
  const netPnl = grossProfit - grossLoss;
  return {
    trades: n,
    wins,
    winRate: n ? wins / n : null,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: n ? netPnl / n : null,
    maxDrawdown,
    bestTradeShare: grossProfit > 0 ? best / grossProfit : null,
    returnPct: startingBalance ? netPnl / startingBalance : 0,
    activeDays: days.size,
    avgHoldMs: n ? held / n : null,
    firstTradeAt: n ? sorted[0].closedAt : null,
    lastTradeAt: n ? sorted[n - 1].closedAt : null,
  };
}
