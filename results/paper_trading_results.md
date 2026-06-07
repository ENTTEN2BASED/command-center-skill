# Paper Trading Results — as of June 6 2026

**Period:** 2026-05-20 → present (paper mode)
**System:** Command Center v4.25
**Capital:** $47,587 CAD available ($50,000 CAD starting)
**Mode:** Fully autonomous paper trading

## System Overview

| Metric | Value |
|---|---|
| Paper trading since | May 20 2026 |
| Total closed trades | 87 |
| Realized PnL | -$2,213 CAD |
| Available capital | $47,587 CAD |
| Starting capital | $50,000 CAD |
| Drawdown | 4.4% |
| Regime | ranging (85% confidence) |
| Circuit breakers | All clear |

## By Strategy

| Strategy | Trades | Win Rate | Total PnL |
|---|---|---|---|
| Stat Arb V1 | 14 | 50.0% | $0.00 |
| Micro Momentum | 31 | 32.3% | -$461 |
| Coin Shifter | 3 | 0% (early) | -$21 |
| DeFi Rotation V1 | 39 | 15.4% | -$1,730 |

## Key Findings

- **DeFi Rotation V1** responsible for 78% of losses (74% stop-loss rate)
  → Redesigned June 6 — V2 now live with 6-condition entry gate
- **Micro Momentum** 32.3% win rate in bear/ranging market — signal quality confirmed
  → Learning loop raising thresholds (M9/M10)
- **Stat Arb V1** cross-venue confirmed near-zero alpha — spread closes in seconds, arb bots dominate
  → V2 BTC/ETH lead-lag built June 6 as replacement signal
- **System learning loop:** 14 autonomous proposal mappings, first clean proposals generated

## Active Improvements (June 6)

- **DeFi Rotation V2:** tightened entry (6-condition gate: roc_1h > 0, roc_4h > 0, volume_surge ≥ 1.5x, TVL ≥ $1M, vol_24h ≥ $500k, health ≥ 30), wider stops (trailing 4% from peak, +8% TP, 48h time-stop)
- **Stat Arb V2A:** BTC/ETH lead-lag signal live on Base chain ($1,000/trade, regime-gated — paused in bear/low_vol)
- **CMC Skill Hub:** Integrated as intelligence layer — 33 skills available for regime enrichment, token safety, short gates

## Strategy Status (June 6)

| Strategy | Status |
|---|---|
| Coin Shifter v0.1 | Active — AERO/USDC spot + MORPHO yield |
| Micro Momentum Scanner | Active — scanning 7 pools every 5 min |
| DeFi Rotation V2 | Live — first cycle running |
| Stat Arb V1 | Data collection only |
| Stat Arb V2A | Live — first signal pending (BTC/ETH z-score < -2.0) |
| LP Strategy | Deferred ($5k/trade minimum) |
| Aave Short V1 | Spec complete — build after Stat Arb V2 validated |

## Next Milestone

- First live on-chain trade: target June 11–12 (end of paper period)
- Live PnL results will be posted here

---
*Updated: June 6 2026. Live trading begins after paper period and explicit Phase 5 approval.*
