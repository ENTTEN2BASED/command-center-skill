// Coin Shifter — momentum scoring, pool ranking, and rotation decisions.
// Pure functions: no I/O, fully deterministic for a given input.

import type { Candle } from "../../candles/binance.js";
import type { CoinShifterParams, PoolScore, YieldOption, RotationDecision } from "./types.js";
import { isYieldPool } from "./types.js";

export type { CoinShifterParams, PoolScore, YieldOption, RotationDecision };

function isYieldItem(r: PoolScore | YieldOption): r is YieldOption {
  return (r as YieldOption).type === "yield";
}

function scoreOf(r: PoolScore | YieldOption): number {
  return isYieldItem(r) ? r.yield_score : r.adjusted_score;
}

// ---------------------------------------------------------------------------
// computeMomentumScore
//
// Requires at least 48 candles (4h of 5-min bars).
// Returns zeros when insufficient data is available.
// ---------------------------------------------------------------------------

export function computeMomentumScore(
  candles: Candle[],
  params: CoinShifterParams,
): { roc_1h: number; roc_4h: number; roc_24h: number; momentum_score: number } {
  if (candles.length < 48) {
    return { roc_1h: 0, roc_4h: 0, roc_24h: 0, momentum_score: 0 };
  }

  const last = candles.length - 1;
  const curr = candles[last].close;
  if (curr <= 0) return { roc_1h: 0, roc_4h: 0, roc_24h: 0, momentum_score: 0 };

  // 1h = 12 candles at 5-min intervals
  const base1h  = last >= 12  ? candles[last - 12]  : candles[0];
  const roc_1h  = base1h.close  > 0 ? ((curr - base1h.close)  / base1h.close)  * 100 : 0;

  // 4h = 48 candles at 5-min intervals
  const base4h  = last >= 48  ? candles[last - 48]  : candles[0];
  const roc_4h  = base4h.close  > 0 ? ((curr - base4h.close)  / base4h.close)  * 100 : 0;

  // 24h = 288 candles at 5-min intervals — uses oldest available if fewer candles exist
  const base24h = candles[0];
  const roc_24h = base24h.close > 0 ? ((curr - base24h.close) / base24h.close) * 100 : 0;

  const momentum_score =
    params.roc_weight_1h  * roc_1h +
    params.roc_weight_4h  * roc_4h +
    params.roc_weight_24h * roc_24h;

  return { roc_1h, roc_4h, roc_24h, momentum_score };
}

// ---------------------------------------------------------------------------
// computeQualityMultiplier
//
// Returns a multiplier in [0.40, 1.50] based on:
//   - liquidity depth (TVL vs trade size)
//   - momentum consistency (all 3 timeframes positive)
//   - single-day pump risk (roc_24h > 40%)
//   - pool age (< 60 days = less track record)
// ---------------------------------------------------------------------------

export function computeQualityMultiplier(
  roc_1h: number,
  roc_4h: number,
  roc_24h: number,
  tvl_usd: number | undefined,
  age_days: number | undefined,
): number {
  let m = 1.0;

  if (roc_1h > 0 && roc_4h > 0 && roc_24h > 0) m *= 1.25;  // sustained momentum
  if (tvl_usd !== undefined && tvl_usd > 2_000_000) m *= 1.10;  // deep liquidity
  if (tvl_usd !== undefined && tvl_usd < 100_000)  m *= 0.60;  // thin book risk
  if (roc_24h > 40) m *= 0.70;  // possible distribution phase
  if (age_days !== undefined && age_days < 60) m *= 0.80;  // new pool penalty

  return Math.min(Math.max(m, 0.40), 1.50);
}

// ---------------------------------------------------------------------------
// computeYieldScore
//
// Converts annual APY to per-15-minute equivalent score.
// 365 × 24 × 4 = 35,040 cycles per year.
// ---------------------------------------------------------------------------

export function computeYieldScore(apy_pct: number): number {
  return apy_pct / 35_040;
}

// ---------------------------------------------------------------------------
// rankAll
//
// Unified ranking of token pools + yield options, sorted by score descending.
// ---------------------------------------------------------------------------

export function rankAll(
  tokenScores: PoolScore[],
  yieldOptions: YieldOption[],
): Array<PoolScore | YieldOption> {
  const tokens = tokenScores.filter((s) => s.candles_available);
  const all: Array<PoolScore | YieldOption> = [...tokens, ...yieldOptions];
  return all.sort((a, b) => scoreOf(b) - scoreOf(a));
}

// ---------------------------------------------------------------------------
// getRegimeParams
//
// Applies regime-specific position sizing and margin from regime_config.
// ---------------------------------------------------------------------------

export function getRegimeParams(
  regime: string | null | undefined,
  base: CoinShifterParams,
): CoinShifterParams {
  const regimeKey  = regime ?? "";
  const regimeConf = base.regime_config?.[regimeKey];
  if (!regimeConf) return base;
  return {
    ...base,
    max_concurrent_positions: regimeConf.max_positions,
    rotation_margin:          regimeConf.rotation_margin,
    position_size_usd:        regimeConf.size_usd,
  };
}

// ---------------------------------------------------------------------------
// decideRotation
//
// Pure decision function. Accepts unified rankings (tokens + yield options)
// and current open positions. Returns what the strategy should do this cycle.
// ---------------------------------------------------------------------------

export function decideRotation(
  rankings: Array<PoolScore | YieldOption>,
  openPositions: Array<{ pool: string; opened_at: string | null }>,
  params: CoinShifterParams,
  regime: string,
  lastClosedMap: Map<string, Date | null>,
  now: Date,
): RotationDecision {
  const hasYieldPos    = openPositions.some((p) => isYieldPool(p.pool));
  const tokenOpenNames = new Set(
    openPositions.filter((p) => !isYieldPool(p.pool)).map((p) => p.pool),
  );
  const tokenOnlyOpen  = openPositions.filter((p) => !isYieldPool(p.pool));
  const yieldOption    = rankings.find(isYieldItem) as YieldOption | undefined;
  const tokenRankings  = rankings.filter((r) => !isYieldItem(r)) as PoolScore[];

  function inCooldown(poolName: string): boolean {
    if (tokenOpenNames.has(poolName)) return false;
    const lastClosed = lastClosedMap.get(poolName) ?? null;
    if (!lastClosed) return false;
    return (now.getTime() - lastClosed.getTime()) / 3_600_000 < params.pool_cooldown_hours;
  }

  function positionScore(poolName: string): number {
    return tokenRankings.find((s) => s.pool.name === poolName)?.adjusted_score ?? -Infinity;
  }

  function weakestTokenHolding() {
    return tokenOnlyOpen.reduce<typeof tokenOnlyOpen[number] | null>((weak, pos) => {
      if (!weak) return pos;
      return positionScore(pos.pool) < positionScore(weak.pool) ? pos : weak;
    }, null);
  }

  function holdMinutes(pos: { opened_at: string | null }): number {
    if (!pos.opened_at) return Infinity;
    return (now.getTime() - new Date(pos.opened_at).getTime()) / 60_000;
  }

  const availableTokens = tokenRankings.filter(
    (s) => !tokenOpenNames.has(s.pool.name) && !inCooldown(s.pool.name),
  );

  // ENTER path (below max positions)
  if (openPositions.length < params.max_concurrent_positions) {
    const top = rankings[0];

    if (top && isYieldItem(top) && !hasYieldPos) {
      return {
        action:          "enter",
        exit_pool:       null,
        enter_pool:      null,
        enter_yield:     top,
        reason:          `Enter yield: ${top.apy_pct.toFixed(4)}% APY beats all token momentum`,
        regime,
        momentum_scores: tokenRankings,
      };
    }

    const bestToken = availableTokens[0];
    if (bestToken && bestToken.adjusted_score >= params.min_entry_threshold) {
      return {
        action:          "enter",
        exit_pool:       null,
        enter_pool:      bestToken.pool.name,
        enter_yield:     null,
        reason:          `Enter: ${bestToken.pool.name} adj ${bestToken.adjusted_score.toFixed(2)} >= threshold ${params.min_entry_threshold}`,
        regime,
        momentum_scores: tokenRankings,
      };
    }

    return {
      action:          "hold",
      exit_pool:       null,
      enter_pool:      null,
      enter_yield:     null,
      reason:          availableTokens.length === 0
        ? "No token candidates available"
        : `Top score ${availableTokens[0]?.adjusted_score.toFixed(2)} below threshold ${params.min_entry_threshold}`,
      regime,
      momentum_scores: tokenRankings,
    };
  }

  // ROTATE path — at max positions

  // Case A: holding yield — check if a token now beats yield enough to justify exit
  if (hasYieldPos) {
    const yieldPos   = openPositions.find((p) => isYieldPool(p.pool)) ?? null;
    const yieldHeldH = yieldPos ? holdMinutes(yieldPos) / 60 : Infinity;
    const minHoldMet = yieldHeldH >= (yieldOption?.min_hold_hours ?? 24);
    const yScore     = yieldOption?.yield_score ?? 0;
    const bestToken  = availableTokens[0];

    if (minHoldMet && bestToken && bestToken.adjusted_score > yScore + params.rotation_margin) {
      return {
        action:          "rotate",
        exit_pool:       yieldPos?.pool ?? null,
        enter_pool:      bestToken.pool.name,
        enter_yield:     null,
        reason:          `Rotate from yield: ${bestToken.pool.name} adj ${bestToken.adjusted_score.toFixed(4)} > yield ${yScore.toFixed(6)} + margin ${params.rotation_margin}`,
        regime,
        momentum_scores: tokenRankings,
      };
    }

    return {
      action:          "hold",
      exit_pool:       null,
      enter_pool:      null,
      enter_yield:     null,
      reason:          `Hold yield: ${!minHoldMet ? `min hold not met (${yieldHeldH.toFixed(1)}h)` : "no better token available"}`,
      regime,
      momentum_scores: tokenRankings,
    };
  }

  // Case B: at max tokens — check if yield beats weakest
  if (!hasYieldPos && yieldOption) {
    const weak      = weakestTokenHolding();
    const yScore    = yieldOption.yield_score;
    const weakScore = weak ? positionScore(weak.pool) : Infinity;

    if (weak && yScore > weakScore + params.rotation_margin && holdMinutes(weak) >= params.min_hold_minutes) {
      return {
        action:          "rotate",
        exit_pool:       weak.pool,
        enter_pool:      null,
        enter_yield:     yieldOption,
        reason:          `Rotate to yield: ${yScore.toFixed(6)} > ${weak.pool} adj ${weakScore.toFixed(4)} + margin`,
        regime,
        momentum_scores: tokenRankings,
      };
    }
  }

  // Case C: normal token-to-token rotation
  const weak = weakestTokenHolding();
  const best = availableTokens[0];

  if (!weak || !best) {
    return {
      action:          "hold",
      exit_pool:       null,
      enter_pool:      null,
      enter_yield:     null,
      reason:          "At max positions, no rotation candidate available",
      regime,
      momentum_scores: tokenRankings,
    };
  }

  const weakScore = positionScore(weak.pool);
  const weakHeld  = holdMinutes(weak);

  if (best.adjusted_score > weakScore + params.rotation_margin && weakHeld >= params.min_hold_minutes) {
    return {
      action:          "rotate",
      exit_pool:       weak.pool,
      enter_pool:      best.pool.name,
      enter_yield:     null,
      reason:          `Rotate: ${best.pool.name} adj ${best.adjusted_score.toFixed(2)} > ${weak.pool} adj ${weakScore.toFixed(2)} + margin`,
      regime,
      momentum_scores: tokenRankings,
    };
  }

  return {
    action:          "hold",
    exit_pool:       null,
    enter_pool:      null,
    enter_yield:     null,
    reason:          weakHeld < params.min_hold_minutes
      ? `Min hold not met: ${weakHeld.toFixed(0)}min / ${params.min_hold_minutes}min`
      : `Rotation gap ${(best.adjusted_score - weakScore).toFixed(2)} < margin ${params.rotation_margin}`,
    regime,
    momentum_scores: tokenRankings,
  };
}
