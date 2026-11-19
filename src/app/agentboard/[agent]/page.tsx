import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentTrades, CheckCard, Stats } from "@/components/agent/AgentDashboard";
import { EquityChart } from "@/components/agent/EquityChart";
import { pageMeta } from "@/lib/meta";
import { fmtDateTime, fmtDuration, fmtPct, fmtUsd, tone } from "@/lib/format";
import { agentProfile, isAgentName, type AgentProfile, type LearningProfile } from "@/server/agentboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ agent: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = (await params).agent.toUpperCase();
  if (!isAgentName(name)) return { title: "Agent not found · Kinfield" };
  return pageMeta(
    `/agentboard/${name}`,
    `${name} · Agentboard · Kinfield`,
    `${name}'s record on Kinfield: return, readiness checks, equity and every trade it made on its own simulated account.`,
  );
}

function Owner({ p }: { p: AgentProfile }) {
  return p.github ? (
    <>
      Taught by{" "}
      <a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer" className="text-cyan underline-offset-2 hover:underline">
        @{p.github}
      </a>
    </>
  ) : (
    <>Owner not shown</>
  );
}

function Learning({ p }: { p: LearningProfile }) {
  const done = Math.min(p.teaching, p.needed);
  const left = p.needed - done;
  const t = p.teacher;
  const tiles: [string, string, string?][] = [
    ["Closed trades", String(t.trades)],
    ["Win rate", t.winRate == null ? "N/A" : fmtPct(t.winRate, 1).replace("+", "")],
    ["Net P&L", fmtUsd(t.netPnl, true), tone(t.netPnl)],
    ["Profit factor", t.profitFactor == null ? (t.grossProfit > 0 ? "No losses" : "N/A") : t.profitFactor.toFixed(2)],
    ["Average hold", t.avgHoldMs == null ? "N/A" : fmtDuration(t.avgHoldMs)],
    ["Last trade", t.lastTradeAt ? fmtDateTime(t.lastTradeAt) : "None yet"],
  ];
  return (
    <div className="flex flex-col gap-6">
      <Link href="/agentboard" className="w-fit text-sm text-muted hover:text-cyan">
        ← All agents
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-label text-cyan">Agentboard</p>
          <h1 className="num mt-3 text-4xl text-cream sm:text-5xl">{p.agent}</h1>
          <p className="mt-3 text-sm text-mist">
            <Owner p={p} /> · joined {fmtDateTime(p.joinedAt)}
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1.5 text-sm text-mist">Learning</span>
      </section>

      <section className="tpanel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Teaching progress</h2>
          <span className="text-sm text-mist">
            <span className="num text-cream">{done}</span> of {p.needed} teaching trades
          </span>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-cyan/15"
          role="meter"
          aria-label="Teaching trades"
          aria-valuemin={0}
          aria-valuemax={p.needed}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.max((done / p.needed) * 100, done ? 3 : 0)}%` }} />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-mist">
          {left > 0 ? (
            <>
              {left} more closed trade{left === 1 ? "" : "s"} to go. Then {p.agent} starts trading its own simulated
              account every 15 minutes, and its record, rank and readiness checks show up here.
            </>
          ) : (
            <>Ready. {p.agent} opens its own simulated account on its next scheduled run, within 15 minutes.</>
          )}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          A teaching trade is one of its owner&apos;s closed trades with market context recorded at entry.{" "}
          {p.model
            ? `Its model was last trained on ${p.model.samples} of them, ${fmtDateTime(p.model.trainedAt)}.`
            : "It hasn't been trained yet."}{" "}
          <Link href="/docs/agent" className="text-cyan underline-offset-2 hover:underline">
            How the agent learns
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Its teacher&apos;s record</h2>
        <p className="mt-1 text-xs text-muted">Every simulated trade its owner has closed, the record it learns from.</p>
        <div className="tpanel mt-3 grid grid-cols-2 gap-px overflow-hidden bg-line/40 p-0 sm:grid-cols-3">
          {tiles.map(([label, value, cls]) => (
            <div key={label} className="flex flex-col gap-0.5 bg-navy-900/95 px-4 py-3">
              <span className="text-[11px] text-muted">{label}</span>
              <span className={`num text-sm ${cls || "text-cream"}`}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tpanel p-4 text-sm">
        <h2 className="font-semibold">Check it yourself</h2>
        <p className="mt-2 leading-relaxed text-mist">
          Its owner&apos;s trades are published nightly to the open dataset, with the hash-chained ledger that proves them.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <a href={p.dataset} target="_blank" rel="noreferrer" className="text-cyan underline-offset-2 hover:underline">
            {p.agent} in the open dataset
          </a>
          <Link href="/docs/verify" className="text-cyan underline-offset-2 hover:underline">
            How to verify a ledger
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted">Simulated trading only. Not financial advice. Updated every minute.</p>
    </div>
  );
}

export default async function AgentPage({ params }: Props) {
  const p = await agentProfile((await params).agent.toUpperCase());
  if (!p) notFound();
  if (p.stage === "learning") return <Learning p={p} />;
  const started = p.stats.trades > 0;
  const r = p.readiness;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/agentboard" className="w-fit text-sm text-muted hover:text-cyan">
        ← All agents
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-label text-cyan">Agentboard</p>
          <h1 className="num mt-3 text-4xl text-cream sm:text-5xl">{p.agent}</h1>
          <p className="mt-3 text-sm text-mist">
            <Owner p={p} />
            {" · "}trading on its own since {fmtDateTime(p.startedAt)}
            {p.status === "paused" ? " · paused by its owner" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`num text-2xl ${tone(p.stats.returnPct)}`}>{fmtPct(p.stats.returnPct)}</span>
          {p.rank ? (
            <span className="rounded-full border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-sm text-cyan">Rank #{p.rank}</span>
          ) : (
            <span className="rounded-full border border-line px-3 py-1.5 text-sm text-muted">
              Warming up · {p.stats.trades} of {p.minTrades} trades
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="tpanel flex h-[340px] flex-col overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">Closed-trade equity</h2>
            <span className="text-[11px] text-muted">Dashed line: starting balance</span>
          </div>
          {started ? (
            <EquityChart points={p.equity} startingBalance={p.startingBalance} until={p.updatedAt} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
              No closed trades yet. The curve starts with the first one.
            </div>
          )}
        </div>
        <Stats s={p.stats} open={p.openPositions} />
      </section>

      <section className="tpanel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Readiness checks</h2>
          <span className="text-sm text-mist">
            <span className="num text-cream">{r.passed}</span> of {r.total} met · day {r.day}
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
            The checks a track record has to pass before an agent could be considered for real capital.{" "}
            <Link href="/docs/readiness" className="text-cyan underline-offset-2 hover:underline">
              How each is computed
            </Link>
          </div>
        </div>
      </section>

      <AgentTrades title="Open positions" rows={p.open} empty="No open positions right now." />
      <AgentTrades title="Recent closed trades" rows={p.trades} empty="No closed trades yet." />

      <section className="tpanel p-4 text-sm">
        <h2 className="font-semibold">Check it yourself</h2>
        <p className="mt-2 leading-relaxed text-mist">
          Every fill on this account is an entry in a hash-chained ledger, {p.ledger.entries} so far. The trades are
          published nightly to the open dataset, where anyone can recompute these numbers and verify the chain.
        </p>
        {p.ledger.head && (
          <p className="mt-3 break-all text-xs text-muted">
            Latest ledger hash: <span className="num text-mist">{p.ledger.head}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <a href={p.dataset} target="_blank" rel="noreferrer" className="text-cyan underline-offset-2 hover:underline">
            {p.agent} in the open dataset
          </a>
          <Link href="/docs/verify" className="text-cyan underline-offset-2 hover:underline">
            How to verify a ledger
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted">Simulated trading only. Not financial advice. Updated every minute.</p>
    </div>
  );
}
