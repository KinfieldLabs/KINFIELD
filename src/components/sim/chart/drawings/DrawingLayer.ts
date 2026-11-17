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
import { FIB_LEVELS, type Anchor, type Drawing } from "./model";

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

  update(patch: Partial<Pick<DrawingLayer, "drawings" | "draft" | "selected" | "hovered" | "editable">>) {
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

  /** The chart position under a screen point, with its time snapped to the nearest candle. */
  anchorAt(x: number, y: number): Anchor | null {
    const bars = this.bars();
    if (!this.chart || !this.series || !bars.length) return null;
    const ts = this.chart.timeScale();
    const x0 = ts.logicalToCoordinate(0 as Logical);
    const x1 = ts.logicalToCoordinate(1 as Logical);
    const p = this.series.coordinateToPrice(y);
    if (x0 == null || x1 == null || x1 === x0 || p == null) return null;
    return { t: logicalToTime(bars, Math.round((x - x0) / (x1 - x0)), this.stepMs()), p };
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

  private near(d: Drawing, pts: Point[], at: Point): boolean {
    switch (d.kind) {
      case "trend":
        return toSegment(at, pts[0], pts[1]) <= REACH;
      case "hline":
        return Math.abs(at[1] - pts[0][1]) <= REACH;
      case "vline":
        return Math.abs(at[0] - pts[0][0]) <= REACH;
      case "rect":
      case "measure":
        return (
          at[0] >= Math.min(pts[0][0], pts[1][0]) - REACH &&
          at[0] <= Math.max(pts[0][0], pts[1][0]) + REACH &&
          at[1] >= Math.min(pts[0][1], pts[1][1]) - REACH &&
          at[1] <= Math.max(pts[0][1], pts[1][1]) + REACH
        );
      case "fib": {
        const left = Math.min(pts[0][0], pts[1][0]) - REACH;
        const right = Math.max(pts[0][0], pts[1][0]) + REACH;
        if (at[0] < left || at[0] > right) return false;
        return fibLevels(d).some(({ p }) => {
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
        const a = get();
        return a ? { at: this.toY(a.p), text: this.series?.priceFormatter().format(a.p) ?? "" } : null;
      });
    const time = (get: () => Anchor | undefined) =>
      axisLabel(() => {
        const a = get();
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
    const list = this.draft ? [...this.drawings, this.draft] : this.drawings;
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

  private paint(ctx: CanvasRenderingContext2D, d: Drawing, [a, b]: Point[], hot: boolean, size: { width: number; height: number }) {
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
        this.paintFib(ctx, d, a, b, hot);
        break;
      case "measure":
        this.paintMeasure(ctx, d, a, b, size);
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
      case "trend":
        ctx.strokeStyle = INK;
        ctx.lineWidth = hot ? 2.5 : 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        break;
    }
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
  private paintFib(ctx: CanvasRenderingContext2D, d: Drawing, a: Point, b: Point, hot: boolean) {
    const left = Math.min(a[0], b[0]);
    const width = Math.abs(b[0] - a[0]);
    const levels = fibLevels(d)
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
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
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
