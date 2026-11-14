"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { INTERVAL_MS, type Candle, type Interval } from "@/lib/hyperliquid";
import { liquidationPx, type Position } from "@/lib/sim";

interface Props {
  candles: Candle[];
  interval: Interval;
  livePx: number | undefined;
  positions: Position[];
}

const toBar = (c: Candle) => ({ time: (c.t / 1000) as UTCTimestamp, open: c.o, high: c.h, low: c.l, close: c.c });

export function PriceChart({ candles, interval, livePx, positions }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const last = useRef<Candle | null>(null);
  const lines = useRef<IPriceLine[]>([]);

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
      grid: {
        vertLines: { color: "rgba(120,170,255,0.06)" },
        horzLines: { color: "rgba(120,170,255,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(120,170,255,0.14)" },
      timeScale: { borderColor: "rgba(120,170,255,0.14)", timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "rgba(63,200,240,0.4)", labelBackgroundColor: "#0c2f85" },
        horzLine: { color: "rgba(63,200,240,0.4)", labelBackgroundColor: "#0c2f85" },
      },
    });
    series.current = c.addSeries(CandlestickSeries, {
      upColor: "#2fd6a0",
      downColor: "#ff6b7d",
      borderVisible: false,
      wickUpColor: "#2fd6a0",
      wickDownColor: "#ff6b7d",
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = [];
    };
  }, []);

  // Full history reload (market / interval change)
  useEffect(() => {
    if (!series.current) return;
    series.current.setData(candles.map(toBar));
    last.current = candles.at(-1) ?? null;
    chart.current?.timeScale().scrollToRealTime();
  }, [candles]);

  // Stream the live price into the latest bar
  useEffect(() => {
    if (!series.current || !livePx || !last.current) return;
    const step = INTERVAL_MS[interval];
    const bucket = Math.floor(Date.now() / step) * step;
    let bar = last.current;
    if (bucket > bar.t) {
      bar = { t: bucket, o: bar.c, h: livePx, l: livePx, c: livePx, v: 0 };
    } else {
      bar = { ...bar, h: Math.max(bar.h, livePx), l: Math.min(bar.l, livePx), c: livePx };
    }
    last.current = bar;
    series.current.update(toBar(bar));
  }, [livePx, interval]);

  // Entry & liquidation lines for open positions
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    lines.current = positions.flatMap((p) => [
      s.createPriceLine({
        price: p.entryPx,
        color: p.side === "long" ? "#2fd6a0" : "#ff6b7d",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: `${p.side.toUpperCase()} ${p.leverage}x`,
      }),
      s.createPriceLine({
        price: liquidationPx(p),
        color: "rgba(255,180,80,0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: "LIQ",
      }),
    ]);
  }, [positions]);

  return <div ref={el} className="h-full w-full" />;
}
