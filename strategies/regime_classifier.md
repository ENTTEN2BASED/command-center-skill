# Market Regime Classifier

## Overview
Runs every 30 minutes. Classifies current market regime using Binance OHLCV data 
enriched with CMC Skill Hub macro signals. Output gates all 5 strategies.

## Regimes
| Label | Definition | Active Strategies |
|---|---|---|
| `bull_trending` | BTC >5% 24h, volume surge, OI increasing | All 5 |
| `ranging` | BTC ±2% 24h, consolidating volume | CS, MM, DR-V2, SA-V2A |
| `bear_trending` | BTC <-5% 24h, volume surge, OI decreasing | CS (yield only), Aave Short |
| `low_volatility` | ATR compressed, volume below 30d avg | CS (yield), LP Strategy |
| `high_volatility` | ATR expansion, liquidation spike | SA-V2A/B, LP Strategy |

## Signal Sources
- **Primary:** Binance BTC/USDT OHLCV (15m candles, 48-bar window)
- **CMC enrichment:** `detect_market_regime` — conviction, participation_state, leverage_state
- **CMC enrichment:** `btc_cross_asset_correlation` — DXY regime, macro alignment
- **CMC enrichment:** `assess_macro_liquidity_risk_regime` — carry-stress check

## CMC Integration (hackathon build)
```python
from cmc_skill_hub import execute_skill

def enrich_regime(base_regime: str) -> dict:
    macro = execute_skill("detect_market_regime", {"time_window": "7d"})
    corr  = execute_skill("btc_cross_asset_correlation", {"preview": True})
    
    # If CMC says liquidity_tightening AND DXY headwind, downgrade bull → ranging
    dxy_regime = corr["data"]["indicator_snapshot"]["dxy_regime"]
    cmc_regime  = macro["data"]["market_regime"]
    
    return {
        "base_regime": base_regime,
        "cmc_regime": cmc_regime,
        "dxy_regime": dxy_regime,
        "final_regime": reconcile(base_regime, cmc_regime, dxy_regime)
    }
```

## Learning
- Regime confidence is stored per-trade in `trade_records.market_regime`
- Regime-filtered backtests validate all learning proposals before auto-apply
- Minimum 50 snapshots required per regime for reliable backtest
