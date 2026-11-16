"use client";

import { useEffect, useState } from "react";
import { fmtNum, fmtPct, fmtPxAt, fmtUsd, pxDecimals } from "@/lib/format";
import type { OpenResult } from "@/lib/account";
import type { MarketCtx } from "@/lib/hyperliquid";
import { checkTpSl, liquidationPx, MAKER_FEE, STRATEGIES, TAKER_FEE, type Side, type Strategy } from "@/lib/sim";

export interface TicketOrder {
  side: Side;
  type: "market" | "limit";
  limitPx: number | null;
  sizeUsd: number;
  leverage: number;
  tpPx: number | null;
  slPx: number | null;
  strategy: Strategy;
  rationale: string;
}

interface Props {
  coin: string;
  mid: number | undefined;
  market: MarketCtx | undefined;
  freeMargin: number;
  guest: boolean;
  ready: boolean;
  /** A price picked from the order book (n changes on every pick). */
  pick: { px: number; n: number } | null;
  onSubmit: (o: TicketOrder) => Promise<OpenResult>;
}

const MAX_LEV = 20;
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function OrderTicket({ coin, mid, market, freeMargin, guest, ready, pick, onSubmit }: Props) {
  const [type, setType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<Side>("long");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("1000");
  const [unit, setUnit] = useState<"usd" | "coin">("usd");
  const [leverage, setLeverage] = useState(5);
  const [tpsl, setTpsl] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("Momentum");
  const [rationale, setRationale] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // New market: prices from the old one no longer make sense
  useEffect(() => {
    setPrice("");
    setTp("");
    setSl("");
    setResult(null);
  }, [coin]);

  useEffect(() => {
    if (!pick) return;
    setType(guest ? "market" : "limit");
    if (!guest) setPrice(String(pick.px));
  }, [pick, guest]);

  const maxLev = Math.min(market?.maxLeverage ?? MAX_LEV, MAX_LEV);
  const lev = Math.min(leverage, maxLev);
  const limitPx = type === "limit" ? num(price) : null;
  const ref = limitPx && limitPx > 0 ? limitPx : (mid ?? 0);
  const resting = type === "limit" && limitPx != null && mid != null && (side === "long" ? limitPx < mid : limitPx > mid);
  const feeRate = resting ? MAKER_FEE : TAKER_FEE;
  const sizeNum = num(size) ?? 0;
  const sizeUsd = unit === "usd" ? sizeNum : sizeNum * ref;
  const maxUsd = Math.max(0, freeMargin / (1 / lev + feeRate));
  const margin = sizeUsd / lev;
  const fee = sizeUsd * feeRate;
  const tpPx = tpsl ? num(tp) : null;
  const slPx = tpsl ? num(sl) : null;
  const liq = ref ? liquidationPx({ side, entryPx: ref, leverage: lev }) : 0;
  const dir = side === "long" ? 1 : -1;
  const roe = (px: number | null) => (px && ref ? (px / ref - 1) * dir * lev : null);
  const dec = pxDecimals(ref || 1);

  const error = !ready
    ? null
    : type === "limit" && !(limitPx && limitPx > 0)
      ? "Enter a limit price"
      : sizeUsd < 10
        ? "Minimum order is $10"
        : sizeUsd > maxUsd * 1.0001
          ? "Not enough free margin"
          : checkTpSl(side, ref, tpPx, slPx, type === "limit" ? "limit price" : "entry price");

  const setPct = (pct: number) => {
    const usd = Math.floor(maxUsd * pct);
    setSize(unit === "usd" ? String(usd) : ref ? fmtNum(usd / ref, market?.szDecimals ?? 4).replace(/,/g, "") : "0");
  };
  const pct = maxUsd > 0 ? Math.min(sizeUsd / maxUsd, 1) : 0;

  const switchUnit = () => {
    if (!ref) return;
    if (unit === "usd") {
      setUnit("coin");
      setSize(sizeNum ? (sizeNum / ref).toFixed(market?.szDecimals ?? 4) : "");
    } else {
      setUnit("usd");
      setSize(sizeNum ? String(Math.round(sizeNum * ref)) : "");
    }
  };

  const submit = async () => {
    if (error || !mid || sending) return;
    setSending(true);
    setResult(null);
    const res = await onSubmit({
      side,
      type,
      limitPx,
      sizeUsd,
      leverage: lev,
      tpPx,
      slPx,
      strategy,
      rationale: rationale.trim(),
    });
    setSending(false);
    if (!res.ok) setResult({ ok: false, text: res.error });
    else {
      setResult({
        ok: true,
        text: res.filled
          ? type === "limit"
            ? "Filled now: the price had already reached your limit"
            : "Order filled"
          : "Limit order placed. It fills when the price reaches it.",
      });
      setRationale("");
      setTp("");
      setSl("");
    }
  };

  const label = !ready
    ? "Loading market…"
    : sending
      ? "Sending…"
      : (error ?? `${type === "limit" && resting ? "Place limit " : ""}${side === "long" ? "Long" : "Short"} ${coin}`);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex border-b border-line" role="tablist">
        {(["market", "limit"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => (t === "limit" && guest ? setResult({ ok: false, text: "Sign in to place limit orders" }) : setType(t))}
            className="tab capitalize"
            title={t === "limit" && guest ? "Sign in to place limit orders" : undefined}
          >
            {t}
            {t === "limit" && guest && <span className="ml-1 text-[10px] text-muted">(sign in)</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-navy-950/60 p-1">
        {(["long", "short"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-md py-1.5 text-sm font-semibold capitalize transition ${
              side === s ? (s === "long" ? "bg-long text-navy-950" : "bg-short text-navy-950") : "text-muted hover:text-cream"
            }`}
          >
            {s === "long" ? "Buy / Long" : "Sell / Short"}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-[11px] text-muted">
            <span>Limit price (USD)</span>
            {mid && (
              <button type="button" onClick={() => setPrice(mid.toFixed(dec))} className="text-cyan hover:underline">
                Mid {fmtPxAt(mid, mid)}
              </button>
            )}
          </span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={mid ? mid.toFixed(dec) : "0.00"}
            className="field"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[11px] text-muted">
          <span>Size</span>
          <span className="num">Max {fmtUsd(maxUsd)}</span>
        </span>
        <div className="relative">
          <input
            inputMode="decimal"
            value={size}
            onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))}
            className="field pr-16"
          />
          <button
            type="button"
            onClick={switchUnit}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-mist hover:text-cream"
            title="Enter size in USD or in coin"
          >
            {unit === "usd" ? "USD" : coin}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(pct * 100)}
            onChange={(e) => setPct(Number(e.target.value) / 100)}
            className="flex-1 accent-[var(--cyan)]"
            aria-label="Size as a share of buying power"
          />
          <span className="num w-9 text-right text-[11px] text-muted">{Math.round(pct * 100)}%</span>
        </div>
        <span className="num text-[11px] text-muted">
          ≈ {ref ? fmtNum(sizeUsd / ref, market?.szDecimals ?? 4) : "…"} {coin} · {fmtUsd(sizeUsd)}
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[11px] text-muted">
          <span>Leverage</span>
          <span className="num text-cream">{lev}x</span>
        </span>
        <input
          type="range"
          min={1}
          max={maxLev}
          value={lev}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="accent-[var(--cyan)]"
        />
        <div className="flex gap-1">
          {[1, 3, 5, 10, 20].filter((x) => x <= maxLev).map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setLeverage(x)}
              className={`flex-1 rounded-md border py-0.5 font-mono text-[11px] ${
                lev === x ? "border-cyan/60 text-cream" : "border-line text-muted hover:text-cream"
              }`}
            >
              {x}x
            </button>
          ))}
        </div>
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-mist">
          <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} className="accent-[var(--cyan)]" />
          Take profit / stop loss
        </label>
        {tpsl && (
          <div className="grid grid-cols-2 gap-2">
            <PriceField label="Take profit" value={tp} onChange={setTp} placeholder={ref ? (ref * (1 + 0.02 * dir)).toFixed(dec) : ""} roe={roe(tpPx)} />
            <PriceField label="Stop loss" value={sl} onChange={setSl} placeholder={ref ? (ref * (1 - 0.01 * dir)).toFixed(dec) : ""} roe={roe(slPx)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Strategy: teaches the agent your intent</span>
        <div className="flex flex-wrap gap-1">
          {STRATEGIES.map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                strategy === s ? "border-cyan bg-cyan/15 text-cream" : "border-line text-muted hover:text-cream"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">Why this trade? (optional)</span>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="e.g. Reclaimed the hourly high on rising volume"
          className="field resize-none font-sans"
        />
      </label>

      <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
        <dt className="text-muted">{type === "limit" ? "Entry (limit)" : "Est. entry"}</dt>
        <dd className="num text-right">{ref ? fmtPxAt(ref, ref) : "…"}</dd>
        <dt className="text-muted">Est. liquidation</dt>
        <dd className="num text-right text-[rgb(255,180,80)]">{ref ? fmtPxAt(liq, ref) : "…"}</dd>
        <dt className="text-muted">Margin</dt>
        <dd className="num text-right">{fmtUsd(margin)}</dd>
        <dt className="text-muted">Fee ({resting ? "maker" : "taker"})</dt>
        <dd className="num text-right">{fmtUsd(fee)}</dd>
      </dl>

      <button
        onClick={submit}
        disabled={!!error || !mid || !ready || sending}
        className={`rounded-lg py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "long" ? "bg-long text-navy-950" : "bg-short text-navy-950"
        }`}
      >
        {label}
      </button>
      {result && <p className={`text-xs ${result.ok ? "text-long" : "text-short"}`}>{result.text}</p>}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  placeholder,
  roe,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  roe: number | null;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        {roe != null && Number.isFinite(roe) && <span className={`num ${roe >= 0 ? "text-long" : "text-short"}`}>{fmtPct(roe, 1)}</span>}
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        className="field"
      />
    </label>
  );
}
