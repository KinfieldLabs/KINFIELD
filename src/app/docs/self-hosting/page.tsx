import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("self-hosting");

export default function Page() {
  return (
    <Doc slug="self-hosting">
      <p>
        Kinfield&apos;s source is on <a href="https://github.com/KinfieldLabs/KINFIELD">GitHub</a>. It is a Next.js app
        with a Postgres database, and it runs locally in a few minutes. Without a database it runs in guest mode only.
      </p>

      <H2 id="stack">The stack</H2>
      <ul>
        <li>Next.js 15 (App Router), React 19 and Tailwind CSS 4, in TypeScript.</li>
        <li>Postgres through the <code>postgres</code> client; plain SQL migrations.</li>
        <li>TradingView&apos;s lightweight-charts for the chart.</li>
        <li>Hyperliquid&apos;s public info API and WebSocket for market data. No Hyperliquid account or key is needed.</li>
        <li>Deployed on Vercel, whose cron runs the two scheduled jobs.</li>
      </ul>

      <H2 id="guest">Run it in guest mode</H2>
      <p>You need Node.js 20 or newer.</p>
      <Code>{`
git clone https://github.com/KinfieldLabs/KINFIELD
cd KINFIELD
npm install
npm run dev      # http://localhost:3000
`}</Code>
      <p>The simulator works straight away as a guest, with live Hyperliquid data and trades kept in the browser.</p>

      <H2 id="accounts">Add accounts and the ledger</H2>
      <Code>{`
cp .env.example .env.local     # then fill in DATABASE_URL
createdb kinfield              # or use a hosted Postgres
npm run db:migrate
npm run dev
`}</Code>
      <p>
        For local sign-in without GitHub, set <code>DEV_LOGIN=1</code>. A <strong>Dev sign-in</strong> button then signs
        you in as a fixed test user. It is ignored in production builds.
      </p>
      <H3>GitHub sign-in</H3>
      <p>
        Create an OAuth app at <a href="https://github.com/settings/developers">github.com/settings/developers</a> with
        homepage <code>http://localhost:3000</code> and callback URL{" "}
        <code>http://localhost:3000/api/auth/github/callback</code>, then set <code>GITHUB_CLIENT_ID</code> and{" "}
        <code>GITHUB_CLIENT_SECRET</code>.
      </p>

      <H2 id="env">Environment variables</H2>
      <Table
        head={["Variable", "Needed for", "Notes"]}
        rows={[
          [<code key="1">DATABASE_URL</code>, "Accounts, ledger, agents", "Any Postgres connection string."],
          [<code key="2">GITHUB_CLIENT_ID</code>, "GitHub sign-in", "From your OAuth app."],
          [<code key="3">GITHUB_CLIENT_SECRET</code>, "GitHub sign-in", "From your OAuth app."],
          [<code key="4">DEV_LOGIN</code>, "Local sign-in", <><code>1</code> to enable. Never active in production.</>],
          [<code key="5">CRON_SECRET</code>, "Scheduled jobs", "A long random string, sent as a bearer token."],
          [<code key="6">GITHUB_APP_ID</code>, "Dataset publishing", "A GitHub App installed only on the dataset repository."],
          [<code key="7">GITHUB_APP_PRIVATE_KEY</code>, "Dataset publishing", "That app's private key."],
          [<code key="8">DATASET_REPO</code>, "Dataset publishing", <>Defaults to <code>KinfieldLabs/kinfield-datasets</code>.</>],
          [<code key="9">DATASET_OUT_DIR</code>, "Local dry runs", "Where a dry-run publish writes the dataset."],
        ]}
      />

      <H2 id="migrations">Migrations</H2>
      <p>
        Migrations live in <code>db/migrations</code> and only ever add to the schema, so the live release keeps working
        while a new one runs. Run them before deploying the code that needs them.
      </p>
      <Table
        head={["Migration", "Adds"]}
        rows={[
          [<code key="1">001_init</code>, "Users, sessions, simulated accounts, positions and the ledger"],
          [<code key="2">002_orders_tpsl</code>, "Resting limit orders, take profit and stop loss"],
          [<code key="3">003_dataset</code>, "Sharing choices, reason salts and publish tracking"],
          [<code key="4">004_autonomous_agent</code>, "Agent accounts, agent state and run history"],
          [<code key="5">005_kin_agent_names</code>, "KIN agent names"],
        ]}
      />
      <p>
        <code>npm run db:verify</code> recomputes every account&apos;s hash chain in the database and reports any break.
      </p>

      <H2 id="jobs">Scheduled jobs</H2>
      <p>
        <code>vercel.json</code> schedules two jobs. Vercel calls them with <code>Authorization: Bearer $CRON_SECRET</code>;
        without the secret they refuse to run.
      </p>
      <Table
        head={["Path", "Schedule", "Does"]}
        rows={[
          [<code key="1">/api/cron/agents</code>, "Every 15 minutes", <>Runs every taught agent. See <DocLink key="a" to="autonomous">The agent trading on its own</DocLink>.</>],
          [<code key="2">/api/cron/publish</code>, "03:00 UTC daily", <>Publishes the open dataset. See <DocLink key="d" to="dataset">The open dataset</DocLink>.</>],
        ]}
      />
      <p>To try them locally:</p>
      <Code>{`
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/agents
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/publish?dry=1"
`}</Code>
      <p>
        <code>?dry=1</code> writes the whole dataset to <code>DATASET_OUT_DIR</code> (or a temporary folder) instead of
        GitHub, so you can inspect it and run <code>node verify.mjs</code> on it. Dry runs are refused in production.
      </p>

      <H2 id="code">Where things are</H2>
      <Table
        head={["Path", "What it holds"]}
        rows={[
          [<code key="1">src/lib/sim-core.ts</code>, "Simulator rules shared by the browser and the server: fees, margin, triggers, liquidation"],
          [<code key="2">src/lib/sim.ts</code>, "Guest mode, kept in local storage"],
          [<code key="3">src/lib/features.ts</code>, "The market context captured at entry"],
          [<code key="4">src/lib/agent.ts</code>, "The agent's model"],
          [<code key="5">src/lib/readiness.ts</code>, "The readiness checks"],
          [<code key="6">src/lib/stats.ts</code>, "Track-record statistics"],
          [<code key="7">src/lib/hyperliquid.ts</code>, "Market data in the browser"],
          [<code key="8">src/server/ledger.ts</code>, "Orders, fills, trigger replay and the hash chain"],
          [<code key="9">src/server/market.ts</code>, "Server-side prices and candles"],
          [<code key="10">src/server/autonomous.ts</code>, "The agent trading on its own"],
          [<code key="11">src/server/dataset.ts</code>, "Building the open dataset"],
          [<code key="12">src/server/publish.ts</code>, "Publishing it through the GitHub App"],
          [<code key="13">dataset/verify.mjs</code>, "The verifier shipped with the dataset"],
          [<code key="14">src/components/sim/</code>, "The terminal's interface, chart tools included"],
        ]}
      />
      <Note>
        <p>
          A self-hosted copy has its own users, ledger and agents. Its records aren&apos;t part of Kinfield&apos;s
          dataset unless it publishes its own.
        </p>
      </Note>
    </Doc>
  );
}
