// In-memory storage adapter.
//
// The private system uses Supabase for persistence. This adapter implements
// the same interface in memory so the strategy logic runs without any DB.
// Swap IStorage for a real DB adapter (Supabase, Postgres, SQLite) to persist state.

import type { RegimeClassification } from "../regime/types.js";
import type { StatArbSignal } from "../strategies/stat-arb/types.js";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IStorage {
  // Regime history
  saveRegime(classification: RegimeClassification): Promise<void>;
  getLatestRegime(): Promise<RegimeClassification | null>;
  getRecentRegimes(limit: number): Promise<RegimeClassification[]>;

  // Stat arb signals
  saveSignal(signal: StatArbSignal): Promise<void>;
  getSignals(pair?: string): Promise<StatArbSignal[]>;

  // Generic key-value store (for strategy state, counters, etc.)
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | null>;
}

// ─── In-memory implementation ─────────────────────────────────────────────────

export class MemoryStore implements IStorage {
  private regimes: RegimeClassification[] = [];
  private signals: StatArbSignal[]        = [];
  private kv: Map<string, unknown>        = new Map();

  async saveRegime(classification: RegimeClassification): Promise<void> {
    this.regimes.push(classification);
  }

  async getLatestRegime(): Promise<RegimeClassification | null> {
    return this.regimes.at(-1) ?? null;
  }

  async getRecentRegimes(limit: number): Promise<RegimeClassification[]> {
    return this.regimes.slice(-limit).reverse();
  }

  async saveSignal(signal: StatArbSignal): Promise<void> {
    this.signals.push(signal);
  }

  async getSignals(pair?: string): Promise<StatArbSignal[]> {
    if (!pair) return [...this.signals];
    return this.signals.filter((s) => s.pair === pair);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.kv.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.kv.get(key) as T) ?? null;
  }
}
