import { closePosition, LedgerError } from "@/server/ledger";
import { authed } from "@/server/route";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = authed(async (user, _req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!UUID.test(id)) throw new LedgerError("position is not open", 404);
  return { trade: await closePosition(user.id, id) };
});
