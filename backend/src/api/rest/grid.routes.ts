import { Router, Request, Response } from 'express';
import pool from '../../database/connection';
import { optionalAuth } from '../../middleware/auth';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

const router = Router();
router.use(optionalAuth);

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
    const userId = req.user?.userId;
    
    if (!userId) {
      const mockAssets = [
        { id: 'demo-1', property_name: 'Peachtree Towers', address: '1200 Peachtree St NE, Atlanta, GA', asset_type: 'multifamily', acquisition_date: '2024-03-15', hold_period: 23, actual_noi: 2850000, proforma_noi: 2700000, noi_variance: 5.6, actual_occupancy: 94.2, proforma_occupancy: 93.0, occupancy_variance: 1.3, actual_avg_rent: 1850, proforma_rent: 1780, rent_variance: 3.9, current_irr: 14.2, projected_irr: 12.5, coc_return: 8.4, equity_multiple: 1.65, total_distributions: 1200000, actual_opex_ratio: 38.5, actual_capex: 450000, proforma_capex: 400000, loan_maturity_date: '2028-06-15', months_to_maturity: 28, refi_risk_flag: false },
        { id: 'demo-2', property_name: 'Buckhead Commons', address: '3456 Piedmont Rd NE, Atlanta, GA', asset_type: 'multifamily', acquisition_date: '2023-09-01', hold_period: 29, actual_noi: 4100000, proforma_noi: 4350000, noi_variance: -5.7, actual_occupancy: 91.8, proforma_occupancy: 95.0, occupancy_variance: -3.4, actual_avg_rent: 2150, proforma_rent: 2200, rent_variance: -2.3, current_irr: 11.8, projected_irr: 13.0, coc_return: 7.2, equity_multiple: 1.42, total_distributions: 2800000, actual_opex_ratio: 42.1, actual_capex: 680000, proforma_capex: 500000, loan_maturity_date: '2027-03-01', months_to_maturity: 12, refi_risk_flag: true },
        { id: 'demo-3', property_name: 'Midtown Lofts', address: '789 Spring St NW, Atlanta, GA', asset_type: 'multifamily', acquisition_date: '2024-01-20', hold_period: 25, actual_noi: 1980000, proforma_noi: 1900000, noi_variance: 4.2, actual_occupancy: 96.1, proforma_occupancy: 94.0, occupancy_variance: 2.2, actual_avg_rent: 1720, proforma_rent: 1650, rent_variance: 4.2, current_irr: 15.6, projected_irr: 14.0, coc_return: 9.1, equity_multiple: 1.78, total_distributions: 950000, actual_opex_ratio: 35.2, actual_capex: 280000, proforma_capex: 300000, loan_maturity_date: '2029-01-20', months_to_maturity: 35, refi_risk_flag: false },
        { id: 'demo-4', property_name: 'Decatur Office Building', address: '400 Church St, Decatur, GA', asset_type: 'office', acquisition_date: '2023-06-10', hold_period: 32, actual_noi: 1450000, proforma_noi: 1600000, noi_variance: -9.4, actual_occupancy: 87.3, proforma_occupancy: 92.0, occupancy_variance: -5.1, actual_avg_rent: 1380, proforma_rent: 1500, rent_variance: -8.0, current_irr: 9.2, projected_irr: 11.5, coc_return: 6.1, equity_multiple: 1.28, total_distributions: 600000, actual_opex_ratio: 44.8, actual_capex: 520000, proforma_capex: 350000, loan_maturity_date: '2026-12-10', months_to_maturity: 10, refi_risk_flag: true },
        { id: 'demo-5', property_name: 'Sandy Springs Plaza', address: '6100 Lake Forrest Dr, Sandy Springs, GA', asset_type: 'mixed_use', acquisition_date: '2024-06-01', hold_period: 20, actual_noi: 3200000, proforma_noi: 3100000, noi_variance: 3.2, actual_occupancy: 93.5, proforma_occupancy: 92.0, occupancy_variance: 1.6, actual_avg_rent: 1950, proforma_rent: 1900, rent_variance: 2.6, current_irr: 13.4, projected_irr: 12.8, coc_return: 8.8, equity_multiple: 1.55, total_distributions: 1600000, actual_opex_ratio: 36.9, actual_capex: 390000, proforma_capex: 400000, loan_maturity_date: '2029-06-01', months_to_maturity: 40, refi_risk_flag: false },
      ];
      return res.json({ success: true, count: mockAssets.length, assets: mockAssets });
    }
    
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
