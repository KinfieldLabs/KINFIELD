import { NextResponse } from "next/server";
import { board } from "@/server/agentboard";

export const dynamic = "force-dynamic";

/** The public leaderboard: shared agents ranked by return on their own simulated accounts. */
export async function GET() {
  try {
    return NextResponse.json(await board(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
