// CMC REST API enrichment for the regime classifier.
//
// Uses two endpoints:
//   /v1/global-metrics/quotes/latest  — BTC dominance + total market cap change
//   /v1/cryptocurrency/quotes/latest  — BTC 7-day price change
//
// Both are available on the free Basic tier (10k credits/month).
// Enrichment is additive — never blocks execution. Falls back gracefully.
//
// Set CMC_API_KEY env var to enable. Without it, returns enrichmentAvailable=false.

export interface CmcRegimeSignal {
  cmcRegime: string | null;
  cmcConviction: string | null;
  btcDominance: number | null;
  btc7dChange: number | null;
  totalMarketCapChange: number | null;
  enrichmentAvailable: boolean;
  fetchedAt: string;
}

const CMC_BASE = "https://pro-api.coinmarketcap.com";

const EMPTY: CmcRegimeSignal = {
  cmcRegime: null,
  cmcConviction: null,
  btcDominance: null,
  btc7dChange: null,
  totalMarketCapChange: null,
  enrichmentAvailable: false,
  fetchedAt: new Date().toISOString(),
};

function getCmcKey(): string {
  return process.env.CMC_API_KEY ?? process.env.CMC_MCP_API_KEY ?? "";
}

// Derives our 5-state regime from CMC global metrics.
// btcDominance > 55 + btc7dChange sign → strong bull/bear signal.
// Low market cap change → ranging.
function deriveRegimeFromCmc(
  btcDominance: number | null,
  totalMarketCapChange: number | null,
  btc7dChange: number | null,
): string | null {
  if (btcDominance === null || btc7dChange === null) return null;

  if (btcDominance > 55 && btc7dChange < -10) return "bear_trending";
  if (btcDominance > 55 && btc7dChange > 5)   return "bull_trending";
  if (btcDominance < 45 && btc7dChange > 10)  return "bull_trending";
  if (Math.abs(totalMarketCapChange ?? 0) < 3) return "ranging";

  return "ranging";
}

// Fetch CMC regime enrichment. Returns EMPTY (enrichmentAvailable=false) on any failure.
export async function fetchCmcRegimeSignal(): Promise<CmcRegimeSignal> {
  const key = getCmcKey();
  if (!key) {
    return { ...EMPTY, fetchedAt: new Date().toISOString() };
  }

  const headers = {
    "X-CMC_PRO_API_KEY": key,
    "Accept": "application/json",
  };

  try {
    // Call 1: Global metrics — BTC dominance + market cap change
    const metricsRes = await fetch(
      `${CMC_BASE}/v1/global-metrics/quotes/latest`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!metricsRes.ok) {
      console.warn(`[cmc-enrichment] global-metrics failed: HTTP ${metricsRes.status}`);
      return { ...EMPTY, fetchedAt: new Date().toISOString() };
    }
    const metricsJson = await metricsRes.json() as Record<string, unknown>;
    const metricsData = metricsJson?.data as Record<string, unknown> | null;
    const btcDominance = (metricsData?.btc_dominance as number | null) ?? null;
    const quoteUsd = (metricsData?.quote as Record<string, unknown> | null)
      ?.USD as Record<string, unknown> | null;
    const totalMarketCapChange =
      (quoteUsd?.total_market_cap_yesterday_percentage_change as number | null) ?? null;

    // Call 2: BTC quotes — 7-day price change
    const btcRes = await fetch(
      `${CMC_BASE}/v1/cryptocurrency/quotes/latest?symbol=BTC&convert=USD`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!btcRes.ok) {
      console.warn(`[cmc-enrichment] BTC quotes failed: HTTP ${btcRes.status}`);
      return { ...EMPTY, fetchedAt: new Date().toISOString() };
    }
    const btcJson = await btcRes.json() as Record<string, unknown>;
    const btcQuoteUsd =
      ((btcJson?.data as Record<string, unknown> | null)
        ?.BTC as Record<string, unknown> | null)
        ?.quote as Record<string, unknown> | null;
    const btc7dChange =
      ((btcQuoteUsd?.USD as Record<string, unknown> | null)
        ?.percent_change_7d as number | null) ?? null;

    const derivedRegime = deriveRegimeFromCmc(btcDominance, totalMarketCapChange, btc7dChange);

    return {
      cmcRegime:           derivedRegime,
      cmcConviction:       btcDominance !== null ? "medium" : null,
      btcDominance,
      btc7dChange,
      totalMarketCapChange,
      enrichmentAvailable: derivedRegime !== null,
      fetchedAt:           new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[cmc-enrichment] fetch failed:", err instanceof Error ? err.message : err);
    return { ...EMPTY, fetchedAt: new Date().toISOString() };
  }
}

// Apply CMC enrichment to a base confidence score.
// Boosts +10 when CMC agrees with classified regime, reduces -10 on mismatch.
export function applyCmcConfidence(
  classifiedRegime: string,
  baseConfidence: number,
  cmcSignal: CmcRegimeSignal,
): number {
  if (!cmcSignal.enrichmentAvailable || !cmcSignal.cmcRegime) {
    return baseConfidence;
  }
  const delta = cmcSignal.cmcRegime === classifiedRegime ? 10 : -10;
  return Math.max(0, Math.min(100, baseConfidence + delta));
}
