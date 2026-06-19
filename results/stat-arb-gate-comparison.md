# Stat-Arb CMC Gate — Crash-Window Comparison (gate-off vs gate-on)

_Generated 2026-06-19T04:15:45.923Z. Window: 2026-05-26 → 2026-06-10 (BTC ≈ -19%). Config: SA_BASELINE._

This demonstrates C1's CMC risk-off gate (promoting CoinMarketCap's regime signal from
advisory to an entry gate) by replaying the stat-arb strategy across the crash window
with the gate **off** vs **on**.

## Headline — V2A long-only

### V2A (long-only)

| Metric | gate-OFF | gate-ON | Δ (on − off) |
|---|---|---|---|
| Trades | 60 | 42 | -18 |
| Win rate | 25.0% | 26.2% | +1.2pp |
| Total PnL | -$206.45 | -$145.13 | +61.32 |
| Sharpe (per-trade) | -0.3008 | -0.5072 | -0.2064 |
| Max DD ($) | -$207.79 | -$146.47 | +61.32 |
| Max DD (% capital) | 0.416% | 0.293% | -0.123pp |


## V1 cross-venue (completeness — see fidelity caveat)

### V1 (cross-venue)

| Metric | gate-OFF | gate-ON | Δ (on − off) |
|---|---|---|---|
| Trades | 26 | 12 | -14 |
| Win rate | 19.2% | 0.0% | -19.2pp |
| Total PnL | -$6.63 | -$4.28 | +2.35 |
| Sharpe (per-trade) | -0.6817 | -2.0439 | -1.3622 |
| Max DD ($) | -$6.63 | -$4.28 | +2.35 |
| Max DD (% capital) | 0.013% | 0.009% | -0.005pp |


## All pairs

### All pairs

| Metric | gate-OFF | gate-ON | Δ (on − off) |
|---|---|---|---|
| Trades | 86 | 54 | -32 |
| Win rate | 23.3% | 20.4% | -2.9pp |
| Total PnL | -$213.08 | -$149.41 | +63.67 |
| Sharpe (per-trade) | -0.3020 | -0.5332 | -0.2312 |
| Max DD ($) | -$214.42 | -$150.75 | +63.67 |
| Max DD (% capital) | 0.429% | 0.301% | -0.127pp |


Engine aggregate (across all pairs): gate-off PnL -$213.08, WR 23.3%, maxDD 0.00% (engine formula) → gate-on PnL -$149.43, WR 20.4%, maxDD 0.00%.

## Disclosures & method

- **Reconstructed CMC history (not real).** CMC historical data is paywalled. The per-bar
  CMC verdict is reconstructed from the real BTC 7-day trend (Binance OHLCV) using the
  **live** `deriveRegimeFromRestData` threshold cut-points (−10 → bear, +5 → bull) and the
  **live** `cmcRegimeIsRiskOff` mapping (risk-off ⇔ `bear_trending`). `btc_dominance` and
  `total_market_cap_change` are unavailable historically and are approximated (dominance
  held >55; mcap absent → ranging default) — see `stat-arb-replay.ts:buildBtcRiskOffTimeline`.
- **Gate is entry-only**, mirroring C1: on risk-off bars new entries are paused; exits always run.
- **Headline on V2A long-only** — a one-directional long strategy is where pausing entries in a
  bear most directly avoids drawdown. V1 cross-venue is market-neutral, so the gate's effect is
  smaller and noisier.
- **V1 fidelity caveat (CLAUDE.md §4c):** cross-venue pairs use sparse `pool_snapshots`
  (~6% of ideal 5-min density), so V1 verdicts are lower-confidence. Lead on V2A (clean Binance data).
- **V2B (BNB perp) is out of replay scope** (the overdrive engine is spot-only — no Aster marks or
  funding), but V2B's live gate consumes the **identical** `cmcRiskOff` signal, so this effect
  generalizes to it.
- **Per-trade Sharpe** = mean(`return_pct`) / sample-stddev(`return_pct`), **NOT annualized**.
- **Max DD (% capital)** uses starting_capital = 50000 CAD (the convention-matching denominator).
- The replay persists only to the isolated `overdrive_runs` / `overdrive_outcomes` tables; live and learning tables are untouched.
