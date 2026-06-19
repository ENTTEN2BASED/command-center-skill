# Stat-Arb Live Track Record — Standard Metric Set

_Generated 2026-06-19T03:55:22.113Z from `paper_positions` (status = Closed). Read-only._

| Metric | Stat Arb | Stat Arb V2B | Combined |
|---|---|---|---|
| Measured trades | 194 | 22 | 216 |
| Wins / Losses | 96 / 98 | 10 / 12 | 106 / 110 |
| Win rate | 49.5% | 45.5% | 49.1% |
| Total return (PnL, CAD) | +$36.16 | -$2.54 | +$33.61 |
| Mean return / trade | 0.0393% | -0.0578% | 0.0294% |
| Return stddev (per-trade) | 0.7829% | 0.6054% | 0.7661% |
| Sharpe (per-trade) | 0.0502 | -0.0955 | 0.0384 |
| Max drawdown (CAD) | -$46.25 | -$4.10 | -$46.25 |
| Max drawdown (% of starting capital) | 0.092% | 0.008% | 0.092% |

## Method & formula notes

- **Measured-only.** Closes flagged `unmeasured = true` are excluded from **every** metric. These are price-feed artifacts (a leg's exit price froze on its entry price when the live price source failed, booking a fake $0 PnL). This mirrors the dashboard exactly (`src/routes/performance.tsx:206`). Each `paper_positions` row is one measured close; for two-leg pairs (V1 / V2B) each leg is counted as one record, identical to the dashboard's per-row semantics.
- **Total return** = Σ `net_pnl` over measured closes (CAD, gross — paper PnL carries no gas/slippage deduction). **Mean return / trade** = mean of per-trade `return_pct`.
- **Win rate** = count(`net_pnl` > 0) / count(measured).
- **Sharpe (per-trade)** = mean(`return_pct`) / stddev(`return_pct`) over the measured per-trade return series, using **sample** standard deviation (n−1). This is a **per-trade** Sharpe — it is **NOT annualized** (no trades/year scaling is applied). Annualizing would require an explicit trades-per-year assumption, which is not made here.
- **Max drawdown** = the largest peak-to-trough decline on the cumulative equity curve: sort measured closes by `closed_at` ascending, cumulate `net_pnl`, track the running peak, and take max(peak − cumulative). Reported in absolute CAD and two ways as a percentage:
  - **% of starting capital** — the meaningful, convention-matching figure (the system's own drawdown guardrails are defined as % of starting capital). **Cite this one.**
  - **% of PnL peak** — the literal "% of the running peak" of the cumulative-PnL curve. This is **degenerate for a market-neutral strategy**: the PnL peak hovers near $0, so dividing a normal-sized drawdown by a tiny peak yields a >100% value with no economic meaning. Included for completeness only.
- **Equity curve** points (`closed_at`, `cumulative_pnl`) are in the companion `stat-arb-metrics.json` for charting.
