/**
 * Indicator math, defined the way TradingView defines it so values match a TradingView
 * chart of the same candles. Every function returns one value per input bar, null
 * until enough bars exist.
 */
export type Line = (number | null)[];

interface Bar {
  t: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const DAY_MS = 86_400_000;

/** Whether bar i is the last of its UTC day, with the next day's first bar after it. */
export const endsDay = (bars: readonly { t: number }[], i: number) =>
  i + 1 < bars.length && Math.floor(bars[i + 1].t / DAY_MS) !== Math.floor(bars[i].t / DAY_MS);

/**
 * Volume-weighted average of the typical price, (high + low + close) / 3, starting
 * over each day at 00:00 UTC, when TradingView's session VWAP resets for crypto.
 */
export function vwap(bars: readonly Bar[]): Line {
  const out: Line = new Array(bars.length).fill(null);
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const d = Math.floor(b.t / DAY_MS);
    if (d !== day) {
      day = d;
      pv = vol = 0;
    }
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * b.v;
    vol += b.v;
    out[i] = vol > 0 ? pv / vol : tp;
  }
  return out;
}

/** Simple moving average. */
export function sma(src: readonly number[], n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= n) sum -= src[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** Standard deviation of the last n values (population, as TradingView computes it). */
export function stdev(src: readonly number[], n: number): Line {
  const mean = sma(src, n);
  return mean.map((m, i) => {
    if (m == null) return null;
    let sum = 0;
    for (let j = i - n + 1; j <= i; j++) sum += (src[j] - m) ** 2;
    return Math.sqrt(sum / n);
  });
}

/** Bollinger Bands: a moving average with bands `mult` standard deviations above and below. */
export function bollinger(src: readonly number[], n: number, mult: number) {
  const basis = sma(src, n);
  const dev = stdev(src, n);
  return {
    basis,
    upper: basis.map((b, i) => (b == null ? null : b + mult * dev[i]!)),
    lower: basis.map((b, i) => (b == null ? null : b - mult * dev[i]!)),
  };
}

/** Exponential moving average, seeded with the simple average of the first n bars. */
export function ema(src: readonly number[], n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  if (src.length < n) return out;
  const a = 2 / (n + 1);
  let prev = 0;
  for (let i = 0; i < n; i++) prev += src[i];
  prev /= n;
  out[n - 1] = prev;
  for (let i = n; i < src.length; i++) out[i] = prev = a * src[i] + (1 - a) * prev;
  return out;
}
