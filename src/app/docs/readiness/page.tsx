import { Code, Doc, DocLink, docMeta, H2, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("readiness");

export default function Page() {
  return (
    <Doc slug="readiness">
      <p>
        A simulated track record is easy to make look good: take tiny profits, never close a loser, or get lucky once.
        The readiness checks ask for what a record would really need to show before anyone should trust it. They are
        computed from the verified ledger, the same record that is published in the open dataset.
      </p>
      <Note tone="warn">
        <p>
          The checks measure a record. Passing them is not a promise of profit, funding or real-money trading, and
          Kinfield does not offer real capital.
        </p>
      </Note>

      <H2 id="checks">The seven checks</H2>
      <Table
        head={["Check", "Needs", "Why"]}
        rows={[
          ["Time", "30 days since the account started", "Long enough to see more than one kind of market."],
          ["Active days", "15 days with a closed trade", "Trading spread across the month, not one lucky session."],
          ["Closed trades", "100", "Enough trades for the numbers to mean something."],
          ["Profit factor", "1.3 or more", "Each dollar lost earned back at least $1.30."],
          ["Max drawdown", "Under 15%", "The worst fall from a peak stayed contained."],
          ["Best trade share", "Under 25% of profit", "Profit came from many trades, not one big win."],
          ["Win rate", "55% or more", "One signal among the others, never enough on its own."],
        ]}
      />
      <p>An account is <strong>ready</strong> only when all seven pass.</p>

      <H2 id="definitions">How each is computed</H2>
      <p>From the account&apos;s closed trades, in the order they closed, with P&amp;L net of fees:</p>
      <Code>{`
days            = whole days since the account was created
active days     = distinct UTC dates on which a trade closed
win             = a trade with P&L above zero
win rate        = wins / trades
gross profit    = sum of winning P&L
gross loss      = sum of losing P&L, as a positive number
profit factor   = gross profit / gross loss
best trade share = largest winning P&L / gross profit
equity          = starting balance + P&L so far, after each close
max drawdown    = largest (peak equity - equity) / peak equity
`}</Code>
      <ul>
        <li>Drawdown is measured on closed-trade equity, so open positions don&apos;t count until they close.</li>
        <li>With no losing trades, profit factor shows as &ldquo;No losing trades&rdquo; and passes once there is profit.</li>
        <li>Drawdown and best trade share need at least one trade, and some profit, before they can pass.</li>
      </ul>

      <H2 id="reading">Reading the report card</H2>
      <p>
        On <a href="/agent">/agent</a>, each check has a bar. For checks you build up to (time, active days, trades,
        profit factor, win rate) the bar shows how far along you are. For limits you stay under (drawdown and best
        trade share) it shows how much of the limit is used, so a full bar is a warning. The page also shows day N of
        the 30-day window, your closed-trade equity against the starting balance, and every account you have had.
      </p>

      <H2 id="accounts">Every account counts</H2>
      <p>
        Each simulated account is judged on its own record, and resetting doesn&apos;t erase one: archived accounts
        stay on the page, judged as they stood when they were archived. That way a bad run can&apos;t be hidden by
        starting over. Your agent&apos;s own account gets its own report card too.
      </p>

      <H2 id="published">In the dataset</H2>
      <p>
        Each account in a published <code>summary.json</code> carries a <code>readiness</code> block, computed as of
        its last ledger entry, so anyone can see the result and recompute it from the published trades. See{" "}
        <DocLink to="dataset" hash="summary">summary.json</DocLink>.
      </p>
    </Doc>
  );
}
