export const MARKETS = ["BTC", "ETH", "SOL", "HYPE", "XRP", "DOGE"] as const;
export type Coin = string;

export type Interval = "1m" | "5m" | "15m" | "1h";
export const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
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
  prevDay: number;
  change24h: number; // fraction
  volume24h: number; // notional USD
  funding: number; // hourly rate
  maxLeverage: number;
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
  prevDayPx: string;
  dayNtlVlm: string;
  funding: string;
}

export async function fetchMarkets(coins: readonly string[] = MARKETS): Promise<Record<Coin, MarketCtx>> {
  const [meta, ctxs] = await info<[{ universe: { name: string; maxLeverage: number }[] }, RawCtx[]]>({
    type: "metaAndAssetCtxs",
  });
  const out: Record<Coin, MarketCtx> = {};
  meta.universe.forEach((asset, i) => {
    if (!coins.includes(asset.name)) return;
    const c = ctxs[i];
    const mid = Number(c.midPx ?? c.markPx);
    const prevDay = Number(c.prevDayPx);
    out[asset.name] = {
      coin: asset.name,
      mid,
      prevDay,
      change24h: prevDay ? mid / prevDay - 1 : 0,
      volume24h: Number(c.dayNtlVlm),
      funding: Number(c.funding),
      maxLeverage: asset.maxLeverage,
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
