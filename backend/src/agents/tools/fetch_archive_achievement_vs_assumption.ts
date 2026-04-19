/**
 * Tier-Archive Tool: fetch_archive_achievement_vs_assumption
 *
 * Returns the historical gap between what was assumed at underwriting and what
 * was actually achieved post-close, sourced from `archive_assumption_benchmarks`
 * rows that have `achieved_median` populated (requires closed-deal actuals).
 *
 * Used by the CashFlow Agent to apply systematic bias corrections — e.g. if
 * the archive shows that Class B deals in this submarket have historically
 * underestimated vacancy by 50bps, the agent skews its own estimate higher.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  asset_class: z.string().describe('Asset class of the deal (e.g. A, B, C)'),
  assumption_name: z.string().describe('Field path of the assumption (e.g. vacancy_pct)'),
  submarket_id: z.string().optional().describe('Optional submarket ID'),
  lookback_years: z.number().int().min(1).max(10).optional().default(3).describe(
    'How many years back to look for closed-deal actuals (default 3)'
  ),
});

const OutputSchema = z.object({
  found: z.boolean(),
  assumption_name: z.string(),
  assumed_median: z.number().nullable().optional(),
  achieved_median: z.number().nullable().optional(),
  gap_bps: z.number().nullable().optional(),
  gap_direction: z.string().nullable().optional(),
  bias_correction_note: z.string().optional(),
  n_closed_deals: z.number().optional(),
  as_of: z.unknown().optional(),
  note: z.string().optional(),
});

export const fetchArchiveAchievementVsAssumptionTool = {
  name: 'fetch_archive_achievement_vs_assumption',
  description:
    'Returns the historical gap (in bps) between assumed and achieved values for a specific ' +
    'assumption type across closed deals. Used for bias correction — if the archive consistently ' +
    'shows underestimation, the agent adjusts its assumption accordingly. ' +
    'Returns null when fewer than 3 closed deals exist in the matching bucket.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  async execute(input: z.infer<typeof InputSchema>) {
    try {
      const { asset_class, assumption_name, submarket_id, lookback_years } = input;
      const lookbackDate = new Date();
      lookbackDate.setFullYear(lookbackDate.getFullYear() - (lookback_years ?? 3));
      const lookbackStr = lookbackDate.toISOString().slice(0, 10);

      const params: unknown[] = [asset_class, assumption_name, lookbackStr];
      const submarketClause = submarket_id
        ? (() => { params.push(submarket_id); return `AND submarket_id = $${params.length}`; })()
        : 'AND (submarket_id IS NULL OR submarket_id = $1)';

      // Intentionally broad: no vintage_band or strategy filter so we maximize closed-deal samples
      const result = await query(
        `SELECT
           assumed_median,
           achieved_median,
           gap_bps,
           n_closed_deals,
           n_samples,
           as_of
         FROM archive_assumption_benchmarks
         WHERE asset_class      = $1
           AND assumption_name  = $2
           AND as_of           >= $3::date
           ${submarketClause}
           AND achieved_median  IS NOT NULL
           AND n_closed_deals  >= 3
         ORDER BY n_closed_deals DESC, as_of DESC
         LIMIT 1`,
        params
      );

      if (result.rows.length === 0) {
        return {
          found: false,
          assumption_name,
          note: 'No closed-deal actuals available (need >= 3 closed deals). No bias correction applied.',
        };
      }

      const row = result.rows[0] as Record<string, unknown>;
      const gapBps = row.gap_bps !== null ? Number(row.gap_bps) : null;

      logger.debug('fetch_archive_achievement_vs_assumption: found gap', {
        assumption_name,
        gap_bps: gapBps,
        n_closed_deals: row.n_closed_deals,
      });

      return {
        found: true,
        assumption_name,
        assumed_median: row.assumed_median !== null ? Number(row.assumed_median) : null,
        achieved_median: row.achieved_median !== null ? Number(row.achieved_median) : null,
        gap_bps: gapBps,
        gap_direction: gapBps === null ? null : gapBps > 0 ? 'underwriting_too_aggressive' : 'underwriting_too_conservative',
        bias_correction_note:
          gapBps === null
            ? 'No bias correction needed.'
            : gapBps > 0
            ? `Platform historically assumed ${Math.abs(gapBps).toFixed(0)}bps higher than achieved — apply downward bias correction.`
            : `Platform historically assumed ${Math.abs(gapBps).toFixed(0)}bps lower than achieved — assumption is conservative, slight upward bias may apply.`,
        n_closed_deals: Number(row.n_closed_deals),
        as_of: row.as_of,
      };
    } catch (err) {
      logger.error('fetch_archive_achievement_vs_assumption: query error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        assumption_name: input.assumption_name,
        note: 'Archive achievement query failed — proceeding without bias correction.',
      };
    }
  },
};
