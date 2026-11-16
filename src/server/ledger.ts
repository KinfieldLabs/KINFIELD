import { createHash } from "node:crypto";
import type postgres from "postgres";
import { computeFeatures } from "@/lib/features";
import {
  closeOutcome,
  entryFee,
  liquidationPx,
  margin,
  STARTING_BALANCE,
  STRATEGIES,
  unrealized,
  type ClosedTrade,
  type Position,
  type Side,
  type Strategy,
} from "@/lib/sim-core";
import { db } from "./db";
import { candles, maxLeverage, mids } from "./market";

/**
 * The server-side simulated ledger. The browser only sends intentions (side, size,
 * leverage, strategy, reason); the server decides the fill price from Hyperliquid,
 * computes the market features itself, checks margin, and records every fill in an
 * append-only hash chain. That is what makes an agent's track record trustworthy.
 */

export const MAX_LEVERAGE = 20;
export const MIN_ORDER_USD = 10;
export const MAX_RATIONALE = 1000;

export class LedgerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Tx = postgres.TransactionSql;
type Row = postgres.Row;

export interface AccountState {
  accountId: string;
  startingBalance: number;
  createdAt: number;
  cash: number;
  positions: Position[];
  history: ClosedTrade[];
  ledger: { entries: number; head: string };
}

// ---------- hash chain ----------

/** JSON with sorted keys, so a hash can be recomputed from the stored jsonb. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

export const genesis = (accountId: string) => createHash("sha256").update(`kinfield:${accountId}`).digest("hex");
export const chainHash = (prev: string, kind: string, payload: unknown) =>
  createHash("sha256").update(`${prev}\n${kind}\n${canonical(payload)}`).digest("hex");

async function append(tx: Tx, accountId: string, kind: "open" | "close" | "liquidate", payload: object) {
  const [last] = await tx`select hash from ledger where account_id = ${accountId} order by seq desc limit 1`;
  const prev = last?.hash ?? genesis(accountId);
  const hash = chainHash(prev, kind, payload);
  await tx`insert into ledger (account_id, kind, payload, prev_hash, hash)
           values (${accountId}, ${kind}, ${tx.json(payload as postgres.JSONValue)}, ${prev}, ${hash})`;
}

// ---------- rows ----------

const ms = (d: Date | null) => (d ? d.getTime() : 0);

function toPosition(r: Row): Position {
  return {
    id: r.id,
    coin: r.coin,
    side: r.side,
    sizeUsd: r.size_usd,
    leverage: r.leverage,
    entryPx: r.entry_px,
    openedAt: ms(r.opened_at),
    strategy: r.strategy,
    rationale: r.rationale,
    entryFeatures: r.entry_features,
  };
}

function toClosed(r: Row): ClosedTrade {
  return { ...toPosition(r), exitPx: r.exit_px, closedAt: ms(r.closed_at), pnl: r.pnl, fees: r.fees, liquidated: r.liquidated };
}

// ---------- accounts ----------

async function activeAccount(userId: string): Promise<Row> {
  const sql = db();
  const [a] = await sql`select * from sim_accounts where user_id = ${userId} and archived_at is null`;
  if (a) return a;
  const [created] = await sql`
    insert into sim_accounts (user_id, starting_balance, cash) values (${userId}, ${STARTING_BALANCE}, ${STARTING_BALANCE})
    on conflict do nothing returning *`;
  if (created) return created;
  const [again] = await sql`select * from sim_accounts where user_id = ${userId} and archived_at is null`;
  return again;
}

/** Locks the user's active account row for the rest of the transaction. */
async function lockAccount(tx: Tx, accountId: string): Promise<Row> {
  const [a] = await tx`select * from sim_accounts where id = ${accountId} and archived_at is null for update`;
  if (!a) throw new LedgerError("account was reset", 409);
  return a;
}

export async function getState(userId: string): Promise<AccountState> {
  const acct = await activeAccount(userId);
  await sweepLiquidations(acct.id);
  const sql = db();
  const [[a], open, closed, [chain]] = await Promise.all([
    sql`select * from sim_accounts where id = ${acct.id}`,
    sql`select * from positions where account_id = ${acct.id} and closed_at is null order by opened_at desc`,
    sql`select * from positions where account_id = ${acct.id} and closed_at is not null order by closed_at desc`,
    sql`select count(*)::int as n, (select hash from ledger where account_id = ${acct.id} order by seq desc limit 1) as head
        from ledger where account_id = ${acct.id}`,
  ]);
  return {
    accountId: a.id,
    startingBalance: a.starting_balance,
    createdAt: ms(a.created_at),
    cash: a.cash,
    positions: open.map(toPosition),
    history: closed.map(toClosed),
    ledger: { entries: chain.n, head: chain.head ?? genesis(a.id) },
  };
}

// ---------- liquidation ----------

/**
 * Checks every open position against real 1-minute highs and lows since it was last
 * checked, so a position that was wiped out while nobody had the page open is still
 * liquidated at the right price and time.
 */
async function sweepLiquidations(accountId: string) {
  const open = await db()`select * from positions where account_id = ${accountId} and closed_at is null`;
  if (!open.length) return;
  const now = Date.now();
  const live = await mids();
  const hits: { id: string; px: number; at: number }[] = [];
  const clean: string[] = [];

  await Promise.all(
    open.map(async (r) => {
      const p = toPosition(r);
      const liq = liquidationPx(p);
      const crossed = (lo: number, hi: number) => (p.side === "long" ? lo <= liq : hi >= liq);
      const from = ms(r.liq_checked_at);
      let bars: { t: number; l: number; h: number }[] = [];
      try {
        bars = (await candles(p.coin, "1m", from, now)).filter((b) => b.t >= from);
      } catch {
        return; // market data unavailable: try again on the next sweep
      }
      const hit = bars.find((b) => crossed(b.l, b.h));
      if (hit) hits.push({ id: p.id, px: liq, at: Math.min(hit.t + 60_000, now) });
      else if (live[p.coin] && crossed(live[p.coin], live[p.coin])) hits.push({ id: p.id, px: liq, at: now });
      else clean.push(p.id);
    }),
  );

  if (clean.length) await db()`update positions set liq_checked_at = ${new Date(now)} where id = any(${clean})`;
  if (!hits.length) return;
  await db().begin(async (tx) => {
    await lockAccount(tx, accountId);
    for (const h of hits) await settle(tx, accountId, h.id, h.px, h.at, true);
  });
}

// ---------- fills ----------

async function settle(tx: Tx, accountId: string, positionId: string, px: number, at: number, liquidated: boolean) {
  const [r] = await tx`select * from positions where id = ${positionId} and account_id = ${accountId} and closed_at is null for update`;
  if (!r) return null;
  const p = toPosition(r);
  const { fees, pnl, cashDelta } = closeOutcome(p, px, liquidated);
  const closedAt = new Date(at);
  await tx`update positions set exit_px = ${px}, closed_at = ${closedAt}, pnl = ${pnl}, fees = ${fees}, liquidated = ${liquidated}
           where id = ${positionId}`;
  await tx`update sim_accounts set cash = cash + ${cashDelta} where id = ${accountId}`;
  await append(tx, accountId, liquidated ? "liquidate" : "close", {
    position_id: p.id,
    coin: p.coin,
    exit_px: px,
    closed_at: closedAt.toISOString(),
    pnl,
    fees,
  });
  return { ...p, exitPx: px, closedAt: at, pnl, fees, liquidated } satisfies ClosedTrade;
}

export interface OrderInput {
  coin: string;
  side: Side;
  sizeUsd: number;
  leverage: number;
  strategy: Strategy;
  rationale: string;
}

export function parseOrder(body: unknown): OrderInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const coin = typeof b.coin === "string" ? b.coin : "";
  const side = b.side === "long" || b.side === "short" ? b.side : null;
  const sizeUsd = Number(b.sizeUsd);
  const leverage = Number(b.leverage);
  const strategy = STRATEGIES.find((s) => s === b.strategy);
  const rationale = typeof b.rationale === "string" ? b.rationale.trim() : "";
  if (!coin || !/^[A-Za-z0-9]{1,20}$/.test(coin)) throw new LedgerError("unknown market");
  if (!side) throw new LedgerError("side must be long or short");
  if (!Number.isFinite(sizeUsd) || sizeUsd < MIN_ORDER_USD) throw new LedgerError(`Minimum order is $${MIN_ORDER_USD}`);
  if (!Number.isFinite(leverage) || leverage < 1) throw new LedgerError("leverage must be at least 1");
  if (!strategy) throw new LedgerError("unknown strategy");
  if (rationale.length > MAX_RATIONALE) throw new LedgerError(`Reason is limited to ${MAX_RATIONALE} characters`);
  return { coin, side, sizeUsd, leverage, strategy, rationale };
}

export async function openPosition(userId: string, o: OrderInput): Promise<Position> {
  const acct = await activeAccount(userId);
  await sweepLiquidations(acct.id);

  const [live, maxLev, minuteBars] = await Promise.all([
    mids(),
    maxLeverage(),
    candles(o.coin, "1m", Date.now() - 95 * 60_000).catch(() => []),
  ]);
  const px = live[o.coin];
  if (!px || !(o.coin in maxLev)) throw new LedgerError("unknown market");
  const lev = Math.min(o.leverage, maxLev[o.coin], MAX_LEVERAGE);
  const features = computeFeatures(minuteBars.slice(-90), px);

  return db().begin(async (tx) => {
    const a = await lockAccount(tx, acct.id);
    const open = (await tx`select * from positions where account_id = ${acct.id} and closed_at is null`).map(toPosition);
    const upnl = open.reduce((s, p) => s + (live[p.coin] ? unrealized(p, live[p.coin]) : 0), 0);
    const used = open.reduce((s, p) => s + margin(p), 0);
    const free = a.cash + upnl - used;
    const fee = entryFee(o.sizeUsd);
    if (o.sizeUsd / lev + fee > free) throw new LedgerError("Not enough free margin");

    const [r] = await tx`
      insert into positions (account_id, coin, side, size_usd, leverage, entry_px, strategy, rationale, entry_features)
      values (${acct.id}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${lev}, ${px}, ${o.strategy}, ${o.rationale},
              ${features ? tx.json(features as unknown as postgres.JSONValue) : null})
      returning *`;
    await tx`update sim_accounts set cash = cash - ${fee} where id = ${acct.id}`;
    const p = toPosition(r);
    await append(tx, acct.id, "open", {
      position_id: p.id,
      coin: p.coin,
      side: p.side,
      size_usd: p.sizeUsd,
      leverage: p.leverage,
      entry_px: p.entryPx,
      opened_at: new Date(p.openedAt).toISOString(),
      strategy: p.strategy,
      rationale_sha256: createHash("sha256").update(p.rationale).digest("hex"),
      features,
    });
    return p;
  });
}

export async function closePosition(userId: string, positionId: string): Promise<ClosedTrade> {
  const acct = await activeAccount(userId);
  await sweepLiquidations(acct.id);
  const [r] = await db()`select coin from positions where id = ${positionId} and account_id = ${acct.id} and closed_at is null`;
  if (!r) throw new LedgerError("position is not open", 404);
  const px = (await mids())[r.coin];
  if (!px) throw new LedgerError("no price for this market right now", 503);
  const closed = await db().begin(async (tx) => {
    await lockAccount(tx, acct.id);
    return settle(tx, acct.id, positionId, px, Date.now(), false);
  });
  if (!closed) throw new LedgerError("position is not open", 404);
  return closed;
}

/** Archives the active account (its ledger is kept) and starts a fresh one. */
export async function resetAccount(userId: string) {
  await db()`update sim_accounts set archived_at = now() where user_id = ${userId} and archived_at is null`;
}
