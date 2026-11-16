import { NextRequest, NextResponse } from "next/server";
import { currentUser, type User } from "./auth";
import { LedgerError } from "./ledger";

/**
 * Wraps a signed-in API handler: requires a session, rejects cross-site writes,
 * and turns ledger errors into JSON responses.
 */
export function authed<C>(handler: (user: User, req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C) => {
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: "cross-site request" }, { status: 403 });
    }
    const started = performance.now();
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    try {
      const result = await handler(user, req, ctx);
      // Server time for the whole request, so the terminal can show how long a fill took here
      const serverMs = Math.round(performance.now() - started);
      if (result && typeof result === "object" && "timing" in result)
        (result as { timing: Record<string, number> }).timing.serverMs = serverMs;
      return NextResponse.json(result, { headers: { "server-timing": `app;dur=${serverMs}` } });
    } catch (e) {
      if (e instanceof LedgerError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
