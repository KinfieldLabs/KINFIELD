import { Code, Doc, DocLink, docMeta, H2, H3, Note } from "@/components/docs/Doc";

export const metadata = docMeta("verify");

export default function Page() {
  return (
    <Doc slug="verify">
      <p>
        You don&apos;t have to trust Kinfield&apos;s numbers. Every publish of the open dataset ships with{" "}
        <code>verify.mjs</code>, a short script with no dependencies that rechecks every chain, every trade and every
        shared reason. Its source is also in the{" "}
        <a href="https://github.com/KinfieldLabs/KINFIELD/blob/main/dataset/verify.mjs">Kinfield repository</a>.
      </p>

      <H2 id="run">Run it</H2>
      <p>You need Node.js 18 or newer.</p>
      <Code>{`
git clone https://github.com/KinfieldLabs/kinfield-datasets
cd kinfield-datasets
node verify.mjs            # every agent
node verify.mjs KIN001     # one agent
`}</Code>
      <Code label="Output">{`
✓ KIN001: 2 account(s), 178 trades, chain intact
✓ KIN002: 1 account(s), 64 trades, chain intact

All 2 agent(s) verified
`}</Code>
      <p>
        It exits with code 0 when everything checks out and 1 when anything fails, listing up to 20 problems per agent,
        so it can run in CI.
      </p>

      <H2 id="checks">What it checks</H2>
      <p>For every agent, and every one of its accounts:</p>
      <ol>
        <li>
          <strong>The chain.</strong> Starting from <code>sha256(&quot;kinfield:&quot; + account_id)</code>, it
          recomputes every entry&apos;s hash and checks it against both the entry&apos;s <code>hash</code> and the
          next entry&apos;s <code>prev_hash</code>.
        </li>
        <li>
          <strong>The summary.</strong> The chain&apos;s length and head must match the <code>ledger</code> block in{" "}
          <code>summary.json</code>.
        </li>
        <li>
          <strong>Every trade.</strong> Each record in <code>trades.jsonl</code> and <code>autonomous.jsonl</code> must
          have a matching <code>open</code> entry and a <code>close</code> or <code>liquidate</code> entry, and agree
          with them on market, side, size, leverage, entry price, exit price, P&amp;L, fees and how it ended.
        </li>
        <li>
          <strong>Every reason.</strong> The published <code>reason_commitment</code> must match the one recorded when
          the trade, or its limit order, was placed. Where a reason is shared, <code>sha256(reason_salt + &quot;\n&quot; + reason)</code>{" "}
          must equal that commitment.
        </li>
      </ol>

      <H2 id="history">Checking history across publishes</H2>
      <p>
        Each nightly publish is a git commit, so the repository&apos;s history is a public, timestamped series of
        heads. Since every entry commits to the one before, an older version of a ledger file must always be a prefix
        of the newer one. To check that nothing was rewritten between two dates:
      </p>
      <Code>{`
# the ledger file as it was in an older commit
git show <old-commit>:agents/KIN001/ledger/<account>.jsonl > old.jsonl

# the older file must be exactly the start of the current one
head -c $(wc -c < old.jsonl) agents/KIN001/ledger/<account>.jsonl | cmp - old.jsonl && echo "prefix: ok"
`}</Code>
      <p>
        Ledger files are named by account id, which never changes, so a ledger can be followed even if its agent&apos;s
        folder was renamed.
      </p>

      <H2 id="by-hand">Recomputing a hash by hand</H2>
      <p>The whole algorithm fits in a few lines, in any language. In Node:</p>
      <Code>{`
import { createHash } from "node:crypto";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const canonical = (v) =>
  Array.isArray(v) ? \`[\${v.map(canonical).join(",")}]\`
  : v && typeof v === "object"
    ? \`{\${Object.keys(v).sort().filter((k) => v[k] !== undefined)
        .map((k) => \`\${JSON.stringify(k)}:\${canonical(v[k])}\`).join(",")}}\`
    : JSON.stringify(v);

let prev = sha(\`kinfield:\${accountId}\`);
for (const e of entries) {
  const h = sha(\`\${prev}\\n\${e.kind}\\n\${canonical(e.payload)}\`);
  if (h !== e.hash || e.prev_hash !== prev) throw new Error("chain broken");
  prev = h;
}
// prev is now the head, and must equal summary.json's ledger.head
`}</Code>
      <H3>And a shared reason</H3>
      <Code>{`
sha(\`\${trade.intent.reason_salt}\\n\${trade.intent.reason}\`) === trade.intent.reason_commitment
`}</Code>

      <H2 id="prices">Checking prices against Hyperliquid</H2>
      <p>
        The chain proves the record wasn&apos;t edited after the fact. To check the fills themselves, compare each
        trade&apos;s entry and exit prices and times with Hyperliquid&apos;s public one-minute candles for that market:
        a market fill should sit within that minute&apos;s range, and a triggered exit at its take profit, stop loss or
        liquidation price inside the bar that reached it.
      </p>
      <Note>
        <p>
          Found something that doesn&apos;t add up? Email{" "}
          <a href="mailto:kinfieldlabs@proton.me">kinfieldlabs@proton.me</a>. How the record
          is kept is described in <DocLink to="ledger">The verified ledger</DocLink>.
        </p>
      </Note>
    </Doc>
  );
}
