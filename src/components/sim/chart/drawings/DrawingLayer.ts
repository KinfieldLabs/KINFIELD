import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
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
const HANDLE_R = 4.5;

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

/** Draws the user's lines and shapes over the candles and converts between screen and chart positions. */
export class DrawingLayer implements ISeriesPrimitive<Time> {
  drawings: Drawing[] = [];
  /** The drawing being placed, before it is saved. */
  draft: Drawing | null = null;

  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly views: readonly IPrimitivePaneView[];

  constructor(
    private readonly bars: () => readonly Candle[],
    private readonly stepMs: () => number,
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

  update(patch: { drawings?: Drawing[]; draft?: Drawing | null }) {
    Object.assign(this, patch);
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

  private render(target: Target) {
    const list = this.draft ? [...this.drawings, this.draft] : this.drawings;
    if (!list.length) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const d of list) {
        const pts = this.screen(d);
        if (!pts) continue;
        const active = d === this.draft;
        ctx.save();
        this.paint(ctx, d, pts);
        if (active) for (const p of pts) handle(ctx, p);
        ctx.restore();
      }
    });
  }

  private paint(ctx: CanvasRenderingContext2D, d: Drawing, [a, b]: Point[]) {
    switch (d.kind) {
      case "trend":
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        break;
    }
  }
}

function handle(ctx: CanvasRenderingContext2D, [x, y]: Point) {
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_R, 0, Math.PI * 2);
  ctx.fillStyle = "#01154d";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
