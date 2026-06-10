// Market Regime Classifier — pure, deterministic.
// 5 regimes: bull_trending | bear_trending | ranging | high_volatility | low_volatility
// No I/O. Call classifyRegime() with macro data from any source.

import type { MacroMarketData, MarketRegime, RegimeClassification } from "./types.js";

export type { MacroMarketData, MarketRegime, RegimeClassification };

export function classifyRegime(macro: MacroMarketData): RegimeClassification {
  const { btc_24h_change, btc_7d_change, eth_24h_change } = macro;
  const absBtc24h = Math.abs(btc_24h_change);
  const absEth24h = Math.abs(eth_24h_change);

  let regime: MarketRegime;

  // Signal 1: volatility (highest priority)
  if (absBtc24h > 8 || absEth24h > 10) {
    regime = "high_volatility";
  } else if (absBtc24h < 1 && absEth24h < 1.5) {
    regime = "low_volatility";
  }
  // Signal 2: trend direction
  else if (btc_24h_change > 3 && eth_24h_change > 2 && btc_7d_change > 5) {
    regime = "bull_trending";
  } else if (btc_24h_change < -3 && eth_24h_change < -2 && btc_7d_change < -5) {
    regime = "bear_trending";
  }
  // Signal 3: default
  else {
    regime = "ranging";
  }

  // Confidence scoring
  let confidence = 50;

  const btcUp = btc_24h_change > 0;
  const ethUp = eth_24h_change > 0;
  if (btcUp === ethUp) {
    confidence += 20;  // BTC and ETH agree directionally
  } else {
    confidence -= 20;
  }

  const btc7dConfirms =
    (btc_24h_change > 0 && btc_7d_change > 0) ||
    (btc_24h_change < 0 && btc_7d_change < 0);
  if (btc7dConfirms) confidence += 15;  // 7d confirms 24h direction

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    regime,
    confidence_score: confidence,
    btc_24h_change,
    eth_24h_change,
    btc_7d_change,
    raw_signals: {
      btc_24h_change,
      btc_7d_change,
      eth_24h_change,
      abs_btc_24h: absBtc24h,
      abs_eth_24h: absEth24h,
    },
    classified_at: new Date().toISOString(),
  };
}

// Apply +15 confidence bonus when two prior consecutive readings agreed with the current regime.
export function applyHistoryBonus(
  classification: RegimeClassification,
  recentRegimes: string[],
): RegimeClassification {
  if (
    recentRegimes.length >= 2 &&
    recentRegimes[0] === classification.regime &&
    recentRegimes[1] === classification.regime
  ) {
    return {
      ...classification,
      confidence_score: Math.min(100, classification.confidence_score + 15),
    };
  }
  return classification;
}
