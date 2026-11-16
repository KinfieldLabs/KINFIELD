import { idParam } from "@/server/ids";
import { LedgerError, setTpSl } from "@/server/ledger";
import { authed } from "@/server/route";

export const POST = authed(async (user, req, { params }: { params: Promise<{ id: string }> }) => {
  const body = await req.json().catch(() => {
    throw new LedgerError("invalid json");
  });
  return { position: await setTpSl(user.id, await idParam(params, "position"), body) };
});
