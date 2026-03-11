/**
 * Deal Assumptions API Routes
 * 
 * Endpoints for managing deal underwriting assumptions
 */

import { Router, Request, Response } from 'express';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { 
  DealAssumptionsInput, 
  SiteDataInput, 
  ComputedReturns,
  DEFAULT_ASSUMPTIONS 
} from '../../types/deal-assumptions.types';

const router = Router();

// ============================================
// GET /api/v1/deals/:dealId/assumptions
// ============================================
router.get('/:dealId/assumptions', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const result = await query(`
      SELECT * FROM deal_assumptions WHERE deal_id = $1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      // Return defaults if no assumptions exist
      return res.json({
        success: true,
        data: {
          dealId,
          ...DEFAULT_ASSUMPTIONS,
          exists: false
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        exists: true
      }
    });
  } catch (error: any) {
    logger.error('Error fetching deal assumptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PUT /api/v1/deals/:dealId/assumptions
// ============================================
router.put('/:dealId/assumptions', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const input: DealAssumptionsInput = req.body;
    
    // Upsert assumptions
    const result = await query(`
      INSERT INTO deal_assumptions (
        deal_id, land_cost, hard_cost_psf, soft_cost_pct, contingency_pct,
        developer_fee_pct, total_units, avg_unit_sf, efficiency, stories,
        construction_type, parking_type, unit_mix, avg_rent_per_unit,
        vacancy_pct, opex_ratio, interest_rate, ltc, exit_cap, hold_period_years,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )
      ON CONFLICT (deal_id) DO UPDATE SET
        land_cost = COALESCE($2, deal_assumptions.land_cost),
        hard_cost_psf = COALESCE($3, deal_assumptions.hard_cost_psf),
        soft_cost_pct = COALESCE($4, deal_assumptions.soft_cost_pct),
        contingency_pct = COALESCE($5, deal_assumptions.contingency_pct),
        developer_fee_pct = COALESCE($6, deal_assumptions.developer_fee_pct),
        total_units = COALESCE($7, deal_assumptions.total_units),
        avg_unit_sf = COALESCE($8, deal_assumptions.avg_unit_sf),
        efficiency = COALESCE($9, deal_assumptions.efficiency),
        stories = COALESCE($10, deal_assumptions.stories),
        construction_type = COALESCE($11, deal_assumptions.construction_type),
        parking_type = COALESCE($12, deal_assumptions.parking_type),
        unit_mix = COALESCE($13, deal_assumptions.unit_mix),
        avg_rent_per_unit = COALESCE($14, deal_assumptions.avg_rent_per_unit),
        vacancy_pct = COALESCE($15, deal_assumptions.vacancy_pct),
        opex_ratio = COALESCE($16, deal_assumptions.opex_ratio),
        interest_rate = COALESCE($17, deal_assumptions.interest_rate),
        ltc = COALESCE($18, deal_assumptions.ltc),
        exit_cap = COALESCE($19, deal_assumptions.exit_cap),
        hold_period_years = COALESCE($20, deal_assumptions.hold_period_years),
        updated_at = NOW()
      RETURNING *
    `, [
      dealId,
      input.landCost,
      input.hardCostPsf,
      input.softCostPct,
      input.contingencyPct,
      input.developerFeePct,
      input.totalUnits,
      input.avgUnitSf,
      input.efficiency,
      input.stories,
      input.constructionType,
      input.parkingType,
      JSON.stringify(input.unitMix || []),
      input.avgRentPerUnit,
      input.vacancyPct,
      input.opexRatio,
      input.interestRate,
      input.ltc,
      input.exitCap,
      input.holdPeriodYears
    ]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error updating deal assumptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/v1/deals/:dealId/compute-returns
// ============================================
router.post('/:dealId/compute-returns', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const overrides: DealAssumptionsInput = req.body;
    
    // Fetch existing assumptions
    const assumptionsResult = await query(`
      SELECT * FROM deal_assumptions WHERE deal_id = $1
    `, [dealId]);
    
    // Fetch site data
    const siteResult = await query(`
      SELECT lot_size_acres, max_units, zoning_code 
      FROM properties WHERE deal_id = $1
    `, [dealId]);
    
    // Fetch deal basics
    const dealResult = await query(`
      SELECT target_units, budget FROM deals WHERE id = $1
    `, [dealId]);
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    // Merge assumptions with overrides and defaults
    const assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      ...(assumptionsResult.rows[0] || {}),
      ...overrides
    };
    
    const site = siteResult.rows[0] || {};
    const deal = dealResult.rows[0];
    
    // Compute returns
    const returns = computeReturns({
      landCost: assumptions.land_cost || overrides.landCost || 0,
      units: assumptions.total_units || deal.target_units || 0,
      avgUnitSf: assumptions.avg_unit_sf || 900,
      efficiency: assumptions.efficiency || 0.85,
      hardCostPsf: assumptions.hard_cost_psf || 185,
      softCostPct: assumptions.soft_cost_pct || 25,
      contingencyPct: assumptions.contingency_pct || 5,
      developerFeePct: assumptions.developer_fee_pct || 4,
      avgRentPerUnit: assumptions.avg_rent_per_unit || 1950,
      vacancyPct: assumptions.vacancy_pct || 5,
      opexRatio: assumptions.opex_ratio || 35,
      interestRate: assumptions.interest_rate || 0.075,
      ltc: assumptions.ltc || 0.65,
      exitCap: assumptions.exit_cap || 0.05,
      holdPeriodYears: assumptions.hold_period_years || 3,
    });
    
    // Update stored computed values
    await query(`
      UPDATE deal_assumptions SET
        tdc = $2,
        tdc_per_unit = $3,
        noi_stabilized = $4,
        yield_on_cost = $5,
        irr_levered = $6,
        equity_multiple = $7,
        stabilized_value = $8,
        profit_margin = $9,
        last_computed_at = NOW()
      WHERE deal_id = $1
    `, [
      dealId,
      returns.tdc,
      returns.tdcPerUnit,
      returns.noiStabilized,
      returns.yieldOnCost,
      returns.irrLevered,
      returns.equityMultiple,
      returns.stabilizedValue,
      returns.profitMargin
    ]);
    
    res.json({
      success: true,
      data: {
        assumptions: {
          landCost: assumptions.land_cost || overrides.landCost,
          units: assumptions.total_units || deal.target_units,
          avgUnitSf: assumptions.avg_unit_sf,
          hardCostPsf: assumptions.hard_cost_psf,
          avgRentPerUnit: assumptions.avg_rent_per_unit,
          exitCap: assumptions.exit_cap,
        },
        returns,
        site: {
          lotSizeAcres: site.lot_size_acres,
          zoningCode: site.zoning_code,
          maxUnits: site.max_units,
        }
      }
    });
  } catch (error: any) {
    logger.error('Error computing returns:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PUT /api/v1/deals/:dealId/site-data
// ============================================
router.put('/:dealId/site-data', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const input: SiteDataInput = req.body;
    
    // Update properties table
    const result = await query(`
      UPDATE properties SET
        lot_size_acres = COALESCE($2, lot_size_acres),
        parcel_id = COALESCE($3, parcel_id),
        zoning_code = COALESCE($4, zoning_code),
        max_far = COALESCE($5, max_far),
        max_stories = COALESCE($6, max_stories),
        max_units = COALESCE($7, max_units),
        parking_required = COALESCE($8, parking_required),
        zoning_source = COALESCE($9, zoning_source),
        zoning_updated_at = NOW()
      WHERE deal_id = $1
      RETURNING *
    `, [
      dealId,
      input.lotSizeAcres,
      input.parcelId,
      input.zoningCode,
      input.maxFar,
      input.maxStories,
      input.maxUnits,
      input.parkingRequired,
      input.zoningSource
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found for this deal' });
    }
    
    // Also update deals.acres if lot size changed
    if (input.lotSizeAcres) {
      await query(`UPDATE deals SET acres = $2 WHERE id = $1`, [dealId, input.lotSizeAcres]);
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error updating site data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/v1/deals/:dealId/full-context
// ============================================
router.get('/:dealId/full-context', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    
    // Get everything in one query using the view
    const result = await query(`
      SELECT * FROM v_deal_summary WHERE id = $1
    `, [dealId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error fetching deal context:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Helper: Compute Returns
// ============================================
function computeReturns(params: {
  landCost: number;
  units: number;
  avgUnitSf: number;
  efficiency: number;
  hardCostPsf: number;
  softCostPct: number;
  contingencyPct: number;
  developerFeePct: number;
  avgRentPerUnit: number;
  vacancyPct: number;
  opexRatio: number;
  interestRate: number;
  ltc: number;
  exitCap: number;
  holdPeriodYears: number;
}): ComputedReturns {
  const {
    landCost, units, avgUnitSf, efficiency, hardCostPsf,
    softCostPct, contingencyPct, developerFeePct,
    avgRentPerUnit, vacancyPct, opexRatio,
    interestRate, ltc, exitCap, holdPeriodYears
  } = params;
  
  // Building
  const grossSf = units * avgUnitSf / efficiency;
  const rentableSf = units * avgUnitSf;
  
  // Development Costs
  const hardCosts = grossSf * hardCostPsf;
  const softCosts = hardCosts * (softCostPct / 100);
  const contingency = (hardCosts + softCosts) * (contingencyPct / 100);
  const subtotal = landCost + hardCosts + softCosts + contingency;
  const developerFee = subtotal * (developerFeePct / 100);
  const tdc = subtotal + developerFee;
  const tdcPerUnit = tdc / units;
  const tdcPerSf = tdc / rentableSf;
  
  // Revenue
  const grossPotentialRent = avgRentPerUnit * units * 12;
  const effectiveGrossIncome = grossPotentialRent * (1 - vacancyPct / 100);
  const operatingExpenses = effectiveGrossIncome * (opexRatio / 100);
  const noiStabilized = effectiveGrossIncome - operatingExpenses;
  
  // Financing
  const loanAmount = tdc * ltc;
  const equityRequired = tdc - loanAmount;
  const annualDebtService = loanAmount * interestRate;  // IO assumption
  
  // Returns
  const yieldOnCost = noiStabilized / tdc;
  const stabilizedValue = noiStabilized / exitCap;
  const profit = stabilizedValue - tdc;
  const profitMargin = profit / tdc;
  
  // Cash flow (simplified, IO period)
  const cashFlowYr1 = noiStabilized - annualDebtService;
  const cashOnCashYr1 = cashFlowYr1 / equityRequired;
  
  // Equity metrics
  const interestReserve = loanAmount * interestRate * (holdPeriodYears / 2);
  const totalEquity = equityRequired + interestReserve;
  const cashToEquity = stabilizedValue - loanAmount;
  const equityMultiple = cashToEquity / totalEquity;
  
  // IRR approximation
  const irrLevered = Math.pow(equityMultiple, 1 / holdPeriodYears) - 1;
  const irrUnlevered = Math.pow(stabilizedValue / tdc, 1 / holdPeriodYears) - 1;
  
  // Ratios
  const dscr = noiStabilized / annualDebtService;
  const debtYield = noiStabilized / loanAmount;
  const ltv = loanAmount / stabilizedValue;
  
  return {
    tdc,
    tdcPerUnit,
    tdcPerSf,
    grossPotentialRent,
    effectiveGrossIncome,
    operatingExpenses,
    noiStabilized,
    loanAmount,
    equityRequired,
    annualDebtService,
    yieldOnCost,
    stabilizedValue,
    profit,
    profitMargin,
    cashOnCashYr1,
    irrLevered,
    irrUnlevered,
    equityMultiple,
    dscr,
    debtYield,
    ltv,
  };
}

export default router;
