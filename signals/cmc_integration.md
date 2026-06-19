# CMC Skill Hub Integration

## Live Integration Status

### Regime Classifier Enrichment — LIVE ✅
- Skills used: CMC REST API
  - /v1/global-metrics/quotes/latest
  - /v1/cryptocurrency/quotes/latest
- Frequency: hourly (55-min rate limit)
- Effect: ±10% confidence modifier
- Fallback: price-based classifier unchanged

Live result (June 7 2026 04:31 UTC):
- Price classifier: ranging (85% confidence)
- CMC signal: bear_trending
  (BTC dominance 58.3%, BTC -17% 7d)
- Final regime: ranging (75% confidence)
- Enrichment: "CMC diverges: bear_trending vs price: ranging"
- Interpretation: short-term bounce masking weekly bear
  trend — system correctly cautious about ranging strategies

### Token Safety Gate — LIVE ✅
- Skill: verify_new_token_safety (CMC token-safety: honeypot,
  security score, LP-lock, holder-count signals)
- Runs live in two scheduled jobs:
  1. Token Scout (weekly) — drops unsafe new-token candidates
     at discovery, before they enter the watchlist
  2. Daily safety sweep — auto-blacklists unsafe active pools
- Fail-open: unknown safety state does not block (fails open)

### Derivatives Signal — PLANNED
- Skill: detect_funding_rate_regime_shift
- Trigger: Aave Short evaluation cycle
- Effect: short_safe gate enrichment
- Status: building after token safety

## Overview
CMC Skill Hub provides 33 pre-built intelligence skills accessible via MCP 
(Model Context Protocol). The Command Center uses these as a composable 
signal layer — no custom ML required, each skill is a validated evidence 
pipeline backed by CMC's live data.

## Connected Skills (hackathon build)

### 1. Regime Classifier Enrichment
**Skill:** `detect_market_regime`
**Input:** `{"time_window": "7d"}`
**Output:** regime label, conviction, participation_state, leverage_state
**Use:** Secondary confirmation for our Binance-based regime classifier.
CMC provides derivatives + macro layer our OHLCV-only classifier can't see.

**Skill:** `btc_cross_asset_correlation`
**Input:** `{"preview": true}`
**Output:** BTC/Nasdaq, BTC/DXY, BTC/Gold correlations + regime + divergence
**Use:** DXY liquidity regime as macro filter. If `liquidity_tightening`, 
downgrade bull confidence by 10%.

**Skill:** `crypto_macro_overview`
**Input:** `{"preview": true}`
**Output:** Multi-lane macro regime synthesis
**Use:** Weekly macro context for capital allocator.

---

### 2. Token Scout Safety Gate
**Skill:** `verify_new_token_safety`
**Input:** `{"token_id_or_symbol": "X", "platform": "base", "contract_address": "0x..."}`
**Output:** safety_state (safe / unsafe / blocked), checklist findings
**Use:** Hard gate in Token Scout — any new pool added to watchlist must 
pass safety check before entering Coin Shifter or DeFi Rotation evaluation.

**Skill:** `detect_token_liquidity_decay`
**Input:** `{"token_id_or_symbol": "X", "platform": "base", "token_address": "0x...", "window": "30d"}`
**Output:** decay_state (stable_liquidity / moderate_decay / severe_decay)
**Use:** Dynamic quality multiplier input. `severe_decay` → quality_mult × 0.5.

---

### 3. Aave Short `short_safe` Gate
**Skill:** `detect_funding_rate_regime_shift`
**Input:** `{"symbol": "BTC", "venue": "Binance", "window": "7d"}`
**Output:** regime_state (long_paying / short_paying / normalization / stable_carry)
**Use:** Block shorts when `long_paying` (overheated longs = short squeeze risk).

**Skill:** `assess_liquidation_cascade_risk`
**Input:** `{"symbol": "BTC", "window": "7d"}`
**Output:** cascade_risk level, direction of pressure
**Use:** Block shorts during active liquidation cascades.

**Skill:** `assess_volatility_expansion_risk`
**Input:** `{"symbol": "BTC", "timeframe": "4h"}`
**Output:** volatility_risk state
**Use:** Block shorts when volatility is `overheated` — unpredictable moves invalidate directional shorts.

---

### 4. Momentum Pre-Filter (Micro Momentum Scanner)
**Skill:** `altcoin_breakout_scanner_spot`
**Input:** `{"preview": true}`
**Output:** Ranked breakout candidates with technical confirmation + narrative validation
**Use:** Pre-filter before 5-min OHLCV harness scan. If a pool doesn't appear 
in CMC's breakout screen, raise min_score threshold by 10 for that cycle.

**Skill:** `detect_perp_momentum_exhaustion`
**Input:** `{"symbol": "ETH", "timeframe": "4h"}`
**Output:** exhaustion_state
**Use:** Skip Micro Momentum entry when perp momentum is exhausted — avoids 
catching falling knives at the end of a move.

---

## Live Results (June 7 2026)

### `detect_market_regime` (7d window)
- Regime: `range_chop` consistent with our internal `ranging (85%)` classification
- CMC adds: participation_state, leverage_state we don't currently track

### `btc_cross_asset_correlation` (preview)
- Regime: `independent_pricing` (medium confidence)
- Nasdaq r = 0.2791 (7-session) vs 0.4293 (30d) — weakening
- DXY: `liquidity_tightening` — macro headwind active
- Implication: crypto-specific catalysts dominate; macro is secondary check

### `analyze_btc_eth_etf_flow_impact` (BTC, 30d)
- Flow regime: `sustained_outflows` (-$4.58B over 30d)
- Price response: `flows_confirm_weakness`
- Implication: respect flow headwind — wait for ETF selling to slow before 
  treating rebounds as durable

## Architecture
```
Scheduler (every 30min)
    └── Regime Classifier
            ├── Binance OHLCV (primary)
            └── CMC Skill Hub (enrichment)
                    ├── detect_market_regime
                    ├── btc_cross_asset_correlation
                    └── assess_macro_liquidity_risk_regime

Token Scout (weekly Sunday)
    └── verify_new_token_safety (CMC) — drop unsafe new-token candidates at discovery
    └── detect_token_liquidity_decay (CMC)

Daily safety sweep (daily)
    └── verify_new_token_safety (CMC) — auto-blacklist unsafe active pools
        (fails open on unknown)

Aave Short (on-demand)
    └── short_safe gate
            ├── detect_funding_rate_regime_shift (CMC)
            ├── assess_liquidation_cascade_risk (CMC)
            └── assess_volatility_expansion_risk (CMC)
```
