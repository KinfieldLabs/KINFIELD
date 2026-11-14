# Kinfield

**Teach agents to trade.** Simulate strategies. Train intelligence.

Kinfield is a paper-trading simulator on live Hyperliquid market data. Every trade you make, tagged with a strategy and rationale, becomes a labeled training example for AI trading agents.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

## What's here

- `/` landing page
- `/simulate` trading simulator
  - Live mids, 24h stats, and candles from Hyperliquid's public `info` API (proxied through `/api/hl`)
  - Simulated perp positions with leverage, fees, and liquidation; $100k starting balance (stored in localStorage)
  - Strategy tags and rationale for each trade
  - **Apprentice agent**: a logistic-regression policy trained in the browser on your closed trades
  - Export the trade log as JSONL (context → action → intent → outcome)

## Layout

- `src/lib/hyperliquid.ts` market data client
- `src/lib/sim.ts` simulator state, PnL, liquidation, JSONL export
- `src/lib/features.ts` market features captured at entry
- `src/lib/agent.ts` apprentice agent
- `src/components/sim/*` terminal UI
