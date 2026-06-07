# Command Center — Autonomous DeFi Trading System
## BNB Chain × CoinMarketCap × Trust Wallet Hackathon
### Track 2: Strategy Skills

## Overview
Autonomous multi-strategy DeFi trading system with 
self-improving learning loop. Uses CMC Skill Hub as 
intelligence layer for regime detection, token safety, 
and signal enrichment.

## Architecture
- 5 active strategies: Coin Shifter, Micro Momentum,
  DeFi Rotation V2, Stat Arb V2, LP Strategy
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
