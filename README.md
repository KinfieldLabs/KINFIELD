# Kinfield

**Teach agents to trade.** Simulate strategies. Train intelligence.

Kinfield is a paper-trading simulator on live Hyperliquid market data. Every trade you make, tagged with a strategy and rationale, becomes a labeled training example for AI trading agents.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Without a database the simulator runs in guest mode (trades stay in the browser).
To enable accounts:

```bash
cp .env.example .env.local     # set DATABASE_URL and GitHub OAuth keys
createdb kinfield              # or use a hosted Postgres (Neon, Supabase, ...)
npm run db:migrate
npm run db:verify              # recompute every account's ledger hash chain
```

Migrations only ever add to the schema, so run `npm run db:migrate` against production
before deploying the code that needs them; the live release keeps working in between.

## What's here

- `/` landing page
- `/simulate` trading terminal
  - Every Hyperliquid perp, with live candles, order book, trades and market stats over Hyperliquid's public WebSocket
  - Market and limit orders, take profit / stop loss, leverage up to 20x, maker and taker fees, liquidation
  - Positions, open orders and trade history (with why each trade ended), drawn on the chart
  - Indicators and drawing tools on the chart (see [Chart tools](#chart-tools))
  - Strategy tags and a reason for each trade
  - **Your agent**: a logistic-regression policy trained in the browser on your closed trades
  - Export the trade log as JSONL (context → action → intent → outcome)
  - Guest mode keeps trades in the browser (market orders only); signing in uses the verified ledger

## Chart tools

The terminal's chart is TradingView's open source
[lightweight-charts](https://github.com/tradingview/lightweight-charts), with indicators
and drawing tools built on it.

**Indicators** (the Indicators button above the chart) follow TradingView's definitions,
so their values match a TradingView chart of the same candles.

| Indicator | Defaults | Shown |
| --- | --- | --- |
| Moving Average | 20 | Over the candles |
| EMA | 20 | Over the candles |
| Bollinger Bands | 20, 2 | Over the candles, the band shaded |
| VWAP | Resets 00:00 UTC | Over the candles |
| RSI | 14 | Own pane, 70 and 30 levels |
| MACD | 12, 26, 9 | Own pane |
| Stochastic | 14, 1, 3 | Own pane, 80 and 20 levels |
| ATR | 14 | Own pane |

Each indicator's legend row shows its values at the candle under the cursor, and can
hide it, open its settings (lengths and color) or remove it. Indicators are remembered
in the browser across markets.

**Drawing tools** (the column left of the chart): trend line, horizontal line, vertical
line, Fibonacci retracement, rectangle, measure, and long and short positions with their
risk to reward. Drawings are anchored to time and price, so they stay put when the
interval changes, and each market keeps its own in the browser.

- Draw by pressing and dragging, or by clicking each point; Escape cancels
- With the cursor, click a drawing to select it, drag it to move it, or drag a handle to reshape it; Delete or Backspace removes it
- The magnet snaps points to the candle's nearest open, high, low or close
- Drawings can be hidden without deleting them, or all removed with a second click

Shortcuts: Alt+T trend line, Alt+H horizontal line, Alt+V vertical line, Alt+F Fib
retracement, Alt+R rectangle, Alt+M measure, Alt+L long, Alt+S short, Esc cursor.

## Accounts and the verified ledger

- Sign in with GitHub (public profile only). Sessions are httpOnly cookies; only token hashes are stored.
- Signed-in trades never trust the browser: the server takes the fill price from Hyperliquid,
  computes the entry features itself, and enforces margin and leverage caps.
- Market orders fill at Hyperliquid's mid for that market, fetched fresh the moment the order
  arrives (never a cached price) and timestamped by Hyperliquid; the account is locked and read
  while that price is in flight, and the position, cash and ledger entry are written in one
  statement. Closing by hand first replays that position's price history, so a stop that was
  already hit can't be dodged. `/api/health` reports the server's latency to the database and to
  Hyperliquid.
- Resting limit orders, take profit, stop loss and liquidation are replayed against real price
  history (1-minute bars, then 15-minute and hourly further back), so they fire at the right
  price and time even while nobody has the page open. When one bar touches both a protective
  level and the take profit, the worse outcome is recorded.
- Every fill is appended to a hash-chained `ledger` table, so a published dataset can be
  checked against Kinfield's record. Reset archives an account; it never deletes history.

## Readiness (`/agent`)

Each signed-in agent gets a report card judged on its verified ledger: time (30 days), active days (15),
closed trades (100), profit factor (1.3), max drawdown (under 15%), best trade's share of profit (under 25%),
and win rate (55%, one signal among the others). Every account, including archived ones, stays on the record.
The checks live in `src/lib/readiness.ts` and are published with each account in the open dataset.
Real-capital funding is not offered.

## Agent names

Every signed-in person's agent is named in Kinfield's own series, `KIN001`, `KIN002` and on, in the order
they signed up (`users.agent_id`, migration `005`). Names are assigned, never chosen, so the open dataset
stays pseudonymous and no agent can pose as another. Sign-in updates returning users before inserting, so
only a first sign-in takes a number.

## The agent trading on its own

Once a person has closed 30 trades with market context, their agent trades its own simulated
account (`/api/cron/agents`, every 15 minutes, in `vercel.json`). Each run it retrains daily on the person's
trades, closes positions held over 24 hours, and in their three most-traded markets acts only at 60%
confidence or more, risking 1% of its account (capped at 1x equity per position) with a volatility-scaled
stop and a target twice as far. Its trades go through the same verified ledger, get their own readiness
checks on `/agent`, and are published as `autonomous.jsonl`. Rules live in `src/server/autonomous.ts`.

## Open dataset

Users who choose to share (asked once after sign-in; nothing is published before that) are
published nightly to [KinfieldLabs/kinfield-datasets](https://github.com/KinfieldLabs/kinfield-datasets)
under their agent's KIN name:

- `agents/<agent>/trades.jsonl`: closed trades (context, action, intent, outcome)
- `agents/<agent>/ledger/<account>.jsonl`: the hash chain every trade is checked against
- `agents/<agent>/summary.json`: stats per account and ledger heads
- `verify.mjs` ([source](dataset/verify.mjs)): recomputes every chain and checks every trade

Written reasons stay private unless the user shares them: the ledger records a salted commitment,
and sharing a reason publishes its salt so it can be checked. Turning sharing off removes the
agent's folder at the next publish.

The job is `/api/cron/publish` (scheduled in `vercel.json`, authorised by `CRON_SECRET`). It writes
through a GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`) installed only on the dataset
repository, and sends only agents whose files changed. Locally, `?dry=1` writes the dataset to
`DATASET_OUT_DIR` instead.

## Layout

- `src/lib/hyperliquid.ts` market data client
- `src/lib/sim-core.ts` simulator rules shared by browser and server
- `src/lib/sim.ts` guest-mode simulator (localStorage)
- `src/lib/account.ts` sign-in state and the server-backed ledger hook
- `src/server/*` database, GitHub OAuth, ledger, server-side market data
- `src/app/api/auth/*`, `src/app/api/sim/*` account and trading API
- `src/server/dataset.ts`, `publish.ts`, `github-app.ts` the open dataset and its publisher
- `src/lib/stats.ts` track-record statistics
- `dataset/verify.mjs` the verifier shipped with the dataset
- `db/` SQL migrations, migrate and verify scripts
- `src/lib/features.ts` market features captured at entry
- `src/lib/agent.ts` apprentice agent
- `src/components/sim/*` terminal UI
- `src/lib/indicators.ts` indicator math
- `src/components/sim/chart/*` indicators on the chart: definitions, series, menu, legend and settings
- `src/components/sim/chart/drawings/*` drawing tools: the drawings, their canvas layer, pointer handling and the tool column
