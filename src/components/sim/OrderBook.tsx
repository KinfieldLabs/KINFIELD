"use client";

import { tabProps } from "./tabs";
import { useMemo, useState } from "react";
import { fmtNum, fmtPxAt, fmtTime, pxDecimals } from "@/lib/format";
import { useBook, useTrades, type BookLevel } from "@/lib/hl-socket";

interface Props {
  coin: string;
  mid: number | undefined;
  szDecimals: number;
  /** Clicking a level hands its price to the order ticket. */
  onPickPrice: (px: number) => void;
}

/** Hyperliquid sends 20 levels a side; a shorter panel hides the levels furthest from the spread. */
const ROWS = 20;
const SIG_FIGS = [5, 4, 3, 2] as const;

/** The price step a given number of significant figures produces at this price. */
const stepFor = (mid: number, sig: number) => 10 ** (Math.floor(Math.log10(mid)) - sig + 1);

export function OrderBook({ coin, mid, szDecimals, onPickPrice }: Props) {
  const [tab, setTab] = useState<"book" | "trades">("book");
  const [sig, setSig] = useState<number>(5);
  const [unit, setUnit] = useState<"coin" | "usd">("coin");
  const t = tabProps("book", ["book", "trades"] as const, tab, setTab);

  return (
    <div className="tpanel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center border-b border-line px-1">
        <div {...t.list} aria-label="Market activity" className="flex">
          <button {...t.tab("book")} onClick={() => setTab("book")} className="tab">
            Order book
          </button>
          <button {...t.tab("trades")} onClick={() => setTab("trades")} className="tab">
            Trades
          </button>
        </div>
        {tab === "book" && (
          <div className="ml-auto flex items-center gap-1 pr-1">
            {mid && (
              <select
                value={sig}
                onChange={(e) => setSig(Number(e.target.value))}
                className="rounded-md border border-line bg-navy-950/60 px-1 py-0.5 font-mono text-[11px] text-mist outline-none"
                aria-label="Price grouping"
              >
                {SIG_FIGS.map((n) => {
                  const step = stepFor(mid, n);
                  return (
                    <option key={n} value={n}>
                      {fmtNum(step, Math.max(0, -Math.floor(Math.log10(step))))}
                    </option>
                  );
                })}
              </select>
            )}
            <button
              onClick={() => setUnit((u) => (u === "coin" ? "usd" : "coin"))}
              className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-mist hover:text-cream"
              title="Show sizes in coin or USD"
            >
              {unit === "coin" ? coin : "USD"}
            </button>
          </div>
        )}
      </div>
      <div {...t.panel} className="flex min-h-0 flex-1 flex-col">
        {tab === "book" ? (
          <Book coin={coin} sig={sig} unit={unit} szDecimals={szDecimals} onPickPrice={onPickPrice} />
        ) : (
          <Tape coin={coin} szDecimals={szDecimals} />
        )}
      </div>
    </div>
  );
}

function Book({
  coin,
  sig,
  unit,
  szDecimals,
  onPickPrice,
}: {
  coin: string;
  sig: number;
  unit: "coin" | "usd";
  szDecimals: number;
  onPickPrice: (px: number) => void;
}) {
  const book = useBook(coin, sig);

  const view = useMemo(() => {
    if (!book) return null;
    const amount = (l: BookLevel) => (unit === "usd" ? l.sz * l.px : l.sz);
    const cumulate = (levels: BookLevel[]) => {
      let total = 0;
      return levels.slice(0, ROWS).map((l) => ({ ...l, amt: amount(l), total: (total += amount(l)) }));
    };
    const bids = cumulate(book.bids);
    const asks = cumulate(book.asks);
    const max = Math.max(bids.at(-1)?.total ?? 0, asks.at(-1)?.total ?? 0, 1e-12);
    const bestBid = book.bids[0]?.px;
    const bestAsk = book.asks[0]?.px;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
    return { bids, asks: asks.reverse(), max, spread, mid: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null };
  }, [book, unit]);

  if (!view) return <div className="flex flex-1 items-center justify-center text-xs text-muted">Loading book…</div>;

  const ref = view.mid ?? 1;
  const dec = unit === "usd" ? 0 : szDecimals;
  const row = (l: { px: number; amt: number; total: number }, side: "bid" | "ask") => (
    <button
      key={`${side}${l.px}`}
      onClick={() => onPickPrice(l.px)}
      className="relative grid h-[19px] w-full shrink-0 grid-cols-3 items-center px-2 text-[11px] hover:bg-navy-800"
      title="Use this price for a limit order"
    >
      <span
        className={`absolute inset-y-0 right-0 ${side === "bid" ? "bg-long/12" : "bg-short/12"}`}
        style={{ width: `${(l.total / view.max) * 100}%` }}
      />
      <span className={`num relative text-left ${side === "bid" ? "text-long" : "text-short"}`}>{fmtPxAt(l.px, ref)}</span>
      <span className="num relative text-right text-mist">{fmtNum(l.amt, dec)}</span>
      <span className="num relative text-right text-muted">{fmtNum(l.total, dec)}</span>
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-muted">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">{view.asks.map((l) => row(l, "ask"))}</div>
      <div className="flex items-center justify-between border-y border-line bg-navy-950/40 px-2 py-1 font-mono text-[11px]">
        <span className="text-cream">{view.mid ? fmtPxAt(view.mid, ref) : "…"}</span>
        <span className="text-muted">
          Spread {view.spread != null ? `${fmtNum(view.spread, pxDecimals(ref))} (${((view.spread / ref) * 100).toFixed(3)}%)` : "…"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{view.bids.map((l) => row(l, "bid"))}</div>
    </div>
  );
}

function Tape({ coin, szDecimals }: { coin: string; szDecimals: number }) {
  const prints = useTrades(coin);
  const ref = prints[0]?.px ?? 1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-muted">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {prints.map((t) => (
          <div key={t.id + t.px + t.time} className="grid h-[19px] grid-cols-3 items-center px-2 text-[11px]">
            <span className={`num ${t.side === "buy" ? "text-long" : "text-short"}`}>{fmtPxAt(t.px, ref)}</span>
            <span className="num text-right text-mist">{fmtNum(t.sz, szDecimals)}</span>
            <span className="num text-right text-muted">{fmtTime(t.time, true)}</span>
          </div>
        ))}
        {!prints.length && <p className="p-4 text-center text-xs text-muted">Waiting for trades…</p>}
      </div>
    </div>
  );
}
