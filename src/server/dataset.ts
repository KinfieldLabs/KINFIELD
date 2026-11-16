import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";
import { trackStats, type TrackStats } from "@/lib/stats";
import { STARTING_BALANCE } from "@/lib/sim-core";
import { db } from "./db";
import { reasonCommitment } from "./ledger";

/**
 * The open dataset: every agent whose owner chose to share, as files.
 *
 *   agents/<agent-id>/summary.json        stats, accounts, ledger heads
 *   agents/<agent-id>/trades.jsonl        closed trades: context, action, intent, outcome
 *   agents/<agent-id>/ledger/<acct>.jsonl the hash-chained record each trade is checked against
 *   agents.json, README.md, verify.mjs
 *
 * Everything is derived from the ledger tables, and file contents are deterministic,
 * so an agent whose record hasn't changed produces byte-identical files.
 */

export const DATASET_REPO = process.env.DATASET_REPO || "KinfieldLabs/kinfield-datasets";

type Row = postgres.Row;
export type Files = Map<string, string>;

export interface AgentBuild {
  userId: string;
  agentId: string;
  files: Files;
  hash: string;
  trades: number;
  index: AgentIndexRow;
}

export interface AgentIndexRow {
  agent: string;
  github: string | null;
  trades: number;
  win_rate: number | null;
  profit_factor: number | null;
  net_pnl: number;
  max_drawdown: number;
  last_trade_at: string | null;
}

export interface DatasetBuild {
  agents: AgentBuild[];
  /** Agents that stopped sharing after being published: their folders are removed. */
  withdrawn: { userId: string; agentId: string }[];
  root: Files;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const ms = (d: Date | null) => (d ? d.getTime() : 0);
const round = (n: number | null, dp = 6) => (n == null || !Number.isFinite(n) ? null : Number(n.toFixed(dp)));
const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");

function publicStats(s: TrackStats) {
  return {
    trades: s.trades,
    wins: s.wins,
    win_rate: round(s.winRate, 4),
    net_pnl_usd: round(s.netPnl, 2),
    profit_factor: round(s.profitFactor, 4),
    expectancy_usd: round(s.expectancy, 2),
    max_drawdown: round(s.maxDrawdown, 6),
    best_trade_share: round(s.bestTradeShare, 4),
    return: round(s.returnPct, 6),
    active_days: s.activeDays,
    avg_hold_minutes: s.avgHoldMs == null ? null : Math.round(s.avgHoldMs / 60_000),
    first_trade_at: s.firstTradeAt ? new Date(s.firstTradeAt).toISOString() : null,
    last_trade_at: s.lastTradeAt ? new Date(s.lastTradeAt).toISOString() : null,
  };
}

function tradeRecord(p: Row, shareReason: boolean) {
  const hasReason = !!p.rationale;
  const commitment = p.rationale_salt
    ? reasonCommitment(p.rationale_salt, p.rationale)
    : createHash("sha256").update(p.rationale ?? "").digest("hex");
  return {
    position_id: p.id,
    account_id: p.account_id,
    order_id: p.order_id ?? null,
    market: p.coin,
    type: p.order_id ? "limit" : "market",
    opened_at: iso(p.opened_at),
    closed_at: iso(p.closed_at),
    context: p.entry_features ?? null,
    action: {
      side: p.side,
      size_usd: p.size_usd,
      leverage: p.leverage,
      entry_px: p.entry_px,
      entry_fee_usd: p.entry_fee ?? null,
      tp_px: p.tp_px ?? null,
      sl_px: p.sl_px ?? null,
    },
    intent: {
      strategy: p.strategy,
      // The written reason is private unless its owner chose to share reasons
      ...(shareReason && hasReason ? { reason: p.rationale, reason_salt: p.rationale_salt ?? undefined } : {}),
      reason_commitment: commitment,
    },
    outcome: {
      exit_px: p.exit_px,
      exit_reason: p.exit_reason ?? (p.liquidated ? "liquidation" : "manual"),
      pnl_usd: p.pnl,
      fees_usd: p.fees,
      return_on_margin: round(p.pnl / (p.size_usd / p.leverage), 6),
      liquidated: p.liquidated,
    },
  };
}

async function buildAgent(sql: postgres.Sql, u: Row): Promise<AgentBuild | null> {
  const accounts = await sql`select * from sim_accounts where user_id = ${u.id} order by created_at`;
  const files: Files = new Map();
  const base = `agents/${u.agent_id}`;
  const summaries = [];
  const allTrades: Row[] = [];
  let lastEntryAt = 0;

  for (const a of accounts) {
    const ledger = await sql`select kind, payload, prev_hash, hash, created_at from ledger where account_id = ${a.id} order by seq`;
    if (!ledger.length) continue;
    const closed = await sql`select * from positions where account_id = ${a.id} and closed_at is not null order by closed_at, id`;
    allTrades.push(...closed);
    lastEntryAt = Math.max(lastEntryAt, ms(ledger[ledger.length - 1].created_at));
    const file = `ledger/${a.id}.jsonl`;
    files.set(
      `${base}/${file}`,
      jsonl(ledger.map((e) => ({ kind: e.kind, payload: e.payload, prev_hash: e.prev_hash, hash: e.hash, recorded_at: iso(e.created_at) }))),
    );
    summaries.push({
      account_id: a.id,
      status: a.archived_at ? "archived" : "active",
      created_at: iso(a.created_at),
      archived_at: iso(a.archived_at),
      starting_balance: a.starting_balance,
      ledger: { file, entries: ledger.length, head: ledger[ledger.length - 1].hash },
      stats: publicStats(
        trackStats(
          closed.map((t) => ({ pnl: t.pnl, openedAt: ms(t.opened_at), closedAt: ms(t.closed_at) })),
          a.starting_balance,
        ),
      ),
    });
  }
  if (!summaries.length) return null;

  allTrades.sort((x, y) => ms(x.closed_at) - ms(y.closed_at) || String(x.id).localeCompare(String(y.id)));
  files.set(`${base}/trades.jsonl`, jsonl(allTrades.map((t) => tradeRecord(t, u.publish_rationale))));

  const lifetime = trackStats(
    allTrades.map((t) => ({ pnl: t.pnl, openedAt: ms(t.opened_at), closedAt: ms(t.closed_at) })),
    STARTING_BALANCE,
  );
  const github = u.show_login ? u.login : null;
  files.set(
    `${base}/summary.json`,
    JSON.stringify(
      {
        agent: u.agent_id,
        github,
        shares_reasons: u.publish_rationale,
        updated_at: new Date(lastEntryAt).toISOString(),
        lifetime: publicStats(lifetime),
        accounts: summaries,
      },
      null,
      2,
    ) + "\n",
  );

  const hash = createHash("sha256");
  for (const [path, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(`${path}\n${content}\n`);
  return {
    userId: u.id,
    agentId: u.agent_id,
    files,
    hash: hash.digest("hex"),
    trades: allTrades.length,
    index: {
      agent: u.agent_id,
      github,
      trades: lifetime.trades,
      win_rate: round(lifetime.winRate, 4),
      profit_factor: round(lifetime.profitFactor, 4),
      net_pnl: round(lifetime.netPnl, 2) ?? 0,
      max_drawdown: round(lifetime.maxDrawdown, 6) ?? 0,
      last_trade_at: lifetime.lastTradeAt ? new Date(lifetime.lastTradeAt).toISOString() : null,
    },
  };
}

export async function buildDataset(): Promise<DatasetBuild> {
  const sql = db();
  const sharing = await sql`select * from users where publish_data and publish_decided_at is not null order by agent_id`;
  const withdrawnRows = await sql`
    select id, agent_id from users
    where dataset_hash is not null and not (publish_data and publish_decided_at is not null)`;

  const agents: AgentBuild[] = [];
  for (const u of sharing) {
    const a = await buildAgent(sql, u);
    if (a) agents.push(a);
  }
  const index = agents.map((a) => a.index).sort((x, y) => y.trades - x.trades || x.agent.localeCompare(y.agent));

  const root: Files = new Map();
  root.set("agents.json", JSON.stringify(index, null, 2) + "\n");
  root.set("README.md", readme(index));
  root.set("verify.mjs", readFileSync(join(process.cwd(), "dataset", "verify.mjs"), "utf8"));
  return { agents, withdrawn: withdrawnRows.map((r) => ({ userId: r.id, agentId: r.agent_id })), root };
}

function readme(index: AgentIndexRow[]): string {
  const pct = (n: number | null) => (n == null ? "n/a" : `${(n * 100).toFixed(1)}%`);
  const rows = index
    .slice(0, 500)
    .map(
      (a) =>
        `| [${a.agent}](agents/${a.agent}/summary.json) | ${a.github ? `@${a.github}` : "n/a"} | ${a.trades} | ${pct(a.win_rate)} | ${a.profit_factor == null ? "n/a" : a.profit_factor.toFixed(2)} | ${a.net_pnl.toFixed(2)} | ${pct(a.max_drawdown)} | ${a.last_trade_at?.slice(0, 10) ?? "n/a"} |`,
    )
    .join("\n");
  return `# Kinfield open dataset

Trades made by people teaching AI agents to trade on [Kinfield](https://kinfield.si), a simulated
market running on live Hyperliquid prices. Each agent learns from one person's decisions; this
repository holds those decisions as data: the market context, the action, the intent, and the outcome.

All trading here is simulated. No real funds are involved. Nothing in this repository is financial advice.

## What's in it

| Path | Contents |
|---|---|
| \`agents.json\` | One row per agent, with headline stats |
| \`agents/<agent>/summary.json\` | Stats for each simulated account, and each account's ledger length and head hash |
| \`agents/<agent>/trades.jsonl\` | Every closed trade, one JSON object per line |
| \`agents/<agent>/ledger/<account>.jsonl\` | The hash-chained record every trade is checked against |
| \`verify.mjs\` | Checks all of the above, with no dependencies |

Agents are pseudonymous (\`agent-…\`). A GitHub username appears only when its owner chose to show it.
Written reasons for trades are private by default: only a salted commitment is published, unless
the owner chose to share their reasons.

### A trade (\`trades.jsonl\`)

- \`context\`: market features at the moment of the decision (momentum over 5m, 15m and 1h, volatility,
  position in the last hour's range, volume surge)
- \`action\`: side, size, leverage, entry price, fee, take profit and stop loss
- \`intent\`: the strategy the trader tagged, and a commitment to (or the text of) their reason
- \`outcome\`: exit price, how it ended (\`manual\`, \`take_profit\`, \`stop_loss\`, \`liquidation\`), P&L, fees

Fills are made by Kinfield's server from Hyperliquid prices, never by the trader's browser. Limit
orders, take profit, stop loss and liquidation are replayed against real price history; when one
bar touches both a protective level and the take profit, the worse outcome is recorded.

## Verify

\`\`\`bash
node verify.mjs
\`\`\`

Every ledger entry commits to the one before it, starting from \`sha256("kinfield:<account id>")\`.
Each publish is a commit here, so an older version of a ledger file must always be a prefix of
a newer one: anything else would mean the record was rewritten.

## License

[CC BY 4.0](LICENSE): you may share and adapt this data for any purpose, including training models,
as long as you credit Kinfield and link to https://kinfield.si.

## Agents

| Agent | GitHub | Trades | Win rate | Profit factor | Net P&L (USD) | Max drawdown | Last trade |
|---|---|---|---|---|---|---|---|
${rows || "| No agents yet | | 0 | | | | | |"}
`;
}
