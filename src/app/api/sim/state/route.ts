import { getState } from "@/server/ledger";
import { authed } from "@/server/route";

export const dynamic = "force-dynamic";

export const GET = authed(async (user) => getState(user.id));
