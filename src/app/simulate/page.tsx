import type { Metadata } from "next";
import { Terminal } from "@/components/sim/Terminal";

export const metadata: Metadata = { title: "Kinfield Simulator" };

export default function SimulatePage() {
  return <Terminal />;
}
