import { predict, trainAgent, type AgentModel } from "@/lib/agent";
import { computeFeatures } from "@/lib/features";
import { liquidationPx, unrealized, type ClosedTrade, type Position, type Side } from "@/lib/sim-core";
import { db } from "./db";
import { activeAccount, closePosition, placeOrder, sweep } from "./ledger";
import { maxLeverage, mids, recentMinuteBars } from "./market";

/**
 * The apprentice trading on its own. Every run (scheduled every 15 minutes), for each
 * person who has taught it enough:
 *   1. retrain once a day on their closed trades (the same model as the browser apprentice),
 *   2. close any of its positions held longer than the time limit,
 *   3. in the person's most-traded markets, ask the model for a lean and act only when
 *      it is confident, with fixed, volatility-scaled risk.
 * Its trades go on its own simulated account, through the same verified ledger.
 */
export const AGENT = {
  minTeaching: 30, // the person's closed trades with market context
  confidence: 0.6, // long at p >= 0.60, short at p <= 0.40, otherwise wait
  riskPerTrade: 0.01, // share of equity lost if the stop loss is hit
  rewardToRisk: 2, // take profit sits twice as far away as the stop
  minStop: 0.004,
  maxStop: 0.05,
  maxNotionalShare: 1, // one position's size at most 1x equity
  leverage: 5,
  maxHoldMs: 24 * 3_600_000,
  markets: 3,
  retrainMs: 24 * 3_600_000,
} as const;

const HOUR_IN_MINUTES = 60;

export interface Decision {
  coin: string;
  action: "long" | "short" | "wait" | "holding" | "skip";
  p?: number;
  note: string;
  sizeUsd?: number;
  stop?: number;
}

export interface AgentRunResult {
  userId: string;
  agentId: string;
  trained: boolean;
  samples: number;
  timeStops: number;
  decisions: Decision[];
  error?: string;
}

/** Stop distance from recent volatility: 1.5x the expected one-hour move, kept within bounds. */
export function stopDistance(vol1m: number): number {
  const hourMove = vol1m * Math.sqrt(HOUR_IN_MINUTES);
  return Math.min(AGENT.maxStop, Math.max(AGENT.minStop, 1.5 * hourMove));
}

/** Position size so that hitting the stop loses `riskPerTrade` of equity, capped. */
export function sizeFor(equity: number, stop: number): number {
  return Math.min((equity * AGENT.riskPerTrade) / stop, equity * AGENT.maxNotionalShare);
}

export function levels(side: Side, px: number, stop: number) {
  const dir = side === "long" ? 1 : -1;
  return { slPx: px * (1 - dir * stop), tpPx: px * (1 + dir * stop * AGENT.rewardToRisk) };
}

/** The person's closed trades that carry market context: what the agent learns from. */
async function teachingTrades(userId: string) {
  return db()`
    select p.* from positions p join sim_accounts s on s.id = p.account_id
    where s.user_id = ${userId} and s.kind = 'human' and p.closed_at is not null
      and p.entry_features is not null and p.exit_px <> p.entry_px
    order by p.closed_at`;
}

async function runOne(u: { id: string; agent_id: string }): Promise<AgentRunResult> {
  const sql = db();
  const result: AgentRunResult = { userId: u.id, agentId: u.agent_id, trained: false, samples: 0, timeStops: 0, decisions: [] };
  await sql`insert into agents (user_id) values (${u.id}) on conflict do nothing`;
  const [agent] = await sql`select * from agents where user_id = ${u.id}`;
  if (agent.paused) {
    await sql`update agents set last_run_at = now(), last_note = 'Paused by you' where user_id = ${u.id}`;
    return result;
  }

  // 1. Model: retrain once a day on everything the person has taught it
  const teaching = await teachingTrades(u.id);
  result.samples = teaching.length;
  let model = agent.model as AgentModel | null;
  if (!model || !agent.trained_at || Date.now() - agent.trained_at.getTime() > AGENT.retrainMs) {
    const examples = teaching.map(
      (t) => ({ entryFeatures: t.entry_features, entryPx: t.entry_px, exitPx: t.exit_px }) as unknown as ClosedTrade,
    );
    model = trainAgent(examples);
    if (!model) throw new Error("not enough examples to train on");
    await sql`update agents set model = ${sql.json(model as unknown as Parameters<typeof sql.json>[0])}, trained_at = now(),
              trained_on = ${model.samples} where user_id = ${u.id}`;
    result.trained = true;
  }

  // 2. Its own account: settle triggers, then enforce the time limit
  const acct = await activeAccount(u.id, "agent");
  await sweep(acct.id, true);
  const stale = await sql`select id from positions where account_id = ${acct.id} and closed_at is null
                          and opened_at < ${new Date(Date.now() - AGENT.maxHoldMs)}`;
  for (const s of stale) {
    try {
      await closePosition(u.id, s.id, { kind: "agent", reason: "time_stop" });
      result.timeStops++;
    } catch {
      // already closed by a trigger
    }
  }

  // 3. Decide in the person's most-traded markets
  const counts = new Map<string, number>();
  for (const t of teaching) counts.set(t.coin, (counts.get(t.coin) ?? 0) + 1);
  const [live, maxLev] = await Promise.all([mids(), maxLeverage()]);
  const markets = [...counts]
    .filter(([c]) => live[c] && c in maxLev)
    .sort((a, b) => b[1] - a[1])
    .slice(0, AGENT.markets)
    .map(([c]) => c);

  const [a] = await sql`select cash from sim_accounts where id = ${acct.id}`;
  const open = (await sql`select * from positions where account_id = ${acct.id} and closed_at is null`).map(
    (r) => ({ coin: r.coin, side: r.side, sizeUsd: r.size_usd, leverage: r.leverage, entryPx: r.entry_px }) as Position,
  );
  const equity = a.cash + open.reduce((s, p) => s + (live[p.coin] ? unrealized(p, live[p.coin]) : 0), 0);

  for (const coin of markets) {
    if (open.some((p) => p.coin === coin)) {
      result.decisions.push({ coin, action: "holding", note: "Already has a position" });
      continue;
    }
    const px = live[coin];
    const bars = await recentMinuteBars(coin).catch(() => []);
    const features = computeFeatures(bars.slice(-90), px);
    if (!features) {
      result.decisions.push({ coin, action: "skip", note: "Not enough recent price data" });
      continue;
    }
    const p = predict(model, features);
    const side: Side | null = p >= AGENT.confidence ? "long" : p <= 1 - AGENT.confidence ? "short" : null;
    if (!side) {
      result.decisions.push({ coin, action: "wait", p, note: `${Math.round(p * 100)}% long: not confident enough` });
      continue;
    }
    const stop = stopDistance(features.vol15m);
    const lev = Math.min(AGENT.leverage, maxLev[coin]);
    const sizeUsd = Math.floor(sizeFor(equity, stop));
    // The stop must sit well inside the liquidation price
    const liq = liquidationPx({ side, entryPx: px, leverage: lev });
    const { slPx, tpPx } = levels(side, px, stop);
    if (sizeUsd < 10 || (side === "long" ? slPx <= liq : slPx >= liq)) {
      result.decisions.push({ coin, action: "skip", p, note: "Position would be too small or too close to liquidation" });
      continue;
    }
    const confidence = Math.round((side === "long" ? p : 1 - p) * 100);
    try {
      await placeOrder(
        u.id,
        {
          coin,
          side,
          type: "market",
          limitPx: null,
          sizeUsd,
          leverage: lev,
          tpPx,
          slPx,
          strategy: "Other",
          rationale: `Agent: ${confidence}% confident ${side}, model trained on ${model.samples} of your trades. Stop ${(stop * 100).toFixed(2)}% away, target ${(stop * AGENT.rewardToRisk * 100).toFixed(2)}%.`,
        },
        { kind: "agent", agentP: p },
      );
      result.decisions.push({ coin, action: side, p, sizeUsd, stop, note: `Opened ${side} at ${confidence}% confidence` });
      open.push({ coin, side, sizeUsd, leverage: lev, entryPx: px } as Position);
    } catch (e) {
      result.decisions.push({ coin, action: "skip", p, note: (e as Error).message });
    }
  }

  const opened = result.decisions.filter((d) => d.action === "long" || d.action === "short").length;
  const note =
    result.decisions.map((d) => `${d.coin}: ${d.note}`).join(" · ") || "No markets to trade yet";
  await sql`update agents set last_run_at = now(), last_note = ${note.slice(0, 500)},
            started_at = case when ${opened} > 0 then coalesce(started_at, now()) else started_at end
            where user_id = ${u.id}`;
  return result;
}

/** One scheduled run across every agent that has been taught enough. */
export async function runAgents(): Promise<{ skipped?: string; results: AgentRunResult[] }> {
  const sql = db();
  const [busy] = await sql`select id from agent_runs where finished_at is null and started_at > now() - interval '10 minutes'`;
  if (busy) return { skipped: "another run is still in progress", results: [] };
  const [run] = await sql`insert into agent_runs default values returning id`;
  const results: AgentRunResult[] = [];
  try {
    const ready = await sql`
      select u.id, u.agent_id from users u
      join sim_accounts s on s.user_id = u.id and s.kind = 'human'
      join positions p on p.account_id = s.id and p.closed_at is not null
        and p.entry_features is not null and p.exit_px <> p.entry_px
      group by u.id, u.agent_id
      having count(p.id) >= ${AGENT.minTeaching}`;
    for (const u of ready) {
      try {
        results.push(await runOne({ id: u.id, agent_id: u.agent_id }));
      } catch (e) {
        const msg = (e as Error).message;
        results.push({ userId: u.id, agentId: u.agent_id, trained: false, samples: 0, timeStops: 0, decisions: [], error: msg });
        await sql`update agents set last_run_at = now(), last_note = ${`Run failed: ${msg}`.slice(0, 500)} where user_id = ${u.id}`;
      }
    }
    const opened = results.reduce((n, r) => n + r.decisions.filter((d) => d.action === "long" || d.action === "short").length, 0);
    const closed = results.reduce((n, r) => n + r.timeStops, 0);
    await sql`update agent_runs set finished_at = now(), agents = ${results.length}, opened = ${opened}, closed = ${closed}
              where id = ${run.id}`;
    return { results };
  } catch (e) {
    await sql`update agent_runs set finished_at = now(), error = ${(e as Error).message.slice(0, 1000)} where id = ${run.id}`;
    throw e;
  }
}
