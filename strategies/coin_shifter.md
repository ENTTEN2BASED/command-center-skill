# Coin Shifter v0.1 — Quality-Adjusted Momentum Rotation

## Overview
Always-deployed spot rotation strategy. Scores watched pools using 
rate-of-change momentum across 3 timeframes, adjusted by a quality 
multiplier for liquidity depth, pool age, and momentum consistency.
Rotates to Morpho/Aave yield in bear regime.

## Scoring Formula
```
momentum_score = 0.50 × roc_1h + 0.35 × roc_4h + 0.15 × roc_24h
quality_mult   = f(tvl_usd, age_days, roc_consistency)  → [0.40, 1.50]
adjusted_score = momentum_score × quality_mult
```

## Quality Multiplier Rules
| Condition | Multiplier |
|---|---|
| All 3 timeframes positive | × 1.25 |
| TVL > $2M | × 1.10 |
| TVL < $300k | × 0.60 |
| 24h pump > 40% | × 0.70 |
| Pool age < 60 days | × 0.80 |

## Regime Config
| Regime | Positions | Margin |
|---|---|---|
| `bull_trending` | 3 | 1.5% |
| `ranging` | 2 | 2.5% |
| `low_volatility` | 2 | 3.5% |
| `bear_trending` | 0 (yield only) | — |

## Pool Tiers
- **Tier 1** (always scored): AERO/USDC, cbBTC/WETH, WETH/USDC
- **Tier 2** (bull/ranging): VIRTUAL, cbBTC/USDC
- **Tier 3** (bull/high_vol only): BRETT, TOSHI, DEGEN

## Yield Defense
When all token scores fall below yield threshold, rotates to best yield:
- Morpho USDC: 4.23% APY (preferred)
- Aave USDC: 3.22% APY (fallback)
- Yield score = APY / 35,040 (per-15-minute equivalent)

## CMC Integration (planned)
```python
# Token Scout: honeypot gate before any new pool added to watchlist
def check_token_safety(contract_address: str, platform: str) -> bool:
    result = execute_skill("verify_new_token_safety", {
        "token_id_or_symbol": symbol,
        "platform": platform,
        "contract_address": contract_address
    })
    return result["data"]["safety_state"] == "safe"

# Quality multiplier: liquidity trend not snapshot
def get_liquidity_trend(token: str, address: str, platform: str) -> str:
    result = execute_skill("detect_token_liquidity_decay", {
        "token_id_or_symbol": token,
        "platform": platform,
        "token_address": address,
        "window": "30d"
    })
    return result["data"]["decay_state"]  # stable_liquidity | moderate_decay | severe_decay
```

## Learning Mappings
- **M7:** minimum_liquidity_usd — raised when low-liquidity pool losses accumulate
- **M8:** minimum_volume_24h_usd — raised when thin-volume trades underperform
