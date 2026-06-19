# Command Center — Market-Neutral Stat-Arb Strategy Skill
## BNB Chain × CoinMarketCap × Trust Wallet Hackathon — Track 2: Strategy Skills

## What this is
A market-neutral statistical-arbitrage Strategy Skill (BTC/ETH lead-lag), validated on a real paper track record, with CoinMarketCap's market-regime signal wired directly into the entry decision. The thesis is capital preservation through a bear/ranging tape, not raw return — and a genuine, decision-path use of CMC data (not advisory dashboards).

## Headline — risk control first
- Market-neutral, extremely low drawdown. Live paper stat-arb: 194 measured trades, max drawdown $46.25 = 0.09% of capital across a bear/ranging market.
- Near-breakeven by design. +$36.16 total PnL, mean +0.039%/trade, 49.5% win rate, per-trade Sharpe 0.05 — a capital-preservation engine, not a return engine.
- CMC regime signal in the decision path. On CMC bear_trending (risk-off), new entries pause; exits always run. In a crash-window backtest this cut both total loss and max drawdown by ~30%.

## Live paper track record — Stat Arb (measured, full period)
Source: paper_positions (status = Closed), measured-only — pricing-fallback "unmeasured" closes are excluded from every metric. Generated 2026-06-19.

| Metric | Value |
|---|---|
| Measured trades | 194 |
| Win rate | 49.5% (96W / 98L) |
| Total PnL (CAD, gross) | +$36.16 |
| Mean return / trade | +0.039% |
| Per-trade Sharpe (NOT annualized) | 0.05 |
| Max drawdown | $46.25 = 0.09% of starting capital |

Read as: near-breakeven, market-neutral, sub-0.1% drawdown through a bear/ranging market. Full detail + equity curve in results/stat-arb-metrics.md.

## CMC regime risk-off gate — the centerpiece
CMC's market-regime signal is promoted from advisory to a real entry gate on the stat-arb strategy: when CMC reads bear_trending (risk-off), new entries pause; exits always run (entry-only gate). Crash-window backtest below.

### Crash-window backtest (May 26 – Jun 10, BTC ~ -19%), V2A long-only
| Metric | gate OFF | gate ON | Effect |
|---|---|---|---|
| Trades | 60 | 42 | 18 long entries paused (incl. the single largest loss, -$42) |
| Total PnL | -$206.45 | -$145.13 | loss cut ~30% |
| Max drawdown | -$207.79 (0.42% cap) | -$146.47 (0.29% cap) | ~30% less |
| Per-trade Sharpe | -0.30 | -0.51 | slightly worse (gate cuts exposure, not per-trade quality) |

Honest framing:
- This is loss reduction, not profit — a long-only strategy loses in a crash; the gate reduces the damage.
- The 49.5% win rate is full-period live performance; the crash-window backtest is a deliberate worst-case stress test. Distinct contexts — not a contradiction.
- The backtest's CMC history is reconstructed from real BTC 7-day trend using the live signal's exact thresholds, because CMC historical data is paywalled (see results/stat-arb-gate-comparison.md).
- V1 cross-venue results are tiny/snapshot-based — relegated, not headlined.
- V2B perp is out of replay scope but shares the identical risk-off signal.

## What CMC actually does here (four real roles)
1. Regime risk-off entry gate — bear_trending pauses new stat-arb entries (the decision-path use above).
2. Live token-safety gating — CMC token-safety (honeypot, security score, LP-lock, holder-count signals) runs in two scheduled jobs: Token Scout drops unsafe new-token candidates at discovery, and a daily safety sweep auto-blacklists unsafe active pools. Fails open on unknown.
3. Regime confidence modifier — CMC macro/derivatives signal adjusts the price-based regime classifier's confidence.
4. Performance benchmark — CMC regime read used as an external check on the system's own classification.

The autonomous learning loop (M7/M8/M13/M14) runs on pool/trade data, not CMC.

## Sponsor stacks
- CoinMarketCap — regime signal, live token-safety gating, and the risk-off entry gate.
- Trust Wallet Agent Kit (TWAK) — self-custody signing / on-chain execution.
- BNB Chain / Aster — perp venue for the delta-neutral V2B variant.

## Strategy spec
Deterministic, backtestable rules in strategies/stat_arb_v2.md. Measured track record in results/stat-arb-metrics.md; gate comparison in results/stat-arb-gate-comparison.md.
