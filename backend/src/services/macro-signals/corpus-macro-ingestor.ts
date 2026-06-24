/**
 * CorpusMacroIngestor
 *
 * Bridges macro signal data already held in `metric_time_series`
 * (FRED: fed-funds rate, 10Y treasury) and `msa_economic_snapshot`
 * (BLS CES: total nonfarm employment, unemployment rate) into the
 * `historical_observations` corpus table.
 *
 * Strategy
 * ─────────
 * For each target MSA and each calendar month in the requested window:
 *  - FRED rates   → monthly average from metric_time_series
 *  - Employment   → latest msa_economic_snapshot row whose snapshot_date
 *                   falls within that month (or the most-recent prior row)
 *
 * One corpus row per (msa_id, month, 'monthly') is upserted using the
 * table's unique index:
 *   (geography_level, COALESCE(parcel_id, submarket_id, msa_id),
 *    observation_date, observation_window)
 *
 * Existing rows get only the macro columns updated — property/submarket
 * columns are left untouched (DO UPDATE SET on named columns only).
 *
 * Sources tagged in source_signals: ['FRED', 'BLS_CES']
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';

// ─── MSA descriptor ──────────────────────────────────────────────────────────

export interface MsaDescriptor {
  msaId: string;         // Text slug written to historical_observations.msa_id
  msaDbId: number;       // Integer PK in the msas table (joins msa_economic_snapshot)
  metricGeoId: string;   // geography_id used in metric_time_series (e.g. 'atlanta-ga-ga')
  name: string;
}

// ─── Well-known MSA descriptors ───────────────────────────────────────────────

export const KNOWN_MSAS: MsaDescriptor[] = [
  {
    msaId: 'atlanta-msa',
    msaDbId: 1,
    metricGeoId: 'atlanta-ga-ga',
    name: 'Atlanta-Sandy Springs-Roswell, GA',
  },
  {
    msaId: 'charlotte-msa',
    msaDbId: 2,
    metricGeoId: 'charlotte-nc-nc',
    name: 'Charlotte-Concord-Gastonia, NC-SC',
  },
];

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MacroIngestResult {
  msaId: string;
  monthsProcessed: number;
  rowsUpserted: number;
  rowsWithRates: number;
  rowsWithEmployment: number;
}

// ─── Helper: date iteration ───────────────────────────────────────────────────

function eachMonth(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= last) {
    months.push(new Date(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Ingestor class ───────────────────────────────────────────────────────────

export class CorpusMacroIngestor {
  constructor(private readonly pool: Pool) {}

  /**
   * Ingest macro signals for a single MSA over a month range.
   */
  async ingestMsa(
    msa: MsaDescriptor,
    startDate: Date,
    endDate: Date,
  ): Promise<MacroIngestResult> {
    const months = eachMonth(startDate, endDate);

    // ── 1. Fetch FRED rates from metric_time_series ───────────────────────────
    // Monthly average of daily 10Y and daily fed-funds for each month.
    const ratesResult = await this.pool.query<{
      month: string;
      fed_funds: string | null;
      treasury_10y: string | null;
    }>(
      `SELECT
         DATE_TRUNC('month', period_date)::date AS month,
         AVG(value) FILTER (WHERE metric_id = 'RATE_FED_FUNDS')   AS fed_funds,
         AVG(value) FILTER (WHERE metric_id = 'RATE_TREASURY_10Y') AS treasury_10y
       FROM metric_time_series
       WHERE metric_id IN ('RATE_FED_FUNDS', 'RATE_TREASURY_10Y')
         AND period_date >= $1
         AND period_date <  $2
       GROUP BY 1`,
      [toISO(startDate), toISO(new Date(endDate.getTime() + 31 * 86400_000))],
    );

    // pg returns ::date columns as JavaScript Date objects — normalize to 'YYYY-MM-DD' string for Map keys
    function pgDateToKey(d: unknown): string {
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    }

    const rateByMonth = new Map<string, { fedFunds: number | null; treasury10y: number | null }>();
    for (const row of ratesResult.rows) {
      rateByMonth.set(pgDateToKey(row.month), {
        fedFunds: row.fed_funds != null ? parseFloat(row.fed_funds as string) : null,
        treasury10y: row.treasury_10y != null ? parseFloat(row.treasury_10y as string) : null,
      });
    }

    // ── 2. Fetch BLS employment from msa_economic_snapshot ───────────────────
    // For each month, grab the most-recent snapshot whose date is <= month-end.
    // Using LAG + DENSE_RANK so we get one row per month (Total Nonfarm naics=00).
    const empResult = await this.pool.query<{
      month: string;
      total_employment: string | null;
      yoy_change_pct: string | null;
      local_unemployment_rate: string | null;
    }>(
      `SELECT DISTINCT ON (DATE_TRUNC('month', snapshot_date)::date)
         DATE_TRUNC('month', snapshot_date)::date AS month,
         total_employment::text,
         yoy_change_pct::text,
         local_unemployment_rate::text
       FROM msa_economic_snapshot
       WHERE msa_id = $1
         AND naics_code = '00'
         AND snapshot_date >= $2
         AND snapshot_date <  $3
       ORDER BY DATE_TRUNC('month', snapshot_date)::date, snapshot_date DESC`,
      [
        msa.msaDbId,
        toISO(startDate),
        toISO(new Date(endDate.getTime() + 31 * 86400_000)),
      ],
    );

    const empByMonth = new Map<string, {
      totalEmployment: number | null;
      yoyChangePct: number | null;
      unemploymentRate: number | null;
    }>();
    for (const row of empResult.rows) {
      empByMonth.set(pgDateToKey(row.month), {
        totalEmployment: row.total_employment != null ? parseFloat(row.total_employment as string) : null,
        yoyChangePct: row.yoy_change_pct != null ? parseFloat(row.yoy_change_pct as string) : null,
        unemploymentRate: row.local_unemployment_rate != null ? parseFloat(row.local_unemployment_rate as string) : null,
      });
    }

    // ── 3. Upsert one historical_observations row per month ───────────────────
    let rowsUpserted = 0;
    let rowsWithRates = 0;
    let rowsWithEmployment = 0;

    for (const month of months) {
      const monthKey = toISO(month);
      const rates = rateByMonth.get(monthKey);
      const emp = empByMonth.get(monthKey);

      const fedFunds = rates?.fedFunds ?? null;
      const treasury10y = rates?.treasury10y ?? null;
      const totalEmployment = emp?.totalEmployment ?? null;
      const employmentGrowthYoy = emp?.yoyChangePct != null
        ? emp.yoyChangePct / 100   // convert % to decimal fraction (e.g. 0.21% → 0.0021)
        : null;
      const unemploymentRate = emp?.unemploymentRate ?? null;

      if (fedFunds === null && treasury10y === null && totalEmployment === null) {
        logger.debug(`[MacroIngest] ${msa.msaId} ${monthKey}: no signals — skipping`);
        continue;
      }

      // Build source_signals array
      const sourceSignals: string[] = [];
      if (fedFunds !== null || treasury10y !== null) sourceSignals.push('FRED');
      if (totalEmployment !== null) sourceSignals.push('BLS_CES');

      // Upsert strategy: UPDATE existing row first, INSERT only if no row existed.
      // The table's unique index uses COALESCE(parcel_id, submarket_id, msa_id)
      // which PostgreSQL cannot use as an ON CONFLICT inference target, so we use
      // a UPDATE-then-INSERT CTE pattern instead.
      await this.pool.query(
        `WITH updated AS (
           UPDATE historical_observations
           SET
             msa_fed_funds_rate        = COALESCE($3::numeric, msa_fed_funds_rate),
             msa_treasury_10y          = COALESCE($4::numeric, msa_treasury_10y),
             msa_employment_total      = COALESCE($5::numeric, msa_employment_total),
             msa_employment_growth_yoy = COALESCE($6::numeric, msa_employment_growth_yoy),
             msa_unemployment_rate     = COALESCE($7::numeric, msa_unemployment_rate),
             source_signals            = ARRAY(SELECT DISTINCT UNNEST(source_signals || $8::text[])),
             updated_at                = NOW()
           WHERE msa_id             = $1
             AND geography_level    = 'msa'
             AND observation_date   = $2::date
             AND observation_window = 'monthly'
           RETURNING id
         )
         INSERT INTO historical_observations (
           msa_id, geography_level, observation_date, observation_window,
           msa_fed_funds_rate, msa_treasury_10y,
           msa_employment_total, msa_employment_growth_yoy, msa_unemployment_rate,
           source_signals, signal_freshness_days,
           is_subject_property, realization_complete, data_quality_tier,
           scope_id, redistribution_restricted
         )
         SELECT
           $1, 'msa', $2::date, 'monthly',
           $3::numeric, $4::numeric,
           $5::numeric, $6::numeric, $7::numeric,
           $8::text[], '{}'::jsonb,
           FALSE, FALSE, 'verified',
           'GLOBAL', FALSE
         WHERE NOT EXISTS (SELECT 1 FROM updated)`,
        [
          msa.msaId,
          monthKey,
          fedFunds,
          treasury10y,
          totalEmployment,
          employmentGrowthYoy,
          unemploymentRate,
          sourceSignals,
        ],
      );

      rowsUpserted++;
      if (fedFunds !== null || treasury10y !== null) rowsWithRates++;
      if (totalEmployment !== null) rowsWithEmployment++;

      logger.debug(`[MacroIngest] ${msa.msaId} ${monthKey}: upserted (ffr=${fedFunds?.toFixed(2)}, 10y=${treasury10y?.toFixed(2)}, emp=${totalEmployment?.toFixed(0)})`);
    }

    logger.info('[MacroIngest] MSA complete', {
      msaId: msa.msaId,
      monthsProcessed: months.length,
      rowsUpserted,
      rowsWithRates,
      rowsWithEmployment,
    });

    return {
      msaId: msa.msaId,
      monthsProcessed: months.length,
      rowsUpserted,
      rowsWithRates,
      rowsWithEmployment,
    };
  }

  /**
   * Ingest all known MSAs for a given month window.
   * Returns per-MSA results.
   */
  async ingestAll(
    msas: MsaDescriptor[],
    startDate: Date,
    endDate: Date,
  ): Promise<MacroIngestResult[]> {
    const results: MacroIngestResult[] = [];
    for (const msa of msas) {
      try {
        const r = await this.ingestMsa(msa, startDate, endDate);
        results.push(r);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[MacroIngest] Failed for MSA', { msaId: msa.msaId, error: msg });
        results.push({
          msaId: msa.msaId,
          monthsProcessed: 0,
          rowsUpserted: 0,
          rowsWithRates: 0,
          rowsWithEmployment: 0,
        });
      }
    }
    return results;
  }
}
