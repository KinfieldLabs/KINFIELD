import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = pageMeta("/campaign", "Campaign · Kinfield", "Kinfield's campaign is coming soon.", { index: false });

/** Rough sketch of the campaign page, only ever shown blurred. */
function Preview() {
  return (
    <div>
      <p className="t-label text-cyan">Season one</p>
      <h2 className="t-h1 mt-5">Trade. Teach. Earn your seat.</h2>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {["Rewards", "Traders", "Days left"].map((t, k) => (
          <div key={t} className="panel p-7">
            <p className="t-label text-muted">{t}</p>
            <p className="mt-4 text-5xl tracking-[-0.04em]">{["$00,000", "0,000", "00"][k]}</p>
          </div>
        ))}
      </div>
      <div className="panel mt-5 p-7">
        {[78, 64, 52, 41, 30].map((w, k) => (
          <div key={k} className="flex items-center gap-5 py-3">
            <span className="w-28 text-sm text-muted">Milestone {k + 1}</span>
            <div className="h-2 flex-1 rounded-full bg-navy-800">
              <div className="h-2 rounded-full bg-cyan" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignPage() {
  return (
    <ComingSoon
      label="Campaign"
      shape="arrow"
      blurb="Seasons of simulated trading with goals, milestones and rewards for the traders whose decisions teach agents the most."
      preview={<Preview />}
    />
  );
}
