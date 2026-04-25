/**
 * Replacement-Cost aggregation API (Task #383).
 *
 * `GET /api/v1/replacement-cost/:entityType/:entityId`
 *
 * Aggregates `data_library_cost_data` rows scoped to the resolved canonical
 * MSA / submarket key and returns:
 *   - sample size (n)
 *   - per-unit median + p25/p75
 *   - total replacement cost median
 *   - hard-cost PSF median
 *   - up-to-10 most recent provenance rows for the side panel
 *
 * Returns 200 with an explicit "no data" payload when nothing is available
 * for the requested market — no silent fallback, no fake numbers.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middleware/auth';
import {
  resolveMsa,
  resolveSubmarket,
  canonicalMsaKey,
  canonicalSubmarketKey,
} from './_market-resolution';

interface PoolClientLite {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

async function resolveCanonicalKey(
  pool: Pool,
  entityType: 'msa' | 'submarket',
  entityId: string,
): Promise<{ key: string; name: string | null }> {
  const client = await pool.connect();
  try {
    const lite: PoolClientLite = client;
    if (entityType === 'msa') {
      const r = await resolveMsa(lite, entityId);
      return { key: canonicalMsaKey(r, entityId), name: r?.name ?? null };
    }
    const r = await resolveSubmarket(lite, entityId, null);
    return { key: canonicalSubmarketKey(r, entityId), name: r?.name ?? null };
  } finally {
    client.release();
  }
}

export function createReplacementCostRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/:entityType/:entityId', requireAuth, async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as 'msa' | 'submarket';
      const entityId = req.params.entityId;
      if (entityType !== 'msa' && entityType !== 'submarket') {
        return res.status(400).json({ error: 'entityType must be "msa" or "submarket"' });
      }

      const { key, name } = await resolveCanonicalKey(pool, entityType, entityId);
      const keyCol = entityType === 'msa' ? 'msa_key' : 'submarket_key';

      // PSF-derived columns: anything per-PSF is computed from the row's
      // own net_rentable_sf so different-sized properties stay comparable.
      const aggSql = `
        WITH base AS (
          SELECT
            replacement_cost_per_unit,
            total_replacement_cost,
            hard_cost_psf,
            CASE WHEN net_rentable_sf > 0 AND land_value             IS NOT NULL THEN land_value             / net_rentable_sf END AS land_psf,
            CASE WHEN net_rentable_sf > 0 AND soft_cost_total        IS NOT NULL THEN soft_cost_total        / net_rentable_sf END AS soft_psf,
            CASE WHEN net_rentable_sf > 0 AND total_replacement_cost IS NOT NULL THEN total_replacement_cost / net_rentable_sf END AS total_psf
          FROM data_library_cost_data
          WHERE ${keyCol} = $1
        )
        SELECT
          COUNT(*)::int                                                                                       AS n,
          PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY replacement_cost_per_unit) FILTER (WHERE replacement_cost_per_unit IS NOT NULL) AS per_unit_median,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY replacement_cost_per_unit) FILTER (WHERE replacement_cost_per_unit IS NOT NULL) AS per_unit_p25,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY replacement_cost_per_unit) FILTER (WHERE replacement_cost_per_unit IS NOT NULL) AS per_unit_p75,
          MIN(replacement_cost_per_unit)                                                                      AS per_unit_min,
          MAX(replacement_cost_per_unit)                                                                      AS per_unit_max,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_replacement_cost) FILTER (WHERE total_replacement_cost IS NOT NULL) AS total_median,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hard_cost_psf)         FILTER (WHERE hard_cost_psf IS NOT NULL)         AS hard_cost_psf_median,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY land_psf)              FILTER (WHERE land_psf  IS NOT NULL)             AS land_psf_median,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY soft_psf)              FILTER (WHERE soft_psf  IS NOT NULL)             AS soft_psf_median,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_psf)             FILTER (WHERE total_psf IS NOT NULL)             AS total_psf_median,
          COUNT(land_psf)  FILTER (WHERE land_psf  IS NOT NULL)::int                                          AS land_psf_n,
          COUNT(hard_cost_psf) FILTER (WHERE hard_cost_psf IS NOT NULL)::int                                  AS hard_psf_n,
          COUNT(soft_psf)  FILTER (WHERE soft_psf  IS NOT NULL)::int                                          AS soft_psf_n,
          COUNT(total_psf) FILTER (WHERE total_psf IS NOT NULL)::int                                          AS total_psf_n
        FROM base
      `;
      const aggR = await pool.query(aggSql, [key]);
      const agg = aggR.rows[0] ?? {};

      const provR = await pool.query(
        `SELECT id, source_file_id, source_page,
                property_name, property_type, units, year_built, net_rentable_sf,
                land_value, hard_cost_psf, hard_cost_total,
                soft_cost_pct, soft_cost_total,
                replacement_cost_per_unit, total_replacement_cost,
                cost_source, source, captured_at
           FROM data_library_cost_data
          WHERE ${keyCol} = $1
          ORDER BY captured_at DESC
          LIMIT 10`,
        [key],
      );

      const num = (v: unknown): number | null => v === null || v === undefined ? null : Number(v);

      res.json({
        entityType,
        entityId,
        canonicalKey: key,
        entityName: name,
        sampleSize: Number(agg.n ?? 0),
        perUnit: {
          median: num(agg.per_unit_median),
          p25:    num(agg.per_unit_p25),
          p75:    num(agg.per_unit_p75),
          min:    num(agg.per_unit_min),
          max:    num(agg.per_unit_max),
        },
        // Full PSF breakdown so the panel can render Land + Hard + Soft + Total
        // (each with its own provenance count) instead of the prior single
        // hard-cost figure. Each median is computed from the underlying row's
        // own net_rentable_sf — never a global ratio.
        psf: {
          land:  { median: num(agg.land_psf_median),       sampleSize: Number(agg.land_psf_n  ?? 0) },
          hard:  { median: num(agg.hard_cost_psf_median),  sampleSize: Number(agg.hard_psf_n  ?? 0) },
          soft:  { median: num(agg.soft_psf_median),       sampleSize: Number(agg.soft_psf_n  ?? 0) },
          total: { median: num(agg.total_psf_median),      sampleSize: Number(agg.total_psf_n ?? 0) },
        },
        totalReplacementCostMedian: num(agg.total_median),
        hardCostPsfMedian:          num(agg.hard_cost_psf_median),
        provenance: provR.rows.map(row => ({
          id:                      String(row.id),
          sourceFileId:            row.source_file_id == null ? null : Number(row.source_file_id),
          sourcePage:              row.source_page    == null ? null : Number(row.source_page),
          propertyName:            row.property_name == null ? null : String(row.property_name),
          propertyType:            row.property_type == null ? null : String(row.property_type),
          units:                   row.units == null ? null : Number(row.units),
          yearBuilt:               row.year_built == null ? null : Number(row.year_built),
          netRentableSF:           num(row.net_rentable_sf),
          landValue:               num(row.land_value),
          hardCostPsf:             num(row.hard_cost_psf),
          hardCostTotal:           num(row.hard_cost_total),
          softCostPct:             num(row.soft_cost_pct),
          softCostTotal:           num(row.soft_cost_total),
          replacementCostPerUnit:  num(row.replacement_cost_per_unit),
          totalReplacementCost:    num(row.total_replacement_cost),
          costSource:              row.cost_source == null ? null : String(row.cost_source),
          source:                  String(row.source),
          capturedAt:              row.captured_at instanceof Date
                                     ? (row.captured_at as Date).toISOString()
                                     : String(row.captured_at),
        })),
      });
    } catch (err: unknown) {
      console.error('replacement-cost error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  return router;
}
