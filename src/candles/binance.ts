// Binance public REST — OHLCV fetcher.
// No API key required. Free, paginated, 1000 candles per request.
// Intervals: "1h" | "1d" | "5m"

export interface Candle {
  timestamp: number;  // Unix seconds (candle open)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BINANCE_API = "https://api.binance.com/api/v3/klines";
const MAX_PER_REQUEST = 1000;

type KlineRow = [number, string, string, string, string, string, ...unknown[]];

// Fetch OHLCV candles for a Binance symbol (e.g. "BTCUSDT", "ETHUSDT", "AEROUSDT").
// Returns null when the symbol is not listed on Binance (HTTP 400).
export async function fetchBinanceOhlcv(
  symbol: string,
  startMs: number,
  endMs: number,
  interval: "1h" | "1d" | "5m" = "1h",
): Promise<Candle[] | null> {
  const all: Candle[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const url =
      `${BINANCE_API}?symbol=${symbol}&interval=${interval}` +
      `&startTime=${cursor}&endTime=${endMs}&limit=${MAX_PER_REQUEST}`;

    const resp = await fetch(url, { headers: { Accept: "application/json" } });

    if (resp.status === 400) return null;  // symbol not on Binance

    if (!resp.ok) {
      throw new Error(`Binance ${symbol} ${interval}: HTTP ${resp.status}`);
    }

    const rows = await resp.json() as KlineRow[];
    if (!rows.length) break;

    for (const row of rows) {
      all.push({
        timestamp: Math.floor((row[0] as number) / 1000),
        open:      parseFloat(row[1] as string),
        high:      parseFloat(row[2] as string),
        low:       parseFloat(row[3] as string),
        close:     parseFloat(row[4] as string),
        volume:    parseFloat(row[5] as string),
      });
    }

    if (rows.length < MAX_PER_REQUEST) break;
    cursor = (rows[rows.length - 1][0] as number) + 1;
  }

  return all;
}

// Convenience: fetch the last N days of hourly candles for a symbol.
export async function fetchRecentOhlcv(
  symbol: string,
  days: number,
  interval: "1h" | "1d" | "5m" = "1h",
): Promise<Candle[]> {
  const endMs   = Date.now();
  const startMs = endMs - days * 24 * 60 * 60_000;
  const candles = await fetchBinanceOhlcv(symbol, startMs, endMs, interval);
  return candles ?? [];
}
