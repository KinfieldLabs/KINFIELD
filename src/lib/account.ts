"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkTpSl,
  STARTING_BALANCE,
  useSimulator,
  type ClosedTrade,
  type ExitReason,
  type Order,
  type Position,
  type Side,
  type SimState,
  type Strategy,
} from "./sim";

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
  type: "market" | "limit";
  limitPx: number | null;
  sizeUsd: number;
  leverage: number;
  tpPx: number | null;
  slPx: number | null;
  strategy: Strategy;
  rationale: string;
  // Guest mode only: in a signed-in account the server sets these itself
  entryPx: number;
  entryFeatures: Position["entryFeatures"];
}

export type AccountView = SimState & { orders: Order[] };

export type OpenResult = { ok: true; filled: boolean } | { ok: false; error: string };

export interface Ledger {
  mode: "guest" | "account";
  state: AccountView;
  startingBalance: number;
  ready: boolean;
  ledger?: { entries: number; head: string };
  /** Resolves to what happened to the order, or an error message. */
  open: (o: OrderRequest) => Promise<OpenResult>;
  /** The other actions resolve to an error message, or null on success. */
  close: (p: Position, px: number) => Promise<string | null>;
  cancel: (o: Order) => Promise<string | null>;
  setTpSl: (p: Position, tpPx: number | null, slPx: number | null, px: number) => Promise<string | null>;
  /** The live price crossed one of this position's triggers. */
  fire: (p: Position, hit: { px: number; reason: ExitReason }) => void;
  /** The live price crossed a resting order's limit (account mode re-checks with the server). */
  poke: () => void;
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
  orders: Order[];
  history: ClosedTrade[];
  ledger: { entries: number; head: string };
}

/** Signed-in: every fill goes through the server ledger. */
function useAccountLedger(enabled: boolean): Ledger {
  const [s, setS] = useState<ServerState | null>(null);
  const busy = useRef(false);
  const lastPoke = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setS(await call<ServerState>("/api/sim/state"));
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // The server replays price history for fills and triggers on every read
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy.current) return "Still working on the last request";
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

  const poke = useCallback(() => {
    if (busy.current || Date.now() - lastPoke.current < 3000) return;
    lastPoke.current = Date.now();
    refresh();
  }, [refresh]);

  const post = (url: string, body?: unknown) =>
    act(() => call(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }));

  return {
    mode: "account",
    ready: !!s,
    state: s ?? { cash: STARTING_BALANCE, positions: [], orders: [], history: [] },
    startingBalance: s?.startingBalance ?? STARTING_BALANCE,
    ledger: s?.ledger,
    open: async (o) => {
      let res: { position?: Position; order?: Order } = {};
      const error = await act(async () => {
        res = await call("/api/sim/orders", {
          method: "POST",
          body: JSON.stringify({
        coin: o.coin,
        side: o.side,
        type: o.type,
        limitPx: o.limitPx,
        sizeUsd: o.sizeUsd,
        leverage: o.leverage,
        tpPx: o.tpPx,
        slPx: o.slPx,
            strategy: o.strategy,
            rationale: o.rationale,
          }),
        });
      });
      return error ? { ok: false, error } : { ok: true, filled: !!res.position };
    },
    close: (p) => post(`/api/sim/positions/${p.id}/close`),
    cancel: (o) => post(`/api/sim/orders/${o.id}/cancel`),
    setTpSl: (p, tpPx, slPx) => post(`/api/sim/positions/${p.id}/tpsl`, { tpPx, slPx }),
    fire: () => poke(),
    poke,
    reset: async () => {
      await post("/api/sim/reset");
    },
  };
}

/** Signed-out: the in-browser simulator. Nothing leaves the browser. */
function useGuestLedger(): Ledger {
  const sim = useSimulator();
  return {
    mode: "guest",
    ready: true,
    state: { ...sim.state, orders: [] },
    startingBalance: STARTING_BALANCE,
    open: async (o) => {
      if (o.type === "limit") return { ok: false, error: "Sign in to place limit orders" };
      const err = checkTpSl(o.side, o.entryPx, o.tpPx, o.slPx);
      if (err) return { ok: false, error: err };
      sim.open({
        coin: o.coin,
        side: o.side,
        sizeUsd: o.sizeUsd,
        leverage: o.leverage,
        entryPx: o.entryPx,
        strategy: o.strategy,
        rationale: o.rationale,
        entryFeatures: o.entryFeatures,
        tpPx: o.tpPx,
        slPx: o.slPx,
      });
      return { ok: true, filled: true };
    },
    close: async (p, px) => {
      sim.close(p.id, px);
      return null;
    },
    cancel: async () => null,
    setTpSl: async (p, tpPx, slPx, px) => {
      const err = checkTpSl(p.side, px, tpPx, slPx, "the current price");
      if (err) return err;
      sim.setTpSl(p.id, tpPx, slPx);
      return null;
    },
    fire: (p, hit) => sim.close(p.id, hit.px, hit.reason),
    poke: () => {},
    reset: async () => sim.reset(),
  };
}

export function useLedger(signedIn: boolean): Ledger {
  const guest = useGuestLedger();
  const account = useAccountLedger(signedIn);
  return signedIn ? account : guest;
}
