import { NextRequest, NextResponse } from "next/server";
import { devLoginEnabled, startSession, upsertUser } from "@/server/auth";

/** Local development only: signs in as a fixed test user without GitHub. */
export async function GET(req: NextRequest) {
  if (!devLoginEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const userId = await upsertUser({ id: -1, login: "dev-trader", name: "Dev Trader", avatar_url: null });
  await startSession(userId);
  return NextResponse.redirect(new URL("/simulate", req.nextUrl.origin));
}
