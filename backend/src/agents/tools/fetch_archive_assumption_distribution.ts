/**
 * Tier-Archive Tool: fetch_archive_assumption_distribution
 *
 * Queries `archive_assumption_benchmarks` for the most recent matching row
 * and returns the P10–P90 distribution.  Returns null when n_samples < 5
 * (minimum sample guard — never expose distributions from sparse data).
 *
 * This is called by the CashFlow Agent to:
 *   - Flag assumptions that land > P90 (aggressive) or < P10 (conservative)
 *   - Calibrate confidence: large archive samples → higher confidence
 *   - Apply bias corrections if historical gaps are available
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  asset_class: z.string().describe('Asset class of the deal being underwritten (e.g. A, B, C)'),
  deal_type: z.string().describe('Deal type: existing | value-add | lease-up | development | redevelopment'),
  assumption_name: z.string().describe('Field path of the assumption (e.g. vacancy_pct, rent_growth_pct)'),
  submarket_id: z.string().optional().describe('Optional submarket ID for narrower bucket lookup'),
  vintage_band: z.string().optional().describe('Optional vintage band (e.g. pre-1990, 1990-2005, 2006+)'),
  strategy: z.string().optional().describe('Optional investment strategy label'),
});

const OutputSchema = z.object({
  found: z.boolean(),
  assumption_name: z.string(),
  p10: z.number().nullable().optional(),
  p25: z.number().nullable().optional(),
  p50: z.number().nullable().optional(),
  p75: z.number().nullable().optional(),
  p90: z.number().nullable().optional(),
  assumed_median: z.number().nullable().optional(),
  n_samples: z.number().optional(),
  as_of: z.unknown().optional(),
  bucket_matched: z.record(z.string(), z.unknown()).optional(),
  note: z.string().optional(),
});

export const fetchArchiveAssumptionDistributionTool = {
  name: 'fetch_archive_assumption_distribution',
  description:
    'Returns P10/P25/P50/P75/P90 distribution from the platform archive for a specific ' +
    'assumption name and deal context bucket. Returns null if fewer than 5 samples exist. ' +
    'Use to flag assumptions outside the normal range and to calibrate confidence.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  async execute(input: z.infer<typeof InputSchema>) {
    try {
      const { asset_class, deal_type, assumption_name, submarket_id, vintage_band, strategy } = input;

      // Try narrowest bucket first, then progressively widen
      const buckets = [
        // Exact match on all dimensions
        { submarket_id: submarket_id ?? null, vintage_band: vintage_band ?? null, strategy: strategy ?? null },
        // Drop strategy
        { submarket_id: submarket_id ?? null, vintage_band: vintage_band ?? null, strategy: null },
        // Drop vintage_band + strategy
        { submarket_id: submarket_id ?? null, vintage_band: null, strategy: null },
        // Drop submarket too — broadest bucket
        { submarket_id: null, vintage_band: null, strategy: null },
      ];

      for (const bucket of buckets) {
        const params: unknown[] = [asset_class, deal_type, assumption_name];
        let submarketClause: string;
        if (bucket.submarket_id) {
          params.push(bucket.submarket_id);
          submarketClause = `AND submarket_id = $${params.length}`;
        } else {
          submarketClause = 'AND submarket_id IS NULL';
        }

        let vintageBandClause: string;
        if (bucket.vintage_band) {
          params.push(bucket.vintage_band);
          vintageBandClause = `AND vintage_band = $${params.length}`;
        } else {
          vintageBandClause = 'AND vintage_band IS NULL';
        }

        let strategyClause: string;
        if (bucket.strategy) {
          params.push(bucket.strategy);
          strategyClause = `AND strategy = $${params.length}`;
        } else {
          strategyClause = 'AND strategy IS NULL';
        }

        const result = await query(
          `SELECT p10, p25, p50, p75, p90, assumed_median, n_samples, as_of
           FROM archive_assumption_benchmarks
           WHERE asset_class   = $1
             AND deal_type     = $2
             AND assumption_name = $3
             ${submarketClause}
             ${vintageBandClause}
             ${strategyClause}
             AND n_samples >= 5
           ORDER BY as_of DESC
           LIMIT 1`,
          params
        );

        if (result.rows.length > 0) {
          const row = result.rows[0] as Record<string, unknown>;
          logger.debug('fetch_archive_assumption_distribution: found bucket', {
            assumption_name,
            bucket,
            n_samples: row.n_samples,
          });
          return {
            found: true,
            assumption_name,
            p10: row.p10 !== null ? Number(row.p10) : null,
            p25: row.p25 !== null ? Number(row.p25) : null,
            p50: row.p50 !== null ? Number(row.p50) : null,
            p75: row.p75 !== null ? Number(row.p75) : null,
            p90: row.p90 !== null ? Number(row.p90) : null,
            assumed_median: row.assumed_median !== null ? Number(row.assumed_median) : null,
            n_samples: Number(row.n_samples),
            as_of: row.as_of,
            bucket_matched: bucket,
          };
        }
      }

      // No bucket with >= 5 samples found
      return {
        found: false,
        assumption_name,
        note: 'No archive distribution available (n_samples < 5 or no data). Use conservative defaults.',
      };
    } catch (err) {
      logger.error('fetch_archive_assumption_distribution: query error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        assumption_name: input.assumption_name,
        note: 'Archive query failed — proceeding without archive context.',
      };
    }
  },
};
