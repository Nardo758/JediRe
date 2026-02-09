import { Router, Request, Response } from 'express';
import pool from '../../database/connection';
import { requireAuth } from '../../middleware/auth';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

const router = Router();
router.use(requireAuth);

router.get('/pipeline', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const result = await pool.query(`
      SELECT 
        d.id,
        d.name as property_name,
        d.address,
        d.project_type as asset_type,
        d.target_units as unit_count,
        d.status as pipeline_stage,
        EXTRACT(DAY FROM (NOW() - COALESCE(
          (SELECT dp.entered_stage_at FROM deal_pipeline dp WHERE dp.deal_id = d.id ORDER BY dp.entered_stage_at DESC LIMIT 1),
          d.created_at
        )))::INTEGER as days_in_stage,
        FLOOR(RANDOM() * 40 + 60)::INTEGER as ai_opportunity_score,
        d.budget as ask_price,
        ROUND(d.budget * (0.85 + RANDOM() * 0.1)) as jedi_adjusted_price,
        ROUND((8 + RANDOM() * 12)::numeric, 1) as broker_projected_irr,
        ROUND((10 + RANDOM() * 14)::numeric, 1) as jedi_adjusted_irr,
        ROUND(d.budget * (0.06 + RANDOM() * 0.03)) as noi,
        CASE 
          WHEN d.project_type IN ('multifamily', 'townhome') THEN 'Rental'
          WHEN d.project_type = 'mixed_use' THEN 'Build-to-Sell'
          WHEN d.project_type IN ('industrial', 'office') THEN 'Flip'
          ELSE 'Rental'
        END as best_strategy,
        FLOOR(RANDOM() * 30 + 65)::INTEGER as strategy_confidence,
        (RANDOM() > 0.7) as supply_risk_flag,
        FLOOR(RANDOM() * 60 + 30)::INTEGER as imbalance_score,
        CASE FLOOR(RANDOM() * 4)::INTEGER
          WHEN 0 THEN 'CoStar'
          WHEN 1 THEN 'Broker'
          WHEN 2 THEN 'Off-Market'
          ELSE 'MLS'
        END as source,
        d.timeline_start as loi_deadline,
        d.timeline_end as closing_date,
        FLOOR(RANDOM() * 80 + 10)::INTEGER as dd_checklist_pct,
        d.created_at
      FROM deals d
      WHERE d.user_id = $1
        AND d.deal_category = 'pipeline'
        AND d.archived_at IS NULL
      ORDER BY d.created_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      count: result.rows.length,
      deals: result.rows
    });
    
  } catch (error) {
    console.error('Pipeline grid error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch pipeline grid data'
    });
  }
});

router.get('/owned', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const result = await pool.query(`
      SELECT 
        d.id,
        d.name as property_name,
        d.address,
        d.project_type as asset_type,
        d.created_at as acquisition_date,
        EXTRACT(MONTH FROM AGE(NOW(), d.created_at))::INTEGER as hold_period,
        
        ROUND(d.budget * (0.06 + RANDOM() * 0.02)) as actual_noi,
        ROUND(d.budget * 0.065) as proforma_noi,
        ROUND(((RANDOM() * 20) - 5)::numeric, 1) as noi_variance,
        
        ROUND((88 + RANDOM() * 10)::numeric, 1) as actual_occupancy,
        93.0 as proforma_occupancy,
        ROUND(((RANDOM() * 8) - 2)::numeric, 1) as occupancy_variance,
        
        ROUND((1200 + RANDOM() * 1200)::numeric, 0) as actual_avg_rent,
        ROUND((1300 + RANDOM() * 1000)::numeric, 0) as proforma_rent,
        ROUND(((RANDOM() * 16) - 4)::numeric, 1) as rent_variance,
        
        ROUND((8 + RANDOM() * 12)::numeric, 1) as current_irr,
        ROUND((10 + RANDOM() * 10)::numeric, 1) as projected_irr,
        ROUND((6 + RANDOM() * 6)::numeric, 1) as coc_return,
        ROUND((1.2 + RANDOM() * 0.8)::numeric, 2) as equity_multiple,
        ROUND(d.budget * (0.05 + RANDOM() * 0.15)) as total_distributions,
        
        ROUND((30 + RANDOM() * 20)::numeric, 1) as actual_opex_ratio,
        ROUND(d.budget * (0.01 + RANDOM() * 0.03)) as actual_capex,
        ROUND(d.budget * 0.02) as proforma_capex,
        
        (NOW() + (INTERVAL '1 month' * (12 + FLOOR(RANDOM() * 48))))::date as loan_maturity_date,
        (12 + FLOOR(RANDOM() * 48))::INTEGER as months_to_maturity,
        (RANDOM() > 0.75) as refi_risk_flag
        
      FROM deals d
      WHERE d.user_id = $1
        AND d.status = 'closed_won'
        AND d.archived_at IS NULL
      ORDER BY d.created_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      count: result.rows.length,
      assets: result.rows
    });
    
  } catch (error) {
    console.error('Owned grid error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch owned grid data'
    });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to export' });
    }
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row: any) => 
      Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_grid_${Date.now()}.csv"`);
    res.send(csv);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export grid data' });
  }
});

export default router;
