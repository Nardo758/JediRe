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

const router = Router();

// ─── Operations Summary ───────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/summary
 * Get comprehensive operations summary with health score
 */
router.get('/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await getOperationsSummary(req.params.dealId);
    res.json({ success: true, ...summary });
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

// ─── Traffic Analysis ─────────────────────────────────────────────────

/**
 * GET /api/v1/operations/:dealId/traffic
 * Get traffic analysis vs predictions
 */
router.get('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { months = '3' } = req.query;
    const analysis = await analyzeTrafficPerformance(req.params.dealId, parseInt(months as string, 10));
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

export default router;
