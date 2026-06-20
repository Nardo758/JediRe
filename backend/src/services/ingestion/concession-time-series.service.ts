import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

/**
 * Concession Time Series Service
 *
 * Extracts and aggregates concession data from multiple sources into
 * metric_time_series for use by the correlation engine (COR-09).
 *
 * Data sources:
 *   1. CoStar market_snapshots (concession_pct, effective_rent_per_unit, asking_rent_per_unit)
 *   2. Rent roll data (effective rent vs asking rent)
 *   3. Manual CSV upload from property managers
 *
 * Stored metrics:
 *   - concession_rate        (concession depth as % of rent, e.g., 0.05 = 5%)
 *   - effective_rent_index  (effective rent normalized to 100 at base period)
 *   - asking_rent_index     (asking rent normalized to 100 at base period)
 *   - rent_concession_spread (asking - effective, in dollars)
 */

interface ConcessionSourceRow {
  submarket_id: string;
  msa_id: string | null;
  period_date: string;      // YYYY-MM-DD
  concession_pct: number | null;
  effective_rent: number | null;
  asking_rent: number | null;
  source: string;
  data_as_of: string;
}

interface IngestResult {
  rowsInserted: number;
  submarketsProcessed: number;
  dateRange: { earliest: string | null; latest: string | null };
  errors: string[];
}

/**
 * Extract concessions from existing market_snapshots into metric_time_series.
 * Called after CoStar uploads or as a backfill job.
 */
export async function extractConcessionsFromSnapshots(
  opts: {
    submarketIds?: string[];
    startDate?: string;
    endDate?: string;
    dryRun?: boolean;
  } = {}
): Promise<IngestResult> {
  const { submarketIds, startDate, endDate, dryRun = false } = opts;

  const result: IngestResult = {
    rowsInserted: 0,
    submarketsProcessed: 0,
    dateRange: { earliest: null, latest: null },
    errors: [],
  };

  try {
    // Find all market_snapshots with concession data
    const whereClauses: string[] = ['concession_pct IS NOT NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (submarketIds) {
      whereClauses.push(`submarket_id = ANY($${paramIndex++})`);
      params.push(submarketIds);
    }
    if (startDate) {
      whereClauses.push(`snapshot_date >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push(`snapshot_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    const sql = `
      SELECT submarket_id, msa_id, snapshot_date AS period_date,
             concession_pct, effective_rent_per_unit, asking_rent_per_unit,
             source, data_as_of
      FROM market_snapshots
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY submarket_id, snapshot_date
    `;

    const rows = await query(sql, params);

    // Group by (submarket, period) and aggregate
    const grouped = new Map<string, {
      concessionSum: number;
      concessionCount: number;
      effectiveRentSum: number;
      effectiveRentCount: number;
      askingRentSum: number;
      askingRentCount: number;
      sources: Set<string>;
    }>();

    for (const row of rows.rows) {
      const key = `${row.submarket_id}|${row.period_date.toISOString().slice(0, 10)}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          concessionSum: row.concession_pct || 0,
          concessionCount: row.concession_pct != null ? 1 : 0,
          effectiveRentSum: row.effective_rent_per_unit || 0,
          effectiveRentCount: row.effective_rent_per_unit != null ? 1 : 0,
          askingRentSum: row.asking_rent_per_unit || 0,
          askingRentCount: row.asking_rent_per_unit != null ? 1 : 0,
          sources: new Set([row.source]),
        });
      } else {
        if (row.concession_pct != null) {
          existing.concessionSum += row.concession_pct;
          existing.concessionCount++;
        }
        if (row.effective_rent_per_unit != null) {
          existing.effectiveRentSum += row.effective_rent_per_unit;
          existing.effectiveRentCount++;
        }
        if (row.asking_rent_per_unit != null) {
          existing.askingRentSum += row.asking_rent_per_unit;
          existing.askingRentCount++;
        }
        existing.sources.add(row.source);
      }
    }

    // Insert aggregated metrics into metric_time_series
    for (const [key, data] of grouped) {
      const [submarketId, periodDate] = key.split('|');
      result.submarketsProcessed = new Set(
        Array.from(grouped.keys()).map(k => k.split('|')[0])
      ).size;

      if (!result.dateRange.earliest || periodDate < result.dateRange.earliest) {
        result.dateRange.earliest = periodDate;
      }
      if (!result.dateRange.latest || periodDate > result.dateRange.latest) {
        result.dateRange.latest = periodDate;
      }

      const metrics: Array<{ id: string; value: number | null; source: string }> = [];

      if (data.concessionCount > 0) {
        metrics.push({
          id: 'concession_rate',
          value: data.concessionSum / data.concessionCount,
          source: `CoStar avg of ${data.concessionCount} snapshots`,
        });
      }
      if (data.effectiveRentCount > 0) {
        metrics.push({
          id: 'effective_rent_index',
          value: data.effectiveRentSum / data.effectiveRentCount,
          source: `CoStar avg of ${data.effectiveRentCount} snapshots`,
        });
      }
      if (data.askingRentCount > 0) {
        metrics.push({
          id: 'asking_rent_index',
          value: data.askingRentSum / data.askingRentCount,
          source: `CoStar avg of ${data.askingRentCount} snapshots`,
        });
      }
      if (data.askingRentCount > 0 && data.effectiveRentCount > 0) {
        const avgAsking = data.askingRentSum / data.askingRentCount;
        const avgEffective = data.effectiveRentSum / data.effectiveRentCount;
        metrics.push({
          id: 'rent_concession_spread',
          value: avgAsking - avgEffective,
          source: 'Derived from asking - effective rent',
        });
      }

      for (const metric of metrics) {
        if (metric.value == null) continue;

        if (!dryRun) {
          await query(
            `INSERT INTO metric_time_series (
              metric_id, geography_type, geography_id, period_date, value,
              data_source, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (metric_id, geography_type, geography_id, period_date)
            DO UPDATE SET
              value = EXCLUDED.value,
              data_source = EXCLUDED.data_source,
              updated_at = CURRENT_TIMESTAMP`,
            [
              metric.id,
              'submarket',
              submarketId,
              periodDate,
              metric.value,
              metric.source,
            ]
          );
        }
        result.rowsInserted++;
      }
    }

    logger.info('Concession extraction complete', result);
    return result;
  } catch (err) {
    const msg = `Concession extraction failed: ${(err as Error).message}`;
    logger.error(msg);
    result.errors.push(msg);
    return result;
  }
}

/**
 * Derive concessions from rent roll data.
 * When rent rolls have both asking and effective rent, compute the implied concession.
 */
export async function deriveConcessionsFromRentRolls(
  dealId: string
): Promise<{
  submarketId: string | null;
  periodDate: string | null;
  concessionRate: number | null;
  effectiveRent: number | null;
  askingRent: number | null;
}> {
  try {
    const result = await query(
      `SELECT
         d.submarket_id,
         DATE_TRUNC('month', rr.snapshot_date) AS period_date,
         AVG(rr.asking_rent) AS avg_asking,
         AVG(rr.effective_rent) AS avg_effective,
         COUNT(*) AS unit_count
       FROM rent_rolls rr
       JOIN deals d ON d.id = rr.deal_id
       WHERE rr.deal_id = $1
         AND rr.asking_rent > 0
         AND rr.effective_rent > 0
       GROUP BY d.submarket_id, DATE_TRUNC('month', rr.snapshot_date)
       ORDER BY period_date DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return { submarketId: null, periodDate: null, concessionRate: null, effectiveRent: null, askingRent: null };
    }

    const row = result.rows[0];
    const avgAsking = parseFloat(row.avg_asking) || 0;
    const avgEffective = parseFloat(row.avg_effective) || 0;
    const concessionRate = avgAsking > 0 ? (avgAsking - avgEffective) / avgAsking : null;

    // Store the derived metric
    if (row.submarket_id && row.period_date) {
      await query(
        `INSERT INTO metric_time_series (
          metric_id, geography_type, geography_id, period_date, value,
          data_source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET
          value = EXCLUDED.value,
          data_source = EXCLUDED.data_source,
          updated_at = CURRENT_TIMESTAMP`,
        [
          'concession_rate',
          'submarket',
          row.submarket_id,
          row.period_date.toISOString().slice(0, 10),
          concessionRate,
          'Derived from rent roll asking vs effective rent',
        ]
      );
    }

    return {
      submarketId: row.submarket_id,
      periodDate: row.period_date?.toISOString().slice(0, 10) || null,
      concessionRate,
      effectiveRent: avgEffective,
      askingRent: avgAsking,
    };
  } catch (err) {
    logger.error('Derive concessions from rent roll failed', { dealId, error: (err as Error).message });
    return { submarketId: null, periodDate: null, concessionRate: null, effectiveRent: null, askingRent: null };
  }
}

/**
 * Import concessions from a CSV upload.
 * Expected columns: submarket_id, period_date, concession_pct, effective_rent, asking_rent
 */
export async function importConcessionsFromCSV(
  rows: Array<{
    submarket_id: string;
    period_date: string;  // YYYY-MM-DD
    concession_pct?: number;
    effective_rent?: number;
    asking_rent?: number;
  }>
): Promise<IngestResult> {
  const result: IngestResult = {
    rowsInserted: 0,
    submarketsProcessed: 0,
    dateRange: { earliest: null, latest: null },
    errors: [],
  };

  const submarketSet = new Set<string>();

  for (const row of rows) {
    try {
      submarketSet.add(row.submarket_id);

      const metrics: Array<{ id: string; value: number | null }> = [];
      if (row.concession_pct != null) {
        metrics.push({ id: 'concession_rate', value: row.concession_pct });
      }
      if (row.effective_rent != null) {
        metrics.push({ id: 'effective_rent_index', value: row.effective_rent });
      }
      if (row.asking_rent != null) {
        metrics.push({ id: 'asking_rent_index', value: row.asking_rent });
      }
      if (row.asking_rent != null && row.effective_rent != null) {
        metrics.push({ id: 'rent_concession_spread', value: row.asking_rent - row.effective_rent });
      }

      for (const metric of metrics) {
        if (metric.value == null) continue;

        await query(
          `INSERT INTO metric_time_series (
            metric_id, geography_type, geography_id, period_date, value,
            data_source, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (metric_id, geography_type, geography_id, period_date)
          DO UPDATE SET
            value = EXCLUDED.value,
            data_source = EXCLUDED.data_source,
            updated_at = CURRENT_TIMESTAMP`,
          [
            metric.id,
            'submarket',
            row.submarket_id,
            row.period_date,
            metric.value,
            'Manual CSV upload',
          ]
        );
        result.rowsInserted++;
      }

      if (!result.dateRange.earliest || row.period_date < result.dateRange.earliest) {
        result.dateRange.earliest = row.period_date;
      }
      if (!result.dateRange.latest || row.period_date > result.dateRange.latest) {
        result.dateRange.latest = row.period_date;
      }
    } catch (err) {
      const msg = `Row failed for ${row.submarket_id} ${row.period_date}: ${(err as Error).message}`;
      logger.warn(msg);
      result.errors.push(msg);
    }
  }

  result.submarketsProcessed = submarketSet.size;
  logger.info('Concession CSV import complete', result);
  return result;
}

export type { IngestResult, ConcessionSourceRow };
