// Statistical arbitrage — spread and z-score calculator.
// Pure functions: no I/O, fully deterministic.

import type { SpreadDataPoint, ZScoreResult } from "./types.js";
import type { Candle } from "../../candles/binance.js";

export type { SpreadDataPoint, ZScoreResult };

// ---------------------------------------------------------------------------
// computeSpread
//
// Aligns two candle arrays by timestamp (nearest-neighbour, toleranceSec window)
// and computes the spread for each matched pair.
//
// useLogRatio=false (cross-venue, same asset): spread = close_a / close_b
//   Both legs track the same token price — raw ratio stays near 1.0.
//
// useLogRatio=true (lead-lag, different assets): spread = log(close_a / close_b)
//   Normalises to relative divergence. BTC/AERO raw ratio ≈185,800 becomes
//   log-ratio ≈12.13 with std_dev ≈0.02 — 2σ = 4% relative move vs $4k absolute.
//
// Returns [] if fewer than 10 pairs are matched.
// ---------------------------------------------------------------------------

export function computeSpread(
  candles_a: Candle[],
  candles_b: Candle[],
  toleranceSec: number = 900,
  useLogRatio: boolean = false,
): SpreadDataPoint[] {
  const sortedA = [...candles_a].sort((a, b) => a.timestamp - b.timestamp);
  const sortedB = [...candles_b].sort((a, b) => a.timestamp - b.timestamp);
  const usedB   = new Set<number>();
  const result: SpreadDataPoint[] = [];
  let bStart = 0;

  for (const ca of sortedA) {
    let bestIdx   = -1;
    let bestDelta = Infinity;

    for (let i = bStart; i < sortedB.length; i++) {
      const delta = Math.abs(ca.timestamp - sortedB[i].timestamp);
      if (delta > toleranceSec && sortedB[i].timestamp > ca.timestamp + toleranceSec) break;
      if (delta <= toleranceSec && delta < bestDelta && !usedB.has(i)) {
        bestDelta = delta;
        bestIdx   = i;
      }
      if (sortedB[i].timestamp < ca.timestamp - toleranceSec) bStart = i + 1;
    }

    if (bestIdx === -1) continue;
    const cb = sortedB[bestIdx];
    if (cb.close === 0) continue;
    usedB.add(bestIdx);

    const ratio  = ca.close / cb.close;
    const spread = useLogRatio ? Math.log(ratio) : ratio;

    result.push({
      timestamp: new Date(ca.timestamp * 1000).toISOString(),
      price_a:   ca.close,
      price_b:   cb.close,
      spread,
    });
  }

  if (result.length < 10) return [];
  return result;
}

// ---------------------------------------------------------------------------
// computeZScore
//
// Rolling z-score over the last `window` spread data points.
// Returns is_valid=false when there is insufficient data or zero variance.
// ---------------------------------------------------------------------------

export function computeZScore(
  spread_series: SpreadDataPoint[],
  window: number = 48,
): ZScoreResult {
  const invalid = (reason: Partial<ZScoreResult>): ZScoreResult => ({
    current_spread: spread_series.at(-1)?.spread ?? 0,
    mean:           0,
    std_dev:        0,
    z_score:        0,
    candles_used:   spread_series.length,
    is_valid:       false,
    ...reason,
  });

  if (spread_series.length < window) return invalid({});

  const slice   = spread_series.slice(-window);
  const spreads = slice.map((p) => p.spread);
  const mean    = spreads.reduce((a, b) => a + b, 0) / spreads.length;

  const variance = spreads.reduce((acc, v) => acc + (v - mean) ** 2, 0) / spreads.length;
  const std_dev  = Math.sqrt(variance);

  if (std_dev === 0) return invalid({ mean, current_spread: spreads.at(-1) ?? 0 });

  const current_spread = spreads.at(-1)!;
  const z_score        = (current_spread - mean) / std_dev;

  return { current_spread, mean, std_dev, z_score, candles_used: slice.length, is_valid: true };
}

// ---------------------------------------------------------------------------
// Position sizing by regime
// ---------------------------------------------------------------------------

export function getPositionSizeByRegime(regime: string | null): number {
  switch (regime) {
    case "bull_trending":   return 300;
    case "bear_trending":   return 400;
    case "ranging":         return 300;
    case "high_volatility": return 150;
    case "low_volatility":  return 200;
    default:                return 200;
  }
}
