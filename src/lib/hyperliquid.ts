/** Markets shown first; every listed perp is available in the market picker. */
export const FEATURED = ["BTC", "ETH", "SOL", "HYPE", "XRP", "DOGE"] as const;
export type Coin = string;

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
export const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export interface Candle {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketCtx {
  coin: Coin;
  mid: number;
  mark: number;
  oracle: number;
  prevDay: number;
  change24h: number; // fraction
  volume24h: number; // notional USD
  openInterest: number; // notional USD
  funding: number; // hourly rate
  maxLeverage: number;
  szDecimals: number;
}

async function info<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/hl", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid request failed (${res.status})`);
  return res.json();
}

interface RawCtx {
  midPx: string | null;
  markPx: string;
  oraclePx: string;
  prevDayPx: string;
  dayNtlVlm: string;
  openInterest: string;
  funding: string;
}

interface RawAsset {
  name: string;
  maxLeverage: number;
  szDecimals: number;
  isDelisted?: boolean;
}

/** Every listed perp with its 24h stats, keyed by coin. */
export async function fetchMarkets(): Promise<Record<Coin, MarketCtx>> {
  const [meta, ctxs] = await info<[{ universe: RawAsset[] }, RawCtx[]]>({ type: "metaAndAssetCtxs" });
  const out: Record<Coin, MarketCtx> = {};
  meta.universe.forEach((asset, i) => {
    const c = ctxs[i];
    if (asset.isDelisted || !c) return;
    const mark = Number(c.markPx);
    const mid = Number(c.midPx ?? c.markPx);
    const prevDay = Number(c.prevDayPx);
    out[asset.name] = {
      coin: asset.name,
      mid,
      mark,
      oracle: Number(c.oraclePx),
      prevDay,
      change24h: prevDay ? mid / prevDay - 1 : 0,
      volume24h: Number(c.dayNtlVlm),
      openInterest: Number(c.openInterest) * mark,
      funding: Number(c.funding),
      maxLeverage: asset.maxLeverage,
      szDecimals: asset.szDecimals,
    };
  });
  return out;
}

export async function fetchCandles(coin: Coin, interval: Interval, count = 300): Promise<Candle[]> {
  const endTime = Date.now();
  const startTime = endTime - INTERVAL_MS[interval] * count;
  const raw = await info<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  });
  return raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
}

/**
 * Up to `count` candles that open before `before` (ms). Hyperliquid keeps roughly the
 * latest 5000 candles per interval, so this returns [] once that history runs out.
 */
export async function fetchCandlesBefore(coin: Coin, interval: Interval, before: number, count: number): Promise<Candle[]> {
  const startTime = before - INTERVAL_MS[interval] * count;
  const raw = await info<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime: before - 1 },
  });
  return raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v })).filter((c) => c.t < before);
}
