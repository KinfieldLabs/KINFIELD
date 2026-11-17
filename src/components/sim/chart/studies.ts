import { LineStyle } from "lightweight-charts";
import type { Candle } from "@/lib/hyperliquid";
import { ema, sma, type Line } from "@/lib/indicators";

export type StudyKind = "ma" | "ema";

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
};

export const STUDY_LIST = Object.values(STUDIES);

/** Legend label, e.g. "MA 20". */
export const studyLabel = (s: Study) => `${STUDIES[s.kind].short} ${s.params.join(" ")}`;
