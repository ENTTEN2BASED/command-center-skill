# Stat Arb V2 — BTC/ETH Lead-Lag Strategy

## Overview
Cross-asset statistical arbitrage exploiting the lead-lag relationship between 
BTC and ETH. Two variants: spot long-only (Base chain) and delta-neutral (BNB Chain).

## Variant A — Base Chain (LIVE in paper)
- **Signal:** 48-candle rolling z-score on BTC/ETH price ratio
- **Entry:** z < -2.0 (ETH underpriced relative to BTC)
- **Exit:** z reverts to 0.0
- **Stop:** z < -4.0 (adverse divergence)
- **Time-stop:** 72h
- **Size:** $1,000 CAD/trade
- **Regime gate:** Paused in `bear_trending` and `low_volatility`
- **Chain:** Base, Aerodrome CL pools
- **Status:** LIVE — paper trading since June 6 2026

## Variant B — BNB Chain (build June 9–14)
- **Signal:** Same z-score on BTC/ETH ratio
- **Execution:** Delta-neutral — long ETH (PancakeSwap V3 spot) + short BTC (Aster perps via TWAK)
- **Size:** $200/leg, $400/pair, $800 combined cap
- **Regime gate:** None — direction-agnostic, all regimes
- **Chain:** BNB Chain (BSC)
- **Status:** SPEC COMPLETE — not yet built

## Z-Score Calculation
```python
import numpy as np

def compute_z_score(btc_prices: list, eth_prices: list, window: int = 48) -> float:
    """
    Computes rolling z-score on BTC/ETH price ratio.
    Entry signal: z < -2.0 means ETH is cheap relative to historical ratio.
    """
    ratios = [b / e for b, e in zip(btc_prices, eth_prices)]
    window_ratios = ratios[-window:]
    
    mean = np.mean(window_ratios)
    std  = np.std(window_ratios)
    
    if std == 0:
        return 0.0
    
    current_ratio = ratios[-1]
    return (current_ratio - mean) / std

# Entry: z < -2.0 → open long ETH position
# Exit:  z >= 0.0 → close position (mean reversion complete)
# Stop:  z <= -4.0 → adverse divergence, exit with loss
```

## Paper Results (V1 Cross-Venue — archived)
- Cross-venue arb on identical assets: near-zero alpha confirmed
- Real arb bots dominate, spread closes in seconds
- V1 pairs remain active for data collection only
- V2 lead-lag pairs replace as primary stat arb strategy

## Learning Mappings
- **M13:** `pair_trade_negative_pnl` → raises `z_score_entry_threshold` by 0.2 (max 3.0)
- **M14:** `pair_trade_max_hold_exceeded` → raises `max_hold_hours` by 12h (max 120h)

## CMC Integration
```python
# Before opening position: check perp momentum exhaustion
exhaustion = execute_skill("detect_perp_momentum_exhaustion", {
    "symbol": "ETH",
    "timeframe": "4h"
})
if exhaustion["data"]["exhaustion_state"] == "exhausted":
    skip_entry("ETH momentum exhausted — z-score entry may be false signal")
```
