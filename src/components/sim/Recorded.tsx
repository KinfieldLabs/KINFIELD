"use client";

import { fmtPxAt, fmtUsd, tone } from "@/lib/format";
import type { ClosedTrade } from "@/lib/sim";

const REASONS: Record<string, string> = {
  manual: "Closed by you",
  take_profit: "Take profit",
  stop_loss: "Stop loss",
  liquidation: "Liquidated",
  time_stop: "Time limit",
};

/**
 * What a trade left behind once it closed: the trade itself, the intent you gave it,
 * whether the market conditions were captured, and how many trades your agent now
 * learns from.
 */
export function Recorded({
  trade,
  examples,
  signedIn,
  onAgent,
  onClose,
}: {
  trade: ClosedTrade;
  examples: number;
  signedIn: boolean;
  onAgent: () => void;
  onClose: () => void;
}) {
  const rows: [string, string, string?][] = [
    ["Entry to exit", `${fmtPxAt(trade.entryPx, trade.entryPx)} to ${fmtPxAt(trade.exitPx, trade.entryPx)}`],
    ["Result", `${fmtUsd(trade.pnl, true)} · ${REASONS[trade.exitReason ?? "manual"] ?? "Closed"}`, tone(trade.pnl)],
    ["Strategy", trade.strategy],
    ["Reason", trade.rationale.trim() ? "Saved, and private unless you share reasons" : "None given"],
    ["Market at entry", trade.entryFeatures ? "Captured for your agent" : "Not captured"],
  ];
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 w-[min(92vw,340px)] rounded-2xl border border-line bg-navy-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-cyan">What was recorded</p>
          <p className="mt-1 text-sm text-cream">
            {trade.coin} {trade.side} {trade.leverage}x, {signedIn ? "on your verified record" : "saved in this browser"}
          </p>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="-mr-1 rounded p-1 text-muted hover:text-cream">
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[104px_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className={cls ?? "text-mist"}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-muted">
          Your agent learns from <span className="text-cream">{examples}</span> trade{examples === 1 ? "" : "s"}
        </span>
        <button onClick={onAgent} className="rounded-full border border-cyan/50 px-3 py-1 text-xs text-cyan hover:bg-cyan/10">
          See what it learned
        </button>
      </div>
    </div>
  );
}
