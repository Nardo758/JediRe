/**
 * Zillow Ingestion Service
 * Parses ZHVI (Home Value Index) and ZORI (Observed Rent Index) CSVs
 * and stores values into metric_time_series, then computes YoY growth rates.
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import axios from 'axios';

export type ZillowMetricType = 'zhvi' | 'zori';

interface ParsedRow {
  regionId: string;
  regionName: string;
  regionType: string;
  stateName: string;
  periods: Array<{ date: string; value: number }>;
}

interface IngestionStats {
  rowsParsed: number;
  periodsTotal: number;
  rowsInserted: number;
  rowsSkipped: number;
  yoyRowsInserted: number;
  errors: string[];
  durationMs: number;
}

// Maps Zillow regionType strings to our geography_type vocabulary
function normalizeGeographyType(raw: string): string {
  const map: Record<string, string> = {
    city: 'city',
    zip: 'zip',
    zipcode: 'zip',
    metro: 'metro',
    msa: 'metro',
    county: 'county',
    state: 'state',
    neighborhood: 'neighborhood',
  };
  return map[raw?.toLowerCase()] ?? raw?.toLowerCase() ?? 'unknown';
}

// Build a stable geography_id from region fields
function buildGeographyId(row: ParsedRow): string {
  const base = row.regionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (row.stateName) {
    const state = row.stateName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    return `${base}-${state}`;
  }
  return `${base}-${row.regionId}`;
}

// Parse Zillow CSV buffer into structured rows
function parseZillowCsv(csvText: string, metricType: ZillowMetricType): ParsedRow[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV has no data rows');

  const headers = parseCSVLine(lines[0]);

  // Find the index where date columns start (first column that looks like YYYY-MM-DD)
  const dateStartIdx = headers.findIndex(h => /^\d{4}-\d{2}-\d{2}$/.test(h));
  if (dateStartIdx === -1) throw new Error('No date columns found in CSV header');

  const metaHeaders = headers.slice(0, dateStartIdx).map(h => h.toLowerCase());
  const dateHeaders = headers.slice(dateStartIdx);

  const regionNameIdx = metaHeaders.findIndex(h => h === 'regionname');
  const regionIdIdx = metaHeaders.findIndex(h => h === 'regionid');
  const regionTypeIdx = metaHeaders.findIndex(h => h === 'regiontype');
  const stateNameIdx = metaHeaders.findIndex(h => h === 'statename' || h === 'state');

  if (regionNameIdx === -1) throw new Error('No RegionName column found');

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < dateStartIdx) continue;

    const metaCols = cols.slice(0, dateStartIdx);
    const dateCols = cols.slice(dateStartIdx);

    const regionName = metaCols[regionNameIdx] ?? '';
    const regionId = regionIdIdx >= 0 ? (metaCols[regionIdIdx] ?? String(i)) : String(i);
    const regionType = regionTypeIdx >= 0 ? (metaCols[regionTypeIdx] ?? 'unknown') : 'unknown';
    const stateName = stateNameIdx >= 0 ? (metaCols[stateNameIdx] ?? '') : '';

    const periods: Array<{ date: string; value: number }> = [];
    for (let d = 0; d < dateHeaders.length; d++) {
      const raw = dateCols[d]?.trim();
      if (!raw || raw === '' || raw === 'null' || raw === 'NULL') continue;
      const value = parseFloat(raw);
      if (isNaN(value)) continue;
      periods.push({ date: dateHeaders[d], value });
    }

    if (periods.length === 0) continue;

    rows.push({ regionId, regionName, regionType, stateName, periods });
  }

  return rows;
}

// Minimal CSV line parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Insert rows into metric_time_series in batches
async function batchInsert(
  metricId: string,
  rows: ParsedRow[],
  stats: IngestionStats,
  onProgress?: (done: number) => void
): Promise<void> {
  const BATCH_SIZE = 500;
  let batch: Array<[string, string, string, string | null, string, string, number, string]> = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const placeholders = batch.map(
      (_, i) => `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
    ).join(', ');
    const values = batch.flat();
    try {
      const res = await query(
        `INSERT INTO metric_time_series
           (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source)
         VALUES ${placeholders}
         ON CONFLICT (metric_id, geography_type, geography_id, period_date)
         DO UPDATE SET value = EXCLUDED.value, geography_name = EXCLUDED.geography_name`,
        values
      );
      stats.rowsInserted += res.rowCount ?? 0;
    } catch (err: any) {
      stats.errors.push(`Batch insert error: ${err.message?.slice(0, 120)}`);
      stats.rowsSkipped += batch.length;
    }
    batch = [];
  };

  for (const row of rows) {
    const geoType = normalizeGeographyType(row.regionType);
    const geoId = buildGeographyId(row);

    for (const { date, value } of row.periods) {
      batch.push([metricId, geoType, geoId, row.regionName, date, 'monthly', value, 'zillow']);
      stats.periodsTotal++;

      if (batch.length >= BATCH_SIZE) {
        await flush();
        onProgress?.(stats.rowsInserted);
      }
    }
    stats.rowsParsed++;
  }
  await flush();
  onProgress?.(stats.rowsInserted);
}

// Compute YoY growth rates for a metric using a staging table for performance.
// A direct INSERT-SELECT with ON CONFLICT is slow on large tables because each
// row triggers an index lookup against 500K+ rows; staging first avoids that.
async function computeYoY(metricId: string, stats: IngestionStats): Promise<void> {
  const yoyMetricId = `${metricId}_yoy`;
  const stagingTable = `_yoy_staging_${metricId.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

  try {
    // Step 1: compute into a temp table (no unique-constraint overhead)
    await query(`
      CREATE TEMP TABLE ${stagingTable} AS
      SELECT
        $1::VARCHAR(50)  AS metric_id,
        cur.geography_type,
        cur.geography_id,
        cur.geography_name,
        cur.period_date,
        'monthly'::VARCHAR(10) AS period_type,
        ROUND(((cur.value - prev.value) / NULLIF(prev.value, 0) * 100)::NUMERIC, 4)::DOUBLE PRECISION AS value,
        'zillow'::VARCHAR(50)  AS source,
        0.95::REAL             AS confidence
      FROM metric_time_series cur
      JOIN metric_time_series prev
        ON  prev.metric_id      = $2
        AND prev.geography_type = cur.geography_type
        AND prev.geography_id   = cur.geography_id
        AND prev.period_date    = (cur.period_date - INTERVAL '12 months')::DATE
      WHERE cur.metric_id  = $2
        AND prev.value IS NOT NULL
        AND prev.value != 0
    `, [yoyMetricId, metricId]);

    // Step 2: bulk-insert from staging (fast; unique check only at insert time)
    const result = await query(`
      INSERT INTO metric_time_series
        (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
      SELECT metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence
      FROM ${stagingTable}
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
      DO UPDATE SET value = EXCLUDED.value
    `);

    stats.yoyRowsInserted = result.rowCount ?? 0;
  } catch (err: any) {
    stats.errors.push(`YoY computation error: ${err.message?.slice(0, 120)}`);
  } finally {
    try { await query(`DROP TABLE IF EXISTS ${stagingTable}`); } catch {}
  }
}

// Download CSV from a public URL
export async function fetchCsvFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: { 'User-Agent': 'JediRe-DataIngestion/1.0' },
  });
  return Buffer.from(response.data);
}

// Main ingestion entry point — accepts a CSV buffer
export async function ingestZillowCsv(
  csvBuffer: Buffer,
  metricType: ZillowMetricType,
  onProgress?: (done: number, total: number) => void
): Promise<IngestionStats> {
  const start = Date.now();
  const metricId = metricType === 'zhvi' ? 'home_value_index' : 'rent_index';

  const stats: IngestionStats = {
    rowsParsed: 0,
    periodsTotal: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    yoyRowsInserted: 0,
    errors: [],
    durationMs: 0,
  };

  logger.info(`[Zillow] Starting ${metricType.toUpperCase()} ingestion`);

  const csvText = csvBuffer.toString('utf-8');
  const rows = parseZillowCsv(csvText, metricType);

  logger.info(`[Zillow] Parsed ${rows.length} geographies`);

  const totalPeriods = rows.reduce((s, r) => s + r.periods.length, 0);
  await batchInsert(metricId, rows, stats, (done) => onProgress?.(done, totalPeriods));

  logger.info(`[Zillow] Inserted ${stats.rowsInserted} rows — computing YoY...`);
  await computeYoY(metricId, stats);
  logger.info(`[Zillow] YoY rows inserted: ${stats.yoyRowsInserted}`);

  stats.durationMs = Date.now() - start;
  return stats;
}

// Query freshness for the ingest/status endpoint
export async function getZillowFreshness(): Promise<{
  zhvi: { latestDate: string | null; geographyCount: number };
  zori: { latestDate: string | null; geographyCount: number };
}> {
  const result = await query(`
    SELECT metric_id,
           MAX(period_date)::TEXT         AS latest_date,
           COUNT(DISTINCT geography_id)   AS geography_count
    FROM metric_time_series
    WHERE metric_id IN ('home_value_index', 'rent_index')
      AND source = 'zillow'
    GROUP BY metric_id
  `);

  const byId: Record<string, { latestDate: string | null; geographyCount: number }> = {};
  for (const row of result.rows) {
    byId[row.metric_id] = { latestDate: row.latest_date, geographyCount: parseInt(row.geography_count) };
  }

  return {
    zhvi: byId['home_value_index'] ?? { latestDate: null, geographyCount: 0 },
    zori: byId['rent_index']       ?? { latestDate: null, geographyCount: 0 },
  };
}
