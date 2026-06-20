// Stat-arb replay — the V2A long-only slice, ported faithfully from the live system's
// src/lib/overdrive/stat-arb-replay.ts (alignPriceSeries, checkExit, computeNetPnl,
// and the per-bar simulation loop), reduced to the single BTC/ETH lead-lag pair.
//
// Pair: BTC_ETH_LEAD_LAG_BASE (V2A long-only). Leg A = cbBTC, Leg B = WETH.
//   spread = log(price_a / price_b) = log(BTC / ETH)
//   entry  : z < −Z_ENTRY            → long leg B (ETH) — ETH cheap vs BTC, expect reversion
//   exit   : z ≥ −Z_EXIT             → z_score_reverted
//   stop   : z ≤ −Z_STOP             → stop_loss (correlation breaking)
//   time   : age ≥ MAX_HOLD_HOURS    → time_stop
//
// Config = the live authoritative V2A params (stat_arb_pairs BTC_ETH_LEAD_LAG_BASE —
// the exact thresholds that drove the live paper trades):
//   z_entry 2.0, z_exit 0.0, z_stop 4.0, max_hold 72h, size $1000/trade,
//   round-trip cost 0.3% per leg applied once on close.

import { computeZScore, type SpreadDataPoint } from "./zscore.js";
import { lookupRiskOff, type RiskOffPoint } from "./cmc-gate.js";
import type { Candle } from "./csv.js";

export const CANDLE_WINDOW = 48;
export const Z_ENTRY = 2.0;
export const Z_EXIT = 0.0;
export const Z_STOP = 4.0;
export const MAX_HOLD_HOURS = 72;
export const POSITION_SIZE = 1000;
export const ROUND_TRIP_COST_PER_LEG = 0.003;

export interface PricePoint {
  timestamp: number; // Unix seconds
  price: number;
}

export interface ClosedTrade {
  entryTimeMs: number;
  exitTimeMs: number;
  exitReason: string;
  netPnl: number; // rounded to 2dp, matching the live outcome row
  returnPct: number; // (netPnl / size) * 100, rounded to 2dp — feeds Sharpe
}

// Nearest-neighbour time alignment, 900s tolerance, useLogRatio=true for lead-lag.
// Ported verbatim from stat-arb-replay.ts:alignPriceSeries.
export function alignPriceSeries(
  seriesA: PricePoint[],
  seriesB: PricePoint[],
  toleranceSec = 900,
): SpreadDataPoint[] {
  const sortedA = [...seriesA].sort((x, y) => x.timestamp - y.timestamp);
  const sortedB = [...seriesB].sort((x, y) => x.timestamp - y.timestamp);
  const usedB = new Set<number>();
  const result: SpreadDataPoint[] = [];
  let bStart = 0;

  for (const pa of sortedA) {
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = bStart; i < sortedB.length; i++) {
      const delta = Math.abs(pa.timestamp - sortedB[i].timestamp);
      if (delta > toleranceSec && sortedB[i].timestamp > pa.timestamp + toleranceSec) break;
      if (delta <= toleranceSec && delta < bestDelta && !usedB.has(i)) {
        bestDelta = delta;
        bestIdx = i;
      }
      if (sortedB[i].timestamp < pa.timestamp - toleranceSec) bStart = i + 1;
    }
    if (bestIdx === -1) continue;
    const pb = sortedB[bestIdx];
    if (pb.price === 0 || pa.price === 0) continue;
    usedB.add(bestIdx);
    const ratio = pa.price / pb.price;
    result.push({
      timestamp: new Date(pa.timestamp * 1000).toISOString(),
      price_a: pa.price,
      price_b: pb.price,
      spread: Math.log(ratio), // log-ratio for the lead-lag pair
    });
  }
  return result.length >= 10 ? result : [];
}

// V2A long-only exit check — ported from checkExit (longOnly branch).
function checkExit(zScore: number, ageHours: number): string | null {
  if (ageHours >= MAX_HOLD_HOURS) return "time_stop";
  if (zScore >= -Z_EXIT) return "z_score_reverted"; // z reverts up toward 0
  if (zScore <= -Z_STOP) return "stop_loss"; // z diverges further
  return null;
}

// V2A single-leg PnL — ported from computeNetPnl (long_only_b branch).
function computeNetPnl(entryPriceB: number, exitPriceB: number): number {
  const ret = (exitPriceB - entryPriceB) / entryPriceB - ROUND_TRIP_COST_PER_LEG;
  return ret * POSITION_SIZE;
}

interface OpenPos {
  entryTimeMs: number;
  entryPriceB: number;
}

/**
 * Run the V2A long-only replay over an aligned spread series.
 * When `riskOffTimeline` is provided, the CMC risk-off gate pauses NEW entries on
 * risk-off bars (entry-only — exits always run), mirroring the live gate.
 */
export function runReplay(
  spreadSeries: SpreadDataPoint[],
  riskOffTimeline: RiskOffPoint[] | null,
): ClosedTrade[] {
  const trades: ClosedTrade[] = [];
  let openPos: OpenPos | null = null;

  const record = (exitTimeMs: number, exitReason: string, exitPriceB: number) => {
    const raw = computeNetPnl(openPos!.entryPriceB, exitPriceB);
    const netPnl = Math.round(raw * 100) / 100;
    const returnPct = Math.round((raw / POSITION_SIZE) * 10000) / 100;
    trades.push({ entryTimeMs: openPos!.entryTimeMs, exitTimeMs, exitReason, netPnl, returnPct });
    openPos = null;
  };

  for (let i = CANDLE_WINDOW; i < spreadSeries.length; i++) {
    const window = spreadSeries.slice(i - CANDLE_WINDOW, i + 1); // 49 pts; z uses last 48
    const zResult = computeZScore(window, CANDLE_WINDOW);
    if (!zResult.is_valid) continue;

    const pt = spreadSeries[i];
    const nowMs = new Date(pt.timestamp).getTime();
    const priceB = pt.price_b;
    const z = zResult.z_score;
    const cmcRiskOff = riskOffTimeline ? lookupRiskOff(nowMs, riskOffTimeline) : false;

    if (openPos) {
      const ageHours = (nowMs - openPos.entryTimeMs) / 3_600_000;
      const reason = checkExit(z, ageHours);
      if (reason) record(nowMs, reason, priceB);
    }

    if (!openPos && !cmcRiskOff && z < -Z_ENTRY) {
      openPos = { entryTimeMs: nowMs, entryPriceB: priceB };
    }
  }

  // Force-close any position still open at the end of the window.
  if (openPos) {
    const last = spreadSeries[spreadSeries.length - 1];
    record(new Date(last.timestamp).getTime(), "window_end", last.price_b);
  }

  return trades;
}

// Build the per-leg price series from candles, mirroring fetchLegPrices (close prices).
export function candlesToPrices(candles: Candle[]): PricePoint[] {
  return candles.map((c) => ({ timestamp: c.timestamp, price: c.close }));
}
