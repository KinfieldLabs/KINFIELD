"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { computeFeatures } from "@/lib/features";
import { fmtCompact, fmtPct, fmtPx, fmtUsd, tone } from "@/lib/format";
import { fetchCandles, fetchMarkets, MARKETS, type Candle, type Interval, type MarketCtx } from "@/lib/hyperliquid";
import { liquidationPx, margin, STARTING_BALANCE, unrealized, useSimulator } from "@/lib/sim";
import { AgentPanel } from "./AgentPanel";
import { Blotter } from "./Blotter";
import { OrderTicket } from "./OrderTicket";
import { PriceChart } from "./PriceChart";

const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h"];

export function Terminal() {
  const { state, open, close, reset } = useSimulator();
  const [coin, setCoin] = useState<string>("BTC");
  const [interval, setInterval_] = useState<Interval>("5m");
  const [markets, setMarkets] = useState<Record<string, MarketCtx>>({});
  const [candles, setCandles] = useState<Candle[]>([]);
  const [minuteBars, setMinuteBars] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Live market contexts (all tracked coins + any held coins)
  const tracked = useMemo(
    () => Array.from(new Set([...MARKETS, ...state.positions.map((p) => p.coin)])),
    [state.positions],
  );
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const m = await fetchMarkets(tracked);
        if (alive) {
          setMarkets(m);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tracked]);

  // Chart history
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchCandles(coin, interval, 300)
        .then((c) => alive && setCandles(c))
        .catch((e) => alive && setError(e.message));
    setCandles([]);
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [coin, interval]);

  // 1-minute bars for the agent's feature vector
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchCandles(coin, "1m", 90)
        .then((c) => alive && setMinuteBars(c))
        .catch(() => {});
    setMinuteBars([]);
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [coin]);

  const prices = useMemo(
    () => Object.fromEntries(Object.values(markets).map((m) => [m.coin, m.mid])),
    [markets],
  );
  const market = markets[coin];
  const features = useMemo(() => computeFeatures(minuteBars, market?.mid ?? 0), [minuteBars, market?.mid]);

  // Liquidations
  useEffect(() => {
    for (const p of state.positions) {
      const px = prices[p.coin];
      if (!px) continue;
      const liq = liquidationPx(p);
      if ((p.side === "long" && px <= liq) || (p.side === "short" && px >= liq)) close(p.id, px, true);
    }
  }, [prices, state.positions, close]);

  const upnl = state.positions.reduce((a, p) => a + (prices[p.coin] ? unrealized(p, prices[p.coin]) : 0), 0);
  const used = state.positions.reduce((a, p) => a + margin(p), 0);
  const equity = state.cash + upnl;
  const freeMargin = Math.max(equity - used, 0);
  const realized = state.history.reduce((a, t) => a + t.pnl, 0);
  const wins = state.history.filter((t) => t.pnl > 0).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
        <Logo />
        <span className="rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cyan">
          Simulation
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <Stat label="Equity" value={fmtUsd(equity)} />
          <Stat label="Unrealized" value={fmtUsd(upnl, true)} className={tone(upnl)} />
          <Stat label="Realized" value={fmtUsd(realized, true)} className={tone(realized)} />
          <Stat label="Return" value={fmtPct(equity / STARTING_BALANCE - 1)} className={tone(equity - STARTING_BALANCE)} />
          <Stat
            label="Win rate"
            value={state.history.length ? `${((wins / state.history.length) * 100).toFixed(0)}%` : "N/A"}
          />
          <button
            onClick={() => confirm("Reset your simulated account and trade log?") && reset()}
            className="text-muted underline-offset-2 hover:text-cream hover:underline"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-2">
        {MARKETS.map((c) => {
          const m = markets[c];
          return (
            <button
              key={c}
              onClick={() => setCoin(c)}
              className={`-mb-px flex shrink-0 items-baseline gap-2 border-b-2 px-3 py-2.5 text-sm ${
                coin === c ? "border-cyan" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <span className="font-semibold">{c}</span>
              <span className="font-mono text-xs">{m ? fmtPx(m.mid) : "…"}</span>
              {m && <span className={`font-mono text-[11px] ${tone(m.change24h)}`}>{fmtPct(m.change24h)}</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="border-b border-short/30 bg-short/10 px-4 py-2 text-xs text-short">
          Market data issue: {error}. Retrying…
        </div>
      )}

      <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="panel flex flex-col">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl tracking-[-0.03em]">{coin}-USD</span>
                <span className="font-mono text-xl font-light">{market ? fmtPx(market.mid) : "…"}</span>
              </div>
              {market && (
                <div className="flex gap-5 text-xs">
                  <Stat label="24h" value={fmtPct(market.change24h)} className={tone(market.change24h)} />
                  <Stat label="24h volume" value={fmtCompact(market.volume24h)} />
                  <Stat label="Funding / 1h" value={fmtPct(market.funding, 4)} className={tone(market.funding)} />
                </div>
              )}
              <div className="ml-auto flex gap-1 rounded-full bg-navy-950/60 p-1">
                {INTERVALS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setInterval_(i)}
                    className={`rounded-full px-2.5 py-1 font-mono text-xs ${
                      interval === i ? "bg-navy-700 text-cream" : "text-muted hover:text-cream"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative h-[420px]">
              <PriceChart
                candles={candles}
                interval={interval}
                livePx={market?.mid}
                positions={state.positions.filter((p) => p.coin === coin)}
              />
              {!candles.length && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                  Loading {coin} candles…
                </div>
              )}
            </div>
          </div>

          <div className="h-[280px]">
            <Blotter
              positions={state.positions}
              history={state.history}
              prices={prices}
              onClose={(p) => prices[p.coin] && close(p.id, prices[p.coin])}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <OrderTicket
            coin={coin}
            price={market?.mid}
            freeMargin={freeMargin}
            maxLeverage={Math.min(market?.maxLeverage ?? 20, 20)}
            ready={!!market}
            onSubmit={(o) => market && open({ ...o, coin, entryPx: market.mid, entryFeatures: features })}
          />
          <AgentPanel coin={coin} history={state.history} features={features} />
          <p className="px-1 text-[11px] leading-relaxed text-muted/80">
            Simulated trading with live prices from Hyperliquid. No real funds are used. Not financial advice.{" "}
            <Link href="/" className="underline">
              About Kinfield
            </Link>
          </p>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      <span className={`font-mono ${className}`}>{value}</span>
    </div>
  );
}
