import { deleteAccount } from "@/server/auth";
import { LedgerError } from "@/server/ledger";
import { authed } from "@/server/route";

/** Deletes the signed-in account. The body must repeat the username, as a guard against stray requests. */
export const POST = authed(async (user, req) => {
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (typeof body.confirm !== "string" || body.confirm.trim().toLowerCase() !== user.login.toLowerCase())
    throw new LedgerError("Type your GitHub username to confirm");
  await deleteAccount(user.id);
  return { ok: true };
});
