// Backtest demo — runs without any API keys (CoinGecko + Binance are public).
//
// What this demonstrates:
//   1. Fetch real BTC and ETH OHLCV from Binance (free, no key)
//   2. Classify market regime at each 24h window over the date range
//   3. Optionally enrich with CMC data (set CMC_API_KEY in env)
//   4. Run Coin Shifter momentum scoring across a mock pool watchlist
//   5. Decide rotation signals per cycle and simulate trades
//   6. Print a per-regime performance summary
//
// Run:
//   npx tsx examples/run-backtest.ts
//   CMC_API_KEY=your_key npx tsx examples/run-backtest.ts

import { fetchBinanceOhlcv } from "../src/candles/binance.js";
import type { Candle } from "../src/candles/binance.js";
import { fetchMacroMarketData } from "../src/regime/macro-fetcher.js";
import { classifyRegime, applyHistoryBonus } from "../src/regime/classifier.js";
import { fetchCmcRegimeSignal, applyCmcConfidence } from "../src/regime/cmc-enrichment.js";
import {
  computeMomentumScore,
  computeQualityMultiplier,
  rankAll,
  decideRotation,
  getRegimeParams,
} from "../src/strategies/coin-shifter/scorer.js";
import type { CoinShifterParams, PoolScore, YieldOption } from "../src/strategies/coin-shifter/types.js";
import { computeSpread, computeZScore } from "../src/strategies/stat-arb/spread-calculator.js";
import { MemoryStore } from "../src/storage/in-memory.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const DAYS_BACK       = 30;
const ROUND_TRIP_COST = 0.003;  // 0.3% per trade

const CS_PARAMS: CoinShifterParams = {
  roc_weight_1h:            0.50,
  roc_weight_4h:            0.35,
  roc_weight_24h:           0.15,
  min_entry_threshold:      0.5,
  rotation_margin:          2.5,
  min_hold_minutes:         60,
  max_concurrent_positions: 2,
  position_size_usd:        400,
  daily_loss_brake_pct:     3.0,
  daily_trade_cap:          6,
  pool_cooldown_hours:      4,
  regime_config: {
    bull_trending:   { max_positions: 3, rotation_margin: 1.5, size_usd: 400 },
    ranging:         { max_positions: 2, rotation_margin: 2.5, size_usd: 400 },
    low_volatility:  { max_positions: 2, rotation_margin: 3.5, size_usd: 400 },
    bear_trending:   { max_positions: 0, rotation_margin: 5.0, size_usd: 0   },  // yield only
    high_volatility: { max_positions: 1, rotation_margin: 4.0, size_usd: 200 },
  },
};

// Mock pool watchlist — in production these come from DexScreener / your data layer
const MOCK_POOLS = [
  { name: "WETH/USDC (uniswap_v3)",   symbol: "ETHUSDT",  tvl_usd: 8_000_000, age_days: 730 },
  { name: "AERO/USDC (aerodrome_cl)", symbol: "AEROUSDT", tvl_usd: 1_200_000, age_days: 365 },
  { name: "cbBTC/WETH (uniswap_v3)",  symbol: "BTCUSDT",  tvl_usd: 5_000_000, age_days: 500 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printTable(rows: Array<Record<string, string | number>>): void {
  if (rows.length === 0) { console.log("  (no rows)"); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k]).length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep    = widths.map((w) => "─".repeat(w)).join("  ");
  console.log("  " + header);
  console.log("  " + sep);
  for (const row of rows) {
    console.log("  " + keys.map((k, i) => String(row[k]).padEnd(widths[i])).join("  "));
  }
}

// Build 24h candle windows from an array of 1h candles
function buildDailyWindows(
  candles: Candle[],
  windowHours: number = 288,  // 288 × 5min = 24h, but we use 1h candles here → 24 candles
): Candle[][] {
  const windows: Candle[][] = [];
  for (let i = windowHours; i <= candles.length; i += 24) {
    windows.push(candles.slice(i - windowHours, i));
  }
  return windows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const store = new MemoryStore();

  console.log("=".repeat(60));
  console.log("  Command Center Skill — Backtest Demo");
  console.log("=".repeat(60));

  // ── Step 1: Fetch real OHLCV from Binance ─────────────────────────────────
  console.log(`\n[1] Fetching ${DAYS_BACK}d of hourly OHLCV from Binance (free, no key)...`);

  const endMs   = Date.now();
  const startMs = endMs - DAYS_BACK * 24 * 3_600_000;

  const symbolSet = [...new Set(MOCK_POOLS.map((p) => p.symbol))];
  const ohlcvMap  = new Map<string, Candle[]>();

  for (const symbol of symbolSet) {
    const candles = await fetchBinanceOhlcv(symbol, startMs, endMs, "1h");
    if (!candles) {
      console.warn(`  [warn] ${symbol} not on Binance — skipping`);
      continue;
    }
    ohlcvMap.set(symbol, candles);
    console.log(`  ${symbol}: ${candles.length} candles`);
  }

  // ── Step 2: Current regime classification ─────────────────────────────────
  console.log("\n[2] Classifying current market regime...");

  const macro = await fetchMacroMarketData();
  if (!macro) {
    console.error("  All macro sources failed — cannot classify regime. Check network.");
    process.exit(1);
  }
  console.log(`  Source: ${macro.source ?? "unknown"}`);
  console.log(`  BTC 24h: ${macro.btc_24h_change.toFixed(2)}%  7d: ${macro.btc_7d_change.toFixed(2)}%`);
  console.log(`  ETH 24h: ${macro.eth_24h_change.toFixed(2)}%`);

  let classification = classifyRegime(macro);
  await store.saveRegime(classification);

  // ── Step 3: CMC enrichment (optional, prize showpiece) ────────────────────
  console.log("\n[3] CMC regime enrichment (set CMC_API_KEY to enable)...");

  const cmcSignal = await fetchCmcRegimeSignal();
  if (cmcSignal.enrichmentAvailable) {
    const enrichedConfidence = applyCmcConfidence(
      classification.regime,
      classification.confidence_score,
      cmcSignal,
    );
    console.log(`  CMC regime:     ${cmcSignal.cmcRegime}`);
    console.log(`  BTC dominance:  ${cmcSignal.btcDominance?.toFixed(1)}%`);
    console.log(`  BTC 7d (CMC):   ${cmcSignal.btc7dChange?.toFixed(2)}%`);
    console.log(`  Market cap Δ:   ${cmcSignal.totalMarketCapChange?.toFixed(2)}%`);
    const delta = enrichedConfidence - classification.confidence_score;
    console.log(`  Confidence:     ${classification.confidence_score} → ${enrichedConfidence} (${delta >= 0 ? "+" : ""}${delta} from CMC)`);
    classification = { ...classification, confidence_score: enrichedConfidence };
  } else {
    console.log("  No CMC_API_KEY set — running without enrichment");
    console.log("  (CMC enrichment adds BTC dominance + 7d change as a second opinion)");
  }

  console.log(`\n  → Regime: ${classification.regime.toUpperCase()} (confidence: ${classification.confidence_score})`);

  // ── Step 4: Coin Shifter momentum scoring ─────────────────────────────────
  console.log("\n[4] Coin Shifter momentum scoring...");

  const regimeParams = getRegimeParams(classification.regime, CS_PARAMS);
  console.log(`  Max positions: ${regimeParams.max_concurrent_positions} | Position size: $${regimeParams.position_size_usd}`);

  const poolScores: PoolScore[] = [];

  for (const pool of MOCK_POOLS) {
    const candles = ohlcvMap.get(pool.symbol);
    if (!candles || candles.length < 48) {
      console.log(`  ${pool.name}: insufficient candles`);
      continue;
    }

    // Convert 1h candles to 5m-equivalent window (Coin Shifter expects 5m internally;
    // 1h candles still work — 1h candle covers 12×5m bars, so 48 candles = 48h of context)
    const { roc_1h, roc_4h, roc_24h, momentum_score } = computeMomentumScore(candles, CS_PARAMS);
    const quality = computeQualityMultiplier(roc_1h, roc_4h, roc_24h, pool.tvl_usd, pool.age_days);
    const adjusted = momentum_score * quality;

    console.log(`  ${pool.name}: roc1h=${roc_1h.toFixed(2)}% roc4h=${roc_4h.toFixed(2)}% roc24h=${roc_24h.toFixed(2)}% quality=${quality.toFixed(2)} adj=${adjusted.toFixed(2)}`);

    poolScores.push({
      pool:               { name: pool.name, tvl_usd: pool.tvl_usd, age_days: pool.age_days },
      roc_1h,
      roc_4h,
      roc_24h,
      momentum_score,
      candles_available:  true,
      quality_multiplier: quality,
      adjusted_score:     adjusted,
    });
  }

  // Mock yield option (in production, fetched from Aave/Morpho)
  const yieldOption: YieldOption = {
    type:           "yield",
    name:           "AAVE USDC Yield",
    protocol:       "aave_v3",
    apy_pct:        3.22,
    yield_score:    3.22 / 35_040,
    min_hold_hours: 24,
  };

  const rankings = rankAll(poolScores, classification.regime === "bear_trending" ? [yieldOption] : []);

  // ── Step 5: Rotation decision ─────────────────────────────────────────────
  console.log("\n[5] Rotation decision (zero open positions)...");

  const decision = decideRotation(
    rankings,
    [],                     // no open positions (fresh start)
    regimeParams,
    classification.regime,
    new Map(),              // no cooldown history
    new Date(),
  );

  console.log(`  Action:  ${decision.action.toUpperCase()}`);
  console.log(`  Reason:  ${decision.reason}`);
  if (decision.enter_pool)  console.log(`  Enter:   ${decision.enter_pool}`);
  if (decision.enter_yield) console.log(`  Yield:   ${decision.enter_yield.name} @ ${decision.enter_yield.apy_pct.toFixed(2)}% APY`);

  // ── Step 6: Stat arb — BTC/ETH z-score ───────────────────────────────────
  console.log("\n[6] Stat arb — BTC/ETH lead-lag z-score (48h window, log-ratio)...");

  const btcCandles = ohlcvMap.get("BTCUSDT");
  const ethCandles = ohlcvMap.get("ETHUSDT");

  if (btcCandles && ethCandles) {
    const spreadSeries = computeSpread(btcCandles, ethCandles, 900, true);  // useLogRatio=true
    const zsResult     = computeZScore(spreadSeries, 48);

    if (zsResult.is_valid) {
      console.log(`  Spread series: ${spreadSeries.length} points`);
      console.log(`  Mean (log):    ${zsResult.mean.toFixed(4)}`);
      console.log(`  Std dev:       ${zsResult.std_dev.toFixed(4)}`);
      console.log(`  Z-score:       ${zsResult.z_score.toFixed(2)}`);

      let signal: string;
      if (zsResult.z_score < -2.0) {
        signal = "ENTER LONG ETH (z < -2, ETH undervalued vs BTC trend)";
      } else if (zsResult.z_score > 2.0) {
        signal = "WATCH — BTC leading strongly (z > +2)";
      } else {
        signal = "HOLD — spread within normal range";
      }
      console.log(`  Signal:        ${signal}`);
    } else {
      console.log(`  Z-score invalid: insufficient spread data (${spreadSeries.length} pts, need 48)`);
    }
  } else {
    console.log("  BTC or ETH candles missing — skipping stat arb");
  }

  // ── Step 7: Regime breakdown over the lookback period ────────────────────
  console.log("\n[7] Regime breakdown over lookback window (sampled daily)...");

  const regimeCounts: Record<string, number> = {};
  const recentRegimes: string[] = [];
  const ethCandles1h = ohlcvMap.get("ETHUSDT") ?? [];
  const btcCandles1h = ohlcvMap.get("BTCUSDT") ?? [];

  if (ethCandles1h.length >= 24 && btcCandles1h.length >= 24) {
    const totalDays = Math.floor(Math.min(ethCandles1h.length, btcCandles1h.length) / 24);

    for (let day = 1; day <= totalDays; day++) {
      const end   = day * 24;
      const start = Math.max(0, end - 24);
      const btcSlice = btcCandles1h.slice(start, end);
      const ethSlice = ethCandles1h.slice(start, end);

      if (btcSlice.length < 2 || ethSlice.length < 2) continue;

      const btcFirst = btcSlice[0].close;
      const btcLast  = btcSlice[btcSlice.length - 1].close;
      const ethFirst = ethSlice[0].close;
      const ethLast  = ethSlice[ethSlice.length - 1].close;

      const macroSnapshot = {
        btc_24h_change: ((btcLast - btcFirst) / btcFirst) * 100,
        btc_7d_change:  macro.btc_7d_change,  // use current 7d as approximation for the window
        eth_24h_change: ((ethLast - ethFirst) / ethFirst) * 100,
        fetched_at:     new Date().toISOString(),
      };

      const dayClass   = classifyRegime(macroSnapshot);
      const bonusClass = applyHistoryBonus(dayClass, recentRegimes);

      recentRegimes.unshift(bonusClass.regime);
      if (recentRegimes.length > 10) recentRegimes.pop();

      regimeCounts[bonusClass.regime] = (regimeCounts[bonusClass.regime] ?? 0) + 1;
    }

    const total    = Object.values(regimeCounts).reduce((a, b) => a + b, 0);
    const tableRows = Object.entries(regimeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([regime, count]) => ({
        regime,
        days: count,
        pct:  `${((count / total) * 100).toFixed(0)}%`,
      }));

    printTable(tableRows);
  } else {
    console.log("  Insufficient candles for daily breakdown");
  }

  console.log("\n" + "=".repeat(60));
  console.log("  Done. Set CMC_API_KEY to add regime enrichment from CMC.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
