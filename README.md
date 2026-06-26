# SBIN Options Scalping Bot

Automated algorithmic trading backend for **State Bank of India (SBIN) options** on the Indian market (NSE), integrated with **Upstox**. The active strategy uses **EMA 9/21 crossover** signals with risk management, entry filters, smart exits, audit logging, and performance tooling.

---

## Tech Stack

| Layer | Technology |
|--------|------------|
| Runtime | Node.js + TypeScript |
| API | Express |
| Database | PostgreSQL + Sequelize |
| Broker | Upstox (REST + WebSocket protobuf feed) |
| Real-time UI feed | Socket.IO |
| Indicators | `technicalindicators` (EMA, RSI, ATR) |
| Scheduling | `node-cron` |

---

## Prerequisites

- Node.js 18+ (tested on 22.x)
- PostgreSQL
- Upstox API credentials (access token stored per user in DB)
- Yarn or npm

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT_SERVER=5004
SESSION_SECERET=your-session-secret

# Database
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres
```

The trading user email is configured in `src/constant/response.types.ts` (`USER_DETAILS.EMAIL`). That user must exist in the `users` table with a valid Upstox `token`.

---

## Setup

```bash
# Install dependencies
yarn install

# Run database migrations
yarn migrate

# Check migration status
yarn migrate:status

# Start dev server (nodemon + ts-node)
yarn start
```

Server listens on `PORT_SERVER` (default from env). Socket.IO path: `/api/socket`.

---

## Database Migrations

Migrations live in `migrations/`. Run with Sequelize CLI:

```bash
yarn migrate          # apply pending migrations
yarn migrate:undo     # rollback last migration
yarn migrate:status   # show applied migrations
```

Key tables created/extended by migrations:

| Table | Purpose |
|-------|---------|
| `strategy_config` | All tunable strategy parameters |
| `strategy_daily_stats` | Per-day trade counts, P&L, halt flags |
| `decision_audit_log` | Every SKIP / ENTER / EXIT / RECONCILE decision |
| `trade_details` | Trades (`net_pl`, `exit_reason`, trailing fields, etc.) |
| `strike_price_details` | Active strikes + bid/ask/OI from feed |

---

## How It Works

### High-level flow

```
Upstox WebSocket tick
  → processMarketFeed()     update LTP, bid/ask/OI, 1m candles
  → throttle (1 second)
  → scalpingEngine.run()
       → market closed?     skip
       → position waiting?  confirm execution (LTP >= buy price)
       → in trade?          monitor exits (trailing, target, SL, EOD…)
       → no position?       scan for CE/PE entry
```

### Entry pipeline (all must pass)

1. **Risk guards** — max trades/day, daily loss limit, cooldown after losses, entry cutoff (3:00 PM)
2. **Dynamic ATM strike** — SBIN LTP → nearest CE/PE from options chain (configurable)
3. **Market quality** — max spread %, min open interest, expiry-day late-entry block
4. **Signal filters** — EMA 9/21 cross, volume, RSI, 5m EMA21 trend, ATR stop/target, min R:R
5. **Position sizing** — risk-based lots capped by `max_lots_per_trade`
6. **Order placement** — always records in DB; Upstox BUY only in `live` mode

### Exit priority (one action per tick)

1. EOD force exit (3:15 PM)
2. Stop loss / trailing stop
3. Max loss per trade
4. Full target
5. Partial profit (half lots at 50% of target distance)
6. EMA reversal
7. Time exit (30 min, flat P&L band)

Live mode places a **SELL** on Upstox before closing the DB record.

### Trading modes (`strategy_config.mode`)

| Mode | Behavior |
|------|----------|
| `paper` | DB-only trades, no Upstox orders (default) |
| `live` | Real orders when `user.is_live = true` |
| `backtest` | Live WebSocket strategy disabled; use backtest API |

---

## Configuration

All parameters live in **`strategy_config`** (row where `strategy_name = 'SCALLPING'`). Created automatically on first run with sensible defaults.

Examples (SQL):

```sql
-- Paper trading (safe default)
UPDATE strategy_config SET mode = 'paper' WHERE strategy_name = 'SCALLPING';

-- Tune entry strictness
UPDATE strategy_config
SET rsi_ce_max = 65, min_rr_ratio = 1.8, max_trades_per_day = 2
WHERE strategy_name = 'SCALLPING';

-- Dynamic ATM, 1 step ITM
UPDATE strategy_config
SET enable_dynamic_atm = true, atm_itm_steps = 1, strike_step = 10
WHERE strategy_name = 'SCALLPING';
```

Important config fields:

| Field | Default | Description |
|-------|---------|-------------|
| `mode` | `paper` | `paper` \| `live` \| `backtest` |
| `risk_per_trade_pct` | 0.01 | 1% account risk per trade |
| `max_trades_per_day` | 3 | Daily entry cap |
| `max_daily_loss` | 5000 | Halt trading after this loss |
| `entry_cutoff_time` | 15:00 | No new entries after |
| `force_exit_time` | 15:15 | Close all open positions |
| `ema_fast` / `ema_slow` | 9 / 21 | Crossover periods |
| `min_rr_ratio` | 1.5 | Minimum reward:risk |
| `max_spread_pct` | 0.02 | Liquidity filter (2%) |
| `min_open_interest` | 10000 | Liquidity filter |
| `enable_dynamic_atm` | true | Auto-select ATM strike |

---

## API Reference

Base URL: `http://localhost:<PORT_SERVER>/api/v1/instrument`

### Scalping — performance & tuning

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scalping-performance?days=30` | GET | KPIs: win rate, profit factor, expectancy, drawdown, skip breakdown |
| `/scalping-optimize` | POST | Backtest parameter sweep; optional `applyBest: true` |
| `/scalping-backtest` | POST | Historical simulation on stored candles |
| `/scalping-audit-log?days=7` | GET | Decision audit log + skip reason counts |

**KPI example:**

```bash
curl "http://localhost:5004/api/v1/instrument/scalping-performance?days=30"
```

**Backtest example:**

```bash
curl -X POST http://localhost:5004/api/v1/instrument/scalping-backtest \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-06-01","endDate":"2026-06-26","signalType":"CE"}'
```

**Optimize (dry run — does not change config):**

```bash
curl -X POST http://localhost:5004/api/v1/instrument/scalping-optimize \
  -H "Content-Type: application/json" \
  -d '{"days": 60, "applyBest": false}'
```

**Optimize and apply best params:**

```bash
curl -X POST http://localhost:5004/api/v1/instrument/scalping-optimize \
  -H "Content-Type: application/json" \
  -d '{"days": 60, "applyBest": true, "params": "min_rr_ratio,rsi_ce_max,atr_stop_multiplier"}'
```

### Trades & dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard-data` | GET | Monthly P&L summary |
| `/trade-history-list` | GET | Paginated trade history |
| `/current-postions` | GET | Open positions |
| `/check-scaplling` | GET | Manual strategy trigger (legacy) |

---

## Background Jobs

| Schedule | File | Purpose |
|----------|------|---------|
| 11:57 PM IST daily | `src/utils/cron.job.ts` | Sync SBIN options chain from Upstox |
| Every 5 min (market hours, Mon–Fri) | `src/utils/reconciliation.cron.ts` | Compare DB open trades vs Upstox positions (`live` mode only) |

---

## Project Structure

```
src/
├── app.ts                              # Express, WebSocket, Socket.IO, throttle
├── services/
│   └── scalping.engine.ts              # State machine orchestrator
├── helpers/
│   ├── scalping.trade.helper.ts        # Feed processing, open/close trades
│   ├── scalping.risk.helper.ts         # Config, sizing, daily limits, charges
│   ├── scalping.entry.filters.ts       # Entry signal pipeline
│   ├── scalping.exit.helper.ts         # Exit decisions, partial profit
│   ├── scalping.indicators.ts          # EMA, RSI, ATR, 5m aggregation
│   ├── scalping.market.quality.helper.ts  # ATM strike, liquidity, expiry rules
│   ├── scalping.audit.helper.ts        # Decision audit logging
│   ├── scalping.backtest.helper.ts     # Historical backtest engine
│   ├── scalping.performance.helper.ts  # Live KPI aggregation
│   ├── scalping.optimize.helper.ts     # Parameter optimization sweep
│   └── upstocks.apis.ts                # Upstox order placement
├── controller/
│   └── strategy.controller.ts          # Thin API + legacy strategies
├── model/                              # Sequelize models
├── routes/instruments/                 # Instrument & scalping routes
├── utils/
│   ├── cron.job.ts
│   └── reconciliation.cron.ts
└── migrations/                         # Sequelize migrations
```

---

## Recommended Workflow

1. **Paper trade** — set `mode = 'paper'`, run during market hours, collect 2–4 weeks of data
2. **Review KPIs** — `GET /scalping-performance?days=30`
3. **Review skips** — `GET /scalping-audit-log` (why entries were blocked)
4. **Backtest & optimize** — `POST /scalping-backtest` then `POST /scalping-optimize`
5. **Paper validate** — apply suggested params, paper trade another 1–2 weeks
6. **Go live small** — `mode = 'live'`, `user.is_live = true`, keep `max_lots_per_trade = 1`
7. **Monitor daily** — KPI API + reconciliation cron logs

---

## Socket.IO

Clients connect to `/api/socket`. The server emits today's trades on each market tick:

```json
{
  "data": [
    {
      "id": "trade_id",
      "symbol": "SBIN...",
      "buyPrice": 12.5,
      "currentLTP": 13.1,
      "profitLoss": 450,
      "status": "in_trade"
    }
  ]
}
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `yarn start` | Start dev server with nodemon |
| `yarn migrate` | Run DB migrations |
| `yarn migrate:status` | Show migration status |
| `yarn lint` | ESLint |
| `yarn format:write` | Prettier format |

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| `column does not exist` | Run `yarn migrate` |
| `Market Time is closed` | Normal outside 9:15–15:19 IST |
| No entries firing | Audit log skip reasons; ensure candles exist in DB for active strike |
| `mode = backtest` | WebSocket strategy is off; use `/scalping-backtest` API |
| Orders not placed | `mode` must be `live` AND `user.is_live = true` |
| Wrong strike subscribed | `enable_dynamic_atm` syncs strikes every 5 min during entry window |

---

## License

MIT
