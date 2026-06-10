// Generic strategy interfaces.

import type { MarketRegime } from "../regime/types.js";

export type { MarketRegime };

export interface PoolInfo {
  name: string;
  address?: string;
  tvl_usd?: number;
  volume_24h_usd?: number;
  age_days?: number;
}

export interface TradeSignal {
  action: "enter" | "exit" | "hold" | "rotate";
  pool?: string;
  reason: string;
  regime: string;
  confidence: number;
  generated_at: string;
}

export interface BacktestConfig {
  dateStart: string;
  dateEnd: string;
  initialCapital: number;
  positionSizeUsd: number;
  roundTripCostPct: number;  // e.g. 0.003 = 0.3%
}

export interface BacktestTrade {
  pool: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  regime: string;
  pnl: number;
  exitReason: string;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  avgWin: number | null;
  avgLoss: number | null;
  maxDrawdownPct: number;
}
