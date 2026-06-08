# BNB Agent Registration

## Overview
Command Center registered as an on-chain agent identity on BNB Chain 
using ERC-8004 standard via the BNB Agent SDK.

## Registration Details
- **Standard:** ERC-8004 (on-chain agent identity)
- **Network:** BSC Testnet (mainnet coming soon)
- **SDK:** `pip install bnbagent`
- **Hackathon Track:** BNB Special Prize ($2k)

## Agent Identity
The Command Center registers as an autonomous trading agent with:
- Agent type: `autonomous_trading`
- Capabilities: `regime_detection`, `multi_strategy`, `self_improving`
- Chains: `base`, `bsc`
- Execution mode: `paper` (testnet), `live` (post-June 11)

## Registration Script
```python
from bnbagent import AgentRegistry
from bnbagent.erc8004 import AgentIdentity

identity = AgentIdentity(
    name="Command Center",
    version="4.25",
    agent_type="autonomous_trading",
    capabilities=[
        "regime_detection",
        "multi_strategy_rotation",
        "learning_loop",
        "cmc_skill_hub_integration"
    ],
    chains=["base", "bsc"],
    strategy_count=5,
    data_providers=["CoinMarketCap", "DexScreener", "Binance"],
)

registry = AgentRegistry(network="bsc_testnet")
tx = registry.register(identity)
print(f"Agent registered: {tx.hash}")
```

## APEX Protocol (future)
BNB Agent SDK includes APEX protocol for accepting paid strategy jobs 
from other protocols. Future monetization layer:
- External protocols can request regime analysis
- Strategy recommendations sold as a service
- Payment in BNB or stablecoins
- Enables system to fund its own infrastructure

## Stat Arb V2B — BNB Chain Execution
The Stat Arb V2B variant uses BNB Chain for delta-neutral pairs trading:
- Spot long: PancakeSwap V3 (BSC)
- Perp short: Aster protocol via Trust Wallet Agent Kit
- Gas: $0.05–$0.30 per transaction
- Perp fee: 0.005%/side (Aster)
- Settlement: USDT (BSC)

## Trust Wallet Agent Kit Integration
```python
# TWAK handles all on-chain execution — no manual wallet signing
from twak import AgentWallet

wallet = AgentWallet(
    chain="bsc",
    rules={
        "max_position_size_usd": 400,
        "allowed_protocols": ["pancakeswap-v3", "aster"],
        "withdrawal_only_to": "0x<cold_wallet>",
    }
)

# Swap routing built-in — 25+ chains including Base and BSC
tx = wallet.swap(
    token_in="USDT",
    token_out="ETH",
    amount=200,
    slippage_pct=0.5
)
```

## TWAK Execution Layer — LIVE (June 8)
- Trust Wallet Agent Kit REST API operational
- FISHERMAN agent wallet: 0x654d641bD9de12Be2E694673bBD17D04e1e4C1A6
- 60 actions: swaps, transfers, automations, x402 payments, ERC-8004 identity
- Block 6 execution path confirmed
- Next: erc8004_register + competition_register + first live trade

## ERC-8004 Registration — COMPLETE ✅

Agent ID: 130119
Owner: 0x654d641bD9de12Be2E694673bBD17D04e1e4C1A6
Chain: BSC testnet
Transactions: 5 (all gasless)
- erc8004_register: 0x24b7db1d189452e756415a16ff25d3cc59f500a5f0b2e1a4151a605cec068946
- erc8004_set_uri: 0x7dcd29bcd4f42478dd0ab432746b3700d51bd86a34b440e294515762fe57b1fa
- set_metadata name (FISHERMAN): 0xa5bc3523fdeec25171e4a25ad1251357fddfd55f51df53d275bc5f5c8ce96b50
- set_metadata description: 0xc31afbd918ee44607483863f8894e4788cca83c19cbc7f4ef3ef5101341de1ad
- set_metadata capabilities: 0x7c58d41f8fac381ef481aee06979b3cc2bc7b37cab12943564007de801cc0e3c

Capabilities on-chain:
swap, yield, stat_arb, momentum

Agent manifest:
https://raw.githubusercontent.com/ENTTEN2BASED/command-center-dashboard/main/public/fisherman-agent.json

competition_register: PENDING
Requires ~0.0037 BNB gas on BSC mainnet.
Fund 0x654d641bD9de12Be2E694673bBD17D04e1e4C1A6 then run competition_register action.
Registration window open until 2026-06-25.

## Status
- TWAK REST API: LIVE (June 8)
- FISHERMAN wallet: OPERATIONAL
- ERC-8004 registration: COMPLETE ✅ — Agent ID 130119, BSC testnet (commit 4954bff)
- competition_register: PENDING — needs ~$2 BNB gas on mainnet
- Aster perp integration: Spec complete, build June 9–14
