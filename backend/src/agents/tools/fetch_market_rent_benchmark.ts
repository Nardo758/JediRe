/**
 * fetch_market_rent_benchmark Tool
 *
 * Retrieves building-average market rent benchmarks (P25/P50/P75) from
 * mv_market_rent_benchmarks for a given city × state × asset class.
 *
 * EC3 — Market Rent Source Architecture.
 *
 * ARCHITECTURAL CONSTRAINT:
 * The underlying view (mv_market_rent_benchmarks) aggregates building-level
 * avg_asking_rent values from apartment_locator_properties. This is a
 * building-average benchmark, NOT a per-bedroom-type benchmark.
 * Per-unit-type stratification is a Phase 3 enhancement.
 *
 * Refresh: view is refreshed on every ApartmentIQ sync push. If sample_size
 * is 0 the view needs a refresh or the market is not yet seeded.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ─── Input Schema ────────────────────────────────────────────────────────────

export const fetchMarketRentBenchmarkSchema = z.object({
  city: z.string().describe('City name to fetch rent benchmarks for (e.g. "Atlanta")'),
  state: z.string().describe('Two-letter state code (e.g. "GA")'),
  asset_class: z.enum(['A', 'B', 'C', 'all']).default('all').describe(
    'Asset class filter: A (2010+), B (1995–2009), C (<1995), or all for all classes'
  ),
  subject_rent: z.number().optional().describe(
    "Subject property's underwriting rent ($/unit/month). When provided, returns competitive position relative to benchmarks."
  ),
});

export type FetchMarketRentBenchmarkInput = z.infer<typeof fetchMarketRentBenchmarkSchema>;

// ─── Result Types ────────────────────────────────────────────────────────────

export interface MarketRentBenchmarkResult {
  city: string;
  state: string;
  benchmarks: Array<{
    assetClass: string;
    sampleSize: number;
    p25Rent: number | null;
    p50Rent: number | null;
    p75Rent: number | null;
    avgRent: number | null;
    minRent: number | null;
    maxRent: number | null;
    refreshedAt: string | null;
  }>;
  competitivePosition: {
    subjectRent: number;
    vsP50: number | null;
    vsP50Pct: number | null;
    position: 'premium' | 'market' | 'discount' | 'unknown';
  } | null;
  dataNote: string;
}

// ─── Execution ───────────────────────────────────────────────────────────────

async function fetchMarketRentBenchmark(input: unknown): Promise<MarketRentBenchmarkResult> {
  const parsed = fetchMarketRentBenchmarkSchema.parse(input);
  const { city, state, asset_class, subject_rent } = parsed;

  const cityNorm  = city.trim().toLowerCase();
  const stateNorm = state.trim().toUpperCase();

  logger.info(`[fetch_market_rent_benchmark] city=${cityNorm} state=${stateNorm} asset_class=${asset_class}`);

  let rows: any[];
  try {
    if (asset_class === 'all') {
      const result = await query(
        `SELECT asset_class, sample_size, p25_rent, p50_rent, p75_rent,
                avg_rent, min_rent, max_rent, refreshed_at
         FROM mv_market_rent_benchmarks
         WHERE LOWER(city) = $1 AND state = $2
         ORDER BY asset_class`,
        [cityNorm, stateNorm]
      );
      rows = result.rows;
    } else {
      const result = await query(
        `SELECT asset_class, sample_size, p25_rent, p50_rent, p75_rent,
                avg_rent, min_rent, max_rent, refreshed_at
         FROM mv_market_rent_benchmarks
         WHERE LOWER(city) = $1 AND state = $2 AND asset_class = $3`,
        [cityNorm, stateNorm, asset_class]
      );
      rows = result.rows;
    }
  } catch (err: any) {
    logger.warn(`[fetch_market_rent_benchmark] MV query failed: ${err.message}`);
    rows = [];
  }

  const benchmarks = rows.map(r => ({
    assetClass:  r.asset_class as string,
    sampleSize:  Number(r.sample_size ?? 0),
    p25Rent:     r.p25_rent  != null ? parseFloat(r.p25_rent)  : null,
    p50Rent:     r.p50_rent  != null ? parseFloat(r.p50_rent)  : null,
    p75Rent:     r.p75_rent  != null ? parseFloat(r.p75_rent)  : null,
    avgRent:     r.avg_rent  != null ? parseFloat(r.avg_rent)  : null,
    minRent:     r.min_rent  != null ? parseFloat(r.min_rent)  : null,
    maxRent:     r.max_rent  != null ? parseFloat(r.max_rent)  : null,
    refreshedAt: r.refreshed_at ? new Date(r.refreshed_at).toISOString() : null,
  }));

  // Competitive position vs best-matching asset class P50
  let competitivePosition: MarketRentBenchmarkResult['competitivePosition'] = null;
  if (subject_rent != null && benchmarks.length > 0) {
    const ref = benchmarks[0];
    const p50 = ref.p50Rent;
    if (p50 != null && p50 > 0) {
      const vsP50    = subject_rent - p50;
      const vsP50Pct = vsP50 / p50;
      const position: 'premium' | 'market' | 'discount' =
        vsP50Pct >  0.05 ? 'premium'  :
        vsP50Pct < -0.05 ? 'discount' :
        'market';
      competitivePosition = { subjectRent: subject_rent, vsP50, vsP50Pct, position };
    } else {
      competitivePosition = { subjectRent: subject_rent, vsP50: null, vsP50Pct: null, position: 'unknown' };
    }
  }

  const dataNote = benchmarks.length === 0
    ? `No benchmark data found for ${city}, ${stateNorm}. The market may not be seeded yet. Refresh mv_market_rent_benchmarks or check apartment_locator_properties for this city.`
    : `Building-average benchmarks only (not per-bedroom-type). Source: apartment_locator_properties (ApartmentIQ). n=${benchmarks.reduce((sum, b) => sum + b.sampleSize, 0)} properties.`;

  return { city, state: stateNorm, benchmarks, competitivePosition, dataNote };
}

// ─── Tool Definition ─────────────────────────────────────────────────────────

export const fetchMarketRentBenchmarkTool = {
  name: 'fetch_market_rent_benchmark',
  description: `Retrieve building-average market rent benchmarks (P25/P50/P75) for a city.

Returns rent distribution data from ApartmentIQ (apartment_locator_properties) aggregated
by city × state × asset class:
- P25/P50/P75 rent percentiles (building-average $/unit/month)
- Avg, min, max rents
- Sample size

Asset classes: A = 2010+, B = 1995–2009, C = <1995.

Optionally provide subject_rent to get competitive position (premium/market/discount vs P50).

ARCHITECTURAL CONSTRAINT: These are building-average rents, not per-bedroom benchmarks.
Use fetch_comp_set for property-level comps with pricing history and trends.
Use this tool for market-level distribution benchmarking.

Call when:
- Establishing whether underwriting rent is market-consistent across the distribution
- Checking if a value-add renovation premium is achievable vs asset class P75 ceiling
- Benchmarking deal-level GPR against the city's rent distribution before setting assumptions`,
  inputSchema: fetchMarketRentBenchmarkSchema,
  outputSchema: z.any(),
  execute: fetchMarketRentBenchmark,
};
