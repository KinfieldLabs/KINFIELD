import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Constant-time check of the CRON_SECRET that Vercel sends as a bearer token. */
export function cronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
