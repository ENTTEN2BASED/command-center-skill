# Command Center — Self-Improving DeFi Agent Framework

> A regime-aware trading framework powered by CoinMarketCap signals, Trust Wallet Agent Kit execution, and BNB Chain — built for the BNB × CMC × Trust Wallet Hackathon 2026.

---

## The Core Idea

Most trading agents are regime-blind. They apply one strategy in all market conditions and bleed when the market turns. Command Center is different: it asks *what regime are we in?* before every decision, and uses the answer to determine not just *what* to trade — but *whether* to trade at all.

The framework has three layers:

```
CMC signals  →  Regime classifier  →  Strategy skill (or: stay flat)
                      ↓
               Outcome logger  →  Learning loop  →  Rule refinement
                      ↓
               Overdrive engine  →  Backtest validation before deployment
```

The result is a system that improves itself over time: every closed trade becomes a labelled outcome, the learning loop detects patterns, and proposed rule changes are validated against historical data before they're applied.

---

## Quickstart

```bash
git clone https://github.com/ENTTEN2BASED/command-center-skill.git
cd command-center-skill
npm install
npx tsx examples/run-backtest.ts
```

No database. No API key required. On first run you get:

```
[regime] BTC/ETH macro fetch complete — BTC $61,983 | ETH $1,630
[regime] Classified: bear_trending (72%) — CMC enrichment: not available (no key)
[coin-shifter] Scored 4 pools — AERO 68.4 | cbBTC 61.2 | WETH 44.1 | BRETT 12.3
[coin-shifter] Decision: BEAR MODE — rotate to yield (Morpho 4.23%)
[stat-arb] BTC/ETH log-ratio z-score: 2.31 — BTC leading, watching ETH lag
[backtest] 30-day regime breakdown: ranging 70% | low_volatility 30%
[backtest] Complete — 3 strategy decisions logged to in-memory store
```

With `CMC_API_KEY` set in `.env`, the regime classifier also pulls BTC dominance and 7-day change from the CMC Global Metrics endpoint and adjusts confidence ±10%.

---

## What's In This Repo

```
src/
├── regime/
│   ├── classifier.ts        Pure regime classification (no I/O)
│   ├── cmc-enrichment.ts    CMC REST integration: global-metrics + BTC quotes
│   └── macro-fetcher.ts     CoinGecko → Binance → Kraken fallback chain
│
├── strategies/
│   ├── interface.ts         The Strategy contract every skill implements
│   └── coin-shifter/
│       └── scorer.ts        Five pure functions: score, rank, decide, rotate
│
├── stat-arb/
│   └── spread-calculator.ts computeSpread (log-ratio), computeZScore, sizing
│
├── candles/
│   └── binance.ts           Paginated OHLCV fetch — free, no key required
│
└── storage/
    └── in-memory.ts         IStorage interface + MemoryStore reference impl
                             (swap for Supabase, Postgres, or any DB adapter)

examples/
└── run-backtest.ts          End-to-end demo: fetch → classify → score → decide
```

---

## The Strategy Interface

Any skill in the framework implements a single contract:

```typescript
interface Strategy {
  name: string
  activeRegimes: Regime[]   // which regimes this skill trades in
  evaluate(
    signals: CmcSignals,
    candles: Candle[],
    capital: number
  ): Decision               // entry / exit / stay_flat / rotate_to_yield
}
```

The framework calls `evaluate()` only when the current regime is in `activeRegimes`. A strategy that sets `activeRegimes: ['bull_trending', 'ranging']` is automatically silenced in bear markets — no code change needed, no override logic. The regime is the gate.

This makes plugging in new strategies trivial: implement the interface, declare which regimes you trade in, and the framework handles the rest.

---

## CMC Signal Integration

The regime classifier consumes three CMC signals:

| Signal | CMC Endpoint | How it's used |
|---|---|---|
| Market regime | `/v1/global-metrics/quotes/latest` | BTC dominance + 7d change → regime direction |
| Price momentum | `/v2/cryptocurrency/quotes/latest` | BTC 7d % change → confidence modifier ±10% |
| Token safety | `/v1/cryptocurrency/info` | Honeypot/rug flag → blocks unsafe tokens before entry |

The enrichment is additive — if CMC is unavailable, the classifier falls back to Binance/CoinGecko macro data and continues operating. No single point of failure.

---

## The Coin Shifter Skill

The reference strategy in this repo is the **Coin Shifter** — a regime-aware rotation strategy that scores assets on momentum quality and rotates capital between the strongest-scoring pools. In bear regimes, instead of forcing trades, it rotates to yield (Morpho/Aave USDC) and stays flat on directional positions.

**Scoring formula:**
```
score = (50% × 1h ROC + 35% × 4h ROC + 15% × 24h ROC) × quality_multiplier
quality_multiplier = f(liquidity_tier, volume_health, cmc_safety_flag)
```

**Regime behavior:**

| Regime | Positions | Margin | Behavior |
|---|---|---|---|
| bull_trending | 3 | 1.5% | Rotate aggressively into top-scored pools |
| ranging | 2 | 2.5% | Conservative rotation, higher quality floor |
| low_volatility | 2 | 3.5% | Tightest gates, defensive sizing |
| bear_trending | 0 | — | Rotate 100% to yield — no directional exposure |

The bear-mode behavior is the strategy's most important feature: it doesn't try to pick bottoms or trade through the crash. It detects the regime and preserves capital in yield while waiting for conditions to improve.

---

## Overdrive — Backtest Engine

The overdrive engine replays historical OHLCV data at simulated speed to validate strategies before deployment. It uses Binance free public API for candles — no paid data required.

**What it proved:**

During development we ran a 30-day parameter sweep across 6 configurations of the momentum strategy, covering BTC's $80k → $61k crash. Every configuration lost money. The finding: this strategy has negative expectancy in bear/ranging markets regardless of parameter tuning.

This is the engine working as designed. The correct response was to confirm the regime gate (don't trade this strategy in bear) and deprioritize momentum tuning until a bull period provides real validation data. Capital was preserved; no real funds were deployed based on unvalidated assumptions.

The honest backtest result is part of the submission because rigour is the point — a strategy framework that hides its own negative results isn't safe to use.

---

## Production Stack (Full Integration)

This public repo is the reference framework layer. The production system adds:

**Trust Wallet Agent Kit (execution):**
- Self-custody signing via TWAK REST API
- Kill switches: max trade size, max price impact, max slippage
- Dual-record pattern: paper record written before swap, live TWAK call after
- Fallback: TWAK down → paper record kept, swap skipped, event logged

**BNB Chain (venue):**
- ERC-8004 on-chain agent identity registered (Agent ID: 130119, BSC testnet)
- Chain-isolated strategy pools (Base primary, BNB secondary)
- BNB SDK integration for agent registration and competition entry

**Learning loop (production only):**
- Every closed trade → regime-tagged outcome → pattern detection
- Numeric rule-change proposals → 24h age gate → backtest validation → auto-apply
- Rollback monitor: reverts any applied rule that degrades WR >5% over 10 trades
- Shadow engine: logs near-miss signals counterfactually, surfaces threshold-loosening opportunities

---

## Why This Architecture

Three problems it solves that simpler agents don't:

**1. Regime blindness.** A strategy profitable in bull markets can lose money in bear. The regime classifier gates every strategy automatically — not as an afterthought, but as a first-class framework constraint.

**2. Static parameters.** Fixed thresholds drift out of tune as market conditions change. The learning loop detects when they're degrading and proposes evidence-backed adjustments, validated before deployment.

**3. Unvalidated assumptions.** Most agents are deployed based on intuition or cherry-picked backtests. The overdrive engine forces quantitative validation — including honest negative results — before any strategy runs on real capital.

---

## Running With CMC

```bash
cp .env.example .env
# Add your CMC API key to .env
npx tsx examples/run-backtest.ts
```

The enrichment block activates automatically when the key is present, adding BTC dominance and 7d change to the regime signal.

---

## License

MIT — framework code is open. Strategy parameters, live configuration, and production orchestration are private.

---

*Built for the BNB Chain × CoinMarketCap × Trust Wallet Hackathon 2026.*
*System: Command Center | Wallet agent: FISHERMAN | Operator: ENTTEN | Chain: Base + BNB*
