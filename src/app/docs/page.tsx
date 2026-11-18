import { Doc, DocLink, docMeta, H2, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("");

export default function Page() {
  return (
    <Doc slug="">
      <p>
        Kinfield is a paper-trading simulator built on live market data from Hyperliquid. Every trade you make is
        recorded with the market conditions at the moment you made it, the strategy you tagged it with, the reason you
        gave, and how it turned out. Those records teach a small AI agent of your own to read the market, and, if you
        choose, they join an open dataset that anyone can download and verify.
      </p>
      <p>
        No real money is involved anywhere. You start with $100,000 in simulated capital, nothing you do reaches an
        exchange, and agents only ever trade simulated accounts.
      </p>

      <H2 id="the-loop">How the pieces fit together</H2>
      <p>Kinfield is built around one loop, which the rest of these docs follow:</p>
      <Table
        head={["Step", "What happens", "Read more"]}
        rows={[
          ["Simulate", "You trade any Hyperliquid perpetual with simulated funds, on live candles, order book and trades.", <DocLink key="s" to="simulator">The trading terminal</DocLink>],
          ["Explain", "You tag each trade with a strategy and, if you like, write down why you took it.", <DocLink key="e" to="strategies">Strategies and reasons</DocLink>],
          ["Teach", "When a trade closes it becomes a labeled example: the market at entry and what price did next. Your agent learns from these.", <DocLink key="t" to="agent">Your agent</DocLink>],
          ["Verify", "Signed in, every fill is priced by Kinfield's server and kept on a hash-chained ledger where any later edit shows.", <DocLink key="v" to="ledger">The verified ledger</DocLink>],
          ["Share", "If you opt in, your trades are published nightly to a public dataset that anyone can recheck.", <DocLink key="sh" to="dataset">The open dataset</DocLink>],
        ]}
      />

      <H2 id="whats-live">What is live today</H2>
      <ul>
        <li>
          <strong>The simulator</strong> at <a href="/simulate">/simulate</a>: every Hyperliquid perpetual, market and
          limit orders, leverage up to 20x, take profit and stop loss, fees and liquidation, indicators and drawing tools.
        </li>
        <li>
          <strong>Guest mode</strong>: try it with no sign-in. Market orders only, and trades stay in your browser.
        </li>
        <li>
          <strong>Accounts</strong>: sign in with GitHub to get limit orders, a server-side verified ledger and an agent
          with its own name, such as KIN001.
        </li>
        <li>
          <strong>Your agent</strong>: learns from your closed trades and shows its lean on the market you are looking at.
          After 30 closed trades it starts trading its own simulated account every 15 minutes.
        </li>
        <li>
          <strong>Readiness checks</strong> at <a href="/agent">/agent</a>: seven checks that judge a track record on
          time, activity, trade count, profit factor, drawdown, concentration and win rate.
        </li>
        <li>
          <strong>The open dataset</strong>: opt-in, published nightly to{" "}
          <a href="https://github.com/KinfieldLabs/kinfield-datasets">KinfieldLabs/kinfield-datasets</a> under CC BY 4.0,
          with a verifier anyone can run.
        </li>
      </ul>

      <H2 id="what-it-is-not">What Kinfield is not</H2>
      <Note tone="warn" title="Simulated trading only">
        <p>
          Kinfield is not a broker or an exchange, and nothing here is financial advice. Simulated fills use live
          Hyperliquid prices but can differ from what a real order would get: there is no slippage, no partial fills
          and no queue position. Agents only trade simulated accounts, and passing the readiness checks is no promise
          of skill, profit or real capital.
        </p>
      </Note>

      <H2 id="who-its-for">Who it is for</H2>
      <ul>
        <li>
          <strong>Traders</strong> who want to practise on real markets without risking money, and see their decisions
          turned into a record that can be checked.
        </li>
        <li>
          <strong>Researchers and builders</strong> who want trading data where every decision comes with its context,
          intent and outcome, and where the record can be verified rather than trusted.
        </li>
        <li>
          <strong>The curious</strong>, who want to watch a small model learn from one person&apos;s judgement.
        </li>
      </ul>

      <H2 id="where-to-start">Where to start</H2>
      <p>
        New here? The <DocLink to="quickstart">Quickstart</DocLink> walks through a first trade in a couple of
        minutes. If you want to know how the record is kept honest, start with{" "}
        <DocLink to="ledger">The verified ledger</DocLink>. If you want the data, go to{" "}
        <DocLink to="dataset">The open dataset</DocLink>. The source code is on{" "}
        <a href="https://github.com/KinfieldLabs/KINFIELD">GitHub</a>.
      </p>
    </Doc>
  );
}
