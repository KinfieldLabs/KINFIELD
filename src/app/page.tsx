import type { CSSProperties } from "react";
import Link from "next/link";
import { Constellation } from "@/components/Constellation";
import { Logo, Mark } from "@/components/Logo";
import { InView, Lines, SmoothScroll } from "@/components/motion";
import { SiteNav } from "@/components/SiteNav";
import { Waves } from "@/components/Waves";

const steps = [
  {
    n: "01",
    title: "Simulate",
    body: "Trade perpetuals against live Hyperliquid prices with a paper balance. No wallet, no risk — real market conditions.",
  },
  {
    n: "02",
    title: "Explain",
    body: "Tag each trade with a strategy and a one-line rationale. Your reasoning is the signal agents can't get from price alone.",
  },
  {
    n: "03",
    title: "Teach",
    body: "Every trade becomes a labeled example: market context, decision, rationale and outcome. Agents learn from what you did — and how it went.",
  },
];

const features = [
  ["Live market data", "Mid prices and candles stream straight from Hyperliquid's public API."],
  ["Labeled trade dataset", "Each round trip is captured with the market state at entry. Export it as JSONL."],
  ["Apprentice agent", "A baseline agent trains on your trades in the browser and shows how it would act right now."],
  ["Strategy tags", "Momentum, mean reversion, breakout, news — structure your intent so it can be learned."],
];

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <SmoothScroll />
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[140vh]" />
      <SiteNav />

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative mx-auto grid min-h-[100svh] max-w-[1280px] items-center gap-6 px-6 pb-16 pt-32 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative z-10">
            <InView onMount>
              <div className="reveal mb-8 inline-flex items-center gap-2.5 text-muted" style={i(0)}>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
                <span className="t-label">Powered by Hyperliquid</span>
              </div>
            </InView>
            <Lines as="h1" onMount className="t-display lg:whitespace-nowrap"lines={["Teach agents", "to trade."]} delay={150} />
            <InView onMount className="mt-8 max-w-xl" style={{ "--d": "550ms" } as CSSProperties}>
              <p className="reveal t-h3" style={i(0)}>
                Simulate strategies. <span className="text-cyan">Train intelligence.</span>
              </p>
              <p className="reveal t-body mt-5" style={i(1)}>
                Train the next generation of AI trading agents. Test your strategies in simulated markets and help
                agents learn from your trades.
              </p>
            </InView>
          </div>
          <div className="pointer-events-none absolute inset-0 lg:pointer-events-auto lg:relative lg:inset-auto lg:h-[min(76vh,720px)]">
            <Constellation className="h-full w-full opacity-40 lg:opacity-100" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-[1280px] px-6 py-[120px]">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.15fr]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <InView>
                <p className="reveal t-label text-cyan">How it works</p>
              </InView>
              <Lines className="t-h1 mt-6" lines={["From trade", "to training", "data."]} />
            </div>
            <div>
              {steps.map((s, k) => (
                <InView key={s.n} className="pb-12" style={{ "--d": `${k * 60}ms` } as CSSProperties}>
                  <div className="rule" />
                  <div className="grid grid-cols-[64px_1fr] gap-6 pt-10">
                    <span className="reveal font-mono text-sm text-cyan" style={i(0)}>
                      {s.n}
                    </span>
                    <div>
                      <h3 className="reveal t-h2" style={i(1)}>
                        {s.title}
                      </h3>
                      <p className="reveal t-body mt-4 max-w-md" style={i(2)}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                </InView>
              ))}
            </div>
          </div>
        </section>

        {/* Statement */}
        <section id="why" className="mx-auto max-w-[1280px] px-6 py-[120px]">
          <InView>
            <p className="reveal t-label text-cyan">Why Kinfield</p>
          </InView>
          <Lines
            className="t-h1 mt-8 max-w-5xl"
            lines={[
              "Agents learn markets",
              "from data. They learn",
              <span key="judgment">
                <span className="text-cyan">judgment</span> from people.
              </span>,
            ]}
          />
          <InView className="mt-12 grid gap-10 md:grid-cols-2 lg:ml-[40%] lg:grid-cols-1">
            <p className="reveal t-body max-w-lg" style={i(0)}>
              Kinfield turns your simulated trading into training signal — decisions paired with context, intent and
              outcome — so the next generation of agents trades a little more like the best of us.
            </p>
          </InView>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-[1280px] px-6 py-[120px]">
          <div className="grid gap-x-16 gap-y-4 sm:grid-cols-2">
            {features.map(([t, b], k) => (
              <InView key={t} className="pb-10" style={{ "--d": `${(k % 2) * 120}ms` } as CSSProperties}>
                <div className="rule" />
                <div className="flex items-start gap-5 pt-8">
                  <Mark className="reveal mt-1.5 h-5 w-5 shrink-0 text-cyan" />
                  <div>
                    <h3 className="reveal t-h3" style={i(1)}>
                      {t}
                    </h3>
                    <p className="reveal t-body mt-3" style={i(2)}>
                      {b}
                    </p>
                  </div>
                </div>
              </InView>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative mx-auto max-w-[1280px] px-6 py-[140px]">
          <Waves className="pointer-events-none absolute -right-32 top-0 w-[760px] max-w-none opacity-70" />
          <Lines
            className="t-display relative max-w-4xl"
            lines={["Your next trade", "could teach", "an agent."]}
          />
          <InView className="relative mt-10 flex flex-wrap items-center gap-8">
            <Link href="/simulate" className="reveal btn-primary" style={i(0)}>
              Launch simulator <span className="arrow">→</span>
            </Link>
            <p className="reveal t-body" style={i(1)}>
              $100,000 in simulated capital. Live markets. Zero risk.
            </p>
          </InView>
        </section>
      </main>

      <footer className="relative z-10">
        <div className="mx-auto max-w-[1280px] px-6">
          <InView>
            <div className="rule" />
          </InView>
          <div className="flex flex-col items-start justify-between gap-4 py-10 sm:flex-row sm:items-center">
            <Logo />
            <p className="text-sm font-light text-muted">
              Simulated trading only. Not financial advice. Market data via Hyperliquid.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
