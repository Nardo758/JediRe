/**
 * DQ Score Recalculator — Phase 8
 *
 * Server-side data quality scoring that reads from BOTH data_library_assets
 * (core fields, 100 pts base) and property_descriptions (Phase 8 enrichment
 * fields, 30 pts new) and normalises to 0–100.
 *
 * Formula: raw_points / 130 * 100, rounded to integer.
 *
 * Called after enrichment completes to update data_library_assets.data_quality_score.
 */

import { query as dbQuery } from '../../database/connection';
import { logger } from '../../utils/logger';

function safeFloat(v: unknown): number | null {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? null : n;
}

function resolved<T>(lv: unknown): T | null {
  if (!lv || typeof lv !== 'object') return null;
  return (lv as Record<string, unknown>).resolved as T ?? null;
}

export async function recalculateDQScore(assetId: string): Promise<number> {
  const [dlaRow, pdRow] = await Promise.all([
    dbQuery<Record<string, unknown>>(
      `SELECT property_name, city, state, property_type, asset_class, unit_count,
              year_built, avg_rent, occupancy_rate, cap_rate, noi,
              asking_price, sale_price, deal_type, data_quality_score
       FROM data_library_assets WHERE id = $1`,
      [assetId],
    ).then(r => r.rows[0] ?? null),

    dbQuery<Record<string, unknown>>(
      `SELECT narrative, photos, reviews, sentiment_summary, recent_events,
              regulatory_constraints, has_pool, has_fitness, has_clubhouse,
              has_concierge, has_business_center, has_dog_park
       FROM property_descriptions WHERE parcel_id = (
         SELECT property_name FROM data_library_assets WHERE id = $1 LIMIT 1
       )`,
      [assetId],
    ).then(r => r.rows[0] ?? null),
  ]);

  if (!dlaRow) {
    logger.warn('[dq-recalculator] asset not found', { assetId });
    return 0;
  }

  let raw = 0;

  // ── Base fields from data_library_assets (max 100 pts) ───────────────────────

  if (dlaRow.city && dlaRow.state) raw += 10;
  if (dlaRow.property_type) raw += 10;
  if (dlaRow.asset_class) raw += 10;
  if (dlaRow.unit_count) raw += 10;
  if (dlaRow.year_built) raw += 10;
  if (safeFloat(dlaRow.avg_rent) != null) raw += 10;
  if (safeFloat(dlaRow.occupancy_rate) != null) raw += 10;
  if (safeFloat(dlaRow.cap_rate) != null || safeFloat(dlaRow.noi) != null) raw += 10;
  if (safeFloat(dlaRow.asking_price) != null || safeFloat(dlaRow.sale_price) != null) raw += 10;
  if (dlaRow.deal_type) raw += 10;

  // ── Phase 8 fields from property_descriptions (max 30 pts) ───────────────────

  if (pdRow) {
    if (resolved<string>(pdRow.narrative)) raw += 5;

    const hasAnyAmenity = [
      pdRow.has_pool, pdRow.has_fitness, pdRow.has_clubhouse,
      pdRow.has_concierge, pdRow.has_business_center, pdRow.has_dog_park,
    ].some(flag => resolved<boolean>(flag) === true);
    if (hasAnyAmenity) raw += 5;

    const photos = resolved<unknown[]>(pdRow.photos);
    if (photos && photos.length > 0) raw += 3;

    const reviews = resolved<unknown[]>(pdRow.reviews);
    if (reviews && reviews.length > 0) raw += 5;

    if (resolved<unknown>(pdRow.sentiment_summary)) raw += 3;

    const events = resolved<unknown[]>(pdRow.recent_events);
    if (events && events.length > 0) raw += 2;

    const rc = pdRow.regulatory_constraints as Record<string, unknown> | null;
    if (rc?.zone_code != null || rc?.jurisdiction != null) raw += 7;
  }

  const score = Math.min(100, Math.round((raw / 130) * 100));

  await dbQuery(
    `UPDATE data_library_assets SET data_quality_score = $1, updated_at = NOW() WHERE id = $2`,
    [score, assetId],
  );

  logger.debug('[dq-recalculator] score updated', { assetId, raw, score });
  return score;
}
