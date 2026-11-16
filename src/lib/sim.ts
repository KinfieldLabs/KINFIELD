"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { closeOutcome, entryFee, STARTING_BALANCE, type ClosedTrade, type Position, type SimState } from "./sim-core";

export * from "./sim-core";

const initial: SimState = { cash: STARTING_BALANCE, positions: [], history: [] };

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
    case "open":
      return { ...s, cash: s.cash - entryFee(a.position.sizeUsd), positions: [a.position, ...s.positions] };
    case "close": {
      const p = s.positions.find((x) => x.id === a.id);
      if (!p) return s;
      const { fees, pnl, cashDelta } = closeOutcome(p, a.px, !!a.liquidated);
      const trade: ClosedTrade = { ...p, exitPx: a.px, closedAt: Date.now(), fees, pnl, liquidated: !!a.liquidated };
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
  const close = useCallback((id: string, px: number, liquidated = false) => {
    dispatch({ type: "close", id, px, liquidated });
  }, []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, open, close, reset };
}
