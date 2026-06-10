// Statistical arbitrage strategy types.

export interface SpreadDataPoint {
  timestamp: string;  // ISO8601
  price_a: number;
  price_b: number;
  spread: number;     // price_a / price_b (cross-venue) or log(price_a / price_b) (lead-lag)
}

export interface ZScoreResult {
  current_spread: number;
  mean: number;
  std_dev: number;
  z_score: number;
  candles_used: number;
  is_valid: boolean;
}

export interface StatArbPair {
  name: string;
  pool_a_name: string;
  pool_b_name: string;
  long_only: boolean;        // true = V2A (enter long when z < -entry, exit when z → 0)
  z_score_entry: number;     // e.g. 2.0 — enter when |z| exceeds this
  z_score_exit: number;      // e.g. 0.5 — exit when z reverts toward 0
  z_score_stop: number;      // e.g. -4.0 — stop loss (negative = absolute threshold for long-only)
  max_hold_hours: number;    // time-stop
  position_size_usd: number; // per-leg size
  active: boolean;
}

export interface StatArbSignal {
  pair: string;
  z_score: number;
  mean: number;
  std_dev: number;
  action: "enter_long" | "enter_short" | "exit" | "stop" | "watch";
  reason: string;
  generated_at: string;
}
