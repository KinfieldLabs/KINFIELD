import postgres from "postgres";

declare global {
  var __kfSql: postgres.Sql | undefined;
}

/** True when a database is configured; without one the simulator runs in guest mode only. */
export const hasDb = () => !!process.env.DATABASE_URL;

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // No prepared statements: a migration that adds columns would otherwise break queries on
  // connections that are already open ("cached plan must not change result type"), and
  // connection poolers such as PgBouncer need this too.
  return postgres(url, { max: 5, idle_timeout: 20, prepare: false, onnotice: () => {} });
}

/** Shared connection pool (reused across hot reloads in dev). */
export function db(): postgres.Sql {
  if (!globalThis.__kfSql) globalThis.__kfSql = connect();
  return globalThis.__kfSql;
}
