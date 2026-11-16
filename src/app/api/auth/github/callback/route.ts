import { NextRequest, NextResponse } from "next/server";
import { githubProfile, startSession, upsertUser } from "@/server/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("kf_oauth_state")?.value;
  const back = (q = "") => {
    const res = NextResponse.redirect(new URL(`/simulate${q}`, req.nextUrl.origin));
    res.cookies.delete("kf_oauth_state");
    return res;
  };
  if (!code || !state || state !== expected) return back("?signin=failed");
  try {
    const userId = await upsertUser(await githubProfile(code));
    await startSession(userId);
    return back();
  } catch (e) {
    console.error("GitHub sign-in failed:", e);
    return back("?signin=failed");
  }
}
