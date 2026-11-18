import { Doc, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("chart");

const kbd = (k: string) => <code>{k}</code>;

export default function Page() {
  return (
    <Doc slug="chart">
      <p>
        The terminal&apos;s chart is built on TradingView&apos;s open source{" "}
        <a href="https://github.com/tradingview/lightweight-charts">lightweight-charts</a>, with Kinfield&apos;s own
        indicators and drawing tools on top. Everything you add is saved in your browser.
      </p>

      <H2 id="indicators">Indicators</H2>
      <p>
        Open <strong>Indicators</strong> above the chart to add one. They follow TradingView&apos;s definitions, so
        their values match a TradingView chart of the same candles.
      </p>
      <Table
        head={["Indicator", "Defaults", "Where it is drawn"]}
        rows={[
          ["Moving Average (MA)", "Length 20", "Over the candles"],
          ["Exponential Moving Average (EMA)", "Length 20", "Over the candles"],
          ["Bollinger Bands", "Length 20, 2 standard deviations", "Over the candles, with the band shaded"],
          ["VWAP", "Resets at 00:00 UTC", "Over the candles"],
          ["Relative Strength Index (RSI)", "Length 14", "Own pane, with 70 and 30 levels"],
          ["MACD", "Fast 12, slow 26, signal 9", "Own pane"],
          ["Stochastic", "%K 14, %K smoothing 1, %D smoothing 3", "Own pane, with 80 and 20 levels"],
          ["Average True Range (ATR)", "Length 14", "Own pane"],
        ]}
      />
      <p>
        Each indicator has a legend row that shows its values at the candle under your cursor. From the row you can hide
        it, open its settings to change lengths and color, or remove it. Your indicators are remembered across markets
        and visits.
      </p>

      <H2 id="drawings">Drawing tools</H2>
      <p>The tool column on the left of the chart has:</p>
      <Table
        head={["Tool", "Shortcut", "What it is for"]}
        rows={[
          ["Cursor", kbd("Esc"), "Select, move and reshape drawings"],
          ["Trend line", kbd("Alt+T"), "A line between two points"],
          ["Ray", "", "A line from one point through another, extended to the right"],
          ["Extended line", "", "A line through two points, extended both ways"],
          ["Parallel channel", "", "Two parallel lines around a trend"],
          ["Horizontal line", kbd("Alt+H"), "A price level across the chart"],
          ["Vertical line", kbd("Alt+V"), "A moment in time"],
          ["Fib retracement", kbd("Alt+F"), "Levels 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1 and 1.618 between two points"],
          ["Fib extension", "", "A swing projected from where its pullback ended: 0.618, 1, 1.272, 1.618, 2 and 2.618"],
          ["Rectangle", kbd("Alt+R"), "A price and time zone"],
          ["Measure", kbd("Alt+M"), "The price change, percent and time between two points"],
          ["Long position", kbd("Alt+L"), "Plan a long with entry, target and stop, and its risk to reward"],
          ["Short position", kbd("Alt+S"), "Plan a short the same way"],
          ["Arrow", "", "Point at something"],
          ["Brush", "", "Draw freehand"],
          ["Text note", kbd("Alt+N"), "Write a note on the chart. Enter keeps it, Escape leaves it as it was"],
        ]}
      />
      <p>Pressing a tool&apos;s shortcut again puts the tool down.</p>

      <H3>Drawing and editing</H3>
      <ul>
        <li>Draw by pressing and dragging, or by clicking each point in turn. {kbd("Esc")} cancels a drawing in progress.</li>
        <li>With the cursor, click a drawing to select it, drag it to move it, or drag one of its handles to reshape it.</li>
        <li>{kbd("Delete")} or {kbd("Backspace")} removes the selected drawing.</li>
        <li>Undo and redo drawing changes with the buttons above the chart, or {kbd("Ctrl+Z")} to undo and {kbd("Ctrl+Shift+Z")} or {kbd("Ctrl+Y")} to redo ({kbd("Cmd")} on a Mac).</li>
      </ul>

      <H3>Tool options</H3>
      <ul>
        <li><strong>Magnet</strong> snaps each point to the nearest open, high, low or close of the candle under it.</li>
        <li><strong>Stay in drawing mode</strong> keeps the tool selected after each drawing, for several in a row.</li>
        <li><strong>Lock</strong> stops drawings from being moved by accident.</li>
        <li><strong>Hide</strong> hides every drawing without deleting it; <strong>Remove all</strong> needs a second click to confirm.</li>
      </ul>
      <p>
        Drawings are anchored to time and price, so they stay in place when you change the interval. Each market keeps
        its own drawings.
      </p>

      <H2 id="trading-overlays">Your trades on the chart</H2>
      <p>
        Open positions are drawn with lines for entry, take profit, stop loss and liquidation price, and resting limit
        orders with their price. They move with the chart and update as you edit them.
      </p>

      <Note>
        <p>
          Indicators and drawings live only in your browser, even when you are signed in. They are not part of the
          ledger and are not published.
        </p>
      </Note>
    </Doc>
  );
}
