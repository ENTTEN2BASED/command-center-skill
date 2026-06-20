# Stat-Arb CMC Gate — Crash-Window Comparison (gate-off vs gate-on)

_Generated 2026-06-20. Window: 2026-05-26 → 2026-06-10 (BTC ≈ -19%). Config: live authoritative (z_entry=2.0, z_exit=0.0, z_stop=4.0, max_hold=72h, $1000/trade, 0.3%/leg cost)._

This demonstrates the CMC risk-off gate (promoting CoinMarketCap's regime signal from
advisory to an entry gate) by replaying the stat-arb strategy across the crash window
with the gate **off** vs **on**. These figures are reproduced by the bundled, offline
backtest (`backtest/`, `npm run backtest`) — a single-pair V2A long-only slice.

## Headline — V2A long-only

| Metric | gate-OFF | gate-ON | Δ (on − off) |
|---|---|---|---|
| Trades | 46 | 29 | -17 |
| Win rate | 26.1% | 24.1% | -2.0pp |
| Total PnL | -$185.95 | -$99.51 | +86.44 |
| Sharpe (per-trade) | -0.2783 | -0.4318 | -0.1535 |
| Max DD ($) | -$196.59 | -$107.81 | +88.78 |
| Max DD (% capital) | 0.3932% | 0.2156% | -0.1776pp |

## Gate effect

- **Entries paused by the gate:** 17 (gate-OFF 46 → gate-ON 29).
- **Single largest loss removed:** the gate paused gate-OFF's worst trade, -$61.99 (entry 2026-06-03 21:40Z).
- **Total loss cut ~46%** (-$185.95 → -$99.51).
- **Max drawdown cut ~45%** (-$196.59 → -$107.81).
- Per-trade Sharpe falls (-0.2783 → -0.4318): the gate cuts exposure in a falling tape, not per-trade quality.

## Disclosures & method

- **Reconstructed CMC history (not real).** CMC historical data is paywalled. The per-bar
  CMC verdict is reconstructed from the real BTC 7-day trend (Binance OHLCV) using the
  **live** `deriveRegimeFromRestData` threshold cut-points (−10 → bear, +5 → bull) and the
  **live** `cmcRegimeIsRiskOff` mapping (risk-off ⇔ `bear_trending`). `btc_dominance` and
  `total_market_cap_change` are unavailable historically and are approximated (dominance
  held >55; mcap absent → ranging default) — see `cmc-gate.ts:buildBtcRiskOffTimeline`.
- **Gate is entry-only** — on risk-off bars new entries are paused; exits always run.
- **Single-pair V2A long-only** — a one-directional long strategy is where pausing entries in a
  bear most directly avoids drawdown. The bundled backtest reproduces this slice only.
- **Authoritative params** — z_entry=2.0, z_exit=0.0, z_stop=4.0, the exact thresholds that
  drove the live paper trades (`stat_arb_pairs` BTC_ETH_LEAD_LAG_BASE).
- **Cost basis** — the backtest applies a 0.3% round-trip cost per leg on close; the live
  paper track record (`stat-arb-metrics.md`) is gross (no gas/slippage deduction).
- **V2B (BNB perp) is out of replay scope** (the slice is spot-only — no Aster marks or
  funding), but V2B's live gate consumes the **identical** `cmcRiskOff` signal, so this effect
  generalizes to it.
- **Per-trade Sharpe** = mean(`return_pct`) / sample-stddev(`return_pct`), **NOT annualized**.
- **Max DD (% capital)** uses starting_capital = 50000 CAD (the convention-matching denominator).
