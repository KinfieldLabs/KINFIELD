import type { MarketFeatures } from "./features";

/** Simulator rules shared by the browser (guest mode) and the server ledger. */
export const STARTING_BALANCE = 100_000;
export const TAKER_FEE = 0.00045; // Hyperliquid base taker fee tier

export type Side = "long" | "short";

export const STRATEGIES = ["Momentum", "Mean reversion", "Breakout", "Range", "News / event", "Hedge", "Other"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export interface Position {
  id: string;
  coin: string;
  side: Side;
  sizeUsd: number; // notional at entry
  leverage: number;
  entryPx: number;
  openedAt: number;
  strategy: Strategy;
  rationale: string;
  entryFeatures: MarketFeatures | null;
}

export interface ClosedTrade extends Position {
  exitPx: number;
  closedAt: number;
  pnl: number; // net of fees
  fees: number;
  liquidated: boolean;
}

export interface SimState {
  cash: number;
  positions: Position[];
  history: ClosedTrade[];
}

export const margin = (p: Position) => p.sizeUsd / p.leverage;
export const qty = (p: Position) => p.sizeUsd / p.entryPx;
export const unrealized = (p: Position, px: number) => (p.side === "long" ? 1 : -1) * qty(p) * (px - p.entryPx);

export const entryFee = (sizeUsd: number) => sizeUsd * TAKER_FEE;

/** What closing `p` at `px` does: realized P&L net of both fees, and the change to cash. */
export function closeOutcome(p: Position, px: number, liquidated: boolean) {
  const exitFee = qty(p) * px * TAKER_FEE;
  const gross = liquidated ? -margin(p) : unrealized(p, px);
  const fees = entryFee(p.sizeUsd) + exitFee;
  return { fees, pnl: gross - fees, cashDelta: gross - exitFee };
}

/** Price at which a position's losses consume its margin. */
export function liquidationPx(p: Position): number {
  const move = p.entryPx / p.leverage;
  return p.side === "long" ? p.entryPx - move : p.entryPx + move;
}

export function toJsonl(trades: ClosedTrade[]): string {
  return trades
    .slice()
    .reverse()
    .map((t) =>
      JSON.stringify({
        market: t.coin,
        opened_at: new Date(t.openedAt).toISOString(),
        closed_at: new Date(t.closedAt).toISOString(),
        context: t.entryFeatures,
        action: { side: t.side, size_usd: t.sizeUsd, leverage: t.leverage },
        intent: { strategy: t.strategy, rationale: t.rationale },
        outcome: {
          entry_px: t.entryPx,
          exit_px: t.exitPx,
          pnl_usd: +t.pnl.toFixed(2),
          return_on_margin: +(t.pnl / margin(t)).toFixed(4),
          liquidated: t.liquidated,
        },
      }),
    )
    .join("\n");
}
