import { resetAccount } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user) => {
  await resetAccount(user.id);
  return { ok: true };
});
