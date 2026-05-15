/**
 * Exit Trajectory API — W-10 (CE-12)
 *
 * GET /api/v1/deals/:dealId/exit-trajectory
 *
 * Computes year-by-year supply pressure and buyer pressure arrays for the
 * Exit Windows / Sensitivity tabs.  Data sources:
 *
 *   supplyPressureByYear  M35 event_forecasts (multifamily_delivery/permit)
 *                         per window_months horizon, tier-scored 0-100, then
 *                         blended with the M07 supply-side signal from
 *                         m35TrafficApiService.computeEventPipelineSignal().
 *                         Positive M07 signal (demand catalysts absorb supply)
 *                         reduces effective pressure; negative increases it.
 *
 *   buyerPressureByYear   jedi_score_history.position_score — the M07-derived
 *                         field built by calculateTrafficContributionToJEDI()
 *                         from T-01 walk-in volume, T-04 correlation signal,
 *                         T-07 8-week trajectory, T-09 competitive share.
 *                         Broadcast flat across all years (per-year M07
 *                         calibration is post-W-10 scope).
 *
 *   m07SupplySignal       Raw -1..+1 output from computeEventPipelineSignal
 *                         for transparency and downstream consumers.
 *
 * Arrays are 1-indexed: index 0 is always null, indices 1-10 map to Y1..Y10.
 * Any year for which live data is unavailable is returned as null so the UI
 * renders "—" rather than a fabricated number.
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { m35TrafficApiService } from '../../services/m35-traffic-api.service';

const router = Router();

const WINDOWS = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] as const;

/**
 * Convert cumulative pipeline units to a base supply pressure score (0-100).
 * Mirrors the W-05 tier table from jedi-score.service.ts, inverted so that
 * more pipeline = higher pressure (worse for an exit).
 */
function unitsToPressure(units: number): number {
  if (units <= 0)    return 0;
  if (units < 200)   return 15;
  if (units < 500)   return 35;
  if (units < 1000)  return 55;
  if (units < 2000)  return 70;
  return 80;
}

/**
 * Apply M07 supply-side pipeline signal to a base pressure score.
 * m07Signal is -1..+1:
 *   +1 (strong demand absorption)  → reduce pressure by up to 15 pts
 *   -1 (supply suppressors active) → increase pressure by up to 15 pts
 */
function applyM07Adjustment(basePressure: number, m07Signal: number): number {
  const adjustment = -Math.round(m07Signal * 15);
  return Math.max(0, Math.min(100, basePressure + adjustment));
}

router.get('/:dealId/exit-trajectory', async (req, res) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    // 1. Deal context — submarket, MSA, and coordinates for M07 signal
    const dealRes = await pool.query<{
      submarket_id: string | null;
      msa_id: string | null;
      lat: string | null;
      lng: string | null;
    }>(
      `SELECT deal_data->>'submarketId'          AS submarket_id,
              deal_data->>'msaId'                AS msa_id,
              deal_data->'coordinates'->>'lat'   AS lat,
              deal_data->'coordinates'->>'lng'   AS lng
       FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );

    if (dealRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const { submarket_id: submarketId, lat, lng } = dealRes.rows[0];

    // 2. M35 supply per window_months horizon (W-05 canonical query)
    const supplyByWindow = new Map<number, number>();
    let hasLiveSupplyData = false;

    if (submarketId) {
      const supplyRes = await pool.query<{ window_months: string; units: string }>(
        `SELECT ef.window_months,
                COALESCE(SUM(ef.point_estimate), 0) AS units
         FROM event_forecasts ef
         JOIN key_events ke ON ke.id = ef.event_id
         WHERE ke.subtype IN ('multifamily_delivery', 'multifamily_permit')
           AND ke.submarket_id = $1
           AND ef.metric_key IN ('deliveries', 'permits_issued', 'net_absorption_units')
           AND ef.status = 'active'
           AND ef.window_months = ANY($2)
         GROUP BY ef.window_months
         ORDER BY ef.window_months`,
        [submarketId, WINDOWS]
      );

      for (const row of supplyRes.rows) {
        const wm = parseInt(row.window_months, 10);
        supplyByWindow.set(wm, parseFloat(row.units) || 0);
        hasLiveSupplyData = true;
      }
    }

    // 3. M07 supply-side signal — computeEventPipelineSignal
    //    Returns -1..+1: positive = demand catalysts absorb competing supply;
    //    negative = supply suppressors active (disasters, closures).
    //    Used to modulate the M35-derived base pressure per year.
    let m07SupplySignal: number | null = null;
    const parsedLat = lat ? parseFloat(lat) : NaN;
    const parsedLng = lng ? parseFloat(lng) : NaN;

    if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat !== 0 && parsedLng !== 0) {
      try {
        m07SupplySignal = await m35TrafficApiService.computeEventPipelineSignal(
          { lat: parsedLat, lng: parsedLng },
          18,
        );
      } catch (err) {
        logger.warn('[exit-trajectory] M07 computeEventPipelineSignal unavailable', {
          dealId,
          err: (err as Error).message,
        });
      }
    }

    // 4. Build 1-indexed supply pressure array (index 0 = null, indices 1-10 = Y1..Y10)
    //    Apply M07 adjustment when signal is available.
    const supplyPressureByYear: (number | null)[] = [null];
    for (let y = 1; y <= 10; y++) {
      const wm = y * 12;
      if (supplyByWindow.has(wm)) {
        const base = unitsToPressure(supplyByWindow.get(wm)!);
        const adjusted = m07SupplySignal != null
          ? applyM07Adjustment(base, m07SupplySignal)
          : base;
        supplyPressureByYear.push(adjusted);
      } else if (submarketId) {
        // Submarket known but no active forecast rows for this window —
        // treat as zero competing pipeline rather than unknown.
        const adjusted = m07SupplySignal != null
          ? applyM07Adjustment(0, m07SupplySignal)
          : 0;
        supplyPressureByYear.push(adjusted);
        hasLiveSupplyData = true;
      } else {
        supplyPressureByYear.push(null);
      }
    }

    // 5. Buyer pressure — M07-derived position_score from jedi_score_history.
    //    position_score is built by calculateTrafficContributionToJEDI() from:
    //      T-01 walk-in volume → positionAdj ±5
    //      T-04 correlation signal (HIDDEN_GEM/VALIDATED/HYPE_CHECK/DEAD_ZONE) → ±5
    //      T-07 8-week trajectory trend → ±2
    //      T-09 competitive share → ±1
    //    Clamped to [-10, +10] then persisted as position_score (0-100 JEDI scale).
    const jediRes = await pool.query<{ position_score: string | null }>(
      `SELECT position_score
       FROM jedi_score_history
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );

    const rawPosition = jediRes.rows[0]?.position_score;
    const jediPositionScore: number | null = rawPosition != null
      ? Math.min(100, Math.max(0, parseFloat(rawPosition) || 0))
      : null;

    // Broadcast single-point M07 position score across all 10 years.
    // Year-by-year M07 calibration (demand trajectory per window) is post-W-10 scope.
    const buyerPressureByYear: (number | null)[] = [null];
    for (let y = 1; y <= 10; y++) {
      buyerPressureByYear.push(jediPositionScore);
    }

    return res.json({
      success: true,
      dealId,
      computedAt: new Date().toISOString(),
      supplyPressureByYear,
      buyerPressureByYear,
      metadata: {
        submarketId: submarketId ?? null,
        hasLiveSupplyData,
        hasLiveM07Data: jediPositionScore !== null,
        m07SupplySignal,
        m07SupplySignalApplied: m07SupplySignal !== null,
      },
    });
  } catch (err) {
    logger.error('[exit-trajectory] error', { dealId: req.params.dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to compute exit trajectory' });
  }
});

export default router;
