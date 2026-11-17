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

/**
 * Relative Strength Index: Wilder's smoothed average gain against average loss over n
 * bars, scaled 0 to 100. Smoothing starts from the simple average of the first n changes.
 */
export function rsi(src: readonly number[], n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  if (src.length <= n) return out;
  let up = 0;
  let down = 0;
  for (let i = 1; i <= n; i++) {
    const ch = src[i] - src[i - 1];
    up += Math.max(ch, 0);
    down += Math.max(-ch, 0);
  }
  up /= n;
  down /= n;
  const value = () => (down === 0 ? 100 : up === 0 ? 0 : 100 - 100 / (1 + up / down));
  out[n] = value();
  for (let i = n + 1; i < src.length; i++) {
    const ch = src[i] - src[i - 1];
    up = (up * (n - 1) + Math.max(ch, 0)) / n;
    down = (down * (n - 1) + Math.max(-ch, 0)) / n;
    out[i] = value();
  }
  return out;
}

/** Wilder's smoothing (RMA), seeded with the simple average of the first n values. */
export function rma(src: readonly number[], n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  if (src.length < n) return out;
  let prev = 0;
  for (let i = 0; i < n; i++) prev += src[i];
  prev /= n;
  out[n - 1] = prev;
  for (let i = n; i < src.length; i++) out[i] = prev = (prev * (n - 1) + src[i]) / n;
  return out;
}

/**
 * Average True Range: Wilder's average of each bar's true range, the largest of its
 * high to low and its gap from the previous close.
 */
export function atr(bars: readonly Bar[], n: number): Line {
  const tr = bars.map((b, i) =>
    i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)),
  );
  return rma(tr, n);
}

/** Simple moving average of a line that may have gaps; null wherever its window has one. */
function smaOfLine(src: Line, n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  let sum = 0;
  let gaps = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) gaps++;
    else sum += v;
    if (i >= n) {
      const old = src[i - n];
      if (old == null) gaps--;
      else sum -= old;
    }
    if (i >= n - 1 && gaps === 0) out[i] = sum / n;
  }
  return out;
}

/**
 * Stochastic: where the close sits in the high to low range of the last `length` bars,
 * 0 to 100, smoothed into %K, with %D as the average of %K.
 */
export function stochastic(bars: readonly Bar[], length: number, smoothK: number, smoothD: number) {
  const raw: Line = bars.map((b, i) => {
    if (i < length - 1) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - length + 1; j <= i; j++) {
      hi = Math.max(hi, bars[j].h);
      lo = Math.min(lo, bars[j].l);
    }
    return hi === lo ? null : (100 * (b.c - lo)) / (hi - lo);
  });
  const k = smaOfLine(raw, smoothK);
  return { k, d: smaOfLine(k, smoothD) };
}

/**
 * MACD: the gap between a fast and a slow EMA of the close, its EMA as the signal
 * line, and the histogram of MACD minus signal.
 */
export function macd(src: readonly number[], fast: number, slow: number, signal: number) {
  const f = ema(src, fast);
  const s = ema(src, slow);
  const line: Line = f.map((v, i) => (v == null || s[i] == null ? null : v - s[i]!));
  const sig = emaOfLine(line, signal);
  const hist: Line = line.map((v, i) => (v == null || sig[i] == null ? null : v - sig[i]!));
  return { hist, macd: line, signal: sig };
}

/** EMA of a line that starts with nulls, beginning once it has n values. */
function emaOfLine(src: Line, n: number): Line {
  const out: Line = new Array(src.length).fill(null);
  const start = src.findIndex((v) => v != null);
  if (start < 0) return out;
  const e = ema(src.slice(start) as number[], n);
  for (let i = 0; i < e.length; i++) out[start + i] = e[i];
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
