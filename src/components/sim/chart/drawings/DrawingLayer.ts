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
import type { Candle } from "@/lib/hyperliquid";
import type { Anchor, Drawing } from "./model";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type Point = [number, number];

/** Drawing color: the site's cream, clear of the green, red and indicator colors. */
export const INK = "#fdf8ea";
const NAVY = "#01154d";
const HANDLE_R = 4.5;
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

function handle(ctx: CanvasRenderingContext2D, [x, y]: Point) {
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_R, 0, Math.PI * 2);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
