/**
 * Archive Benchmark Aggregator
 * 
 * Computes P10/P25/P50/P75/P90 distributions from archive deals and live portfolio
 * data, writing to `archive_assumption_benchmarks` for the CashFlow Agent to query.
 * 
 * Runs nightly (or on demand) to refresh benchmark distributions.
 * 
 * Sources:
 *   1. data_library_assets — archive deals with broker_pro_forma and extracted assumptions
 *   2. deals — live deals with underwriting snapshots and (for closed deals) actual outcomes
 */

import { query, pool } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

interface BenchmarkBucket {
  asset_class: string;
  deal_type: string;
  submarket_id: string | null;
  vintage_band: string | null;
  strategy: string | null;
}

interface BenchmarkRow {
  bucket: BenchmarkBucket;
  assumption_name: string;
  values: number[];
  achieved_values?: number[];
}

// ─── Helper Functions ─────────────────────────────────────────────────

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function median(arr: number[]): number | null {
  return percentile(arr, 50);
}

function getVintageBand(yearBuilt: number | null): string | null {
  if (!yearBuilt) return null;
  if (yearBuilt < 1990) return 'pre-1990';
  if (yearBuilt < 2006) return '1990-2005';
  return '2006+';
}

function getDealType(raw: string | null): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('redevelopment') || s.includes('conversion')) return 'redevelopment';
  if (s.includes('development') && !s.includes('re')) return 'development';
  if (s.includes('value') || s.includes('rehab')) return 'value-add';
  if (s.includes('lease') || s.includes('stabiliz')) return 'lease-up';
  return 'existing';
}

// ─── Data Extraction ──────────────────────────────────────────────────

/**
 * Extract assumption values from archive deals (data_library_assets)
 */
async function extractArchiveAssumptions(): Promise<BenchmarkRow[]> {
  const result = await query(`
    SELECT 
      asset_class,
      property_type,
      submarket_name,
      year_built,
      deal_type,
      cap_rate,
      occupancy_rate,
      avg_rent,
      price_per_unit,
      broker_pro_forma
    FROM data_library_assets
    WHERE source_type IN ('broker_om', 'manual', 'archive_ingest')
      AND data_quality_score >= 50
  `);

  const rows: BenchmarkRow[] = [];
  const bucketMap = new Map<string, Map<string, number[]>>();

  for (const row of result.rows as Record<string, unknown>[]) {
    const assetClass = String(row.asset_class ?? 'B');
    const dealType = getDealType(row.deal_type as string | null);
    const vintageBand = getVintageBand(row.year_built as number | null);
    
    const bucket: BenchmarkBucket = {
      asset_class: assetClass,
      deal_type: dealType,
      submarket_id: null, // Aggregate at broader level for now
      vintage_band: vintageBand,
      strategy: null,
    };
    const bucketKey = JSON.stringify(bucket);

    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, new Map());
    }
    const assumptions = bucketMap.get(bucketKey)!;

    // Extract assumptions from row fields
    if (row.cap_rate != null) {
      const v = Number(row.cap_rate);
      if (!isNaN(v) && v > 0 && v < 20) {
        if (!assumptions.has('going_in_cap_rate')) assumptions.set('going_in_cap_rate', []);
        assumptions.get('going_in_cap_rate')!.push(v);
      }
    }

    if (row.occupancy_rate != null) {
      const v = Number(row.occupancy_rate);
      if (!isNaN(v) && v > 0 && v <= 100) {
        const vacancy = 100 - v;
        if (!assumptions.has('vacancy_pct')) assumptions.set('vacancy_pct', []);
        assumptions.get('vacancy_pct')!.push(vacancy);
      }
    }

    if (row.price_per_unit != null) {
      const v = Number(row.price_per_unit);
      if (!isNaN(v) && v > 10000 && v < 1000000) {
        if (!assumptions.has('price_per_unit')) assumptions.set('price_per_unit', []);
        assumptions.get('price_per_unit')!.push(v);
      }
    }

    // Extract from broker_pro_forma JSON if available
    const proforma = row.broker_pro_forma as Record<string, unknown> | null;
    if (proforma) {
      if (proforma.exit_cap_rate != null) {
        const v = Number(proforma.exit_cap_rate);
        if (!isNaN(v) && v > 0 && v < 20) {
          if (!assumptions.has('exit_cap_rate')) assumptions.set('exit_cap_rate', []);
          assumptions.get('exit_cap_rate')!.push(v);
        }
      }
      if (proforma.rent_growth_pct != null || proforma.rent_growth != null) {
        const v = Number(proforma.rent_growth_pct ?? proforma.rent_growth);
        if (!isNaN(v) && v >= -10 && v <= 20) {
          if (!assumptions.has('rent_growth_pct')) assumptions.set('rent_growth_pct', []);
          assumptions.get('rent_growth_pct')!.push(v);
        }
      }
      if (proforma.expense_growth_pct != null || proforma.expense_growth != null) {
        const v = Number(proforma.expense_growth_pct ?? proforma.expense_growth);
        if (!isNaN(v) && v >= 0 && v <= 15) {
          if (!assumptions.has('expense_growth_pct')) assumptions.set('expense_growth_pct', []);
          assumptions.get('expense_growth_pct')!.push(v);
        }
      }
      if (proforma.noi_per_unit != null) {
        const v = Number(proforma.noi_per_unit);
        if (!isNaN(v) && v > 0 && v < 50000) {
          if (!assumptions.has('noi_per_unit')) assumptions.set('noi_per_unit', []);
          assumptions.get('noi_per_unit')!.push(v);
        }
      }
    }
  }

  // Convert map to rows
  for (const [bucketKey, assumptions] of bucketMap) {
    const bucket = JSON.parse(bucketKey) as BenchmarkBucket;
    for (const [assumptionName, values] of assumptions) {
      rows.push({ bucket, assumption_name: assumptionName, values });
    }
  }

  return rows;
}

/**
 * Extract assumption values from live deals with underwriting snapshots
 */
async function extractLiveDealAssumptions(): Promise<BenchmarkRow[]> {
  const result = await query(`
    SELECT 
      d.id,
      d.deal_data->>'asset_class' as asset_class,
      d.deal_data->>'deal_type' as deal_type,
      d.deal_data->>'year_built' as year_built,
      d.status,
      us.assumptions,
      us.proforma_fields
    FROM deals d
    LEFT JOIN underwriting_snapshots us ON us.deal_id = d.id
    WHERE us.id IS NOT NULL
      AND us.proforma_fields IS NOT NULL
  `);

  const rows: BenchmarkRow[] = [];
  const bucketMap = new Map<string, Map<string, { assumed: number[]; achieved: number[] }>>();

  for (const row of result.rows as Record<string, unknown>[]) {
    const assetClass = String(row.asset_class ?? 'B');
    const dealType = getDealType(row.deal_type as string | null);
    const yearBuilt = row.year_built ? Number(row.year_built) : null;
    const vintageBand = getVintageBand(yearBuilt);
    const isClosed = String(row.status ?? '').toLowerCase().includes('closed');

    const bucket: BenchmarkBucket = {
      asset_class: assetClass,
      deal_type: dealType,
      submarket_id: null,
      vintage_band: vintageBand,
      strategy: null,
    };
    const bucketKey = JSON.stringify(bucket);

    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, new Map());
    }
    const assumptions = bucketMap.get(bucketKey)!;

    const proformaFields = row.proforma_fields as Record<string, { value: number }> | null;
    if (!proformaFields) continue;

    // Extract proforma field values
    for (const [fieldPath, field] of Object.entries(proformaFields)) {
      if (field?.value == null) continue;
      const v = Number(field.value);
      if (isNaN(v)) continue;

      // Normalize field path to assumption name
      const assumptionName = fieldPath.replace(/\./g, '_');
      
      if (!assumptions.has(assumptionName)) {
        assumptions.set(assumptionName, { assumed: [], achieved: [] });
      }
      assumptions.get(assumptionName)!.assumed.push(v);

      // If closed deal, we might have achieved values in deal_monthly_actuals
      // (This would require additional query; for now we track assumed only from snapshots)
    }
  }

  // Convert map to rows
  for (const [bucketKey, assumptions] of bucketMap) {
    const bucket = JSON.parse(bucketKey) as BenchmarkBucket;
    for (const [assumptionName, data] of assumptions) {
      if (data.assumed.length > 0) {
        rows.push({
          bucket,
          assumption_name: assumptionName,
          values: data.assumed,
          achieved_values: data.achieved.length > 0 ? data.achieved : undefined,
        });
      }
    }
  }

  return rows;
}

// ─── Aggregation & Write ──────────────────────────────────────────────

/**
 * Aggregate benchmark rows and write to archive_assumption_benchmarks
 */
export async function refreshArchiveBenchmarks(): Promise<{
  bucketsWritten: number;
  rowsWritten: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let bucketsWritten = 0;
  let rowsWritten = 0;
  const asOf = new Date().toISOString().slice(0, 10);

  try {
    logger.info('[archive-benchmark-aggregator] Starting benchmark refresh...');

    // Collect all benchmark data
    const archiveRows = await extractArchiveAssumptions();
    const liveRows = await extractLiveDealAssumptions();

    logger.info('[archive-benchmark-aggregator] Extracted data', {
      archiveRows: archiveRows.length,
      liveRows: liveRows.length,
    });

    // Merge into combined bucket map
    const combined = new Map<string, Map<string, { values: number[]; achieved?: number[] }>>();

    for (const row of [...archiveRows, ...liveRows]) {
      const bucketKey = JSON.stringify(row.bucket);
      if (!combined.has(bucketKey)) {
        combined.set(bucketKey, new Map());
      }
      const assumptions = combined.get(bucketKey)!;

      if (!assumptions.has(row.assumption_name)) {
        assumptions.set(row.assumption_name, { values: [], achieved: undefined });
      }
      const existing = assumptions.get(row.assumption_name)!;
      existing.values.push(...row.values);
      if (row.achieved_values?.length) {
        existing.achieved = [...(existing.achieved ?? []), ...row.achieved_values];
      }
    }

    // Write aggregated benchmarks
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [bucketKey, assumptions] of combined) {
        const bucket = JSON.parse(bucketKey) as BenchmarkBucket;
        bucketsWritten++;

        for (const [assumptionName, data] of assumptions) {
          const n = data.values.length;
          if (n < 3) continue; // Skip sparse buckets

          const p10Val = percentile(data.values, 10);
          const p25Val = percentile(data.values, 25);
          const p50Val = percentile(data.values, 50);
          const p75Val = percentile(data.values, 75);
          const p90Val = percentile(data.values, 90);
          const assumedMedian = median(data.values);
          const achievedMedian = data.achieved?.length ? median(data.achieved) : null;
          const nClosedDeals = data.achieved?.length ?? 0;

          // Calculate gap in basis points (assumed - achieved) / assumed * 10000
          let gapBps: number | null = null;
          if (assumedMedian != null && achievedMedian != null && assumedMedian !== 0) {
            gapBps = ((assumedMedian - achievedMedian) / Math.abs(assumedMedian)) * 10000;
          }

          await client.query(
            `INSERT INTO archive_assumption_benchmarks (
              asset_class, deal_type, submarket_id, vintage_band, strategy,
              assumption_name, p10, p25, p50, p75, p90,
              assumed_median, achieved_median, gap_bps,
              n_samples, n_closed_deals, as_of
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT DO NOTHING`,
            [
              bucket.asset_class,
              bucket.deal_type,
              bucket.submarket_id,
              bucket.vintage_band,
              bucket.strategy,
              assumptionName,
              p10Val,
              p25Val,
              p50Val,
              p75Val,
              p90Val,
              assumedMedian,
              achievedMedian,
              gapBps,
              n,
              nClosedDeals,
              asOf,
            ]
          );
          rowsWritten++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('[archive-benchmark-aggregator] Benchmark refresh complete', {
      bucketsWritten,
      rowsWritten,
    });

    return { bucketsWritten, rowsWritten, errors };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive-benchmark-aggregator] Refresh failed', { error: msg });
    errors.push(msg);
    return { bucketsWritten, rowsWritten, errors };
  }
}

/**
 * Get benchmark stats for display
 */
export async function getArchiveBenchmarkStats(): Promise<{
  totalBuckets: number;
  totalRows: number;
  assumptionTypes: string[];
  lastRefresh: string | null;
}> {
  const result = await query(`
    SELECT 
      COUNT(DISTINCT (asset_class, deal_type, vintage_band)) as total_buckets,
      COUNT(*) as total_rows,
      MAX(as_of) as last_refresh
    FROM archive_assumption_benchmarks
  `);

  const typesResult = await query(`
    SELECT DISTINCT assumption_name FROM archive_assumption_benchmarks ORDER BY assumption_name
  `);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    totalBuckets: Number(row?.total_buckets ?? 0),
    totalRows: Number(row?.total_rows ?? 0),
    assumptionTypes: (typesResult.rows as { assumption_name: string }[]).map(r => r.assumption_name),
    lastRefresh: row?.last_refresh ? String(row.last_refresh) : null,
  };
}
