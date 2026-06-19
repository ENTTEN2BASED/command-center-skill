// Z-score over a spread series — ported verbatim from the live system's
// src/lib/stat-arb/spread-calculator.ts (computeZScore).
//
// Population variance (divide by N), NOT sample variance — this is exactly what
// the live strategy and the overdrive replay use, so the reproduced numbers match.

export interface SpreadDataPoint {
  timestamp: string;
  price_a: number;
  price_b: number;
  spread: number; // log(price_a / price_b) for lead-lag pairs
}

export interface ZScoreResult {
  current_spread: number;
  mean: number;
  std_dev: number;
  z_score: number;
  candles_used: number;
  is_valid: boolean;
}

/**
 * Compute z-score over the last `window` spread data points.
 * Returns is_valid = false when there is insufficient data or zero variance.
 */
export function computeZScore(
  spread_series: SpreadDataPoint[],
  window = 48,
): ZScoreResult {
  const invalid = (reason: Partial<ZScoreResult>): ZScoreResult => ({
    current_spread: spread_series.at(-1)?.spread ?? 0,
    mean: 0,
    std_dev: 0,
    z_score: 0,
    candles_used: spread_series.length,
    is_valid: false,
    ...reason,
  });

  if (spread_series.length < window) return invalid({});

  const slice = spread_series.slice(-window);
  const spreads = slice.map((p) => p.spread);
  const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length;

  const variance = spreads.reduce((acc, v) => acc + (v - mean) ** 2, 0) / spreads.length;
  const std_dev = Math.sqrt(variance);

  if (std_dev === 0) return invalid({ mean, current_spread: spreads.at(-1) ?? 0 });

  const current_spread = spreads.at(-1)!;
  const z_score = (current_spread - mean) / std_dev;

  return { current_spread, mean, std_dev, z_score, candles_used: slice.length, is_valid: true };
}
