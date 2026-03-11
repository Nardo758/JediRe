import { Router, Request, Response } from 'express';
import pool from '../../database/connection';
import { optionalAuth } from '../../middleware/auth';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

const router = Router();
router.use(optionalAuth);

async function getPropertyIdsForDeal(dealId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT property_id FROM deal_properties WHERE deal_id = $1`,
    [dealId]
  );
  return result.rows.map((r: any) => r.property_id);
}

async function verifyDealAccess(dealId: string, userId: string | undefined): Promise<any> {
  const result = await pool.query(`
    SELECT 
      d.id, d.name, d.address, d.property_address,
      d.target_units, d.project_type, d.status, d.state,
      d.deal_category, d.budget, d.description,
      d.created_at, d.updated_at,
      d.property_data
    FROM deals d
    WHERE d.id = $1 
      AND d.deal_category = 'portfolio'
      AND d.status = 'closed_won'
      AND d.archived_at IS NULL
      ${userId ? 'AND d.user_id = $2' : ''}
  `, userId ? [dealId, userId] : [dealId]);
  return result.rows[0] || null;
}

router.get('/:dealId/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;

    const deal = await verifyDealAccess(dealId, userId);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const propertyIds = await getPropertyIdsForDeal(dealId);

    let latestActuals: any = { rows: [] };
    if (propertyIds.length > 0) {
      latestActuals = await pool.query(`
        SELECT *
        FROM deal_monthly_actuals
        WHERE property_id = ANY($1)
        ORDER BY report_month DESC
        LIMIT 1
      `, [propertyIds]);
    }

    const unitProgram = await pool.query(`
      SELECT total_units, unit_config
      FROM deal_unit_programs
      WHERE deal_id = $1
      LIMIT 1
    `, [dealId]);

    const leaseStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new') as new_leases,
        COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal') as renewals,
        ROUND(AVG(new_rent)::numeric, 0) as avg_rent,
        ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new')::numeric, 0) as avg_new_rent,
        ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric, 0) as avg_renewal_rent,
        ROUND(AVG(rent_change_pct) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric, 1) as avg_renewal_bump_pct,
        ROUND(AVG(loss_to_lease_pct)::numeric, 1) as avg_loss_to_lease_pct
      FROM deal_lease_transactions
      WHERE deal_id = $1
    `, [dealId]);

    const trafficStats = await pool.query(`
      SELECT 
        COUNT(*) as total_weeks,
        MIN(week_ending) as first_week,
        MAX(week_ending) as last_week,
        ROUND(AVG(traffic)::numeric, 1) as avg_weekly_traffic,
        ROUND(AVG(closing_ratio)::numeric, 1) as avg_closing_ratio
      FROM weekly_traffic_snapshots
      WHERE deal_id = $1
    `, [dealId]);

    const propertyData = deal.property_data || {};

    res.json({
      success: true,
      deal: {
        id: deal.id,
        name: deal.name,
        address: deal.property_address || deal.address,
        units: deal.target_units || propertyData.units || 0,
        projectType: deal.project_type,
        status: deal.status,
        state: deal.state,
        category: deal.deal_category,
        budget: deal.budget,
        description: deal.description,
        createdAt: deal.created_at,
        vintage: propertyData.year_built || null,
        class: propertyData.class || 'A',
        operator: propertyData.owner_name || null,
        county: propertyData.county || null,
      },
      latestFinancials: latestActuals.rows[0] || null,
      unitProgram: unitProgram.rows[0] || null,
      leaseStats: leaseStats.rows[0] || null,
      trafficStats: trafficStats.rows[0] || null,
    });
  } catch (error) {
    console.error('Portfolio summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio summary' });
  }
});

router.get('/:dealId/financials', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const deal = await verifyDealAccess(dealId, userId);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const propertyIds = await getPropertyIdsForDeal(dealId);
    if (propertyIds.length === 0) {
      return res.json({ success: true, months: 0, data: [] });
    }

    const result = await pool.query(`
      SELECT 
        report_month,
        occupancy_rate,
        avg_market_rent,
        avg_effective_rent,
        gross_potential_rent,
        net_rental_income,
        total_opex,
        noi,
        noi_per_unit,
        capex,
        cash_flow_before_tax,
        debt_service,
        new_leases,
        renewals,
        payroll,
        repairs_maintenance,
        turnover_costs,
        marketing,
        admin_general,
        management_fee,
        utilities,
        property_tax,
        insurance
      FROM deal_monthly_actuals
      WHERE property_id = ANY($1)
      ORDER BY report_month ASC
    `, [propertyIds]);

    res.json({
      success: true,
      months: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Portfolio financials error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch financials' });
  }
});

router.get('/:dealId/leasing', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const deal = await verifyDealAccess(dealId, userId);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const limit = parseInt(req.query.limit as string) || 50;

    const monthlyStats = await pool.query(`
      SELECT 
        DATE_TRUNC('month', lease_start)::date as month,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new') as new_leases,
        COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal') as renewals,
        ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new')::numeric, 0) as avg_new_rent,
        ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric, 0) as avg_renewal_rent,
        ROUND(AVG(rent_change_dollar) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric, 0) as avg_renewal_bump,
        ROUND(AVG(rent_change_pct) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric, 1) as avg_renewal_bump_pct,
        ROUND(AVG(loss_to_lease_pct)::numeric, 1) as avg_loss_to_lease_pct,
        ROUND(AVG(market_rent)::numeric, 0) as avg_market_rent
      FROM deal_lease_transactions
      WHERE deal_id = $1
      GROUP BY DATE_TRUNC('month', lease_start)
      ORDER BY month ASC
    `, [dealId]);

    const retentionByQuarter = await pool.query(`
      SELECT 
        DATE_TRUNC('quarter', lease_start)::date as quarter,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal') as renewals,
        ROUND(
          COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric 
          / NULLIF(COUNT(*), 0) * 100, 1
        ) as retention_rate
      FROM deal_lease_transactions
      WHERE deal_id = $1
      GROUP BY DATE_TRUNC('quarter', lease_start)
      ORDER BY quarter ASC
    `, [dealId]);

    const recentTransactions = await pool.query(`
      SELECT 
        unit_number, unit_type, sqft, lease_type,
        lease_start, market_rent, prior_rent, new_rent,
        rent_change_dollar, rent_change_pct,
        loss_to_lease, loss_to_lease_pct, rent_psf
      FROM deal_lease_transactions
      WHERE deal_id = $1
      ORDER BY lease_start DESC
      LIMIT $2
    `, [dealId, limit]);

    res.json({
      success: true,
      monthlyStats: monthlyStats.rows,
      retentionByQuarter: retentionByQuarter.rows,
      recentTransactions: recentTransactions.rows,
    });
  } catch (error) {
    console.error('Portfolio leasing error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leasing data' });
  }
});

router.get('/:dealId/traffic', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const deal = await verifyDealAccess(dealId, userId);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const result = await pool.query(`
      SELECT 
        week_ending, traffic, in_person_tours, 
        apps, net_leases, closing_ratio,
        move_ins, move_outs, end_occ, occ_pct, leased_pct
      FROM weekly_traffic_snapshots
      WHERE deal_id = $1
      ORDER BY week_ending ASC
    `, [dealId]);

    res.json({
      success: true,
      weeks: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Portfolio traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch traffic data' });
  }
});

export default router;
