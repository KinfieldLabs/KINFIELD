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

## What's here

- `/` landing page
- `/simulate` trading simulator
  - Live mids, 24h stats, and candles from Hyperliquid's public `info` API (proxied through `/api/hl`)
  - Simulated perp positions with leverage, fees, and liquidation; $100k starting balance (stored in localStorage)
  - Strategy tags and rationale for each trade
  - **Apprentice agent**: a logistic-regression policy trained in the browser on your closed trades
  - Export the trade log as JSONL (context → action → intent → outcome)

## Accounts and the verified ledger

- Sign in with GitHub (public profile only). Sessions are httpOnly cookies; only token hashes are stored.
- Signed-in trades never trust the browser: the server takes the fill price from Hyperliquid,
  computes the entry features itself, enforces margin and leverage caps, and liquidates from
  real 1-minute highs and lows (even while nobody has the page open).
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
