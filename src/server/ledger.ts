import { createHash } from "node:crypto";
import type postgres from "postgres";
import { computeFeatures } from "@/lib/features";
import {
  checkTpSl,
  closeOutcome,
  entryFee,
  MAKER_FEE,
  margin,
  reserved,
  STARTING_BALANCE,
  STRATEGIES,
  unrealized,
  type ClosedTrade,
  type ExitReason,
  type Order,
  type Position,
  type Side,
  type Strategy,
  limitCrossed,
  triggerHit,
} from "@/lib/sim-core";
import { db } from "./db";
import { closedBarsSince, maxLeverage, mids, recentMinuteBars, type Bar } from "./market";

/**
 * The server-side simulated ledger. The browser only sends intentions (side, size,
 * leverage, prices, strategy, reason); the server decides every fill from Hyperliquid
 * prices, computes the market features itself, checks margin, and records each event
 * in an append-only hash chain. That is what makes an agent's track record trustworthy.
 */

export const MAX_LEVERAGE = 20;
export const MIN_ORDER_USD = 10;
export const MAX_RATIONALE = 1000;
export const MAX_OPEN_ORDERS = 20;
const MAX_LIMIT_DISTANCE = 0.5; // a limit price must be within 50% of the market

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
  orders: Order[];
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
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type Kind = "open" | "close" | "liquidate" | "order" | "cancel" | "tpsl";

async function append(tx: Tx, accountId: string, kind: Kind, payload: object) {
  const [last] = await tx`select hash from ledger where account_id = ${accountId} order by seq desc limit 1`;
  const prev = last?.hash ?? genesis(accountId);
  const hash = chainHash(prev, kind, payload);
  await tx`insert into ledger (account_id, kind, payload, prev_hash, hash)
           values (${accountId}, ${kind}, ${tx.json(payload as postgres.JSONValue)}, ${prev}, ${hash})`;
}

// ---------- rows ----------

const ms = (d: Date | null) => (d ? d.getTime() : 0);
/** When an order or position was last checked against price history. */
const checkpoint = (r: Row) => ms(r.liq_checked_at ?? r.checked_at);

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
    entryFee: r.entry_fee ?? undefined,
    tpPx: r.tp_px,
    slPx: r.sl_px,
  };
}

function toClosed(r: Row): ClosedTrade {
  return {
    ...toPosition(r),
    exitPx: r.exit_px,
    closedAt: ms(r.closed_at),
    pnl: r.pnl,
    fees: r.fees,
    liquidated: r.liquidated,
    exitReason: r.exit_reason ?? (r.liquidated ? "liquidation" : "manual"),
  };
}

function toOrder(r: Row): Order {
  return {
    id: r.id,
    coin: r.coin,
    side: r.side,
    sizeUsd: r.size_usd,
    leverage: r.leverage,
    limitPx: r.limit_px,
    tpPx: r.tp_px,
    slPx: r.sl_px,
    strategy: r.strategy,
    rationale: r.rationale,
    placedAt: ms(r.placed_at),
  };
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
  await sweep(acct.id);
  const sql = db();
  const [[a], open, orders, closed, [chain]] = await Promise.all([
    sql`select * from sim_accounts where id = ${acct.id}`,
    sql`select * from positions where account_id = ${acct.id} and closed_at is null order by opened_at desc`,
    sql`select * from orders where account_id = ${acct.id} and status = 'open' order by placed_at desc`,
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
    orders: orders.map(toOrder),
    history: closed.map(toClosed),
    ledger: { entries: chain.n, head: chain.head ?? genesis(a.id) },
  };
}

/** Free margin: equity minus margin in use and margin held for resting orders. */
async function freeMargin(tx: Tx, accountId: string, cash: number, live: Record<string, number>) {
  const open = (await tx`select * from positions where account_id = ${accountId} and closed_at is null`).map(toPosition);
  const resting = (await tx`select * from orders where account_id = ${accountId} and status = 'open'`).map(toOrder);
  const upnl = open.reduce((s, p) => s + (live[p.coin] ? unrealized(p, live[p.coin]) : 0), 0);
  const used = open.reduce((s, p) => s + margin(p), 0);
  const held = resting.reduce((s, o) => s + reserved(o), 0);
  return { free: cash + upnl - used - held, openOrders: resting.length };
}

// ---------- triggers: limit fills, take profit, stop loss, liquidation ----------

interface Exit {
  px: number;
  at: number;
  reason: ExitReason;
}

function firstExit(p: Position, bars: Bar[], from: number, now: number): Exit | null {
  for (const b of bars) {
    if (b.t < from) continue;
    const hit = triggerHit(p, b.l, b.h);
    if (hit) return { ...hit, at: Math.min(b.t + b.ms, now) };
  }
  return null;
}


const lastSweep = new Map<string, number>();

/**
 * Replays real price history since each order and position was last checked: fills
 * resting limit orders, then fires take profit, stop loss and liquidation. Runs on
 * every read and before every action, so the record is right even for time when
 * nobody had the page open.
 */
async function sweep(accountId: string, force = false) {
  const now = Date.now();
  if (!force && now - (lastSweep.get(accountId) ?? 0) < 3000) return;
  lastSweep.set(accountId, now);

  const sql = db();
  const [posRows, orderRows] = await Promise.all([
    sql`select * from positions where account_id = ${accountId} and closed_at is null`,
    sql`select * from orders where account_id = ${accountId} and status = 'open'`,
  ]);
  if (!posRows.length && !orderRows.length) return;

  // One history fetch per coin, from the oldest checkpoint
  const since = new Map<string, number>();
  for (const r of [...posRows, ...orderRows]) {
    const at = checkpoint(r);
    since.set(r.coin, Math.min(since.get(r.coin) ?? Infinity, at));
  }
  const bars = new Map<string, Bar[]>();
  await Promise.all(
    [...since].map(async ([coin, from]) => {
      try {
        bars.set(coin, await closedBarsSince(coin, from));
      } catch {
        // market data unavailable: this coin is checked on the next sweep
      }
    }),
  );
  const live = await mids().catch(() => ({}) as Record<string, number>);
  const endOf = (coin: string, fallback: number) => {
    const b = bars.get(coin);
    return b?.length ? Math.max(fallback, b[b.length - 1].t + b[b.length - 1].ms) : fallback;
  };

  const exits: { id: string; exit: Exit }[] = [];
  const checked: { table: "positions" | "orders"; id: string; at: number }[] = [];
  const fills: { order: Order; at: number; checkFrom: number; exit: Exit | null; checkedTo: number }[] = [];

  for (const r of posRows) {
    const p = toPosition(r);
    const b = bars.get(p.coin);
    if (!b) continue;
    const exit = firstExit(p, b, checkpoint(r), now);
    const mid = live[p.coin];
    const liveHit = !exit && mid ? triggerHit(p, mid, mid) : null;
    if (exit) exits.push({ id: p.id, exit });
    else if (liveHit) exits.push({ id: p.id, exit: { ...liveHit, at: now } });
    else checked.push({ table: "positions", id: p.id, at: endOf(p.coin, checkpoint(r)) });
  }

  for (const r of orderRows) {
    const o = toOrder(r);
    const b = bars.get(o.coin);
    if (!b) continue;
    const from = checkpoint(r);
    const fillBar = b.find((x) => x.t >= from && limitCrossed(o, x.l, x.h));
    const mid = live[o.coin];
    let at: number | null = null;
    let checkFrom = now;
    if (fillBar) {
      at = Math.min(fillBar.t + fillBar.ms, now);
      checkFrom = fillBar.t + fillBar.ms;
    } else if (mid && limitCrossed(o, mid, mid)) {
      at = now;
    }
    if (at == null) {
      checked.push({ table: "orders", id: o.id, at: endOf(o.coin, from) });
      continue;
    }
    // The new position's own triggers, on the bars after the fill
    const shadow: Position = {
      id: "",
      coin: o.coin,
      side: o.side,
      sizeUsd: o.sizeUsd,
      leverage: o.leverage,
      entryPx: o.limitPx,
      openedAt: at,
      strategy: o.strategy,
      rationale: o.rationale,
      entryFeatures: null,
      tpPx: o.tpPx,
      slPx: o.slPx,
    };
    let exit = firstExit(shadow, b, checkFrom, now);
    if (!exit && mid && at < now) {
      const hit = triggerHit(shadow, mid, mid);
      if (hit) exit = { ...hit, at: now };
    }
    fills.push({ order: o, at, checkFrom, exit, checkedTo: endOf(o.coin, checkFrom) });
  }

  for (const c of checked) {
    const at = new Date(c.at);
    if (c.table === "positions") await sql`update positions set liq_checked_at = ${at} where id = ${c.id} and closed_at is null`;
    else await sql`update orders set checked_at = ${at} where id = ${c.id} and status = 'open'`;
  }
  if (!exits.length && !fills.length) return;

  await sql.begin(async (tx) => {
    await lockAccount(tx, accountId);
    for (const f of fills) {
      const id = await fillOrder(tx, accountId, f.order.id, f.at, f.checkedTo);
      if (id && f.exit) await settle(tx, accountId, id, f.exit.px, f.exit.at, f.exit.reason);
    }
    for (const e of exits) await settle(tx, accountId, e.id, e.exit.px, e.exit.at, e.exit.reason);
  });
}

/** Turns a resting limit order into a position at its limit price, with the maker fee. */
async function fillOrder(tx: Tx, accountId: string, orderId: string, at: number, checkedTo: number) {
  const [r] = await tx`select * from orders where id = ${orderId} and account_id = ${accountId} and status = 'open' for update`;
  if (!r) return null;
  const o = toOrder(r);
  const fee = o.sizeUsd * MAKER_FEE;
  const openedAt = new Date(at);
  const [pos] = await tx`
    insert into positions (account_id, coin, side, size_usd, leverage, entry_px, opened_at, strategy, rationale,
                           entry_features, entry_fee, tp_px, sl_px, order_id, liq_checked_at)
    values (${accountId}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${o.leverage}, ${o.limitPx}, ${openedAt}, ${o.strategy},
            ${o.rationale}, ${r.features ? tx.json(r.features) : null}, ${fee}, ${o.tpPx}, ${o.slPx}, ${o.id},
            ${new Date(checkedTo)})
    returning *`;
  await tx`update orders set status = 'filled', done_at = ${openedAt}, position_id = ${pos.id} where id = ${o.id}`;
  await tx`update sim_accounts set cash = cash - ${fee} where id = ${accountId}`;
  await append(tx, accountId, "open", {
    position_id: pos.id,
    order_id: o.id,
    type: "limit",
    coin: o.coin,
    side: o.side,
    size_usd: o.sizeUsd,
    leverage: o.leverage,
    entry_px: o.limitPx,
    entry_fee: fee,
    opened_at: openedAt.toISOString(),
    strategy: o.strategy,
    tp_px: o.tpPx ?? undefined,
    sl_px: o.slPx ?? undefined,
  });
  return pos.id as string;
}

async function settle(tx: Tx, accountId: string, positionId: string, px: number, at: number, reason: ExitReason) {
  const [r] = await tx`select * from positions where id = ${positionId} and account_id = ${accountId} and closed_at is null for update`;
  if (!r) return null;
  const p = toPosition(r);
  const liquidated = reason === "liquidation";
  const { fees, pnl, cashDelta } = closeOutcome(p, px, liquidated);
  const closedAt = new Date(at);
  await tx`update positions set exit_px = ${px}, closed_at = ${closedAt}, pnl = ${pnl}, fees = ${fees},
           liquidated = ${liquidated}, exit_reason = ${reason} where id = ${positionId}`;
  await tx`update sim_accounts set cash = cash + ${cashDelta} where id = ${accountId}`;
  await append(tx, accountId, liquidated ? "liquidate" : "close", {
    position_id: p.id,
    coin: p.coin,
    exit_px: px,
    closed_at: closedAt.toISOString(),
    pnl,
    fees,
    reason: liquidated ? undefined : reason,
  });
  return { ...p, exitPx: px, closedAt: at, pnl, fees, liquidated, exitReason: reason } satisfies ClosedTrade;
}

// ---------- orders ----------

export interface OrderInput {
  coin: string;
  side: Side;
  type: "market" | "limit";
  limitPx: number | null;
  sizeUsd: number;
  leverage: number;
  tpPx: number | null;
  slPx: number | null;
  strategy: Strategy;
  rationale: string;
}

const optPx = (v: unknown, label: string) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new LedgerError(`${label} must be a positive price`);
  return n;
};

export function parseOrder(body: unknown): OrderInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const coin = typeof b.coin === "string" ? b.coin : "";
  const side = b.side === "long" || b.side === "short" ? b.side : null;
  const type = b.type === "limit" ? "limit" : "market";
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
  const limitPx = type === "limit" ? optPx(b.limitPx, "Limit price") : null;
  if (type === "limit" && limitPx == null) throw new LedgerError("Enter a limit price");
  return {
    coin,
    side,
    type,
    limitPx,
    sizeUsd,
    leverage,
    tpPx: optPx(b.tpPx, "Take profit"),
    slPx: optPx(b.slPx, "Stop loss"),
    strategy,
    rationale,
  };
}

export async function placeOrder(userId: string, o: OrderInput): Promise<{ position?: Position; order?: Order }> {
  const acct = await activeAccount(userId);
  await sweep(acct.id, true);

  const [live, maxLev, minuteBars] = await Promise.all([
    mids(),
    maxLeverage(),
    recentMinuteBars(o.coin).catch(() => []),
  ]);
  const px = live[o.coin];
  if (!px || !(o.coin in maxLev)) throw new LedgerError("unknown market");
  const lev = Math.min(o.leverage, maxLev[o.coin], MAX_LEVERAGE);
  const features = computeFeatures(minuteBars.slice(-90), px);

  // A limit that is already through the market fills now, like on a real exchange
  const resting =
    o.type === "limit" && o.limitPx != null && (o.side === "long" ? o.limitPx < px : o.limitPx > px) ? o.limitPx : null;
  if (resting != null && Math.abs(resting / px - 1) > MAX_LIMIT_DISTANCE)
    throw new LedgerError("Limit price is too far from the market");
  const tpslError = checkTpSl(o.side, resting ?? px, o.tpPx, o.slPx, resting != null ? "limit price" : "entry price");
  if (tpslError) throw new LedgerError(tpslError);

  return db().begin(async (tx) => {
    const a = await lockAccount(tx, acct.id);
    const { free, openOrders } = await freeMargin(tx, acct.id, a.cash, live);
    const featuresJson = features ? tx.json(features as unknown as postgres.JSONValue) : null;

    if (resting != null) {
      if (openOrders >= MAX_OPEN_ORDERS) throw new LedgerError(`Up to ${MAX_OPEN_ORDERS} open orders`);
      if (reserved({ sizeUsd: o.sizeUsd, leverage: lev }) > free) throw new LedgerError("Not enough free margin");
      const [r] = await tx`
        insert into orders (account_id, coin, side, size_usd, leverage, limit_px, tp_px, sl_px, strategy, rationale, features)
        values (${acct.id}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${lev}, ${resting}, ${o.tpPx}, ${o.slPx}, ${o.strategy},
                ${o.rationale}, ${featuresJson})
        returning *`;
      const order = toOrder(r);
      await append(tx, acct.id, "order", {
        order_id: order.id,
        coin: order.coin,
        side: order.side,
        size_usd: order.sizeUsd,
        leverage: order.leverage,
        limit_px: order.limitPx,
        placed_at: new Date(order.placedAt).toISOString(),
        strategy: order.strategy,
        rationale_sha256: sha(order.rationale),
        features,
        tp_px: order.tpPx ?? undefined,
        sl_px: order.slPx ?? undefined,
      });
      return { order };
    }

    const fee = entryFee(o.sizeUsd);
    if (o.sizeUsd / lev + fee > free) throw new LedgerError("Not enough free margin");
    const [r] = await tx`
      insert into positions (account_id, coin, side, size_usd, leverage, entry_px, strategy, rationale, entry_features,
                             entry_fee, tp_px, sl_px)
      values (${acct.id}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${lev}, ${px}, ${o.strategy}, ${o.rationale}, ${featuresJson},
              ${fee}, ${o.tpPx}, ${o.slPx})
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
      rationale_sha256: sha(p.rationale),
      features,
      tp_px: p.tpPx ?? undefined,
      sl_px: p.slPx ?? undefined,
    });
    return { position: p };
  });
}

export async function cancelOrder(userId: string, orderId: string) {
  const acct = await activeAccount(userId);
  await sweep(acct.id, true);
  return db().begin(async (tx) => {
    await lockAccount(tx, acct.id);
    const [r] = await tx`update orders set status = 'cancelled', done_at = now()
                         where id = ${orderId} and account_id = ${acct.id} and status = 'open' returning *`;
    if (!r) throw new LedgerError("order is no longer open (it may have filled)", 404);
    await append(tx, acct.id, "cancel", { order_id: r.id, cancelled_at: new Date(ms(r.done_at)).toISOString() });
    return toOrder(r);
  });
}

export async function setTpSl(userId: string, positionId: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const tp = optPx(b.tpPx, "Take profit");
  const sl = optPx(b.slPx, "Stop loss");
  const acct = await activeAccount(userId);
  await sweep(acct.id, true);
  const [r] = await db()`select * from positions where id = ${positionId} and account_id = ${acct.id} and closed_at is null`;
  if (!r) throw new LedgerError("position is not open", 404);
  const px = (await mids())[r.coin];
  if (!px) throw new LedgerError("no price for this market right now", 503);
  const err = checkTpSl(r.side, px, tp, sl, "the current price");
  if (err) throw new LedgerError(err);
  return db().begin(async (tx) => {
    await lockAccount(tx, acct.id);
    const [u] = await tx`update positions set tp_px = ${tp}, sl_px = ${sl}
                         where id = ${positionId} and closed_at is null returning *`;
    if (!u) throw new LedgerError("position is not open", 404);
    await append(tx, acct.id, "tpsl", {
      position_id: positionId,
      tp_px: tp,
      sl_px: sl,
      set_at: new Date().toISOString(),
    });
    return toPosition(u);
  });
}

export async function closePosition(userId: string, positionId: string): Promise<ClosedTrade> {
  const acct = await activeAccount(userId);
  await sweep(acct.id, true);
  const [r] = await db()`select coin from positions where id = ${positionId} and account_id = ${acct.id} and closed_at is null`;
  if (!r) throw new LedgerError("position is not open (it may have hit a trigger)", 404);
  const px = (await mids())[r.coin];
  if (!px) throw new LedgerError("no price for this market right now", 503);
  const closed = await db().begin(async (tx) => {
    await lockAccount(tx, acct.id);
    return settle(tx, acct.id, positionId, px, Date.now(), "manual");
  });
  if (!closed) throw new LedgerError("position is not open", 404);
  return closed;
}

/** Archives the active account (its ledger is kept) and starts a fresh one. */
export async function resetAccount(userId: string) {
  await db()`update sim_accounts set archived_at = now() where user_id = ${userId} and archived_at is null`;
}
