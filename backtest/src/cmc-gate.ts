// CMC risk-off gate reconstruction — ported faithfully from the live system:
//   - cmcRegimeIsRiskOff               (src/lib/market-data/cmc-regime-enrichment.ts)
//   - deriveRegimeFromRestData thresholds (same file)
//   - buildBtcRiskOffTimeline / lookupRiskOff (src/lib/overdrive/stat-arb-replay.ts)
//
// CMC historical data is paywalled, so the per-bar CMC verdict is RECONSTRUCTED from
// the only macro input available historically: the BTC 7-day trend (real Binance
// OHLCV). The reconstruction reuses the live risk-off mapping verbatim and replicates
// deriveRegimeFromRestData's EXACT threshold cut-points (−10 → bear, +5 → bull).
//
// APPROXIMATION (documented, matches the live replay): deriveRegimeFromRestData also
// keys on btc_dominance and total_market_cap_change. Neither is available historically:
//   - btc_dominance held at a constant >55 (it was structurally >55 throughout the era).
//   - total_market_cap_change absent → the live `Math.abs(x ?? 0) < 3` branch ⇒ ranging.
// Net: the regime is driven by btc_7d with the same numeric cut-points the live
// classifier uses, and risk-off ⇔ bear_trending — exactly as in the live gate.

import type { Candle } from "./csv.js";

const ASSUMED_BTC_DOMINANCE = 56; // >55, per the approximation above
const SEVEN_DAYS_SEC = 7 * 24 * 3600;

export interface RiskOffPoint {
  ts: number; // Unix ms
  riskOff: boolean;
  btc7dChange: number;
}

// Live cmcRegimeIsRiskOff — risk-off ONLY on bear_trending (dxy clause dormant).
export function cmcRegimeIsRiskOff(cmcRegime: string | null): boolean {
  return cmcRegime === "bear_trending";
}

// Faithful replica of the live deriveRegimeFromRestData thresholds, reduced to the
// inputs available in replay (btc_7d only, dominance/mcap approximated).
export function reconstructCmcRegime(btc7dChange: number): string {
  if (ASSUMED_BTC_DOMINANCE > 55 && btc7dChange < -10) return "bear_trending";
  if (ASSUMED_BTC_DOMINANCE > 55 && btc7dChange > 5) return "bull_trending";
  return "ranging";
}

/**
 * Build a per-bar risk-off timeline from real BTC 5m candles. The BTC series must
 * extend ≥7 days before the trading window so a rolling 7d change exists from the
 * first in-window bar (the bundled BTCUSDT_5m.csv starts 7 days early for this).
 */
export function buildBtcRiskOffTimeline(btc: Candle[]): RiskOffPoint[] {
  const sorted = [...btc].sort((a, b) => a.timestamp - b.timestamp); // Unix seconds
  const pts: RiskOffPoint[] = [];
  let j = 0; // monotonic pointer to the last candle at/before (current ts − 7d)

  for (let i = 0; i < sorted.length; i++) {
    const tref = sorted[i].timestamp - SEVEN_DAYS_SEC;
    while (j < sorted.length && sorted[j].timestamp <= tref) j++;
    const pastIdx = j - 1;
    if (pastIdx < 0) continue; // no 7d-ago candle yet
    const past = sorted[pastIdx];
    // Reject if the nearest "7d ago" candle is itself stale (>8d gap) — unreliable change
    if (sorted[i].timestamp - past.timestamp > SEVEN_DAYS_SEC + 24 * 3600) continue;
    const btc7d = past.close > 0 ? ((sorted[i].close - past.close) / past.close) * 100 : 0;
    const regime = reconstructCmcRegime(btc7d);
    pts.push({ ts: sorted[i].timestamp * 1000, riskOff: cmcRegimeIsRiskOff(regime), btc7dChange: btc7d });
  }
  return pts;
}

// Last risk-off point at/before the bar time (graceful: empty timeline ⇒ false).
export function lookupRiskOff(timeMs: number, timeline: RiskOffPoint[]): boolean {
  let riskOff = false;
  for (const pt of timeline) {
    if (pt.ts <= timeMs) riskOff = pt.riskOff;
    else break;
  }
  return riskOff;
}
