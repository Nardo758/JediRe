/**
 * Archive Aggregation Inngest Function
 *
 * Runs nightly at 02:00 UTC. Reads from `deal_underwriting_snapshots` and
 * `deal_monthly_actuals` to compute per-bucket assumption statistics, then
 * upserts them into `archive_assumption_benchmarks`.
 *
 * Architecture:
 *   Step 1 — assumed_median + percentiles from deal_underwriting_snapshots
 *   Step 2 — achieved_median + gap_bps for closed deals with actuals
 *   Step 3 — upsert to archive_assumption_benchmarks
 *
 * Data governance:
 *   - Only statistical aggregates are written; no individual deal data
 *   - Minimum sample guard: buckets with < 5 samples are not written
 *   - Individual step failures are caught and logged without aborting the job
 */

import { inngest } from '../../lib/inngest';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface BucketAssumption {
  asset_class: string;
  deal_type: string;
  submarket_id: string | null;
  vintage_band: string | null;
  strategy: string | null;
  assumption_name: string;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  assumed_median: number | null;
  n_samples: number;
}

interface ClosedDealGap {
  asset_class: string;
  deal_type: string;
  submarket_id: string | null;
  assumption_name: string;
  achieved_median: number;
  assumed_median: number;
  gap_bps: number;
  n_closed_deals: number;
}

export const archiveAggregationFunction = inngest.createFunction(
  {
    id: 'archive-assumption-aggregation',
    name: 'Archive: nightly assumption benchmarks aggregation',
    triggers: [{ cron: '0 2 * * *' }],
  },
  async ({ step }) => {
    const asOf = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ── Step 1: Compute percentile distributions from underwriting snapshots ──
    const buckets = (await step.run(
      'compute-assumption-percentiles',
      async () => {
        try {
          /**
           * Unnest proforma_json.proforma_fields (a JSONB map of field_path → {value, source, evidence})
           * into rows, join with deals for bucket keys, compute percentiles per bucket.
           *
           * Only numeric values are included (fields with non-numeric values like
           * free-text source labels are filtered out by the CASE WHEN check).
           */
          const result = await query(
            `WITH unnested AS (
               SELECT
                 COALESCE(d.asset_class, 'unknown')  AS asset_class,
                 COALESCE(d.deal_type,   'existing') AS deal_type,
                 d.submarket_id,
                 NULL::text                          AS vintage_band,
                 NULL::text                          AS strategy,
                 kv.key                              AS assumption_name,
                 CASE
                   WHEN kv.value->>'value' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                   THEN (kv.value->>'value')::numeric
                   ELSE NULL
                 END AS assumed_value
               FROM deal_underwriting_snapshots s
               JOIN deals d ON d.id = s.deal_id
               CROSS JOIN LATERAL jsonb_each(s.proforma_json->'proforma_fields') AS kv(key, value)
               WHERE s.proforma_json ? 'proforma_fields'
             ),
             filtered AS (
               SELECT * FROM unnested WHERE assumed_value IS NOT NULL
             ),
             bucketed AS (
               SELECT
                 asset_class,
                 deal_type,
                 submarket_id,
                 vintage_band,
                 strategy,
                 assumption_name,
                 COUNT(*)::integer                                                       AS n_samples,
                 PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY assumed_value)            AS p10,
                 PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY assumed_value)            AS p25,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY assumed_value)            AS p50,
                 PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY assumed_value)            AS p75,
                 PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY assumed_value)            AS p90,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY assumed_value)            AS assumed_median
               FROM filtered
               GROUP BY asset_class, deal_type, submarket_id, vintage_band, strategy, assumption_name
               HAVING COUNT(*) >= 5
             )
             SELECT * FROM bucketed
             ORDER BY asset_class, deal_type, assumption_name`
          );

          return result.rows.map((r: Record<string, unknown>) => ({
            asset_class: String(r.asset_class),
            deal_type: String(r.deal_type),
            submarket_id: r.submarket_id as string | null,
            vintage_band: r.vintage_band as string | null,
            strategy: r.strategy as string | null,
            assumption_name: String(r.assumption_name),
            p10: r.p10 !== null ? Number(r.p10) : null,
            p25: r.p25 !== null ? Number(r.p25) : null,
            p50: r.p50 !== null ? Number(r.p50) : null,
            p75: r.p75 !== null ? Number(r.p75) : null,
            p90: r.p90 !== null ? Number(r.p90) : null,
            assumed_median: r.assumed_median !== null ? Number(r.assumed_median) : null,
            n_samples: Number(r.n_samples),
          }));
        } catch (err) {
          logger.error('archive-aggregation: step 1 failed', {
            err: err instanceof Error ? err.message : String(err),
          });
          return [] as BucketAssumption[];
        }
      }
    )) as unknown as BucketAssumption[];

    logger.info('archive-aggregation: step 1 complete', { bucket_count: buckets.length, asOf });

    // ── Step 2: Compute achieved_median + gap_bps from deal_monthly_actuals ──
    const closedGaps = (await step.run(
      'compute-achievement-gaps',
      async () => {
        try {
          /**
           * For each closed deal that has deal_monthly_actuals and a corresponding
           * underwriting snapshot, compute the median achieved value vs. assumed value.
           *
           * "Achieved" values are proxied from deal_monthly_actuals columns:
           *   - vacancy_pct  → 1 - (occupied_units / NULLIF(total_units, 0))
           *   - noi          → noi column
           *   - rent_growth  → cannot be directly derived from actuals; skip for now
           *
           * gap_bps = (assumed_median - achieved_median) * 10000
           * Positive gap_bps = underwriting assumed higher than achieved (aggressive)
           * Negative gap_bps = underwriting assumed lower than achieved (conservative)
           */
          // Two-level aggregation so every deal contributes ONE value to the
          // bucket median (prevents deals with many months from dominating):
          //   Level 1: per-deal achieved value (median of that deal's monthly readings)
          //   Level 2: bucket median across all per-deal values
          //
          // "Closed deal" = deals with status = 'closed_won' that also have
          // >= 3 months of actuals recorded (ensures real post-close data).
          // Include deal_type so bucket cohort aligns with Step 1.
          const result = await query(
            `WITH per_deal_vacancy AS (
               SELECT
                 d.id                                         AS deal_id,
                 COALESCE(d.asset_class, 'unknown')           AS asset_class,
                 COALESCE(d.deal_type,   'existing')          AS deal_type,
                 d.submarket_id,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (
                   ORDER BY 1.0 - (ma.occupied_units::numeric / NULLIF(ma.total_units, 0))
                 )                                            AS deal_achieved_vacancy
               FROM deal_monthly_actuals ma
               JOIN deals d ON d.id = ma.deal_id
               WHERE d.status = 'closed_won'
                 AND ma.total_units > 0
                 AND ma.occupied_units IS NOT NULL
               GROUP BY d.id, d.asset_class, d.deal_type, d.submarket_id
               HAVING COUNT(*) >= 3
             ),
             vacancy_actuals AS (
               SELECT
                 asset_class, deal_type, submarket_id,
                 'vacancy_pct'                                                    AS assumption_name,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY deal_achieved_vacancy) AS achieved_median,
                 COUNT(DISTINCT deal_id)                                          AS n_closed_deals
               FROM per_deal_vacancy
               GROUP BY asset_class, deal_type, submarket_id
               HAVING COUNT(DISTINCT deal_id) >= 3
             ),
             per_deal_noi AS (
               SELECT
                 d.id                                AS deal_id,
                 COALESCE(d.asset_class, 'unknown')  AS asset_class,
                 COALESCE(d.deal_type,   'existing') AS deal_type,
                 d.submarket_id,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ma.noi) AS deal_achieved_noi
               FROM deal_monthly_actuals ma
               JOIN deals d ON d.id = ma.deal_id
               WHERE d.status = 'closed_won'
                 AND ma.noi IS NOT NULL
               GROUP BY d.id, d.asset_class, d.deal_type, d.submarket_id
               HAVING COUNT(*) >= 3
             ),
             noi_actuals AS (
               SELECT
                 asset_class, deal_type, submarket_id,
                 'noi'                                                         AS assumption_name,
                 PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY deal_achieved_noi) AS achieved_median,
                 COUNT(DISTINCT deal_id)                                       AS n_closed_deals
               FROM per_deal_noi
               GROUP BY asset_class, deal_type, submarket_id
               HAVING COUNT(DISTINCT deal_id) >= 3
             ),
             combined AS (
               SELECT * FROM vacancy_actuals
               UNION ALL
               SELECT * FROM noi_actuals
             )
             SELECT * FROM combined`
          );

          return result.rows.map((r: Record<string, unknown>) => ({
            asset_class: String(r.asset_class ?? 'unknown'),
            deal_type: String(r.deal_type ?? 'existing'),
            submarket_id: r.submarket_id as string | null,
            assumption_name: String(r.assumption_name),
            achieved_median: Number(r.achieved_median),
            assumed_median: 0, // placeholder; filled in Step 3 from bucket data
            gap_bps: 0,        // placeholder; computed in Step 3
            n_closed_deals: Number(r.n_closed_deals),
          }));
        } catch (err) {
          logger.error('archive-aggregation: step 2 failed', {
            err: err instanceof Error ? err.message : String(err),
          });
          return [] as ClosedDealGap[];
        }
      }
    )) as unknown as ClosedDealGap[];

    logger.info('archive-aggregation: step 2 complete', { gap_count: closedGaps.length });

    // ── Step 3: Upsert to archive_assumption_benchmarks ─────────────────────
    // Uses INSERT ... ON CONFLICT DO UPDATE so the operation is idempotent and
    // safe to re-run any number of times on the same as_of date.
    const upsertResult = await step.run('upsert-archive-benchmarks', async () => {
      let inserted = 0;
      let errors = 0;

      for (const bucket of buckets) {
        try {
          // Find matching closed-deal gap for this exact bucket
          // (asset_class + deal_type + submarket_id + assumption_name)
          const gap = closedGaps.find(
            g =>
              g.asset_class === bucket.asset_class &&
              g.deal_type   === bucket.deal_type &&
              g.assumption_name === bucket.assumption_name &&
              (g.submarket_id === bucket.submarket_id ||
                (g.submarket_id === null && bucket.submarket_id === null))
          );

          const achievedMedian = gap?.achieved_median ?? null;
          const gapBps =
            gap && bucket.assumed_median !== null && gap.achieved_median !== null
              ? Math.round((bucket.assumed_median - gap.achieved_median) * 10000)
              : null;
          const nClosedDeals = gap?.n_closed_deals ?? 0;

          // ON CONFLICT uses expression index on COALESCE for nullable bucket dims
          await query(
            `INSERT INTO archive_assumption_benchmarks
               (asset_class, deal_type, submarket_id, vintage_band, strategy,
                assumption_name, p10, p25, p50, p75, p90,
                assumed_median, achieved_median, gap_bps,
                n_samples, n_closed_deals, as_of)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (
               asset_class, deal_type,
               COALESCE(submarket_id, ''),
               COALESCE(vintage_band, ''),
               COALESCE(strategy, ''),
               assumption_name, as_of
             )
             DO UPDATE SET
               p10             = EXCLUDED.p10,
               p25             = EXCLUDED.p25,
               p50             = EXCLUDED.p50,
               p75             = EXCLUDED.p75,
               p90             = EXCLUDED.p90,
               assumed_median  = EXCLUDED.assumed_median,
               achieved_median = EXCLUDED.achieved_median,
               gap_bps         = EXCLUDED.gap_bps,
               n_samples       = EXCLUDED.n_samples,
               n_closed_deals  = EXCLUDED.n_closed_deals`,
            [
              bucket.asset_class,
              bucket.deal_type,
              bucket.submarket_id,
              bucket.vintage_band,
              bucket.strategy,
              bucket.assumption_name,
              bucket.p10,
              bucket.p25,
              bucket.p50,
              bucket.p75,
              bucket.p90,
              bucket.assumed_median,
              achievedMedian,
              gapBps,
              bucket.n_samples,
              nClosedDeals,
              asOf,
            ]
          );
          inserted++;
        } catch (err) {
          errors++;
          logger.error('archive-aggregation: upsert failed for bucket', {
            bucket: { ...bucket, as_of: asOf },
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { inserted, errors, as_of: asOf };
    });

    logger.info('archive-aggregation: complete', upsertResult);
    return upsertResult;
  }
);
