"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One shared WebSocket to Hyperliquid's public feed, with reference-counted
 * subscriptions, keep-alive pings, and automatic reconnects.
 */

const URL_WS = "wss://api.hyperliquid.xyz/ws";

export type Subscription =
  | { type: "allMids" }
  | { type: "l2Book"; coin: string; nSigFigs?: number | null }
  | { type: "trades"; coin: string }
  | { type: "candle"; coin: string; interval: string }
  | { type: "activeAssetCtx"; coin: string };

type Listener = (data: unknown) => void;

/** Messages carry the channel and coin (and interval for candles), so they route by that. */
const routeOf = (s: Subscription) =>
  s.type === "allMids" ? "allMids" : s.type === "candle" ? `candle:${s.coin}:${s.interval}` : `${s.type}:${s.coin}`;

function routeOfMessage(channel: string, data: unknown): string | null {
  const d = data as Record<string, unknown>;
  switch (channel) {
    case "allMids":
      return "allMids";
    case "l2Book":
    case "activeAssetCtx":
      return `${channel}:${d.coin}`;
    case "trades":
      return Array.isArray(data) && data.length ? `trades:${(data[0] as { coin: string }).coin}` : null;
    case "candle":
      return `candle:${d.s}:${d.i}`;
    default:
      return null;
  }
}

type Status = "connecting" | "live" | "down";

class HlSocket {
  private ws: WebSocket | null = null;
  private subs = new Map<string, { sub: Subscription; count: number }>(); // by exact subscription
  private listeners = new Map<string, Set<Listener>>(); // by route
  private retry = 0;
  private ping: ReturnType<typeof setInterval> | null = null;
  status: Status = "connecting";
  private statusListeners = new Set<(s: Status) => void>();

  private setStatus(s: Status) {
    this.status = s;
    this.statusListeners.forEach((f) => f(s));
  }

  onStatus(f: (s: Status) => void) {
    this.statusListeners.add(f);
    return () => void this.statusListeners.delete(f);
  }

  private connect() {
    if (this.ws || typeof window === "undefined") return;
    this.setStatus("connecting");
    const ws = new WebSocket(URL_WS);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus("live");
      for (const { sub } of this.subs.values()) this.send({ method: "subscribe", subscription: sub });
      this.ping = setInterval(() => this.send({ method: "ping" }), 30_000);
    };
    ws.onmessage = (e) => {
      let m: { channel: string; data: unknown };
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      const route = routeOfMessage(m.channel, m.data);
      if (route) this.listeners.get(route)?.forEach((f) => f(m.data));
    };
    ws.onclose = () => {
      if (this.ping) clearInterval(this.ping);
      this.ws = null;
      this.setStatus("down");
      if (!this.subs.size) return;
      const wait = Math.min(1000 * 2 ** this.retry++, 15_000);
      setTimeout(() => this.connect(), wait);
    };
    ws.onerror = () => ws.close();
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  subscribe(sub: Subscription, f: Listener) {
    const key = JSON.stringify(sub);
    const route = routeOf(sub);
    if (!this.listeners.has(route)) this.listeners.set(route, new Set());
    this.listeners.get(route)!.add(f);
    const entry = this.subs.get(key);
    if (entry) entry.count++;
    else {
      this.subs.set(key, { sub, count: 1 });
      this.send({ method: "subscribe", subscription: sub });
    }
    this.connect();
    return () => {
      this.listeners.get(route)?.delete(f);
      const e = this.subs.get(key);
      if (!e) return;
      if (--e.count <= 0) {
        this.subs.delete(key);
        this.send({ method: "unsubscribe", subscription: sub });
      }
    };
  }
}

let socket: HlSocket | null = null;
const hl = () => (socket ??= new HlSocket());

/** Subscribes while mounted; pass null to pause. */
export function useHl(sub: Subscription | null, onData: Listener) {
  const handler = useRef(onData);
  handler.current = onData;
  const key = sub ? JSON.stringify(sub) : null;
  useEffect(() => {
    if (!key) return;
    return hl().subscribe(JSON.parse(key), (d) => handler.current(d));
  }, [key]);
}

export function useHlStatus(): Status {
  const [s, setS] = useState<Status>("connecting");
  useEffect(() => {
    setS(hl().status);
    return hl().onStatus(setS);
  }, []);
  return s;
}

/** Calls `fn` at most every `ms`, always delivering the latest value. */
export function useThrottled<T>(ms: number): [T | null, (v: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const push = useRef((v: T) => {
    pending.current = v;
    const wait = ms - (Date.now() - last.current);
    if (wait <= 0) {
      last.current = Date.now();
      setValue(v);
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        last.current = Date.now();
        setValue(pending.current);
      }, wait);
    }
  });
  return [value, push.current];
}

// ---------- typed feeds ----------

export interface BookLevel {
  px: number;
  sz: number;
}

export function useAllMids(): Record<string, number> {
  const [mids, push] = useThrottled<Record<string, number>>(1000);
  useHl({ type: "allMids" }, (d) => {
    const raw = (d as { mids: Record<string, string> }).mids;
    const out: Record<string, number> = {};
    for (const k in raw) if (!k.startsWith("@") && !k.startsWith("#")) out[k] = Number(raw[k]);
    push(out);
  });
  return mids ?? {};
}

export function useBook(coin: string, nSigFigs: number | null) {
  const [book, push] = useThrottled<{ coin: string; bids: BookLevel[]; asks: BookLevel[] }>(250);
  useHl({ type: "l2Book", coin, nSigFigs }, (d) => {
    const { coin: c, levels } = d as { coin: string; levels: { px: string; sz: string }[][] };
    const map = (l: { px: string; sz: string }) => ({ px: +l.px, sz: +l.sz });
    push({ coin: c, bids: levels[0].map(map), asks: levels[1].map(map) });
  });
  return book?.coin === coin ? book : null;
}

export interface Print {
  px: number;
  sz: number;
  side: "buy" | "sell";
  time: number;
  id: number;
}

export function useTrades(coin: string, keep = 40): Print[] {
  const [prints, setPrints] = useState<Print[]>([]);
  useEffect(() => setPrints([]), [coin]);
  useHl({ type: "trades", coin }, (d) => {
    const fresh = (d as { px: string; sz: string; side: "A" | "B"; time: number; tid: number; coin: string }[])
      .filter((t) => t.coin === coin)
      .map((t) => ({ px: +t.px, sz: +t.sz, side: t.side === "B" ? "buy" : "sell", time: t.time, id: t.tid }) as Print)
      .reverse();
    setPrints((p) => [...fresh, ...p].slice(0, keep));
  });
  return prints;
}

export interface AssetCtx {
  coin: string;
  mark: number;
  oracle: number;
  mid: number;
  prevDay: number;
  dayVolume: number;
  openInterest: number; // in coin
  funding: number; // hourly
}

export function useAssetCtx(coin: string): AssetCtx | null {
  const [ctx, push] = useThrottled<AssetCtx>(500);
  useHl({ type: "activeAssetCtx", coin }, (d) => {
    const { coin: c, ctx: x } = d as { coin: string; ctx: Record<string, string> };
    push({
      coin: c,
      mark: +x.markPx,
      oracle: +x.oraclePx,
      mid: +(x.midPx ?? x.markPx),
      prevDay: +x.prevDayPx,
      dayVolume: +x.dayNtlVlm,
      openInterest: +x.openInterest,
      funding: +x.funding,
    });
  });
  return ctx?.coin === coin ? ctx : null;
}
