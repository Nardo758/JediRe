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

import { query, getClient } from '../database/connection';
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
      data_type AS deal_type,
      cap_rate,
      occupancy_rate,
      avg_rent,
      price_per_unit
    FROM data_library_assets
    WHERE source_type IN ('broker_om', 'manual', 'archive_ingest', 'archive')
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

    // Note: broker proforma assumptions (exit_cap_rate, rent_growth_pct, etc.) are not
    // available from archive assets — extraction_data->'broker' stores only the broker
    // firm name string. These fields will be populated once live-deal document extraction
    // is linked back to archive assets via source_deal_id.
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
      us.proforma_json
    FROM deals d
    LEFT JOIN deal_underwriting_snapshots us ON us.deal_id = d.id
    WHERE us.id IS NOT NULL
      AND us.proforma_json IS NOT NULL
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

    const proformaFields = row.proforma_json as Record<string, { value: number } | number> | null;
    if (!proformaFields) continue;

    // Extract proforma field values — entries may be LayeredValue objects {value, source, ...}
    // or raw scalars depending on agent version
    for (const [fieldPath, field] of Object.entries(proformaFields)) {
      const rawVal = typeof field === 'object' && field !== null ? (field as { value?: number }).value : field;
      if (rawVal == null) continue;
      const v = Number(rawVal);
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
    const client = await getClient();
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

// ──────────────────────────────────────────────────────────────────────────────
// Line Item Benchmark Aggregation
// ──────────────────────────────────────────────────────────────────────────────

interface LineItemBucket {
  state: string | null;
  msa: string | null;
  submarket: string | null;
  asset_class: string | null;
  deal_type: string | null;
  vintage_band: string | null;
  unit_count_band: string | null;
  stories_band: string | null;
}

interface LineItemData {
  per_unit_values: number[];
  pct_egi_values: number[];
  egi_values: number[];  // To compute % EGI
}

function getUnitCountBand(units: number | null): string | null {
  if (!units) return null;
  if (units < 100) return '<100';
  if (units < 200) return '100-200';
  if (units < 350) return '200-350';
  return '350+';
}

function getStoriesBand(stories: number | null): string | null {
  if (!stories) return null;
  if (stories <= 3) return 'garden';
  if (stories <= 8) return 'mid-rise';
  return 'high-rise';
}

function normalizeLineItem(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

// Map common T-12 line names to standard names
const LINE_ITEM_ALIASES: Record<string, string> = {
  // Revenue
  'gpr': 'gross_potential_rent',
  'potential_rent': 'gross_potential_rent',
  'scheduled_rent': 'gross_potential_rent',
  'ltl': 'loss_to_lease',
  'lease_loss': 'loss_to_lease',
  'vacancy': 'vacancy_loss',
  'physical_vacancy': 'vacancy_loss',
  'economic_vacancy': 'vacancy_loss',
  'concession': 'concessions',
  'collections_loss': 'bad_debt',
  'write_offs': 'bad_debt',
  'delinquency': 'bad_debt',
  'ancillary': 'other_income',
  'misc_income': 'other_income',
  'fee_income': 'other_income',
  'egi': 'effective_gross_income',
  'total_revenue': 'effective_gross_income',
  'gross_income': 'effective_gross_income',
  
  // Payroll
  'salaries': 'payroll',
  'wages': 'payroll',
  'personnel': 'payroll',
  'employee_costs': 'payroll',
  'property_management': 'management_fee',
  'mgmt_fee': 'management_fee',
  'pm_fee': 'management_fee',
  
  // Utilities
  'electricity': 'utilities_electric',
  'power': 'utilities_electric',
  'electric': 'utilities_electric',
  'natural_gas': 'utilities_gas',
  'gas': 'utilities_gas',
  'water': 'utilities_water_sewer',
  'sewer': 'utilities_water_sewer',
  'w_s': 'utilities_water_sewer',
  'trash': 'utilities_trash',
  'garbage': 'utilities_trash',
  'refuse': 'utilities_trash',
  'utilities': 'utilities_total',
  'utility_expense': 'utilities_total',
  
  // R&M
  'r_m': 'repairs_maintenance',
  'r&m': 'repairs_maintenance',
  'maintenance': 'repairs_maintenance',
  'repairs': 'repairs_maintenance',
  'turnover': 'make_ready',
  'turn_costs': 'make_ready',
  'unit_turn': 'make_ready',
  'grounds': 'landscaping',
  'lawn_care': 'landscaping',
  'contracted_services': 'contract_services',
  
  // Admin
  'g_a': 'admin_general',
  'g&a': 'admin_general',
  'admin': 'admin_general',
  'office_expense': 'admin_general',
  'advertising': 'marketing',
  'leasing_marketing': 'marketing',
  'promotion': 'marketing',
  'legal': 'professional_fees',
  'accounting': 'professional_fees',
  
  // Fixed
  'property_insurance': 'insurance',
  'liability_insurance': 'insurance',
  'hazard_insurance': 'insurance',
  'property_taxes': 'real_estate_taxes',
  'taxes': 'real_estate_taxes',
  'tax_expense': 'real_estate_taxes',
  're_taxes': 'real_estate_taxes',
  
  // Totals
  'total_opex': 'total_operating_expenses',
  'opex': 'total_operating_expenses',
  'operating_expenses': 'total_operating_expenses',
  'noi': 'net_operating_income',
  'reserves': 'replacement_reserves',
  'capex_reserves': 'replacement_reserves',
  'capex': 'capital_improvements',
  'capital_expenditures': 'capital_improvements',
};

function standardizeLineItem(name: string): string {
  const normalized = normalizeLineItem(name);
  return LINE_ITEM_ALIASES[normalized] ?? normalized;
}

/**
 * Extract line item data from archive deals
 */
async function extractArchiveLineItems(): Promise<Map<string, Map<string, LineItemData>>> {
  // Map: bucketKey -> lineItem -> data
  const bucketMap = new Map<string, Map<string, LineItemData>>();

  // Query archive deals with T-12 data
  const result = await query(`
    SELECT 
      state, msa_name, submarket_name, asset_class,
      data_type AS deal_type, year_built, unit_count, stories,
      extraction_data->'T12'->'summary' AS t12_summary
    FROM data_library_assets
    WHERE extraction_data ? 'T12'
      AND unit_count > 0
      AND data_quality_score >= 31
  `);

  for (const row of result.rows as Record<string, unknown>[]) {
    const unitCount = Number(row.unit_count ?? 0);
    if (unitCount <= 0) continue;

    const bucket: LineItemBucket = {
      state: row.state as string | null,
      msa: row.msa_name as string | null,
      submarket: row.submarket_name as string | null,
      asset_class: row.asset_class as string | null,
      deal_type: getDealType(row.deal_type as string | null),
      vintage_band: getVintageBand(row.year_built as number | null),
      unit_count_band: getUnitCountBand(unitCount),
      stories_band: getStoriesBand(row.stories as number | null),
    };
    const bucketKey = JSON.stringify(bucket);

    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, new Map());
    }
    const lineItems = bucketMap.get(bucketKey)!;

    // Extract from T12 summary (extraction_data->'T12'->'summary')
    // The T12 extractor stores rolled-up line items as named scalar fields under summary,
    // not as income_lines[]/expense_lines[] arrays. Map camelCase keys → standardized names.
    const t12Summary = row.t12_summary as Record<string, unknown> | null;
    if (t12Summary) {
      // t12Revenue = Effective Gross Income — used as the EGI base for %-of-EGI calculations
      const egi = Number(t12Summary.t12Revenue ?? 0);

      const T12_FIELD_MAP: Record<string, [string, string]> = {
        // Revenue lines
        gpr:                ['gross_potential_rent',     'revenue'],
        lossToLease:        ['loss_to_lease',            'revenue'],
        vacancyLoss:        ['vacancy_loss',             'revenue'],
        concessions:        ['concessions',              'revenue'],
        badDebt:            ['bad_debt',                 'revenue'],
        t12Revenue:         ['effective_gross_income',   'revenue'],
        // Operating expense lines
        payroll:            ['payroll',                  'opex'],
        insurance:          ['insurance',                'opex'],
        marketing:          ['marketing',                'opex'],
        utilities:          ['utilities_total',          'opex'],
        managementFee:      ['management_fee',           'opex'],
        repairsMaintenance: ['repairs_maintenance',      'opex'],
        propertyTax:        ['real_estate_taxes',        'opex'],
        adminGeneral:       ['admin_general',            'opex'],
        turnover:           ['make_ready',               'opex'],
        amenities:          ['amenities',                'opex'],
        hoaDues:            ['hoa_dues',                 'opex'],
        contractServices:   ['contract_services',        'opex'],
        // Rollup totals
        t12OpEx:            ['total_operating_expenses', 'opex'],
        t12NOI:             ['net_operating_income',     'noi'],
      };

      for (const [summaryKey, [stdName, category]] of Object.entries(T12_FIELD_MAP)) {
        if (t12Summary[summaryKey] != null) {
          addLineItemValue(lineItems, stdName, category, Number(t12Summary[summaryKey]), unitCount, egi);
        }
      }
    }
  }

  return bucketMap;
}

function addLineItemValue(
  lineItems: Map<string, LineItemData>,
  name: string,
  _category: string,
  total: number,
  unitCount: number,
  egi: number
): void {
  if (!name || total === 0 || !isFinite(total)) return;
  
  const perUnit = total / unitCount;
  if (!isFinite(perUnit) || perUnit < 0 || perUnit > 50000) return; // Sanity check

  if (!lineItems.has(name)) {
    lineItems.set(name, { per_unit_values: [], pct_egi_values: [], egi_values: [] });
  }
  const data = lineItems.get(name)!;
  data.per_unit_values.push(perUnit);
  
  if (egi > 0) {
    const pctEgi = (total / egi) * 100;
    if (isFinite(pctEgi) && pctEgi >= 0 && pctEgi <= 200) {
      data.pct_egi_values.push(pctEgi);
      data.egi_values.push(egi / unitCount);
    }
  }
}

/**
 * Refresh line item benchmarks
 */
export async function refreshLineItemBenchmarks(): Promise<{
  bucketsWritten: number;
  lineItemsWritten: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let bucketsWritten = 0;
  let lineItemsWritten = 0;
  const asOf = new Date().toISOString().slice(0, 10);

  try {
    logger.info('[archive-benchmark-aggregator] Starting line item benchmark refresh...');

    const bucketMap = await extractArchiveLineItems();
    
    logger.info('[archive-benchmark-aggregator] Extracted line items', {
      buckets: bucketMap.size,
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const [bucketKey, lineItems] of bucketMap) {
        const bucket = JSON.parse(bucketKey) as LineItemBucket;
        bucketsWritten++;

        for (const [lineItem, data] of lineItems) {
          const n = data.per_unit_values.length;
          if (n < 3) continue;

          // Get category from standard line items
          const catResult = await client.query(
            'SELECT category FROM standard_line_items WHERE line_item = $1',
            [lineItem]
          );
          const category = (catResult.rows[0] as { category?: string })?.category ?? 'opex';

          const perUnitP10 = percentile(data.per_unit_values, 10);
          const perUnitP25 = percentile(data.per_unit_values, 25);
          const perUnitP50 = percentile(data.per_unit_values, 50);
          const perUnitP75 = percentile(data.per_unit_values, 75);
          const perUnitP90 = percentile(data.per_unit_values, 90);
          const perUnitMean = data.per_unit_values.reduce((a, b) => a + b, 0) / n;
          const variance = data.per_unit_values.reduce((sum, v) => sum + Math.pow(v - perUnitMean, 2), 0) / n;
          const perUnitStddev = Math.sqrt(variance);

          const pctEgiP10 = data.pct_egi_values.length >= 3 ? percentile(data.pct_egi_values, 10) : null;
          const pctEgiP25 = data.pct_egi_values.length >= 3 ? percentile(data.pct_egi_values, 25) : null;
          const pctEgiP50 = data.pct_egi_values.length >= 3 ? percentile(data.pct_egi_values, 50) : null;
          const pctEgiP75 = data.pct_egi_values.length >= 3 ? percentile(data.pct_egi_values, 75) : null;
          const pctEgiP90 = data.pct_egi_values.length >= 3 ? percentile(data.pct_egi_values, 90) : null;

          await client.query(
            `INSERT INTO line_item_benchmarks (
              state, msa, submarket, asset_class, deal_type,
              vintage_band, unit_count_band, stories_band,
              category, line_item,
              per_unit_p10, per_unit_p25, per_unit_p50, per_unit_p75, per_unit_p90,
              per_unit_mean, per_unit_stddev,
              pct_egi_p10, pct_egi_p25, pct_egi_p50, pct_egi_p75, pct_egi_p90,
              n_samples, n_deals, as_of
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17,
              $18, $19, $20, $21, $22,
              $23, $24, $25
            ) ON CONFLICT ON CONSTRAINT uq_line_item_benchmark DO UPDATE SET
              per_unit_p10 = EXCLUDED.per_unit_p10,
              per_unit_p25 = EXCLUDED.per_unit_p25,
              per_unit_p50 = EXCLUDED.per_unit_p50,
              per_unit_p75 = EXCLUDED.per_unit_p75,
              per_unit_p90 = EXCLUDED.per_unit_p90,
              per_unit_mean = EXCLUDED.per_unit_mean,
              per_unit_stddev = EXCLUDED.per_unit_stddev,
              pct_egi_p10 = EXCLUDED.pct_egi_p10,
              pct_egi_p25 = EXCLUDED.pct_egi_p25,
              pct_egi_p50 = EXCLUDED.pct_egi_p50,
              pct_egi_p75 = EXCLUDED.pct_egi_p75,
              pct_egi_p90 = EXCLUDED.pct_egi_p90,
              n_samples = EXCLUDED.n_samples,
              n_deals = EXCLUDED.n_deals`,
            [
              bucket.state, bucket.msa, bucket.submarket, bucket.asset_class, bucket.deal_type,
              bucket.vintage_band, bucket.unit_count_band, bucket.stories_band,
              category, lineItem,
              perUnitP10, perUnitP25, perUnitP50, perUnitP75, perUnitP90,
              perUnitMean, perUnitStddev,
              pctEgiP10, pctEgiP25, pctEgiP50, pctEgiP75, pctEgiP90,
              n, n, asOf,
            ]
          );
          lineItemsWritten++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('[archive-benchmark-aggregator] Line item benchmark refresh complete', {
      bucketsWritten,
      lineItemsWritten,
    });

    return { bucketsWritten, lineItemsWritten, errors };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive-benchmark-aggregator] Line item refresh failed', { error: msg });
    errors.push(msg);
    return { bucketsWritten, lineItemsWritten, errors };
  }
}

/**
 * Get line item benchmark stats
 */
export async function getLineItemBenchmarkStats(): Promise<{
  totalLineItems: number;
  totalBuckets: number;
  lineItemTypes: string[];
  lastRefresh: string | null;
}> {
  const result = await query(`
    SELECT 
      COUNT(DISTINCT line_item) as total_line_items,
      COUNT(DISTINCT (state, msa, asset_class)) as total_buckets,
      MAX(as_of) as last_refresh
    FROM line_item_benchmarks
    WHERE n_samples >= 3
  `);

  const typesResult = await query(`
    SELECT DISTINCT line_item 
    FROM line_item_benchmarks 
    WHERE n_samples >= 3
    ORDER BY line_item
  `);

  const row = result.rows[0] as Record<string, unknown>;
  return {
    totalLineItems: Number(row?.total_line_items ?? 0),
    totalBuckets: Number(row?.total_buckets ?? 0),
    lineItemTypes: (typesResult.rows as { line_item: string }[]).map(r => r.line_item),
    lastRefresh: row?.last_refresh ? String(row.last_refresh) : null,
  };
}
