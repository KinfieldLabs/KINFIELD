import { Doc, DocLink, docMeta, H2, Note } from "@/components/docs/Doc";

export const metadata = docMeta("quickstart");

export default function Page() {
  return (
    <Doc slug="quickstart">
      <p>
        This walks through one complete trade: open the simulator, place an order, close it, and see what your agent
        took from it. It takes about two minutes and needs no account.
      </p>

      <H2 id="open">1. Open the simulator</H2>
      <p>
        Go to <a href="/simulate">kinfield.si/simulate</a>. You start in guest mode with $100,000 in simulated capital.
        The first time you visit, a short guide points out the market picker, the order ticket and the positions panel;
        you can skip it, and bring it back any time with <strong>How it works</strong> in the header.
      </p>
      <p>
        To keep your trades on a verified record and get limit orders, choose <strong>Sign in with GitHub</strong> at
        the top right of the terminal. Kinfield asks GitHub for your public profile only. See{" "}
        <DocLink to="accounts">Guest mode and accounts</DocLink> for the differences.
      </p>

      <H2 id="market">2. Pick a market</H2>
      <p>
        Use the market picker at the top left to choose any Hyperliquid perpetual, for example BTC or ETH. The chart,
        order book, recent trades and market stats switch to it straight away, all streaming live from Hyperliquid.
      </p>

      <H2 id="order">3. Place an order</H2>
      <ol>
        <li>
          In the order ticket, choose <strong>Buy / Long</strong> if you expect the price to rise, or{" "}
          <strong>Sell / Short</strong> if you expect it to fall.
        </li>
        <li>
          Keep the order type on <strong>market</strong> to fill at the current price. Signed in, you can choose{" "}
          <strong>limit</strong> to rest an order at a price of your own.
        </li>
        <li>Enter a size in US dollars (at least $10) and pick a leverage.</li>
        <li>Optionally set a take profit and a stop loss.</li>
        <li>
          Tag a <strong>strategy</strong>, such as Momentum or Breakout, and write a short <strong>reason</strong> if
          you like. Both are kept with the trade. See <DocLink to="strategies">Strategies and reasons</DocLink>.
        </li>
        <li>Place the order. The position appears in the panel under the chart, and its entry is drawn on the chart.</li>
      </ol>

      <H2 id="close">4. Close it</H2>
      <p>
        Close the position from the Positions tab whenever you like, or let your take profit or stop loss close it for
        you. The result, net of fees, moves to Trade history along with why the trade ended: by hand, take profit, stop
        loss or liquidation.
      </p>

      <H2 id="agent">5. See what it taught</H2>
      <p>
        Open the <strong>Your agent</strong> tab under the chart (signed in, it carries your agent&apos;s name, such
        as Agent KIN001). Each closed trade is one example. Once there are three,
        your agent trains on them right away and shows how it leans on the market you are looking at, and which market
        conditions push it toward long or short. Read more in <DocLink to="agent">Your agent</DocLink>.
      </p>
      <Note title="Signed in?">
        <p>
          Your trades are also on the verified ledger. Open <a href="/agent">/agent</a> to see your record judged by the
          readiness checks, and decide in the sharing settings whether your trades join the open dataset. Nothing is
          published until you choose.
        </p>
      </Note>

      <H2 id="next">Next steps</H2>
      <ul>
        <li>
          Learn every order option in <DocLink to="orders">Orders and positions</DocLink>.
        </li>
        <li>
          Add indicators and drawings with <DocLink to="chart">Chart tools</DocLink>.
        </li>
        <li>
          After 30 closed trades your agent starts trading on its own: see{" "}
          <DocLink to="autonomous">The agent trading on its own</DocLink>.
        </li>
      </ul>
    </Doc>
  );
}
