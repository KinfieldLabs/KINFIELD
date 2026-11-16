import { db } from "@/server/db";
import { LedgerError } from "@/server/ledger";
import { authed } from "@/server/route";

/** Pause or resume the apprentice trading on its own. Open positions keep their stops. */
export const POST = authed(async (user, req) => {
  const body = (await req.json().catch(() => ({}))) as { paused?: unknown };
  if (typeof body.paused !== "boolean") throw new LedgerError("paused must be true or false");
  await db()`insert into agents (user_id, paused) values (${user.id}, ${body.paused})
             on conflict (user_id) do update set paused = excluded.paused`;
  return { paused: body.paused };
});
