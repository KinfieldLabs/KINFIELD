import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { AgentDashboard } from "@/components/agent/AgentDashboard";

export const metadata: Metadata = pageMeta(
  "/agent",
  "Your agent · Kinfield",
  "Your experimental Kinfield agent: what it has learned from your simulated trades, its own trades and its track record.",
);

export default function AgentPage() {
  return <AgentDashboard />;
}
