# BUIDL — Command Center: Market-Neutral Stat-Arb Strategy Skill

## One-liner
A market-neutral BTC/ETH statistical-arbitrage Strategy Skill that wires CoinMarketCap's market-regime signal directly into the entry decision — validated on a real paper track record, built for capital preservation.

## The problem
Most "AI trading" submissions chase returns and quietly lose money in a bear tape. We built the opposite: a market-neutral skill whose job is to not lose, and we let a sponsor's data signal actually change what the strategy does.

## What we built
- A deterministic, backtestable stat-arb strategy (z-score entry/exit/stop, time-stop, position sizing, %-of-capital risk limits).
- A decision-path CMC integration: CMC bear_trending (risk-off) pauses new entries while always allowing exits — not a dashboard, an actual gate.
- A measured paper track record and a gate-on/gate-off crash-window backtest.

## Evidence (real, measured)
Live paper — Stat Arb (full period, measured-only, through 2026-06-19):
194 trades, 49.5% WR, +$36.16 PnL, mean +0.039%/trade, per-trade Sharpe 0.05 (not annualized), max drawdown 0.09% of capital. Near-breakeven, market-neutral, extremely low drawdown through a bear/ranging market.

CMC gate — crash window (May 26-Jun 10, BTC ~ -19%, V2A long-only):
| | gate OFF | gate ON |
|---|---|---|
| Trades | 60 | 42 (18 paused, incl. the -$42 single largest loss) |
| Total PnL | -$206.45 | -$145.13 (~30% less loss) |
| Max drawdown | 0.42% cap | 0.29% cap (~30% less) |

We state the caveats plainly:
- Loss reduction, not profit — long-only loses in a crash; the gate limits damage.
- Per-trade Sharpe is slightly worse under the gate (-0.30 -> -0.51): the gate cuts exposure, it doesn't improve per-trade quality in a falling tape.
- The 49.5% live win rate (full period) and the worst-case crash backtest are distinct contexts, presented as such.
- CMC history is reconstructed from real BTC 7d trend using the live signal's exact thresholds, because CMC historical data is paywalled.
- V1 cross-venue is tiny/snapshot-based (relegated); V2B perp is out of replay scope but uses the identical risk-off signal.

## Best CMC Agent Hub use — four concrete roles
1. Risk-off entry gate (decision-path): bear_trending pauses new entries.
2. Live token-safety gating: CMC token-safety (honeypot / security score / LP-lock / holder-count) runs in two scheduled jobs — Token Scout drops unsafe new tokens at discovery, and a daily sweep auto-blacklists unsafe active pools. Fails open on unknown.
3. Regime confidence modifier on the price-based classifier.
4. Performance benchmark against the system's own regime read.
The learning loop (M7/M8/M13/M14) runs on pool/trade data, not CMC.

## Sponsor stacks (all three, honestly)
- CoinMarketCap — regime signal + live token-safety gating + the entry gate.
- Trust Wallet Agent Kit (TWAK) — self-custody signing / on-chain execution.
- BNB Chain / Aster — perp venue for the delta-neutral V2B variant; agent identity registered on-chain via ERC-8004 (Agent ID 130119, BSC testnet).

## Reproduce
Spec: strategies/stat_arb_v2.md. Metrics: results/stat-arb-metrics.md (+ JSON equity curve). Gate comparison: results/stat-arb-gate-comparison.md.
