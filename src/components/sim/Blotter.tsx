"use client";

import { useState, type ReactNode } from "react";
import type { MarketFeatures } from "@/lib/features";
import { fmtDateTime, fmtDuration, fmtNum, fmtPct, fmtPxAt, fmtUsd, tone } from "@/lib/format";
import type { MarketCtx } from "@/lib/hyperliquid";
import {
  liquidationPx,
  margin,
  qty,
  toJsonl,
  unrealized,
  type ClosedTrade,
  type ExitReason,
  type Order,
  type Position,
} from "@/lib/sim";
import { AgentPanel } from "./AgentPanel";

interface Props {
  coin: string;
  positions: Position[];
  orders: Order[];
  history: ClosedTrade[];
  prices: Record<string, number>;
  markets: Record<string, MarketCtx>;
  features: MarketFeatures | null;
  guest: boolean;
  onSelectCoin: (coin: string) => void;
  onClose: (p: Position) => Promise<void>;
  onCancel: (o: Order) => Promise<void>;
  onSetTpSl: (p: Position, tp: number | null, sl: number | null) => Promise<string | null>;
}

type Tab = "positions" | "orders" | "history" | "agent";

const th = "px-3 py-1.5 text-left font-normal text-muted whitespace-nowrap";
const td = "px-3 py-1.5 whitespace-nowrap";

const REASONS: Record<ExitReason, { label: string; cls: string }> = {
  manual: { label: "Closed", cls: "text-mist border-line" },
  take_profit: { label: "Take profit", cls: "text-long border-long/40" },
  stop_loss: { label: "Stop loss", cls: "text-short border-short/40" },
  liquidation: { label: "Liquidated", cls: "text-[rgb(255,180,80)] border-[rgba(255,180,80,0.4)]" },
  time_stop: { label: "Time limit", cls: "text-mist border-line" },
};

export function Blotter(props: Props) {
  const { positions, orders, history } = props;
  const [tab, setTab] = useState<Tab>("positions");

  const exportData = () => {
    const blob = new Blob([toJsonl(history)], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinfield-trades-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: [Tab, string][] = [
    ["positions", `Positions (${positions.length})`],
    ["orders", `Open orders (${orders.length})`],
    ["history", `Trade history (${history.length})`],
    ["agent", "Apprentice"],
  ];

  return (
    <div className="tpanel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center overflow-x-auto border-b border-line px-1 scroll-thin" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="tab">
            {label}
          </button>
        ))}
        {tab === "history" && (
          <button
            onClick={exportData}
            disabled={!history.length}
            className="ml-auto shrink-0 px-3 text-xs text-cyan hover:underline disabled:opacity-40"
          >
            Export .jsonl
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        {tab === "positions" && <Positions {...props} />}
        {tab === "orders" && <Orders {...props} />}
        {tab === "history" && <History {...props} />}
        {tab === "agent" && <AgentPanel coin={props.coin} history={history} features={props.features} bare />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-24 items-center justify-center p-6 text-sm text-muted">{children}</div>;
}

function Market({ p, onSelectCoin }: { p: { coin: string; side: string; leverage: number }; onSelectCoin: (c: string) => void }) {
  return (
    <button onClick={() => onSelectCoin(p.coin)} className="flex items-center gap-1.5 font-semibold hover:text-cyan">
      <span className={`h-3 w-0.5 rounded ${p.side === "long" ? "bg-long" : "bg-short"}`} />
      {p.coin}
      <span className={`font-mono text-[10px] font-normal ${p.side === "long" ? "text-long" : "text-short"}`}>
        {p.side === "long" ? "LONG" : "SHORT"} {p.leverage}x
      </span>
    </button>
  );
}

function Positions({ positions, prices, markets, onSelectCoin, onClose, onSetTpSl }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  if (!positions.length) return <Empty>No open positions. Place a trade to start teaching.</Empty>;
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-navy-900">
        <tr>
          {["Market", "Size", "Value", "Entry", "Mark", "Liq. price", "Margin", "PnL (ROE)", "TP / SL", ""].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {positions.map((p) => {
          const px = prices[p.coin];
          const pnl = px ? unrealized(p, px) : 0;
          const dec = markets[p.coin]?.szDecimals ?? 4;
          return (
            <tr key={p.id} className="border-t border-line/60 align-middle">
              <td className={`${td} font-sans`}>
                <Market p={p} onSelectCoin={onSelectCoin} />
              </td>
              <td className={td}>
                {fmtNum(qty(p), dec)} {p.coin}
              </td>
              <td className={td}>{fmtUsd(px ? qty(p) * px : p.sizeUsd)}</td>
              <td className={td}>{fmtPxAt(p.entryPx, p.entryPx)}</td>
              <td className={td}>{px ? fmtPxAt(px, p.entryPx) : "…"}</td>
              <td className={`${td} text-[rgb(255,180,80)]`}>{fmtPxAt(liquidationPx(p), p.entryPx)}</td>
              <td className={td}>{fmtUsd(margin(p))}</td>
              <td className={`${td} ${tone(pnl)}`}>
                {fmtUsd(pnl, true)} <span className="text-[10px]">({fmtPct(pnl / margin(p))})</span>
              </td>
              <td className={td}>
                {editing === p.id ? (
                  <TpSlEditor
                    p={p}
                    onCancel={() => setEditing(null)}
                    onSave={async (tp, sl) => {
                      const err = await onSetTpSl(p, tp, sl);
                      if (!err) setEditing(null);
                      return err;
                    }}
                  />
                ) : (
                  <button onClick={() => setEditing(p.id)} className="group flex items-center gap-1.5 hover:text-cyan" title="Edit take profit and stop loss">
                    <span className={p.tpPx ? "text-long" : "text-muted"}>{p.tpPx ? fmtPxAt(p.tpPx, p.entryPx) : "TP"}</span>
                    <span className="text-muted">/</span>
                    <span className={p.slPx ? "text-short" : "text-muted"}>{p.slPx ? fmtPxAt(p.slPx, p.entryPx) : "SL"}</span>
                    <svg viewBox="0 0 12 12" className="h-3 w-3 text-muted group-hover:text-cyan" aria-hidden>
                      <path d="M8.5 1.5l2 2L4 10H2V8z" stroke="currentColor" fill="none" strokeWidth="1.2" />
                    </svg>
                  </button>
                )}
              </td>
              <td className={`${td} text-right`}>
                <button
                  onClick={async () => {
                    setClosing(p.id);
                    await onClose(p);
                    setClosing(null);
                  }}
                  disabled={!px || closing === p.id}
                  className="rounded-md border border-line px-2.5 py-1 font-sans text-xs hover:border-cyan/60 hover:text-cyan disabled:opacity-40"
                >
                  {closing === p.id ? "Closing…" : "Market close"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TpSlEditor({
  p,
  onSave,
  onCancel,
}: {
  p: Position;
  onSave: (tp: number | null, sl: number | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [tp, setTp] = useState(p.tpPx ? String(p.tpPx) : "");
  const [sl, setSl] = useState(p.slPx ? String(p.slPx) : "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const val = (s: string) => (s.trim() ? Number(s) : null);
  const save = async () => {
    setSaving(true);
    setErr(await onSave(val(tp), val(sl)));
    setSaving(false);
  };
  return (
    <div className="flex flex-col gap-1 font-sans">
      <div className="flex items-center gap-1">
        <input value={tp} onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="TP" className="field w-24 px-2 py-1 text-xs" />
        <input value={sl} onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="SL" className="field w-24 px-2 py-1 text-xs" />
        <button onClick={save} disabled={saving} className="rounded-md bg-cyan px-2 py-1 text-xs font-semibold text-navy-950 disabled:opacity-50">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={onCancel} className="px-1 text-xs text-muted hover:text-cream">
          Cancel
        </button>
      </div>
      {err && <span className="text-[11px] text-short">{err}</span>}
    </div>
  );
}

function Orders({ orders, prices, guest, onSelectCoin, onCancel }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  if (!orders.length)
    return <Empty>{guest ? "Sign in to place limit orders." : "No open orders. Limit orders wait here until the price reaches them."}</Empty>;
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-navy-900">
        <tr>
          {["Placed", "Market", "Limit price", "Size", "Distance", "TP / SL", ""].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {orders.map((o) => {
          const px = prices[o.coin];
          return (
            <tr key={o.id} className="border-t border-line/60">
              <td className={`${td} text-muted`}>{fmtDateTime(o.placedAt)}</td>
              <td className={`${td} font-sans`}>
                <Market p={o} onSelectCoin={onSelectCoin} />
              </td>
              <td className={td}>{fmtPxAt(o.limitPx, o.limitPx)}</td>
              <td className={td}>{fmtUsd(o.sizeUsd)}</td>
              <td className={`${td} text-muted`}>{px ? fmtPct(o.limitPx / px - 1) : "…"}</td>
              <td className={td}>
                <span className={o.tpPx ? "text-long" : "text-muted"}>{o.tpPx ? fmtPxAt(o.tpPx, o.limitPx) : "None"}</span>
                <span className="text-muted"> / </span>
                <span className={o.slPx ? "text-short" : "text-muted"}>{o.slPx ? fmtPxAt(o.slPx, o.limitPx) : "None"}</span>
              </td>
              <td className={`${td} text-right`}>
                <button
                  onClick={async () => {
                    setCancelling(o.id);
                    await onCancel(o);
                    setCancelling(null);
                  }}
                  disabled={cancelling === o.id}
                  className="rounded-md border border-line px-2.5 py-1 font-sans text-xs hover:border-short/60 hover:text-short disabled:opacity-40"
                >
                  {cancelling === o.id ? "Cancelling…" : "Cancel"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function History({ history, markets, onSelectCoin }: Props) {
  if (!history.length) return <Empty>Closed trades appear here, with why each one ended.</Empty>;
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-navy-900">
        <tr>
          {["Closed", "Market", "Size", "Entry", "Exit", "PnL", "Ended by", "Held", "Strategy", "Reason"].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {history.map((t) => {
          const r = REASONS[t.exitReason ?? (t.liquidated ? "liquidation" : "manual")];
          return (
            <tr key={t.id} className="border-t border-line/60">
              <td className={`${td} text-muted`}>{fmtDateTime(t.closedAt)}</td>
              <td className={`${td} font-sans`}>
                <Market p={t} onSelectCoin={onSelectCoin} />
              </td>
              <td className={td}>
                {fmtNum(qty(t), markets[t.coin]?.szDecimals ?? 4)} {t.coin}
              </td>
              <td className={td}>{fmtPxAt(t.entryPx, t.entryPx)}</td>
              <td className={td}>{fmtPxAt(t.exitPx, t.entryPx)}</td>
              <td className={`${td} ${tone(t.pnl)}`}>{fmtUsd(t.pnl, true)}</td>
              <td className={`${td} font-sans`}>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${r.cls}`}>{r.label}</span>
              </td>
              <td className={`${td} text-muted`}>{fmtDuration(t.closedAt - t.openedAt)}</td>
              <td className={`${td} font-sans text-mist`}>{t.strategy}</td>
              <td className={`${td} max-w-[260px] truncate font-sans text-muted`} title={t.rationale}>
                {t.rationale || "No reason given"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
