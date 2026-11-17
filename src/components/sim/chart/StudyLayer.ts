import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type PriceFormat,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/hyperliquid";
import type { Line } from "@/lib/indicators";
import { BandFill, LevelBand, withAlpha } from "./BandFill";
import { slotColor, STUDIES, type Study, type StudyDef } from "./studies";

interface Entry {
  study: Study;
  series: Map<string, ISeriesApi<"Line">>;
  values: Record<string, Line>;
}

/** Height of a new indicator pane under the candles, in pixels. */
const PANE_HEIGHT = 110;
const LEVEL_COLOR = "rgba(142, 163, 207, 0.45)";
/** The library strokes each segment in its starting point's color, so a clear point ends the line there. */
const BREAK = "rgba(0, 0, 0, 0)";

const sec = (ms: number) => (ms / 1000) as UTCTimestamp;

function toData(bars: readonly Candle[], line: Line, breaksAfter?: StudyDef["breaksAfter"]): LineData[] {
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

  /**
   * Makes the chart match the list. Settings changes update the existing series in
   * place, so an indicator keeps its pane and position.
   */
  sync(studies: readonly Study[], bars: readonly Candle[]) {
    for (const [id, e] of this.entries) {
      if (!studies.some((s) => s.id === id)) {
        e.series.forEach((series) => this.chart.removeSeries(series));
        this.entries.delete(id);
      }
    }
    for (const s of studies) {
      const e = this.entries.get(s.id);
      if (!e) {
        const built = this.build(s);
        this.entries.set(s.id, built);
        this.fill(built, bars);
        continue;
      }
      const prev = e.study;
      e.study = s;
      if (prev.params.join() !== s.params.join()) this.fill(e, bars);
      if (prev.slot !== s.slot) {
        for (const line of STUDIES[s.kind].lines(s)) e.series.get(line.key)?.applyOptions({ color: line.color, lineStyle: line.style });
      }
      if (!!prev.hidden !== !!s.hidden) e.series.forEach((series) => series.applyOptions({ visible: !s.hidden }));
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

  /** The table row of an indicator's own pane, for placing its legend. */
  paneElement(id: string): HTMLElement | null {
    const first = this.entries.get(id)?.series.values().next().value;
    return first ? first.getPane().getHTMLElement() : null;
  }

  setPrecision(precision: number) {
    this.precision = precision;
    for (const e of this.entries.values()) {
      const def = STUDIES[e.study.kind];
      if (def.decimals == null) e.series.forEach((s) => s.applyOptions({ priceFormat: this.formatFor(def) }));
    }
  }

  /** Hidden while the chart is scrolled back in history, like the candles' own label. */
  setLastValueVisible(visible: boolean) {
    this.lastValueVisible = visible;
    this.entries.forEach((e) => e.series.forEach((s) => s.applyOptions({ lastValueVisible: visible })));
  }

  private formatFor(def: StudyDef): PriceFormat {
    const d = def.decimals ?? this.precision;
    return { type: "price", precision: d, minMove: 10 ** -d };
  }

  private build(s: Study): Entry {
    const def = STUDIES[s.kind];
    const series = new Map<string, ISeriesApi<"Line">>();
    const entry: Entry = { study: s, series, values: {} };
    const paneIndex = def.pane ? this.chart.panes().length : 0;
    const range = def.range;

    for (const line of def.lines(s)) {
      series.set(
        line.key,
        this.chart.addSeries(
          LineSeries,
          {
            color: line.color,
            lineWidth: line.width ?? 2,
            lineStyle: line.style,
            priceLineVisible: false,
            lastValueVisible: this.lastValueVisible,
            crosshairMarkerVisible: false,
            priceFormat: this.formatFor(def),
            visible: !s.hidden,
            ...(range && { autoscaleInfoProvider: () => ({ priceRange: { minValue: range[0], maxValue: range[1] } }) }),
          },
          paneIndex,
        ),
      );
    }
    if (def.pane) this.chart.panes()[paneIndex]?.setHeight(PANE_HEIGHT);

    const first = series.values().next().value;
    const color = (alpha: number) => () => withAlpha(slotColor(entry.study.slot), alpha);
    for (const price of def.levels ?? []) {
      first?.createPriceLine({ price, color: LEVEL_COLOR, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    }
    if (def.levelBand) first?.attachPrimitive(new LevelBand(def.levelBand, color(0.07)));
    const fill = def.fill;
    if (fill) {
      series
        .get(fill.from)
        ?.attachPrimitive(new BandFill(() => ({ upper: entry.values[fill.from] ?? [], lower: entry.values[fill.to] ?? [] }), color(0.1)));
    }
    return entry;
  }

  private fill(e: Entry, bars: readonly Candle[]) {
    const def = STUDIES[e.study.kind];
    e.values = def.compute(bars, e.study.params);
    for (const [key, series] of e.series) series.setData(toData(bars, e.values[key] ?? [], def.breaksAfter));
  }
}
