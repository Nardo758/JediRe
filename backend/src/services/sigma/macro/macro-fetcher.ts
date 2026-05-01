/**
 * FRED/BLS Macro Series Fetcher
 *
 * Pulls macro-anchored mean series from FRED and BLS APIs.
 * Returns cached values from DB when available, fetches fresh when stale.
 *
 * Supported series:
 *   CPI-OER (CUSR0000SEHC)      — Owners' Equivalent Rent
 *   ECI Wages (ECIWAG)          — Employment Cost Index, wages
 *   10Y Treasury (DGS10)        — constant maturity
 *   10Y Breakeven (T10YIE)      — 10-year expected inflation
 *   PPI Res Construction (WPSFD49207) — PPI for residential construction
 *
 * NOTE: In Phase A, we cache from known sources in DB and fall back to
 * configurable defaults. Live API calls require an API key.
 */

import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MacroSeriesId = 
  | 'CUSR0000SEHC'   // CPI-OER
  | 'ECIWAG'          // ECI wages
  | 'DGS10'           // 10-year Treasury
  | 'T10YIE'          // 10-year breakeven inflation
  | 'WPSFD49207';     // PPI residential construction

export interface MacroObservation {
  seriesId: MacroSeriesId;
  value: number;
  observationDate: string;   // YYYY-MM-DD
  observationDateUTC: Date;
  refreshedAt: string;
}

export interface MacroSeriesConfig {
  seriesId: MacroSeriesId;
  fredCode: string;
  name: string;
  unit: string;
  refreshCadence: 'daily' | 'monthly' | 'quarterly';
  defaultFallback: number;   // used when no data available
  fallbackNote: string;
}

// ─── Series Registry ─────────────────────────────────────────────────────────

export const MACRO_SERIES: MacroSeriesConfig[] = [
  {
    seriesId: 'CUSR0000SEHC',
    fredCode: 'CUSR0000SEHC',
    name: 'CPI - Owners\' Equivalent Rent',
    unit: '% y/y',
    refreshCadence: 'monthly',
    defaultFallback: 0.038,   // current rough estimate
    fallbackNote: '2025 H1 estimate ~3.8%; BLS release mid-month',
  },
  {
    seriesId: 'ECIWAG',
    fredCode: 'ECIWAG',
    name: 'Employment Cost Index - Wages & Salaries',
    unit: '% y/y',
    refreshCadence: 'quarterly',
    defaultFallback: 0.042,
    fallbackNote: '2025 Q1 ~4.15%; BLS quarterly release',
  },
  {
    seriesId: 'DGS10',
    fredCode: 'DGS10',
    name: '10-Year Treasury Constant Maturity Rate',
    unit: '%',
    refreshCadence: 'daily',
    defaultFallback: 0.0425,
    fallbackNote: 'Current ~4.25%; FRED daily',
  },
  {
    seriesId: 'T10YIE',
    fredCode: 'T10YIE',
    name: '10-Year Breakeven Inflation Rate',
    unit: '%',
    refreshCadence: 'daily',
    defaultFallback: 0.023,
    fallbackNote: 'Current ~2.30%; FRED daily',
  },
  {
    seriesId: 'WPSFD49207',
    fredCode: 'WPSFD49207',
    name: 'PPI - Residential Construction',
    unit: '% y/y',
    refreshCadence: 'monthly',
    defaultFallback: 0.035,
    fallbackNote: '2025 ~3.5% y/y; BLS monthly',
  },
];

export const MACRO_SERIES_MAP = new Map(MACRO_SERIES.map(s => [s.seriesId, s]));

// ─── DB Schema ───────────────────────────────────────────────────────────────

/**
 * macro_anchor_observations table:
 *   series_id   VARCHAR(50)   — FRED/BLS series code
 *   value       FLOAT         — observed value
 *   obs_date    DATE          — observation date
 *   source      VARCHAR(50)   — 'fred' | 'bls' | 'manual'
 *   created_at  TIMESTAMPTZ
 *   UNIQUE(series_id, obs_date)
 */

const UPSERT_OBSERVATION_SQL = `
  INSERT INTO macro_anchor_observations (series_id, value, obs_date, source)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (series_id, obs_date) DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source
`;

const LATEST_OBSERVATION_SQL = `
  SELECT value, obs_date, source, created_at
  FROM macro_anchor_observations
  WHERE series_id = $1
  ORDER BY obs_date DESC
  LIMIT 1
`;

const OBSERVATIONS_RANGE_SQL = `
  SELECT value, obs_date
  FROM macro_anchor_observations
  WHERE series_id = $1
  ORDER BY obs_date DESC
  LIMIT $2
`;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Fetch the latest observation for a macro series from DB.
 * Returns null if no data found.
 */
export async function fetchLatestObservation(
  seriesId: MacroSeriesId
): Promise<MacroObservation | null> {
  try {
    const result = await query(LATEST_OBSERVATION_SQL, [seriesId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const obsDate = row.obs_date instanceof Date ? row.obs_date : new Date(String(row.obs_date));
    
    return {
      seriesId,
      value: Number(row.value),
      observationDate: obsDate.toISOString().split('T')[0],
      observationDateUTC: obsDate,
      refreshedAt: new Date(row.created_at as string).toISOString(),
    };
  } catch (err) {
    logger.error('[macro-fetcher] DB fetch failed', { seriesId, err });
    return null;
  }
}

/**
 * Get the latest value for a macro series, with fallback.
 */
export async function getMacroValue(seriesId: MacroSeriesId): Promise<{
  value: number;
  source: 'database' | 'fallback';
  observationDate: string | null;
}> {
  const config = MACRO_SERIES_MAP.get(seriesId);
  if (!config) {
    throw new Error(`Unknown macro series: ${seriesId}`);
  }

  try {
    const obs = await fetchLatestObservation(seriesId);
    if (obs !== null) {
      return {
        value: obs.value,
        source: 'database',
        observationDate: obs.observationDate,
      };
    }
  } catch (err) {
    logger.warn('[macro-fetcher] Fallback used', { seriesId, err });
  }

  return {
    value: config.defaultFallback,
    source: 'fallback',
    observationDate: null,
  };
}

/**
 * Store an observation in the DB.
 */
export async function storeObservation(
  seriesId: MacroSeriesId,
  value: number,
  obsDate: string,
  source: 'fred' | 'bls' | 'manual' = 'manual'
): Promise<void> {
  try {
    await query(UPSERT_OBSERVATION_SQL, [seriesId, value, obsDate, source]);
    logger.info('[macro-fetcher] Stored', { seriesId, value, obsDate });
  } catch (err) {
    logger.error('[macro-fetcher] Store failed', { seriesId, value, obsDate, err });
    throw err;
  }
}

/**
 * Get a rolling window of observations (for computing μ_empirical).
 * Returns most recent N observations.
 */
export async function getRecentObservations(
  seriesId: MacroSeriesId,
  limit = 60
): Promise<{ value: number; date: string }[]> {
  try {
    const result = await query(OBSERVATIONS_RANGE_SQL, [seriesId, limit]);
    const raw = result.rows as Array<{ value: number | string; obs_date: string | Date }>;
    return raw.map(r => ({
      value: Number(r.value),
      date: r.obs_date instanceof Date ? r.obs_date.toISOString().split('T')[0] : String(r.obs_date),
    }));
  } catch (err) {
    logger.error('[macro-fetcher] Range fetch failed', { seriesId, err });
    return [];
  }
}

/**
 * Compute rolling mean from recent observations.
 * Used for μ_empirical when historical deal data isn't available.
 */
export async function computeRollingMean(
  seriesId: MacroSeriesId,
  months = 36
): Promise<{ mean: number; n: number; observations: number }> {
  const recent = await getRecentObservations(seriesId, months);
  if (recent.length === 0) {
    return { mean: 0, n: 0, observations: 0 };
  }
  
  const sum = recent.reduce((acc, r) => acc + r.value, 0);
  return {
    mean: sum / recent.length,
    n: recent.length,
    observations: recent.length,
  };
}

/**
 * Ingest initial fallback data into the DB.
 * Called on first deploy to seed the cache.
 */
export async function seedDefaultObservations(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  for (const series of MACRO_SERIES) {
    const exists = await fetchLatestObservation(series.seriesId);
    if (exists === null) {
      await storeObservation(series.seriesId, series.defaultFallback, today, 'manual');
      logger.info('[macro-fetcher] Seeded default', { seriesId: series.seriesId, value: series.defaultFallback });
    }
  }
}

// ─── Macro Anchors ───────────────────────────────────────────────────────────

export interface MacroAnchorConfig {
  metric: string;
  seriesId: MacroSeriesId;
  structuralPremium: number;      // added on top of macro series
  fallbackMu: number;             // used if no data
  description: string;
}

export const MACRO_ANCHORS: MacroAnchorConfig[] = [
  {
    metric: 'rentGrowthStabilized',
    seriesId: 'CUSR0000SEHC',
    structuralPremium: 0.008,      // ~80bps above CPI-OER for Sun Belt multifamily
    fallbackMu: 0.035,
    description: 'rent_growth = CPI-OER + 80bps Sun Belt multifamily premium (calibrated)',
  },
  {
    metric: 'rentGrowthY1',
    seriesId: 'CUSR0000SEHC',
    structuralPremium: 0.01,       // Y1 often higher with lease-up
    fallbackMu: 0.04,
    description: 'rent_growth_y1 = CPI-OER + 100bps (lease-up premium)',
  },
  {
    metric: 'expenseGrowthRate',
    seriesId: 'WPSFD49207',
    structuralPremium: 0.005,      // ~50bps above PPI for utilities + maintenance
    fallbackMu: 0.035,
    description: 'expense_growth = PPI residential + 50bps (utility inflation premium)',
  },
  {
    metric: 'entryCapRate',
    seriesId: 'DGS10',
    structuralPremium: 0.035,      // real 10Y + 3.5% asset class risk premium + 0.5% liquidity
    fallbackMu: 0.065,
    description: 'cap_rate = 10Y real + 350bps (multifamily Class A risk premium)',
  },
  {
    metric: 'exitCapRate',
    seriesId: 'DGS10',
    structuralPremium: 0.04,       // same + 50bps terminal premium
    fallbackMu: 0.065,
    description: 'exit_cap = 10Y real + 400bps (includes 50bps terminal premium)',
  },
  {
    metric: 'constructionCostGrowth',
    seriesId: 'WPSFD49207',
    structuralPremium: 0.005,
    fallbackMu: 0.035,
    description: 'construction_cost = PPI residential + 50bps',
  },
];

export const MACRO_ANCHOR_MAP = new Map(MACRO_ANCHORS.map(a => [a.metric, a]));
