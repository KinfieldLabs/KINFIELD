"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtCompact, fmtPct, fmtPxAt, tone } from "@/lib/format";
import type { AssetCtx } from "@/lib/hl-socket";
import { FEATURED, type MarketCtx } from "@/lib/hyperliquid";

interface Props {
  coin: string;
  markets: Record<string, MarketCtx>;
  live: AssetCtx | null;
  price: number | undefined;
  status: "connecting" | "live" | "down";
  onPick: (coin: string) => void;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Ticks green or red for a moment when the price moves. */
function usePriceFlash(px: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  useEffect(() => {
    if (px && prev.current && px !== prev.current)
      setFlash((f) => ({ dir: px > prev.current! ? "up" : "down", n: (f?.n ?? 0) + 1 }));
    prev.current = px;
  }, [px]);
  return flash;
}

export function MarketBar({ coin, markets, live, price, status, onPick }: Props) {
  const m = markets[coin];
  const now = useNow(1000);
  const flash = usePriceFlash(price);

  const mark = live?.mark ?? m?.mark;
  const oracle = live?.oracle ?? m?.oracle;
  const prevDay = live?.prevDay ?? m?.prevDay;
  const change = price && prevDay ? price / prevDay - 1 : undefined;
  const volume = live?.dayVolume ?? m?.volume24h;
  const oi = live && mark ? live.openInterest * mark : m?.openInterest;
  const funding = live?.funding ?? m?.funding;
  const nextFunding = 3_600_000 - (now % 3_600_000);
  const mm = String(Math.floor(nextFunding / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((nextFunding % 60_000) / 1000)).padStart(2, "0");
  const ref = price ?? mark ?? 1;

  return (
    <div className="flex items-center gap-4 border-b border-line px-3 py-2">
      <MarketPicker coin={coin} markets={markets} onPick={onPick} />
      <div className="flex min-w-0 flex-1 items-center gap-x-6 overflow-x-auto scroll-thin">
      <div className="flex shrink-0 flex-col leading-tight">
        <span
          key={flash?.n}
          className={`num rounded px-1 text-xl ${flash ? (flash.dir === "up" ? "flash-up text-long" : "flash-down text-short") : ""}`}
        >
          {price ? fmtPxAt(price, ref) : "…"}
        </span>
      </div>

      <Stat label="Mark" value={mark ? fmtPxAt(mark, ref) : "…"} />
      <Stat label="Oracle" value={oracle ? fmtPxAt(oracle, ref) : "…"} />
      <Stat
        label="24h change"
        value={change != null && prevDay ? `${fmtPxAt(price! - prevDay, ref)} / ${fmtPct(change)}` : "…"}
        className={change != null ? tone(change) : ""}
      />
      <Stat label="24h volume" value={volume != null ? fmtCompact(volume) : "…"} />
      <Stat label="Open interest" value={oi != null ? fmtCompact(oi) : "…"} />
      <Stat
        label="Funding / countdown"
        value={funding != null ? `${fmtPct(funding, 4)}  ${mm}:${ss}` : "…"}
        className={funding != null ? tone(funding) : ""}
      />

      <span
        className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted"
        title="Live market data from Hyperliquid"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "live" ? "bg-long shadow-[0_0_8px_var(--long)]" : status === "connecting" ? "bg-cyan" : "bg-short"
          }`}
        />
        {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Reconnecting"}
      </span>
      </div>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex shrink-0 flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-[0.06em] text-muted">{label}</span>
      <span className={`num whitespace-pre text-xs ${className}`}>{value}</span>
    </div>
  );
}

function MarketPicker({
  coin,
  markets,
  onPick,
}: {
  coin: string;
  markets: Record<string, MarketCtx>;
  onPick: (coin: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const list = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const featured = new Set<string>(FEATURED);
    return Object.values(markets)
      .filter((m) => !needle || m.coin.toUpperCase().includes(needle))
      .sort((a, b) =>
        needle ? b.volume24h - a.volume24h : Number(featured.has(b.coin)) - Number(featured.has(a.coin)) || b.volume24h - a.volume24h,
      );
  }, [markets, q]);

  const pick = (c: string) => {
    onPick(c);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 hover:border-cyan/50"
      >
        <span className="text-base font-semibold tracking-[-0.01em]">{coin}-USD</span>
        {markets[coin] && (
          <span className="rounded bg-cyan/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan">
            {Math.min(markets[coin].maxLeverage, 20)}x
          </span>
        )}
        <svg viewBox="0 0 12 12" className={`h-3 w-3 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[560px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-line bg-navy-900 shadow-2xl shadow-black/50">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && list[0] && pick(list[0].coin)}
              placeholder="Search markets"
              className="field"
            />
          </div>
          <div className="grid grid-cols-[1fr_100px_80px_90px] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.06em] text-muted">
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="text-right">Volume</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto scroll-thin">
            {list.map((m) => (
              <button
                key={m.coin}
                onClick={() => pick(m.coin)}
                className={`grid w-full grid-cols-[1fr_100px_80px_90px] items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-navy-800 ${
                  m.coin === coin ? "bg-navy-850" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{m.coin}</span>
                  <span className="font-mono text-[10px] text-muted">{Math.min(m.maxLeverage, 20)}x</span>
                </span>
                <span className="num text-right">{fmtPxAt(m.mid, m.mid)}</span>
                <span className={`num text-right ${tone(m.change24h)}`}>{fmtPct(m.change24h)}</span>
                <span className="num text-right text-mist">{fmtCompact(m.volume24h)}</span>
              </button>
            ))}
            {!list.length && <p className="p-4 text-center text-xs text-muted">No market matches “{q}”</p>}
          </div>
        </div>
      )}
    </div>
  );
}
