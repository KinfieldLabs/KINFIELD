import { LedgerError, openPosition, parseOrder } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user, req) => {
  const body = await req.json().catch(() => {
    throw new LedgerError("invalid json");
  });
  return { position: await openPosition(user.id, parseOrder(body)) };
});
