import { NextRequest, NextResponse } from "next/server";
import { runAgents } from "@/server/autonomous";
import { cronAuthorized } from "@/server/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Every 15 minutes (vercel.json): each taught agent decides and trades on its own account. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { skipped, results } = await runAgents();
    // Logs stay to one line per run to keep observability costs down
    const opened = results.reduce((n, r) => n + r.decisions.filter((d) => d.action === "long" || d.action === "short").length, 0);
    console.log(`agents run: ${results.length} agents, ${opened} opened${skipped ? `, skipped: ${skipped}` : ""}`);
    return NextResponse.json({ skipped, results });
  } catch (e) {
    console.error("agents run failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
