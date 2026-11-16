/**
 * Recomputes every account's hash chain from the stored entries and checks that
 * every fill, close, order and cancel in the tables has a matching ledger entry.
 *   npm run db:verify
 */
import { createHash } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined)
          .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
const sha = (s) => createHash("sha256").update(s).digest("hex");

let bad = 0;
for (const { id } of await sql`select id from sim_accounts order by created_at`) {
  const before = bad;
  let prev = sha(`kinfield:${id}`);
  const rows = await sql`select * from ledger where account_id = ${id} order by seq`;
  for (const r of rows) {
    const h = sha(`${prev}\n${r.kind}\n${canonical(r.payload)}`);
    if (r.prev_hash !== prev || r.hash !== h) {
      console.log(`account ${id}: chain broken at seq ${r.seq}`);
      bad++;
      break;
    }
    prev = h;
  }

  const kinds = {};
  for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  const [c] = await sql`
    select (select count(*)::int from positions where account_id = ${id}) as opened,
           (select count(*)::int from positions where account_id = ${id} and closed_at is not null) as closed,
           (select count(*)::int from orders where account_id = ${id}) as orders,
           (select count(*)::int from orders where account_id = ${id} and status = 'cancelled') as cancelled`;
  const checks = [
    ["opens", kinds.open ?? 0, c.opened],
    ["closes", (kinds.close ?? 0) + (kinds.liquidate ?? 0), c.closed],
    ["orders", kinds.order ?? 0, c.orders],
    ["cancels", kinds.cancel ?? 0, c.cancelled],
  ];
  for (const [what, inLedger, inTables] of checks)
    if (inLedger !== inTables) {
      console.log(`account ${id}: ${inLedger} ${what} in the ledger but ${inTables} in the tables`);
      bad++;
    }
  console.log(`account ${id}: ${rows.length} entries ${bad === before ? "ok" : "FAILED"}`);
}
await sql.end();
process.exit(bad ? 1 : 0);
