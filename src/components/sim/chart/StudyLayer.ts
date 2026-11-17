import { LineSeries, type IChartApi, type ISeriesApi, type LineData, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/hyperliquid";
import type { Line } from "@/lib/indicators";
import { BandFill, withAlpha } from "./BandFill";
import { slotColor, STUDIES, type Study } from "./studies";

interface Entry {
  study: Study;
  /** What the series were built for; a change rebuilds them. */
  sig: string;
  series: Map<string, ISeriesApi<"Line">>;
  values: Record<string, Line>;
}

const sec = (ms: number) => (ms / 1000) as UTCTimestamp;
const sigOf = (s: Study) => `${s.kind}:${s.params.join(",")}:${s.slot}`;

/** The library strokes each segment in its starting point's color, so a clear point ends the line there. */
const BREAK = "rgba(0, 0, 0, 0)";

function toData(bars: readonly Candle[], line: Line, breaksAfter?: (bars: readonly Candle[], i: number) => boolean): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = line[i];
    if (v == null) continue;
    out.push(breaksAfter?.(bars, i) ? { time: sec(bars[i].t), value: v, color: BREAK } : { time: sec(bars[i].t), value: v });
  }
  return out;
}

/** Keeps the chart's indicator series in step with the indicator list and the candles. */
export class StudyLayer {
  private entries = new Map<string, Entry>();
  private precision = 2;
  private lastValueVisible = true;
  /** Bars at the last full fill; a new bar refills, so breaks before it are drawn. */
  private filledBars = 0;

  constructor(private chart: IChartApi) {}

  /** Makes the series on the chart match the list, filling new ones from the bars. */
  sync(studies: readonly Study[], bars: readonly Candle[]) {
    for (const [id, e] of this.entries) {
      const s = studies.find((x) => x.id === id);
      if (!s || sigOf(s) !== e.sig) {
        e.series.forEach((series) => this.chart.removeSeries(series));
        this.entries.delete(id);
      }
    }
    for (const s of studies) {
      let e = this.entries.get(s.id);
      if (!e) {
        e = this.build(s);
        this.entries.set(s.id, e);
        this.fill(e, bars);
      }
      e.study = s;
      e.series.forEach((series) => series.applyOptions({ visible: !s.hidden }));
    }
  }

  /** Recomputes everything after the bars were replaced (market, interval or older history). */
  reload(bars: readonly Candle[]) {
    this.filledBars = bars.length;
    this.entries.forEach((e) => this.fill(e, bars));
  }

  /** Applies a live candle: within a bar only the latest point of each line changes. */
  tick(bars: readonly Candle[]) {
    const i = bars.length - 1;
    if (i < 0) return;
    if (bars.length !== this.filledBars) return this.reload(bars);
    for (const e of this.entries.values()) {
      e.values = STUDIES[e.study.kind].compute(bars, e.study.params);
      for (const [key, series] of e.series) {
        const v = e.values[key]?.[i];
        if (v == null) continue;
        try {
          series.update({ time: sec(bars[i].t), value: v });
        } catch {}
      }
    }
  }

  valueAt(id: string, key: string, i: number): number | null {
    return this.entries.get(id)?.values[key]?.[i] ?? null;
  }

  setPrecision(precision: number) {
    this.precision = precision;
    this.entries.forEach((e) => e.series.forEach((s) => s.applyOptions({ priceFormat: this.priceFormat() })));
  }

  /** Hidden while the chart is scrolled back in history, like the candles' own label. */
  setLastValueVisible(visible: boolean) {
    this.lastValueVisible = visible;
    this.entries.forEach((e) => e.series.forEach((s) => s.applyOptions({ lastValueVisible: visible })));
  }

  private priceFormat() {
    return { type: "price" as const, precision: this.precision, minMove: 10 ** -this.precision };
  }

  private build(s: Study): Entry {
    const def = STUDIES[s.kind];
    const series = new Map<string, ISeriesApi<"Line">>();
    const entry: Entry = { study: s, sig: sigOf(s), series, values: {} };
    for (const line of def.lines(s)) {
      series.set(
        line.key,
        this.chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: line.width ?? 2,
          lineStyle: line.style,
          priceLineVisible: false,
          lastValueVisible: this.lastValueVisible,
          crosshairMarkerVisible: false,
          priceFormat: this.priceFormat(),
          visible: !s.hidden,
        }),
      );
    }
    const fill = def.fill;
    if (fill) {
      series.get(fill.from)?.attachPrimitive(
        new BandFill(
          () => ({ upper: entry.values[fill.from] ?? [], lower: entry.values[fill.to] ?? [] }),
          withAlpha(slotColor(s.slot), 0.1),
        ),
      );
    }
    return entry;
  }

  private fill(e: Entry, bars: readonly Candle[]) {
    const def = STUDIES[e.study.kind];
    e.values = def.compute(bars, e.study.params);
    for (const [key, series] of e.series) series.setData(toData(bars, e.values[key] ?? [], def.breaksAfter));
  }
}
