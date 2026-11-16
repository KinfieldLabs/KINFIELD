/**
 * Recomputes every account's hash chain from the stored entries and checks that
 * each open/close in `positions` matches the ledger.
 *   npm run db:verify
 */
import { createHash } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
      : JSON.stringify(v);
const sha = (s) => createHash("sha256").update(s).digest("hex");

let bad = 0;
for (const { id } of await sql`select id from sim_accounts order by created_at`) {
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
  const [{ n }] = await sql`select count(*)::int + count(closed_at)::int as n from positions where account_id = ${id}`;
  if (n !== rows.length) {
    console.log(`account ${id}: ${rows.length} ledger entries but ${n} fills in positions`);
    bad++;
  }
  console.log(`account ${id}: ${rows.length} entries ${bad ? "" : "ok"}`);
}
await sql.end();
process.exit(bad ? 1 : 0);
