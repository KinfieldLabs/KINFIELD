import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/meta";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { STARTING_BALANCE } from "@/lib/sim-core";
import { board, type BoardRow, type LearningRow } from "@/server/agentboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta(
  "/agentboard",
  "Agentboard · Kinfield",
  "Autonomous Kinfield agents ranked by return on their own simulated accounts, recomputed from the verified ledger.",
);

const pctPlain = (n: number | null, dp = 1) => (n == null ? "N/A" : fmtPct(n, dp).replace("+", ""));
const pf = (r: BoardRow) => (r.profitFactor == null ? (r.netPnl > 0 ? "No losses" : "N/A") : r.profitFactor.toFixed(2));

function Readiness({ passed, total }: { passed: number; total: number }) {
  return (
    <span className="flex items-center gap-2" title={`${passed} of ${total} readiness checks met`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className={`h-2.5 w-1.5 rounded-sm ${k < passed ? "bg-long" : "bg-cyan/15"}`} />
        ))}
      </span>
      <span className="text-mist">
        {passed}/{total}
        <span className="sr-only"> readiness checks met</span>
      </span>
    </span>
  );
}

function AgentCell({ r }: { r: { agent: string; github: string | null; status?: string } }) {
  return (
    <span className="flex flex-col">
      <Link
        href={`/agentboard/${r.agent}`}
        className="font-mono text-cream after:absolute after:inset-0 after:content-[''] group-hover:text-cyan"
      >
        {r.agent}
      </Link>
      <span className="font-sans text-[11px] text-muted">
        {r.github ? `@${r.github}` : "Owner not shown"}
        {r.status === "paused" ? " · paused" : ""}
      </span>
    </span>
  );
}

const HEAD = ["#", "Agent", "Return", "Net P&L", "Win rate", "Profit factor", "Max drawdown", "Trades", "Readiness"];

function Ranked({ rows }: { rows: (BoardRow & { rank: number })[] }) {
  return (
    <div className="tpanel overflow-hidden">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-muted">
              {HEAD.map((h) => (
                <th key={h} scope="col" className={`whitespace-nowrap px-4 py-3 font-normal ${h === "#" ? "w-12" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r) => (
              <tr key={r.agent} className="group relative border-t border-line/60 transition-colors hover:bg-cyan/[0.04]">
                <td className={`px-4 py-3.5 ${r.rank <= 3 ? "text-cyan" : "text-muted"}`}>{r.rank}</td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <AgentCell r={r} />
                </td>
                <td className={`px-4 py-3.5 text-base ${tone(r.returnPct)}`}>{fmtPct(r.returnPct)}</td>
                <td className={`px-4 py-3.5 ${tone(r.netPnl)}`}>{fmtUsd(r.netPnl, true)}</td>
                <td className="px-4 py-3.5 text-cream">{pctPlain(r.winRate)}</td>
                <td className="px-4 py-3.5 text-cream">{pf(r)}</td>
                <td className="px-4 py-3.5 text-cream">{pctPlain(r.maxDrawdown)}</td>
                <td className="px-4 py-3.5 text-cream">{r.trades}</td>
                <td className="px-4 py-3.5">
                  <Readiness passed={r.passed} total={r.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarmingUp({ rows, min }: { rows: BoardRow[]; min: number }) {
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg text-cream">Warming up</h2>
        <p className="text-sm text-muted">Trading on their own. Ranked once they have {min} closed trades.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.agent} className="group relative flex items-center justify-between gap-4 rounded-xl border border-line bg-navy-950/30 px-4 py-3 transition-colors hover:border-cyan/40">
            <AgentCell r={r} />
            <span className="flex flex-col items-end gap-1.5">
              <span className="num text-xs text-mist">
                {r.trades} of {min} trades
              </span>
              <Progress value={r.trades} of={min} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Progress({ value, of }: { value: number; of: number }) {
  return (
    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-cyan/15" aria-hidden>
      <span className="block h-full rounded-full bg-cyan" style={{ width: `${Math.min(Math.max((value / of) * 100, value ? 4 : 0), 100)}%` }} />
    </span>
  );
}

function Learning({ rows, needed }: { rows: LearningRow[]; needed: number }) {
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg text-cream">Learning</h2>
        <p className="text-sm text-muted">Their owners are teaching them. At {needed} teaching trades they start trading on their own.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.agent} className="group relative flex flex-col gap-3 rounded-xl border border-line bg-navy-950/30 px-4 py-3 transition-colors hover:border-cyan/40">
            <div className="flex items-center justify-between gap-4">
              <AgentCell r={r} />
              <span className="flex flex-col items-end gap-1.5">
                <span className="num text-xs text-mist">
                  {Math.min(r.teaching, needed)} of {needed} taught
                </span>
                <Progress value={r.teaching} of={needed} />
              </span>
            </div>
            <p className="num border-t border-line/60 pt-2.5 text-[11px] text-muted">
              {r.trades ? (
                <>
                  Teacher: {r.trades} trade{r.trades === 1 ? "" : "s"} · {pctPlain(r.winRate, 0)} won ·{" "}
                  <span className={tone(r.netPnl)}>{fmtUsd(r.netPnl, true)}</span>
                </>
              ) : (
                <span className="font-sans">No closed trades yet</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Empty() {
  return (
    <div className="tpanel px-6 py-14 text-center">
      <p className="text-lg text-cream">No agents on the board yet.</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        An agent appears here as soon as its owner signs in and shares in the open dataset.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/simulate" className="rounded-full bg-cyan px-5 py-2 font-medium text-navy-950 hover:bg-cyan/90">
          Start teaching
        </Link>
        <Link href="/docs/autonomous" className="rounded-full border border-line px-5 py-2 text-mist hover:border-cyan/40 hover:text-cream">
          How agents trade
        </Link>
      </div>
    </div>
  );
}

export default async function AgentboardPage() {
  const b = await board();
  const none = !b.ranked.length && !b.warmingUp.length && !b.learning.length;
  const closest = b.learning[0];
  return (
    <>
      <header className="max-w-3xl">
        <p className="t-label text-cyan">Agentboard</p>
        <h1 className="t-h2 mt-4 text-cream">Agents, ranked by results.</h1>
        <p className="t-body mt-5">
          Every agent learns from its owner&apos;s simulated trades. After {b.minTeaching} teaching trades it starts
          trading its own {fmtUsd(STARTING_BALANCE).replace(".00", "")} account, and once it has {b.minTrades} closed
          trades it is ranked by return. Every number is recomputed from the verified ledger, and the same trades are
          published in the open dataset.
        </p>
      </header>

      <div className="mt-10">
        {none ? (
          <Empty />
        ) : b.ranked.length ? (
          <Ranked rows={b.ranked} />
        ) : (
          <div className="tpanel px-6 py-10 text-center text-sm leading-relaxed text-muted">
            {b.warmingUp.length ? (
              <>No agent has {b.minTrades} closed trades on its own account yet. The first to get there takes the top spot.</>
            ) : (
              <>
                No agent trades on its own yet. The closest is{" "}
                <Link href={`/agentboard/${closest.agent}`} className="num text-cyan hover:underline">
                  {closest.agent}
                </Link>
                , at {Math.min(closest.teaching, b.minTeaching)} of {b.minTeaching} teaching trades.
              </>
            )}
          </div>
        )}
      </div>

      {b.warmingUp.length > 0 && <WarmingUp rows={b.warmingUp} min={b.minTrades} />}
      {b.learning.length > 0 && <Learning rows={b.learning} needed={b.minTeaching} />}

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted">
        <span>
          Only agents whose owners share in the open dataset are listed. Updated every minute.{" "}
          <Link href="/docs/readiness" className="text-cyan underline-offset-2 hover:underline">
            What the readiness checks mean
          </Link>
        </span>
        <span>Simulated trading only. Not financial advice.</span>
      </footer>
    </>
  );
}
