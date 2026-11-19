import { NextResponse } from "next/server";
import { agentProfile } from "@/server/agentboard";

export const dynamic = "force-dynamic";

/** One shared agent's public record: stats, readiness, equity, trades and ledger head. */
export async function GET(_req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  try {
    const profile = await agentProfile(agent.toUpperCase());
    if (!profile) return NextResponse.json({ error: "No shared agent with that name" }, { status: 404 });
    return NextResponse.json(profile, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
