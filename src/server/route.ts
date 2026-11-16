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
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    try {
      return NextResponse.json(await handler(user, req, ctx));
    } catch (e) {
      if (e instanceof LedgerError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
