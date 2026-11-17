import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Logical,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";
import { fmtDuration } from "@/lib/format";
import type { Candle } from "@/lib/hyperliquid";
import { FIB_EXT_LEVELS, FIB_LEVELS, type Anchor, type Drawing } from "./model";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type Point = [number, number];

/** Drawing color: the site's cream, clear of the green, red and indicator colors. */
export const INK = "#fdf8ea";
const NAVY = "#01154d";
const HANDLE_R = 4.5;
/** The golden pocket, 0.5 to 0.618, gets the warm tint traders look for. */
const POCKET = "rgba(201, 133, 0, 0.14)";

/** The page's mono font, for labels drawn on the canvas, which can't read CSS variables. */
let mono = "";
let sans = "";
const sansFont = () =>
  (sans ||= (typeof document !== "undefined" && getComputedStyle(document.body).getPropertyValue("--font-inter").trim()) || "sans-serif");

/** Measures text off screen, for hit testing notes outside a draw. */
let measurer: CanvasRenderingContext2D | null = null;
const TEXT_FONT = () => `13px ${sansFont()}`;
const PAD = 5;
function noteSize(text: string): { w: number; h: number } {
  measurer ||= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!measurer) return { w: text.length * 7 + PAD * 2, h: 22 };
  measurer.font = TEXT_FONT();
  return { w: measurer.measureText(text).width + PAD * 2, h: 22 };
}
/** What a note shows: its words, or a prompt while it is empty. */
const noteText = (d: Drawing) => d.text?.trim() || "Text";
const monoFont = () =>
  (mono ||= (typeof document !== "undefined" && getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim()) || "monospace");
/** How close, in pixels, a press must be to a line to pick it. */
const REACH = 6;

/** Position of a time among the candles: whole numbers are candles, fractions fall between, and it runs on past either end. */
export function timeToLogical(bars: readonly Candle[], t: number, step: number): number {
  const n = bars.length;
  if (t >= bars[n - 1].t) return n - 1 + (t - bars[n - 1].t) / step;
  if (t <= bars[0].t) return (t - bars[0].t) / step;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return lo + (t - bars[lo].t) / (bars[hi].t - bars[lo].t);
}

/** The time of candle i, counting on in whole candles past either end of the loaded history. */
export function logicalToTime(bars: readonly Candle[], i: number, step: number): number {
  const n = bars.length;
  if (i < 0) return bars[0].t + i * step;
  if (i >= n) return bars[n - 1].t + (i - n + 1) * step;
  return bars[i].t;
}

/**
 * The line through a and b carried far past b, and for an extended line past a too, so
 * the canvas clips it at the chart's edges.
 */
function extend(a: Point, b: Point, both: boolean): [Point, Point] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = 20000 / len;
  return [both ? [a[0] - dx * k, a[1] - dy * k] : a, [b[0] + dx * k, b[1] + dy * k]];
}

/** Distance from a point to the segment a to b. */
function toSegment([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const k = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0;
  return Math.hypot(x - (x1 + k * dx), y - (y1 + k * dy));
}

/** What a press landed on: a drawing, and which of its points if it was a handle. */
export interface Hit {
  id: string;
  handle: number | null;
}

/** Draws the user's lines and shapes over the candles and converts between screen and chart positions. */
export class DrawingLayer implements ISeriesPrimitive<Time> {
  drawings: Drawing[] = [];
  /** The drawing being placed, before it is saved. */
  draft: Drawing | null = null;
  selected: string | null = null;
  hovered: string | null = null;
  /** False while a drawing tool is in use, so existing drawings don't react to the pointer. */
  editable = true;
  /** Snap new points to the nearest open, high, low or close of the candle under them. */
  magnet = false;
  /** Drawings stay saved but aren't shown, labelled or picked. */
  hidden = false;

  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly views: readonly IPrimitivePaneView[];
  private priceViews: ISeriesPrimitiveAxisView[] = [];
  private timeViews: ISeriesPrimitiveAxisView[] = [];
  private axisKey = "";

  constructor(
    private readonly bars: () => readonly Candle[],
    private readonly stepMs: () => number,
    private readonly fmtTime: (ms: number) => string,
  ) {
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.render(target) };
    this.views = [{ zOrder: () => "top", renderer: () => renderer }];
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = this.series = this.requestUpdate = null;
  }

  paneViews() {
    return this.views;
  }

  priceAxisViews() {
    return this.priceViews;
  }

  timeAxisViews() {
    return this.timeViews;
  }

  updateAllViews() {
    this.refreshAxis();
  }

  /** Points the chart's cursor at drawings that can be picked or dragged. */
  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (!this.editable || this.draft) return null;
    const h = this.hit(x, y);
    return h ? { externalId: h.id, zOrder: "top", cursorStyle: h.handle != null ? "move" : "pointer" } : null;
  }

  update(patch: Partial<Pick<DrawingLayer, "drawings" | "draft" | "selected" | "hovered" | "editable" | "magnet" | "hidden">>) {
    Object.assign(this, patch);
    this.refreshAxis();
    this.requestUpdate?.();
  }

  /** Screen x of a time, between or beyond the loaded candles. */
  toX(t: number): number | null {
    const bars = this.bars();
    if (!this.chart || !bars.length) return null;
    const f = timeToLogical(bars, t, this.stepMs());
    const i = Math.floor(f);
    // The chart only places whole candles, so a time between two is placed between them
    const ts = this.chart.timeScale();
    const x0 = ts.logicalToCoordinate(i as Logical);
    const x1 = ts.logicalToCoordinate((i + 1) as Logical);
    return x0 == null || x1 == null ? null : x0 + (f - i) * (x1 - x0);
  }

  toY(p: number): number | null {
    return this.series?.priceToCoordinate(p) ?? null;
  }

  /**
   * The chart position under a screen point, with its time snapped to the nearest
   * candle and, with the magnet on, its price to that candle's nearest open, high, low
   * or close.
   */
  anchorAt(x: number, y: number, snap = this.magnet): Anchor | null {
    const bars = this.bars();
    const series = this.series;
    if (!this.chart || !series || !bars.length) return null;
    const ts = this.chart.timeScale();
    const x0 = ts.logicalToCoordinate(0 as Logical);
    const x1 = ts.logicalToCoordinate(1 as Logical);
    let p: number | null = series.coordinateToPrice(y);
    if (x0 == null || x1 == null || x1 === x0 || p == null) return null;
    const i = Math.round((x - x0) / (x1 - x0));
    const bar = snap ? bars[i] : undefined;
    if (bar) {
      let best = Infinity;
      for (const v of [bar.o, bar.h, bar.l, bar.c]) {
        const d = Math.abs((series.priceToCoordinate(v) ?? Infinity) - y);
        if (d < best) [best, p] = [d, v];
      }
    }
    return { t: logicalToTime(bars, i, this.stepMs()), p };
  }

  /** A drawing's points on screen, or null while any of them can't be placed. */
  screen(d: Drawing): Point[] | null {
    const out: Point[] = [];
    for (const a of d.points) {
      const x = this.toX(a.t);
      const y = this.toY(a.p);
      if (x == null || y == null) return null;
      out.push([x, y]);
    }
    return out;
  }

  /** The drawing under a screen point: the selected drawing's handles first, then the topmost drawing. */
  hit(x: number, y: number): Hit | null {
    if (this.hidden) return null;
    const sel = this.drawings.find((d) => d.id === this.selected);
    const selPts = sel && this.screen(sel);
    if (sel && selPts) {
      const i = selPts.findIndex(([hx, hy]) => Math.hypot(hx - x, hy - y) <= HANDLE_R + 4);
      if (i >= 0) return { id: sel.id, handle: i };
    }
    for (let k = this.drawings.length - 1; k >= 0; k--) {
      const d = this.drawings[k];
      const pts = this.screen(d);
      if (pts && this.near(d, pts, [x, y])) return { id: d.id, handle: null };
    }
    return null;
  }

  /** A channel's corners on screen: the main line, then the parallel line shifted by the third point's offset. */
  private channel(pts: Point[]): [Point, Point, Point, Point] {
    const [a, b, c] = pts;
    const dy = c[1] - a[1];
    return [a, b, [a[0], a[1] + dy], [b[0], b[1] + dy]];
  }

  private near(d: Drawing, pts: Point[], at: Point): boolean {
    switch (d.kind) {
      case "trend":
        return toSegment(at, pts[0], pts[1]) <= REACH;
      case "ray":
      case "xline": {
        const [p, q] = extend(pts[0], pts[1], d.kind === "xline");
        return toSegment(at, p, q) <= REACH;
      }
      case "channel": {
        const [a, b, a2, b2] = this.channel(pts);
        if (toSegment(at, a, b) <= REACH || toSegment(at, a2, b2) <= REACH) return true;
        // Inside the band: between the two lines, within the main line's span
        const k = (at[0] - a[0]) / (b[0] - a[0] || 1);
        if (k < 0 || k > 1) return false;
        const y1 = a[1] + k * (b[1] - a[1]);
        const y2 = a2[1] + k * (b2[1] - a2[1]);
        return at[1] >= Math.min(y1, y2) && at[1] <= Math.max(y1, y2);
      }
      case "hline":
        return Math.abs(at[1] - pts[0][1]) <= REACH;
      case "vline":
        return Math.abs(at[0] - pts[0][0]) <= REACH;
      case "long":
      case "short": {
        const ys = pts.map((q) => q[1]);
        return (
          at[0] >= Math.min(pts[0][0], pts[1][0]) - REACH &&
          at[0] <= Math.max(pts[0][0], pts[1][0]) + REACH &&
          at[1] >= Math.min(...ys) - REACH &&
          at[1] <= Math.max(...ys) + REACH
        );
      }
      case "text": {
        const { w, h } = noteSize(noteText(d));
        return at[0] >= pts[0][0] && at[0] <= pts[0][0] + w && at[1] >= pts[0][1] - h && at[1] <= pts[0][1];
      }
      case "rect":
      case "measure":
        return (
          at[0] >= Math.min(pts[0][0], pts[1][0]) - REACH &&
          at[0] <= Math.max(pts[0][0], pts[1][0]) + REACH &&
          at[1] >= Math.min(pts[0][1], pts[1][1]) - REACH &&
          at[1] <= Math.max(pts[0][1], pts[1][1]) + REACH
        );
      case "fib":
      case "fibext": {
        const ext = d.kind === "fibext";
        if (ext && (toSegment(at, pts[0], pts[1]) <= REACH || toSegment(at, pts[1], pts[2]) <= REACH)) return true;
        const [left, width] = ext ? extSpan(pts) : [Math.min(pts[0][0], pts[1][0]), Math.abs(pts[1][0] - pts[0][0])];
        if (at[0] < left - REACH || at[0] > left + width + REACH) return false;
        return (ext ? fibExtLevels(d) : fibLevels(d)).some(({ p }) => {
          const y = this.toY(p);
          return y != null && Math.abs(at[1] - y) <= REACH;
        });
      }
    }
  }

  /** The drawing whose points show on the axes: the one being placed, else the selected one. */
  private active(): Drawing | null {
    return this.draft ?? this.drawings.find((d) => d.id === this.selected) ?? null;
  }

  private byId(id: string): Drawing | undefined {
    return this.draft?.id === id ? this.draft : this.drawings.find((d) => d.id === id);
  }

  /**
   * Axis labels: every horizontal line's price and every vertical line's time, plus the
   * prices and times of the active drawing's points. Rebuilt only when that set changes,
   * as the chart expects.
   */
  private refreshAxis() {
    const d = this.active();
    const all = this.draft ? [...this.drawings, this.draft] : this.drawings;
    const hlines = all.filter((x) => x.kind === "hline").map((x) => x.id);
    const vlines = all.filter((x) => x.kind === "vline").map((x) => x.id);
    const pointed = d && d.kind !== "hline" && d.kind !== "vline" ? d : null;
    const key = [pointed ? `${pointed.id}:${pointed.points.length}` : "", ...hlines, "|", ...vlines].join(",");
    if (key === this.axisKey) return;
    this.axisKey = key;

    const price = (get: () => Anchor | undefined) =>
      axisLabel(() => {
        const a = this.hidden ? undefined : get();
        return a ? { at: this.toY(a.p), text: this.series?.priceFormatter().format(a.p) ?? "" } : null;
      });
    const time = (get: () => Anchor | undefined) =>
      axisLabel(() => {
        const a = this.hidden ? undefined : get();
        return a ? { at: this.toX(a.t), text: this.fmtTime(a.t) } : null;
      });
    const n = pointed?.points.length ?? 0;
    const point = (i: number) => () => {
      const a = this.active();
      return a && a.kind !== "hline" && a.kind !== "vline" ? a.points[i] : undefined;
    };
    this.priceViews = [
      ...hlines.map((id) => price(() => this.byId(id)?.points[0])),
      ...Array.from({ length: n }, (_, i) => price(point(i))),
    ];
    this.timeViews = [
      ...vlines.map((id) => time(() => this.byId(id)?.points[0])),
      ...Array.from({ length: n }, (_, i) => time(point(i))),
    ];
  }

  private render(target: Target) {
    const shown = this.hidden ? [] : this.drawings;
    const list = this.draft ? [...shown, this.draft] : shown;
    if (!list.length) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const d of list) {
        const pts = this.screen(d);
        if (!pts) continue;
        const active = d === this.draft || d.id === this.selected;
        ctx.save();
        this.paint(ctx, d, pts, active || d.id === this.hovered, mediaSize);
        if (active) for (const p of pts) handle(ctx, p);
        ctx.restore();
      }
    });
  }

  private paint(ctx: CanvasRenderingContext2D, d: Drawing, pts: Point[], hot: boolean, size: { width: number; height: number }) {
    const [a, b] = pts;
    switch (d.kind) {
      case "hline":
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(0, a[1]);
        ctx.lineTo(size.width, a[1]);
        ctx.stroke();
        break;
      case "vline":
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(a[0], 0);
        ctx.lineTo(a[0], size.height);
        ctx.stroke();
        break;
      case "fib":
        this.paintFib(ctx, fibLevels(d), Math.min(a[0], b[0]), Math.abs(b[0] - a[0]), hot, [a, b]);
        break;
      case "fibext": {
        const [left, width] = extSpan(pts);
        this.paintFib(ctx, fibExtLevels(d), left, width, hot, pts);
        break;
      }
      case "text": {
        // The note sits above and right of its point, on a dark backing so it reads over candles
        const text = noteText(d);
        const { w, h } = noteSize(text);
        ctx.fillStyle = "rgba(1, 21, 77, 0.85)";
        ctx.strokeStyle = hot ? INK : "rgba(253, 248, 234, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(a[0], a[1] - h, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.font = TEXT_FONT();
        ctx.fillStyle = d.text?.trim() ? INK : "rgba(253, 248, 234, 0.5)";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(text, a[0] + PAD, a[1] - h / 2 + 0.5);
        break;
      }
      case "measure":
        this.paintMeasure(ctx, d, a, b, size);
        break;
      case "long":
      case "short":
        this.paintPosition(ctx, d, pts, hot);
        break;
      case "rect": {
        const x = Math.min(a[0], b[0]);
        const y = Math.min(a[1], b[1]);
        const w = Math.abs(b[0] - a[0]);
        const h = Math.abs(b[1] - a[1]);
        ctx.fillStyle = hot ? "rgba(253, 248, 234, 0.1)" : "rgba(253, 248, 234, 0.07)";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2 : 1.5;
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case "channel": {
        const [p0, p1, p2, p3] = this.channel(pts);
        ctx.fillStyle = hot ? "rgba(253, 248, 234, 0.09)" : "rgba(253, 248, 234, 0.06)";
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.moveTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.stroke();
        // The midline, where price often turns inside a channel
        ctx.strokeStyle = "rgba(253, 248, 234, 0.45)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2);
        ctx.lineTo((p1[0] + p3[0]) / 2, (p1[1] + p3[1]) / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "trend":
      case "ray":
      case "xline": {
        const [p, q] = d.kind === "trend" ? [a, b] : extend(a, b, d.kind === "xline");
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2.5 : 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
        break;
      }
    }
  }

  /** A long or short position: the target zone in green, the stop zone in red, and the risk to reward at the entry. */
  private paintPosition(ctx: CanvasRenderingContext2D, d: Drawing, pts: Point[], hot: boolean) {
    const [entry, target, stop] = d.points;
    const [[x1, yE], [x2, yT], [, yS]] = pts;
    const left = Math.min(x1, x2);
    const w = Math.abs(x2 - x1);
    ctx.fillStyle = "rgba(47, 214, 160, 0.16)";
    ctx.fillRect(left, Math.min(yE, yT), w, Math.abs(yT - yE));
    ctx.fillStyle = "rgba(255, 107, 125, 0.16)";
    ctx.fillRect(left, Math.min(yE, yS), w, Math.abs(yS - yE));
    ctx.strokeStyle = INK;
    ctx.lineWidth = hot ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(left, yE);
    ctx.lineTo(left + w, yE);
    ctx.stroke();

    const fmt = (p: number) => this.series?.priceFormatter().format(p) ?? p.toFixed(2);
    const pct = (p: number) => {
      const v = ((p - entry.p) / entry.p) * 100;
      return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
    };
    const risk = Math.abs(entry.p - stop.p);
    const rr = risk > 0 ? Math.abs(target.p - entry.p) / risk : 0;
    const cx = left + w / 2;
    // Target and stop labels sit inside their zones, by the far edge
    const inside = (y: number, from: number) => y + (from > y ? 11 : -11);
    ctx.font = `11px ${monoFont()}`;
    pill(ctx, `Target ${fmt(target.p)} (${pct(target.p)})`, cx, inside(yT, yE), "#2fd6a0");
    pill(ctx, `Stop ${fmt(stop.p)} (${pct(stop.p)})`, cx, inside(yS, yE), "#ff6b7d");
    pill(ctx, `${d.kind === "long" ? "Long" : "Short"} ${fmt(entry.p)}, risk/reward ${rr.toFixed(2)}`, cx, yE, INK);
  }

  /** A box from one point to the other, green when price rose and red when it fell, with the move, the candles and the time it took. */
  private paintMeasure(ctx: CanvasRenderingContext2D, d: Drawing, a: Point, b: Point, size: { width: number; height: number }) {
    const [pa, pb] = d.points;
    const up = pb.p >= pa.p;
    const rgb = up ? "47, 214, 160" : "255, 107, 125";
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    const w = Math.abs(b[0] - a[0]);
    const h = Math.abs(b[1] - a[1]);
    ctx.fillStyle = `rgba(${rgb}, 0.14)`;
    ctx.fillRect(x, y, w, h);

    // Arrows across the box: up or down for the price, along for the time
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
    ctx.lineWidth = 1;
    arrow(ctx, [cx, a[1]], [cx, b[1]]);
    arrow(ctx, [a[0], cy], [b[0], cy]);

    const bars = this.bars();
    const step = this.stepMs();
    const n = bars.length ? Math.round(timeToLogical(bars, pb.t, step) - timeToLogical(bars, pa.t, step)) : 0;
    const dp = pb.p - pa.p;
    const fmt = (p: number) => this.series?.priceFormatter().format(p) ?? p.toFixed(2);
    const lines = [
      `${dp >= 0 ? "+" : "-"}${fmt(Math.abs(dp))} (${dp >= 0 ? "+" : ""}${((dp / pa.p) * 100).toFixed(2)}%)`,
      `${Math.abs(n)} bar${Math.abs(n) === 1 ? "" : "s"}, ${fmtDuration(Math.abs(pb.t - pa.t))}`,
    ];

    // The readout sits past the end the price moved toward, kept on the chart
    ctx.font = `11px ${monoFont()}`;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    const bh = 34;
    const bx = Math.min(Math.max(cx - bw / 2, 2), size.width - bw - 2);
    const by = Math.min(Math.max(up ? y - bh - 6 : y + h + 6, 2), size.height - bh - 2);
    ctx.fillStyle = "rgba(1, 21, 77, 0.92)";
    ctx.strokeStyle = `rgba(${rgb}, 0.6)`;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 5);
    ctx.fill();
    ctx.stroke();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillText(lines[0], bx + bw / 2, by + 10);
    ctx.fillStyle = INK;
    ctx.fillText(lines[1], bx + bw / 2, by + 24);
  }

  /** Level lines between the two points, the bands between them shaded, each level labelled with its price. */
  private paintFib(
    ctx: CanvasRenderingContext2D,
    priced: { level: number; p: number }[],
    left: number,
    width: number,
    hot: boolean,
    swing: Point[],
  ) {
    const levels = priced
      .map((l) => ({ ...l, y: this.toY(l.p) }))
      .filter((l): l is { level: number; p: number; y: number } => l.y != null);

    for (let k = 0; k + 1 < levels.length; k++) {
      const [u, v] = [levels[k], levels[k + 1]];
      ctx.fillStyle = u.level === 0.5 && v.level === 0.618 ? POCKET : `rgba(253, 248, 234, ${k % 2 ? 0.035 : 0.06})`;
      ctx.fillRect(left, Math.min(u.y, v.y), width, Math.abs(v.y - u.y));
    }

    ctx.lineWidth = hot ? 1.5 : 1;
    ctx.font = `10px ${monoFont()}`;
    ctx.textBaseline = "bottom";
    const fmt = (p: number) => this.series?.priceFormatter().format(p) ?? p.toFixed(2);
    for (const { level, p, y } of levels) {
      ctx.strokeStyle = level === 0 || level === 1 ? INK : "rgba(253, 248, 234, 0.55)";
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(253, 248, 234, 0.85)";
      ctx.fillText(`${level} (${fmt(p)})`, left + 4, y - 2);
    }

    // The swing the levels were measured on
    ctx.strokeStyle = "rgba(253, 248, 234, 0.45)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    swing.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Each extension level with its price: the swing's size times the level, from the pullback's end. */
function fibExtLevels(d: Drawing) {
  const [a, b, c] = d.points;
  return FIB_EXT_LEVELS.map((level) => ({ level, p: c.p + (b.p - a.p) * level }));
}

/** An extension's levels start at the pullback's end and run as far right as the swing was wide. */
function extSpan(pts: Point[]): [number, number] {
  return [pts[2][0], Math.max(Math.abs(pts[1][0] - pts[0][0]), 40)];
}

/** Each Fibonacci level of a retracement with its price. */
function fibLevels(d: Drawing) {
  const [a, b] = d.points;
  return FIB_LEVELS.map((level) => ({ level, p: b.p + (a.p - b.p) * level }));
}

function axisLabel(get: () => { at: number | null; text: string } | null): ISeriesPrimitiveAxisView {
  return {
    coordinate: () => get()?.at ?? -1000,
    text: () => get()?.text ?? "",
    textColor: () => NAVY,
    backColor: () => INK,
    visible: () => get()?.at != null,
  };
}

/** A small label on a dark rounded backing, centered on a point. */
function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, color: string) {
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = "rgba(1, 21, 77, 0.88)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - 8, w, 16, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 0.5);
}

/** A line from one point to another with a small head at the far end. */
function arrow(ctx: CanvasRenderingContext2D, [x1, y1]: Point, [x2, y2]: Point) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  if (len > 12) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    for (const s of [-1, 1]) {
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 6 * Math.cos(ang + s * 0.45), y2 - 6 * Math.sin(ang + s * 0.45));
    }
  }
  ctx.stroke();
}

function handle(ctx: CanvasRenderingContext2D, [x, y]: Point) {
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_R, 0, Math.PI * 2);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
