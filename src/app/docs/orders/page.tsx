import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("orders");

export default function Page() {
  return (
    <Doc slug="orders">
      <p>
        Kinfield simulates perpetual futures the way Hyperliquid prices them, with a few deliberate simplifications
        listed at the end of this page. Signed in, every rule here is enforced by Kinfield&apos;s server, not by your
        browser.
      </p>

      <H2 id="basics">The basics</H2>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Starting balance", "$100,000 per account"],
          ["Minimum order", "$10 notional"],
          ["Leverage", "1x up to 20x, and never above the market's own Hyperliquid limit"],
          ["Taker fee", "0.045% of notional, on market fills and on every close"],
          ["Maker fee", "0.015% of notional, when a resting limit order fills"],
          ["Resting limit orders", "Up to 20 open at once, each within 50% of the market price"],
          ["Funding", "Shown in the market bar, but not charged or paid"],
        ]}
      />
      <p>
        Size is the position&apos;s notional value in US dollars at entry. Margin is the part of your balance it ties
        up: size divided by leverage. A $10,000 position at 5x uses $2,000 of margin.
      </p>

      <H2 id="market-orders">Market orders</H2>
      <p>
        A market order fills at once at the market price. Signed in, that price is Hyperliquid&apos;s mid (halfway
        between the best bid and ask) for that one market, fetched fresh the moment your order reaches Kinfield&apos;s
        server and timestamped by Hyperliquid. It is never a cached price and never a price your browser sent. The
        taker fee is taken from your balance when the position opens.
      </p>

      <H2 id="limit-orders">Limit orders</H2>
      <p>Limit orders need an account. A limit order rests until the market reaches your price:</p>
      <ul>
        <li>A long limit must sit below the current price; a short limit above it.</li>
        <li>
          A limit that is already through the market (a long above the price, a short below it) fills straight away at
          the market price, as a market order with the taker fee, just as it would on an exchange.
        </li>
        <li>
          While it rests, its margin plus the maker fee is held back from your free margin, shown as{" "}
          <strong>Held for orders</strong> in the Account panel.
        </li>
        <li>
          It fills at exactly your limit price, with the maker fee, as soon as a one-minute bar trades through it. That
          is checked against Hyperliquid&apos;s real price history, so an order fills correctly even if nobody has the
          page open.
        </li>
        <li>
          The market context your agent learns from is captured when you place the order, because that is when you made
          the decision.
        </li>
        <li>Cancel it any time from the Open orders tab. Cancelling releases the held margin.</li>
      </ul>
      <p>
        Tip: click a price in the order book to use it as the limit price.
      </p>

      <H2 id="margin">Equity and free margin</H2>
      <Code>{`
equity       = balance + unrealized P&L of open positions
margin used  = sum of (size / leverage) over open positions
held         = sum of (size / leverage + size x maker fee) over resting orders
free margin  = equity - margin used - held
`}</Code>
      <p>
        A new order is accepted when its margin plus its fee fits in your free margin. Otherwise it is refused with{" "}
        <em>Not enough free margin</em>. The ticket&apos;s size slider works from the same number.
      </p>

      <H2 id="tp-sl">Take profit and stop loss</H2>
      <p>
        Both are optional prices you can set on the order or change later on the open position. They are checked
        against the entry price (or the limit price for a resting order, or the current price when you edit an open
        position):
      </p>
      <Table
        head={["", "Long", "Short"]}
        rows={[
          ["Take profit", "Above the price", "Below the price"],
          ["Stop loss", "Below the price", "Above the price"],
        ]}
      />
      <p>
        When the market reaches one, the position closes at exactly that price. Clear a field to remove it.
      </p>

      <H2 id="liquidation">Liquidation</H2>
      <p>
        A position is liquidated when its loss uses up its whole margin. Kinfield places that point at:
      </p>
      <Code>{`
long:  liquidation price = entry x (1 - 1 / leverage)
short: liquidation price = entry x (1 + 1 / leverage)
`}</Code>
      <p>
        A liquidated position loses its entire margin, and the exit fee is still charged. The ticket shows the
        estimated liquidation price before you place the order, and the chart draws it on every open position.
      </p>

      <H2 id="triggers">How triggers are settled</H2>
      <p>
        Signed in, take profit, stop loss, liquidation and resting limits are replayed against Hyperliquid&apos;s real
        price history every time your account is read or changed, and by the agents&apos; scheduled run. Kinfield uses
        one-minute bars where Hyperliquid still has them, then 15-minute and hourly bars further back, plus the live
        price. So a stop fires at the right price and time even if you were away for a week.
      </p>
      <H3>The worse outcome rule</H3>
      <p>
        A single bar doesn&apos;t say in what order its high and low happened. When one bar touches both a protective
        level (stop loss or liquidation) and the take profit, Kinfield records the protective level, the worse outcome.
        The record must never flatter the trader or the agent.
      </p>
      <H3>Closing by hand</H3>
      <p>
        When you close a position, its price history since it was last checked is replayed first. If it had already hit
        its stop loss, take profit or liquidation, it closes there instead of at the current price. A stop that was
        already hit can&apos;t be dodged by closing by hand.
      </p>
      <Note title="As a guest">
        <p>
          Guest positions are checked against the live price in your browser, and only while the simulator is open.
        </p>
      </Note>

      <H2 id="pnl">How P&amp;L is calculated</H2>
      <Code>{`
quantity        = size / entry price
gross P&L       = quantity x (exit - entry)       for a long
                = quantity x (entry - exit)       for a short
entry fee       = size x fee rate (taker, or maker for a filled limit)
exit fee        = quantity x exit price x taker fee
realized P&L    = gross P&L - entry fee - exit fee
return on margin = realized P&L / (size / leverage)
`}</Code>
      <H3>A worked example</H3>
      <Code>{`
Long BTC, $10,000 at 5x, market order filled at $100,000

quantity         = 10,000 / 100,000            = 0.1 BTC
margin           = 10,000 / 5                  = $2,000
entry fee        = 10,000 x 0.045%             = $4.50
liquidation      = 100,000 x (1 - 1/5)         = $80,000

Closed by hand at $102,000
gross P&L        = 0.1 x (102,000 - 100,000)   = $200.00
exit fee         = 0.1 x 102,000 x 0.045%      = $4.59
realized P&L     = 200.00 - 4.50 - 4.59        = $190.91
return on margin = 190.91 / 2,000              = 9.55%
`}</Code>

      <H2 id="limits">Limits and errors</H2>
      <p>To keep the record clean and the server responsive, each account has limits far above what a person clicks:</p>
      <ul>
        <li>30 new trades a minute and 1,000 a day per account. Closing is never blocked.</li>
        <li>20 changes (orders, closes, cancels, edits) in any 10 seconds.</li>
        <li>10 account resets a day.</li>
      </ul>
      <Table
        head={["Message", "Why"]}
        rows={[
          ["Minimum order is $10", "The size is under $10."],
          ["Not enough free margin", "Margin plus fee is more than your free margin."],
          ["Take profit must be above entry price (or below, and so on)", "The level is on the wrong side of the price."],
          ["Limit price is too far from the market", "The limit is more than 50% away from the price."],
          ["Up to 20 open orders", "Cancel a resting order first."],
          ["Sign in to place limit orders", "Limit orders need an account."],
          ["No price for this market right now. Try again.", "Hyperliquid didn't answer in time. Nothing was recorded."],
        ]}
      />

      <H2 id="differences">How it differs from a real exchange</H2>
      <ul>
        <li>Every order fills in full at one price: no slippage, no partial fills and no queue position.</li>
        <li>Market orders fill at the mid price, not the far side of the book.</li>
        <li>Liquidation happens when the margin is gone, without Hyperliquid&apos;s maintenance margin or partial liquidations.</li>
        <li>Funding is not applied.</li>
        <li>Fees are Hyperliquid&apos;s base tier, with no volume discounts.</li>
      </ul>
      <p>
        These keep results simple and comparable. They also mean a real order could do worse, so treat simulated
        results accordingly. How fills are recorded is covered in <DocLink to="ledger">The verified ledger</DocLink>.
      </p>
    </Doc>
  );
}
