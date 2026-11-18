import { Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("simulator");

export default function Page() {
  return (
    <Doc slug="simulator">
      <p>
        The simulator at <a href="/simulate">/simulate</a> is a full trading terminal for every perpetual listed on
        Hyperliquid. Prices, candles, the order book and the trade tape all stream live from Hyperliquid&apos;s public
        feed; only your orders and balance are simulated.
      </p>

      <H2 id="data">Where the data comes from</H2>
      <p>
        The terminal connects to Hyperliquid&apos;s public WebSocket for live prices, the order book and trades, and
        loads candle history and market details through Kinfield&apos;s read-only proxy of Hyperliquid&apos;s info
        endpoint. Nothing is delayed or smoothed. The status next to the price shows <strong>Live</strong>, or{" "}
        <strong>Connecting</strong> and <strong>Reconnecting</strong> while the feed recovers; it reconnects on its own.
      </p>

      <H2 id="layout">The layout</H2>
      <Table
        head={["Area", "What it shows"]}
        rows={[
          ["Header", "Links to the terminal, your agent's page and the guide (How it works), your equity and return, and the sign-in or account button."],
          ["Market bar", "The market picker, the last price, and the market's stats."],
          ["Chart", "Candles for the chosen interval, with indicators, drawing tools, and your positions and orders drawn on it."],
          ["Order book and Trades", "Live depth on both sides, and the latest trades printed on Hyperliquid."],
          ["Order ticket", "Everything to place an order, with an estimate of entry, margin, fee and liquidation price."],
          ["Account", "Equity, balance, unrealized and realized P&L, margin in use, free margin, closed trades and win rate."],
          ["Positions, orders, history, agent", "Tabs under the chart for your open positions, resting orders, closed trades and your agent."],
        ]}
      />

      <H2 id="markets">Choosing a market</H2>
      <p>
        Open the market picker to search every listed perpetual by name. Each row shows the market, its maximum leverage,
        price, 24 hour change and volume; the busiest markets come first. Use the arrow keys and Enter to pick, or Escape to close. The terminal remembers the last
        market and interval you used.
      </p>
      <H3>Market stats</H3>
      <ul>
        <li><strong>Mark</strong> and <strong>Oracle</strong>: Hyperliquid&apos;s mark and oracle prices.</li>
        <li><strong>24h change</strong> and <strong>24h volume</strong>: against the price 24 hours ago, and notional volume.</li>
        <li><strong>Open interest</strong>: the value of all open positions on Hyperliquid in this market.</li>
        <li>
          <strong>Funding / countdown</strong>: the current hourly funding rate and time to the next payment. It is shown
          for context; simulated positions are not charged or paid funding.
        </li>
      </ul>

      <H2 id="chart">The chart</H2>
      <p>
        Pick an interval of 1m, 5m, 15m, 1h, 4h or 1d. Scroll back and older candles load as you go; the button at the
        right edge jumps back to the latest candle. Open positions are drawn with their entry, take profit, stop loss
        and liquidation price, and resting limit orders with their price. See <DocLink to="chart">Chart tools</DocLink>{" "}
        for indicators and drawings.
      </p>

      <H2 id="book">Order book and trades</H2>
      <p>
        The order book shows the best bids and asks with a running total. Change the price grouping to see deeper
        levels, and switch sizes between coin and US dollars. Click any price level to put that price into the order
        ticket as a limit price. The <strong>Trades</strong> tab lists the latest trades on Hyperliquid with price,
        size and time, colored by the side that took liquidity.
      </p>

      <H2 id="ticket">The order ticket</H2>
      <p>
        Choose a side, an order type, a size and leverage, optional take profit and stop loss, and a strategy and
        reason. Size can be entered in US dollars or in the coin, or set with the slider as a share of your buying
        power. Leverage has quick picks of 1x, 3x, 5x, 10x and 20x, up to the market&apos;s own limit. Before you place
        it, the ticket shows the estimated entry, margin, fee (maker or taker) and liquidation price. Every option is
        covered in <DocLink to="orders">Orders and positions</DocLink>.
      </p>

      <H2 id="blotter">Positions, orders and history</H2>
      <H3>Positions</H3>
      <p>
        Each open position shows its market and side, size, value, entry price, mark price, liquidation price, margin,
        P&amp;L with return on margin, and its take profit and stop loss, which you can edit in place. Close it at the
        market with one click.
      </p>
      <H3>Open orders</H3>
      <p>
        Resting limit orders (signed in only) with when they were placed, the limit price, size, how far the market is
        from the limit, and their take profit and stop loss. Cancel any of them.
      </p>
      <H3>Trade history</H3>
      <p>
        Every closed trade with its P&amp;L net of fees and a badge for how it ended:{" "}
        <strong>Closed</strong> by hand, <strong>Take profit</strong>, <strong>Stop loss</strong>,{" "}
        <strong>Liquidated</strong>, or <strong>Time limit</strong> for an agent&apos;s trade held too long.{" "}
        <strong>Export .jsonl</strong> downloads the whole history, one trade per line, with its context, action,
        intent and outcome.
      </p>
      <H3>Your agent</H3>
      <p>
        What your agent has learned from your closed trades, and how it leans on the market you are viewing. See{" "}
        <DocLink to="agent">Your agent</DocLink>.
      </p>

      <H2 id="recorded">After each close</H2>
      <p>
        When a trade closes, a card confirms what was recorded and where (on your verified record, or in this browser):
        entry and exit prices, the result and how it ended, your strategy, whether a reason was saved, whether the
        market at entry was captured, and how many examples your agent now has. From there you can jump straight to your agent.
      </p>

      <Note>
        <p>
          The terminal works on phones and tablets too. On narrow screens the panels stack, and the chart, book and
          ticket are a scroll apart.
        </p>
      </Note>
    </Doc>
  );
}
