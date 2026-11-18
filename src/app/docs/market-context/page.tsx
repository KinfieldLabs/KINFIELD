import { Code, Doc, DocLink, docMeta, H2, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("market-context");

export default function Page() {
  return (
    <Doc slug="market-context">
      <p>
        At the moment of every decision, Kinfield records six numbers describing what the market was doing. This is
        what an agent &ldquo;sees&rdquo;: the context each trade is learned from, and the <code>context</code> object
        in the open dataset.
      </p>

      <H2 id="features">The six features</H2>
      <Table
        head={["Field", "Shown as", "What it measures"]}
        rows={[
          [<code key="a">ret5m</code>, "5m momentum", "Return over the last 5 minutes"],
          [<code key="b">ret15m</code>, "15m momentum", "Return over the last 15 minutes"],
          [<code key="c">ret60m</code>, "1h momentum", "Return over the last hour"],
          [<code key="d">vol15m</code>, "Volatility", "Standard deviation of the last 15 one-minute returns"],
          [<code key="e">rangePos60m</code>, "Range position", "Where price sits in the last hour's range: 0 at the low, 1 at the high"],
          [<code key="f">volumeRatio</code>, "Volume surge", "Average volume of the last 5 minutes against the hour's average"],
        ]}
      />

      <H2 id="formulas">How they are computed</H2>
      <p>
        From one-minute candles, oldest to newest, with the last close replaced by the fill price. At least 61 candles
        are needed; Kinfield uses the last 90.
      </p>
      <Code>{`
p          = the price the order met
close[k]   = the close k minutes ago (close[0] = p)

ret5m      = p / close[5]  - 1
ret15m     = p / close[15] - 1
ret60m     = p / close[60] - 1

r[i]       = close[i] / close[i+1] - 1        for the last 15 minutes
vol15m     = population standard deviation of r

hi, lo     = highest high and lowest low of the last 60 candles (and p)
rangePos60m = (p - lo) / (hi - lo)             0.5 if hi = lo

volumeRatio = mean volume of last 5 candles / mean volume of last 60
`}</Code>
      <p>
        Returns are fractions, so <code>0.0042</code> means up 0.42%. For example, <code>ret60m: -0.012</code> with{" "}
        <code>rangePos60m: 0.08</code> describes a market down 1.2% on the hour, trading near its low.
      </p>

      <H2 id="when">When it is captured</H2>
      <ul>
        <li>
          <strong>Market orders</strong>: at the fill, from the same Hyperliquid price the order met.
        </li>
        <li>
          <strong>Limit orders</strong>: when the order is placed, not when it fills, because placing it was the
          decision.
        </li>
        <li>
          <strong>Signed in</strong>: Kinfield&apos;s server computes the features itself from Hyperliquid&apos;s
          candles. Nothing the browser sends is used.
        </li>
        <li>
          <strong>As a guest</strong>: your browser computes them from the same candles.
        </li>
      </ul>
      <Note>
        <p>
          If there isn&apos;t enough recent price history (for example, a market listed minutes ago), the context is
          left empty. The trade still counts on your record, but it can&apos;t teach your agent.
        </p>
      </Note>

      <H2 id="example">In the data</H2>
      <Code label="context, as published">{`
{
  "ret5m": 0.00118,
  "ret15m": 0.00342,
  "ret60m": -0.00591,
  "vol15m": 0.00071,
  "rangePos60m": 0.62,
  "volumeRatio": 1.84
}
`}</Code>
      <p>
        See <DocLink to="dataset" hash="trade-record">the trade record</DocLink> for the full schema.
      </p>
    </Doc>
  );
}
