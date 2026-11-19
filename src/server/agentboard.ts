import { evaluateAccount, evaluateRow, toAgentTrade, type AgentTrade } from "./evaluation";
import { DATASET_REPO } from "./dataset";
import { db, hasDb } from "./db";
import type { TrackStats } from "@/lib/stats";
import type { Check } from "@/lib/readiness";

/**
 * The Agentboard: autonomous agents ranked on their own simulated accounts. Only agents
 * whose owners chose to share in the open dataset are listed, the same consent, so the
 * board never shows anything the dataset wouldn't. Every number is recomputed from the
 * closed trades on the verified ledger.
 */

/** Closed trades an agent needs before it is ranked. Below this it is "warming up". */
export const MIN_RANKED_TRADES = 10;

const CACHE_MS = 60_000;

export interface BoardRow {
  agent: string;
  github: string | null;
  status: "trading" | "paused";
  trades: number;
  returnPct: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  maxDrawdown: number;
  passed: number;
  total: number;
  openPositions: number;
  startedAt: number;
  lastTradeAt: number | null;
}

export interface Board {
  updatedAt: number;
  minTrades: number;
  ranked: (BoardRow & { rank: number })[];
  warmingUp: BoardRow[];
}

export interface AgentProfile {
  agent: string;
  github: string | null;
  status: "trading" | "paused";
  rank: number | null;
  minTrades: number;
  startedAt: number;
  lastRunAt: number | null;
  startingBalance: number;
  openPositions: number;
  stats: TrackStats;
  readiness: { checks: Check[]; passed: number; total: number; ready: boolean; day: number };
  equity: { t: number; v: number }[];
  ledger: { entries: number; head: string | null };
  open: AgentTrade[];
  trades: AgentTrade[];
  dataset: string;
  updatedAt: number;
}

const ms = (d: Date | null) => (d ? d.getTime() : 0);

/** Agents with a live autonomous account whose owners share in the open dataset. */
const SHARED_AGENTS = (sql: ReturnType<typeof db>, name?: string) => sql`
  select u.agent_id, u.login, u.show_login, s.id as account_id, s.created_at, s.archived_at,
         s.starting_balance, coalesce(a.paused, false) as paused, a.last_run_at
  from users u
  join sim_accounts s on s.user_id = u.id and s.kind = 'agent' and s.archived_at is null
  left join agents a on a.user_id = u.id
  where u.publish_data and u.publish_decided_at is not null
  ${name ? sql`and u.agent_id = ${name}` : sql``}`;

let boardCache: { at: number; board: Board } | null = null;

export async function board(): Promise<Board> {
  if (boardCache && Date.now() - boardCache.at < CACHE_MS) return boardCache.board;
  const empty: Board = { updatedAt: Date.now(), minTrades: MIN_RANKED_TRADES, ranked: [], warmingUp: [] };
  if (!hasDb()) return empty;
  const sql = db();
  const agents = await SHARED_AGENTS(sql);
  if (!agents.length) return (boardCache = { at: Date.now(), board: empty }).board;
  const ids = agents.map((a) => a.account_id as string);
  const [closed, open] = await Promise.all([
    sql`select account_id, pnl, opened_at, closed_at from positions
        where account_id = any(${ids}) and closed_at is not null order by closed_at`,
    sql`select account_id, count(*)::int as n from positions
        where account_id = any(${ids}) and closed_at is null group by account_id`,
  ]);
  const byAccount = new Map<string, { pnl: number; opened_at: Date; closed_at: Date }[]>();
  for (const t of closed) {
    const list = byAccount.get(t.account_id) ?? [];
    list.push({ pnl: t.pnl, opened_at: t.opened_at, closed_at: t.closed_at });
    byAccount.set(t.account_id, list);
  }
  const openBy = new Map(open.map((o) => [o.account_id as string, o.n as number]));

  const rows: BoardRow[] = agents.map((a) => {
    const { stats, readiness } = evaluateAccount(a as never, byAccount.get(a.account_id) ?? []);
    return {
      agent: a.agent_id,
      github: a.show_login ? a.login : null,
      status: a.paused ? "paused" : "trading",
      trades: stats.trades,
      returnPct: stats.returnPct,
      netPnl: stats.netPnl,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      maxDrawdown: stats.maxDrawdown,
      passed: readiness.passed,
      total: readiness.total,
      openPositions: openBy.get(a.account_id) ?? 0,
      startedAt: ms(a.created_at),
      lastTradeAt: stats.lastTradeAt,
    };
  });

  const ranked = rows
    .filter((r) => r.trades >= MIN_RANKED_TRADES)
    // Ties go to the agent with more trades, then the older one
    .sort((x, y) => y.returnPct - x.returnPct || y.trades - x.trades || x.startedAt - y.startedAt)
    .map((r, k) => ({ ...r, rank: k + 1 }));
  const warmingUp = rows
    .filter((r) => r.trades < MIN_RANKED_TRADES)
    .sort((x, y) => y.trades - x.trades || x.startedAt - y.startedAt);

  const result: Board = { updatedAt: Date.now(), minTrades: MIN_RANKED_TRADES, ranked, warmingUp };
  boardCache = { at: Date.now(), board: result };
  return result;
}

/** Names look like KIN007; anything else can't be an agent. */
export const isAgentName = (s: string) => /^KIN\d{3,}$/.test(s);

/** One shared agent's record, or null if there is no such agent or it isn't shared. */
export async function agentProfile(name: string): Promise<AgentProfile | null> {
  if (!isAgentName(name) || !hasDb()) return null;
  const sql = db();
  const [a] = await SHARED_AGENTS(sql, name);
  if (!a) return null;
  const [acct] = await sql`select * from sim_accounts where id = ${a.account_id}`;
  const [evaluated, open, closed, b] = await Promise.all([
    evaluateRow(acct),
    sql`select * from positions where account_id = ${a.account_id} and closed_at is null order by opened_at desc`,
    sql`select * from positions where account_id = ${a.account_id} and closed_at is not null order by closed_at desc limit 25`,
    board(),
  ]);
  return {
    agent: a.agent_id,
    github: a.show_login ? a.login : null,
    status: a.paused ? "paused" : "trading",
    rank: b.ranked.find((r) => r.agent === a.agent_id)?.rank ?? null,
    minTrades: MIN_RANKED_TRADES,
    startedAt: ms(a.created_at),
    lastRunAt: a.last_run_at ? ms(a.last_run_at) : null,
    startingBalance: evaluated.startingBalance,
    openPositions: evaluated.openPositions,
    stats: evaluated.stats,
    readiness: evaluated.readiness,
    equity: evaluated.equity,
    ledger: evaluated.ledger,
    open: open.map(toAgentTrade),
    trades: closed.map(toAgentTrade),
    dataset: `https://github.com/${DATASET_REPO}/tree/main/agents/${a.agent_id}`,
    updatedAt: Date.now(),
  };
}
