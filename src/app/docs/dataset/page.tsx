import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("dataset");

const REPO = "https://github.com/KinfieldLabs/kinfield-datasets";

export default function Page() {
  return (
    <Doc slug="dataset">
      <p>
        The Kinfield open dataset holds the trades of everyone who chose to share them: each decision with the market
        context it was made in, the action, the intent and the outcome, together with the hash-chained ledger every
        trade can be checked against. It lives at <a href={REPO}>KinfieldLabs/kinfield-datasets</a> on GitHub.
      </p>

      <H2 id="who">Whose trades are in it</H2>
      <ul>
        <li>Only signed-in traders who chose to share. Kinfield asks once after your first sign-in, and publishes nothing before you answer.</li>
        <li>Guest trades are never published; they never leave your browser.</li>
        <li>
          Agents appear under their Kinfield names, such as <code>KIN001</code>. A GitHub username appears only if its
          owner chose to show it.
        </li>
        <li>Written reasons are private unless their owner shares them; otherwise only a salted commitment is published.</li>
      </ul>

      <H2 id="schedule">When it is published</H2>
      <p>
        Every night at 03:00 UTC, a scheduled job rebuilds the dataset from the ledger and commits it to the repository.
        Only agents whose files changed are sent, and every file is generated deterministically, so an unchanged record
        produces byte-identical files and no diff. The commit message lists which agents were updated, renamed or
        withdrawn.
      </p>
      <p>
        Turning sharing off, or deleting your account, removes your agent&apos;s folder at the next publish. Earlier
        versions remain in the repository&apos;s git history.
      </p>

      <H2 id="layout">What is in it</H2>
      <Table
        head={["Path", "Contents"]}
        rows={[
          [<code key="1">agents.json</code>, "One row per agent, with headline stats, most trades first"],
          [<code key="2">README.md</code>, "An overview, the readiness thresholds, and a table of agents"],
          [<code key="3">verify.mjs</code>, "The verifier: checks everything below with no dependencies"],
          [<code key="4">agents/&lt;agent&gt;/summary.json</code>, "Stats and readiness for each simulated account, with each ledger's length and head hash"],
          [<code key="5">agents/&lt;agent&gt;/trades.jsonl</code>, "Every closed trade the person made, one JSON object per line"],
          [<code key="6">agents/&lt;agent&gt;/autonomous.jsonl</code>, "Trades the agent made on its own account, if any"],
          [<code key="7">agents/&lt;agent&gt;/ledger/&lt;account&gt;.jsonl</code>, "The full hash chain of each account, archived ones included"],
        ]}
      />

      <H2 id="trade-record">The trade record</H2>
      <p>
        Each line of <code>trades.jsonl</code> and <code>autonomous.jsonl</code> is one closed trade, ordered by close
        time:
      </p>
      <Code label="trades.jsonl, one line, formatted">{`
{
  "position_id": "4f1c2a0e-6c1b-4f7e-9a51-0b8d2f6e7c11",
  "account_id": "a3d9...",
  "order_id": null,
  "decided_by": "human",
  "market": "BTC",
  "type": "market",
  "opened_at": "2026-11-17T13:05:41.880Z",
  "closed_at": "2026-11-17T14:32:05.112Z",
  "context": {
    "ret5m": 0.00118, "ret15m": 0.00342, "ret60m": -0.00591,
    "vol15m": 0.00071, "rangePos60m": 0.62, "volumeRatio": 1.84
  },
  "action": {
    "side": "long", "size_usd": 10000, "leverage": 5,
    "entry_px": 100000, "entry_fee_usd": 4.5,
    "tp_px": 104000, "sl_px": 98500
  },
  "intent": {
    "strategy": "Breakout",
    "reason_commitment": "5d0c...a7e2"
  },
  "outcome": {
    "exit_px": 102000, "exit_reason": "manual",
    "pnl_usd": 190.91, "fees_usd": 9.09,
    "return_on_margin": 0.095455, "liquidated": false
  }
}
`}</Code>
      <Table
        head={["Field", "Meaning"]}
        rows={[
          [<code key="a">decided_by</code>, <><code>human</code> in trades.jsonl, <code>agent</code> in autonomous.jsonl. Agent trades add <code>agent_p_long</code>, its probability of up.</>],
          [<code key="b">type</code>, <><code>market</code>, or <code>limit</code> with its <code>order_id</code>.</>],
          [<code key="c">context</code>, <>The six <DocLink to="market-context">market features</DocLink> at the decision, or null if they couldn&apos;t be captured.</>],
          [<code key="d">action</code>, "Side, notional size in USD, leverage, entry price, entry fee, and take profit and stop loss if set."],
          [<code key="e">intent</code>, <>The strategy tag and <code>reason_commitment</code>. If reasons are shared, also <code>reason</code> and <code>reason_salt</code>.</>],
          [<code key="f">outcome.exit_reason</code>, <><code>manual</code>, <code>take_profit</code>, <code>stop_loss</code>, <code>liquidation</code> or <code>time_stop</code>.</>],
          [<code key="g">outcome.pnl_usd</code>, "Realized P&L net of both fees."],
          [<code key="h">outcome.return_on_margin</code>, "P&L divided by margin (size / leverage)."],
        ]}
      />

      <H2 id="summary">summary.json</H2>
      <Code label="agents/KIN001/summary.json, shortened">{`
{
  "agent": "KIN001",
  "github": null,
  "shares_reasons": false,
  "updated_at": "2026-11-17T14:32:05.230Z",
  "lifetime": { "trades": 142, "wins": 79, "win_rate": 0.5563, ... },
  "autonomous": { "trades": 36, ... },
  "accounts": [
    {
      "account_id": "a3d9...",
      "kind": "human",
      "status": "active",
      "created_at": "2026-10-12T09:14:00.000Z",
      "archived_at": null,
      "starting_balance": 100000,
      "ledger": { "file": "ledger/a3d9....jsonl", "entries": 311, "head": "e07a...5f19" },
      "stats": { ... },
      "readiness": {
        "as_of": "2026-11-17T14:32:05.230Z",
        "checks_met": 5, "checks_total": 7, "meets_all": false,
        "checks": { "days": { "met": true, "value": "30 of 30 days", "needs": "30 days" }, ... }
      }
    }
  ]
}
`}</Code>
      <H3>Stats</H3>
      <p>
        <code>lifetime</code> covers the person&apos;s trades across every account; <code>autonomous</code> the
        agent&apos;s own; each account has its own <code>stats</code>. All use the same fields:
      </p>
      <p>
        <code>trades</code>, <code>wins</code>, <code>win_rate</code>, <code>net_pnl_usd</code>,{" "}
        <code>profit_factor</code>, <code>expectancy_usd</code> (average P&amp;L per trade), <code>max_drawdown</code>,{" "}
        <code>best_trade_share</code>, <code>return</code> (net P&amp;L over the starting balance),{" "}
        <code>active_days</code>, <code>avg_hold_minutes</code>, <code>first_trade_at</code> and{" "}
        <code>last_trade_at</code>. See <DocLink to="readiness" hash="definitions">how each is computed</DocLink>.
      </p>

      <H2 id="agents-json">agents.json</H2>
      <Code>{`
[
  {
    "agent": "KIN001",
    "github": null,
    "trades": 142,
    "win_rate": 0.5563,
    "profit_factor": 1.41,
    "net_pnl": 3120.55,
    "max_drawdown": 0.0712,
    "last_trade_at": "2026-11-17T14:32:05.112Z"
  }
]
`}</Code>

      <H2 id="using">Using it</H2>
      <Code>{`
git clone https://github.com/KinfieldLabs/kinfield-datasets
cd kinfield-datasets
node verify.mjs
`}</Code>
      <p>
        JSONL loads directly in most tools, for example <code>pandas.read_json(path, lines=True)</code> in Python, or
        line by line with <code>JSON.parse</code>. Check it first: see{" "}
        <DocLink to="verify">Verifying the data</DocLink>.
      </p>

      <H2 id="licence">Licence</H2>
      <p>
        The dataset is licensed <strong>CC BY 4.0</strong>. You may share and adapt it for any purpose, including
        training models, as long as you credit Kinfield and link to <a href="https://kinfield.si">kinfield.si</a>.
      </p>
      <Note tone="warn">
        <p>
          All trading in the dataset is simulated, with no real funds. Nothing in it is financial advice, and past
          simulated results don&apos;t predict future performance.
        </p>
      </Note>
    </Doc>
  );
}
