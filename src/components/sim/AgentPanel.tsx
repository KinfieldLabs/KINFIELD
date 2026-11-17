"use client";

import { useMemo } from "react";
import { MIN_SAMPLES, predict, trainAgent } from "@/lib/agent";
import { FEATURE_KEYS, FEATURE_LABELS, type MarketFeatures } from "@/lib/features";
import { Mark } from "@/components/Logo";
import { toJsonl, type ClosedTrade } from "@/lib/sim";

interface Props {
  coin: string;
  history: ClosedTrade[];
  features: MarketFeatures | null;
  /** The signed-in user's agent, e.g. KIN001; guests just have "your agent". */
  agentName?: string;
  /** Inside another panel: no frame, no export button. */
  bare?: boolean;
}

export function AgentPanel({ coin, history, features, agentName, bare = false }: Props) {
  const model = useMemo(() => trainAgent(history), [history]);
  const pLong = model && features ? predict(model, features) : null;
  const labeled = history.filter((t) => t.entryFeatures).length;

  const exportData = () => {
    const blob = new Blob([toJsonl(history)], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinfield-trades-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxW = model ? Math.max(...model.weights.map(Math.abs), 1e-6) : 1;

  return (
    <div className={bare ? "flex max-w-2xl flex-col gap-4 p-4" : "panel flex flex-col gap-4 p-4"}>
      <div className="flex items-center gap-2">
        <Mark className="h-4 w-4 text-cyan" />
        <h3 className="text-sm font-semibold">{agentName ? `Agent ${agentName}` : "Your agent"}</h3>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
          {labeled} example{labeled === 1 ? "" : "s"}
        </span>
      </div>

      {!model ? (
        <div className="text-sm font-light leading-relaxed text-mist">
          Close {Math.max(MIN_SAMPLES - labeled, 1)} more trade{MIN_SAMPLES - labeled === 1 ? "" : "s"} to train your
          agent. It learns which direction paid off in the market conditions you chose to trade.
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy-950">
            <div className="h-full bg-cyan transition-all" style={{ width: `${(labeled / MIN_SAMPLES) * 100}%` }} />
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-baseline justify-between text-xs text-muted">
              <span>Agent view on {coin} now</span>
              <span>In-sample accuracy {(model.accuracy * 100).toFixed(0)}%</span>
            </div>
            {pLong === null ? (
              <p className="mt-2 text-sm text-muted">Waiting for market context…</p>
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-3xl tracking-[-0.03em] ${pLong >= 0.5 ? "text-long" : "text-short"}`}>
                    {pLong >= 0.55 ? "Lean long" : pLong <= 0.45 ? "Lean short" : "No edge"}
                  </span>
                  <span className="font-mono text-sm text-muted">{(pLong * 100).toFixed(0)}% long</span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-short/70 via-navy-700 to-long/70">
                  <div
                    className="absolute -top-1 h-4 w-1 rounded bg-cream shadow"
                    style={{ left: `calc(${pLong * 100}% - 2px)` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">What it has learned from you</span>
            {FEATURE_KEYS.map((k, j) => {
              const w = model.weights[j];
              return (
                <div key={k} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
                  <span className="text-muted">{FEATURE_LABELS[k]}</span>
                  <div className="relative h-1.5 rounded bg-navy-950">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                    <div
                      className={`absolute top-0 h-full rounded ${w >= 0 ? "bg-long" : "bg-short"}`}
                      style={{
                        left: w >= 0 ? "50%" : `${50 - (Math.abs(w) / maxW) * 50}%`,
                        width: `${(Math.abs(w) / maxW) * 50}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="mt-1 text-[11px] text-muted/80">Green pushes toward long, red toward short.</p>
          </div>
        </>
      )}

      <Milestones labeled={labeled} closed={history.length} signedIn={!!agentName} />

      {!bare && (
      <button
        onClick={exportData}
        disabled={!history.length}
        className="rounded-full border border-line py-2 text-xs font-semibold text-cream transition hover:border-cyan/60 disabled:opacity-40"
      >
        Export training data (.jsonl)
      </button>
      )}
    </div>
  );
}

/** The autonomous agent's starting point, matching the server's minTeaching. */
const AUTONOMOUS_AFTER = 30;
/** The trade count readiness checks look for, matching READINESS.minTrades. */
const CHECKS_AFTER = 100;

/**
 * What each trade count opens up, so the 3, 30 and 100 seen around the site read as
 * steps rather than conflicting numbers. None of them is a promise of results.
 */
function Milestones({ labeled, closed, signedIn }: { labeled: number; closed: number; signedIn: boolean }) {
  const steps = [
    { n: MIN_SAMPLES, at: labeled, title: "Your agent starts reading the market", note: "It learns from your closed trades in this browser or account." },
    {
      n: AUTONOMOUS_AFTER,
      at: labeled,
      title: "It trades its own simulated account",
      note: signedIn ? "Every 15 minutes, on the same tamper-evident ledger as you." : "Needs sign in, so its trades go on a ledger.",
    },
    {
      n: CHECKS_AFTER,
      at: closed,
      title: "Track-record checks count",
      note: "The checks on the agent page measure a record. They aren't a promise of profit, funding or real-money trading.",
    },
  ];
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <span className="text-xs text-muted">Milestones</span>
      {steps.map((s) => {
        const done = s.at >= s.n;
        return (
          <div key={s.n} className="grid grid-cols-[52px_1fr] gap-2 text-xs">
            <span className={`num ${done ? "text-long" : "text-muted"}`}>
              {done ? "Done" : `${Math.min(s.at, s.n)}/${s.n}`}
            </span>
            <div>
              <span className={done ? "text-cream" : "text-mist"}>
                {s.n} trades: {s.title}
              </span>
              <p className="mt-0.5 text-[11px] leading-snug text-muted/90">{s.note}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
