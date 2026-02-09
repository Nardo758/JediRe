/**
 * Grid API Routes - Pipeline & Assets Owned Grid Views
 * Provides grid data for comprehensive deal tracking
 */

import { Router } from 'express';
import { pool } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/grid/pipeline
 * Pipeline grid data with all tracking columns
 */
router.get('/pipeline', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user-id'; // TODO: Get from auth
    const { sort, filter } = req.query;
    
    // Build base query
    let query = `
      SELECT 
        d.id,
        d.name as property_name,
        d.property_address as address,
        d.project_type as asset_type,
        d.target_units as unit_count,
        d.status as pipeline_stage,
        d.days_in_stage,
        d.ai_opportunity_score,
        d.budget as ask_price,
        d.jedi_adjusted_price,
        d.broker_projected_irr,
        d.jedi_adjusted_irr,
        d.jedi_adjusted_noi as noi,
        d.best_strategy,
        d.strategy_confidence,
        d.supply_risk_flag,
        d.imbalance_score,
        d.source,
        d.loi_deadline,
        d.timeline_end as closing_date,
        d.dd_checklist_pct,
        d.created_at
      FROM deals d
      WHERE d.user_id = $1
        AND (d.deal_category = 'pipeline' OR d.deal_category IS NULL)
        AND (d.status != 'archived' OR d.status IS NULL)
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;
    
    // Add filters
    if (filter) {
      try {
        const filters = JSON.parse(filter as string);
        
        if (filters.stage) {
          query += ` AND d.status = $${paramIndex++}`;
          params.push(filters.stage);
        }
        
        if (filters.minScore !== undefined) {
          query += ` AND d.ai_opportunity_score >= $${paramIndex++}`;
          params.push(filters.minScore);
        }
        
        if (filters.maxPrice !== undefined) {
          query += ` AND d.budget <= $${paramIndex++}`;
          params.push(filters.maxPrice);
        }
        
        if (filters.assetType) {
          query += ` AND d.project_type = $${paramIndex++}`;
          params.push(filters.assetType);
        }
        
        if (filters.supplyRisk !== undefined) {
          query += ` AND d.supply_risk_flag = $${paramIndex++}`;
          params.push(filters.supplyRisk);
        }
      } catch (err) {
        console.error('Filter parse error:', err);
      }
    }
    
    // Add sorting
    if (sort) {
      try {
        const { column, direction } = JSON.parse(sort as string);
        const allowedColumns = [
          'name', 'property_address', 'project_type', 'target_units', 'status',
          'days_in_stage', 'ai_opportunity_score', 'budget', 'jedi_adjusted_price',
          'broker_projected_irr', 'jedi_adjusted_irr', 'jedi_adjusted_noi',
          'best_strategy', 'strategy_confidence', 'imbalance_score', 'created_at'
        ];
        
        if (allowedColumns.includes(column)) {
          const dir = direction === 'desc' ? 'DESC' : 'ASC';
          query += ` ORDER BY d.${column} ${dir} NULLS LAST`;
        } else {
          query += ` ORDER BY d.created_at DESC`;
        }
      } catch (err) {
        console.error('Sort parse error:', err);
        query += ` ORDER BY d.created_at DESC`;
      }
    } else {
      query += ` ORDER BY d.created_at DESC`;
    }
    
    // Execute query
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      deals: result.rows
    });
    
  } catch (error) {
    console.error('Pipeline grid error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch pipeline grid data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/grid/owned
 * Assets owned grid data with performance tracking
 */
router.get('/owned', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user-id'; // TODO: Get from auth
    const { sort, filter } = req.query;
    
    let query = `
      SELECT 
        d.id,
        d.name as property_name,
        d.property_address as address,
        d.project_type as asset_type,
        d.created_at as acquisition_date,
        EXTRACT(MONTH FROM AGE(NOW(), d.created_at))::INTEGER as hold_period,
        
        -- Performance (from latest deal_performance record)
        dp.actual_noi,
        dp.proforma_noi,
        CASE WHEN dp.proforma_noi > 0 
          THEN ROUND(((dp.actual_noi - dp.proforma_noi) / dp.proforma_noi * 100)::numeric, 2)
          ELSE 0 
        END as noi_variance,
        
        dp.actual_occupancy,
        dp.proforma_occupancy,
        ROUND((dp.actual_occupancy - dp.proforma_occupancy)::numeric, 2) as occupancy_variance,
        
        dp.actual_avg_rent,
        dp.proforma_rent,
        CASE WHEN dp.proforma_rent > 0
          THEN ROUND(((dp.actual_avg_rent - dp.proforma_rent) / dp.proforma_rent * 100)::numeric, 2)
          ELSE 0
        END as rent_variance,
        
        -- Returns
        dp.current_irr,
        dp.projected_irr,
        dp.coc_return,
        dp.equity_multiple,
        dp.total_distributions,
        
        -- Operational
        dp.actual_opex_ratio,
        dp.actual_capex,
        dp.proforma_capex,
        
        -- Risk
        dp.loan_maturity_date,
        dp.months_to_maturity,
        dp.refi_risk_flag
        
      FROM deals d
      LEFT JOIN LATERAL (
        SELECT * FROM deal_performance
        WHERE deal_id = d.id
        ORDER BY period_end DESC
        LIMIT 1
      ) dp ON true
      WHERE d.user_id = $1
        AND d.deal_category = 'portfolio'
        AND (d.status != 'archived' OR d.status IS NULL)
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;
    
    // Add filters
    if (filter) {
      try {
        const filters = JSON.parse(filter as string);
        
        if (filters.minIRR !== undefined) {
          query += ` AND dp.current_irr >= $${paramIndex++}`;
          params.push(filters.minIRR);
        }
        
        if (filters.refiRisk) {
          query += ` AND dp.refi_risk_flag = true`;
        }
        
        if (filters.assetType) {
          query += ` AND d.project_type = $${paramIndex++}`;
          params.push(filters.assetType);
        }
        
        if (filters.underperforming) {
          query += ` AND dp.noi_variance < -10`; // More than 10% below pro forma
        }
      } catch (err) {
        console.error('Filter parse error:', err);
      }
    }
    
    // Add sorting
    if (sort) {
      try {
        const { column, direction } = JSON.parse(sort as string);
        const dir = direction === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${column} ${dir} NULLS LAST`;
      } catch (err) {
        console.error('Sort parse error:', err);
        query += ` ORDER BY d.created_at DESC`;
      }
    } else {
      query += ` ORDER BY d.created_at DESC`;
    }
    
    // Execute query
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      assets: result.rows
    });
    
  } catch (error) {
    console.error('Owned grid error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch owned grid data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/grid/export
 * Export grid data to CSV
 */
router.post('/export', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to export' });
    }
    
    // Generate CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row: any) => 
      Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    
    // Set headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_grid_${Date.now()}.csv"`);
    res.send(csv);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export grid data' });
  }
});

export default router;
