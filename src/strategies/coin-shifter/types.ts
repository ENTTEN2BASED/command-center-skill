// Coin Shifter strategy types.

import type { PoolInfo } from "../types.js";

export type { PoolInfo };

export interface CoinShifterParams {
  roc_weight_1h: number;
  roc_weight_4h: number;
  roc_weight_24h: number;
  min_entry_threshold: number;
  rotation_margin: number;
  min_hold_minutes: number;
  max_concurrent_positions: number;
  position_size_usd: number;
  daily_loss_brake_pct: number;
  daily_trade_cap: number;
  pool_cooldown_hours: number;
  regime_config?: Record<string, { max_positions: number; rotation_margin: number; size_usd: number }>;
}

export interface PoolScore {
  pool: PoolInfo;
  roc_1h: number;
  roc_4h: number;
  roc_24h: number;
  momentum_score: number;
  candles_available: boolean;
  quality_multiplier: number;
  adjusted_score: number;
}

export interface YieldOption {
  type: "yield";
  name: string;
  protocol: string;
  apy_pct: number;
  yield_score: number;
  min_hold_hours: number;
}

export interface RotationDecision {
  action: "hold" | "enter" | "rotate" | "exit_to_defense";
  exit_pool: string | null;
  enter_pool: string | null;
  enter_yield: YieldOption | null;
  reason: string;
  regime: string;
  momentum_scores: PoolScore[];
}

export function isYieldPool(pool: string): boolean {
  return pool.endsWith(" USDC Yield");
}
