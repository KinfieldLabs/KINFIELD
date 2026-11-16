"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { fmtCompact, fmtPct, fmtPxAt, pxDecimals, tone } from "@/lib/format";
import { useHl } from "@/lib/hl-socket";
import { fetchCandles, INTERVAL_MS, INTERVALS, type Candle, type Interval } from "@/lib/hyperliquid";
import { liquidationPx, type ClosedTrade, type Order, type Position } from "@/lib/sim";

interface Props {
  coin: string;
  interval: Interval;
  onInterval: (i: Interval) => void;
  positions: Position[];
  orders: Order[];
  history: ClosedTrade[];
}

const LONG = "#2fd6a0";
const SHORT = "#ff6b7d";
const CYAN = "#3fc8f0";
const AMBER = "rgba(255,180,80,0.8)";

const sec = (ms: number) => (ms / 1000) as UTCTimestamp;
const toBar = (c: Candle) => ({ time: sec(c.t), open: c.o, high: c.h, low: c.l, close: c.c });
const toVol = (c: Candle) => ({
  time: sec(c.t),
  value: c.v,
  color: c.c >= c.o ? "rgba(47,214,160,0.28)" : "rgba(255,107,125,0.28)",
});

const REASON: Record<string, string> = { take_profit: "TP", stop_loss: "SL", liquidation: "LIQ", manual: "" };

export function PriceChart({ coin, interval, onInterval, positions, orders, history }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const bars = useRef<Candle[]>([]);
  const loaded = useRef<string | null>(null);
  const hovering = useRef(false);
  const [legend, setLegend] = useState<Candle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Chart setup
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
      grid: { vertLines: { color: "rgba(120,170,255,0.06)" }, horzLines: { color: "rgba(120,170,255,0.06)" } },
      rightPriceScale: { borderColor: "rgba(120,170,255,0.14)", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: "rgba(120,170,255,0.14)", timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: {
        vertLine: { color: "rgba(63,200,240,0.4)", labelBackgroundColor: "#0c2f85" },
        horzLine: { color: "rgba(63,200,240,0.4)", labelBackgroundColor: "#0c2f85" },
      },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: LONG,
      downColor: SHORT,
      borderVisible: false,
      wickUpColor: LONG,
      wickDownColor: SHORT,
    });
    volume.current = c.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    volume.current.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    markers.current = createSeriesMarkers(candles.current, []);
    c.subscribeCrosshairMove((param) => {
      const d = param.time && candles.current ? param.seriesData.get(candles.current) : undefined;
      hovering.current = !!d;
      if (d && "open" in d) {
        const k = d as CandlestickData<Time>;
        const t = (k.time as number) * 1000;
        const v = bars.current.find((b) => b.t === t)?.v ?? 0;
        setLegend({ t, o: k.open, h: k.high, l: k.low, c: k.close, v });
      } else setLegend(bars.current.at(-1) ?? null);
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = candles.current = volume.current = markers.current = null;
      lines.current = [];
    };
  }, []);

  // History for the market and interval
  useEffect(() => {
    let alive = true;
    const key = `${coin}:${interval}`;
    loaded.current = null;
    setLoading(true);
    setFailed(false);
    bars.current = [];
    candles.current?.setData([]);
    volume.current?.setData([]);
    fetchCandles(coin, interval, 500)
      .then((data) => {
        if (!alive || !candles.current || !volume.current) return;
        const d = pxDecimals(data.at(-1)?.c ?? 1);
        candles.current.applyOptions({ priceFormat: { type: "price", precision: d, minMove: 10 ** -d } });
        bars.current = data;
        candles.current.setData(data.map(toBar));
        volume.current.setData(data.map(toVol));
        chart.current?.timeScale().scrollToRealTime();
        loaded.current = key;
        setLegend(data.at(-1) ?? null);
        setLoading(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [coin, interval]);

  // Live candle stream
  const lastLegend = useRef(0);
  useHl({ type: "candle", coin, interval }, (d) => {
    const k = d as { t: number; s: string; i: string; o: string; c: string; h: string; l: string; v: string };
    if (loaded.current !== `${k.s}:${k.i}` || !candles.current || !volume.current) return;
    const bar: Candle = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
    const last = bars.current.at(-1);
    if (last && bar.t < last.t) return;
    if (last && bar.t === last.t) bars.current[bars.current.length - 1] = bar;
    else bars.current.push(bar);
    try {
      candles.current.update(toBar(bar));
      volume.current.update(toVol(bar));
    } catch {}
    if (!hovering.current && Date.now() - lastLegend.current > 250) {
      lastLegend.current = Date.now();
      setLegend(bar);
    }
  });

  // Levels: entries, liquidation, take profit, stop loss, resting orders
  useEffect(() => {
    const s = candles.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    const line = (price: number, color: string, title: string, style = LineStyle.Dashed) =>
      s.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, title, axisLabelVisible: true });
    lines.current = [
      ...positions.flatMap((p) => [
        line(p.entryPx, p.side === "long" ? LONG : SHORT, `${p.side.toUpperCase()} ${p.leverage}x`),
        line(liquidationPx(p), AMBER, "LIQ", LineStyle.Dotted),
        ...(p.tpPx ? [line(p.tpPx, LONG, "TP", LineStyle.Dotted)] : []),
        ...(p.slPx ? [line(p.slPx, SHORT, "SL", LineStyle.Dotted)] : []),
      ]),
      ...orders.map((o) => line(o.limitPx, CYAN, `LIMIT ${o.side.toUpperCase()}`)),
    ];
  }, [positions, orders, loading]);

  // Trade markers: where you got in and out
  useEffect(() => {
    if (!markers.current) return;
    const step = INTERVAL_MS[interval];
    const first = bars.current[0]?.t ?? Infinity;
    const at = (t: number) => sec(Math.floor(t / step) * step);
    const list: SeriesMarker<Time>[] = [];
    const isClosed = (t: Position | ClosedTrade): t is ClosedTrade => "closedAt" in t;
    for (const t of [...history, ...positions]) {
      if (t.openedAt >= first)
        list.push({
          time: at(t.openedAt),
          position: t.side === "long" ? "belowBar" : "aboveBar",
          shape: t.side === "long" ? "arrowUp" : "arrowDown",
          color: t.side === "long" ? LONG : SHORT,
          text: t.side === "long" ? "L" : "S",
        });
      if (isClosed(t) && t.closedAt >= first)
        list.push({
          time: at(t.closedAt),
          position: t.side === "long" ? "aboveBar" : "belowBar",
          shape: "circle",
          color: t.pnl >= 0 ? LONG : SHORT,
          text: REASON[t.exitReason ?? "manual"] || "X",
        });
    }
    list.sort((a, b) => (a.time as number) - (b.time as number));
    markers.current.setMarkers(list);
  }, [history, positions, interval, loading]);

  const ref = legend?.c ?? 1;
  const chg = legend ? legend.c / legend.o - 1 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {INTERVALS.map((i) => (
          <button
            key={i}
            onClick={() => onInterval(i)}
            className={`rounded-md px-2 py-1 font-mono text-xs ${
              interval === i ? "bg-navy-700 text-cream" : "text-muted hover:text-cream"
            }`}
          >
            {i}
          </button>
        ))}
        <button
          onClick={() => chart.current?.timeScale().scrollToRealTime()}
          className="ml-auto rounded-md px-2 py-1 text-xs text-muted hover:text-cream"
          title="Jump to the latest candle"
        >
          Latest ⇥
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={el} className="absolute inset-0" />
        {legend && (
          <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted">
            <span className="text-cream">
              {coin} · {interval}
            </span>
            <span>
              O <span className={tone(chg)}>{fmtPxAt(legend.o, ref)}</span>
            </span>
            <span>
              H <span className={tone(chg)}>{fmtPxAt(legend.h, ref)}</span>
            </span>
            <span>
              L <span className={tone(chg)}>{fmtPxAt(legend.l, ref)}</span>
            </span>
            <span>
              C <span className={tone(chg)}>{fmtPxAt(legend.c, ref)}</span>
            </span>
            <span className={tone(chg)}>{fmtPct(chg)}</span>
            <span>Vol {fmtCompact(legend.v * legend.c)}</span>
          </div>
        )}
        {(loading || failed) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {failed ? "Couldn't load candles. Retrying when you switch markets." : `Loading ${coin} candles…`}
          </div>
        )}
      </div>
    </div>
  );
}
