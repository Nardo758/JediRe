/**
 * Deal Market Events Routes — M35 Annotation Layer (P2-2)
 *
 * GET /:dealId/market-events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Multi-strategy geo join in precedence order:
 *   1. submarket_id  — properties.submarket_id (via property_id)
 *   2. PostGIS proximity — deal lat/lng or property lat/lng (1-mile radius)
 *   3. msa slug      — deal_data->>'msaId' or properties.msa_id
 *   4. city slug     — deals.city or properties.city
 *
 * Returns:
 *   { events: [{id, date, label, subtype, magnitude}], strategy: '<which>' }
 *   { events: [], reason: 'no_geography_resolved' }
 *
 * No writes. No fallback that widens beyond the first strategy that resolves.
 */

import { Router, Response } from 'express';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middleware/auth';

const router = Router({ mergeParams: true });

interface MarketEventRow {
  id: string;
  event_name: string;
  event_type: string;
  effective_date: string | null;
  announced_date: string | null;
  expected_impact_magnitude: string | null;
  geography_id: string;
  geography_type: string;
}

interface DealGeoRow {
  property_id: string | null;
  submarket_id: string | null;
  lat: number | null;
  lng: number | null;
  msa_id: string | null;
  city: string | null;
  deal_city: string | null;
  deal_latitude: number | null;
  deal_longitude: number | null;
  deal_msa_id: string | null;
}

router.get('/:dealId/market-events', async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Deal not found or access denied' });
    }

    // Resolve geography from deal + joined property
    const geoRes = await pool.query<DealGeoRow>(
      `SELECT
         d.property_id,
         p.submarket_id,
         p.lat,
         p.lng,
         p.msa_id,
         p.city,
         d.city         AS deal_city,
         d.latitude     AS deal_latitude,
         d.longitude    AS deal_longitude,
         d.deal_data->>'msaId' AS deal_msa_id
       FROM deals d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );

    if (geoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const geo = geoRes.rows[0];
    const effectiveLat = geo.lat ?? geo.deal_latitude;
    const effectiveLng = geo.lng ?? geo.deal_longitude;
    const effectiveMsa = geo.msa_id ?? geo.deal_msa_id;
    const effectiveCity = geo.city ?? geo.deal_city;
    const submarketId = geo.submarket_id;

    // Date range filter clause
    const dateFilter = from && to
      ? `AND COALESCE(me.effective_date, me.announced_date) BETWEEN $DATE_FROM AND $DATE_TO`
      : from
      ? `AND COALESCE(me.effective_date, me.announced_date) >= $DATE_FROM`
      : to
      ? `AND COALESCE(me.effective_date, me.announced_date) <= $DATE_TO`
      : '';

    function buildParams(baseParams: unknown[], dateFrom?: string, dateTo?: string): unknown[] {
      const p = [...baseParams];
      if (dateFrom) p.push(dateFrom);
      if (dateTo) p.push(dateTo);
      return p;
    }

    function injectDateFilter(sql: string, startParamIdx: number): string {
      let result = sql;
      if (from) result = result.replace('$DATE_FROM', `$${startParamIdx++}`);
      if (to) result = result.replace('$DATE_TO', `$${startParamIdx++}`);
      return result;
    }

    const selectCols = `
      me.id,
      me.event_name,
      me.event_type,
      me.effective_date,
      me.announced_date,
      me.expected_impact_magnitude
    `;

    // ── Strategy 1: submarket_id ─────────────────────────────────────────────
    if (submarketId) {
      const sql = injectDateFilter(
        `SELECT ${selectCols} FROM market_events me
         WHERE me.geography_type = 'submarket'
           AND LOWER(me.geography_id) = LOWER($1)
           ${dateFilter}
         ORDER BY COALESCE(me.effective_date, me.announced_date)`,
        2
      );
      const rows = await pool.query<MarketEventRow>(sql, buildParams([submarketId], from, to));
      if (rows.rows.length > 0) {
        return res.json({ events: formatEvents(rows.rows), strategy: 'submarket' });
      }
    }

    // ── Strategy 2: PostGIS proximity (1-mile radius) ───────────────────────
    if (effectiveLat != null && effectiveLng != null) {
      const sql = injectDateFilter(
        `SELECT ${selectCols}
         FROM market_events me
         WHERE me.latitude IS NOT NULL AND me.longitude IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(me.longitude, me.latitude), 4326)::geography,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             1609.34
           )
           ${dateFilter}
         ORDER BY COALESCE(me.effective_date, me.announced_date)`,
        3
      );
      const rows = await pool.query<MarketEventRow>(sql, buildParams([effectiveLng, effectiveLat], from, to));
      if (rows.rows.length > 0) {
        return res.json({ events: formatEvents(rows.rows), strategy: 'proximity' });
      }
    }

    // ── Strategy 3: MSA slug ─────────────────────────────────────────────────
    if (effectiveMsa) {
      const sql = injectDateFilter(
        `SELECT ${selectCols} FROM market_events me
         WHERE me.geography_type = 'msa'
           AND LOWER(me.geography_id) = LOWER($1)
           ${dateFilter}
         ORDER BY COALESCE(me.effective_date, me.announced_date)`,
        2
      );
      const rows = await pool.query<MarketEventRow>(sql, buildParams([effectiveMsa], from, to));
      if (rows.rows.length > 0) {
        return res.json({ events: formatEvents(rows.rows), strategy: 'msa' });
      }
    }

    // ── Strategy 4: city slug ────────────────────────────────────────────────
    if (effectiveCity) {
      const sql = injectDateFilter(
        `SELECT ${selectCols} FROM market_events me
         WHERE LOWER(me.geography_id) = LOWER($1)
           ${dateFilter}
         ORDER BY COALESCE(me.effective_date, me.announced_date)`,
        2
      );
      const rows = await pool.query<MarketEventRow>(sql, buildParams([effectiveCity], from, to));
      if (rows.rows.length > 0) {
        return res.json({ events: formatEvents(rows.rows), strategy: 'city' });
      }
    }

    // No strategy resolved
    return res.json({ events: [], reason: 'no_geography_resolved' });
  } catch (err: any) {
    logger.error('deal-market-events: failed', { dealId, error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to fetch market events' });
  }
});

function formatEvents(rows: MarketEventRow[]) {
  return rows.map(r => ({
    id: r.id,
    date: r.effective_date ?? r.announced_date,
    label: r.event_name,
    subtype: r.event_type,
    ...(r.expected_impact_magnitude ? { magnitude: r.expected_impact_magnitude } : {}),
  }));
}

export default router;
