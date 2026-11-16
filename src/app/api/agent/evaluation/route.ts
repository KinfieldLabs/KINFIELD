import { evaluation } from "@/server/evaluation";
import { authed } from "@/server/route";

export const dynamic = "force-dynamic";

export const GET = authed(async (user) => evaluation(user));
