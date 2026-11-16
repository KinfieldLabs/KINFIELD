import type { MarketFeatures } from "./features";

/** Simulator rules shared by the browser (guest mode) and the server ledger. */
export const STARTING_BALANCE = 100_000;
export const TAKER_FEE = 0.00045; // Hyperliquid base taker fee tier
export const MAKER_FEE = 0.00015; // Hyperliquid base maker fee tier (resting limit orders)

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
  entryFee?: number; // taker for market orders, maker for filled limit orders
  tpPx?: number | null;
  slPx?: number | null;
}

export type ExitReason = "manual" | "take_profit" | "stop_loss" | "liquidation";

export interface Order {
  id: string;
  coin: string;
  side: Side;
  sizeUsd: number;
  leverage: number;
  limitPx: number;
  tpPx: number | null;
  slPx: number | null;
  strategy: Strategy;
  rationale: string;
  placedAt: number;
}

/** Margin plus maker fee held back while a limit order rests. */
export const reserved = (o: Pick<Order, "sizeUsd" | "leverage">) => o.sizeUsd / o.leverage + o.sizeUsd * MAKER_FEE;

export interface ClosedTrade extends Position {
  exitPx: number;
  closedAt: number;
  pnl: number; // net of fees
  fees: number;
  liquidated: boolean;
  exitReason?: ExitReason;
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
  const fees = (p.entryFee ?? entryFee(p.sizeUsd)) + exitFee;
  return { fees, pnl: gross - fees, cashDelta: gross - exitFee };
}

/**
 * Checks take-profit / stop-loss prices against the side and a reference price
 * (current price, or the limit price for a resting order). Returns an error or null.
 */
export function checkTpSl(
  side: Side,
  ref: number,
  tp: number | null | undefined,
  sl: number | null | undefined,
  refLabel = "entry price",
) {
  const up = side === "long";
  if (tp != null && (!(tp > 0) || (up ? tp <= ref : tp >= ref)))
    return `Take profit must be ${up ? "above" : "below"} ${refLabel}`;
  if (sl != null && (!(sl > 0) || (up ? sl >= ref : sl <= ref)))
    return `Stop loss must be ${up ? "below" : "above"} ${refLabel}`;
  return null;
}

/**
 * Which trigger a position hits inside a price range (a bar's low and high, or a
 * single live price). When a range touches both a protective level and the take
 * profit, the worse outcome is assumed to have happened first: a bar doesn't say
 * which came first, and the record must never flatter the agent.
 */
export function triggerHit(p: Position, lo: number, hi: number): { px: number; reason: ExitReason } | null {
  const liq = liquidationPx(p);
  const guards = [
    { px: p.slPx, reason: "stop_loss" as const },
    { px: liq, reason: "liquidation" as const },
  ].filter((g): g is { px: number; reason: "stop_loss" | "liquidation" } => g.px != null);
  if (p.side === "long") {
    const hit = guards.filter((g) => lo <= g.px);
    if (hit.length) return hit.reduce((a, b) => (b.px > a.px ? b : a));
    if (p.tpPx != null && hi >= p.tpPx) return { px: p.tpPx, reason: "take_profit" };
  } else {
    const hit = guards.filter((g) => hi >= g.px);
    if (hit.length) return hit.reduce((a, b) => (b.px < a.px ? b : a));
    if (p.tpPx != null && lo <= p.tpPx) return { px: p.tpPx, reason: "take_profit" };
  }
  return null;
}

/** Whether a resting limit order would fill inside a price range. */
export const limitCrossed = (o: Pick<Order, "side" | "limitPx">, lo: number, hi: number) =>
  o.side === "long" ? lo <= o.limitPx : hi >= o.limitPx;

/** Price at which a position's losses consume its margin. */
export function liquidationPx(p: Pick<Position, "side" | "entryPx" | "leverage">): number {
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
          exit_reason: t.exitReason ?? (t.liquidated ? "liquidation" : "manual"),
        },
      }),
    )
    .join("\n");
}
