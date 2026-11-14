"use client";

import { useState } from "react";
import { fmtPct, fmtPx, fmtUsd, tone } from "@/lib/format";
import { liquidationPx, margin, unrealized, type ClosedTrade, type Position } from "@/lib/sim";

interface Props {
  positions: Position[];
  history: ClosedTrade[];
  prices: Record<string, number>;
  onClose: (p: Position) => void;
}

const th = "px-3 py-2 text-left font-normal text-muted";
const td = "px-3 py-2 font-mono whitespace-nowrap";

function SideTag({ side, coin }: { side: string; coin: string }) {
  return (
    <span className="font-sans font-semibold">
      <span className={side === "long" ? "text-long" : "text-short"}>{side === "long" ? "▲" : "▼"}</span> {coin}
    </span>
  );
}

export function Blotter({ positions, history, prices, onClose }: Props) {
  const [tab, setTab] = useState<"positions" | "history">("positions");

  return (
    <div className="panel flex min-h-0 flex-col">
      <div className="flex gap-1 border-b border-line px-2 pt-2">
        {(
          [
            ["positions", `Positions (${positions.length})`],
            ["history", `Trade log (${history.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === k ? "border-cyan text-cream" : "border-transparent text-muted hover:text-cream"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-xs">
        {tab === "positions" ? (
          positions.length === 0 ? (
            <Empty>No open positions. Place a trade to start teaching.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {["Market", "Size", "Entry", "Mark", "Liq.", "Margin", "PnL", "Strategy", ""].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const px = prices[p.coin];
                  const pnl = px ? unrealized(p, px) : 0;
                  return (
                    <tr key={p.id} className="border-t border-line/60">
                      <td className={td}>
                        <SideTag side={p.side} coin={p.coin} /> <span className="text-muted">{p.leverage}x</span>
                      </td>
                      <td className={td}>{fmtUsd(p.sizeUsd)}</td>
                      <td className={td}>{fmtPx(p.entryPx)}</td>
                      <td className={td}>{px ? fmtPx(px) : "—"}</td>
                      <td className={`${td} text-amber-300/80`}>{fmtPx(liquidationPx(p))}</td>
                      <td className={td}>{fmtUsd(margin(p))}</td>
                      <td className={`${td} ${tone(pnl)}`}>
                        {fmtUsd(pnl, true)} <span className="opacity-70">({fmtPct(pnl / margin(p), 1)})</span>
                      </td>
                      <td className="px-3 py-2 text-muted">{p.strategy}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => onClose(p)}
                          disabled={!px}
                          className="rounded-md border border-line px-2.5 py-1 font-semibold hover:border-cyan/60 disabled:opacity-40"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : history.length === 0 ? (
          <Empty>Closed trades appear here — each one is a training example.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Market", "Size", "Entry → Exit", "PnL", "Strategy", "Rationale", "Closed"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id} className="border-t border-line/60">
                  <td className={td}>
                    <SideTag side={t.side} coin={t.coin} /> <span className="text-muted">{t.leverage}x</span>
                  </td>
                  <td className={td}>{fmtUsd(t.sizeUsd)}</td>
                  <td className={td}>
                    {fmtPx(t.entryPx)} → {fmtPx(t.exitPx)}
                  </td>
                  <td className={`${td} ${tone(t.pnl)}`}>
                    {fmtUsd(t.pnl, true)}
                    {t.liquidated && <span className="ml-1 rounded bg-short/20 px-1 text-short">LIQ</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{t.strategy}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-muted" title={t.rationale}>
                    {t.rationale || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {new Date(t.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-24 items-center justify-center p-6 text-sm text-muted">{children}</div>;
}
