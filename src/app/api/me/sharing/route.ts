import { setSharing } from "@/server/auth";
import { LedgerError } from "@/server/ledger";
import { authed } from "@/server/route";

const flag = (v: unknown) => (typeof v === "boolean" ? v : undefined);

/** The user's choices for the open dataset. */
export const POST = authed(async (user, req) => {
  const body = (await req.json().catch(() => {
    throw new LedgerError("invalid json");
  })) as Record<string, unknown>;
  await setSharing(user.id, {
    publishData: flag(body.publishData),
    showLogin: flag(body.showLogin),
    publishRationale: flag(body.publishRationale),
  });
  return { ok: true };
});
