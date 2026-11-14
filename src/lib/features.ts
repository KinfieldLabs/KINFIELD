import type { Candle } from "./hyperliquid";

/** Market context captured at decision time: what an agent "sees". */
export interface MarketFeatures {
  ret5m: number; // 5-minute return
  ret15m: number; // 15-minute return
  ret60m: number; // 60-minute return
  vol15m: number; // stdev of 1m returns over last 15 bars
  rangePos60m: number; // where price sits in last-hour range: 0 = low, 1 = high
  volumeRatio: number; // last 5 bars' volume vs. hour average
}

export const FEATURE_LABELS: Record<keyof MarketFeatures, string> = {
  ret5m: "5m momentum",
  ret15m: "15m momentum",
  ret60m: "1h momentum",
  vol15m: "Volatility",
  rangePos60m: "Range position",
  volumeRatio: "Volume surge",
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof MarketFeatures)[];

/** Compute features from 1-minute candles (oldest → newest), using `price` as the latest print. */
export function computeFeatures(candles: Candle[], price: number): MarketFeatures | null {
  if (candles.length < 61 || !price) return null;
  const closes = candles.map((c) => c.c);
  closes[closes.length - 1] = price;
  const n = closes.length;
  const back = (k: number) => closes[n - 1 - k];

  const rets: number[] = [];
  for (let i = n - 15; i < n; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length);

  const hour = candles.slice(-60);
  const hi = Math.max(...hour.map((c) => c.h), price);
  const lo = Math.min(...hour.map((c) => c.l), price);
  const avgVol = hour.reduce((a, c) => a + c.v, 0) / hour.length || 1;
  const recentVol = candles.slice(-5).reduce((a, c) => a + c.v, 0) / 5;

  return {
    ret5m: price / back(5) - 1,
    ret15m: price / back(15) - 1,
    ret60m: price / back(60) - 1,
    vol15m: vol,
    rangePos60m: hi > lo ? (price - lo) / (hi - lo) : 0.5,
    volumeRatio: recentVol / avgVol,
  };
}
