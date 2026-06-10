export type MarketRegime =
  | "bull_trending"
  | "bear_trending"
  | "ranging"
  | "high_volatility"
  | "low_volatility";

export interface MacroMarketData {
  btc_24h_change: number;
  btc_7d_change: number;
  eth_24h_change: number;
  fetched_at: string;
  source?: string;
}

export interface RegimeClassification {
  regime: MarketRegime;
  confidence_score: number;
  btc_24h_change: number;
  eth_24h_change: number;
  btc_7d_change: number;
  raw_signals: Record<string, unknown>;
  classified_at: string;
}
