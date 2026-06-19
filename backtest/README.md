# Stat-Arb CMC Risk-Off Gate — Crash-Window Backtest

A **self-contained, runnable** reproduction of the headline result: wiring CoinMarketCap's
risk-off regime signal into the stat-arb strategy as an **entry gate** cuts both total loss
and max drawdown by **~30%** across the May–June 2026 crash (BTC ≈ −19%).

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
Trades                              60              42             -18
Win rate                        25.0%           26.2%          +1.2pp
Total PnL                    -$206.45        -$145.13         +61.32
Max DD ($)                   -$207.79        -$146.47         +61.32
Max DD (% capital)           0.4156%         0.2929%       -0.1227pp
Sharpe (per-trade)           -0.3008         -0.5072         -0.2064

--- Gate effect ---
Entries paused by the gate: 18 (gate-OFF 60 → gate-ON 42)
Gate-OFF's single largest loss: -$42.28 (entry 2026-...) — PAUSED by gate ✓
Total loss cut by the gate:  30% (-$206.45 → -$145.13)
Max drawdown cut by the gate: 30% (-$207.79 → -$146.47)
```

(Exact wording around timestamps may differ slightly; the metric values reproduce
the published figures within rounding.)

## What it does

The pair is `BTC_ETH_LEAD_LAG_BASE` (V2A long-only). The spread is `log(BTC/ETH)`.

- **Entry:** z-score `< −2.0` → go long the lagging leg (ETH cheap vs BTC), expecting reversion.
- **Exit:** z `≥ −0.5` → reverted; z `≤ −3.5` → stop-loss; age `≥ 72h` → time-stop.
- **Config (`SA_BASELINE`):** z_entry 2.0, z_exit 0.5, z_stop 3.5, 48-bar window, $1,000/trade,
  0.3% round-trip cost per leg applied once on close.
- **The CMC gate (the point of the demo):** on bars where CMC reads `bear_trending` (risk-off),
  **new entries pause**; exits always run (entry-only gate). In a one-directional long strategy,
  pausing entries during a bear is exactly where drawdown is avoided.

In a crash, a long-only strategy loses; the gate's job is to lose **less**. That's what the
~30% reduction in both loss and drawdown shows — capital preservation, not profit.

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
