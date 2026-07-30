/**
 * Property Geo REST Routes
 * GET /api/v1/properties/geo — returns geo-located properties with performance metrics
 * For mapping surface pipeline/portfolio overlay with metric-driven pin coloring.
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/properties/geo
 *
 * Query params:
 *   status     — 'pipeline' | 'owned' | 'both'  (default: 'both')
 *   limit      — max results (default: 500)
 *   city       — filter by city (optional)
 *   submarket  — filter by submarket (optional)
 *
 * Returns: Array of property geo objects with latest monthly actuals
 */
router.get('/geo', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      status = 'both',
      limit = '500',
      city,
      submarket,
    } = req.query;

    const maxLimit = Math.min(parseInt(limit as string, 10) || 500, 1000);

    // Build WHERE clauses
    const conditions: string[] = ['p.lat IS NOT NULL', 'p.lng IS NOT NULL'];
    const params: any[] = [];
    let paramIdx = 1;

    if (status === 'pipeline') {
      conditions.push(`p.ownership_status = 'pipeline'`);
    } else if (status === 'owned') {
      conditions.push(`p.ownership_status = 'owned'`);
    } else {
      conditions.push(`p.ownership_status IN ('pipeline', 'owned')`);
    }

    if (city) {
      conditions.push(`p.city ILIKE $${paramIdx}`);
      params.push(`%${city}%`);
      paramIdx++;
    }

    if (submarket) {
      conditions.push(`p.submarket ILIKE $${paramIdx}`);
      params.push(`%${submarket}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Query: properties + latest monthly actuals per property
    const sql = `
      SELECT
        p.id,
        p.name,
        p.address_line1 AS address,
        p.city,
        p.state_code AS state,
        p.zip,
        p.submarket,
        p.units,
        p.property_type,
        p.ownership_status,
        p.pipeline_stage,
        p.jedi_score,
        p.recommended_strategy,
        p.lat::float AS lat,
        p.lng::float AS lng,
        p.current_occupancy::float AS current_occupancy,
        p.avg_rent::float AS avg_rent,
        p.market_rent::float AS market_rent,
        p.acquisition_price::float AS acquisition_price,
        p.created_at,
        -- latest monthly actuals
        dma.occupancy_rate::float AS occ_rate,
        dma.avg_effective_rent::float AS eff_rent,
        dma.avg_market_rent::float AS mkt_rent,
        dma.concessions::float AS concessions,
        dma.vacancy_loss::float AS vacancy_loss,
        dma.loss_to_lease::float AS loss_to_lease,
        dma.bad_debt::float AS bad_debt,
        dma.noi::float AS noi,
        dma.noi_per_unit::float AS noi_per_unit,
        dma.effective_gross_income::float AS egi,
        dma.opex_ratio::float AS opex_ratio,
        dma.report_month AS metrics_month
      FROM properties p
      LEFT JOIN LATERAL (
        SELECT *
        FROM deal_monthly_actuals
        WHERE property_id = p.id
        ORDER BY report_month DESC
        LIMIT 1
      ) dma ON true
      WHERE ${whereClause}
      ORDER BY p.jedi_score DESC NULLS LAST
      LIMIT ${maxLimit}
    `;

    const result = await query(sql, params);

    const properties = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name || 'Untitled',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',
      submarket: row.submarket || '',
      units: row.units,
      propertyType: row.property_type,
      ownershipStatus: row.ownership_status,
      pipelineStage: row.pipeline_stage,
      jediScore: row.jedi_score,
      recommendedStrategy: row.recommended_strategy,
      lat: row.lat,
      lng: row.lng,
      acquisitionPrice: row.acquisition_price,
      // Current property-level metrics (fallback to monthly actuals)
      metrics: {
        occupancyRate: row.occ_rate ?? row.current_occupancy,
        avgEffectiveRent: row.eff_rent ?? row.avg_rent,
        avgMarketRent: row.mkt_rent ?? row.market_rent,
        concessions: row.concessions,
        vacancyLoss: row.vacancy_loss,
        lossToLease: row.loss_to_lease,
        badDebt: row.bad_debt,
        noi: row.noi,
        noiPerUnit: row.noi_per_unit,
        effectiveGrossIncome: row.egi,
        opexRatio: row.opex_ratio,
        month: row.metrics_month,
      },
    }));

    res.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    logger.error('Property geo query failed:', error);
    next(error);
  }
});

export default router;
