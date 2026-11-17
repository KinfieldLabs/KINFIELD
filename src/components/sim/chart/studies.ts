import { LineStyle } from "lightweight-charts";
import type { Candle } from "@/lib/hyperliquid";
import { bollinger, ema, endsDay, macd, rsi, sma, stochastic, vwap, type Line } from "@/lib/indicators";

export type StudyKind = "ma" | "ema" | "bb" | "vwap" | "rsi" | "macd" | "stoch";

/** An indicator on the chart. */
export interface Study {
  id: string;
  kind: StudyKind;
  /** Values for the definition's params, in order. */
  params: number[];
  /** Color slot, fixed when the indicator is added so removing another never repaints it. */
  slot: number;
  hidden?: boolean;
}

export interface StudyParam {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Smallest change; whole numbers when left out. */
  step?: number;
}

export interface StudyLine {
  key: string;
  color: string;
  style: LineStyle;
  /** Pixels; 2 when left out. */
  width?: 1 | 2;
  /** Drawn as bars from zero instead of a line. */
  histogram?: boolean;
  /** Color of the bar or point at i, when it varies. */
  colorAt?(line: Line, i: number): string;
}

export interface StudyDef {
  kind: StudyKind;
  name: string;
  /** Legend and axis label, e.g. "MA". */
  short: string;
  blurb: string;
  group: string;
  params: StudyParam[];
  lines(s: Study): StudyLine[];
  compute(bars: readonly Candle[], params: readonly number[]): Record<string, Line>;
  /** Shades the area between two of the lines. */
  fill?: { from: string; to: string };
  /** Whether the lines break after bar i instead of joining it to the next, as at a reset. */
  breaksAfter?(bars: readonly Candle[], i: number): boolean;
  /** Drawn in its own pane under the candles instead of over them. */
  pane?: boolean;
  /** Reference levels drawn across the pane, e.g. RSI 70 and 30. */
  levels?: number[];
  /** Shades the area between two levels. */
  levelBand?: [number, number];
  /** Fixed scale for an oscillator with known bounds. */
  range?: [number, number];
  /** Decimals for values that aren't prices. */
  decimals?: number;
}

/**
 * Line colors in a fixed order, checked for color-blind separation on the chart's dark
 * surface. Green and red stay with the candles. Past three, the colors repeat dashed.
 */
const COLORS = ["#c98500", "#9085e9", "#d55181"];
const COLOR_NAMES = ["Amber", "Violet", "Magenta"];
export const slotColor = (slot: number) => COLORS[slot % COLORS.length];
export const slotStyle = (slot: number) => (slot < COLORS.length ? LineStyle.Solid : LineStyle.Dashed);
export const slotName = (slot: number) =>
  `${COLOR_NAMES[slot % COLORS.length]}${slot < COLORS.length ? "" : " dashed"}`;
/** The color choices offered in settings: each color, solid then dashed. */
export const SLOT_CHOICES = [0, 1, 2, 3, 4, 5];

/** Whether a value fits a parameter's range and step. */
export function fitsParam(p: StudyParam, v: number): boolean {
  if (!Number.isFinite(v) || v < p.min || v > p.max) return false;
  const steps = (v - p.min) / (p.step ?? 1);
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

const closes = (bars: readonly Candle[]) => bars.map((b) => b.c);

/** Histogram bars: green above zero and red below, strong while growing away from zero, faded while shrinking. */
function histColor(h: Line, i: number) {
  const v = h[i] ?? 0;
  const prev = h[i - 1];
  const growing = prev == null || Math.abs(v) >= Math.abs(prev);
  return v >= 0 ? `rgba(47, 214, 160, ${growing ? 0.75 : 0.35})` : `rgba(255, 107, 125, ${growing ? 0.75 : 0.35})`;
}
const single = (key: string) => (s: Study) => [{ key, color: slotColor(s.slot), style: slotStyle(s.slot) }];

export const STUDIES: Record<StudyKind, StudyDef> = {
  ma: {
    kind: "ma",
    name: "Moving Average",
    short: "MA",
    blurb: "Average close of the last N candles",
    group: "Trend",
    params: [{ label: "Length", value: 20, min: 1, max: 500 }],
    lines: single("ma"),
    compute: (bars, [n]) => ({ ma: sma(closes(bars), n) }),
  },
  ema: {
    kind: "ema",
    name: "Exponential Moving Average",
    short: "EMA",
    blurb: "Moving average that weights recent candles more",
    group: "Trend",
    params: [{ label: "Length", value: 20, min: 1, max: 500 }],
    lines: single("ema"),
    compute: (bars, [n]) => ({ ema: ema(closes(bars), n) }),
  },
  bb: {
    kind: "bb",
    name: "Bollinger Bands",
    short: "BB",
    blurb: "Moving average with bands a set number of standard deviations away",
    group: "Volatility",
    params: [
      { label: "Length", value: 20, min: 2, max: 500 },
      { label: "Standard deviations", value: 2, min: 0.1, max: 10, step: 0.1 },
    ],
    lines: (s) => {
      const color = slotColor(s.slot);
      const style = slotStyle(s.slot);
      return [
        { key: "basis", color, style, width: 1 },
        { key: "upper", color, style, width: 1 },
        { key: "lower", color, style, width: 1 },
      ];
    },
    compute: (bars, [n, mult]) => bollinger(closes(bars), n, mult),
    fill: { from: "upper", to: "lower" },
  },
  vwap: {
    kind: "vwap",
    name: "VWAP",
    short: "VWAP",
    blurb: "Average price weighted by volume, starting over each day at 00:00 UTC",
    group: "Volume",
    params: [],
    lines: single("vwap"),
    compute: (bars) => ({ vwap: vwap(bars) }),
    breaksAfter: endsDay,
  },
  rsi: {
    kind: "rsi",
    name: "Relative Strength Index",
    short: "RSI",
    blurb: "Momentum from 0 to 100; above 70 often reads as overbought, below 30 as oversold",
    group: "Momentum",
    params: [{ label: "Length", value: 14, min: 2, max: 200 }],
    lines: single("rsi"),
    compute: (bars, [n]) => ({ rsi: rsi(closes(bars), n) }),
    pane: true,
    levels: [70, 50, 30],
    levelBand: [30, 70],
    range: [0, 100],
    decimals: 2,
  },
  macd: {
    kind: "macd",
    name: "MACD",
    short: "MACD",
    blurb: "Gap between a fast and a slow EMA, with its signal line and histogram",
    group: "Momentum",
    params: [
      { label: "Fast length", value: 12, min: 1, max: 200 },
      { label: "Slow length", value: 26, min: 1, max: 400 },
      { label: "Signal length", value: 9, min: 1, max: 100 },
    ],
    lines: (s) => [
      { key: "hist", color: "rgba(47, 214, 160, 0.75)", style: LineStyle.Solid, histogram: true, colorAt: histColor },
      { key: "macd", color: slotColor(s.slot), style: slotStyle(s.slot) },
      { key: "signal", color: slotColor(s.slot + 1), style: slotStyle(s.slot) },
    ],
    compute: (bars, [fast, slow, signal]) => macd(closes(bars), fast, slow, signal),
    pane: true,
    levels: [0],
  },
  stoch: {
    kind: "stoch",
    name: "Stochastic",
    short: "Stoch",
    blurb: "Where the close sits in the recent high to low range, from 0 to 100",
    group: "Momentum",
    params: [
      { label: "%K length", value: 14, min: 1, max: 200 },
      { label: "%K smoothing", value: 1, min: 1, max: 50 },
      { label: "%D smoothing", value: 3, min: 1, max: 50 },
    ],
    lines: (s) => [
      { key: "k", color: slotColor(s.slot), style: slotStyle(s.slot) },
      { key: "d", color: slotColor(s.slot + 1), style: slotStyle(s.slot) },
    ],
    compute: (bars, [length, smoothK, smoothD]) => stochastic(bars, length, smoothK, smoothD),
    pane: true,
    levels: [80, 50, 20],
    levelBand: [20, 80],
    range: [0, 100],
    decimals: 2,
  },
};

export const STUDY_LIST = Object.values(STUDIES);

/** Legend label, e.g. "MA 20". */
export const studyLabel = (s: Study) => [STUDIES[s.kind].short, ...s.params].join(" ");
