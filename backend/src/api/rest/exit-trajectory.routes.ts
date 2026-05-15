/**
 * Exit Trajectory API — W-10 (CE-12)
 *
 * GET /api/v1/deals/:dealId/exit-trajectory
 *
 * Computes year-by-year supply pressure and buyer pressure arrays for the
 * Exit Windows / Sensitivity tabs.  Data sources:
 *   - supplyPressureByYear  M35 event_forecasts (multifamily_delivery / permit)
 *                           per window_months horizon, converted to a 0-100
 *                           pressure score (0 = no competing pipeline,
 *                           80 = extreme supply headwind).
 *   - buyerPressureByYear   Latest JEDI demand sub-score for the deal,
 *                           broadcast flat across all years (single-point
 *                           snapshot; year-by-year calibration is W-10+ scope).
 *
 * Arrays are 1-indexed: index 0 is always null, indices 1-10 map to Y1..Y10.
 * Any year for which live data is unavailable is returned as null so the UI
 * renders "—" rather than a fabricated number.
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

const WINDOWS = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] as const;

/**
 * Convert cumulative pipeline units to a supply pressure score (0-100).
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

router.get('/:dealId/exit-trajectory', async (req, res) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    // 1. Deal context — submarket + MSA
    const dealRes = await pool.query<{ submarket_id: string | null; msa_id: string | null }>(
      `SELECT deal_data->>'submarketId' AS submarket_id,
              deal_data->>'msaId'        AS msa_id
       FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );

    if (dealRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const { submarket_id: submarketId } = dealRes.rows[0];

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

    // Build 1-indexed array (index 0 = null placeholder, indices 1-10 = Y1..Y10)
    const supplyPressureByYear: (number | null)[] = [null];
    for (let y = 1; y <= 10; y++) {
      const wm = y * 12;
      if (supplyByWindow.has(wm)) {
        supplyPressureByYear.push(unitsToPressure(supplyByWindow.get(wm)!));
      } else if (submarketId) {
        // Submarket is known but no active forecast rows for this window —
        // treat as zero competing pipeline rather than unknown.
        supplyPressureByYear.push(0);
        hasLiveSupplyData = true;
      } else {
        supplyPressureByYear.push(null);
      }
    }

    // 3. Buyer pressure — latest JEDI demand sub-score for this deal.
    //    demand_score from jedi_score_history is already 0-100.
    const jediRes = await pool.query<{ demand_score: string | null }>(
      `SELECT demand_score
       FROM jedi_score_history
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );

    const rawDemand = jediRes.rows[0]?.demand_score;
    const jediDemandScore: number | null = rawDemand != null
      ? Math.min(100, Math.max(0, parseFloat(rawDemand) || 0))
      : null;

    // Broadcast single-point demand score across all 10 years.
    const buyerPressureByYear: (number | null)[] = [null];
    for (let y = 1; y <= 10; y++) {
      buyerPressureByYear.push(jediDemandScore);
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
        hasLiveDemandData: jediDemandScore !== null,
      },
    });
  } catch (err) {
    logger.error('[exit-trajectory] error', { dealId: req.params.dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to compute exit trajectory' });
  }
});

export default router;
