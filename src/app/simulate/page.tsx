import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { Terminal } from "@/components/sim/Terminal";

export const metadata: Metadata = pageMeta(
  "/simulate",
  "Kinfield Simulator",
  "A paper trading terminal on live Hyperliquid prices: every perp, charts, indicators and drawing tools. No wallet and no real funds.",
);

export default function SimulatePage() {
  return <Terminal />;
}
