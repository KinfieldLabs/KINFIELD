"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  closeOutcome,
  entryFee,
  STARTING_BALANCE,
  type ClosedTrade,
  type ExitReason,
  type Position,
  type SimState,
} from "./sim-core";

export * from "./sim-core";

const initial: SimState = { cash: STARTING_BALANCE, positions: [], history: [] };

type Action =
  | { type: "load"; state: SimState }
  | { type: "open"; position: Position }
  | { type: "close"; id: string; px: number; reason: ExitReason }
  | { type: "tpsl"; id: string; tpPx: number | null; slPx: number | null }
  | { type: "reset" };

function reducer(s: SimState, a: Action): SimState {
  switch (a.type) {
    case "load":
      return a.state;
    case "reset":
      return initial;
    case "open":
      return { ...s, cash: s.cash - entryFee(a.position.sizeUsd), positions: [a.position, ...s.positions] };
    case "tpsl":
      return {
        ...s,
        positions: s.positions.map((p) => (p.id === a.id ? { ...p, tpPx: a.tpPx, slPx: a.slPx } : p)),
      };
    case "close": {
      const p = s.positions.find((x) => x.id === a.id);
      if (!p) return s;
      const liquidated = a.reason === "liquidation";
      const { fees, pnl, cashDelta } = closeOutcome(p, a.px, liquidated);
      const trade: ClosedTrade = {
        ...p,
        exitPx: a.px,
        closedAt: Date.now(),
        fees,
        pnl,
        liquidated,
        exitReason: a.reason,
      };
      return {
        cash: s.cash + cashDelta,
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
  const close = useCallback((id: string, px: number, reason: ExitReason = "manual") => {
    dispatch({ type: "close", id, px, reason });
  }, []);
  const setTpSl = useCallback((id: string, tpPx: number | null, slPx: number | null) => {
    dispatch({ type: "tpsl", id, tpPx, slPx });
  }, []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, open, close, setTpSl, reset };
}
