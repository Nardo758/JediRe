import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// ── LV resolution helpers ─────────────────────────────────────────────────────

function lvStr(json: unknown): string | null {
  if (!json) return null;
  if (typeof json === 'string') return json;
  const o = json as Record<string, unknown>;
  const v = o['override'] ?? o['resolved'] ?? o['detected'] ?? null;
  return v !== null && v !== undefined ? String(v) : null;
}

function lvNum(json: unknown): number | null {
  const s = lvStr(json);
  if (s === null) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function classifyVintage(yearBuilt: number | null): string {
  if (yearBuilt === null) return 'Missing';
  if (yearBuilt < 1980)  return 'Pre-1980';
  if (yearBuilt <= 2000) return '1980-2000';
  if (yearBuilt <= 2015) return '2000-2015';
  return 'Post-2015';
}

function classifySize(unitCount: number | null): string {
  if (unitCount === null) return 'Missing';
  if (unitCount < 100)   return 'Small (<100)';
  if (unitCount <= 300)  return 'Medium (100-300)';
  return 'Large (300+)';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/cohorts/backfill
// Idempotent rebuild of cohorts + cohort_membership from property_descriptions
// and historical_observations.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/backfill', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Wipe existing membership + cohorts (CASCADE handles membership)
    await client.query('TRUNCATE cohort_membership');
    await client.query('DELETE FROM cohorts');

    // 2. Load all property_descriptions rows
    const pdRows = await client.query(
      `SELECT parcel_id, property_type, asset_class, msa, year_built, unit_count
       FROM property_descriptions`,
    );

    if (pdRows.rows.length === 0) {
      await client.query('COMMIT');
      return res.json({ success: true, cohortCount: 0, memberCount: 0, message: 'No property_descriptions rows found — run Phase 1 batch upload first.' });
    }

    // 3. Classify each property into a cohort key
    const missing: string[] = [];
    interface ClassifiedProp {
      parcelId: string;
      productType: string | null;
      assetClass: string | null;
      market: string | null;
      vintage: string;
      sizeRange: string;
    }
    const classified: ClassifiedProp[] = pdRows.rows.map((r) => {
      const productType = lvStr(r.property_type);
      const assetClass  = lvStr(r.asset_class);
      const market      = lvStr(r.msa);
      const yearBuilt   = lvNum(r.year_built);
      const unitCount   = lvNum(r.unit_count);
      const vintage     = classifyVintage(yearBuilt);
      const sizeRange   = classifySize(unitCount);
      const missingDims = [
        !productType && 'product_type',
        !assetClass  && 'asset_class',
        !market      && 'market',
      ].filter(Boolean);
      if (missingDims.length) missing.push(`${r.parcel_id}: missing [${missingDims.join(', ')}]`);
      return { parcelId: r.parcel_id, productType, assetClass, market, vintage, sizeRange };
    });

    // 4. Group into cohort keys and insert unique cohorts
    const cohortKeyMap = new Map<string, ClassifiedProp & { id?: string }>();
    for (const p of classified) {
      const key = [p.productType ?? '', p.assetClass ?? '', p.market ?? '', p.vintage, p.sizeRange].join('|||');
      if (!cohortKeyMap.has(key)) cohortKeyMap.set(key, { ...p });
    }

    // Insert cohorts one by one (small table, safe)
    for (const [, c] of cohortKeyMap) {
      const ins = await client.query(
        `INSERT INTO cohorts (product_type, asset_class, market, vintage, size_range)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [c.productType, c.assetClass, c.market, c.vintage, c.sizeRange],
      );
      if (ins.rows[0]) {
        c.id = ins.rows[0].id as string;
      } else {
        // Row existed (shouldn't happen after TRUNCATE, but be safe)
        const existing = await client.query(
          `SELECT id FROM cohorts
           WHERE COALESCE(product_type,'') = COALESCE($1,'')
             AND COALESCE(asset_class,'')  = COALESCE($2,'')
             AND COALESCE(market,'')       = COALESCE($3,'')
             AND COALESCE(vintage,'')      = COALESCE($4,'')
             AND COALESCE(size_range,'')   = COALESCE($5,'')
           LIMIT 1`,
          [c.productType, c.assetClass, c.market, c.vintage, c.sizeRange],
        );
        c.id = existing.rows[0]?.id;
      }
    }

    // 5. Insert cohort_membership
    let memberCount = 0;
    for (const p of classified) {
      const key = [p.productType ?? '', p.assetClass ?? '', p.market ?? '', p.vintage, p.sizeRange].join('|||');
      const cohortId = cohortKeyMap.get(key)?.id;
      if (!cohortId) continue;
      await client.query(
        `INSERT INTO cohort_membership (parcel_id, cohort_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [p.parcelId, cohortId],
      );
      memberCount++;
    }

    // 6. Update member_count on cohorts
    await client.query(
      `UPDATE cohorts c
       SET member_count = (SELECT COUNT(*) FROM cohort_membership cm WHERE cm.cohort_id = c.id),
           updated_at   = now()`,
    );

    // 7. Compute aggregated_metrics from historical_observations
    await client.query(
      `UPDATE cohorts c
       SET aggregated_metrics = agg.metrics
       FROM (
         SELECT
           cm.cohort_id,
           jsonb_build_object(
             'avgOccupancy',       ROUND(AVG(ho.property_occupancy)::numeric, 4),
             'occupancyStdDev',    ROUND(STDDEV(ho.property_occupancy)::numeric, 4),
             'avgRent',            ROUND(AVG(ho.property_avg_rent)::numeric, 2),
             'rentStdDev',         ROUND(STDDEV(ho.property_avg_rent)::numeric, 2),
             'avgConcession',      ROUND(AVG(ho.property_concession_per_unit)::numeric, 2),
             'concessionStdDev',   ROUND(STDDEV(ho.property_concession_per_unit)::numeric, 2),
             'avgUnitCount',       ROUND(AVG(ho.property_unit_count)::numeric, 0),
             'minYearBuilt',       MIN(ho.property_year_built),
             'maxYearBuilt',       MAX(ho.property_year_built),
             'medianYearBuilt',    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ho.property_year_built)
           ) AS metrics
         FROM cohort_membership cm
         JOIN historical_observations ho
           ON ho.parcel_id = cm.parcel_id AND ho.geography_level = 'parcel'
         GROUP BY cm.cohort_id
       ) agg
       WHERE c.id = agg.cohort_id`,
    );

    await client.query('COMMIT');

    logger.info('[cohorts/backfill] Complete', {
      cohortCount: cohortKeyMap.size,
      memberCount,
      missingDimCount: missing.length,
    });

    return res.json({
      success: true,
      cohortCount: cohortKeyMap.size,
      memberCount,
      missingDimensionCount: missing.length,
      missingDimensionSample: missing.slice(0, 10),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[cohorts/backfill] Failed', { error: msg });
    return res.status(500).json({ success: false, error: msg });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cohorts/query
// Optional filters: product_type, asset_class, market (ILIKE), vintage, size_range
// Returns all matching cohorts + their member list with current metrics.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const pool = getPool();
  const {
    product_type,
    asset_class,
    market,
    vintage,
    size_range,
  } = req.query as Record<string, string | undefined>;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (product_type) { conditions.push(`c.product_type = $${p++}`); params.push(product_type); }
    if (asset_class)  { conditions.push(`c.asset_class  = $${p++}`); params.push(asset_class);  }
    if (market)       { conditions.push(`c.market ILIKE $${p++}`);   params.push(`%${market}%`); }
    if (vintage)      { conditions.push(`c.vintage      = $${p++}`); params.push(vintage);      }
    if (size_range)   { conditions.push(`c.size_range   = $${p++}`); params.push(size_range);   }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const cohortRows = await pool.query(
      `SELECT id, product_type, asset_class, market, vintage, size_range,
              member_count, aggregated_metrics, created_at, updated_at
       FROM cohorts c
       ${where}
       ORDER BY member_count DESC, market, asset_class, product_type`,
      params,
    );

    if (cohortRows.rows.length === 0) {
      return res.json({ cohorts: [], members: [], totalMembers: 0 });
    }

    const cohortIds = cohortRows.rows.map((r) => r.id as string);

    // Load members for all matching cohorts
    const memberRows = await pool.query(
      `SELECT
         cm.cohort_id,
         cm.parcel_id,
         pd.property_name,
         pd.address,
         pd.asset_class,
         pd.property_type,
         pd.msa,
         pd.year_built,
         pd.unit_count,
         latest.property_occupancy AS current_occupancy,
         latest.property_avg_rent  AS current_avg_rent,
         latest.observation_date   AS metrics_date
       FROM cohort_membership cm
       LEFT JOIN property_descriptions pd ON pd.parcel_id = cm.parcel_id
       LEFT JOIN LATERAL (
         SELECT property_occupancy, property_avg_rent, observation_date
         FROM historical_observations
         WHERE parcel_id = cm.parcel_id AND geography_level = 'parcel'
           AND (property_occupancy IS NOT NULL OR property_avg_rent IS NOT NULL)
         ORDER BY observation_date DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE cm.cohort_id = ANY($1)
       ORDER BY cm.cohort_id, cm.parcel_id`,
      [cohortIds],
    );

    // Load occupancy time series per member for sparklines (last 12 obs)
    const sparkRows = await pool.query(
      `SELECT parcel_id, observation_date, property_occupancy
       FROM historical_observations
       WHERE parcel_id = ANY(
         SELECT parcel_id FROM cohort_membership WHERE cohort_id = ANY($1)
       )
       AND geography_level = 'parcel'
       AND property_occupancy IS NOT NULL
       ORDER BY parcel_id, observation_date ASC`,
      [cohortIds],
    );

    const sparkByParcel: Record<string, Array<{ date: string; value: number }>> = {};
    for (const r of sparkRows.rows) {
      const pid = r.parcel_id as string;
      if (!sparkByParcel[pid]) sparkByParcel[pid] = [];
      sparkByParcel[pid].push({
        date: String(r.observation_date).slice(0, 10),
        value: parseFloat(r.property_occupancy),
      });
    }

    const cohorts = cohortRows.rows.map((r) => ({
      id: r.id,
      productType: r.product_type,
      assetClass: r.asset_class,
      market: r.market,
      vintage: r.vintage,
      sizeRange: r.size_range,
      memberCount: r.member_count,
      aggregatedMetrics: r.aggregated_metrics ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const members = memberRows.rows.map((r) => ({
      cohortId: r.cohort_id,
      parcelId: r.parcel_id,
      propertyDescription: {
        name:        lvStr(r.property_name),
        address:     lvStr(r.address),
        assetClass:  lvStr(r.asset_class),
        propertyType: lvStr(r.property_type),
        market:      lvStr(r.msa),
        yearBuilt:   lvNum(r.year_built),
        unitCount:   lvNum(r.unit_count),
      },
      currentMetrics: {
        occupancy: r.current_occupancy !== null ? parseFloat(r.current_occupancy) : null,
        avgRent:   r.current_avg_rent  !== null ? parseFloat(r.current_avg_rent)  : null,
        metricsDate: r.metrics_date ? String(r.metrics_date).slice(0, 10) : null,
      },
      occupancySparkline: sparkByParcel[r.parcel_id as string] ?? [],
    }));

    return res.json({ cohorts, members, totalMembers: members.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[cohorts/query] Failed', { error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cohorts/dimensions
// Returns distinct values for each dimension — used to populate filter dropdowns.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dimensions', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         array_agg(DISTINCT product_type ORDER BY product_type) FILTER (WHERE product_type IS NOT NULL) AS product_types,
         array_agg(DISTINCT asset_class  ORDER BY asset_class)  FILTER (WHERE asset_class  IS NOT NULL) AS asset_classes,
         array_agg(DISTINCT market       ORDER BY market)       FILTER (WHERE market       IS NOT NULL) AS markets,
         array_agg(DISTINCT vintage      ORDER BY vintage)      FILTER (WHERE vintage      IS NOT NULL) AS vintages,
         array_agg(DISTINCT size_range   ORDER BY size_range)   FILTER (WHERE size_range   IS NOT NULL) AS size_ranges
       FROM cohorts`,
    );
    const r = result.rows[0];
    return res.json({
      productTypes: r.product_types ?? [],
      assetClasses: r.asset_classes ?? [],
      markets:      r.markets       ?? [],
      vintages:     r.vintages      ?? [],
      sizeRanges:   r.size_ranges   ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
