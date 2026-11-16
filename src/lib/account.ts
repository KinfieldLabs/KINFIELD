"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STARTING_BALANCE, useSimulator, type ClosedTrade, type Position, type Side, type SimState, type Strategy } from "./sim";

export interface Me {
  user: { login: string; name: string | null; avatarUrl: string | null } | null;
  signIn: { available: boolean; github: boolean; dev: boolean };
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const load = useCallback(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null, signIn: { available: false, github: false, dev: false } }));
  }, []);
  useEffect(load, [load]);
  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    load();
  }, [load]);
  return { me, signOut };
}

export interface OrderRequest {
  coin: string;
  side: Side;
  sizeUsd: number;
  leverage: number;
  strategy: Strategy;
  rationale: string;
  // Guest mode only: in a signed-in account the server sets these itself
  entryPx: number;
  entryFeatures: Position["entryFeatures"];
}

export interface Ledger {
  mode: "guest" | "account";
  state: SimState;
  startingBalance: number;
  ready: boolean;
  ledger?: { entries: number; head: string };
  /** Resolves to an error message, or null when the order filled. */
  open: (o: OrderRequest) => Promise<string | null>;
  close: (p: Position, px: number) => Promise<string | null>;
  /** A position crossed its liquidation price on the live feed. */
  liquidated: (p: Position, px: number) => void;
  reset: () => Promise<void>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

interface ServerState {
  startingBalance: number;
  cash: number;
  positions: Position[];
  history: ClosedTrade[];
  ledger: { entries: number; head: string };
}

/** Signed-in: every fill goes through the server ledger. */
function useAccountLedger(enabled: boolean): Ledger {
  const [s, setS] = useState<ServerState | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setS(await call<ServerState>("/api/sim/state"));
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // The server sweeps for liquidations on every read
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy.current) return "Still working on the last order";
      busy.current = true;
      try {
        await fn();
        return null;
      } catch (e) {
        return (e as Error).message;
      } finally {
        busy.current = false;
        await refresh();
      }
    },
    [refresh],
  );

  return {
    mode: "account",
    ready: !!s,
    state: s ?? { cash: STARTING_BALANCE, positions: [], history: [] },
    startingBalance: s?.startingBalance ?? STARTING_BALANCE,
    ledger: s?.ledger,
    open: (o) =>
      act(() =>
        call("/api/sim/orders", {
          method: "POST",
          body: JSON.stringify({
            coin: o.coin,
            side: o.side,
            sizeUsd: o.sizeUsd,
            leverage: o.leverage,
            strategy: o.strategy,
            rationale: o.rationale,
          }),
        }),
      ),
    close: (p) => act(() => call(`/api/sim/positions/${p.id}/close`, { method: "POST" })),
    liquidated: () => {
      if (!busy.current) refresh();
    },
    reset: async () => {
      await act(() => call("/api/sim/reset", { method: "POST" }));
    },
  };
}

/** Signed-out: the original in-browser simulator. Nothing leaves the browser. */
function useGuestLedger(): Ledger {
  const { state, open, close, reset } = useSimulator();
  return {
    mode: "guest",
    ready: true,
    state,
    startingBalance: STARTING_BALANCE,
    open: async (o) => {
      open({ ...o });
      return null;
    },
    close: async (p, px) => {
      close(p.id, px);
      return null;
    },
    liquidated: (p, px) => close(p.id, px, true),
    reset: async () => reset(),
  };
}

export function useLedger(signedIn: boolean): Ledger {
  const guest = useGuestLedger();
  const account = useAccountLedger(signedIn);
  return signedIn ? account : guest;
}
