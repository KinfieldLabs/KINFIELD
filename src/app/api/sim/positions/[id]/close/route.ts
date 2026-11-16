import { idParam } from "@/server/ids";
import { closePosition } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user, _req, { params }: { params: Promise<{ id: string }> }) => ({
  trade: await closePosition(user.id, await idParam(params, "position")),
}));
