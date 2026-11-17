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
import type { Line } from "@/lib/indicators";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

/** Base for shading drawn under a series, behind the candles. */
abstract class Shade implements ISeriesPrimitive<Time> {
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<SeriesType> | null = null;
  private readonly views: readonly IPrimitivePaneView[];

  constructor(protected readonly color: () => string) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => {
        if (this.chart && this.series?.options().visible) this.draw(target, this.chart, this.series);
      },
    };
    this.views = [{ zOrder: () => "bottom", renderer: () => renderer }];
  }

  attached({ chart, series }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
  }

  detached() {
    this.chart = this.series = null;
  }

  paneViews() {
    return this.views;
  }

  protected abstract draw(target: Target, chart: IChartApi, series: ISeriesApi<SeriesType>): void;
}

/** Shades the area between two lines of an indicator, such as Bollinger Bands. */
export class BandFill extends Shade {
  constructor(
    private readonly lines: () => { upper: Line; lower: Line },
    color: () => string,
  ) {
    super(color);
  }

  protected draw(target: Target, chart: IChartApi, series: ISeriesApi<SeriesType>) {
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const { upper, lower } = this.lines();
    const from = Math.max(0, Math.floor(range.from) - 1);
    const to = Math.min(upper.length - 1, Math.ceil(range.to) + 1);

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.beginPath();
      // Each unbroken stretch of both lines becomes one closed shape: along the top, back along the bottom
      let run: [number, number, number][] = [];
      const close = () => {
        if (run.length > 1) {
          ctx.moveTo(run[0][0], run[0][1]);
          for (const [x, y] of run) ctx.lineTo(x, y);
          for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k][0], run[k][2]);
          ctx.closePath();
        }
        run = [];
      };
      for (let i = from; i <= to; i++) {
        const u = upper[i];
        const l = lower[i];
        const x = ts.logicalToCoordinate(i as Logical);
        const yu = u == null ? null : series.priceToCoordinate(u);
        const yl = l == null ? null : series.priceToCoordinate(l);
        if (x == null || yu == null || yl == null) close();
        else run.push([x, yu, yl]);
      }
      close();
      ctx.fillStyle = this.color();
      ctx.fill();
    });
  }
}

/** Shades the band between two fixed levels across the whole pane, such as RSI 30 to 70. */
export class LevelBand extends Shade {
  constructor(
    private readonly band: [number, number],
    color: () => string,
  ) {
    super(color);
  }

  protected draw(target: Target, _chart: IChartApi, series: ISeriesApi<SeriesType>) {
    const a = series.priceToCoordinate(this.band[0]);
    const b = series.priceToCoordinate(this.band[1]);
    if (a == null || b == null) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.fillStyle = this.color();
      ctx.fillRect(0, Math.min(a, b), mediaSize.width, Math.abs(b - a));
    });
  }
}

/** `#rrggbb` at the given opacity. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
