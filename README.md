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
  - Strategy tags and a reason for each trade
  - **Apprentice agent**: a logistic-regression policy trained in the browser on your closed trades
  - Export the trade log as JSONL (context → action → intent → outcome)
  - Guest mode keeps trades in the browser (market orders only); signing in uses the verified ledger

## Accounts and the verified ledger

- Sign in with GitHub (public profile only). Sessions are httpOnly cookies; only token hashes are stored.
- Signed-in trades never trust the browser: the server takes the fill price from Hyperliquid,
  computes the entry features itself, and enforces margin and leverage caps.
- Resting limit orders, take profit, stop loss and liquidation are replayed against real price
  history (1-minute bars, then 15-minute and hourly further back), so they fire at the right
  price and time even while nobody has the page open. When one bar touches both a protective
  level and the take profit, the worse outcome is recorded.
- Every fill is appended to a hash-chained `ledger` table, so a published dataset can be
  checked against Kinfield's record. Reset archives an account; it never deletes history.

## Layout

- `src/lib/hyperliquid.ts` market data client
- `src/lib/sim-core.ts` simulator rules shared by browser and server
- `src/lib/sim.ts` guest-mode simulator (localStorage)
- `src/lib/account.ts` sign-in state and the server-backed ledger hook
- `src/server/*` database, GitHub OAuth, ledger, server-side market data
- `src/app/api/auth/*`, `src/app/api/sim/*` account and trading API
- `db/` SQL migrations, migrate and verify scripts
- `src/lib/features.ts` market features captured at entry
- `src/lib/agent.ts` apprentice agent
- `src/components/sim/*` terminal UI
