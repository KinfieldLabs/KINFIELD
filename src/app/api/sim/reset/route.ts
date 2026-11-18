import { resetAccount } from "@/server/ledger";
import { checkResetRate } from "@/server/limits";
import { authed } from "@/server/route";

export const POST = authed(async (user) => {
  await checkResetRate(user.id);
  await resetAccount(user.id);
  return { ok: true };
});
