// Minimal offline CSV loader for the bundled Binance 5m candles.
// Zero dependencies, zero network. The CSVs are public Binance kline data
// (timestamp in Unix seconds + OHLCV) — no secrets, no API keys.

import { readFileSync } from "node:fs";

export interface Candle {
  timestamp: number; // Unix seconds (candle open)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function loadCandles(path: string): Candle[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: Candle[] = [];
  // Skip header row (timestamp,open,high,low,close,volume)
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    out.push({
      timestamp: parseInt(p[0], 10),
      open: parseFloat(p[1]),
      high: parseFloat(p[2]),
      low: parseFloat(p[3]),
      close: parseFloat(p[4]),
      volume: parseFloat(p[5]),
    });
  }
  return out;
}
