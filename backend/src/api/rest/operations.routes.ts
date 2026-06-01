/**
 * Operations Intelligence API Routes
 * 
 * Revenue management, variance analysis, and recommendations
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import {
  computeVarianceAnalysis,
  analyzeLeaseExpirations,
  analyzeTrafficPerformance,
  generateOperationsRecommendations,
  getOperationsSummary,
  feedOperationsToLearning,
} from '../../services/revenue-management.service';
import { query, getClient } from '../../database/connection';
import { logger } from '../../utils/logger';
import { CommentaryAgent } from '../../agents/commentary.agent';
import type { StrategySignalInputs } from '../../services/module-wiring/strategy-arbitrage-engine';

const router = Router();

// ─── Operations Summary ───────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/summary
 * Get comprehensive operations summary with health score
 */
router.get('/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    // Verify deal ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const summary = await getOperationsSummary(dealId);

    // Augment with latest occupancy, rent, and collections — include legacy null-deal_id rows
    const summPropRes = await query(
      `SELECT property_id FROM deals WHERE id = $1 LIMIT 1`, [dealId]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const summPropertyId = summPropRes.rows[0]?.property_id as string | null;

    const latestActualsRes = summPropertyId
      ? await query(
          `SELECT
             occupancy_rate,
             avg_effective_rent,
             noi,
             effective_gross_income,
             management_fee_pct
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
             AND occupancy_rate IS NOT NULL
           ORDER BY report_month DESC
           LIMIT 1`,
          [summPropertyId]
        )
      : await query(
          `SELECT
             occupancy_rate,
             avg_effective_rent,
             noi,
             effective_gross_income,
             management_fee_pct
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
             AND occupancy_rate IS NOT NULL
           ORDER BY report_month DESC
           LIMIT 1`,
          [dealId]
        );
    const latest = latestActualsRes.rows[0] as Record<string, unknown> | undefined;
    const latestOccupancy: number | null = latest?.occupancy_rate != null ? Number(latest.occupancy_rate) * 100 : null;
    const latestNOI: number | null = latest?.noi != null ? Number(latest.noi) : null;
    const latestRent: number | null = latest?.avg_effective_rent != null ? Number(latest.avg_effective_rent) : null;
    const collectionsRate: number | null =
      latest?.effective_gross_income != null && Number(latest.effective_gross_income) > 0 && latest.noi != null
        ? (Number(latest.noi) / Number(latest.effective_gross_income)) * 100
        : null;

    res.json({
      success: true,
      ...summary,
      latestMetrics: {
        occupancyPct: latestOccupancy,
        noi:          latestNOI,
        avgRent:      latestRent,
        collectionsRate,
      },
    });
  } catch (err) {
    logger.error('Operations summary error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get operations summary' 
    });
  }
});

// ─── Variance Analysis ────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/variances
 * Get variance analysis for current period
 */
router.get('/:dealId/variances', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period } = req.query;
    const periodStart = period ? new Date(period as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const result = await query(`
      SELECT * FROM variance_analysis
      WHERE deal_id = $1 AND period_start = $2
      ORDER BY ABS(noi_impact) DESC
    `, [req.params.dealId, periodStart.toISOString().slice(0, 10)]);
    
    res.json({ success: true, variances: result.rows });
  } catch (err) {
    logger.error('Variance analysis error:', err);
    res.status(500).json({ success: false, error: 'Failed to get variances' });
  }
});

/**
 * POST /api/v1/operations/:dealId/variances/compute
 * Compute variance analysis for a period
 */
router.post('/:dealId/variances/compute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period } = req.body;
    const periodStart = period ? new Date(period) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const variances = await computeVarianceAnalysis(req.params.dealId, periodStart);
    res.json({ success: true, variances, count: variances.length });
  } catch (err) {
    logger.error('Compute variance error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute variances' });
  }
});

// ─── Projections & Actuals ────────────────────────────────────────────

/**
 * POST /api/v1/operations/:dealId/projections
 * Import proforma projections
 */
router.post('/:dealId/projections', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projections } = req.body; // Array of monthly projections
    
    if (!Array.isArray(projections)) {
      return res.status(400).json({ success: false, error: 'projections array required' });
    }
    
    const client = await getClient();
    let imported = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const p of projections) {
        await client.query(`
          INSERT INTO proforma_projections (
            deal_id, period_type, period_start, period_end, year_number,
            gross_potential_rent, loss_to_lease, vacancy_loss, concessions, bad_debt, other_income, effective_gross_income,
            payroll, management_fee, utilities_total, repairs_maintenance, make_ready, insurance, real_estate_taxes, total_operating_expenses,
            net_operating_income, replacement_reserves,
            units, avg_rent_per_unit, opex_per_unit, noi_per_unit,
            projected_occupancy_pct
          ) VALUES (
            $1, 'monthly', $2, $2 + INTERVAL '1 month', $3,
            $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20,
            $21, $22, $23, $24,
            $25
          )
          ON CONFLICT (deal_id, period_type, period_start) DO UPDATE SET
            gross_potential_rent = EXCLUDED.gross_potential_rent,
            effective_gross_income = EXCLUDED.effective_gross_income,
            total_operating_expenses = EXCLUDED.total_operating_expenses,
            net_operating_income = EXCLUDED.net_operating_income
        `, [
          req.params.dealId, p.period_start, p.year_number ?? 1,
          p.gross_potential_rent, p.loss_to_lease, p.vacancy_loss, p.concessions, p.bad_debt, p.other_income, p.effective_gross_income,
          p.payroll, p.management_fee, p.utilities_total, p.repairs_maintenance, p.make_ready, p.insurance, p.real_estate_taxes, p.total_operating_expenses,
          p.net_operating_income, p.replacement_reserves,
          p.units, p.avg_rent_per_unit, p.opex_per_unit, p.noi_per_unit,
          p.projected_occupancy_pct,
        ]);
        imported++;
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    res.json({ success: true, imported });
  } catch (err) {
    logger.error('Import projections error:', err);
    res.status(500).json({ success: false, error: 'Failed to import projections' });
  }
});

/**
 * POST /api/v1/operations/:dealId/actuals
 * Import actual performance data
 */
router.post('/:dealId/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actuals } = req.body;
    
    if (!Array.isArray(actuals)) {
      return res.status(400).json({ success: false, error: 'actuals array required' });
    }
    
    const client = await getClient();
    let imported = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const a of actuals) {
        await client.query(`
          INSERT INTO operations_actuals (
            deal_id, period_type, period_start, period_end,
            gross_potential_rent, loss_to_lease, vacancy_loss, concessions, bad_debt, other_income, effective_gross_income,
            payroll, management_fee, utilities_total, repairs_maintenance, make_ready, insurance, real_estate_taxes, total_operating_expenses,
            net_operating_income, replacement_reserves,
            units_occupied, avg_rent_achieved,
            physical_occupancy_pct, economic_occupancy_pct,
            collections_rate, delinquency_rate,
            source
          ) VALUES (
            $1, 'monthly', $2, $2 + INTERVAL '1 month',
            $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19,
            $20, $21,
            $22, $23,
            $24, $25,
            $26
          )
          ON CONFLICT (deal_id, period_type, period_start) DO UPDATE SET
            gross_potential_rent = EXCLUDED.gross_potential_rent,
            effective_gross_income = EXCLUDED.effective_gross_income,
            total_operating_expenses = EXCLUDED.total_operating_expenses,
            net_operating_income = EXCLUDED.net_operating_income,
            physical_occupancy_pct = EXCLUDED.physical_occupancy_pct,
            imported_at = NOW()
        `, [
          req.params.dealId, a.period_start,
          a.gross_potential_rent, a.loss_to_lease, a.vacancy_loss, a.concessions, a.bad_debt, a.other_income, a.effective_gross_income,
          a.payroll, a.management_fee, a.utilities_total, a.repairs_maintenance, a.make_ready, a.insurance, a.real_estate_taxes, a.total_operating_expenses,
          a.net_operating_income, a.replacement_reserves,
          a.units_occupied, a.avg_rent_achieved,
          a.physical_occupancy_pct, a.economic_occupancy_pct,
          a.collections_rate, a.delinquency_rate,
          a.source ?? 'manual',
        ]);
        imported++;
      }
      
      await client.query('COMMIT');
      
      // Auto-compute variances after import
      for (const a of actuals) {
        await computeVarianceAnalysis(req.params.dealId, new Date(a.period_start));
      }
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    res.json({ success: true, imported });
  } catch (err) {
    logger.error('Import actuals error:', err);
    res.status(500).json({ success: false, error: 'Failed to import actuals' });
  }
});

// ─── Lease Expirations ────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/lease-expirations
 * Get lease expiration analysis with recommendations
 */
router.get('/:dealId/lease-expirations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { months = '6' } = req.query;
    const analysis = await analyzeLeaseExpirations(req.params.dealId, parseInt(months as string, 10));
    res.json({ success: true, expirations: analysis });
  } catch (err) {
    logger.error('Lease expiration error:', err);
    res.status(500).json({ success: false, error: 'Failed to analyze lease expirations' });
  }
});

/**
 * POST /api/v1/operations/:dealId/rent-roll
 * Import rent roll snapshot
 */
router.post('/:dealId/rent-roll', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { units, asOfDate } = req.body;
    
    if (!Array.isArray(units)) {
      return res.status(400).json({ success: false, error: 'units array required' });
    }
    
    const client = await getClient();
    let imported = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const u of units) {
        await client.query(`
          INSERT INTO rent_roll_units (
            deal_id, unit_number, unit_type, sqft, floor_plan, building, floor,
            resident_id, resident_name, lease_start, lease_end, lease_term_months,
            market_rent, current_rent, status, days_vacant,
            move_in_date, move_out_date, notice_date,
            renewal_offered, renewal_offer_rent, renewal_status,
            concession_amount, concession_type,
            current_balance, delinquent_days,
            as_of_date
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19,
            $20, $21, $22,
            $23, $24,
            $25, $26,
            $27
          )
          ON CONFLICT (deal_id, unit_number, as_of_date) DO UPDATE SET
            current_rent = EXCLUDED.current_rent,
            market_rent = EXCLUDED.market_rent,
            status = EXCLUDED.status,
            lease_end = EXCLUDED.lease_end,
            renewal_status = EXCLUDED.renewal_status,
            current_balance = EXCLUDED.current_balance
        `, [
          req.params.dealId, u.unit_number, u.unit_type, u.sqft, u.floor_plan, u.building, u.floor,
          u.resident_id, u.resident_name, u.lease_start, u.lease_end, u.lease_term_months,
          u.market_rent, u.current_rent, u.status, u.days_vacant,
          u.move_in_date, u.move_out_date, u.notice_date,
          u.renewal_offered, u.renewal_offer_rent, u.renewal_status,
          u.concession_amount, u.concession_type,
          u.current_balance, u.delinquent_days,
          asOfDate ?? new Date().toISOString().slice(0, 10),
        ]);
        imported++;
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    res.json({ success: true, imported });
  } catch (err) {
    logger.error('Import rent roll error:', err);
    res.status(500).json({ success: false, error: 'Failed to import rent roll' });
  }
});

/**
 * GET /api/v1/operations/:dealId/rent-roll
 * Retrieve latest rent roll snapshot
 */
router.get('/:dealId/rent-roll', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const result = await query(
      `SELECT * FROM rent_roll_units WHERE deal_id = $1 ORDER BY as_of_date DESC, unit_number LIMIT 500`,
      [dealId]
    );
    const asDates = [...new Set(result.rows.map((r: any) => r.as_of_date?.slice?.(0, 10)).filter(Boolean))];
    res.json({ success: true, units: result.rows, snapshots: asDates });
  } catch (err) {
    logger.error('Get rent roll error:', err);
    res.status(500).json({ success: false, error: 'Failed to get rent roll' });
  }
});

/**
 * GET /api/v1/operations/:dealId/other-income
 * Retrieve other income history
 */
router.get('/:dealId/other-income', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const result = await query(
      `SELECT * FROM other_income_tracking WHERE deal_id = $1 ORDER BY period_start DESC LIMIT 36`,
      [dealId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get other income error:', err);
    res.status(500).json({ success: false, error: 'Failed to get other income' });
  }
});

// ─── Traffic Analysis ─────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/traffic
 * Get traffic analysis vs predictions
 */
router.get('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { months = '3' } = req.query;

    // Verify deal ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const analysis = await analyzeTrafficPerformance(dealId, parseInt(months as string, 10));
    res.json({ success: true, traffic: analysis });
  } catch (err) {
    logger.error('Traffic analysis error:', err);
    res.status(500).json({ success: false, error: 'Failed to analyze traffic' });
  }
});

/**
 * POST /api/v1/operations/:dealId/traffic
 * Import traffic data
 */
router.post('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    
    await query(`
      INSERT INTO traffic_funnel (
        deal_id, period_start, period_end,
        website_visits, ils_clicks, phone_calls, emails_received, walk_ins, total_leads,
        tours_scheduled, tours_completed, no_shows,
        applications, approved, denied,
        leases_signed, move_ins,
        projected_leads, projected_move_ins,
        marketing_spend, source
      ) VALUES (
        $1, $2, $2 + INTERVAL '1 month',
        $3, $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16,
        $17, $18,
        $19, $20
      )
      ON CONFLICT (deal_id, period_start) DO UPDATE SET
        total_leads = EXCLUDED.total_leads,
        tours_completed = EXCLUDED.tours_completed,
        applications = EXCLUDED.applications,
        leases_signed = EXCLUDED.leases_signed,
        move_ins = EXCLUDED.move_ins
    `, [
      req.params.dealId, data.period_start,
      data.website_visits, data.ils_clicks, data.phone_calls, data.emails_received, data.walk_ins, data.total_leads,
      data.tours_scheduled, data.tours_completed, data.no_shows,
      data.applications, data.approved, data.denied,
      data.leases_signed, data.move_ins,
      data.projected_leads, data.projected_move_ins,
      data.marketing_spend, data.source ?? 'manual',
    ]);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Import traffic error:', err);
    res.status(500).json({ success: false, error: 'Failed to import traffic data' });
  }
});

// ─── Recommendations ──────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/recommendations
 * Get active recommendations
 */
router.get('/:dealId/recommendations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = 'pending' } = req.query;
    
    const result = await query(`
      SELECT * FROM operations_recommendations
      WHERE deal_id = $1 AND status = $2
      ORDER BY 
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at DESC
    `, [req.params.dealId, status]);
    
    res.json({ success: true, recommendations: result.rows });
  } catch (err) {
    logger.error('Get recommendations error:', err);
    res.status(500).json({ success: false, error: 'Failed to get recommendations' });
  }
});

/**
 * POST /api/v1/operations/:dealId/recommendations/generate
 * Generate new recommendations
 */
router.post('/:dealId/recommendations/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recommendations = await generateOperationsRecommendations(req.params.dealId);
    res.json({ success: true, recommendations, count: recommendations.length });
  } catch (err) {
    logger.error('Generate recommendations error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

/**
 * PATCH /api/v1/operations/recommendations/:id
 * Update recommendation status
 */
router.patch('/recommendations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, implementation_notes, actual_impact } = req.body;
    
    await query(`
      UPDATE operations_recommendations
      SET status = $1, 
          implementation_notes = $2, 
          actual_impact = $3,
          status_updated_at = NOW(),
          status_updated_by = $4
      WHERE id = $5
    `, [status, implementation_notes, actual_impact, req.user?.userId, req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Update recommendation error:', err);
    res.status(500).json({ success: false, error: 'Failed to update recommendation' });
  }
});

// ─── Other Income ─────────────────────────────────────────────────────

/**
 * POST /api/v1/operations/:dealId/other-income
 * Import other income data
 */
router.post('/:dealId/other-income', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    
    await query(`
      INSERT INTO other_income_tracking (
        deal_id, period_start, period_end,
        pet_fees, pet_rent, parking, storage,
        application_fees, admin_fees, late_fees, nsf_fees,
        utility_reimbursement, cable_internet, trash_valet, amenity_fees,
        short_term_premium, furnished_premium, other,
        units, projected_other_income
      ) VALUES (
        $1, $2, $2 + INTERVAL '1 month',
        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (deal_id, period_start) DO UPDATE SET
        pet_fees = EXCLUDED.pet_fees,
        pet_rent = EXCLUDED.pet_rent,
        parking = EXCLUDED.parking,
        storage = EXCLUDED.storage,
        application_fees = EXCLUDED.application_fees,
        late_fees = EXCLUDED.late_fees
    `, [
      req.params.dealId, data.period_start,
      data.pet_fees, data.pet_rent, data.parking, data.storage,
      data.application_fees, data.admin_fees, data.late_fees, data.nsf_fees,
      data.utility_reimbursement, data.cable_internet, data.trash_valet, data.amenity_fees,
      data.short_term_premium, data.furnished_premium, data.other,
      data.units, data.projected_other_income,
    ]);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Import other income error:', err);
    res.status(500).json({ success: false, error: 'Failed to import other income data' });
  }
});

// ─── Projected vs Actual ─────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/projected-vs-actual
 * Returns merged monthly rows of proforma (budget) vs actual performance.
 * Joins deal_monthly_actuals budget rows with actuals rows on report_month.
 */
router.get('/:dealId/projected-vs-actual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    // Verify deal ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Fetch budget (proforma) rows
    const budgetRes = await query(
      `SELECT
         TO_CHAR(report_month, 'Mon') AS month,
         TO_CHAR(report_month, 'YYYY-MM') AS period,
         noi              AS proj_noi,
         occupancy_rate   AS proj_occ,
         avg_effective_rent AS proj_rent,
         report_month
       FROM deal_monthly_actuals
       WHERE deal_id = $1 AND is_budget = true
       ORDER BY report_month ASC`,
      [dealId]
    );

    // Fetch actual rows — resolve property_id to include legacy null-deal_id rows
    const pvaPropRes = await query(
      `SELECT property_id FROM deals WHERE id = $1 LIMIT 1`, [dealId]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const pvaPropertyId = pvaPropRes.rows[0]?.property_id as string | null;

    const actualRes = pvaPropertyId
      ? await query(
          `SELECT
             TO_CHAR(report_month, 'YYYY-MM') AS period,
             noi              AS act_noi,
             occupancy_rate   AS act_occ,
             avg_effective_rent AS act_rent
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
           ORDER BY report_month ASC`,
          [pvaPropertyId]
        )
      : await query(
          `SELECT
             TO_CHAR(report_month, 'YYYY-MM') AS period,
             noi              AS act_noi,
             occupancy_rate   AS act_occ,
             avg_effective_rent AS act_rent
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
           ORDER BY report_month ASC`,
          [dealId]
        );

    // Index actuals by period for fast lookup
    const actualsMap: Record<string, typeof actualRes.rows[0]> = {};
    for (const row of actualRes.rows) {
      actualsMap[row.period as string] = row;
    }

    const rows = budgetRes.rows.map(b => {
      const a = actualsMap[b.period as string];
      return {
        month:   b.month,
        period:  b.period,
        projNOI: b.proj_noi  != null ? Number(b.proj_noi)  : null,
        actNOI:  a?.act_noi  != null ? Number(a.act_noi)   : null,
        projOcc: b.proj_occ  != null ? Number(b.proj_occ) * 100 : null,
        actOcc:  a?.act_occ  != null ? Number(a.act_occ)  * 100 : null,
        projRent: b.proj_rent != null ? Number(b.proj_rent) : null,
        actRent:  a?.act_rent != null ? Number(a.act_rent)  : null,
      };
    });

    // If no budget rows exist, return actuals-only rows so the UI shows what's available
    if (rows.length === 0 && actualRes.rows.length > 0) {
      const actualsOnly = actualRes.rows.map(a => ({
        month:   a.period ? String(a.period).slice(5, 7) : null,
        period:  a.period,
        projNOI: null, actNOI: a.act_noi != null ? Number(a.act_noi) : null,
        projOcc: null, actOcc: a.act_occ != null ? Number(a.act_occ) * 100 : null,
        projRent: null, actRent: a.act_rent != null ? Number(a.act_rent) : null,
      }));
      return res.json({ success: true, data: actualsOnly, hasProjections: false, hasActuals: true });
    }

    const hasActuals = rows.some(r => r.actNOI != null || r.actOcc != null);
    res.json({ success: true, data: rows, hasProjections: rows.length > 0, hasActuals });
  } catch (err) {
    logger.error('Projected vs actual error:', err);
    res.status(500).json({ success: false, error: 'Failed to get projected vs actual data' });
  }
});

// ─── Learning Integration ─────────────────────────────────────────────

/**
 * POST /api/v1/operations/:dealId/feed-learning
 * Feed operations data to the learning system
 */
router.post('/:dealId/feed-learning', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await feedOperationsToLearning(req.params.dealId);
    res.json({ success: true, message: 'Operations data fed to learning system' });
  } catch (err) {
    logger.error('Feed learning error:', err);
    res.status(500).json({ success: false, error: 'Failed to feed learning system' });
  }
});

// ─── M22: Post-Close Actuals Write Path ──────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/monthly-actuals
 * List recorded monthly actuals for a deal (M22 Tier-2 evidence write path).
 */
router.get('/:dealId/monthly-actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { limit: limitRaw = '36', is_budget = 'false' } = req.query as Record<string, string>;

    const limitNum = Math.min(Math.max(parseInt(limitRaw, 10) || 36, 1), 120);

    // Resolve property_id so we include legacy rows with null deal_id
    const propRes = await query(
      `SELECT property_id FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const propId = propRes.rows[0]?.property_id as string | null;

    const result = propId
      ? await query(
          `SELECT
             id, deal_id, property_id, report_month, is_budget,
             occupied_units, total_units, occupancy_rate,
             gross_potential_rent, avg_effective_rent, effective_gross_income,
             noi, expenses,
             payroll, repairs_maintenance, utilities, marketing,
             admin_general, management_fee, management_fee_pct, turnover_costs,
             real_estate_taxes, insurance, capex,
             data_source AS source, notes, created_at, updated_at
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = $2
           ORDER BY report_month DESC
           LIMIT $3`,
          [propId, is_budget === 'true', limitNum]
        )
      : await query(
          `SELECT
             id, deal_id, property_id, report_month, is_budget,
             occupied_units, total_units, occupancy_rate,
             gross_potential_rent, avg_effective_rent, effective_gross_income,
             noi, expenses,
             payroll, repairs_maintenance, utilities, marketing,
             admin_general, management_fee, management_fee_pct, turnover_costs,
             real_estate_taxes, insurance, capex,
             data_source AS source, notes, created_at, updated_at
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = $2
           ORDER BY report_month DESC
           LIMIT $3`,
          [dealId, is_budget === 'true', limitNum]
        );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    logger.error('Monthly actuals GET error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly actuals' });
  }
});

/**
 * GET /api/v1/operations/:dealId/live-tracking
 * M09 4-col comparison: current month vs TTM actuals vs annualized pro-forma vs delta.
 * Derives summary rows from deal_monthly_actuals and GL line-item breakdown from
 * deal_monthly_actuals_lines (joined on matching period_month values).
 * delta_pct = (actuals_ttm − pro_forma_annualized) / |pro_forma_annualized| × 100
 */
router.get('/:dealId/live-tracking', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;

    // Ownership check
    const ownerCheck = await query(
      'SELECT id, property_id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, userId],
    );
    if (!ownerCheck.rows.length) return res.status(404).json({ success: false, error: 'Deal not found' });
    const propId = ownerCheck.rows[0].property_id as string | null;

    // ── Fetch last 12 actual months ───────────────────────────────────────────
    const actualsRes = propId
      ? await query(
          `SELECT report_month, gross_potential_rent, effective_gross_income, noi, expenses,
                  occupied_units, total_units, occupancy_rate
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_budget = FALSE AND is_portfolio_asset = TRUE
           ORDER BY report_month DESC LIMIT 12`,
          [propId],
        )
      : await query(
          `SELECT report_month, gross_potential_rent, effective_gross_income, noi, expenses,
                  occupied_units, total_units, occupancy_rate
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = FALSE
           ORDER BY report_month DESC LIMIT 12`,
          [dealId],
        );

    // ── Fetch most recent pro-forma (budget) month if one exists ─────────────
    const budgetRes = propId
      ? await query(
          `SELECT gross_potential_rent, effective_gross_income, noi, expenses, occupancy_rate
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_budget = TRUE
           ORDER BY report_month DESC LIMIT 1`,
          [propId],
        )
      : await query(
          `SELECT gross_potential_rent, effective_gross_income, noi, expenses, occupancy_rate
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = TRUE
           ORDER BY report_month DESC LIMIT 1`,
          [dealId],
        );

    const actuals = actualsRes.rows;
    const budget  = budgetRes.rows[0] ?? null;
    const current = actuals[0] ?? null; // most recent actual month

    // ── GL line-item breakdown from deal_monthly_actuals_lines ───────────────
    // Joined on period_month ∈ actual report months so we pull only this property's lines.
    // Covers: current month (most recent) and TTM (all fetched months).
    const GL_LABELS = [
      'Payroll', 'Maintenance & Repairs', 'Utilities', 'Management Fees',
      'Insurance', 'Property Taxes', 'Marketing', 'Admin/Office',
    ] as const;

    let glCurrent: Record<string, number> = {};
    let glTtm: Record<string, number> = {};

    if (actuals.length > 0) {
      const actualMonths = actuals.map(r => r.report_month);
      const placeholders = actualMonths.map((_: unknown, i: number) => `$${i + 1}`).join(',');
      const glRes = await query(
        `SELECT account_label, period_month, SUM(amount::numeric) AS total
         FROM deal_monthly_actuals_lines
         WHERE period_month IN (${placeholders})
           AND account_label = ANY($${actualMonths.length + 1}::text[])
         GROUP BY account_label, period_month`,
        [...actualMonths, GL_LABELS],
      );

      // Partition into current-month vs all-TTM-months
      const mostRecentMonth = actualMonths[0];
      for (const row of glRes.rows) {
        const label = row.account_label as string;
        const amount = parseFloat(row.total as string) || 0;
        glTtm[label] = (glTtm[label] ?? 0) + amount;
        if (
          row.period_month instanceof Date
            ? row.period_month.getTime() === new Date(mostRecentMonth).getTime()
            : String(row.period_month).slice(0, 7) === String(mostRecentMonth).slice(0, 7)
        ) {
          glCurrent[label] = (glCurrent[label] ?? 0) + amount;
        }
      }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function sf(r: Record<string, unknown>, field: string): number {
      return parseFloat(r[field] as string) || 0;
    }
    function ttmSum(field: string): number {
      return actuals.reduce((s: number, r: Record<string, unknown>) => s + sf(r, field), 0);
    }
    function ttmAvgOcc(): number {
      if (!actuals.length) return 0;
      return actuals.reduce((s: number, r: Record<string, unknown>) => s + sf(r, 'occupancy_rate'), 0) / actuals.length;
    }
    function fmtMoney(v: number | null): string {
      if (v == null) return '—';
      return v >= 1_000_000
        ? '$' + (v / 1_000_000).toFixed(2) + 'M'
        : '$' + Math.round(v).toLocaleString('en-US');
    }
    function fmtPct(v: number | null): string {
      if (v == null) return '—';
      return (v * 100).toFixed(1) + '%';
    }

    // Build a money comparison row.
    // pf is a SINGLE monthly budget value; we annualize it (×12) to compare with TTM sum.
    function moneyRow(label: string, cur: number | null, ttm: number, pfMonthly: number | null) {
      const pfAnnual = pfMonthly != null ? pfMonthly * 12 : null;
      const delta = pfAnnual && pfAnnual !== 0
        ? parseFloat(((ttm - pfAnnual) / Math.abs(pfAnnual) * 100).toFixed(1))
        : null;
      return {
        line_item: label,
        current_month: cur,
        current_month_fmt: fmtMoney(cur),
        actuals_ttm: ttm,
        actuals_ttm_fmt: fmtMoney(ttm),
        pro_forma: pfAnnual,
        pro_forma_fmt: fmtMoney(pfAnnual),
        delta_pct: delta,
      };
    }

    // ── Build response rows ───────────────────────────────────────────────────
    const gprCur = current ? sf(current, 'gross_potential_rent') || null : null;
    const egiCur = current ? sf(current, 'effective_gross_income') || null : null;
    const noiCur = current ? sf(current, 'noi') || null : null;
    const expCur = current ? sf(current, 'expenses') || null : null;
    const occCur = current ? sf(current, 'occupancy_rate') || null : null;

    const summaryRows = [
      moneyRow('Gross Potential Rent', gprCur, ttmSum('gross_potential_rent'),
        budget ? sf(budget, 'gross_potential_rent') || null : null),
      moneyRow('Effective Gross Income', egiCur, ttmSum('effective_gross_income'),
        budget ? sf(budget, 'effective_gross_income') || null : null),
      moneyRow('NOI', noiCur, ttmSum('noi'),
        budget ? sf(budget, 'noi') || null : null),
      moneyRow('Total Expenses', expCur, ttmSum('expenses'),
        budget ? sf(budget, 'expenses') || null : null),
      {
        line_item: 'Occupancy',
        current_month: occCur != null ? occCur * 100 : null,
        current_month_fmt: occCur != null ? (occCur * 100).toFixed(1) + '%' : '—',
        actuals_ttm: ttmAvgOcc() * 100,
        actuals_ttm_fmt: (ttmAvgOcc() * 100).toFixed(1) + '%',
        pro_forma: budget ? (sf(budget, 'occupancy_rate') * 100 || null) : null,
        pro_forma_fmt: budget ? fmtPct(sf(budget, 'occupancy_rate') || null) : '—',
        delta_pct: null as number | null,
      },
    ];

    // GL line-item expense breakdown from deal_monthly_actuals_lines
    const lineRows = GL_LABELS
      .filter(label => glTtm[label] != null)
      .map(label => ({
        line_item: `  ${label}`,
        current_month: glCurrent[label] ?? null,
        current_month_fmt: fmtMoney(glCurrent[label] ?? null),
        actuals_ttm: glTtm[label],
        actuals_ttm_fmt: fmtMoney(glTtm[label]),
        pro_forma: null as number | null,
        pro_forma_fmt: '—',
        delta_pct: null as number | null,
      }));

    res.json({
      success: true,
      rows: [...summaryRows, ...lineRows],
      meta: {
        months_of_data: actuals.length,
        current_period: current?.report_month ?? null,
        has_pro_forma: !!budget,
        gl_labels_found: Object.keys(glTtm),
      },
    });
  } catch (err) {
    logger.error('Live tracking GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch live tracking data' });
  }
});

interface MonthlyActualInput {
  report_month: string;
  is_budget?: boolean;
  occupied_units?: number;
  total_units?: number;
  occupancy_rate?: number;
  gross_potential_rent?: number;
  avg_effective_rent?: number;
  effective_gross_income?: number;
  noi?: number;
  expenses?: number;
  payroll?: number;
  repairs_maintenance?: number;
  utilities?: number;
  marketing?: number;
  admin_general?: number;
  management_fee?: number;
  management_fee_pct?: number;
  turnover_costs?: number;
  real_estate_taxes?: number;
  insurance?: number;
  capex?: number;
  notes?: string;
}

/**
 * POST /api/v1/operations/:dealId/monthly-actuals
 * Upsert one or more monthly actuals for a deal (M22 Tier-2 evidence write path).
 *
 * Body: { actuals: MonthlyActualInput[] }
 * Each row must include report_month (YYYY-MM-DD or YYYY-MM).
 * property_id is resolved automatically from deal_properties.
 */
router.post('/:dealId/monthly-actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const actuals = req.body.actuals as MonthlyActualInput[];

    if (!Array.isArray(actuals) || actuals.length === 0) {
      return res.status(400).json({ error: 'actuals array required' });
    }

    // Resolve property_id from deal_properties (first linked property)
    const propRes = await query(
      `SELECT property_id FROM deal_properties WHERE deal_id = $1 ORDER BY created_at LIMIT 1`,
      [dealId]
    );
    const propertyId: string | null = propRes.rows[0]?.property_id ?? null;

    // Fallback unit count from deal_data for occupancy_rate computation
    const dealRes = await query(`SELECT deal_data FROM deals WHERE id = $1`, [dealId]);
    const dealData = dealRes.rows[0]?.deal_data ?? {};
    const dealUnits = parseInt(String(dealData.unit_count ?? dealData.units ?? 0), 10) || null;

    if (!propertyId) {
      // Insert without conflict key — unique constraint requires property_id;
      // fall back to a no-conflict insert keyed on deal_id + report_month only.
      // This handles deals that have no linked property record yet.
      logger.warn('monthly-actuals: no property linked to deal', { dealId });
    }

    const client = await getClient();
    let imported = 0;
    const errors: { row: number; error: string }[] = [];

    try {
      await client.query('BEGIN');

      const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

      for (let i = 0; i < actuals.length; i++) {
        const a = actuals[i];

        // Lightweight format validation before touching the DB
        if (!a.report_month) {
          errors.push({ row: i + 1, error: 'report_month is required' });
          continue;
        }
        if (!MONTH_RE.test(a.report_month)) {
          errors.push({ row: i + 1, error: 'report_month must be YYYY-MM or YYYY-MM-DD' });
          continue;
        }

        // Normalise to first-of-month
        const reportMonth = a.report_month.slice(0, 7) + '-01';
        const isBudget = !!(a.is_budget);

        const totalUnits = a.total_units ?? dealUnits;
        const occupiedUnits = a.occupied_units ?? null;
        const occupancyRate = a.occupancy_rate ??
          (occupiedUnits != null && totalUnits ? occupiedUnits / totalUnits : null);

        const egi = a.effective_gross_income ?? null;
        const noiVal = a.noi ?? null;
        const expenses = a.expenses ?? (egi != null && noiVal != null ? egi - noiVal : null);

        // Per-row savepoint: allows partial-batch success when individual rows fail
        const sp = `sp_m22_row_${i}`;
        await client.query(`SAVEPOINT ${sp}`);
        try {
          if (propertyId) {
            await client.query(
              `INSERT INTO deal_monthly_actuals (
                 deal_id, property_id, report_month, is_budget, is_proforma,
                 occupied_units, total_units, occupancy_rate,
                 gross_potential_rent, avg_effective_rent, effective_gross_income,
                 noi, expenses,
                 payroll, repairs_maintenance, utilities, marketing,
                 admin_general, management_fee, management_fee_pct, turnover_costs,
                 real_estate_taxes, insurance, capex,
                 data_source, notes
               ) VALUES (
                 $1, $2, $3, $4, false,
                 $5, $6, $7,
                 $8, $9, $10,
                 $11, $12,
                 $13, $14, $15, $16,
                 $17, $18, $19, $20,
                 $21, $22, $23,
                 'manual', $24
               )
               ON CONFLICT (property_id, report_month, is_budget, is_proforma)
               DO UPDATE SET
                 deal_id                = EXCLUDED.deal_id,
                 occupied_units         = COALESCE(EXCLUDED.occupied_units, deal_monthly_actuals.occupied_units),
                 total_units            = COALESCE(EXCLUDED.total_units, deal_monthly_actuals.total_units),
                 occupancy_rate         = COALESCE(EXCLUDED.occupancy_rate, deal_monthly_actuals.occupancy_rate),
                 gross_potential_rent   = COALESCE(EXCLUDED.gross_potential_rent, deal_monthly_actuals.gross_potential_rent),
                 avg_effective_rent     = COALESCE(EXCLUDED.avg_effective_rent, deal_monthly_actuals.avg_effective_rent),
                 effective_gross_income = COALESCE(EXCLUDED.effective_gross_income, deal_monthly_actuals.effective_gross_income),
                 noi                    = COALESCE(EXCLUDED.noi, deal_monthly_actuals.noi),
                 expenses               = COALESCE(EXCLUDED.expenses, deal_monthly_actuals.expenses),
                 payroll                = COALESCE(EXCLUDED.payroll, deal_monthly_actuals.payroll),
                 repairs_maintenance    = COALESCE(EXCLUDED.repairs_maintenance, deal_monthly_actuals.repairs_maintenance),
                 utilities              = COALESCE(EXCLUDED.utilities, deal_monthly_actuals.utilities),
                 marketing              = COALESCE(EXCLUDED.marketing, deal_monthly_actuals.marketing),
                 admin_general          = COALESCE(EXCLUDED.admin_general, deal_monthly_actuals.admin_general),
                 management_fee         = COALESCE(EXCLUDED.management_fee, deal_monthly_actuals.management_fee),
                 management_fee_pct     = COALESCE(EXCLUDED.management_fee_pct, deal_monthly_actuals.management_fee_pct),
                 turnover_costs         = COALESCE(EXCLUDED.turnover_costs, deal_monthly_actuals.turnover_costs),
                 real_estate_taxes      = COALESCE(EXCLUDED.real_estate_taxes, deal_monthly_actuals.real_estate_taxes),
                 insurance              = COALESCE(EXCLUDED.insurance, deal_monthly_actuals.insurance),
                 capex                  = COALESCE(EXCLUDED.capex, deal_monthly_actuals.capex),
                 notes                  = COALESCE(EXCLUDED.notes, deal_monthly_actuals.notes),
                 data_source            = 'manual',
                 updated_at             = NOW()`,
              [
                dealId, propertyId, reportMonth, isBudget,
                occupiedUnits, totalUnits, occupancyRate,
                a.gross_potential_rent ?? null, a.avg_effective_rent ?? null, egi,
                noiVal, expenses,
                a.payroll ?? null, a.repairs_maintenance ?? null, a.utilities ?? null, a.marketing ?? null,
                a.admin_general ?? null, a.management_fee ?? null, a.management_fee_pct ?? null, a.turnover_costs ?? null,
                a.real_estate_taxes ?? null, a.insurance ?? null, a.capex ?? null,
                a.notes ?? null,
              ]
            );
            imported++;
          } else {
            // No property linked: insert with deal_id only.
            // ON CONFLICT DO NOTHING so rowCount tells us whether a row was actually inserted.
            const fallbackResult = await client.query(
              `INSERT INTO deal_monthly_actuals (
                 deal_id, report_month, is_budget, is_proforma,
                 occupied_units, total_units, occupancy_rate,
                 gross_potential_rent, avg_effective_rent, effective_gross_income,
                 noi, expenses,
                 payroll, repairs_maintenance, utilities, marketing,
                 admin_general, management_fee, management_fee_pct, turnover_costs,
                 real_estate_taxes, insurance, capex,
                 data_source, notes
               ) VALUES (
                 $1, $2, $3, false,
                 $4, $5, $6,
                 $7, $8, $9,
                 $10, $11,
                 $12, $13, $14, $15,
                 $16, $17, $18, $19,
                 $20, $21, $22,
                 'manual', $23
               )
               ON CONFLICT (deal_id, report_month, is_budget, is_proforma)
               WHERE property_id IS NULL
               DO UPDATE SET
                 occupied_units         = COALESCE(EXCLUDED.occupied_units, deal_monthly_actuals.occupied_units),
                 total_units            = COALESCE(EXCLUDED.total_units, deal_monthly_actuals.total_units),
                 occupancy_rate         = COALESCE(EXCLUDED.occupancy_rate, deal_monthly_actuals.occupancy_rate),
                 gross_potential_rent   = COALESCE(EXCLUDED.gross_potential_rent, deal_monthly_actuals.gross_potential_rent),
                 avg_effective_rent     = COALESCE(EXCLUDED.avg_effective_rent, deal_monthly_actuals.avg_effective_rent),
                 effective_gross_income = COALESCE(EXCLUDED.effective_gross_income, deal_monthly_actuals.effective_gross_income),
                 noi                    = COALESCE(EXCLUDED.noi, deal_monthly_actuals.noi),
                 expenses               = COALESCE(EXCLUDED.expenses, deal_monthly_actuals.expenses),
                 payroll                = COALESCE(EXCLUDED.payroll, deal_monthly_actuals.payroll),
                 repairs_maintenance    = COALESCE(EXCLUDED.repairs_maintenance, deal_monthly_actuals.repairs_maintenance),
                 utilities              = COALESCE(EXCLUDED.utilities, deal_monthly_actuals.utilities),
                 marketing              = COALESCE(EXCLUDED.marketing, deal_monthly_actuals.marketing),
                 admin_general          = COALESCE(EXCLUDED.admin_general, deal_monthly_actuals.admin_general),
                 management_fee         = COALESCE(EXCLUDED.management_fee, deal_monthly_actuals.management_fee),
                 management_fee_pct     = COALESCE(EXCLUDED.management_fee_pct, deal_monthly_actuals.management_fee_pct),
                 turnover_costs         = COALESCE(EXCLUDED.turnover_costs, deal_monthly_actuals.turnover_costs),
                 real_estate_taxes      = COALESCE(EXCLUDED.real_estate_taxes, deal_monthly_actuals.real_estate_taxes),
                 insurance              = COALESCE(EXCLUDED.insurance, deal_monthly_actuals.insurance),
                 capex                  = COALESCE(EXCLUDED.capex, deal_monthly_actuals.capex),
                 notes                  = COALESCE(EXCLUDED.notes, deal_monthly_actuals.notes),
                 data_source            = 'manual',
                 updated_at             = NOW()`,
              [
                dealId, reportMonth, isBudget,
                occupiedUnits, totalUnits, occupancyRate,
                a.gross_potential_rent ?? null, a.avg_effective_rent ?? null, egi,
                noiVal, expenses,
                a.payroll ?? null, a.repairs_maintenance ?? null, a.utilities ?? null, a.marketing ?? null,
                a.admin_general ?? null, a.management_fee ?? null, a.management_fee_pct ?? null, a.turnover_costs ?? null,
                a.real_estate_taxes ?? null, a.insurance ?? null, a.capex ?? null,
                a.notes ?? null,
              ]
            );
            if ((fallbackResult.rowCount ?? 0) > 0) imported++;
          }
          await client.query(`RELEASE SAVEPOINT ${sp}`);
        } catch (rowErr: unknown) {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          await client.query(`RELEASE SAVEPOINT ${sp}`);
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          errors.push({ row: i + 1, error: rowMsg });
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    if (imported === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        imported,
        errors,
        error: errors[0]?.error ?? 'All rows failed to import',
      });
    }

    res.json({
      success: true,
      imported,
      errors,
      message: `Imported ${imported} month(s) of actuals for deal ${dealId}`,
    });
  } catch (err) {
    logger.error('Monthly actuals POST error:', err);
    res.status(500).json({ error: 'Failed to import monthly actuals' });
  }
});

// ─── Balance Sheet ────────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/balance-sheet
 * Retrieve latest balance sheet snapshot
 */
router.get('/:dealId/balance-sheet', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    // Verify deal ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Try to get from balance_sheets table if it exists, otherwise build from actuals
    const result = await query(
      `SELECT * FROM balance_sheets WHERE deal_id = $1 ORDER BY report_month DESC LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length > 0) {
      return res.json({ success: true, balanceSheet: result.rows[0] });
    }

    // Build approximation from deal_monthly_actuals — include legacy null-deal_id rows via property_id
    const bsPropRes = await query(
      `SELECT property_id FROM deals WHERE id = $1 LIMIT 1`, [dealId]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const bsPropertyId = bsPropRes.rows[0]?.property_id as string | null;

    const actualsRes = bsPropertyId
      ? await query(
          `SELECT report_month, noi, debt_service, capex, cash_flow_before_tax
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
           ORDER BY report_month DESC
           LIMIT 12`,
          [bsPropertyId]
        )
      : await query(
          `SELECT report_month, noi, debt_service, capex, cash_flow_before_tax
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
           ORDER BY report_month DESC
           LIMIT 12`,
          [dealId]
        );

    if (actualsRes.rows.length === 0) {
      return res.json({ success: true, balanceSheet: null });
    }

    // Estimate balance sheet from cash flow data (simplified)
    const cumCashFlow = actualsRes.rows.reduce((sum: number, r: any) => sum + (Number(r.cash_flow_before_tax) || 0), 0);
    const latestMonth = actualsRes.rows[0];

    res.json({
      success: true,
      balanceSheet: {
        report_month: latestMonth.report_month,
        cash: Math.max(0, cumCashFlow),
        accounts_receivable: null,
        prepaid_expenses: null,
        other_current_assets: null,
        fixed_assets: null,
        total_assets: cumCashFlow > 0 ? cumCashFlow : null,
        accounts_payable: null,
        accrued_expenses: null,
        security_deposits: null,
        prepaid_rent: null,
        other_liabilities: null,
        total_liabilities: null,
        contributed_capital: null,
        retained_earnings: cumCashFlow,
        current_year_earnings: Number(latestMonth.cash_flow_before_tax) || 0,
        total_equity: cumCashFlow,
        source: 'estimated_from_actuals',
      },
    });
  } catch (err) {
    logger.error('Balance sheet GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to get balance sheet' });
  }
});

/**
 * POST /api/v1/operations/:dealId/balance-sheet
 * Import balance sheet data
 */
router.post('/:dealId/balance-sheet', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { report_month, ...data } = req.body;

    if (!report_month) {
      return res.status(400).json({ success: false, error: 'report_month required' });
    }

    // Upsert balance sheet
    await query(
      `INSERT INTO balance_sheets (
        deal_id, report_month,
        cash, accounts_receivable, prepaid_expenses, other_current_assets, fixed_assets, total_assets,
        accounts_payable, accrued_expenses, security_deposits, prepaid_rent, other_liabilities, total_liabilities,
        contributed_capital, retained_earnings, current_year_earnings, total_equity,
        source
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19
      )
      ON CONFLICT (deal_id, report_month) DO UPDATE SET
        cash = EXCLUDED.cash,
        accounts_receivable = EXCLUDED.accounts_receivable,
        total_assets = EXCLUDED.total_assets,
        total_liabilities = EXCLUDED.total_liabilities,
        total_equity = EXCLUDED.total_equity,
        updated_at = NOW()`,
      [
        dealId, report_month,
        data.cash, data.accounts_receivable, data.prepaid_expenses, data.other_current_assets, data.fixed_assets, data.total_assets,
        data.accounts_payable, data.accrued_expenses, data.security_deposits, data.prepaid_rent, data.other_liabilities, data.total_liabilities,
        data.contributed_capital, data.retained_earnings, data.current_year_earnings, data.total_equity,
        data.source || 'manual',
      ]
    );

    res.json({ success: true, message: 'Balance sheet saved' });
  } catch (err) {
    logger.error('Balance sheet POST error:', err);
    res.status(500).json({ success: false, error: 'Failed to save balance sheet' });
  }
});

// ─── Lease Transactions ───────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/lease-transactions
 * Retrieve lease transaction history (new leases, renewals, move-outs)
 */
router.get('/:dealId/lease-transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { limit = '50', type } = req.query;

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Try dedicated table first
    const txResult = await query(
      `SELECT * FROM lease_transactions 
       WHERE deal_id = $1 ${type ? `AND transaction_type = $3` : ''}
       ORDER BY effective_date DESC
       LIMIT $2`,
      type ? [dealId, parseInt(limit as string, 10), type] : [dealId, parseInt(limit as string, 10)]
    ).catch(() => ({ rows: [] }));

    if (txResult.rows.length > 0) {
      return res.json({ success: true, transactions: txResult.rows });
    }

    // Derive transactions from rent_roll_units snapshots
    // Look for units where status or rent changed between snapshots
    const derivedRes = await query(
      `WITH snapshots AS (
        SELECT 
          unit_number,
          status,
          current_rent,
          lease_start,
          lease_end,
          move_in_date,
          move_out_date,
          as_of_date,
          resident_name,
          LAG(status) OVER (PARTITION BY unit_number ORDER BY as_of_date) as prev_status,
          LAG(current_rent) OVER (PARTITION BY unit_number ORDER BY as_of_date) as prev_rent
        FROM rent_roll_units
        WHERE deal_id = $1
      )
      SELECT 
        unit_number,
        CASE 
          WHEN prev_status IS NULL OR (prev_status = 'vacant' AND status = 'occupied') THEN 'new_lease'
          WHEN status = 'occupied' AND prev_rent IS NOT NULL AND current_rent != prev_rent THEN 'renewal'
          WHEN prev_status = 'occupied' AND status = 'vacant' THEN 'move_out'
          ELSE 'transfer'
        END as transaction_type,
        COALESCE(move_in_date, lease_start, as_of_date) as effective_date,
        lease_end as lease_end_date,
        current_rent as rent,
        prev_rent as prior_rent,
        NULL::numeric as concessions,
        resident_name
      FROM snapshots
      WHERE (
        (prev_status = 'vacant' AND status = 'occupied') OR
        (status = 'occupied' AND prev_rent IS NOT NULL AND current_rent != prev_rent) OR
        (prev_status = 'occupied' AND status = 'vacant')
      )
      ORDER BY effective_date DESC
      LIMIT $2`,
      [dealId, parseInt(limit as string, 10)]
    ).catch(() => ({ rows: [] }));

    res.json({ success: true, transactions: derivedRes.rows });
  } catch (err) {
    logger.error('Lease transactions GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to get lease transactions' });
  }
});

/**
 * POST /api/v1/operations/:dealId/lease-transactions
 * Record a lease transaction
 */
router.post('/:dealId/lease-transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { unit_number, transaction_type, effective_date, lease_end_date, rent, prior_rent, concessions, resident_name } = req.body;

    if (!unit_number || !transaction_type || !effective_date) {
      return res.status(400).json({ success: false, error: 'unit_number, transaction_type, and effective_date required' });
    }

    const result = await query(
      `INSERT INTO lease_transactions (
        deal_id, unit_number, transaction_type, effective_date, lease_end_date,
        rent, prior_rent, concessions, resident_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [dealId, unit_number, transaction_type, effective_date, lease_end_date, rent, prior_rent, concessions, resident_name]
    );

    res.json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    logger.error('Lease transaction POST error:', err);
    res.status(500).json({ success: false, error: 'Failed to record lease transaction' });
  }
});

// ─── Unit Mix ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/unit-mix
 * Get unit mix breakdown by bedroom type
 */
router.get('/:dealId/unit-mix', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Try dedicated unit_mix table first
    const mixResult = await query(
      `SELECT * FROM unit_mix WHERE deal_id = $1 ORDER BY bed_count, bath_count`,
      [dealId]
    ).catch(() => ({ rows: [] }));

    if (mixResult.rows.length > 0) {
      return res.json({ success: true, unitTypes: mixResult.rows });
    }

    // Derive from rent roll if no dedicated unit mix
    const derivedRes = await query(
      `WITH latest_snapshot AS (
        SELECT DISTINCT ON (unit_number) *
        FROM rent_roll_units
        WHERE deal_id = $1
        ORDER BY unit_number, as_of_date DESC
      )
      SELECT 
        COALESCE(unit_type, 'Unknown') as unit_type,
        -- Extract bed count from unit_type (e.g., '1BR', '2 Bed', 'Studio')
        CASE 
          WHEN unit_type ILIKE '%studio%' OR unit_type ILIKE '%0br%' OR unit_type ILIKE '%0 bed%' THEN 0
          WHEN unit_type ~ '[1-4]' THEN (regexp_match(unit_type, '([1-4])'))[1]::int
          ELSE 1
        END as bed_count,
        CASE 
          WHEN unit_type ~ '[1-3](\s*\.\s*5)?\s*(ba|bath)' THEN (regexp_match(unit_type, '([1-3])'))[1]::int
          ELSE 1
        END as bath_count,
        COALESCE(AVG(sqft), 0)::int as sqft,
        COUNT(*)::int as count,
        COUNT(*) FILTER (WHERE status = 'occupied')::int as occupied,
        COALESCE(AVG(current_rent) FILTER (WHERE status = 'occupied'), 0)::numeric(10,2) as avg_rent,
        COALESCE(AVG(market_rent), AVG(current_rent), 0)::numeric(10,2) as market_rent,
        COALESCE(SUM(current_rent) FILTER (WHERE status = 'occupied'), 0)::numeric(10,2) as total_rent
      FROM latest_snapshot
      GROUP BY unit_type
      ORDER BY bed_count, bath_count`,
      [dealId]
    ).catch(() => ({ rows: [] }));

    res.json({ success: true, unitTypes: derivedRes.rows });
  } catch (err) {
    logger.error('Unit mix GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to get unit mix' });
  }
});

/**
 * POST /api/v1/operations/:dealId/unit-mix
 * Import unit mix data
 */
router.post('/:dealId/unit-mix', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { unitTypes } = req.body;

    if (!Array.isArray(unitTypes)) {
      return res.status(400).json({ success: false, error: 'unitTypes array required' });
    }

    const client = await getClient();
    let imported = 0;

    try {
      await client.query('BEGIN');

      // Clear existing unit mix for this deal
      await client.query('DELETE FROM unit_mix WHERE deal_id = $1', [dealId]);

      for (const ut of unitTypes) {
        await client.query(
          `INSERT INTO unit_mix (
            deal_id, unit_type, bed_count, bath_count, sqft, count, occupied,
            avg_rent, market_rent, total_rent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            dealId, ut.unit_type, ut.bed_count, ut.bath_count, ut.sqft, ut.count, ut.occupied,
            ut.avg_rent, ut.market_rent, ut.total_rent,
          ]
        );
        imported++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, imported });
  } catch (err) {
    logger.error('Unit mix POST error:', err);
    res.status(500).json({ success: false, error: 'Failed to import unit mix' });
  }
});

// ── GET /:dealId/tradeout-events ─────────────────────────────────────────────
// Returns lease trade-out events for the deal's property (1,492 rows for Highlands).
// Bridge: deal_monthly_actuals_lines.period_month ↔ deal_monthly_actuals.report_month
router.get('/:dealId/tradeout-events', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  try {
    // Verify deal ownership — return 404 for unknown/unauthorized deals
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const result = await query(
      `WITH prop_code AS (
         SELECT DISTINCT dmal.property_code
         FROM deal_monthly_actuals_lines dmal
         WHERE dmal.period_month IN (
           SELECT dma.report_month::date
           FROM deal_monthly_actuals dma
           WHERE dma.deal_id = $1
         )
         LIMIT 1
       )
       SELECT
         lte.unit_type,
         lte.event_type,
         lte.prior_rent,
         lte.new_rent,
         lte.tradeout_pct   AS spread_pct,
         lte.lease_start_date AS effective_date
       FROM lease_tradeout_events lte
       JOIN prop_code pc ON pc.property_code = lte.property_code
       ORDER BY lte.lease_start_date DESC
       LIMIT 200`,
      [dealId],
    );
    res.json({ events: result.rows });
  } catch (err) {
    logger.error('tradeout-events error:', err);
    res.status(500).json({ error: 'Failed to fetch tradeout events' });
  }
});

// ── GET /:dealId/leasing-observations ────────────────────────────────────────
// Returns weekly leasing funnel data (276 rows for Highlands, Jul 2021–Oct 2026).
// Bridge: same deal_monthly_actuals_lines period_month lookup.
router.get('/:dealId/leasing-observations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const weeks = Math.min(parseInt((req.query.weeks as string) || '52', 10), 276);
  try {
    // Verify deal ownership — return 404 for unknown/unauthorized deals
    const ownerCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const result = await query(
      `WITH prop_code AS (
         SELECT DISTINCT dmal.property_code
         FROM deal_monthly_actuals_lines dmal
         WHERE dmal.period_month IN (
           SELECT dma.report_month::date
           FROM deal_monthly_actuals dma
           WHERE dma.deal_id = $1
         )
         LIMIT 1
       )
       SELECT
         lwo.week_ending        AS week,
         lwo.traffic,
         lwo.tours_inperson     AS tours,
         lwo.apps               AS applications,
         lwo.net_leases         AS leases,
         (lwo.move_ins - lwo.move_outs) AS net_absorption
       FROM leasing_weekly_observations lwo
       JOIN prop_code pc ON pc.property_code = lwo.property_code
       ORDER BY lwo.week_ending DESC
       LIMIT $2`,
      [dealId, weeks],
    );
    res.json({ observations: result.rows });
  } catch (err) {
    logger.error('leasing-observations error:', err);
    res.status(500).json({ error: 'Failed to fetch leasing observations' });
  }
});

// ─── Commentary Agent (owned-asset mode) ─────────────────────────────

/**
 * POST /api/v1/operations/:dealId/commentary
 * Invoke the commentary agent framed as an owned-asset review.
 * Returns thesis checkpoint bullets suitable for the PERFORMANCE screen.
 * Responses are cached 24 h in market_commentary; pass { forceRefresh: true }
 * in the request body or ?refresh=true in the query to bypass the cache.
 */
router.post('/:dealId/commentary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const forceRefresh = req.body?.forceRefresh === true || req.query.refresh === 'true';

    const ownerCheck = await query(
      'SELECT id, property_id, name FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const propertyId = ownerCheck.rows[0].property_id as string | null;
    const dealName   = (ownerCheck.rows[0].name as string | null) ?? 'Owned Asset';

    // Derive signals from real monthly actuals so the commentary is grounded
    // in actual performance rather than the hash-based defaults.
    let signals: StrategySignalInputs | undefined;
    if (propertyId) {
      const actualsRes = await query(
        `SELECT occupancy_rate, noi
         FROM deal_monthly_actuals
         WHERE property_id = $1 AND is_portfolio_asset = TRUE
           AND is_budget = false AND is_proforma = false
           AND occupancy_rate IS NOT NULL
         ORDER BY report_month DESC
         LIMIT 6`,
        [propertyId]
      );
      if (actualsRes.rows.length >= 1) {
        const rows = actualsRes.rows as { occupancy_rate: string; noi: string }[];
        const latestOcc = parseFloat(rows[0].occupancy_rate ?? '0');

        // NOI momentum: average of most-recent 3 months vs prior 3 months
        const recent = rows.slice(0, 3).map(r => parseFloat(r.noi ?? '0'));
        const prior  = rows.slice(3, 6).map(r => parseFloat(r.noi ?? '0'));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
        const priorAvg  = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg;
        const noiDelta  = priorAvg > 0 ? ((recentAvg - priorAvg) / Math.abs(priorAvg)) * 100 : 0;

        signals = {
          demandScore:   Math.min(100, Math.max(0, Math.round(latestOcc * 100))),
          supplyScore:   65,
          momentumScore: Math.min(100, Math.max(0, 55 + Math.round(noiDelta))),
          positionScore: 65,
          riskScore:     60,
        };
      }
    }

    const agent = new CommentaryAgent();
    const result = await agent.execute({
      entityType:  'property',
      entityId:    propertyId ?? dealId,
      entityName:  dealName,
      signals,
      forceRefresh,
      userId:      req.user!.userId,
      assetMode:   'owned',
    });

    res.json({
      success:         true,
      checkpoints:     result.investmentThesis.points,
      recommendation:  result.investmentThesis.recommendation,
      marketNarrative: result.marketNarrative.content,
      jediScore:       result.jediScore,
    });
  } catch (err) {
    logger.error('Operations commentary error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate commentary',
    });
  }
});

export default router;
