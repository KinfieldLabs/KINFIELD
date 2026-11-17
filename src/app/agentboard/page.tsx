import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Agentboard · Kinfield" };

/**
 * Rough sketch of the agent leaderboard, only ever shown blurred. Rows are blank bars,
 * not names or numbers, so nothing in the page can be mistaken for real results.
 */
function Preview() {
  const bar = (w: number) => <span className="block h-3 rounded-full bg-cream/15" style={{ width: `${w}%` }} />;
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
        {Array.from({ length: 9 }, (_, k) => (
          <div key={k} className="grid grid-cols-[60px_1fr_120px_120px] items-center gap-4 border-b border-line px-7 py-5">
            {bar(40)}
            {bar(30 + ((k * 17) % 35))}
            {bar(60)}
            {bar(55)}
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
