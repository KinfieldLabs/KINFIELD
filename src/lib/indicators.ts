/**
 * Indicator math, defined the way TradingView defines it so values match a TradingView
 * chart of the same candles. Every function returns one value per input bar, null
 * until enough bars exist.
 */
export type Line = (number | null)[];

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
