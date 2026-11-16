import { timingSafeEqual } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { publishDataset } from "@/server/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Constant-time check of the cron secret Vercel sends as a bearer token. */
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Nightly publish of the open dataset (scheduled in vercel.json).
 * Locally, ?dry=1 writes the dataset to a folder instead of GitHub.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (dry && process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "dry runs are for local development" }, { status: 400 });
  try {
    const result = await publishDataset(
      dry ? { dryRunDir: process.env.DATASET_OUT_DIR || join(tmpdir(), "kinfield-dataset") } : {},
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("dataset publish failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
