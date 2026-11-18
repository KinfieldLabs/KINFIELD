import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("autonomous");

export default function Page() {
  return (
    <Doc slug="autonomous">
      <p>
        Once you have taught it enough, your agent stops only watching and starts trading: on its own simulated account,
        with its own $100,000, by fixed rules, every 15 minutes. Its trades go through the same verified ledger as
        yours, so its record can be judged and checked the same way.
      </p>

      <H2 id="when">When it starts</H2>
      <p>
        Your agent starts trading after you have closed <strong>30 trades</strong> that can teach it (with market
        context, and closed at a different price from entry), counted across all of your accounts. It needs you to be
        signed in, so its trades are on a ledger. Progress toward 30 shows on <a href="/agent">/agent</a>.
      </p>

      <H2 id="each-run">What happens on each run</H2>
      <p>A scheduled job runs every 15 minutes. For each agent that has been taught enough, it:</p>
      <ol>
        <li>
          <strong>Retrains</strong>, once a day, on all of your closed teaching trades, with the same model as the
          agent panel. See <DocLink to="agent">Your agent</DocLink>.
        </li>
        <li>
          <strong>Settles</strong> its own account: resting triggers are replayed against price history, as for any
          account.
        </li>
        <li>
          <strong>Closes</strong> any of its positions held for more than 24 hours, at the market, marked{" "}
          <em>Time limit</em>.
        </li>
        <li>
          <strong>Decides</strong> in your three most-traded markets, as described below.
        </li>
      </ol>

      <H2 id="deciding">How it decides</H2>
      <p>In each of your three most-traded markets that are still listed on Hyperliquid:</p>
      <ul>
        <li>If it already holds a position there, it holds; one position per market at a time.</li>
        <li>Otherwise it computes the market&apos;s features from the last 90 one-minute candles and asks the model for its probability of up.</li>
        <li>At <strong>60% or more</strong> it goes long; at <strong>40% or less</strong> it goes short; in between it waits.</li>
      </ul>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Confidence to act", "60% for long, 40% or less for short"],
          ["Risk per trade", "1% of equity lost if the stop loss is hit"],
          ["Stop distance", "1.5 times the expected one-hour move, between 0.4% and 5%"],
          ["Take profit", "Twice as far from entry as the stop"],
          ["Position size", "Sized to the risk, at most 1x equity"],
          ["Leverage", "5x, or the market's limit if lower"],
          ["Holding time", "24 hours at most"],
          ["Markets", "Your three most-traded"],
          ["Skipped when", "The position would be under $10, or its stop would sit beyond the liquidation price"],
        ]}
      />

      <H3>Sizing, step by step</H3>
      <Code>{`
expected one-hour move = vol15m x sqrt(60)
stop    = clamp(1.5 x expected one-hour move, 0.4%, 5%)
size    = min(equity x 1% / stop, equity)
stop loss   = entry x (1 - stop)       long  (1 + stop for a short)
take profit = entry x (1 + 2 x stop)   long  (1 - 2 x stop for a short)
`}</Code>
      <Code label="Example: equity $100,000, BTC at $100,000, vol15m 0.0015, 64% confident">{`
expected one-hour move = 0.0015 x 7.746      = 1.16%
stop                   = 1.5 x 1.16%         = 1.74%
size                   = 1,000 / 0.01743     = $57,377 at 5x ($11,475 margin)
stop loss              = $98,257  (loses about $1,000, plus fees)
take profit            = $103,486 (makes about $2,000, less fees)
`}</Code>

      <H2 id="notes">Its notes</H2>
      <p>
        Every trade it opens carries a machine-written reason, for example: <em>Agent: 64% confident long, model trained
        on 42 of your trades. Stop 1.74% away, target 3.49%.</em> The ledger also stores its exact probability with the
        trade. In the open dataset its trades go in their own file, <code>autonomous.jsonl</code>, with these notes
        always included.
      </p>

      <H2 id="watching">Watching it</H2>
      <p>The <strong>Trading on its own</strong> section of <a href="/agent">/agent</a> shows:</p>
      <ul>
        <li>its status (learning, trading or paused) and teaching progress;</li>
        <li>when its model was last trained and on how many trades;</li>
        <li>when it started trading, and what it did, or why it didn&apos;t, on its last run;</li>
        <li>its open positions and closed trades, with its confidence, stop and target, and how each ended;</li>
        <li>its own readiness checks and closed-trade equity, judged on its trades alone.</li>
      </ul>

      <H2 id="pause">Pausing it</H2>
      <p>
        <strong>Pause</strong> on <a href="/agent">/agent</a> stops it from opening anything new. Open positions keep
        their stop loss and take profit and are still settled. <strong>Resume</strong> picks up on the next run.
      </p>

      <Note tone="warn">
        <p>
          The agent only ever trades its simulated account. It can&apos;t place real orders, and nothing it does is a
          recommendation.
        </p>
      </Note>
    </Doc>
  );
}
