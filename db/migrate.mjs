/**
 * Applies db/migrations/*.sql in order, once each.
 *   DATABASE_URL=postgres://... node db/migrate.mjs     (or: npm run db:migrate)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql`select name from _migrations`).map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(join(dir, file), "utf8"));
    await tx`insert into _migrations (name) values (${file})`;
  });
  console.log("applied", file);
}
await sql.end();
