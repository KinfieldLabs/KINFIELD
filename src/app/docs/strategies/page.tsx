import { Code, Doc, DocLink, docMeta, H2, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("strategies");

export default function Page() {
  return (
    <Doc slug="strategies">
      <p>
        A trade on its own says what you did. A strategy tag and a written reason say why. Kinfield asks for both on
        every order and keeps them with the trade for good, so the record holds your intent alongside the market
        context and the outcome.
      </p>

      <H2 id="tags">Strategy tags</H2>
      <p>Every order carries exactly one strategy. Pick the one closest to your idea:</p>
      <Table
        head={["Tag", "Use it when"]}
        rows={[
          ["Momentum", "You are following a move that is already under way."],
          ["Mean reversion", "You expect a stretched price to come back toward its average."],
          ["Breakout", "Price is leaving a range or level and you expect it to keep going."],
          ["Range", "You are trading between support and resistance in a sideways market."],
          ["News / event", "A headline, listing, unlock or other event is behind the trade."],
          ["Hedge", "The trade offsets risk from another position."],
          ["Other", "None of the above. The agent's own trades are tagged Other."],
        ]}
      />

      <H2 id="reasons">Written reasons</H2>
      <p>
        The reason field is free text, up to 1,000 characters, and optional. A sentence is plenty: what you saw, what
        you expect, and what would prove you wrong. For example:
      </p>
      <Code>{`
Momentum: broke above the morning high on rising volume.
Expect a run to 104k. Wrong if it closes back under 101.5k.
`}</Code>
      <p>
        You can&apos;t edit a reason after placing the order. That is on purpose: a reason written after the outcome is
        known is not the same data.
      </p>

      <H2 id="privacy">Reasons stay private by default</H2>
      <p>
        Your written reasons are private unless you choose to share them. When an order is placed, Kinfield picks a
        random salt for it and records only a commitment to the reason on the ledger:
      </p>
      <Code>{`
reason_commitment = sha256(salt + "\\n" + reason)
`}</Code>
      <p>
        The commitment proves the reason existed when the trade was placed and was never changed, without revealing
        it. The random salt matters: a plain hash of a short reason could be guessed by hashing common phrases; a
        salted one can&apos;t.
      </p>
      <ul>
        <li>
          <strong>Sharing reasons off</strong> (the default): the open dataset publishes the commitment only.
        </li>
        <li>
          <strong>Sharing reasons on</strong>: the dataset also publishes the reason and its salt, so anyone can
          recompute the commitment and confirm the text is exactly what was recorded at the time.
        </li>
      </ul>
      <p>
        The agent&apos;s own trades carry machine-written notes (its confidence, stop and target), which are always
        published.
      </p>

      <H2 id="used-for">What they are used for today</H2>
      <Note>
        <p>
          Your agent currently learns from the market context and outcome of each trade. Strategy tags and reasons are
          recorded, kept on the ledger and published if you share, but not yet used in training. They are there so
          future models, and anyone using the dataset, can learn from intent as well as action.
        </p>
      </Note>
      <p>
        Read on: <DocLink to="market-context">Market context</DocLink> describes what is recorded about the market,
        and <DocLink to="agent">Your agent</DocLink> how it is used.
      </p>
    </Doc>
  );
}
