import type { ReactNode } from "react";
import { Doc, DocLink, docMeta, H2, H3 } from "@/components/docs/Doc";

export const metadata = docMeta("faq");

const FAQ: [string, ReactNode][] = [
  [
    "Is any real money involved?",
    "No. Every account starts with $100,000 of simulated capital, nothing reaches an exchange, and simulated balances have no cash value. Agents only trade simulated accounts.",
  ],
  [
    "Do I need a wallet or a Hyperliquid account?",
    "No. Kinfield reads Hyperliquid's public market data. You never connect a wallet.",
  ],
  [
    "Why would a real order fill differently?",
    <>
      Simulated orders fill in full at one price, market orders at the mid, with no slippage, partial fills or funding.
      See <DocLink to="orders" hash="differences">How it differs from a real exchange</DocLink>.
    </>,
  ],
  [
    "Why can't I place a limit order?",
    "Limit orders need an account, because they rest on Kinfield's server and are filled from price history while you are away. Sign in with GitHub to use them.",
  ],
  [
    "Why did my position close while I was away?",
    <>
      Signed in, take profit, stop loss, liquidation and resting limits are replayed against Hyperliquid&apos;s real
      price history, so they fire even when nobody has the page open. If one bar touched both your stop and your
      target, the stop is recorded, since a bar doesn&apos;t say which came first. See{" "}
      <DocLink to="orders" hash="triggers">How triggers are settled</DocLink>.
    </>,
  ],
  [
    "Can I edit or delete a trade?",
    "No. Signed-in trades are on an append-only ledger. You can reset to start a new account, but the old one stays on your record. Deleting your whole account is the only way to remove trades.",
  ],
  [
    "Why does my agent say No edge?",
    <>
      Either it has few examples, so its view is pulled toward 50%, or the market in front of you looks like conditions
      where your past trades went both ways. See <DocLink to="agent" hash="prediction">How it forms a view</DocLink>.
    </>,
  ],
  [
    "Does the agent learn from my strategy tags and reasons?",
    "Not yet. It learns from the market context and the outcome. Tags and reasons are recorded and published if you share, for future models.",
  ],
  [
    "When does my agent start trading on its own?",
    <>
      After 30 closed trades with market context, while signed in. It then runs every 15 minutes. See{" "}
      <DocLink to="autonomous">The agent trading on its own</DocLink>.
    </>,
  ],
  [
    "Who can see my trades?",
    "Only you, unless you opt in to the open dataset. Shared trades appear under your agent's KIN name; your GitHub username and written reasons stay private unless you choose to share them too.",
  ],
  [
    "Can I stop sharing?",
    "Yes, any time. Your agent's folder is removed at the next nightly publish. Earlier versions stay in the repository's git history.",
  ],
  [
    "Will passing the readiness checks get my agent real capital?",
    "No. Real-capital funding is not offered. The checks measure a simulated record, nothing more.",
  ],
  [
    "Can I choose my agent's name?",
    "No. Names are assigned in sign-up order so they stay pseudonymous and can't imitate each other.",
  ],
];

const TERMS: [string, ReactNode][] = [
  ["Agent", "The small model that learns from one person's closed trades, named KIN001, KIN002 and on."],
  ["Archived account", "An account replaced by a reset. Its ledger is kept and it stays on the record."],
  ["Commitment", "A salted SHA-256 hash of a written reason, recorded so the reason can later be proved unchanged without revealing it."],
  ["Context", "The six market features recorded at the moment of a decision."],
  ["Drawdown", "A fall in closed-trade equity from its highest point, as a share of that peak."],
  ["Equity", "Balance plus the unrealized P&L of open positions."],
  ["Free margin", "Equity minus margin in use and margin held for resting orders: what a new order can use."],
  ["Genesis", <>The starting hash of an account&apos;s chain: <code>sha256(&quot;kinfield:&quot; + account_id)</code>.</>],
  ["Head", "The latest hash in an account's ledger, which stands for its whole history."],
  ["Leverage", "Notional size divided by margin. 5x means $10,000 of exposure for $2,000 of margin."],
  ["Liquidation", "Closing a position whose losses have used up its margin."],
  ["Maker and taker fees", "0.015% when a resting limit fills; 0.045% on market fills and every close."],
  ["Margin", "The part of the balance a position ties up: size divided by leverage."],
  ["Mid price", "Halfway between the best bid and best ask. Market orders fill here."],
  ["Notional", "A position's full size in US dollars, before leverage."],
  ["Perpetual", "A futures contract with no expiry, the kind of market Hyperliquid lists."],
  ["Profit factor", "Gross profit divided by gross loss."],
  ["Readiness checks", "Seven tests a track record is judged on, at /agent."],
  ["Replay", "Settling orders and triggers against real price history since they were last checked."],
  ["Return on margin", "Realized P&L divided by the margin the position used."],
  ["Time stop", "The agent closing its own position after 24 hours."],
  ["Verified ledger", "The append-only, hash-chained record of every signed-in account."],
];

export default function Page() {
  return (
    <Doc slug="faq">
      <H2 id="faq">Frequently asked questions</H2>
      {FAQ.map(([q, a]) => (
        <div key={q}>
          <H3>{q}</H3>
          <p className="mt-2">{a}</p>
        </div>
      ))}

      <H2 id="glossary">Glossary</H2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[180px_1fr]">
        {TERMS.map(([term, def]) => (
          <div key={term} className="contents">
            <dt className="font-medium text-cream">{term}</dt>
            <dd className="-mt-3 sm:mt-0">{def}</dd>
          </div>
        ))}
      </dl>

      <H2 id="contact">Still stuck?</H2>
      <p>
        Email <a href="mailto:kinfieldlabs@proton.me">kinfieldlabs@proton.me</a> or reach Kinfield on{" "}
        <a href="https://x.com/kinfieldlabs">X</a>. The <a href="/terms">Terms of Use</a> and{" "}
        <a href="/privacy">Privacy Policy</a> cover the rules and your data.
      </p>
    </Doc>
  );
}
