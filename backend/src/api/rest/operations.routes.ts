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

    const result = await query(
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

export default router;
