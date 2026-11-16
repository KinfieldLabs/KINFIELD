import { NextResponse } from "next/server";
import { currentUser, devLoginEnabled, githubEnabled } from "@/server/auth";
import { hasDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    user: user && { login: user.login, name: user.name, avatarUrl: user.avatarUrl },
    signIn: { available: hasDb() && (githubEnabled() || devLoginEnabled()), github: githubEnabled(), dev: devLoginEnabled() },
  });
}
