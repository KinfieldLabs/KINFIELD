import type { CSSProperties, ReactNode } from "react";
import { Constellation, type ShapeName } from "@/components/Constellation";
import { Logo, Mark } from "@/components/Logo";
import { HyperliquidMark } from "@/components/HyperliquidMark";
import { InView, Lines, SmoothScroll } from "@/components/motion";
import { ConstellationButton } from "@/components/ConstellationButton";
import { DemoVideo } from "@/components/DemoVideo";
import { SiteNav } from "@/components/SiteNav";

const steps = [
  {
    n: "01",
    title: "Simulate",
    body: "Trade perpetuals against live Hyperliquid prices with a paper balance. No wallet and no real funds, just live market prices.",
  },
  {
    n: "02",
    title: "Explain",
    body: "Tag each trade with a strategy and, if you like, a one-line reason. Both are recorded with the trade, so the data shows why you traded, not just what.",
  },
  {
    n: "03",
    title: "Teach",
    body: "Every closed trade becomes a labeled example: the market at entry and how it turned out. Your agent, an early experiment, learns from those. Your tags and reasons aren't used by it yet.",
  },
];

/** Each feature with what it takes to use it: try now, sign in, opt in, or keep trading. */
const features = [
  [
    "Pro trading terminal",
    "Try now",
    "Every Hyperliquid perpetual with live candles, order book and trades. Market and limit orders, take profit, stop loss and up to 20x leverage.",
  ],
  [
    "Verified ledger",
    "Sign in",
    "Sign in with GitHub and every fill is priced by Hyperliquid the moment it arrives, then written to a hash-chained record where any later edit shows.",
  ],
  [
    "Open dataset",
    "Opt in",
    "Opt in and your trades are published nightly to GitHub under CC BY 4.0, with a script anyone can run to check every one of them.",
  ],
  [
    "Agents that trade on their own",
    "After 30 trades",
    "Every account comes with an experimental agent, like KIN001, that learns from the market conditions and outcomes of your trades. After 30 closed trades it trades its own simulated account every 15 minutes, judged on the same ledger.",
  ],
];

const proof = [
  {
    n: "01",
    title: "Priced on arrival",
    body: "Each fill takes a fresh Hyperliquid price the moment your order reaches the server, timestamped by Hyperliquid. Never a cached price, never the browser's word.",
  },
  {
    n: "02",
    title: "Tamper-evident",
    body: "Every fill carries the hash of the one before it. Change a single trade and every hash after it breaks, which shows against the published history. Stops are replayed against real price history, so they can't be dodged.",
  },
  {
    n: "03",
    title: "Open to check",
    body: "Shared accounts are published nightly with verify.mjs, which recomputes every chain. Written reasons stay private behind a salted commitment unless you choose to share them.",
  },
];

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * A full-height section in the zigzag rhythm. The empty column is where the
 * page-wide constellation draws this section's figure.
 */
function Stage({
  id,
  shape,
  side,
  children,
  aside,
  className = "",
}: {
  id?: string;
  shape: ShapeName;
  side: "left" | "right";
  children: ReactNode;
  /** Shown in the empty column over the figure; on phones it follows the text. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-shape={shape}
      data-side={side}
      className={`mx-auto grid min-h-[100svh] max-w-[1280px] items-center gap-10 px-6 py-[120px] ${
        side === "left" ? "lg:grid-cols-[1fr_1.2fr]" : "lg:grid-cols-[1.2fr_1fr]"
      } ${className}`}
    >
      {side === "left" &&
        (aside ? <div className="relative order-last lg:order-none">{aside}</div> : <div aria-hidden className="hidden lg:block" />)}
      <div className="relative">{children}</div>
    </section>
  );
}

const FOOTER_LINKS: { label: string; href?: string }[] = [
  { label: "X", href: "https://x.com/kinfieldlabs" },
  { label: "GitHub", href: "https://github.com/KinfieldLabs/KINFIELD" },
  { label: "Kinfield Datasets", href: "https://github.com/KinfieldLabs/kinfield-datasets" },
  { label: "Simulator", href: "/simulate" },
  { label: "Docs", href: "/docs" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "DexScreener" },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <SmoothScroll />
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[140vh]" />
      <Constellation />
      <SiteNav />

      <main className="relative z-10">
        {/* Hero: the Kinfield mark */}
        <section
          data-shape="mark"
          data-side="right"
          className="mx-auto grid min-h-[100svh] max-w-[1280px] items-center px-6 pb-16 pt-32 lg:grid-cols-[1.35fr_1fr]"
        >
          <div>
            <InView onMount>
              <a
                href="https://hyperliquid.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="reveal group mb-8 inline-flex items-center gap-2.5 text-muted transition-colors duration-300 hover:text-cream"
                style={i(0)}
              >
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
                <span className="t-label">Powered by Hyperliquid</span>
                <HyperliquidMark className="h-[17px] w-auto text-[#97fce4] transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-110" />
              </a>
            </InView>
            <Lines as="h1" onMount className="t-display lg:whitespace-nowrap" lines={["Teach agents", "to trade."]} delay={150} />
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
        </section>

        {/* How it works: candlesticks */}
        <Stage
          id="how"
          shape="candles"
          side="left"
          aside={
            <InView>
              <DemoVideo
                mp4="/demo/simulator.mp4"
                webm="/demo/simulator.webm"
                poster="/demo/simulator.jpg"
                className="reveal"
              />
            </InView>
          }
        >
          <InView>
            <p className="reveal t-label text-cyan">How it works</p>
          </InView>
          <Lines className="t-h1 mt-6" lines={["From trade", "to training data."]} />
          <div className="mt-12">
            {steps.map((s, k) => (
              <InView key={s.n} className="pb-8" style={{ "--d": `${k * 80}ms` } as CSSProperties}>
                <div className="rule" />
                <div className="grid grid-cols-[56px_1fr] gap-4 pt-7">
                  <span className="reveal font-mono text-sm text-cyan" style={i(0)}>
                    {s.n}
                  </span>
                  <div>
                    <h3 className="reveal t-h3" style={i(1)}>
                      {s.title}
                    </h3>
                    <p className="reveal t-body mt-3" style={i(2)}>
                      {s.body}
                    </p>
                  </div>
                </div>
              </InView>
            ))}
          </div>
        </Stage>

        {/* Why: neural network */}
        <Stage id="why" shape="network" side="right">
          <InView>
            <p className="reveal t-label text-cyan">Why Kinfield</p>
          </InView>
          <Lines
            className="t-h1 mt-6 lg:!text-[4.25rem]"
            lines={[
              "Agents learn",
              "markets from data.",
              <span key="judgment">
                <span className="text-cyan">Judgment</span> comes
              </span>,
              "from people.",
            ]}
          />
          <InView className="mt-10">
            <p className="reveal t-body max-w-lg" style={i(0)}>
              Kinfield records simulated trading as training data: each decision with its market context, the intent
              you gave it and how it turned out. Today&apos;s agent learns from the context and the outcome. The intent
              is recorded so future models can learn from it too.
            </p>
          </InView>
        </Stage>

        {/* Features: dataset rows */}
        <Stage id="features" shape="dataset" side="left">
          <InView>
            <p className="reveal t-label text-cyan">What you get</p>
          </InView>
          <Lines className="t-h1 mt-6" lines={["Every trade", "becomes a lesson."]} />
          <div className="mt-12 grid gap-x-10 sm:grid-cols-2">
            {features.map(([t, status, b], k) => (
              <InView key={t} className="pb-8" style={{ "--d": `${(k % 2) * 120}ms` } as CSSProperties}>
                <div className="rule" />
                <div className="pt-6">
                  <div className="reveal flex items-center justify-between gap-3" style={i(0)}>
                    <Mark className="h-4 w-4 text-cyan" />
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        k === 0 ? "border-cyan/50 text-cyan" : "border-line text-muted"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <h3 className="reveal mt-4 text-xl tracking-[-0.02em]" style={i(1)}>
                    {t}
                  </h3>
                  <p className="reveal t-body mt-2 !text-base" style={i(2)}>
                    {b}
                  </p>
                </div>
              </InView>
            ))}
          </div>
        </Stage>

        {/* Proof: the verified ledger and the open dataset */}
        <Stage id="proof" shape="chain" side="right">
          <InView>
            <p className="reveal t-label text-cyan">On the record</p>
          </InView>
          <Lines
            className="t-h1 mt-6"
            lines={[
              "Every trade,",
              <span key="record">
                on the <span className="text-cyan">record.</span>
              </span>,
            ]}
          />
          <InView className="mt-8">
            <p className="reveal t-body max-w-lg" style={i(0)}>
              A track record only matters if changes to it would show. Signed-in trades never trust the browser, and
              shared records are published so anyone can check them against the history.
            </p>
          </InView>
          <div className="mt-12">
            {proof.map((s, k) => (
              <InView key={s.n} className="pb-8" style={{ "--d": `${k * 80}ms` } as CSSProperties}>
                <div className="rule" />
                <div className="grid grid-cols-[56px_1fr] gap-4 pt-7">
                  <span className="reveal font-mono text-sm text-cyan" style={i(0)}>
                    {s.n}
                  </span>
                  <div>
                    <h3 className="reveal t-h3" style={i(1)}>
                      {s.title}
                    </h3>
                    <p className="reveal t-body mt-3" style={i(2)}>
                      {s.body}
                    </p>
                  </div>
                </div>
              </InView>
            ))}
          </div>
          <InView>
            <a
              href="https://github.com/KinfieldLabs/kinfield-datasets"
              target="_blank"
              rel="noopener noreferrer"
              className="reveal link-ghost !text-cyan text-sm font-semibold"
              style={i(0)}
            >
              Browse the open dataset on GitHub
            </a>
          </InView>
        </Stage>

        {/* CTA: rising arrow */}
        <Stage shape="arrow" side="left">
          <Lines className="t-h1" lines={["Your next trade", "could teach", "an agent."]} />
          <InView className="mt-10 flex flex-wrap items-center gap-8">
            <ConstellationButton href="/simulate" className="reveal" style={i(0)}>
              Launch simulator
            </ConstellationButton>
            <p className="reveal t-body" style={i(1)}>
              $100,000 in simulated capital. Live markets. No real funds are used.
            </p>
          </InView>
        </Stage>
      </main>

      <footer className="relative z-10">
        <div className="mx-auto max-w-[1280px] px-6">
          <InView>
            <div className="rule" />
          </InView>
          <div className="flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-3">
              <Logo />
              <p className="max-w-xs text-sm font-light text-muted">
                Simulated trading only. Not financial advice. Market data via{" "}
                <a
                  href="https://hyperliquid.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-baseline gap-1.5 transition-colors duration-300 hover:text-cream"
                >
                  Hyperliquid
                  <HyperliquidMark className="h-[11px] w-auto self-center text-[#97fce4] transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-110" />
                </a>
                .
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
              {FOOTER_LINKS.map((l) =>
                l.href ? (
                  <a
                    key={l.label}
                    href={l.href}
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="link-ghost w-fit text-sm"
                  >
                    {l.label}
                  </a>
                ) : (
                  <span key={l.label} className="flex w-fit items-center gap-2 text-sm text-muted/70" aria-disabled="true">
                    {l.label}
                    <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      Soon
                    </span>
                  </span>
                ),
              )}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
