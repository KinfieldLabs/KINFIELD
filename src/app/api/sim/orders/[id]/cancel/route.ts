import { idParam } from "@/server/ids";
import { cancelOrder } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user, _req, { params }: { params: Promise<{ id: string }> }) => ({
  order: await cancelOrder(user.id, await idParam(params, "order")),
}));
