"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  LineStyle,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { fmtUsd } from "@/lib/format";

interface Props {
  points: { t: number; v: number }[];
  startingBalance: number;
  /** Extend the flat line to this time (now, or when the account was archived). */
  until: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (t: Time) => {
  const d = new Date((t as number) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
};

/** One series: realized equity after each closed trade. The opening balance is the baseline. */
export function EquityChart({ points, startingBalance, until }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const [hover, setHover] = useState<{ t: Time; v: number } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8ea3cf",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(120,170,255,0.06)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: "rgba(120,170,255,0.14)", timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      localization: { timeFormatter: dateLabel },
      crosshair: {
        vertLine: { color: "rgba(63,200,240,0.45)", labelBackgroundColor: "#0c2f85" },
        horzLine: { color: "rgba(63,200,240,0.45)", labelBackgroundColor: "#0c2f85" },
      },
      handleScroll: false,
      handleScale: false,
    });
    series.current = c.addSeries(AreaSeries, {
      lineColor: "#3fc8f0",
      lineWidth: 2,
      topColor: "rgba(63,200,240,0.22)",
      bottomColor: "rgba(63,200,240,0.02)",
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "#01154d",
      crosshairMarkerBorderWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    c.subscribeCrosshairMove((p) => {
      const d = p.time && series.current ? (p.seriesData.get(series.current) as AreaData<Time> | undefined) : undefined;
      setHover(d && "value" in d ? { t: d.time, v: d.value } : null);
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = series.current = null;
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    // One point per second (the chart needs strictly increasing times), then flat to `until`
    const byTime = new Map<number, number>();
    for (const p of points) byTime.set(Math.floor(p.t / 1000), p.v);
    const last = points.at(-1);
    const end = Math.floor(until / 1000);
    if (last && end > Math.floor(last.t / 1000)) byTime.set(end, last.v);
    const data = [...byTime].sort(([a], [b]) => a - b).map(([t, v]) => ({ time: t as UTCTimestamp, value: v }));
    s.setData(data);
    s.priceLines().forEach((l) => s.removePriceLine(l));
    s.createPriceLine({
      price: startingBalance,
      color: "rgba(185,198,228,0.55)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "Start",
    });
    chart.current?.timeScale().fitContent();
  }, [points, startingBalance, until]);

  const latest = points.at(-1)?.v ?? startingBalance;
  const shown = hover?.v ?? latest;
  const change = shown - startingBalance;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3">
        <span className="num text-xl text-cream">{fmtUsd(shown)}</span>
        <span className={`num text-xs ${change > 0 ? "text-long" : change < 0 ? "text-short" : "text-muted"}`}>
          {fmtUsd(change, true)} vs start
        </span>
        <span className="num text-[11px] text-muted">{hover ? dateLabel(hover.t) : "after the latest closed trade"}</span>
      </div>
      <div ref={el} className="relative min-h-0 flex-1" />
    </div>
  );
}
