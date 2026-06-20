# Stat-Arb CMC Risk-Off Gate — Crash-Window Backtest

A **self-contained, runnable** reproduction of the headline result: wiring CoinMarketCap's
risk-off regime signal into the stat-arb strategy as an **entry gate** cuts total loss by
**~46%** and max drawdown by **~45%** across the May–June 2026 crash (BTC ≈ −19%).

This is a deliberately narrow slice of the Command Center system — **only** the V2A
long-only BTC/ETH lead-lag strategy and the CMC gate. The learning loop, orchestration,
live execution engine, and all other strategies are intentionally **not** included.

## Quickstart

```bash
cd backtest
npm install
npm run backtest
```

Runs fully **offline** — bundled public Binance candles, **zero network, zero secrets,
zero database**. Only dev dependencies are `tsx` + `typescript` (to run the TypeScript).

## Expected output

```
=== V2A long-only — gate-OFF vs gate-ON (crash window 2026-05-26 → 2026-06-10) ===
Metric                        gate-OFF         gate-ON    Δ (on − off)
----------------------------------------------------------------------
Trades                              46              29             -17
Win rate                         26.1%           24.1%          -2.0pp
Total PnL                    -$185.95         -$99.51         +86.44
Max DD ($)                   -$196.59        -$107.81         +88.78
Max DD (% capital)           0.3932%         0.2156%       -0.1776pp
Sharpe (per-trade)           -0.2783         -0.4318         -0.1535

--- Gate effect ---
Entries paused by the gate: 17 (gate-OFF 46 → gate-ON 29)
Gate-OFF's single largest loss: -$61.99 (entry 2026-...) — PAUSED by gate ✓
Total loss cut by the gate:  46% (-$185.95 → -$99.51)
Max drawdown cut by the gate: 45% (-$196.59 → -$107.81)
```

(Exact wording around timestamps may differ slightly; the metric values reproduce
the published figures within rounding.)

## What it does

The pair is `BTC_ETH_LEAD_LAG_BASE` (V2A long-only). The spread is `log(BTC/ETH)`.

- **Entry:** z-score `< −2.0` → go long the lagging leg (ETH cheap vs BTC), expecting reversion.
- **Exit:** z `≥ 0.0` → reverted; z `≤ −4.0` → stop-loss; age `≥ 72h` → time-stop.
- **Config (live authoritative):** z_entry 2.0, z_exit 0.0, z_stop 4.0, 48-bar window, $1,000/trade,
  0.3% round-trip cost per leg applied once on close. These are the exact thresholds that drove
  the live paper trades (`stat_arb_pairs` BTC_ETH_LEAD_LAG_BASE).
- **The CMC gate (the point of the demo):** on bars where CMC reads `bear_trending` (risk-off),
  **new entries pause**; exits always run (entry-only gate). In a one-directional long strategy,
  pausing entries during a bear is exactly where drawdown is avoided.

In a crash, a long-only strategy loses; the gate's job is to lose **less**. That's what the
~46% loss reduction and ~45% drawdown reduction show — capital preservation, not profit.

## Files

```
backtest/
├── data/
│   ├── BTCUSDT_5m.csv   Binance 5m klines, 2026-05-19 → 2026-06-10 (incl. 7d gate lookback)
│   └── ETHUSDT_5m.csv   Binance 5m klines, 2026-05-26 → 2026-06-10 (trading window)
├── src/
│   ├── csv.ts        Offline CSV candle loader (no deps)
│   ├── zscore.ts     computeZScore — ported from the live spread-calculator
│   ├── cmc-gate.ts   CMC risk-off reconstruction — ported from the live regime classifier + replay
│   ├── replay.ts     Spread alignment, exit logic, PnL, the V2A simulation loop
│   └── backtest.ts   Entry point — runs gate OFF then ON, prints the comparison
├── package.json
├── tsconfig.json
└── README.md
```

Each module header cites the exact live source file it was ported from.

## Honesty / method notes

- **The CMC history is reconstructed, not real.** CMC historical data is paywalled, so the
  per-bar CMC verdict is rebuilt from the **real** BTC 7-day trend (Binance OHLCV) using the
  **live** `deriveRegimeFromRestData` thresholds (−10 → bear, +5 → bull) and the **live**
  `cmcRegimeIsRiskOff` mapping (risk-off ⇔ `bear_trending`). `btc_dominance` /
  `total_market_cap_change` are unavailable historically and are approximated exactly as the
  live replay does (dominance held >55; mcap absent → ranging default).
- **The bundled candles are public Binance 5m data** for the exact window the published run
  used. Binance historical klines are immutable, so a fresh pull reproduces the figures identically.
- **This is loss reduction, not profit.** A long-only strategy loses in a crash; the gate
  reduces the damage. The crash window is a deliberate worst-case stress test, distinct from
  the full-period near-breakeven live track record reported in the repo root.
