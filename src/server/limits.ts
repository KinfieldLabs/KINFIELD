import { db } from "./db";
import { LedgerError } from "./ledger";

/**
 * Rate limits, so one account can't flood the ledger or the server.
 *
 * Trades and resets are counted from the rows they already leave in the database, so the
 * limits hold across every server instance without a table of their own. Short bursts are
 * counted in memory: each instance keeps its own window, which is enough to stop a loop
 * from hammering the API.
 */

/**
 * Ledger entries one account may record, checked before each new order. Far above what a
 * person clicks. Closing is never blocked: closes can only follow opens, so they are bounded already.
 */
export const TRADE_LIMITS = [
  { count: 30, ms: 60_000, label: "a minute" },
  { count: 1000, ms: 86_400_000, label: "a day" },
] as const;

/** Times a person may reset their account in a day. */
export const RESET_LIMIT = 10;

const tooMany = (what: string) => new LedgerError(`${what} Try again later.`, 429);

/**
 * Refuses a new trade when the account's last N ledger entries all fall inside the window.
 * Reads one row per limit by walking the account's ledger index from the newest entry.
 */
export async function checkTradeRate(accountId: string | null | undefined) {
  if (!accountId) return;
  for (const l of TRADE_LIMITS) {
    const [row] = await db()`
      select created_at from ledger where account_id = ${accountId}
      order by seq desc offset ${l.count - 1} limit 1`;
    if (row && Date.now() - new Date(row.created_at).getTime() < l.ms)
      throw tooMany(`That's ${l.count} trades in under ${l.label}, the most one account can record.`);
  }
}

/** Refuses a reset when the person has already archived RESET_LIMIT accounts today. */
export async function checkResetRate(userId: string) {
  const [row] = await db()`
    select count(*)::int as n from sim_accounts
    where user_id = ${userId} and kind = 'human' and archived_at > now() - interval '1 day'`;
  if (row.n >= RESET_LIMIT) throw tooMany(`Accounts can be reset ${RESET_LIMIT} times a day.`);
}

/** Recent request times per key, for the in-memory burst limit. */
const recent = new Map<string, number[]>();

/**
 * True when `key` has made `count` requests within `ms`, and records this one otherwise.
 * Old keys are dropped as the map grows, so memory stays bounded.
 */
export function burst(key: string, count: number, ms: number): boolean {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < ms);
  if (times.length >= count) {
    recent.set(key, times);
    return true;
  }
  times.push(now);
  recent.set(key, times);
  if (recent.size > 5000) {
    for (const [k, v] of recent) if (!v.length || now - v[v.length - 1] > ms) recent.delete(k);
  }
  return false;
}

/** The caller's address as Vercel reports it, for limits on routes that don't need a sign-in. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
