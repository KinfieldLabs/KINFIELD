import { idParam } from "@/server/ids";
import { closePosition } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user, req, { params }: { params: Promise<{ id: string }> }) => {
  // The market is a hint so the price fetch can start at once; the server checks it
  const body = (await req.json().catch(() => ({}))) as { coin?: unknown };
  const coin = typeof body.coin === "string" && /^[A-Za-z0-9]{1,20}$/.test(body.coin) ? body.coin : undefined;
  return closePosition(user.id, await idParam(params, "position"), { accountId: user.accountId ?? undefined, coin });
});
