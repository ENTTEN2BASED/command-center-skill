// Macro market data fetcher — multi-source fallback chain.
// Sources tried in order: CoinGecko → Binance → Kraken.
// Never throws — returns null only if all three sources fail.

import type { MacroMarketData } from "./types.js";

export type { MacroMarketData };

const TIMEOUT_MS = 6_000;

async function fetchFromCoinGecko(): Promise<MacroMarketData | null> {
  try {
    const apiKey = process.env.COINGECKO_API_KEY ?? "";
    const baseUrl = apiKey
      ? "https://pro-api.coingecko.com/api/v3/simple/price"
      : "https://api.coingecko.com/api/v3/simple/price";
    const url =
      baseUrl +
      "?ids=bitcoin,ethereum&vs_currencies=usd" +
      "&include_24hr_change=true&include_7d_change=true";
    const headers: Record<string, string> = apiKey ? { "x-cg-pro-api-key": apiKey } : {};

    const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers });
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      bitcoin?: { usd_24h_change?: number; usd_7d_change?: number };
      ethereum?: { usd_24h_change?: number };
    };

    const btc24h = data?.bitcoin?.usd_24h_change ?? null;
    const btc7d  = data?.bitcoin?.usd_7d_change  ?? null;
    const eth24h = data?.ethereum?.usd_24h_change ?? null;

    if (btc24h === null || btc7d === null || eth24h === null) return null;

    return {
      btc_24h_change: btc24h,
      btc_7d_change: btc7d,
      eth_24h_change: eth24h,
      fetched_at: new Date().toISOString(),
      source: "coingecko",
    };
  } catch {
    return null;
  }
}

async function fetchFromBinance(): Promise<MacroMarketData | null> {
  try {
    const [btcResp, ethResp] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT", {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ]);

    if (!btcResp.ok || !ethResp.ok) return null;

    const btcData = await btcResp.json() as { priceChangePercent?: string };
    const ethData = await ethResp.json() as { priceChangePercent?: string };

    const btc24h = btcData?.priceChangePercent != null ? parseFloat(btcData.priceChangePercent) : null;
    const eth24h = ethData?.priceChangePercent != null ? parseFloat(ethData.priceChangePercent) : null;

    if (btc24h === null || eth24h === null) return null;

    // Binance 24hr ticker has no 7d field — use 0 as fallback
    return {
      btc_24h_change: btc24h,
      btc_7d_change: 0,
      eth_24h_change: eth24h,
      fetched_at: new Date().toISOString(),
      source: "binance",
    };
  } catch {
    return null;
  }
}

async function fetchFromKraken(): Promise<MacroMarketData | null> {
  try {
    const resp = await fetch(
      "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD",
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!resp.ok) return null;

    const json = await resp.json() as {
      result?: {
        XXBTZUSD?: { c?: [string, string]; o?: string };
        XETHZUSD?: { c?: [string, string]; o?: string };
      };
    };

    const btcData = json?.result?.XXBTZUSD;
    const ethData = json?.result?.XETHZUSD;

    if (!btcData?.c?.[0] || !btcData?.o || !ethData?.c?.[0] || !ethData?.o) return null;

    const btcClose = parseFloat(btcData.c[0]);
    const btcOpen  = parseFloat(btcData.o);
    const ethClose = parseFloat(ethData.c[0]);
    const ethOpen  = parseFloat(ethData.o);

    if (!btcOpen || !ethOpen) return null;

    const btc24h = ((btcClose - btcOpen) / btcOpen) * 100;
    const eth24h = ((ethClose - ethOpen) / ethOpen) * 100;

    return {
      btc_24h_change: btc24h,
      btc_7d_change: 0,
      eth_24h_change: eth24h,
      fetched_at: new Date().toISOString(),
      source: "kraken",
    };
  } catch {
    return null;
  }
}

// Fetch macro data. Tries CoinGecko first, falls back to Binance, then Kraken.
// Returns null only if all three sources fail.
export async function fetchMacroMarketData(): Promise<MacroMarketData | null> {
  const cg = await fetchFromCoinGecko();
  if (cg) return cg;

  const bn = await fetchFromBinance();
  if (bn) return bn;

  return fetchFromKraken();
}
