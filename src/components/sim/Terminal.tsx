"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useLedger, useMe, type Ledger } from "@/lib/account";
import { computeFeatures } from "@/lib/features";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { useAllMids, useAssetCtx, useHlStatus } from "@/lib/hl-socket";
import { fetchCandles, fetchMarkets, INTERVALS, type Candle, type Interval, type MarketCtx } from "@/lib/hyperliquid";
import { readiness } from "@/lib/readiness";
import { limitCrossed, margin, reserved, triggerHit, unrealized, type ClosedTrade } from "@/lib/sim";
import { trackStats } from "@/lib/stats";
import { AccountChip } from "./AccountChip";
import { SharingPrompt, SharingSettings } from "./DataSharing";
import { Blotter } from "./Blotter";
import { MarketBar } from "./MarketBar";
import { OrderBook } from "./OrderBook";
import { OrderTicket } from "./OrderTicket";
import { PriceChart } from "./PriceChart";
import { Guide, guideSeen } from "./Guide";
import { Recorded } from "./Recorded";

/** A small preference remembered in this browser (market, chart interval). */
function useRemembered<T extends string>(key: string, initial: T, valid: (v: string) => boolean = () => true) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v && valid(v)) setValue(v as T);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {}
  };
  return [value, set] as const;
}

export function Terminal() {
  const { me, signOut, saveSharing } = useMe();
  const [sharingOpen, setSharingOpen] = useState(false);
  // The guide opens by itself on a first visit and from the header after that
  const [guideOpen, setGuideOpen] = useState(false);
  // A trade that closes while you're here gets a card saying what it recorded
  const [recorded, setRecorded] = useState<ClosedTrade | null>(null);
  const [showAgent, setShowAgent] = useState(0);
  const knownTrades = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!guideSeen()) setGuideOpen(true);
  }, []);
  const ledger = useLedger(!!me?.user);
  const { state, fire, poke } = ledger;
  const ready = !!me && ledger.ready;
  useEffect(() => {
    if (!ready) return;
    const ids = state.history.map((t) => t.id);
    // The trades already there when the page loads are known; only new closes get a card
    if (!knownTrades.current) {
      knownTrades.current = new Set(ids);
      return;
    }
    const fresh = state.history.filter((t) => !knownTrades.current!.has(t.id));
    ids.forEach((id) => knownTrades.current!.add(id));
    if (fresh.length) setRecorded(fresh.reduce((a, b) => (b.closedAt > a.closedAt ? b : a)));
  }, [ready, state.history]);
  const status = useHlStatus();

  const [coin, setCoin] = useRemembered<string>("kinfield.coin", "BTC", (v) => /^[A-Za-z0-9]{1,20}$/.test(v));
  const [interval, setInterval_] = useRemembered<Interval>("kinfield.interval", "15m", (v) =>
    INTERVALS.includes(v as Interval),
  );
  const [markets, setMarkets] = useState<Record<string, MarketCtx>>({});
  const [minuteBars, setMinuteBars] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pick, setPick] = useState<{ px: number; n: number } | null>(null);

  // Every listed market with 24h stats (prices themselves stream over the socket)
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMarkets()
        .then((m) => {
          if (!alive) return;
          setMarkets(m);
          setError(null);
        })
        .catch((e) => alive && setError((e as Error).message));
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // 1-minute bars for the apprentice's view of the market
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

  const liveMids = useAllMids();
  const prices = useMemo(
    () => ({ ...Object.fromEntries(Object.values(markets).map((m) => [m.coin, m.mid])), ...liveMids }),
    [markets, liveMids],
  );
  const live = useAssetCtx(coin);
  const market = markets[coin];
  const mid = prices[coin];
  const features = useMemo(() => computeFeatures(minuteBars, mid ?? 0), [minuteBars, mid]);

  // Live triggers: take profit, stop loss, liquidation, limit fills
  useEffect(() => {
    for (const p of state.positions) {
      const px = prices[p.coin];
      const hit = px ? triggerHit(p, px, px) : null;
      if (hit) fire(p, hit);
    }
    for (const o of state.orders) {
      const px = prices[o.coin];
      if (px && limitCrossed(o, px, px)) poke();
    }
  }, [prices, state.positions, state.orders, fire, poke]);

  const upnl = state.positions.reduce((a, p) => a + (prices[p.coin] ? unrealized(p, prices[p.coin]) : 0), 0);
  const used = state.positions.reduce((a, p) => a + margin(p), 0);
  const held = state.orders.reduce((a, o) => a + reserved(o), 0);
  const equity = state.cash + upnl;
  const free = Math.max(equity - used - held, 0);

  const selectCoin = (c: string) => {
    setCoin(c);
    setPick(null);
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-3 py-2">
        <h1 className="sr-only">Kinfield simulator: paper trading on live Hyperliquid prices</h1>
        <Logo />
        <span className="rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan">
          Simulation
        </span>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <span className="rounded-md bg-navy-800 px-2.5 py-1 text-cream">Terminal</span>
          <Link href="/agent" className="rounded-md px-2.5 py-1 text-muted hover:text-cream">
            Your agent
          </Link>
          <button onClick={() => setGuideOpen(true)} className="rounded-md px-2.5 py-1 text-muted hover:text-cream">
            How it works
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-x-5">
          <div className="hidden items-center gap-x-5 text-xs sm:flex">
            <HeaderStat label="Equity" value={fmtUsd(equity)} />
            <HeaderStat
              label="Return"
              value={fmtPct(equity / ledger.startingBalance - 1)}
              className={tone(equity - ledger.startingBalance)}
            />
          </div>
          <AccountChip me={me} onSignOut={signOut} onSharing={() => setSharingOpen(true)} />
        </div>
      </header>

      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} />
      {recorded && (
        <Recorded
          trade={recorded}
          examples={state.history.filter((t) => t.entryFeatures).length}
          signedIn={ledger.mode === "account"}
          onAgent={() => {
            setShowAgent((n) => n + 1);
            setRecorded(null);
            document.querySelector('[data-guide="blotter"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }}
          onClose={() => setRecorded(null)}
        />
      )}
      <div data-guide="market">
      <MarketBar coin={coin} markets={markets} live={live} price={mid} status={status} onPick={selectCoin} />
      </div>

      {me && !me.user && (
        <div className="border-b border-line bg-navy-900/60 px-3 py-1.5 text-xs text-muted">
          Guest mode: trades stay in this browser, and limit orders are off.{" "}
          {me.signIn.available ? "Sign in to keep a verified track record your agent can be judged on." : ""}
        </div>
      )}
      {me?.user && !me.user.sharing.decided && (
        <SharingPrompt sharing={me.user.sharing} onSave={saveSharing} onOptions={() => setSharingOpen(true)} />
      )}
      {sharingOpen && me?.user && (
        <SharingSettings
          sharing={me.user.sharing}
          login={me.user.login}
          onSave={saveSharing}
          onClose={() => setSharingOpen(false)}
        />
      )}
      {(notice || error) && (
        <div className="flex items-center justify-between gap-4 border-b border-short/30 bg-short/10 px-3 py-1.5 text-xs text-short">
          <span>{notice ?? `Market data issue: ${error}. Retrying…`}</span>
          {notice && (
            <button onClick={() => setNotice(null)} className="underline">
              Dismiss
            </button>
          )}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-2 p-2 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_280px_320px] lg:grid-rows-[minmax(0,1fr)_250px]">
        <section className="tpanel h-[440px] overflow-hidden lg:col-start-1 lg:row-start-1 lg:h-auto lg:min-h-0">
          <PriceChart
            coin={coin}
            interval={interval}
            onInterval={setInterval_}
            positions={state.positions.filter((p) => p.coin === coin)}
            orders={state.orders.filter((o) => o.coin === coin)}
            history={state.history.filter((t) => t.coin === coin)}
          />
        </section>

        <aside data-guide="ticket" className="tpanel flex flex-col overflow-y-auto scroll-thin lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:min-h-0">
          <OrderTicket
            coin={coin}
            mid={mid}
            market={market}
            freeMargin={free}
            guest={ledger.mode === "guest"}
            ready={!!market && ready}
            pick={pick}
            onSubmit={(o) => ledger.open({ ...o, coin, entryPx: mid, entryFeatures: features })}
          />
          <AccountSummary ledger={ledger} equity={equity} upnl={upnl} used={used} held={held} free={free} />
          <p className="mt-auto px-3 pb-3 text-[10px] leading-relaxed text-muted/80">
            Simulated trading with live prices from Hyperliquid. No real funds are used. Not financial advice.{" "}
            <Link href="/" className="underline">
              About Kinfield
            </Link>
          </p>
        </aside>

        <section className="h-[460px] lg:col-start-2 lg:row-start-1 lg:h-auto lg:min-h-0">
          <OrderBook
            coin={coin}
            mid={mid}
            szDecimals={market?.szDecimals ?? 4}
            onPickPrice={(px) => setPick((p) => ({ px, n: (p?.n ?? 0) + 1 }))}
          />
        </section>

        <section data-guide="blotter" className="h-[340px] lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:h-auto lg:min-h-0">
          <Blotter
            coin={coin}
            positions={state.positions}
            orders={state.orders}
            history={state.history}
            prices={prices}
            markets={markets}
            features={features}
            guest={ledger.mode === "guest"}
            agentName={me?.user?.sharing.agentId}
            showAgent={showAgent}
            onSelectCoin={selectCoin}
            onClose={async (p) => {
              if (prices[p.coin]) setNotice(await ledger.close(p, prices[p.coin]));
            }}
            onCancel={async (o) => setNotice(await ledger.cancel(o))}
            onSetTpSl={(p, tp, sl) => ledger.setTpSl(p, tp, sl, prices[p.coin] ?? p.entryPx)}
          />
        </section>
      </main>
    </div>
  );
}

function HeaderStat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-[0.06em] text-muted">{label}</span>
      <span className={`num ${className}`}>{value}</span>
    </div>
  );
}

function AccountSummary({
  ledger,
  equity,
  upnl,
  used,
  held,
  free,
}: {
  ledger: Ledger;
  equity: number;
  upnl: number;
  used: number;
  held: number;
  free: number;
}) {
  const { history } = ledger.state;
  const realized = history.reduce((a, t) => a + t.pnl, 0);
  const wins = history.filter((t) => t.pnl > 0).length;
  const rows: [string, string, string?][] = [
    ["Equity", fmtUsd(equity)],
    ["Balance", fmtUsd(ledger.state.cash)],
    ["Unrealized PnL", fmtUsd(upnl, true), tone(upnl)],
    ["Realized PnL", fmtUsd(realized, true), tone(realized)],
    ["Margin in use", fmtUsd(used)],
    ...(held ? [["Held for orders", fmtUsd(held)] as [string, string]] : []),
    ["Free margin", fmtUsd(free)],
    ["Closed trades", String(history.length)],
    ["Win rate", history.length ? `${((wins / history.length) * 100).toFixed(0)}%` : "N/A"],
  ];
  return (
    <div className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold">
          Account
          <span className="rounded-full border border-cyan/40 bg-cyan/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-cyan">
            Simulated
          </span>
        </h3>
        <button
          onClick={() =>
            confirm(
              ledger.mode === "account"
                ? "Start a new simulated account? Your current record is archived, not deleted."
                : "Reset your simulated account and trade log?",
            ) && ledger.reset()
          }
          className="text-[11px] text-muted underline-offset-2 hover:text-cream hover:underline"
        >
          {ledger.mode === "account" ? "New account" : "Reset"}
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className={`num text-right ${cls ?? ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {ledger.mode === "account" && ledger.accountCreatedAt && <ReadinessLink ledger={ledger} />}
      {ledger.ledger && (
        <p className="mt-3 rounded-lg border border-line bg-navy-950/40 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted">
          Verified ledger: {ledger.ledger.entries} entries recorded by Kinfield
          <br />
          head {ledger.ledger.head.slice(0, 16)}
        </p>
      )}
    </div>
  );
}

/** How the current account stands against the readiness checks, linking to the full report. */
function ReadinessLink({ ledger }: { ledger: Ledger }) {
  const history = ledger.state.history;
  const r = useMemo(
    () =>
      readiness(
        trackStats(history.map((t) => ({ pnl: t.pnl, openedAt: t.openedAt, closedAt: t.closedAt })), ledger.startingBalance),
        ledger.accountCreatedAt ?? Date.now(),
      ),
    [history, ledger.startingBalance, ledger.accountCreatedAt],
  );
  return (
    <Link href="/agent" className="group mt-3 block rounded-lg border border-line p-2 hover:border-cyan/50">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-mist">Readiness</span>
        <span className="text-muted group-hover:text-cyan">
          <span className="num text-cream">{r.passed}</span> of {r.total} checks · View
        </span>
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {r.checks.map((c) => (
          <span key={c.id} className={`h-1 flex-1 rounded-full ${c.pass ? "bg-long" : "bg-cyan/15"}`} />
        ))}
      </div>
    </Link>
  );
}
