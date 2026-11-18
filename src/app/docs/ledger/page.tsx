import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("ledger");

export default function Page() {
  return (
    <Doc slug="ledger">
      <p>
        A track record is only worth something if nobody, including its owner and Kinfield, can quietly improve it.
        Signed-in trading is built so that the browser never decides anything that matters, and every event is written
        to an append-only hash chain that shows any later edit.
      </p>

      <H2 id="server-side">The browser only sends intentions</H2>
      <p>
        When you place an order, your browser sends what you want: market, side, size, leverage, order type, limit,
        take profit and stop loss prices, strategy and reason. Kinfield&apos;s server then:
      </p>
      <ul>
        <li>fetches the fill price from Hyperliquid itself, for that one market, the moment the order arrives;</li>
        <li>computes the <DocLink to="market-context">market context</DocLink> itself from Hyperliquid&apos;s candles;</li>
        <li>caps leverage at the market&apos;s limit and 20x, and checks free margin;</li>
        <li>writes the position, the new balance and the ledger entry in a single database statement.</li>
      </ul>
      <p>
        Your account is locked and read while the price is in flight, so two orders can&apos;t race each other, and the
        order fills at the price when it reached the server, not after processing.{" "}
        <a href="/api/health">/api/health</a> reports the server&apos;s current latency to its database and to
        Hyperliquid.
      </p>

      <H2 id="replay">Triggers are replayed, not polled</H2>
      <p>
        Resting limit orders, take profit, stop loss and liquidation don&apos;t depend on anyone watching. Each time an
        account is read or changed, and on the agents&apos; 15-minute run, Kinfield replays Hyperliquid&apos;s real
        price history since each order and position was last checked:
      </p>
      <ul>
        <li>one-minute bars where Hyperliquid still has them, then 15-minute and hourly bars further back;</li>
        <li>only bars that start after the last check, so price action from before a position existed never counts;</li>
        <li>then the live price, for anything the bars haven&apos;t covered yet.</li>
      </ul>
      <p>
        A limit fills at its price at the end of the first bar that trades through it, and the new position&apos;s own
        stops are then checked on the bars after. When one bar touches both a protective level and the take profit,
        the worse outcome is recorded. Closing by hand replays the position first, so a stop that was already hit
        can&apos;t be dodged. See <DocLink to="orders" hash="triggers">How triggers are settled</DocLink>.
      </p>

      <H2 id="chain">The hash chain</H2>
      <p>
        Every account has its own chain. Each entry stores its kind, its payload, the previous entry&apos;s hash and its
        own hash:
      </p>
      <Code>{`
genesis    = sha256("kinfield:" + account_id)
hash[n]    = sha256(hash[n-1] + "\\n" + kind + "\\n" + canonical(payload))
`}</Code>
      <p>
        <code>canonical</code> is JSON with object keys sorted alphabetically at every level, no spaces, and fields
        whose value is undefined left out, so the same payload always produces the same text. Because each hash covers
        the one before, changing, removing or reordering any entry changes every hash after it. The last hash, the{" "}
        <strong>head</strong>, therefore stands for the whole history.
      </p>
      <Note>
        <p>
          Each nightly publish of the open dataset is a git commit, so the heads are timestamped in public. An older
          copy of a ledger file must always be a prefix of the newer one; anything else means the record was rewritten.
        </p>
      </Note>

      <H2 id="kinds">Entry kinds</H2>
      <Table
        head={["Kind", "Written when", "Payload fields"]}
        rows={[
          [<code key="1">open</code>, "A market order fills, or a resting limit fills", "position_id, coin, side, size_usd, leverage, entry_px, opened_at, strategy, rationale_commitment, features, tp_px, sl_px, agent_p. A limit fill instead records order_id, type and entry_fee; its commitment and features are on the order entry"],
          [<code key="2">order</code>, "A limit order starts resting", "order_id, coin, side, size_usd, leverage, limit_px, placed_at, strategy, rationale_commitment, features, tp_px, sl_px"],
          [<code key="3">cancel</code>, "A resting order is cancelled", "order_id, cancelled_at"],
          [<code key="4">tpsl</code>, "Take profit or stop loss is changed on an open position", "position_id, tp_px, sl_px, set_at"],
          [<code key="5">close</code>, "A position closes by hand, take profit, stop loss or time limit", "position_id, coin, exit_px, closed_at, pnl, fees, reason"],
          [<code key="6">liquidate</code>, "A position is liquidated", "position_id, coin, exit_px, closed_at, pnl, fees"],
        ]}
      />
      <H3>An entry, as published</H3>
      <Code>{`
{
  "kind": "close",
  "payload": {
    "position_id": "4f1c2a0e-...",
    "coin": "BTC",
    "exit_px": 102000,
    "closed_at": "2026-11-17T14:32:05.112Z",
    "pnl": 190.91,
    "fees": 9.09,
    "reason": "manual"
  },
  "prev_hash": "9b2e...c41d",
  "hash": "e07a...5f19",
  "recorded_at": "2026-11-17T14:32:05.230Z"
}
`}</Code>
      <p>
        Times inside payloads are when the event happened in the market (Hyperliquid&apos;s time for a fill, or the end
        of the bar a trigger hit). <code>recorded_at</code> is when Kinfield wrote the entry.
      </p>

      <H2 id="reasons">Reasons on the ledger</H2>
      <p>
        The ledger never holds your written reason, only <code>rationale_commitment</code>, a salted hash of it. See{" "}
        <DocLink to="strategies" hash="privacy">Reasons stay private by default</DocLink>.
      </p>

      <H2 id="resets">Resets and history</H2>
      <p>
        Resetting archives the account and starts a new one with a new chain. Nothing is deleted: the archived chain
        stays complete, stays on your record and, if you share, stays published. Only deleting your account removes
        your data. See <DocLink to="accounts" hash="delete">Deleting your account</DocLink>.
      </p>

      <H2 id="limits">What the ledger does and doesn&apos;t prove</H2>
      <ul>
        <li>
          <strong>It proves</strong> the published history is complete and unedited since it was published, that every
          trade in the dataset matches the entries that opened and closed it, and that a published reason is the one
          recorded at the time.
        </li>
        <li>
          <strong>It relies on</strong> Kinfield&apos;s server having priced fills honestly from Hyperliquid. Fill
          prices and times can be compared against Hyperliquid&apos;s public candles.
        </li>
        <li>
          <strong>It does not prove</strong> that a strategy would work with real money. See{" "}
          <DocLink to="orders" hash="differences">How it differs from a real exchange</DocLink>.
        </li>
      </ul>
    </Doc>
  );
}
