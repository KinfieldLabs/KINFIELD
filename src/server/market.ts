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

/**
 * The price a market order fills at: Hyperliquid's mid (halfway between the best bid and
 * ask) for that one market, fetched fresh the moment the order arrives and never cached,
 * so a fill can't use a stale price. `at` is Hyperliquid's own timestamp for the book.
 */
export async function fillPrice(coin: string): Promise<{ px: number; at: number }> {
  const book = await info<{ time: number; levels: { px: string }[][] } | null>({ type: "l2Book", coin });
  const bid = Number(book?.levels?.[0]?.[0]?.px);
  const ask = Number(book?.levels?.[1]?.[0]?.px);
  if (!book || !(bid > 0) || !(ask > 0)) throw new Error(`no price for ${coin}`);
  return { px: (bid + ask) / 2, at: book.time || Date.now() };
}

let midsCache: { at: number; mids: Record<string, number> } | null = null;

/**
 * Current mid price for every perp, for valuations and trigger checks (never for fills).
 * Cached; `maxAgeMs` says how old a cached copy may be.
 */
export async function mids(maxAgeMs = 1000): Promise<Record<string, number>> {
  if (midsCache && Date.now() - midsCache.at < maxAgeMs) return midsCache.mids;
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

export async function candles(coin: string, interval: "1m" | "15m" | "1h", startTime: number, endTime = Date.now()): Promise<Candle[]> {
  const raw = await info<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  });
  return raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
}

// ---------- price history for fill checks ----------

export interface Bar {
  t: number; // open time
  ms: number; // duration
  l: number;
  h: number;
}

const MIN = 60_000;
const RECENT_MS = 3 * 24 * 60 * MIN; // Hyperliquid serves the latest 5000 bars per interval (~3.5 days of 1m)
const bars1m = new Map<string, { from: number; at: number; bars: Candle[] }>();
const inflight = new Map<string, Promise<void>>();

/**
 * 1-minute bars for a coin from `from` to now, shared by every request on this server.
 * Only what isn't cached is fetched: usually a bar or two, never the whole history.
 */
export async function minuteBars(coin: string, from: number, maxAgeMs = 5_000): Promise<Candle[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Date.now();
    const hit = bars1m.get(coin);
    const covers = !!hit && hit.from <= from;
    if (covers && now - hit.at < maxAgeMs) return hit.bars;
    const running = inflight.get(coin);
    if (running) {
      await running.catch(() => {});
      continue;
    }
    const job = (async () => {
      // Top up from the newest cached bar when the cache reaches back far enough
      const start = covers ? (hit.bars.at(-1)?.t ?? from) : Math.max(from, now - RECENT_MS);
      const fresh = await candles(coin, "1m", start, now);
      const kept = covers ? hit.bars.filter((b) => b.t < start) : [];
      const bars = [...kept, ...fresh].filter((b) => b.t >= now - RECENT_MS);
      bars1m.set(coin, { from: covers ? hit.from : start, at: Date.now(), bars });
    })().finally(() => inflight.delete(coin));
    inflight.set(coin, job);
    await job;
  }
  return bars1m.get(coin)?.bars ?? [];
}

/**
 * Closed bars covering [from, now): 1-minute bars where Hyperliquid still has them,
 * then 15-minute and hourly bars further back. Only bars that start at or after
 * `from` are returned, so price action before a checkpoint never counts.
 */
export async function closedBarsSince(coin: string, from: number): Promise<Bar[]> {
  const now = Date.now();
  const toBar = (ms: number) => (c: Candle) => ({ t: c.t, ms, l: c.l, h: c.h });
  const all = await minuteBars(coin, Math.max(from, now - RECENT_MS));
  const minute = all.filter((b) => b.t >= from && b.t + MIN <= now).map(toBar(MIN));
  const coverStart = all.length ? all[0].t : now;
  if (from >= coverStart - MIN) return minute; // the 1-minute cache already covers the window
  const minuteStart = minute.length ? minute[0].t : coverStart;

  const older: Bar[] = [];
  const Q = 15 * MIN;
  const H = 60 * MIN;
  const qFrom = Math.max(from, now - 50 * 24 * H);
  const quarter = (await candles(coin, "15m", qFrom, minuteStart))
    .filter((b) => b.t >= qFrom && b.t + Q <= minuteStart)
    .map(toBar(Q));
  const qStart = quarter.length ? quarter[0].t : minuteStart;
  if (qStart - from > Q) {
    const hourly = (await candles(coin, "1h", from, qStart)).filter((b) => b.t >= from && b.t + H <= qStart);
    older.push(...hourly.map(toBar(H)));
  }
  older.push(...quarter);
  return [...older, ...minute];
}
