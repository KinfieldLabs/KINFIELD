import { NextResponse } from "next/server";
import { db, hasDb } from "@/server/db";
import { fillPrice } from "@/server/market";

export const dynamic = "force-dynamic";

let cached: { at: number; body: unknown } | null = null;

/**
 * Where the server runs and how far it is from its database and from Hyperliquid, in
 * milliseconds. Measured at most every 15 seconds per server instance.
 */
export async function GET() {
  if (cached && Date.now() - cached.at < 15_000) return NextResponse.json(cached.body);
  const time = async (fn: () => Promise<unknown>) => {
    const t = performance.now();
    await fn();
    return Math.round((performance.now() - t) * 10) / 10;
  };
  const dbMs: number[] = [];
  if (hasDb()) for (let i = 0; i < 3; i++) dbMs.push(await time(() => db()`select 1`));
  const hyperliquidMs = [await time(() => fillPrice("BTC")), await time(() => fillPrice("BTC"))];
  const body = { region: process.env.VERCEL_REGION ?? "local", dbMs, hyperliquidMs };
  cached = { at: Date.now(), body };
  return NextResponse.json(body);
}
