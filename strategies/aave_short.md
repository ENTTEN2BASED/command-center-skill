# Aave Short V1 — Collateralized Borrow-and-Sell Short

## Overview
Bear-market strategy using Aave V3 on Base. Deposits collateral, borrows 
a target token, sells it spot, buys back lower. Liquidation risk — 
isolated leverage pool, dedicated HALT button.

## Capital Pool
```
Standard pool (80%): Coin Shifter, MM, DeFi Rotation, LP, Stat Arb
Leverage pool (15%): Aave Short (this strategy)
Buffer        (5%):  always undeployed
```
HALT SHORTING cuts leverage pool only. Standard pool keeps running.

## Entry Gate — `short_safe` (ALL 6 required)
| Condition | Check |
|---|---|
| Regime | `bear_trending` ≥ 80% confidence |
| BTC momentum | 4h return < -1% |
| Consecutive bear | 3+ consecutive bear classifications |
| Funding rate | Not in `long_paying` regime (longs are not overheated) |
| Liquidation risk | No active cascade risk |
| Volatility | Not in `overheated` volatility state |

## CMC Integration — `short_safe` Gate
```python
def check_short_safe(regime: dict) -> bool:
    """All 6 conditions must pass before any short position is opened."""
    
    # Condition 4: funding regime check
    funding = execute_skill("detect_funding_rate_regime_shift", {
        "symbol": "BTC",
        "venue": "Binance",
        "window": "7d"
    })
    if funding["data"]["regime_state"] == "long_paying":
        return False  # longs overheated — short squeeze risk
    
    # Condition 5: liquidation cascade risk
    cascade = execute_skill("assess_liquidation_cascade_risk", {
        "symbol": "BTC",
        "window": "7d"
    })
    if cascade["data"]["cascade_risk"] in ["high", "elevated"]:
        return False  # active cascade — don't add short exposure
    
    # Condition 6: volatility state
    vol = execute_skill("assess_volatility_expansion_risk", {
        "symbol": "BTC",
        "timeframe": "4h"
    })
    if vol["data"]["volatility_risk"] == "overheated":
        return False  # vol too high — unpredictable directional moves
    
    return True  # all CMC gates passed

# Also use: detect_spot_perp_flow_divergence to confirm spot selling is real
```

## Position Structure
- Collateral: USDC deposited to Aave V3
- Borrow: target token (e.g. WETH, cbBTC)
- Sell: borrowed token spot via Aerodrome
- Close: buy back token, repay borrow, withdraw collateral

## Safety
- Health factor monitored every 5 minutes
- Auto-close if health factor < 1.15
- Max LTV: 65% (Aave V3 USDC/WETH e-mode cap)
- Position cards: white border + skull icon
- HALT SHORTING button: instant disable, open positions monitored to close

## Status
- Spec: COMPLETE (AAVE_SHORT_V1_SPEC.md)
- Build: After Stat Arb V2 paper-validated
- Gate: bear_trending 80%+ confidence + BTC 4h < -1% + 3 consecutive bear
