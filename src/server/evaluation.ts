import { readiness, type Readiness } from "@/lib/readiness";
import { trackStats, type TrackStats } from "@/lib/stats";
import type { User } from "./auth";
import { DATASET_REPO } from "./dataset";
import { db } from "./db";
import { getState } from "./ledger";

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

export interface Evaluation {
  agentId: string;
  publishing: boolean;
  datasetRepo: string;
  accounts: AccountEvaluation[];
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
  const accounts = await sql`select * from sim_accounts where user_id = ${user.id} order by created_at desc`;
  const out: AccountEvaluation[] = [];
  for (const a of accounts) {
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
    out.push({
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
    });
  }
  return {
    agentId: user.agentId,
    publishing: user.sharingDecided && user.publishData,
    datasetRepo: DATASET_REPO,
    accounts: out,
  };
}
