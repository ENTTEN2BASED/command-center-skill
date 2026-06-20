# Skill: Market-Neutral Stat-Arb with CMC Risk-Off Gate

## Summary
BTC/ETH lead-lag statistical arbitrage. Deterministic z-score entry/exit, with CoinMarketCap's market-regime signal acting as a risk-off entry gate. Designed for capital preservation: market-neutral, sub-0.1%-of-capital drawdown on the live paper record.

## Deterministic rules (backtestable)
- Signal: 48-candle rolling z-score on the BTC/ETH price ratio.
- Entry: z < -2.0 (ETH cheap vs BTC relative to recent ratio).
- Exit: z >= 0.0 (mean reversion complete).
- Stop: z <= -4.0 (adverse divergence).
- Time-stop: 72h.
- Position size: $1,000 CAD / trade (V2A); $200/leg, $400/pair, $800 combined cap (V2B delta-neutral).
- CMC risk-off gate (entry-only): on CMC bear_trending (risk-off), pause new entries; exits always run. (V2A also pauses in low_volatility.)

Note: this spec does not currently include a correlation or RSI gate. If those are intended, add them with explicit thresholds before claiming them.

## Risk limits
- Max drawdown guardrails defined as % of starting capital (50,000 CAD).
- Measured-only accounting: pricing-fallback closes excluded from all metrics.

## Live paper track record (measured, through 2026-06-19)
194 trades, 49.5% WR, +$36.16 PnL, mean +0.039%/trade, per-trade Sharpe 0.05 (NOT annualized), max DD $46.25 = 0.09% of capital. See results/stat-arb-metrics.md.

## CMC gate impact (crash-window backtest, May 26-Jun 10, BTC ~ -19%, V2A long-only)
Trades 46->29, PnL -$185.95->-$99.51 (~46% less loss), max DD 0.393%->0.216% of capital. Loss reduction, not profit. Per-trade Sharpe -0.2783->-0.4318 (gate cuts exposure, not per-trade quality). CMC history reconstructed from real BTC 7d trend using the live signal's exact thresholds (CMC history is paywalled). See results/stat-arb-gate-comparison.md.

## CMC roles
(1) risk-off entry gate; (2) live token-safety gating: Token Scout drops unsafe new tokens at discovery + a daily sweep auto-blacklists unsafe active pools, fails open on unknown; (3) regime confidence modifier; (4) performance benchmark. Learning loop runs on pool/trade data, not CMC.

## Sponsor stacks
CoinMarketCap (regime + live token-safety + gate); Trust Wallet Agent Kit (self-custody signing); BNB Chain / Aster (perp venue, V2B).
