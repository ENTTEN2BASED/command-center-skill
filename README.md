# Command Center — Autonomous DeFi Trading System
## BNB Chain × CoinMarketCap × Trust Wallet Hackathon
### Track 2: Strategy Skills

## Overview
Autonomous multi-strategy DeFi trading system with 
self-improving learning loop. Uses CMC Skill Hub as 
intelligence layer for regime detection, token safety, 
and signal enrichment.

## System Status — June 8 2026
- Paper trading: 11 days live
- Strategies with trade history: 4
- Learning loop: 14 autonomous proposal mappings
- Latest build: Block 6 live execution layer (TWAK REST client, dual-record pattern)
- Next milestone: First live on-chain trade (after activation prereqs met)

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

## Live Execution Layer (Block 6)
- **Status:** BUILT June 8 2026, not yet activated
- Trust Wallet Agent Kit REST API (`src/lib/execution/twak-client.ts`)
- Dual-record pattern: paper position written first, then live swap executed — audit trail preserved regardless of swap outcome
- Kill switch: $500 max per trade, 2% max price impact, 1% max slippage
- Fallback: TWAK unavailable → paper only, system_event logged
- Activation: `UPDATE settings SET execution_mode = 'Live'` after all prerequisites met (funded wallet, TWAK running in WSL, 7+ days positive paper trend, no critical bugs 72h)

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
