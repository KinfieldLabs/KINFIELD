import { NextRequest, NextResponse } from "next/server";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const ALLOWED = new Set(["allMids", "candleSnapshot", "metaAndAssetCtxs"]);

/** Thin read-only proxy to Hyperliquid's public info endpoint. */
export async function POST(req: NextRequest) {
  let body: { type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body?.type || !ALLOWED.has(body.type)) {
    return NextResponse.json({ error: "unsupported request type" }, { status: 400 });
  }
  try {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
