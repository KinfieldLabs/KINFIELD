"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineStyle,
  TickMarkType,
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
import { fetchCandles, fetchCandlesBefore, INTERVAL_MS, INTERVALS, type Candle, type Interval } from "@/lib/hyperliquid";
import { liquidationPx, type ClosedTrade, type Order, type Position } from "@/lib/sim";
import { IndicatorMenu } from "./chart/IndicatorMenu";
import { StudyLayer } from "./chart/StudyLayer";
import { StudyRow } from "./chart/StudyRow";
import { STUDIES, type Study } from "./chart/studies";
import { useStudies } from "./chart/useStudies";
import { DrawingController } from "./chart/drawings/DrawingController";
import { DrawingLayer } from "./chart/drawings/DrawingLayer";
import { DrawToolbar } from "./chart/drawings/DrawToolbar";
import { SHORTCUTS, TOOL_NAMES, useDrawings, type Drawing, type Tool, type ToolKind } from "./chart/drawings/model";

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

/** Chart times are UTC; labels always carry the month (and the year where it changes). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
function tickLabel(time: Time, type: TickMarkType): string {
  const d = new Date((time as number) * 1000);
  const month = MONTHS[d.getUTCMonth()];
  switch (type) {
    case TickMarkType.Year:
      return String(d.getUTCFullYear());
    case TickMarkType.Month:
      return `${month} ${d.getUTCFullYear()}`;
    case TickMarkType.DayOfMonth:
      return `${d.getUTCDate()} ${month}`;
    default:
      return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
}
const crosshairTime = (time: Time) => {
  const d = new Date((time as number) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}  ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

/** Candles loaded when a market or interval opens; older ones load as you scroll back. */
const INITIAL_BARS = 1500;
const OLDER_CHUNK = 1500;
/** Candles in view when a chart opens. */
const VIEW_BARS = 160;

const REASON: Record<string, string> = { take_profit: "TP", stop_loss: "SL", liquidation: "LIQ", time_stop: "T", manual: "" };

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
  const older = useRef({ loading: false, done: false });
  const [depth, setDepth] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** False while the newest candle is scrolled out of view. */
  const [atLatest, setAtLatest] = useState(true);
  const [legend, setLegend] = useState<Candle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const studyLayer = useRef<StudyLayer | null>(null);
  const { studies, full, add, remove, toggle, update } = useStudies();
  /** Indicator whose settings are open. */
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const closeSettings = useCallback(() => setSettingsFor(null), []);

  // Drawings: the controller reads the latest tool, drawings and interval through refs
  const [tool, setTool] = useState<Tool>("cursor");
  const { drawings, save: saveDrawings } = useDrawings(coin);
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [magnet, setMagnet] = useState(false);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  useEffect(() => {
    try {
      setMagnet(localStorage.getItem("kinfield.magnet") === "1");
    } catch {}
  }, []);
  const drawLayer = useRef<DrawingLayer | null>(null);
  const drawCtl = useRef<DrawingController | null>(null);
  const live = useRef({ tool, drawings, saveDrawings, interval });
  useEffect(() => {
    live.current = { tool, drawings, saveDrawings, interval };
  });
  /** Bar under the crosshair, for the legend; null shows the latest. */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
        panes: { separatorColor: "rgba(120,170,255,0.14)", separatorHoverColor: "rgba(63,200,240,0.16)" },
      },
      grid: { vertLines: { color: "rgba(120,170,255,0.06)" }, horzLines: { color: "rgba(120,170,255,0.06)" } },
      rightPriceScale: { borderColor: "rgba(120,170,255,0.14)", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: {
        borderColor: "rgba(120,170,255,0.14)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        // Never scroll or zoom out past the oldest candle into empty space
        fixLeftEdge: true,
        // Zoom around the latest candle, not the cursor, so the future doesn't open up as a gap
        rightBarStaysOnScroll: true,
        tickMarkFormatter: tickLabel,
      },
      localization: { timeFormatter: crosshairTime },
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
    studyLayer.current = new StudyLayer(c);
    const layer = new DrawingLayer(
      () => bars.current,
      () => INTERVAL_MS[live.current.interval],
      (ms) => crosshairTime(sec(ms)),
    );
    candles.current.attachPrimitive(layer);
    drawLayer.current = layer;
    drawCtl.current = new DrawingController(el.current, c, layer, {
      tool: () => live.current.tool,
      done: () => setTool("cursor"),
      drawings: () => live.current.drawings,
      save: (next: Drawing[]) => live.current.saveDrawings(next),
      select: setSelectedDrawing,
    });

    // Scrolling or zooming out near the oldest candle loads the history before it
    const loadOlder = async () => {
      const st = older.current;
      const key = loaded.current;
      if (!key || st.loading || st.done || !bars.current.length) return;
      st.loading = true;
      setLoadingOlder(true);
      const [k, iv] = key.split(":") as [string, Interval];
      const first = bars.current[0].t;
      try {
        const data = await fetchCandlesBefore(k, iv, first, OLDER_CHUNK);
        if (loaded.current !== key || !candles.current || !volume.current) return;
        if (!data.length) {
          st.done = true;
          return;
        }
        const ts = c.timeScale();
        const range = ts.getVisibleLogicalRange();
        bars.current = [...data, ...bars.current];
        candles.current.setData(bars.current.map(toBar));
        volume.current.setData(bars.current.map(toVol));
        studyLayer.current?.reload(bars.current);
        // Keep the same candles in view after the indexes shift
        if (range) ts.setVisibleLogicalRange({ from: range.from + data.length, to: range.to + data.length });
        setDepth(bars.current.length);
      } catch {
        // try again on the next scroll
      } finally {
        st.loading = false;
        setLoadingOlder(false);
      }
    };
    c.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (!r) return;
      if (r.from < 60) loadOlder();
      setAtLatest(!bars.current.length || r.to >= bars.current.length - 2);
    });
    c.subscribeCrosshairMove((param) => {
      const d = param.time && candles.current ? param.seriesData.get(candles.current) : undefined;
      hovering.current = !!d;
      setHoverIdx(d && param.logical != null ? param.logical : null);
      if (d && "open" in d) {
        const k = d as CandlestickData<Time>;
        const t = (k.time as number) * 1000;
        const v = bars.current.find((b) => b.t === t)?.v ?? 0;
        setLegend({ t, o: k.open, h: k.high, l: k.low, c: k.close, v });
      } else setLegend(bars.current.at(-1) ?? null);
    });
    chart.current = c;
    return () => {
      drawCtl.current?.destroy();
      drawCtl.current = drawLayer.current = null;
      c.remove();
      chart.current = candles.current = volume.current = markers.current = studyLayer.current = null;
      lines.current = [];
    };
  }, []);

  // History for the market and interval
  useEffect(() => {
    let alive = true;
    const key = `${coin}:${interval}`;
    loaded.current = null;
    older.current = { loading: false, done: false };
    setLoading(true);
    setFailed(false);
    bars.current = [];
    candles.current?.setData([]);
    volume.current?.setData([]);
    studyLayer.current?.reload([]);
    fetchCandles(coin, interval, INITIAL_BARS)
      .then((data) => {
        if (!alive || !candles.current || !volume.current) return;
        const d = pxDecimals(data.at(-1)?.c ?? 1);
        candles.current.applyOptions({ priceFormat: { type: "price", precision: d, minMove: 10 ** -d } });
        bars.current = data;
        candles.current.setData(data.map(toBar));
        volume.current.setData(data.map(toVol));
        studyLayer.current?.setPrecision(d);
        studyLayer.current?.reload(data);
        // Open on the latest candles at a readable zoom, whatever the last chart's zoom was
        chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - VIEW_BARS), to: data.length + 6 });
        loaded.current = key;
        setDepth(data.length);
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
    studyLayer.current?.tick(bars.current);
    if (!hovering.current && Date.now() - lastLegend.current > 250) {
      lastLegend.current = Date.now();
      setLegend(bar);
    }
  });

  /** Jumps straight to the newest candles, keeping the current zoom (no long scroll animation). */
  const toLatest = () => {
    const ts = chart.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    const n = bars.current.length;
    if (!ts || !n) return;
    const span = r ? Math.max(20, r.to - r.from) : VIEW_BARS;
    ts.setVisibleLogicalRange({ from: n - span + 6, to: n + 6 });
  };

  // While viewing history, the axis label would show the last candle in view as if it were the
  // current price, so it's hidden until the chart is back at the present.
  useEffect(() => {
    candles.current?.applyOptions({ lastValueVisible: atLatest });
    studyLayer.current?.setLastValueVisible(atLatest);
  }, [atLatest]);

  // Drawings
  useEffect(() => {
    drawLayer.current?.update({ drawings });
    // A selection whose drawing is gone (removed, or another market) clears
    if (selectedDrawing && !drawings.some((d) => d.id === selectedDrawing)) drawCtl.current?.select(null);
  }, [drawings, selectedDrawing]);
  useEffect(() => {
    drawLayer.current?.update({ editable: tool === "cursor", hovered: null });
  }, [tool]);
  useEffect(() => {
    drawLayer.current?.update({ magnet });
  }, [magnet]);
  useEffect(() => {
    drawLayer.current?.update({ hidden: drawingsHidden, hovered: null });
    if (drawingsHidden) drawCtl.current?.select(null);
  }, [drawingsHidden]);
  useEffect(() => {
    drawCtl.current?.cancel();
    setTool("cursor");
  }, [coin]);

  // Shortcuts: Alt plus a letter picks a drawing tool, again puts it down; Escape returns to the cursor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        if (live.current.tool !== "cursor" && !drawLayer.current?.draft) setTool("cursor");
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      // By physical key, since Alt changes the character typed on a Mac
      const kind = (Object.keys(SHORTCUTS) as ToolKind[]).find((k) => e.code === `Key${SHORTCUTS[k]}`);
      if (!kind) return;
      e.preventDefault();
      drawCtl.current?.cancel();
      setTool(live.current.tool === kind ? "cursor" : kind);
      setDrawingsHidden(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Indicators
  useEffect(() => {
    studyLayer.current?.sync(studies, bars.current);
  }, [studies]);

  // Where each indicator pane starts, for its legend. Panes shift as they're added, removed or resized.
  const [paneTops, setPaneTops] = useState<Record<string, number>>({});
  useEffect(() => {
    const layer = studyLayer.current;
    const root = el.current;
    if (!layer || !root) return;
    const paned = studies.filter((s) => STUDIES[s.kind].pane);
    const measure = () => {
      const base = root.getBoundingClientRect().top;
      const tops: Record<string, number> = {};
      for (const s of paned) {
        const row = layer.paneElement(s.id);
        if (row) tops[s.id] = row.getBoundingClientRect().top - base;
      }
      setPaneTops(tops);
    };
    const ro = new ResizeObserver(measure);
    // New panes get their elements when the chart next draws
    const frame = requestAnimationFrame(() => {
      measure();
      ro.observe(root);
      chart.current?.panes().forEach((p) => {
        const row = p.getHTMLElement();
        if (row) ro.observe(row);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [studies]);

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
  }, [history, positions, interval, loading, depth]);

  const ref = legend?.c ?? 1;
  const chg = legend ? legend.c / legend.o - 1 : 0;
  const idx = hoverIdx ?? bars.current.length - 1;
  const selectedKind = drawings.find((d) => d.id === selectedDrawing)?.kind;
  const rowProps = (s: Study) => {
    const decimals = STUDIES[s.kind].decimals;
    return {
      study: s,
      value: (key: string) => studyLayer.current?.valueAt(s.id, key, idx) ?? null,
      format: (v: number) => (decimals != null ? v.toFixed(decimals) : fmtPxAt(v, ref)),
      settingsOpen: settingsFor === s.id,
      onSettings: () => setSettingsFor((id) => (id === s.id ? null : s.id)),
      onCloseSettings: closeSettings,
      onToggle: () => toggle(s.id),
      onRemove: () => remove(s.id),
      onUpdate: (patch: Partial<Pick<Study, "params" | "slot">>) => update(s.id, patch),
    };
  };

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
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <IndicatorMenu onAdd={add} full={full} />
        <button
          onClick={toLatest}
          className="ml-auto rounded-md px-2 py-1 text-xs text-muted hover:text-cream"
          title="Jump to the latest candle"
        >
          Latest ⇥
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <DrawToolbar
          tool={tool}
          onTool={(t) => {
            drawCtl.current?.cancel();
            setTool(t);
            // Drawing again brings hidden drawings back
            if (t !== "cursor") setDrawingsHidden(false);
          }}
          magnet={magnet}
          onMagnet={(on) => {
            setMagnet(on);
            try {
              localStorage.setItem("kinfield.magnet", on ? "1" : "0");
            } catch {}
          }}
          hidden={drawingsHidden}
          onHidden={setDrawingsHidden}
          count={drawings.length}
          onClear={() => saveDrawings([])}
        />
        <div className="relative min-h-0 flex-1">
          <div ref={el} className="absolute inset-0" style={{ touchAction: tool === "cursor" ? undefined : "none" }} />
          {legend && (
            <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-col items-start gap-0.5 font-mono text-[11px] text-muted">
              <div className="flex flex-wrap gap-x-3">
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
              {studies
                .filter((s) => !STUDIES[s.kind].pane)
                .map((s) => (
                  <StudyRow key={s.id} {...rowProps(s)} />
                ))}
            </div>
          )}
          {legend &&
            studies
              .filter((s) => STUDIES[s.kind].pane && paneTops[s.id] != null)
              .map((s) => (
                <div
                  key={s.id}
                  className="pointer-events-none absolute left-2 z-10 font-mono text-[11px] text-muted"
                  style={{ top: paneTops[s.id] + 4 }}
                >
                  <StudyRow {...rowProps(s)} settingsUp />
                </div>
              ))}
          {selectedKind && (
            <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-line bg-navy-900/95 py-1 pl-2.5 pr-1 text-xs shadow-lg shadow-black/40">
              <span className="text-cream">{TOOL_NAMES[selectedKind]}</span>
              <button
                onClick={() => {
                  const id = selectedDrawing;
                  drawCtl.current?.select(null);
                  saveDrawings(drawings.filter((d) => d.id !== id));
                }}
                aria-label="Delete drawing"
                title="Delete (Del)"
                className="rounded-md p-1 text-muted hover:bg-short/15 hover:text-short"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                  <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.6 4.5l.6 8.5h5.6l.6-8.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
          {!atLatest && !loading && (
            <button
              onClick={toLatest}
              className="absolute bottom-9 right-16 z-10 flex items-center gap-1.5 rounded-md border border-cyan/50 bg-navy-900/95 px-2.5 py-1 text-xs text-cyan shadow-lg shadow-black/40 hover:bg-navy-800"
            >
              Viewing history · Back to now ⇥
            </button>
          )}
          {loadingOlder && (
            <div className="pointer-events-none absolute bottom-8 left-2 z-10 rounded-md border border-line bg-navy-900/90 px-2 py-1 font-mono text-[10px] text-muted">
              Loading earlier candles…
            </div>
          )}
          {(loading || failed) && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              {failed ? "Couldn't load candles. Retrying when you switch markets." : `Loading ${coin} candles…`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
