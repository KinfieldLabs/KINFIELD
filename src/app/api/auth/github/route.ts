import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { githubEnabled } from "@/server/auth";

/** Sends the visitor to GitHub to sign in. Only their public profile is requested. */
export async function GET(req: NextRequest) {
  if (!githubEnabled()) return NextResponse.json({ error: "GitHub sign-in is not configured" }, { status: 503 });
  const state = randomBytes(16).toString("base64url");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", new URL("/api/auth/github/callback", req.nextUrl.origin).toString());
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  const res = NextResponse.redirect(url);
  res.cookies.set("kf_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
