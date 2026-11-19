import type postgres from "postgres";
import { readiness, type Readiness } from "@/lib/readiness";
import { trackStats, type TrackStats } from "@/lib/stats";
import type { User } from "./auth";
import { DATASET_REPO } from "./dataset";
import { db } from "./db";
import { AGENT } from "./autonomous";
import { getState, sweep } from "./ledger";

export interface AccountEvaluation {
  accountId: string;
  status: "active" | "archived";
  createdAt: number;
  archivedAt: number | null;
  startingBalance: number;
  openPositions: number;
  stats: TrackStats;
  readiness: Readiness;
  /** Realized equity after each closed trade, starting from the opening balance. */
  equity: { t: number; v: number }[];
  ledger: { entries: number; head: string | null };
}

export interface AgentTrade {
  id: string;
  coin: string;
  side: "long" | "short";
  confidence: number | null; // in the side it took, 0..1
  entryPx: number;
  exitPx: number | null;
  slPx: number | null;
  tpPx: number | null;
  sizeUsd: number;
  pnl: number | null;
  exitReason: string | null;
  openedAt: number;
  closedAt: number | null;
}

export interface AutonomousTrial {
  teaching: number;
  needed: number;
  paused: boolean;
  status: "learning" | "trading" | "paused";
  model: { samples: number; accuracy: number; trainedAt: number } | null;
  startedAt: number | null;
  lastRunAt: number | null;
  lastNote: string | null;
  rules: { confidence: number; riskPerTrade: number; rewardToRisk: number; maxHoldHours: number; markets: number };
  account: AccountEvaluation | null;
  open: AgentTrade[];
  trades: AgentTrade[];
}

export interface Evaluation {
  agentId: string;
  publishing: boolean;
  datasetRepo: string;
  accounts: AccountEvaluation[];
  autonomous: AutonomousTrial;
}

const ms = (d: Date | null) => (d ? d.getTime() : 0);

/** Readiness for one account. Archived accounts are judged as they stood when archived. */
export function evaluateAccount(
  a: { created_at: Date; archived_at: Date | null; starting_balance: number },
  closed: { pnl: number; opened_at: Date; closed_at: Date }[],
) {
  const trades = closed.map((t) => ({ pnl: t.pnl, openedAt: ms(t.opened_at), closedAt: ms(t.closed_at) }));
  const stats = trackStats(trades, a.starting_balance);
  const until = a.archived_at ? ms(a.archived_at) : Date.now();
  return { stats, readiness: readiness(stats, ms(a.created_at), until), trades };
}

/** Every simulated account this user has had, newest first, each judged on its own record. */
export async function evaluation(user: User): Promise<Evaluation> {
  await getState(user.id); // makes sure the active account exists and its triggers are settled
  const sql = db();
  const accounts = await sql`select * from sim_accounts where user_id = ${user.id} and kind = 'human' order by created_at desc`;
  const out: AccountEvaluation[] = [];
  for (const a of accounts) out.push(await evaluateRow(a));
  return {
    agentId: user.agentId,
    publishing: user.sharingDecided && user.publishData,
    datasetRepo: DATASET_REPO,
    accounts: out,
    autonomous: await autonomousTrial(user.id),
  };
}

export const toAgentTrade = (r: postgres.Row): AgentTrade => ({
  id: r.id,
  coin: r.coin,
  side: r.side,
  confidence: r.agent_p == null ? null : r.side === "long" ? r.agent_p : 1 - r.agent_p,
  entryPx: r.entry_px,
  exitPx: r.exit_px,
  slPx: r.sl_px,
  tpPx: r.tp_px,
  sizeUsd: r.size_usd,
  pnl: r.pnl,
  exitReason: r.exit_reason,
  openedAt: ms(r.opened_at),
  closedAt: r.closed_at ? ms(r.closed_at) : null,
});

/** How the apprentice is doing trading on its own account. */
async function autonomousTrial(userId: string): Promise<AutonomousTrial> {
  const sql = db();
  const [[t], [agent], [acct]] = await Promise.all([
    sql`select count(*)::int as n from positions p join sim_accounts s on s.id = p.account_id
        where s.user_id = ${userId} and s.kind = 'human' and p.closed_at is not null
          and p.entry_features is not null and p.exit_px <> p.entry_px`,
    sql`select * from agents where user_id = ${userId}`,
    sql`select * from sim_accounts where user_id = ${userId} and kind = 'agent' and archived_at is null`,
  ]);
  if (acct) await sweep(acct.id);
  const [open, closed] = acct
    ? await Promise.all([
        sql`select * from positions where account_id = ${acct.id} and closed_at is null order by opened_at desc`,
        sql`select * from positions where account_id = ${acct.id} and closed_at is not null order by closed_at desc limit 50`,
      ])
    : [[], []];
  const model = agent?.model as { samples: number; accuracy: number } | null;
  return {
    teaching: t.n,
    needed: AGENT.minTeaching,
    paused: !!agent?.paused,
    status: agent?.paused ? "paused" : t.n >= AGENT.minTeaching ? "trading" : "learning",
    model: model && agent.trained_at ? { samples: model.samples, accuracy: model.accuracy, trainedAt: ms(agent.trained_at) } : null,
    startedAt: agent?.started_at ? ms(agent.started_at) : null,
    lastRunAt: agent?.last_run_at ? ms(agent.last_run_at) : null,
    lastNote: agent?.last_note ?? null,
    rules: {
      confidence: AGENT.confidence,
      riskPerTrade: AGENT.riskPerTrade,
      rewardToRisk: AGENT.rewardToRisk,
      maxHoldHours: AGENT.maxHoldMs / 3_600_000,
      markets: AGENT.markets,
    },
    account: acct ? await evaluateRow(acct) : null,
    open: open.map(toAgentTrade),
    trades: closed.map(toAgentTrade),
  };
}

export async function evaluateRow(a: postgres.Row): Promise<AccountEvaluation> {
  const sql = db();
  const [closed, [open], [chain]] = await Promise.all([
    sql`select pnl, opened_at, closed_at from positions
        where account_id = ${a.id} and closed_at is not null order by closed_at`,
    sql`select count(*)::int as n from positions where account_id = ${a.id} and closed_at is null`,
    sql`select count(*)::int as n, (select hash from ledger where account_id = ${a.id} order by seq desc limit 1) as head
        from ledger where account_id = ${a.id}`,
  ]);
  const { stats, readiness: r, trades } = evaluateAccount(
    { created_at: a.created_at, archived_at: a.archived_at, starting_balance: a.starting_balance },
    closed.map((t) => ({ pnl: t.pnl, opened_at: t.opened_at, closed_at: t.closed_at })),
  );
  let v = a.starting_balance;
  const equity = [{ t: ms(a.created_at), v }, ...trades.map((t) => ({ t: t.closedAt, v: (v += t.pnl) }))];
  return {
    accountId: a.id,
    status: a.archived_at ? "archived" : "active",
    createdAt: ms(a.created_at),
    archivedAt: a.archived_at ? ms(a.archived_at) : null,
    startingBalance: a.starting_balance,
    openPositions: open.n,
    stats,
    readiness: r,
    equity,
    ledger: { entries: chain.n, head: chain.head },
  };
}
