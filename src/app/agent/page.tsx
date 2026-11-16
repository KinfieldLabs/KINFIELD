import type { Metadata } from "next";
import { AgentDashboard } from "@/components/agent/AgentDashboard";

export const metadata: Metadata = { title: "Your agent · Kinfield" };

export default function AgentPage() {
  return <AgentDashboard />;
}
