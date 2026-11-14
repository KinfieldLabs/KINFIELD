import Link from "next/link";
import { Logo, Mark } from "@/components/Logo";
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
    body: "Every trade becomes a labeled example: market context, decision, rationale, and outcome. Agents learn from what you did — and how it went.",
  },
];

const features = [
  ["Live market data", "Mid prices and candles stream straight from Hyperliquid's public API."],
  ["Labeled trade dataset", "Each round trip is captured with the market state at entry and exit. Export it as JSONL."],
  ["Apprentice agent", "A baseline agent trains on your trades in the browser and shows how it would act right now."],
  ["Strategy tags", "Momentum, mean reversion, breakout, news — structure your intent so it can be learned."],
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <Waves className="pointer-events-none absolute -right-24 top-24 w-[720px] max-w-none opacity-90" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-muted">
          <a href="#how" className="hidden hover:text-cream sm:block">How it works</a>
          <a href="#features" className="hidden hover:text-cream sm:block">Features</a>
          <Link
            href="/simulate"
            className="rounded-full bg-cream px-4 py-2 font-semibold text-navy-900 transition hover:bg-white"
          >
            Launch simulator
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-28 pt-20 sm:pt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-navy-850/70 px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" />
            Powered by Hyperliquid market data
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            Teach agents to trade.
          </h1>
          <p className="mt-5 text-2xl text-cream/90 sm:text-3xl">Simulate strategies. Train intelligence.</p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Train the next generation of AI trading agents. Test your strategies in simulated markets and help agents
            learn from your trades.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/simulate"
              className="rounded-full bg-cream px-6 py-3 font-semibold text-navy-900 transition hover:bg-white"
            >
              Start simulating →
            </Link>
            <a
              href="#how"
              className="rounded-full border border-line px-6 py-3 font-semibold text-cream transition hover:border-cyan/60"
            >
              How it works
            </a>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="panel p-6">
                <div className="font-mono text-sm text-cyan">{s.n}</div>
                <h3 className="mt-3 text-2xl font-semibold">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan">Why Kinfield</h2>
              <p className="mt-6 text-3xl font-semibold leading-snug">
                Agents learn markets from data. They learn judgment from people.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Kinfield turns your simulated trading into training signal — decisions paired with context, intent and
                outcome — so the next generation of agents trades a little more like the best of us.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(([t, b]) => (
                <div key={t} className="panel p-5">
                  <Mark className="h-5 w-5 text-cyan" />
                  <h3 className="mt-3 font-semibold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="panel relative overflow-hidden p-10 text-center sm:p-16">
            <Waves className="pointer-events-none absolute -bottom-40 -right-20 w-[520px] opacity-50" />
            <h2 className="relative text-3xl font-bold sm:text-4xl">Your next trade could teach an agent.</h2>
            <p className="relative mt-3 text-muted">$100,000 in simulated capital. Live markets. Zero risk.</p>
            <Link
              href="/simulate"
              className="relative mt-8 inline-block rounded-full bg-cream px-6 py-3 font-semibold text-navy-900 hover:bg-white"
            >
              Launch simulator
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row">
          <Logo />
          <p>Simulated trading only. Not financial advice. Market data via Hyperliquid.</p>
        </div>
      </footer>
    </div>
  );
}
