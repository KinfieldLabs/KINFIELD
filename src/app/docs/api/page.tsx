import type { ReactNode } from "react";
import Link from "next/link";
import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("api");

function Endpoint({ method, path, auth, children }: { method: string; path: string; auth: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-5 [&>*+*]:mt-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm">
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${method === "GET" ? "bg-long/15 text-long" : "bg-cyan/15 text-cyan"}`}>
          {method}
        </span>
        <span className="text-cream">{path}</span>
        <span className="ml-auto font-sans text-xs text-muted">{auth}</span>
      </p>
      {children}
    </div>
  );
}

export default function Page() {
  return (
    <Doc slug="api">
      <p>
        These are the HTTP endpoints the simulator itself uses, all on <code>https://www.kinfield.si</code>. Requests
        and responses are JSON. They are documented so you can see exactly what the browser can and can&apos;t ask the
        server to do.
      </p>
      <Note>
        <p>
          There are no API keys yet. Endpoints marked <em>Signed in</em> are authenticated by the{" "}
          <code>kf_session</code> cookie set when you sign in with GitHub, and writes from another website are refused.
          The endpoints may change as Kinfield develops.
        </p>
      </Note>

      <H2 id="conventions">Conventions</H2>
      <ul>
        <li>Prices are in US dollars; sizes are notional US dollars; times in responses are Unix milliseconds unless the field is an ISO string.</li>
        <li>Errors return <code>{`{ "error": "message" }`}</code> with a status code, and the message is written to be shown to a person.</li>
        <li>Signed-in responses carry a <code>server-timing</code> header with the server&apos;s time for the request.</li>
      </ul>
      <Table
        head={["Status", "Meaning"]}
        rows={[
          ["400", "The request was invalid, for example a size under $10 or a stop on the wrong side."],
          ["401", "Not signed in: Sign in to continue."],
          ["403", "A write came from another site."],
          ["404", "The order or position isn't open, or doesn't exist."],
          ["409", "The account was reset while the request was in flight."],
          ["429", "A rate limit was hit. See Rate limits below."],
          ["503", "Hyperliquid didn't return a price in time. Nothing was recorded; try again."],
        ]}
      />

      <H2 id="trading">Trading</H2>
      <div className="flex flex-col gap-4">
        <Endpoint method="GET" path="/api/sim/state" auth="Signed in">
          <p>The active account, after settling any triggers since it was last read.</p>
          <Code>{`
{
  "accountId": "a3d9...",
  "startingBalance": 100000,
  "createdAt": 1760260440000,
  "cash": 100190.91,
  "positions": [ /* open positions */ ],
  "orders": [ /* resting limit orders */ ],
  "history": [ /* closed trades, newest first */ ],
  "ledger": { "entries": 311, "head": "e07a...5f19" }
}
`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/sim/orders" auth="Signed in">
          <p>Places a market or limit order.</p>
          <Code label="Request">{`
{
  "coin": "BTC",
  "side": "long",              // "long" or "short"
  "type": "market",            // "market" or "limit"
  "limitPx": null,             // required for "limit"
  "sizeUsd": 10000,            // at least 10
  "leverage": 5,               // capped at the market's limit and 20
  "tpPx": 104000,              // optional
  "slPx": 98500,               // optional
  "strategy": "Breakout",      // one of the seven strategy tags
  "rationale": "Broke the morning high on volume."   // optional, up to 1,000 characters
}
`}</Code>
          <Code label="Response">{`
{
  "position": { /* the new position, for a fill */ },
  "order": { /* the resting order, for a limit that didn't fill */ },
  "cash": 99995.5,
  "fill": { "px": 100000, "at": 1763384741880 },     // the price met, and Hyperliquid's time for it
  "timing": { "priceMs": 84, "serverMs": 131 }
}
`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/sim/positions/{id}/close" auth="Signed in">
          <p>
            Closes a position at the market. Body <code>{`{ "coin": "BTC" }`}</code> is optional and only lets the
            price fetch start sooner. If the position had already hit a trigger, it closes there and{" "}
            <code>triggered</code> is true.
          </p>
          <Code>{`
{ "trade": { /* the closed trade */ }, "cash": 100190.91, "triggered": false, "timing": { "priceMs": 79, "serverMs": 122 } }
`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/sim/positions/{id}/tpsl" auth="Signed in">
          <p>
            Sets or clears take profit and stop loss. Body <code>{`{ "tpPx": 104000, "slPx": null }`}</code>; null or
            an empty string clears a level. Checked against the current price. Returns{" "}
            <code>{`{ "position": { ... } }`}</code>.
          </p>
        </Endpoint>

        <Endpoint method="POST" path="/api/sim/orders/{id}/cancel" auth="Signed in">
          <p>
            Cancels a resting limit order. Returns <code>{`{ "order": { ... } }`}</code>, or 404 if it already filled.
          </p>
        </Endpoint>

        <Endpoint method="POST" path="/api/sim/reset" auth="Signed in">
          <p>
            Archives the active account and starts a new one at $100,000. Returns <code>{`{ "ok": true }`}</code>.
          </p>
        </Endpoint>
      </div>

      <H2 id="account">Account and sharing</H2>
      <div className="flex flex-col gap-4">
        <Endpoint method="GET" path="/api/me" auth="Public">
          <p>Who is signed in, if anyone, their sharing choices, and which sign-in methods this server offers.</p>
          <Code>{`
{
  "user": {
    "login": "octocat", "name": "The Octocat", "avatarUrl": "https://...",
    "sharing": {
      "agentId": "KIN001", "decided": true, "publishData": true,
      "showLogin": false, "publishRationale": false,
      "repo": "KinfieldLabs/kinfield-datasets"
    }
  },
  "signIn": { "available": true, "github": true, "dev": false }
}
`}</Code>
        </Endpoint>
        <Endpoint method="POST" path="/api/me/sharing" auth="Signed in">
          <p>
            Updates any of <code>publishData</code>, <code>showLogin</code> and <code>publishRationale</code> (booleans);
            fields left out are unchanged. Returns <code>{`{ "ok": true }`}</code>.
          </p>
        </Endpoint>
        <Endpoint method="POST" path="/api/me/delete" auth="Signed in">
          <p>
            Deletes the account. The body must repeat your GitHub username: <code>{`{ "confirm": "octocat" }`}</code>.
            See <DocLink to="accounts" hash="delete">Deleting your account</DocLink>.
          </p>
        </Endpoint>
        <Endpoint method="GET" path="/api/auth/github" auth="Public">
          <p>
            Starts GitHub sign-in and returns you to <code>/simulate</code>. <code>POST /api/auth/logout</code> signs
            out.
          </p>
        </Endpoint>
      </div>

      <H2 id="agent">Agent</H2>
      <div className="flex flex-col gap-4">
        <Endpoint method="GET" path="/api/agent/evaluation" auth="Signed in">
          <p>Everything on the <a href="/agent">/agent</a> page:</p>
          <ul>
            <li><code>agentId</code>, <code>publishing</code> and <code>datasetRepo</code>;</li>
            <li>
              <code>accounts</code>: every account, newest first, each with <code>stats</code>,{" "}
              <code>readiness</code> (its checks, passed, total, ready and day), <code>equity</code> points and its
              ledger length and head;
            </li>
            <li>
              <code>autonomous</code>: teaching progress, status, model (samples, accuracy, trained at), last run and
              note, the trading rules, its account&apos;s evaluation, and its open and recent trades.
            </li>
          </ul>
        </Endpoint>
        <Endpoint method="POST" path="/api/agent/control" auth="Signed in">
          <p>
            Pauses or resumes the agent trading on its own: <code>{`{ "paused": true }`}</code>.
          </p>
        </Endpoint>
      </div>

      <H2 id="public">Public</H2>
      <div className="flex flex-col gap-4">
        <Endpoint method="POST" path="/api/hl" auth="Public, 120 a minute per address">
          <p>
            A read-only proxy to Hyperliquid&apos;s info endpoint, used for guest mode and charts. Only the request types{" "}
            <code>allMids</code>, <code>candleSnapshot</code> and <code>metaAndAssetCtxs</code> are allowed, with the
            same body Hyperliquid expects:
          </p>
          <Code>{`
{ "type": "candleSnapshot", "req": { "coin": "BTC", "interval": "1m", "startTime": 1763380000000, "endTime": 1763384741880 } }
`}</Code>
        </Endpoint>
        <Endpoint method="GET" path="/api/agentboard" auth="Public, cached for a minute">
          <p>
            The <Link href="/agentboard">Agentboard</Link>: every agent whose owner shares in the open dataset. Agents
            trading their own simulated account with at least <code>minTrades</code> closed trades are in{" "}
            <code>ranked</code>, ordered by return; those with fewer are in <code>warmingUp</code>. Agents still being
            taught are in <code>learning</code>, with <code>teaching</code> out of <code>minTeaching</code> teaching
            trades and their owner&apos;s record.
            Fractions such as <code>returnPct</code> and <code>winRate</code> are 0 to 1; times are Unix milliseconds;{" "}
            <code>github</code> is null unless the owner chose to show it.
          </p>
          <Code>{`
{
  "updatedAt": 1795124700000,
  "minTrades": 10,
  "minTeaching": 30,
  "ranked": [
    {
      "rank": 1, "agent": "KIN006", "github": null, "status": "trading",
      "trades": 120, "returnPct": 0.1729, "netPnl": 17290.74, "winRate": 0.517,
      "profitFactor": 1.61, "maxDrawdown": 0.057, "passed": 6, "total": 7,
      "openPositions": 1, "startedAt": 1792500000000, "lastTradeAt": 1795110000000
    }
  ],
  "warmingUp": [ { "agent": "KIN008", "trades": 5, "...": "same fields, no rank" } ],
  "learning": [
    {
      "agent": "KIN002", "github": null, "teaching": 7, "needed": 30, "trades": 7,
      "winRate": 0.43, "netPnl": 152.56, "joinedAt": 1794900000000, "lastTradeAt": 1795000000000
    }
  ]
}
`}</Code>
        </Endpoint>
        <Endpoint method="GET" path="/api/agentboard/{agent}" auth="Public, cached for a minute">
          <p>
            One agent&apos;s record, by name (<code>KIN006</code>). While it is learning, <code>stage</code> is{" "}
            <code>&quot;learning&quot;</code> and the record holds its teaching progress, its model if trained, and its
            owner&apos;s record in <code>teacher</code>. Once it trades, <code>stage</code> is{" "}
            <code>&quot;trading&quot;</code> with its <code>rank</code> (null while warming up), the
            full <code>stats</code> and <code>readiness</code> checks, the closed-trade <code>equity</code> curve, open
            positions, its 25 most recent closed trades, the ledger&apos;s entry count and latest hash, and a link to its
            folder in the open dataset. Agents that aren&apos;t shared return 404, the same as names that don&apos;t exist.
          </p>
        </Endpoint>
        <Endpoint method="GET" path="/api/health" auth="Public">
          <p>The server&apos;s region and its round-trip time in milliseconds to its database and to Hyperliquid, measured at most every 15 seconds.</p>
          <Code>{`
{ "region": "iad1", "dbMs": [1.9, 1.2, 1.1], "hyperliquidMs": [86.4, 81.0] }
`}</Code>
        </Endpoint>
      </div>

      <H2 id="limits">Rate limits</H2>
      <Table
        head={["Limit", "Applies to"]}
        rows={[
          ["20 writes in 10 seconds", "Each signed-in person, across all write endpoints"],
          ["30 new trades a minute, 1,000 a day", "Each account's orders; closes are never blocked"],
          ["10 resets a day", "Each person"],
          ["120 requests a minute", "/api/hl, per IP address"],
        ]}
      />

      <H3 id="scheduled">Scheduled jobs</H3>
      <p>
        <code>/api/cron/agents</code> (every 15 minutes) and <code>/api/cron/publish</code> (03:00 UTC) are called by
        the host&apos;s scheduler with a secret bearer token, and refuse anything else. See{" "}
        <DocLink to="self-hosting" hash="jobs">Run Kinfield yourself</DocLink>.
      </p>
    </Doc>
  );
}
