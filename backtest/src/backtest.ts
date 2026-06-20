// Stat-Arb CMC risk-off gate — crash-window reproduction (gate-OFF vs gate-ON).
//
// A self-contained slice of the Command Center system: the V2A long-only BTC/ETH
// lead-lag stat-arb strategy, replayed over the May 26 – Jun 10 2026 crash window
// (BTC ≈ −19%) with CoinMarketCap's risk-off regime signal wired in as an entry gate.
//
// Fully offline: bundled Binance 5m candles, zero network, zero secrets, zero DB.
// Logic ported faithfully from the live system (see each module header for source).
//
// This reproduces the published headline: pausing long entries while CMC reads
// bear_trending cuts total loss by ~46% and max drawdown by ~45% across the crash.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles } from "./csv.js";
import { buildBtcRiskOffTimeline } from "./cmc-gate.js";
import {
  alignPriceSeries,
  candlesToPrices,
  runReplay,
  POSITION_SIZE,
  Z_ENTRY,
  Z_EXIT,
  Z_STOP,
  MAX_HOLD_HOURS,
  CANDLE_WINDOW,
  type ClosedTrade,
} from "./replay.js";

// Crash window — identical to the live comparison script (BTC $75.9k→$61.4k, −19%).
const DATE_START_MS = Date.parse("2026-05-26T00:00:00Z");
const DATE_END_MS = Date.parse("2026-06-10T23:59:59Z");
const STARTING_CAPITAL = 50_000; // CAD — the drawdown-%-of-capital denominator

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");

// ---------------------------------------------------------------------------
// Group metrics — ported from stat-arb-gate-comparison.ts:computeGroup
// ---------------------------------------------------------------------------

interface GroupMetrics {
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  totalPnl: number;
  meanReturnPct: number | null;
  returnPctStddev: number | null;
  sharpePerTrade: number | null;
  maxDrawdownAbs: number;
  maxDrawdownPctCapital: number | null;
}

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sampleStdDev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
function round(x: number | null, dp = 2): number | null {
  if (x === null || !isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function computeGroup(trades: ClosedTrade[]): GroupMetrics {
  const pnls = trades.map((t) => t.netPnl);
  const ret = trades.map((t) => t.returnPct);
  const total = pnls.reduce((a, b) => a + b, 0);
  const wins = pnls.filter((p) => p > 0).length;
  const wr = trades.length > 0 ? (wins / trades.length) * 100 : null;
  const m = mean(ret);
  const sd = sampleStdDev(ret);
  const sharpe = m !== null && sd !== null && sd > 0 ? m / sd : null;

  // Drawdown over trades ordered by exit time (single pair ⇒ already chronological).
  const ordered = [...trades].sort((a, b) => a.exitTimeMs - b.exitTimeMs);
  let cum = 0,
    peak = 0,
    maxDd = 0;
  for (const t of ordered) {
    cum += t.netPnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    trades: trades.length,
    wins,
    losses: trades.length - wins,
    winRatePct: round(wr, 1),
    totalPnl: round(total, 2)!,
    meanReturnPct: round(m, 4),
    returnPctStddev: round(sd, 4),
    sharpePerTrade: round(sharpe, 4),
    maxDrawdownAbs: round(maxDd, 2)!,
    maxDrawdownPctCapital: round((maxDd / STARTING_CAPITAL) * 100, 4),
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function fmtPnl(x: number | null): string {
  if (x === null) return "—";
  return `${x >= 0 ? "+" : "-"}$${Math.abs(x).toFixed(2)}`;
}
function fmtNum(x: number | null, suffix = "", dp = 2): string {
  if (x === null) return "—";
  const sign = x >= 0 ? "" : "-";
  return `${sign}${Math.abs(x).toFixed(dp)}${suffix}`;
}
function fmtDelta(on: number | null, off: number | null, suffix = "", dp = 2): string {
  if (on === null || off === null) return "—";
  const d = on - off;
  return `${d >= 0 ? "+" : "-"}${Math.abs(d).toFixed(dp)}${suffix}`;
}

function pctReduction(off: number, on: number): string {
  if (off === 0) return "—";
  return `${(((off - on) / off) * 100).toFixed(0)}%`;
}

function printComparison(off: GroupMetrics, on: GroupMetrics): void {
  const w = 16;
  const col = (s: string) => s.padStart(w);
  console.log(`\n=== V2A long-only — gate-OFF vs gate-ON (crash window 2026-05-26 → 2026-06-10) ===`);
  console.log(`${"Metric".padEnd(22)}${col("gate-OFF")}${col("gate-ON")}${col("Δ (on − off)")}`);
  console.log("-".repeat(22 + w * 3));
  const line = (label: string, offS: string, onS: string, deltaS: string) =>
    console.log(`${label.padEnd(22)}${col(offS)}${col(onS)}${col(deltaS)}`);

  line("Trades", String(off.trades), String(on.trades), String(on.trades - off.trades));
  line(
    "Win rate",
    fmtNum(off.winRatePct, "%", 1),
    fmtNum(on.winRatePct, "%", 1),
    fmtDelta(on.winRatePct, off.winRatePct, "pp", 1),
  );
  line("Total PnL", fmtPnl(off.totalPnl), fmtPnl(on.totalPnl), fmtDelta(on.totalPnl, off.totalPnl, "", 2));
  line(
    "Max DD ($)",
    fmtPnl(-off.maxDrawdownAbs),
    fmtPnl(-on.maxDrawdownAbs),
    fmtDelta(-on.maxDrawdownAbs, -off.maxDrawdownAbs, "", 2),
  );
  line(
    "Max DD (% capital)",
    fmtNum(off.maxDrawdownPctCapital, "%", 4),
    fmtNum(on.maxDrawdownPctCapital, "%", 4),
    fmtDelta(on.maxDrawdownPctCapital, off.maxDrawdownPctCapital, "pp", 4),
  );
  line(
    "Sharpe (per-trade)",
    fmtNum(off.sharpePerTrade, "", 4),
    fmtNum(on.sharpePerTrade, "", 4),
    fmtDelta(on.sharpePerTrade, off.sharpePerTrade, "", 4),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("=== Stat-Arb CMC risk-off gate — crash-window reproduction ===");
  console.log("Pair: BTC_ETH_LEAD_LAG_BASE (V2A long-only) | spread = log(BTC/ETH)");
  console.log(
    `Config (live authoritative): z_entry=${Z_ENTRY.toFixed(1)} z_exit=${Z_EXIT.toFixed(1)} z_stop=${Z_STOP.toFixed(1)} ` +
      `window=${CANDLE_WINDOW} max_hold=${MAX_HOLD_HOURS}h size=$${POSITION_SIZE}/trade cost=0.3%/leg`,
  );

  // Load bundled public Binance 5m candles (offline).
  const btcAll = loadCandles(join(dataDir, "BTCUSDT_5m.csv")); // starts 7d early for the gate
  const ethAll = loadCandles(join(dataDir, "ETHUSDT_5m.csv"));

  // Legs: restrict to the trading window [DATE_START, DATE_END] (mirrors fetchCmcOhlcv range).
  const inWindow = (tsSec: number) => tsSec * 1000 >= DATE_START_MS && tsSec * 1000 <= DATE_END_MS;
  const btcLeg = candlesToPrices(btcAll.filter((c) => inWindow(c.timestamp)));
  const ethLeg = candlesToPrices(ethAll.filter((c) => inWindow(c.timestamp)));

  const spreadSeries = alignPriceSeries(btcLeg, ethLeg, 900);
  console.log(
    `\nBundled candles: BTC ${btcAll.length} (incl. 7d lookback), ETH ${ethAll.length} | ` +
      `aligned spread points: ${spreadSeries.length}`,
  );

  // CMC risk-off gate timeline — reconstructed from the FULL BTC series (needs 7d lookback).
  const riskOffTimeline = buildBtcRiskOffTimeline(btcAll);
  const riskOffBars = riskOffTimeline.filter((p) => p.riskOff).length;
  console.log(
    `CMC gate timeline: ${riskOffTimeline.length} bars, ${riskOffBars} risk-off ` +
      `(BTC 7d trend < −10% ⇒ bear_trending ⇒ pause new entries)`,
  );

  const offTrades = runReplay(spreadSeries, null); // gate OFF
  const onTrades = runReplay(spreadSeries, riskOffTimeline); // gate ON

  const off = computeGroup(offTrades);
  const on = computeGroup(onTrades);

  printComparison(off, on);

  // Gate effect summary — entries paused + the worst single trade it removed.
  const paused = off.trades - on.trades;
  const onEntryTimes = new Set(onTrades.map((t) => t.entryTimeMs));
  const worst = offTrades.reduce((a, b) => (b.netPnl < a.netPnl ? b : a));
  const worstPaused = !onEntryTimes.has(worst.entryTimeMs);

  console.log("\n--- Gate effect ---");
  console.log(`Entries paused by the gate: ${paused} (gate-OFF ${off.trades} → gate-ON ${on.trades})`);
  console.log(
    `Gate-OFF's single largest loss: ${fmtPnl(worst.netPnl)} ` +
      `(entry ${new Date(worst.entryTimeMs).toISOString()}) — ${worstPaused ? "PAUSED by gate ✓" : "still taken"}`,
  );
  console.log(`Total loss cut by the gate:  ${pctReduction(off.totalPnl, on.totalPnl)} ` +
    `(${fmtPnl(off.totalPnl)} → ${fmtPnl(on.totalPnl)})`);
  console.log(`Max drawdown cut by the gate: ${pctReduction(off.maxDrawdownAbs, on.maxDrawdownAbs)} ` +
    `(${fmtPnl(-off.maxDrawdownAbs)} → ${fmtPnl(-on.maxDrawdownAbs)})`);

  console.log("\n--- Disclosure ---");
  console.log("CMC history is RECONSTRUCTED (paywalled): per-bar verdict derived from the real BTC");
  console.log("7-day trend via the live deriveRegimeFromRestData thresholds + cmcRegimeIsRiskOff mapping.");
  console.log("Gate is entry-only (exits always run). This is a self-contained slice — the learning");
  console.log("loop and live execution engine are not included. See README.md.\n");
}

main();
