# Paper Trading Results

**Period:** 2026-05-28 → 2026-06-11 (paper mode)
**System:** Command Center v4.25
**Capital:** ~$47,890 CAD
**Mode:** Fully autonomous paper trading

## Summary (as of 2026-06-07)

| Metric | Value |
|---|---|
| Realized PnL | -$2,109 CAD |
| Drawdown | 2.9% |
| Regime | ranging (85% confidence) |
| Open positions | 2 (AERO/USDC spot + MORPHO yield) |
| Circuit breakers | All clear |

## By Strategy

### Coin Shifter v0.1
- Trades: 3 (too early to assess)
- Status: Active — AERO/USDC spot + MORPHO yield
- Notes: Bear defense working — rotated to yield when all tokens negative

### Micro Momentum Scanner
- Win rate: 32.3%
- Status: Active, scanning 7 pools every 5 minutes
- Thresholds raised by learning loop (M9/M10)

### DeFi Rotation V1 (archived)
- Win rate: 15.4%
- Stop-loss rate: 74%
- Total loss: -$1,730 CAD (78% of all losses)
- Decision: REDESIGNED → V2

### DeFi Rotation V2 (new — June 6 2026)
- Signal: roc_1h > 0 AND roc_4h > 0 AND volume_surge ≥ 1.5x
- Exit: +8% TP, -4% trailing stop, 48h time-stop
- Status: First cycle running

### Stat Arb V1 (cross-venue)
- Net PnL: ~$0 (cross-venue arb near-zero alpha confirmed)
- Status: Data collection only

### Stat Arb V2A (lead-lag — June 6 2026)
- Status: Live, first signal pending
- Signal: BTC/ETH z-score < -2.0

### LP Strategy
- Status: Deferred ($5k/trade minimum, waiting for capital threshold)

## Learning Loop Activity
- M12: DeFi Rotation stop-loss 3% → 3.3% (manually approved)
- M9/M10: Micro Momentum accumulating data, no proposals yet
- M7/M8: Coin Shifter accumulating data

## Regime History
- 2026-05-28 → 2026-06-03: bear_trending
- 2026-06-03 13:03 UTC: Flip to ranging (85% confidence)
- 2026-06-07: ranging (85% confidence), stable

---
*Results updated daily. Live trading begins June 11 after paper period completion.*
