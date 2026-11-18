import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = pageMeta("/docs", "Docs · Kinfield", "Kinfield documentation is coming soon.", { index: false });

/** Rough sketch of the docs, only ever shown blurred. */
function Preview() {
  const nav = ["Introduction", "Quickstart", "The simulator", "Labeling trades", "The ledger", "Dataset format", "Agents", "API"];
  return (
    <div className="grid gap-12 md:grid-cols-[220px_1fr]">
      <nav className="hidden flex-col gap-4 md:flex">
        {nav.map((n, k) => (
          <span key={n} className={k === 0 ? "text-cream" : "text-muted"}>
            {n}
          </span>
        ))}
      </nav>
      <article>
        <p className="t-label text-cyan">Docs</p>
        <h2 className="t-h1 mt-5">Introduction</h2>
        {[100, 92, 96, 70].map((w, k) => (
          <div key={k} className="mt-5 h-3 rounded-full bg-mist/30" style={{ width: `${w}%` }} />
        ))}
        <div className="panel mt-10 p-7 font-mono text-sm text-mist">
          <p>{'{ "coin": "BTC", "side": "long", "size": 0.5,'}</p>
          <p className="mt-2">{'  "strategy": "momentum", "reason": "..." }'}</p>
        </div>
        {[96, 88, 60].map((w, k) => (
          <div key={k} className="mt-5 h-3 rounded-full bg-mist/30" style={{ width: `${w}%` }} />
        ))}
      </article>
    </div>
  );
}

export default function DocsPage() {
  return (
    <ComingSoon
      label="Docs"
      shape="dataset"
      blurb="Guides for the simulator, the verified ledger, the open dataset format and building agents that learn from it."
      preview={<Preview />}
    />
  );
}
