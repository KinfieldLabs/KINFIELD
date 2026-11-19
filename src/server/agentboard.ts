import { evaluateAccount, evaluateRow, toAgentTrade, type AgentTrade } from "./evaluation";
import { AGENT } from "./autonomous";
import { DATASET_REPO } from "./dataset";
import { db, hasDb } from "./db";
import { STARTING_BALANCE } from "@/lib/sim-core";
import { trackStats, type TrackStats } from "@/lib/stats";
import type { Check } from "@/lib/readiness";

/**
 * The Agentboard: every agent whose owner shares in the open dataset, the same consent,
 * so the board never shows anything the dataset wouldn't. Agents go through three stages:
 *   learning   its owner is still teaching it (fewer than 30 teaching trades),
 *   warming up it trades its own simulated account but has fewer than 10 closed trades,
 *   ranked     ranked by return on its own account.
 * Every number is recomputed from the closed trades on the verified ledger.
 */

/** Closed trades an agent needs on its own account before it is ranked. */
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

/** An agent still being taught: progress toward trading on its own. */
export interface LearningRow {
  agent: string;
  github: string | null;
  /** The owner's closed trades with market context, the ones the agent learns from. */
  teaching: number;
  needed: number;
  /** All of the owner's closed trades and how they went. */
  trades: number;
  winRate: number | null;
  netPnl: number;
  joinedAt: number;
  lastTradeAt: number | null;
}

export interface Board {
  updatedAt: number;
  minTrades: number;
  minTeaching: number;
  ranked: (BoardRow & { rank: number })[];
  warmingUp: BoardRow[];
  learning: LearningRow[];
}

interface ProfileBase {
  agent: string;
  github: string | null;
  dataset: string;
  updatedAt: number;
}

export interface TradingProfile extends ProfileBase {
  stage: "trading";
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
}

export interface LearningProfile extends ProfileBase {
  stage: "learning";
  teaching: number;
  needed: number;
  joinedAt: number;
  /** The model trained so far, if any. */
  model: { samples: number; accuracy: number; trainedAt: number } | null;
  /** The owner's record across all their closed trades: what the agent learns from. */
  teacher: TrackStats;
}

export type AgentProfile = TradingProfile | LearningProfile;

const ms = (d: Date | null) => (d ? d.getTime() : 0);
const datasetUrl = (agent: string) => `https://github.com/${DATASET_REPO}/tree/main/agents/${agent}`;

/** Every agent whose owner shares in the open dataset, with its own account if it has one. */
const SHARED_AGENTS = (sql: ReturnType<typeof db>, name?: string) => sql`
  select u.id as user_id, u.agent_id, u.login, u.show_login, u.created_at as joined_at,
         s.id as account_id, s.created_at, s.archived_at, s.starting_balance,
         coalesce(a.paused, false) as paused, a.last_run_at, a.model, a.trained_at
  from users u
  left join sim_accounts s on s.user_id = u.id and s.kind = 'agent' and s.archived_at is null
  left join agents a on a.user_id = u.id
  where u.publish_data and u.publish_decided_at is not null
  ${name ? sql`and u.agent_id = ${name}` : sql``}`;

/** The owners' own closed trades, marking the ones the agent can learn from. */
const TAUGHT = (sql: ReturnType<typeof db>, userIds: string[]) => sql`
  select s.user_id, p.pnl, p.opened_at, p.closed_at,
         (p.entry_features is not null and p.exit_px <> p.entry_px) as teaches
  from positions p join sim_accounts s on s.id = p.account_id
  where s.user_id = any(${userIds}) and s.kind = 'human' and p.closed_at is not null
  order by p.closed_at`;

const teacherStats = (rows: { pnl: number; opened_at: Date; closed_at: Date }[]) =>
  trackStats(
    rows.map((t) => ({ pnl: t.pnl, openedAt: ms(t.opened_at), closedAt: ms(t.closed_at) })),
    STARTING_BALANCE,
  );

let boardCache: { at: number; board: Board } | null = null;

export async function board(): Promise<Board> {
  if (boardCache && Date.now() - boardCache.at < CACHE_MS) return boardCache.board;
  const result: Board = {
    updatedAt: Date.now(),
    minTrades: MIN_RANKED_TRADES,
    minTeaching: AGENT.minTeaching,
    ranked: [],
    warmingUp: [],
    learning: [],
  };
  if (!hasDb()) return result;
  const sql = db();
  const agents = await SHARED_AGENTS(sql);
  const trading = agents.filter((a) => a.account_id);
  const learning = agents.filter((a) => !a.account_id);

  if (trading.length) {
    const ids = trading.map((a) => a.account_id as string);
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
    const rows: BoardRow[] = trading.map((a) => {
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
    result.ranked = rows
      .filter((r) => r.trades >= MIN_RANKED_TRADES)
      // Ties go to the agent with more trades, then the older one
      .sort((x, y) => y.returnPct - x.returnPct || y.trades - x.trades || x.startedAt - y.startedAt)
      .map((r, k) => ({ ...r, rank: k + 1 }));
    result.warmingUp = rows
      .filter((r) => r.trades < MIN_RANKED_TRADES)
      .sort((x, y) => y.trades - x.trades || x.startedAt - y.startedAt);
  }

  if (learning.length) {
    const taught = await TAUGHT(
      sql,
      learning.map((a) => a.user_id as string),
    );
    const byUser = new Map<string, typeof taught>();
    for (const t of taught) {
      const list = byUser.get(t.user_id) ?? ([] as unknown as typeof taught);
      list.push(t);
      byUser.set(t.user_id, list);
    }
    result.learning = learning
      .map((a): LearningRow => {
        const rows = byUser.get(a.user_id) ?? [];
        const s = teacherStats(rows as never);
        return {
          agent: a.agent_id,
          github: a.show_login ? a.login : null,
          teaching: rows.filter((t) => t.teaches).length,
          needed: AGENT.minTeaching,
          trades: s.trades,
          winRate: s.winRate,
          netPnl: s.netPnl,
          joinedAt: ms(a.joined_at),
          lastTradeAt: s.lastTradeAt,
        };
      })
      // Closest to trading on its own first
      .sort((x, y) => y.teaching - x.teaching || (y.lastTradeAt ?? 0) - (x.lastTradeAt ?? 0) || x.joinedAt - y.joinedAt);
  }

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
  const base = { agent: a.agent_id, github: a.show_login ? a.login : null, dataset: datasetUrl(a.agent_id), updatedAt: Date.now() };

  if (!a.account_id) {
    const taught = await TAUGHT(sql, [a.user_id]);
    const model = a.model as { samples: number; accuracy: number } | null;
    return {
      ...base,
      stage: "learning",
      teaching: taught.filter((t) => t.teaches).length,
      needed: AGENT.minTeaching,
      joinedAt: ms(a.joined_at),
      model: model && a.trained_at ? { samples: model.samples, accuracy: model.accuracy, trainedAt: ms(a.trained_at) } : null,
      teacher: teacherStats(taught as never),
    };
  }

  const [acct] = await sql`select * from sim_accounts where id = ${a.account_id}`;
  const [evaluated, open, closed, b] = await Promise.all([
    evaluateRow(acct),
    sql`select * from positions where account_id = ${a.account_id} and closed_at is null order by opened_at desc`,
    sql`select * from positions where account_id = ${a.account_id} and closed_at is not null order by closed_at desc limit 25`,
    board(),
  ]);
  return {
    ...base,
    stage: "trading",
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
  };
}
