# Command Center — Autonomous DeFi Trading System
## BNB Chain × CoinMarketCap × Trust Wallet Hackathon
### Track 2: Strategy Skills

## Overview
Autonomous multi-strategy DeFi trading system with 
self-improving learning loop. Uses CMC Skill Hub as 
intelligence layer for regime detection, token safety, 
and signal enrichment.

## System Status — June 6 2026
- Paper trading: 17 days live
- Strategies with trade history: 4
- Total closed trades: 87
- Learning loop: 14 autonomous proposal mappings
- Latest build: Stat Arb V2A BTC/ETH lead-lag
- Next milestone: First live on-chain trade
  (target June 11-12 via Trust Wallet Agent Kit)

## Architecture
- 7 strategies built (4 with live paper trading history):
  - Coin Shifter — active, momentum rotation
  - Micro Momentum Scanner — active, 32.3% WR
  - DeFi Rotation V2 — redesigned June 6
  - Stat Arb V1/V2A — active, BTC/ETH lead-lag
  - LP Strategy — built, deferred ($5k minimum)
  - Aave Short — spec complete, Block 6 target
  - Stat Arb V2B — BNB+Aster, in development
- Autonomous learning loop: 14 proposal mappings
- CMC Skill Hub: regime enrichment, safety gates,
  derivatives signals
- Execution: Trust Wallet Agent Kit (Base + BNB Chain)
- Chain: Base (primary), BNB Chain (Stat Arb V2B)

## CMC Skill Hub Integration
- detect_market_regime → regime classifier enrichment
- verify_new_token_safety → token scout safety gate
- detect_funding_rate_regime_shift → Aave Short gate
- altcoin_breakout_scanner_spot → momentum pre-filter

## Results
[Paper trading results — updated daily]
[Live trading results — from June 11]

## Strategy Specs
See /strategies/ for full backtestable specifications.
