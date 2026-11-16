import type { Candle } from "@/lib/hyperliquid";

/** Server-side Hyperliquid reads. Fill prices come from here, never from the browser. */
const HL_INFO = "https://api.hyperliquid.xyz/info";

async function info<T>(body: unknown): Promise<T> {
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid request failed (${res.status})`);
  return res.json();
}

let midsCache: { at: number; mids: Record<string, number> } | null = null;

/** Current mid price for every perp. Cached for one second. */
export async function mids(): Promise<Record<string, number>> {
  if (midsCache && Date.now() - midsCache.at < 1000) return midsCache.mids;
  const raw = await info<Record<string, string>>({ type: "allMids" });
  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith("@")) m[k] = Number(v);
  midsCache = { at: Date.now(), mids: m };
  return m;
}

let metaCache: { at: number; maxLev: Record<string, number> } | null = null;

/** Max leverage per listed perp. Cached for ten minutes. */
export async function maxLeverage(): Promise<Record<string, number>> {
  if (metaCache && Date.now() - metaCache.at < 600_000) return metaCache.maxLev;
  const meta = await info<{ universe: { name: string; maxLeverage: number; isDelisted?: boolean }[] }>({ type: "meta" });
  const maxLev: Record<string, number> = {};
  for (const a of meta.universe) if (!a.isDelisted) maxLev[a.name] = a.maxLeverage;
  metaCache = { at: Date.now(), maxLev };
  return maxLev;
}

export async function candles(coin: string, interval: "1m", startTime: number, endTime = Date.now()): Promise<Candle[]> {
  const raw = await info<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  });
  return raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
}
