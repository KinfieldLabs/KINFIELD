import { NextResponse } from "next/server";
import { currentUser, devLoginEnabled, githubEnabled } from "@/server/auth";
import { DATASET_REPO } from "@/server/dataset";
import { hasDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    user: user && {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      sharing: {
        agentId: user.agentId,
        decided: user.sharingDecided,
        publishData: user.sharingDecided && user.publishData,
        showLogin: user.showLogin,
        publishRationale: user.publishRationale,
        repo: DATASET_REPO,
      },
    },
    signIn: { available: hasDb() && (githubEnabled() || devLoginEnabled()), github: githubEnabled(), dev: devLoginEnabled() },
  });
}
