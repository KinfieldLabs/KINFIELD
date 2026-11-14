"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MarketFeatures } from "./features";

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

const initial: SimState = { cash: STARTING_BALANCE, positions: [], history: [] };

export const margin = (p: Position) => p.sizeUsd / p.leverage;
export const qty = (p: Position) => p.sizeUsd / p.entryPx;
export const unrealized = (p: Position, px: number) => (p.side === "long" ? 1 : -1) * qty(p) * (px - p.entryPx);

type Action =
  | { type: "load"; state: SimState }
  | { type: "open"; position: Position }
  | { type: "close"; id: string; px: number; liquidated?: boolean }
  | { type: "reset" };

function reducer(s: SimState, a: Action): SimState {
  switch (a.type) {
    case "load":
      return a.state;
    case "reset":
      return initial;
    case "open": {
      const fee = a.position.sizeUsd * TAKER_FEE;
      return { ...s, cash: s.cash - fee, positions: [a.position, ...s.positions] };
    }
    case "close": {
      const p = s.positions.find((x) => x.id === a.id);
      if (!p) return s;
      const exitFee = qty(p) * a.px * TAKER_FEE;
      const gross = a.liquidated ? -margin(p) : unrealized(p, a.px);
      const entryFee = p.sizeUsd * TAKER_FEE;
      const trade: ClosedTrade = {
        ...p,
        exitPx: a.px,
        closedAt: Date.now(),
        fees: entryFee + exitFee,
        pnl: gross - entryFee - exitFee,
        liquidated: !!a.liquidated,
      };
      return {
        cash: s.cash + gross - exitFee,
        positions: s.positions.filter((x) => x.id !== a.id),
        history: [trade, ...s.history],
      };
    }
  }
}

const KEY = "kinfield.sim.v1";

export function useSimulator() {
  const [state, dispatch] = useReducer(reducer, initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: "load", state: JSON.parse(raw) });
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const open = useCallback((p: Omit<Position, "id" | "openedAt">) => {
    dispatch({ type: "open", position: { ...p, id: crypto.randomUUID(), openedAt: Date.now() } });
  }, []);
  const close = useCallback((id: string, px: number, liquidated = false) => {
    dispatch({ type: "close", id, px, liquidated });
  }, []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, open, close, reset };
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
