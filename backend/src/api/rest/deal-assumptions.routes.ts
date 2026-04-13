/**
 * Deal Assumptions API Routes
 * 
 * Endpoints for managing deal underwriting assumptions
 */

import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { 
  DealAssumptionsInput, 
  SiteDataInput, 
  ComputedReturns,
  DEFAULT_ASSUMPTIONS 
} from '../../types/deal-assumptions.types';
import * as XLSX from 'xlsx';
import { seedProFormaYear1 } from '../../services/proforma-seeder.service';
import { getDealFinancials, applyFinancialsOverride } from '../../services/proforma-adjustment.service';
import { buildF9Workbook } from '../../services/f9-financial-export.service';

const router = Router();

// ─── Narrative cache (24h per deal) ──────────────────────────────────────────
const narrativeCache = new Map<string, { text: string | null; generatedAt: number }>();
const NARRATIVE_TTL_MS = 24 * 60 * 60 * 1000;
const pool = getPool();

router.get('/:dealId/assumptions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM deal_assumptions WHERE deal_id = $1',
      [dealId]
    );
    
    if (result.rows.length === 0) {
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

router.put('/:dealId/assumptions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const input: DealAssumptionsInput = req.body;
    
    const sourceType = (input as any).sourceType || 'manual';
    const sourceRef = (input as any).sourceRef || null;
    const sourceDate = (input as any).sourceDate || null;

    const result = await pool.query(`
      INSERT INTO deal_assumptions (
        deal_id, land_cost, hard_cost_psf, soft_cost_pct, contingency_pct,
        developer_fee_pct, total_units, avg_unit_sf, efficiency, stories,
        construction_type, parking_type, unit_mix, avg_rent_per_unit,
        vacancy_pct, opex_ratio, interest_rate, ltc, exit_cap, hold_period_years,
        source_type, source_ref, source_date,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW()
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
        source_type = COALESCE($21, deal_assumptions.source_type),
        source_ref = $22,
        source_date = $23,
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
      input.holdPeriodYears,
      sourceType,
      sourceRef,
      sourceDate,
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

router.post('/:dealId/compute-returns', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const overrides: DealAssumptionsInput = req.body;
    
    const assumptionsResult = await pool.query(
      'SELECT * FROM deal_assumptions WHERE deal_id = $1',
      [dealId]
    );
    
    const siteResult = await pool.query(`
      SELECT p.lot_size_acres, p.max_units, p.zoning_code 
      FROM properties p
      JOIN deal_properties dp ON dp.property_id = p.id
      WHERE dp.deal_id = $1
      LIMIT 1
    `, [dealId]);
    
    const dealResult = await pool.query(
      'SELECT target_units, budget FROM deals WHERE id = $1',
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      ...(assumptionsResult.rows[0] || {}),
      ...overrides
    };
    
    const site = siteResult.rows[0] || {};
    const deal = dealResult.rows[0];
    
    const n = (v: any, fallback: number) => {
      const parsed = parseFloat(v);
      return isNaN(parsed) ? fallback : parsed;
    };

    const units = n(assumptions.total_units, 0) || n(deal.target_units, 0);
    if (!units || units <= 0) {
      return res.status(400).json({ 
        error: 'Cannot compute returns without total_units. Set totalUnits in assumptions or target_units on the deal first.' 
      });
    }

    const returns = computeReturns({
      landCost: n(assumptions.land_cost, 0) || n(overrides.landCost, 0),
      units,
      avgUnitSf: n(assumptions.avg_unit_sf, 900),
      efficiency: n(assumptions.efficiency, 0.85),
      hardCostPsf: n(assumptions.hard_cost_psf, 185),
      softCostPct: n(assumptions.soft_cost_pct, 25),
      contingencyPct: n(assumptions.contingency_pct, 5),
      developerFeePct: n(assumptions.developer_fee_pct, 4),
      avgRentPerUnit: n(assumptions.avg_rent_per_unit, 1950),
      vacancyPct: n(assumptions.vacancy_pct, 5),
      opexRatio: n(assumptions.opex_ratio, 35),
      interestRate: n(assumptions.interest_rate, 0.075),
      ltc: n(assumptions.ltc, 0.65),
      exitCap: n(assumptions.exit_cap, 0.05),
      holdPeriodYears: n(assumptions.hold_period_years, 3),
    });
    
    if (assumptionsResult.rows.length > 0) {
      await pool.query(`
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
    }
    
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

router.put('/:dealId/site-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const input: SiteDataInput = req.body;
    
    const propLookup = await pool.query(
      'SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1',
      [dealId]
    );

    if (propLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found for this deal' });
    }

    const propertyId = propLookup.rows[0].property_id;

    const result = await pool.query(`
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
      WHERE id = $1
      RETURNING *
    `, [
      propertyId,
      input.lotSizeAcres,
      input.parcelId,
      input.zoningCode,
      input.maxFar,
      input.maxStories,
      input.maxUnits,
      input.parkingRequired,
      input.zoningSource
    ]);
    
    if (input.lotSizeAcres) {
      await pool.query('UPDATE deals SET acres = $2 WHERE id = $1', [dealId, input.lotSizeAcres]);
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

router.get('/:dealId/full-context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM v_deal_summary WHERE id = $1',
      [dealId]
    );
    
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

/**
 * GET /:dealId/financials
 *
 * Thin controller — delegates to getDealFinancials() in proforma-adjustment.service.
 * Returns the full DealFinancials contract: { proforma, trafficProjection, assumptions }
 *
 * Query params:
 *   seed=true — (re)run seedProFormaYear1 before assembly (default: false)
 *   hold=N    — hold period in years for traffic projections (default: 10)
 */
router.get('/:dealId/financials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const holdYears = Math.min(Math.max(parseInt(req.query.hold as string) || 10, 1), 30);
    const runSeed = req.query.seed === 'true';

    if (runSeed) {
      await seedProFormaYear1(pool, dealId);
    }

    const data = await getDealFinancials(pool, dealId, holdYears);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Error fetching deal financials:', error);
    const status = (error as Error).message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

/**
 * POST /:dealId/financials/reparse
 *
 * Force-rerun seedProFormaYear1 (re-ingests all extraction capsule signals),
 * then re-assembles and returns a fresh DealFinancials contract.
 */
router.post('/:dealId/financials/reparse', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const holdYears = Math.min(Math.max(parseInt(req.query.hold as string) || 10, 1), 30);
    await seedProFormaYear1(pool, dealId);
    const data = await getDealFinancials(pool, dealId, holdYears);
    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Error reparsing deal financials:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * PATCH /:dealId/financials/override
 *
 * Thin controller — delegates to applyFinancialsOverride() in proforma-adjustment.service.
 * Cell-coordinate override in the year1 LayeredValue seed.
 *
 * Body: { field: string, year?: number | null, value: number | null }
 *   field — camelCase field name (e.g. "vacancyPct", "gpr", "realEstateTax")
 *   year  — hold year (1-10); null or omitted = year 1 seed override
 *   value — numeric override, or null to clear (falls back to priority resolution)
 */
router.patch('/:dealId/financials/override', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { field, year = null, value } = req.body as { field: string; year?: number | null; value: number | null };
    const userId = req.user?.userId ?? 'unknown';

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'field is required (camelCase field name, e.g. "vacancyPct")' });
    }
    if (value !== null && value !== undefined && typeof value !== 'number') {
      return res.status(400).json({ error: 'value must be a number or null' });
    }

    const result = await applyFinancialsOverride(pool, dealId, field, year ?? null, value ?? null, userId);
    res.json({ success: true, data: { dealId, ...result } });
  } catch (error: any) {
    logger.error('Error applying financials override:', error);
    const status = error.message?.includes('No year1 seed') ? 422
      : error.message?.includes('not a layered value') || error.message?.includes('Field path invalid') ? 400
      : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

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
  
  const grossSf = units * avgUnitSf / efficiency;
  const rentableSf = units * avgUnitSf;
  
  const hardCosts = grossSf * hardCostPsf;
  const softCosts = hardCosts * (softCostPct / 100);
  const contingency = (hardCosts + softCosts) * (contingencyPct / 100);
  const subtotal = landCost + hardCosts + softCosts + contingency;
  const developerFee = subtotal * (developerFeePct / 100);
  const tdc = subtotal + developerFee;
  const tdcPerUnit = tdc / units;
  const tdcPerSf = tdc / rentableSf;
  
  const grossPotentialRent = avgRentPerUnit * units * 12;
  const effectiveGrossIncome = grossPotentialRent * (1 - vacancyPct / 100);
  const operatingExpenses = effectiveGrossIncome * (opexRatio / 100);
  const noiStabilized = effectiveGrossIncome - operatingExpenses;
  
  const loanAmount = tdc * ltc;
  const equityRequired = tdc - loanAmount;
  const annualDebtService = loanAmount * interestRate;
  
  const yieldOnCost = noiStabilized / tdc;
  const stabilizedValue = noiStabilized / exitCap;
  const profit = stabilizedValue - tdc;
  const profitMargin = profit / tdc;
  
  const cashFlowYr1 = noiStabilized - annualDebtService;
  const cashOnCashYr1 = cashFlowYr1 / equityRequired;
  
  const interestReserve = loanAmount * interestRate * (holdPeriodYears / 2);
  const totalEquity = equityRequired + interestReserve;
  const cashToEquity = stabilizedValue - loanAmount;
  const equityMultiple = cashToEquity / totalEquity;
  
  const irrLevered = Math.pow(equityMultiple, 1 / holdPeriodYears) - 1;
  const irrUnlevered = Math.pow(stabilizedValue / tdc, 1 / holdPeriodYears) - 1;
  
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

/**
 * GET /:dealId/financials/narrative
 *
 * Returns AI-synthesized M07 narrative for the deal, cached in-memory for 24h.
 * Use ?refresh=true to force regeneration.
 */
router.get('/:dealId/financials/narrative', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();
    const cached = narrativeCache.get(dealId);

    if (!forceRefresh && cached && (now - cached.generatedAt) < NARRATIVE_TTL_MS) {
      return res.json({
        success: true,
        data: {
          narrative: cached.text,
          cachedAt: new Date(cached.generatedAt).toISOString(),
          fresh: false,
        },
      });
    }

    const data = await getDealFinancials(pool, dealId, 10);
    const narrative = data.assumptions.narrative;
    narrativeCache.set(dealId, { text: narrative, generatedAt: now });

    res.json({
      success: true,
      data: {
        narrative,
        cachedAt: new Date(now).toISOString(),
        fresh: true,
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching deal financials narrative:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /:dealId/financials/export
 *
 * Downloads an XLSX workbook with three sheets:
 *   1. Pro Forma — per-year operating statement with live formula cells + layer metadata comments
 *   2. Traffic Projection — per-year M07 signal data
 *   3. Assumptions — GPR decomposition, capital stack, hold/exit parameters
 *
 * Query params:
 *   hold=N — hold period in years (default: 10)
 */
router.get('/:dealId/financials/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const holdYears = Math.min(Math.max(parseInt(req.query.hold as string) || 10, 1), 30);

    const data = await getDealFinancials(pool, dealId, holdYears);
    const wb   = buildF9Workbook(data, holdYears);

    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      bookSST: false,
      cellStyles: true,
    }) as Buffer;

    const safeName = data.dealName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
    const filename  = `${safeName}_ProForma_${holdYears}yr.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error: unknown) {
    logger.error('Error exporting deal financials XLSX:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

export default router;
