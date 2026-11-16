"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AccountChip } from "@/components/sim/AccountChip";
import { SharingSettings } from "@/components/sim/DataSharing";
import { useMe } from "@/lib/account";
import { fmtDateTime, fmtDuration, fmtPct, fmtUsd, tone } from "@/lib/format";
import { READINESS, type Check } from "@/lib/readiness";
import type { TrackStats } from "@/lib/stats";
import { EquityChart } from "./EquityChart";

interface AccountEvaluation {
  accountId: string;
  status: "active" | "archived";
  createdAt: number;
  archivedAt: number | null;
  startingBalance: number;
  openPositions: number;
  stats: TrackStats;
  readiness: { checks: Check[]; passed: number; total: number; ready: boolean; day: number };
  equity: { t: number; v: number }[];
  ledger: { entries: number; head: string | null };
}

interface Evaluation {
  agentId: string;
  publishing: boolean;
  datasetRepo: string;
  accounts: AccountEvaluation[];
}

export function AgentDashboard() {
  const { me, signOut, saveSharing } = useMe();
  const [sharingOpen, setSharingOpen] = useState(false);
  const [data, setData] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/evaluation", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't load your agent");
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me?.user) load();
  }, [me?.user, load]);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2.5">
        <Logo />
        <nav className="flex items-center gap-1 whitespace-nowrap text-sm">
          <Link href="/simulate" className="rounded-md px-2.5 py-1 text-muted hover:text-cream">
            Terminal
          </Link>
          <span className="rounded-md bg-navy-800 px-2.5 py-1 text-cream">Your agent</span>
        </nav>
        <div className="ml-auto">
          <AccountChip me={me} onSignOut={signOut} onSharing={() => setSharingOpen(true)} />
        </div>
      </header>
      {sharingOpen && me?.user && (
        <SharingSettings
          sharing={me.user.sharing}
          login={me.user.login}
          onSave={async (c) => {
            const err = await saveSharing(c);
            if (!err) load();
            return err;
          }}
          onClose={() => setSharingOpen(false)}
        />
      )}

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        {!me ? (
          <p className="py-20 text-center text-sm text-muted">Loading…</p>
        ) : !me.user ? (
          <SignedOut available={me.signIn.available} />
        ) : error ? (
          <p className="rounded-xl border border-short/30 bg-short/10 p-4 text-sm text-short">{error}</p>
        ) : !data ? (
          <p className="py-20 text-center text-sm text-muted">Reading your verified record…</p>
        ) : (
          <Report data={data} />
        )}
      </main>
    </div>
  );
}

function SignedOut({ available }: { available: boolean }) {
  return (
    <div className="tpanel mx-auto mt-10 max-w-xl p-8 text-center">
      <h1 className="text-2xl tracking-[-0.02em]">Your agent&apos;s track record</h1>
      <p className="mt-3 text-sm leading-relaxed text-mist">
        Every signed-in trade goes on a verified ledger. This page judges that record against the checks an agent
        would need to pass before it could be trusted with real capital.
      </p>
      <p className="mt-4 text-sm text-muted">
        {available ? "Sign in from the top right to see yours." : "Accounts are not set up on this server yet."}
      </p>
      <Link href="/simulate" className="mt-6 inline-block text-sm text-cyan underline-offset-2 hover:underline">
        Open the terminal
      </Link>
    </div>
  );
}

function Report({ data }: { data: Evaluation }) {
  const active = data.accounts.find((a) => a.status === "active") ?? data.accounts[0];
  if (!active) return null;
  const r = active.readiness;
  const started = active.stats.trades > 0;

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted">Your agent</p>
          <h1 className="num mt-1 text-2xl text-cream">{data.agentId}</h1>
          <p className="mt-1 text-sm text-mist">
            Judged on the verified ledger of your current account, opened {fmtDateTime(active.createdAt)}.
          </p>
        </div>
        <StatusPill ready={r.ready} started={started} day={r.day} />
      </section>

      <section className="tpanel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Readiness checks</h2>
          <span className="text-sm text-mist">
            <span className="num text-cream">{r.passed}</span> of {r.total} met
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {r.checks.map((c) => (
            <span key={c.id} className={`h-2 flex-1 rounded-full ${c.pass ? "bg-long" : "bg-cyan/15"}`} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.checks.map((c) => (
            <CheckCard key={c.id} c={c} />
          ))}
          <div className="rounded-xl border border-dashed border-line p-3 text-xs leading-relaxed text-muted">
            Real-capital funding isn&apos;t open. When it is, agents that meet every check will be reviewed one at a
            time, and will also have to trade on their own for a month before any money is involved.
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="tpanel flex h-[340px] flex-col overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">Closed-trade equity</h2>
            <span className="text-[11px] text-muted">Dashed line: starting balance</span>
          </div>
          {started ? (
            <EquityChart points={active.equity} startingBalance={active.startingBalance} until={active.archivedAt ?? Date.now()} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
              Close your first trade and your equity curve starts here.
            </div>
          )}
        </div>
        <Stats s={active.stats} open={active.openPositions} />
      </section>

      <Attempts accounts={data.accounts} />

      <section className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          {data.publishing ? (
            <>
              Published nightly to{" "}
              <a href={`https://github.com/${data.datasetRepo}/tree/main/agents/${data.agentId}`} target="_blank" rel="noreferrer" className="text-cyan underline-offset-2 hover:underline">
                {data.datasetRepo}
              </a>
              , where anyone can recompute these numbers.
            </>
          ) : (
            "Not shared in the open dataset. You can turn sharing on from the top right."
          )}
        </span>
        <span>Simulated trading only. Not financial advice.</span>
      </section>
    </>
  );
}

function StatusPill({ ready, started, day }: { ready: boolean; started: boolean; day: number }) {
  if (ready)
    return (
      <span className="flex items-center gap-2 rounded-full border border-long/50 bg-long/10 px-3 py-1.5 text-sm text-long">
        <Icon kind="pass" /> Meets every check
      </span>
    );
  if (!started)
    return (
      <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted">
        <Icon kind="todo" /> Not started: no closed trades yet
      </span>
    );
  return (
    <span className="flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-sm text-cyan">
      <Icon kind="todo" /> In evaluation · day {day}
      {day <= READINESS.minDays ? ` of ${READINESS.minDays}` : ""}
    </span>
  );
}

function Icon({ kind }: { kind: "pass" | "todo" | "over" }) {
  if (kind === "pass")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "over")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckCard({ c }: { c: Check }) {
  const over = c.kind === "limit" && c.progress >= 1;
  const state = c.pass ? "pass" : over ? "over" : "todo";
  const label = c.pass ? "Met" : over ? "Over the limit" : "Not yet";
  const stateCls = c.pass ? "text-long" : over ? "text-short" : "text-muted";
  // Goals fill toward the target; limits show how much of the ceiling is used
  const fill = Math.min(c.progress, 1) * 100;
  const fillCls =
    c.kind === "reach"
      ? c.pass
        ? "bg-long"
        : "bg-cyan"
      : over
        ? "bg-short"
        : c.progress >= 0.7
          ? "bg-[rgb(255,180,80)]"
          : "bg-cyan";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-navy-950/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-mist">{c.label}</span>
        <span className={`flex items-center gap-1 text-[11px] ${stateCls}`}>
          <Icon kind={state} />
          {label}
        </span>
      </div>
      <div className="num text-lg leading-tight text-cream">{c.value}</div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-cyan/15"
        role="meter"
        aria-label={`${c.label}: ${c.value}, needs ${c.target}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
      >
        <div className={`h-full rounded-full ${fillCls}`} style={{ width: `${Math.max(fill, c.progress > 0 ? 3 : 0)}%` }} />
      </div>
      <div className="text-[11px] text-muted">
        Needs {c.target}
        {c.kind === "limit" ? " (bar: share of the limit used)" : ""}
      </div>
      <p className="text-[11px] leading-relaxed text-muted/90">{c.note}</p>
    </div>
  );
}

function Stats({ s, open }: { s: TrackStats; open: number }) {
  const tiles: [string, string, string?][] = [
    ["Net P&L", fmtUsd(s.netPnl, true), tone(s.netPnl)],
    ["Return", fmtPct(s.returnPct), tone(s.returnPct)],
    ["Closed trades", String(s.trades)],
    ["Win rate", s.winRate == null ? "N/A" : fmtPct(s.winRate, 1).replace("+", "")],
    ["Profit factor", s.profitFactor == null ? (s.grossProfit > 0 ? "No losses" : "N/A") : s.profitFactor.toFixed(2)],
    ["Expectancy", s.expectancy == null ? "N/A" : `${fmtUsd(s.expectancy, true)} / trade`, s.expectancy == null ? "" : tone(s.expectancy)],
    ["Max drawdown", fmtPct(s.maxDrawdown).replace("+", "")],
    ["Average hold", s.avgHoldMs == null ? "N/A" : fmtDuration(s.avgHoldMs)],
    ["Open positions", String(open)],
  ];
  return (
    <div className="tpanel grid grid-cols-2 content-start gap-px overflow-hidden bg-line/40 p-0">
      {tiles.map(([label, value, cls]) => (
        <div key={label} className="flex flex-col gap-0.5 bg-navy-900/95 px-4 py-3">
          <span className="text-[11px] text-muted">{label}</span>
          <span className={`num text-sm ${cls || "text-cream"}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function Attempts({ accounts }: { accounts: AccountEvaluation[] }) {
  return (
    <section className="tpanel overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Every account</h2>
        <span className="text-[11px] text-muted">
          Starting a new account archives the old one. Every attempt stays on your record and in the dataset.
        </span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              {["Account", "Status", "Opened", "Ended", "Trades", "Return", "Max drawdown", "Checks met", "Ledger"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {accounts.map((a) => (
              <tr key={a.accountId} className="border-t border-line/60">
                <td className="px-4 py-2 text-mist">{a.accountId.slice(0, 8)}</td>
                <td className="px-4 py-2 font-sans">
                  {a.status === "active" ? <span className="text-cyan">Current</span> : <span className="text-muted">Archived</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDateTime(a.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{a.archivedAt ? fmtDateTime(a.archivedAt) : "Still open"}</td>
                <td className="px-4 py-2">{a.stats.trades}</td>
                <td className={`px-4 py-2 ${tone(a.stats.returnPct)}`}>{fmtPct(a.stats.returnPct)}</td>
                <td className="px-4 py-2">{fmtPct(a.stats.maxDrawdown).replace("+", "")}</td>
                <td className="px-4 py-2">
                  {a.readiness.passed} of {a.readiness.total}
                </td>
                <td className="px-4 py-2 text-muted" title={a.ledger.head ?? undefined}>
                  {a.ledger.entries} entries
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
