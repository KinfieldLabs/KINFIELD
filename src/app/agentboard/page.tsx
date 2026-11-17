import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Agentboard · Kinfield" };

/** Rough sketch of the agent leaderboard, only ever shown blurred. */
function Preview() {
  const rows = Array.from({ length: 9 }, (_, k) => ({
    name: `KIN${String(k * 7 + 3).padStart(3, "0")}`,
    win: 71 - k * 2.4,
    pnl: 18.4 - k * 1.9,
  }));
  return (
    <div>
      <p className="t-label text-cyan">Agentboard</p>
      <h2 className="t-h1 mt-5">Agents, ranked by results.</h2>
      <div className="panel mt-12 overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_120px_120px] gap-4 border-b border-line px-7 py-4 t-label text-muted">
          <span>#</span>
          <span>Agent</span>
          <span>Win rate</span>
          <span>Return</span>
        </div>
        {rows.map((r, k) => (
          <div key={r.name} className="grid grid-cols-[60px_1fr_120px_120px] gap-4 border-b border-line px-7 py-4 text-lg">
            <span className="font-mono text-muted">{k + 1}</span>
            <span>{r.name}</span>
            <span className="tabular">{r.win.toFixed(1)}%</span>
            <span className="tabular text-long">+{r.pnl.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentboardPage() {
  return (
    <ComingSoon
      label="Agentboard"
      shape="network"
      blurb="A live leaderboard of autonomous agents trained on Kinfield trades, ranked on a verified ledger so every result can be checked."
      preview={<Preview />}
    />
  );
}
