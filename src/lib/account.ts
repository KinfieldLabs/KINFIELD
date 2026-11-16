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

export interface Sharing {
  agentId: string;
  decided: boolean;
  publishData: boolean;
  showLogin: boolean;
  publishRationale: boolean;
  repo: string;
}

export interface Me {
  user: { login: string; name: string | null; avatarUrl: string | null; sharing: Sharing } | null;
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
  /** Saves data-sharing choices; resolves to an error message or null. */
  const saveSharing = useCallback(
    async (c: Partial<Pick<Sharing, "publishData" | "showLogin" | "publishRationale">>) => {
      try {
        await call("/api/me/sharing", { method: "POST", body: JSON.stringify(c) });
        load();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [load],
  );
  return { me, signOut, saveSharing };
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

export type OpenResult =
  | {
      ok: true;
      filled: boolean;
      /** The price it filled at (market orders). */
      px?: number;
      /** Click to confirmed fill, as measured in this browser. */
      roundTripMs?: number;
      /** Time spent on the server, including fetching the fill price. */
      serverMs?: number;
    }
  | { ok: false; error: string };

export interface Ledger {
  mode: "guest" | "account";
  state: AccountView;
  startingBalance: number;
  ready: boolean;
  ledger?: { entries: number; head: string };
  /** When the current signed-in account was opened (its evaluation started). */
  accountCreatedAt?: number;
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
  createdAt: number;
  startingBalance: number;
  cash: number;
  positions: Position[];
  orders: Order[];
  history: ClosedTrade[];
  ledger: { entries: number; head: string };
}

interface PlaceResponse {
  position?: Position;
  order?: Order;
  cash: number;
  fill: { px: number; at: number };
  timing: { priceMs: number; serverMs: number };
}

interface CloseResponse {
  trade: ClosedTrade;
  cash: number;
  triggered: boolean;
  timing: { priceMs: number; serverMs: number };
}

const REASON_TEXT: Record<string, string> = {
  stop_loss: "its stop loss",
  take_profit: "its take profit",
  liquidation: "its liquidation price",
};

/**
 * Signed-in: every fill goes through the server ledger. Each action's response carries the
 * new position and cash, so the view updates the moment it arrives, without a second request.
 */
function useAccountLedger(enabled: boolean): Ledger {
  const [s, setS] = useState<ServerState | null>(null);
  /** Bumped whenever an action's result is applied; older refreshes are then ignored. */
  const version = useRef(0);
  const pending = useRef(0);
  const lastPoke = useRef(0);

  const refresh = useCallback(async () => {
    const v = version.current;
    try {
      const st = await call<ServerState>("/api/sim/state");
      // A refresh that started before a newer action finished would briefly undo it
      if (v === version.current) setS(st);
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // The server replays price history for fills and triggers on every read
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  /** Runs an action and applies its result straight away. On an error, re-reads the account. */
  const act = useCallback(
    async <R,>(fn: () => Promise<R>, apply: (r: R, cur: ServerState) => ServerState) => {
      pending.current++;
      try {
        const r = await fn();
        version.current++;
        setS((cur) => (cur ? apply(r, cur) : cur));
        return { ok: true as const, r };
      } catch (e) {
        void refresh();
        return { ok: false as const, error: (e as Error).message };
      } finally {
        pending.current--;
      }
    },
    [refresh],
  );

  const poke = useCallback(() => {
    if (pending.current || Date.now() - lastPoke.current < 3000) return;
    lastPoke.current = Date.now();
    refresh();
  }, [refresh]);

  const post = <R,>(url: string, body?: unknown) => () =>
    call<R>(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    mode: "account",
    ready: !!s,
    state: s ?? { cash: STARTING_BALANCE, positions: [], orders: [], history: [] },
    startingBalance: s?.startingBalance ?? STARTING_BALANCE,
    ledger: s?.ledger,
    accountCreatedAt: s?.createdAt,
    open: async (o) => {
      const clicked = performance.now();
      const res = await act(
        post<PlaceResponse>("/api/sim/orders", {
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
        (r, cur) => ({
          ...cur,
          cash: r.cash,
          positions: r.position ? [r.position, ...cur.positions] : cur.positions,
          orders: r.order ? [r.order, ...cur.orders] : cur.orders,
        }),
      );
      if (!res.ok) return res;
      return {
        ok: true,
        filled: !!res.r.position,
        px: res.r.position ? res.r.fill.px : undefined,
        roundTripMs: Math.round(performance.now() - clicked),
        serverMs: res.r.timing.serverMs,
      };
    },
    close: async (p) => {
      const res = await act(post<CloseResponse>(`/api/sim/positions/${p.id}/close`, { coin: p.coin }), (r, cur) => ({
        ...cur,
        cash: r.cash,
        positions: cur.positions.filter((x) => x.id !== r.trade.id),
        history: [r.trade, ...cur.history],
      }));
      if (!res.ok) return res.error;
      const t = res.r.trade;
      return res.r.triggered && t.exitReason && REASON_TEXT[t.exitReason]
        ? `${t.coin} had already reached ${REASON_TEXT[t.exitReason]} before you closed it, so it closed there.`
        : null;
    },
    cancel: async (o) => {
      const res = await act(post<{ order: Order }>(`/api/sim/orders/${o.id}/cancel`), (r, cur) => ({
        ...cur,
        orders: cur.orders.filter((x) => x.id !== r.order.id),
      }));
      return res.ok ? null : res.error;
    },
    setTpSl: async (p, tpPx, slPx) => {
      const res = await act(post<{ position: Position }>(`/api/sim/positions/${p.id}/tpsl`, { tpPx, slPx }), (r, cur) => ({
        ...cur,
        positions: cur.positions.map((x) => (x.id === r.position.id ? r.position : x)),
      }));
      return res.ok ? null : res.error;
    },
    fire: () => poke(),
    poke,
    reset: async () => {
      await call("/api/sim/reset", { method: "POST" }).catch(() => {});
      version.current++;
      await refresh();
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
      return { ok: true, filled: true, px: o.entryPx, roundTripMs: 0 };
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
