"use client";

import { useState } from "react";
import { fmtPx, fmtUsd } from "@/lib/format";
import { STRATEGIES, TAKER_FEE, type Side, type Strategy } from "@/lib/sim";

interface Props {
  coin: string;
  price: number | undefined;
  freeMargin: number;
  maxLeverage: number;
  ready: boolean;
  onSubmit: (o: { side: Side; sizeUsd: number; leverage: number; strategy: Strategy; rationale: string }) => void;
}

export function OrderTicket({ coin, price, freeMargin, maxLeverage, ready, onSubmit }: Props) {
  const [side, setSide] = useState<Side>("long");
  const [size, setSize] = useState("1000");
  const [leverage, setLeverage] = useState(5);
  const [strategy, setStrategy] = useState<Strategy>("Momentum");
  const [rationale, setRationale] = useState("");

  const sizeUsd = Number(size) || 0;
  const lev = Math.min(leverage, maxLeverage);
  const required = sizeUsd / lev;
  const fee = sizeUsd * TAKER_FEE;
  const error =
    sizeUsd < 10 ? "Minimum order is $10" : required + fee > freeMargin ? "Not enough free margin" : null;

  const submit = () => {
    if (error || !price) return;
    onSubmit({ side, sizeUsd, leverage: lev, strategy, rationale: rationale.trim() });
    setRationale("");
  };

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-navy-950/60 p-1">
        {(["long", "short"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-full py-2 text-sm font-semibold capitalize transition ${
              side === s
                ? s === "long"
                  ? "bg-long text-navy-950"
                  : "bg-short text-navy-950"
                : "text-muted hover:text-cream"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs text-muted">
          <span>Size (USD)</span>
          <span>Free: {fmtUsd(freeMargin)}</span>
        </span>
        <input
          inputMode="decimal"
          value={size}
          onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))}
          className="rounded-full border border-line bg-navy-950/60 px-3 py-2 font-mono text-sm outline-none focus:border-cyan/60"
        />
        <div className="grid grid-cols-4 gap-1">
          {[0.1, 0.25, 0.5, 1].map((f) => (
            <button
              key={f}
              onClick={() => setSize(String(Math.floor(freeMargin * lev * f * 0.995)))}
              className="rounded-full border border-line py-1 text-xs text-muted hover:border-cyan/50 hover:text-cream"
            >
              {f * 100}%
            </button>
          ))}
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs text-muted">
          <span>Leverage</span>
          <span className="font-mono text-cream">{lev}x</span>
        </span>
        <input
          type="range"
          min={1}
          max={maxLeverage}
          value={lev}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="accent-[var(--cyan)]"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Strategy — teaches the agent your intent</span>
        <div className="flex flex-wrap gap-1">
          {STRATEGIES.map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                strategy === s ? "border-cyan bg-cyan/15 text-cream" : "border-line text-muted hover:text-cream"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Rationale (optional)</span>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="e.g. Reclaimed the hourly high on rising volume"
          className="resize-none rounded-2xl border border-line bg-navy-950/60 px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-cyan/60"
        />
      </label>

      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="text-muted">Est. entry</dt>
        <dd className="text-right font-mono">{price ? fmtPx(price) : "—"}</dd>
        <dt className="text-muted">Margin required</dt>
        <dd className="text-right font-mono">{fmtUsd(required)}</dd>
        <dt className="text-muted">Fee</dt>
        <dd className="text-right font-mono">{fmtUsd(fee)}</dd>
      </dl>

      <button
        onClick={submit}
        disabled={!!error || !price || !ready}
        className={`rounded-full py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "long" ? "bg-long text-navy-950" : "bg-short text-navy-950"
        }`}
      >
        {!ready ? "Loading market…" : error ?? `${side === "long" ? "Long" : "Short"} ${coin}`}
      </button>
    </div>
  );
}
