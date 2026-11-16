import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { computeFeatures } from "@/lib/features";
import {
  checkTpSl,
  closeOutcome,
  entryFee,
  MAKER_FEE,
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
import { closedBarsSince, fillPrice, maxLeverage, mids, minuteBars, type Bar } from "./market";

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

/**
 * Commitment to a trade's written reason: sha256(salt + "\n" + reason) with a random
 * salt. A plain hash of a short reason could be guessed from common phrases; this one
 * can't, and publishing the reason with its salt lets anyone check it.
 */
export const reasonCommitment = (salt: string, reason: string) => sha(`${salt}\n${reason}`);
const newSalt = () => randomBytes(16).toString("hex");

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
    agentP: r.agent_p ?? null,
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

/** "human": the person's own account. "agent": the account their apprentice trades on its own. */
export type AccountKind = "human" | "agent";

export async function activeAccount(userId: string, kind: AccountKind = "human"): Promise<Row> {
  const sql = db();
  const find = () => sql`select * from sim_accounts where user_id = ${userId} and kind = ${kind} and archived_at is null`;
  const [a] = await find();
  if (a) return a;
  const [created] = await sql`
    insert into sim_accounts (user_id, kind, starting_balance, cash)
    values (${userId}, ${kind}, ${STARTING_BALANCE}, ${STARTING_BALANCE})
    on conflict do nothing returning *`;
  if (created) return created;
  const [again] = await find();
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
export async function sweep(accountId: string, force = false) {
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

  // All checkpoints in at most two statements
  const marks = (table: "positions" | "orders") =>
    checked.filter((c) => c.table === table).map((c) => ({ id: c.id, at: new Date(c.at).toISOString() }));
  const posMarks = marks("positions");
  const orderMarks = marks("orders");
  await Promise.all([
    posMarks.length &&
      sql`update positions p set liq_checked_at = u.at
          from jsonb_to_recordset(${sql.json(posMarks)}::jsonb) as u(id uuid, at timestamptz)
          where p.id = u.id and p.closed_at is null`,
    orderMarks.length &&
      sql`update orders o set checked_at = u.at
          from jsonb_to_recordset(${sql.json(orderMarks)}::jsonb) as u(id uuid, at timestamptz)
          where o.id = u.id and o.status = 'open'`,
  ]);
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
                           rationale_salt, entry_features, entry_fee, tp_px, sl_px, order_id, liq_checked_at)
    values (${accountId}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${o.leverage}, ${o.limitPx}, ${openedAt}, ${o.strategy},
            ${o.rationale}, ${r.rationale_salt}, ${r.features ? tx.json(r.features) : null}, ${fee}, ${o.tpPx},
            ${o.slPx}, ${o.id},
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

/**
 * Closes a position: updates it, credits the cash and appends the ledger entry in one
 * statement. `prev` is the account's current ledger head (the account must be locked).
 */
async function writeClose(tx: Tx, accountId: string, r: Row, exit: Exit, prev: string) {
  const p = toPosition(r);
  const liquidated = exit.reason === "liquidation";
  const { fees, pnl, cashDelta } = closeOutcome(p, exit.px, liquidated);
  const closedAt = new Date(exit.at);
  const kind: Kind = liquidated ? "liquidate" : "close";
  const payload = {
    position_id: p.id,
    coin: p.coin,
    exit_px: exit.px,
    closed_at: closedAt.toISOString(),
    pnl,
    fees,
    reason: liquidated ? undefined : exit.reason,
  };
  const hash = chainHash(prev, kind, payload);
  const [w] = await tx`
    with pos as (
      update positions set exit_px = ${exit.px}, closed_at = ${closedAt}, pnl = ${pnl}, fees = ${fees},
                           liquidated = ${liquidated}, exit_reason = ${exit.reason}
      where id = ${p.id} and closed_at is null
      returning id),
    acct as (
      update sim_accounts set cash = cash + ${cashDelta}
      where id = ${accountId} and exists (select 1 from pos)
      returning cash),
    led as (
      insert into ledger (account_id, kind, payload, prev_hash, hash)
      select ${accountId}::uuid, ${kind}::text, ${tx.json(payload as postgres.JSONValue)}::jsonb, ${prev}::text, ${hash}::text
      from pos
      returning 1)
    select (select cash from acct) as cash, (select count(*) from pos)::int as n`;
  if (!w?.n) return null;
  const trade: ClosedTrade = { ...p, exitPx: exit.px, closedAt: exit.at, pnl, fees, liquidated, exitReason: exit.reason };
  return { trade, cash: w.cash as number, head: hash };
}

const headOf = (tx: Tx, accountId: string) =>
  tx`select hash from ledger where account_id = ${accountId} order by seq desc limit 1`.then(([h]) => h?.hash ?? genesis(accountId));

async function settle(tx: Tx, accountId: string, positionId: string, px: number, at: number, reason: ExitReason) {
  const [r] = await tx`select * from positions where id = ${positionId} and account_id = ${accountId} and closed_at is null`;
  if (!r) return null;
  return (await writeClose(tx, accountId, r, { px, at, reason }, await headOf(tx, accountId)))?.trade ?? null;
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

export interface PlaceResult {
  position?: Position;
  order?: Order;
  /** Account cash after the order (fees taken). */
  cash: number;
  /** The market price the order met and Hyperliquid's time for it. */
  fill: { px: number; at: number };
  timing: { priceMs: number };
}

/**
 * Places an order. Speed matters here: the fill price is fetched for this one market the
 * moment the order arrives, while the account is looked up, locked and read in parallel, and
 * the position, cash and ledger entry are then written in a single statement. The order fills
 * at the market price when it reached us, not at the end of the processing.
 */
export async function placeOrder(
  userId: string,
  o: OrderInput,
  opts: { kind?: AccountKind; agentP?: number; accountId?: string } = {},
): Promise<PlaceResult> {
  const started = performance.now();
  const priceP = fillPrice(o.coin).then((r) => ({ ...r, ms: performance.now() - started }));
  // Leverage limits and recent candles (for the market context stored with the trade) can be a
  // little old; other markets' prices are only needed to value other open positions
  const marketP = Promise.all([maxLeverage(), minuteBars(o.coin, Date.now() - 95 * 60_000, 60_000).catch(() => [])]);
  const midsP = mids(30_000);
  priceP.catch(() => {});
  marketP.catch(() => {});
  midsP.catch(() => {});

  const accountId = opts.accountId ?? (await activeAccount(userId, opts.kind ?? "human")).id;
  const salt = newSalt();

  return db().begin(async (tx) => {
    const a = await lockAccount(tx, accountId);
    const [snap] = await tx`
      select
        coalesce((select json_agg(json_build_object('coin', coin, 'side', side, 'size_usd', size_usd,
                                                    'leverage', leverage, 'entry_px', entry_px))
                  from positions where account_id = ${accountId} and closed_at is null), '[]'::json) as open,
        coalesce((select json_agg(json_build_object('size_usd', size_usd, 'leverage', leverage))
                  from orders where account_id = ${accountId} and status = 'open'), '[]'::json) as resting,
        (select hash from ledger where account_id = ${accountId} order by seq desc limit 1) as head`;

    const [priceR, marketR] = await Promise.allSettled([priceP, marketP]);
    if (marketR.status === "rejected") throw new LedgerError("Market data is unavailable right now. Try again.", 503);
    const [maxLev, bars] = marketR.value;
    if (!(o.coin in maxLev)) throw new LedgerError("unknown market");
    if (priceR.status === "rejected") throw new LedgerError("No price for this market right now. Try again.", 503);
    const { px, at, ms: priceMs } = priceR.value;
    const fill = { px, at };
    const timing = { priceMs: Math.round(priceMs) };

    const lev = Math.min(o.leverage, maxLev[o.coin], MAX_LEVERAGE);
    const features = computeFeatures(bars.slice(-90), px);
    // A limit that is already through the market fills now, like on a real exchange
    const resting =
      o.type === "limit" && o.limitPx != null && (o.side === "long" ? o.limitPx < px : o.limitPx > px) ? o.limitPx : null;
    if (resting != null && Math.abs(resting / px - 1) > MAX_LIMIT_DISTANCE)
      throw new LedgerError("Limit price is too far from the market");
    const tpslError = checkTpSl(o.side, resting ?? px, o.tpPx, o.slPx, resting != null ? "limit price" : "entry price");
    if (tpslError) throw new LedgerError(tpslError);

    // Free margin: equity minus margin in use and margin held for resting orders
    const open = snap.open as { coin: string; side: Side; size_usd: number; leverage: number; entry_px: number }[];
    const others = open.some((p) => p.coin !== o.coin) ? await midsP.catch(() => ({}) as Record<string, number>) : {};
    const prices: Record<string, number> = { ...others, [o.coin]: px };
    const held = (snap.resting as { size_usd: number; leverage: number }[]).reduce(
      (s, r) => s + reserved({ sizeUsd: r.size_usd, leverage: r.leverage }),
      0,
    );
    const upnl = open.reduce(
      (s, p) =>
        s + (prices[p.coin] ? unrealized({ side: p.side, sizeUsd: p.size_usd, entryPx: p.entry_px } as Position, prices[p.coin]) : 0),
      0,
    );
    const free = a.cash + upnl - open.reduce((s, p) => s + p.size_usd / p.leverage, 0) - held;
    const prev: string = snap.head ?? genesis(accountId);
    const featuresJson = features ? tx.json(features as unknown as postgres.JSONValue) : null;

    if (resting != null) {
      if ((snap.resting as unknown[]).length >= MAX_OPEN_ORDERS) throw new LedgerError(`Up to ${MAX_OPEN_ORDERS} open orders`);
      if (reserved({ sizeUsd: o.sizeUsd, leverage: lev }) > free) throw new LedgerError("Not enough free margin");
      const id = randomUUID();
      const placedAt = new Date();
      const payload = {
        order_id: id,
        coin: o.coin,
        side: o.side,
        size_usd: o.sizeUsd,
        leverage: lev,
        limit_px: resting,
        placed_at: placedAt.toISOString(),
        strategy: o.strategy,
        rationale_commitment: reasonCommitment(salt, o.rationale),
        features,
        tp_px: o.tpPx ?? undefined,
        sl_px: o.slPx ?? undefined,
      };
      const hash = chainHash(prev, "order", payload);
      const [r] = await tx`
        with ins as (
          insert into orders (id, account_id, coin, side, size_usd, leverage, limit_px, tp_px, sl_px, strategy, rationale,
                              rationale_salt, features, placed_at, checked_at)
          values (${id}, ${accountId}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${lev}, ${resting}, ${o.tpPx}, ${o.slPx},
                  ${o.strategy}, ${o.rationale}, ${salt}, ${featuresJson}, ${placedAt}, ${placedAt})
          returning *),
        led as (
          insert into ledger (account_id, kind, payload, prev_hash, hash)
          values (${accountId}, 'order', ${tx.json(payload as postgres.JSONValue)}, ${prev}, ${hash})
          returning 1)
        select ins.* from ins, led`;
      return { order: toOrder(r), cash: a.cash, fill, timing };
    }

    const fee = entryFee(o.sizeUsd);
    if (o.sizeUsd / lev + fee > free) throw new LedgerError("Not enough free margin");
    const id = randomUUID();
    const openedAt = new Date(at); // Hyperliquid's time for the price this order met
    const payload = {
      position_id: id,
      coin: o.coin,
      side: o.side,
      size_usd: o.sizeUsd,
      leverage: lev,
      entry_px: px,
      opened_at: openedAt.toISOString(),
      strategy: o.strategy,
      rationale_commitment: reasonCommitment(salt, o.rationale),
      features,
      tp_px: o.tpPx ?? undefined,
      sl_px: o.slPx ?? undefined,
      agent_p: opts.agentP,
    };
    const hash = chainHash(prev, "open", payload);
    const [r] = await tx`
      with pos as (
        insert into positions (id, account_id, coin, side, size_usd, leverage, entry_px, opened_at, strategy, rationale,
                               rationale_salt, entry_features, entry_fee, tp_px, sl_px, agent_p)
        values (${id}, ${accountId}, ${o.coin}, ${o.side}, ${o.sizeUsd}, ${lev}, ${px}, ${openedAt}, ${o.strategy},
                ${o.rationale}, ${salt}, ${featuresJson}, ${fee}, ${o.tpPx}, ${o.slPx}, ${opts.agentP ?? null})
        returning *),
      acct as (update sim_accounts set cash = cash - ${fee} where id = ${accountId} returning cash),
      led as (
        insert into ledger (account_id, kind, payload, prev_hash, hash)
        values (${accountId}, 'open', ${tx.json(payload as postgres.JSONValue)}, ${prev}, ${hash})
        returning 1)
      select pos.*, acct.cash as account_cash from pos, acct, led`;
    return { position: toPosition(r), cash: r.account_cash, fill, timing };
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

export interface CloseResult {
  trade: ClosedTrade;
  cash: number;
  /** True when it had already hit its stop, target or liquidation and closed there. */
  triggered: boolean;
  timing: { priceMs: number };
}

/**
 * Closes a position at the market price when the request arrives. Before that, the price
 * history since it was last checked is replayed for this one position: if it already went
 * through its stop loss, take profit or liquidation, it closes there instead, so a stop
 * can't be dodged by closing by hand. `coin` lets the price fetch start straight away; it is
 * checked against the position.
 */
export async function closePosition(
  userId: string,
  positionId: string,
  opts: { kind?: AccountKind; reason?: "manual" | "time_stop"; accountId?: string; coin?: string } = {},
): Promise<CloseResult> {
  const started = performance.now();
  const timedPrice = (coin: string) => fillPrice(coin).then((r) => ({ ...r, ms: performance.now() - started }));
  let priceP = opts.coin ? timedPrice(opts.coin) : null;
  priceP?.catch(() => {});
  const accountId = opts.accountId ?? (await activeAccount(userId, opts.kind ?? "human")).id;

  return db().begin(async (tx) => {
    await lockAccount(tx, accountId);
    const [r] = await tx`
      select p.*, (select hash from ledger where account_id = ${accountId} order by seq desc limit 1) as head
      from positions p where p.id = ${positionId} and p.account_id = ${accountId} and p.closed_at is null`;
    if (!r) throw new LedgerError("position is not open (it may have hit a trigger)", 404);
    if (!priceP || opts.coin !== r.coin) priceP = timedPrice(r.coin);

    const p = toPosition(r);
    const from = checkpoint(r);
    const [priceR, barsR] = await Promise.allSettled([priceP, closedBarsSince(p.coin, from)]);
    if (priceR.status === "rejected") throw new LedgerError("No price for this market right now. Try again.", 503);
    const { px, at, ms: priceMs } = priceR.value;
    const past = barsR.status === "fulfilled" ? firstExit(p, barsR.value, from, Date.now()) : null;
    const liveHit = past ? null : triggerHit(p, px, px);
    const exit: Exit = past ?? (liveHit ? { ...liveHit, at } : { px, at, reason: opts.reason ?? "manual" });
    const res = await writeClose(tx, accountId, r, exit, r.head ?? genesis(accountId));
    if (!res) throw new LedgerError("position is not open", 404);
    return { trade: res.trade, cash: res.cash, triggered: !!(past || liveHit), timing: { priceMs: Math.round(priceMs) } };
  });
}

/** Archives the person's active account (its ledger is kept) and starts a fresh one. */
export async function resetAccount(userId: string) {
  await db()`update sim_accounts set archived_at = now() where user_id = ${userId} and kind = 'human' and archived_at is null`;
}
