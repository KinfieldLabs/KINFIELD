import { LedgerError, parseOrder, placeOrder } from "@/server/ledger";
import { checkTradeRate } from "@/server/limits";
import { authed } from "@/server/route";

export const POST = authed(async (user, req) => {
  const body = await req.json().catch(() => {
    throw new LedgerError("invalid json");
  });
  await checkTradeRate(user.accountId);
  return placeOrder(user.id, parseOrder(body), { accountId: user.accountId ?? undefined });
});
