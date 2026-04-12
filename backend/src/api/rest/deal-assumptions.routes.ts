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
import { seedProFormaYear1, applyUserOverride } from '../../services/proforma-seeder.service';

const router = Router();
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
 * Returns the full DealFinancials contract:
 *   { proforma, trafficProjection, assumptions }
 * 
 * Proforma section is built from deal_assumptions.year1 (LayeredValue seed).
 * Traffic section is pulled from the M07 handoff for the linked property (non-blocking).
 * Integrity checks are derived server-side from the resolved values.
 * 
 * Query params:
 *   seed=true  — (re)run seedProFormaYear1 before returning (default: false)
 */
router.get('/:dealId/financials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const runSeed = req.query.seed === 'true';

    if (runSeed) {
      await seedProFormaYear1(pool, dealId);
    }

    const [assumptionsResult, dealResult, propResult] = await Promise.all([
      pool.query('SELECT * FROM deal_assumptions WHERE deal_id = $1', [dealId]),
      pool.query('SELECT id, name, city, state_code, target_units, budget FROM deals WHERE id = $1', [dealId]),
      pool.query(
        `SELECT dp.property_id FROM deal_properties dp WHERE dp.deal_id = $1 LIMIT 1`,
        [dealId]
      ),
    ]);

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    const assumptionsRow = assumptionsResult.rows[0] ?? null;
    const year1Seed = assumptionsRow?.year1 ?? null;

    // Build operating statement from year1 seed
    const operatingStatement = year1Seed
      ? buildOperatingStatement(year1Seed, deal.target_units ?? 0)
      : null;

    // Build integrity checks from resolved values
    const integrityChecks = operatingStatement
      ? computeIntegrityChecks(operatingStatement, year1Seed)
      : [];

    // Non-blocking traffic fetch from proforma_assumptions (pre-computed by M07 engine)
    let trafficProjection: Record<string, unknown> | null = null;
    try {
      const trafficResult = await pool.query(
        `SELECT vacancy_current, rent_growth_current, absorption_current, exit_cap_current,
                last_recalculation, data_confidence, traffic_source
           FROM proforma_assumptions
          WHERE deal_id = $1
          ORDER BY last_recalculation DESC
          LIMIT 1`,
        [dealId]
      );
      if (trafficResult.rows.length > 0) {
        const tr = trafficResult.rows[0];
        trafficProjection = {
          vacancyPct: tr.vacancy_current,
          rentGrowthPct: tr.rent_growth_current,
          absorptionRate: tr.absorption_current,
          exitCap: tr.exit_cap_current,
          lastCalibrated: tr.last_recalculation,
          confidence: tr.data_confidence,
          source: tr.traffic_source,
        };
      }
    } catch (trafficErr) {
      logger.warn('Traffic fetch non-fatal for financials (table may not exist)', {
        dealId, error: (trafficErr as Error).message,
      });
    }

    // Assumptions section — scalar fields + year1 seed rows
    const assumptions = assumptionsRow
      ? {
          hold: {
            holdPeriodYears: assumptionsRow.hold_period_years ?? 10,
            exitCap: assumptionsRow.exit_cap,
            interestRate: assumptionsRow.interest_rate,
            ltc: assumptionsRow.ltc,
            rentGrowthYr1: assumptionsRow.rent_growth_yr1,
            rentGrowthStabilized: assumptionsRow.rent_growth_stabilized,
          },
          rows: year1Seed ? Object.entries(year1Seed as Record<string, unknown>)
            .filter(([k]) => !k.startsWith('_') && !k.startsWith('source'))
            .map(([k, v]) => ({ field: k, ...(v as Record<string, unknown>) })) : [],
          gprDecomposition: operatingStatement?.gprDecomposition ?? null,
          narrative: buildNarrative(integrityChecks, operatingStatement),
        }
      : null;

    res.json({
      success: true,
      data: {
        dealId,
        dealName: deal.name,
        totalUnits: deal.target_units,
        proforma: {
          operatingStatement,
          unitEconomics: operatingStatement
            ? buildUnitEconomics(operatingStatement, deal.target_units ?? 0)
            : null,
          integrityChecks,
        },
        trafficProjection,
        assumptions,
        meta: {
          seeded: !!year1Seed,
          seedRunAt: assumptionsRow?.source_date ?? null,
          updatedAt: assumptionsRow?.updated_at ?? null,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching deal financials:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/financials/override
 * 
 * Apply a user override to a single field in the year1 seed.
 * Triggers server-side re-derivation of NOI, EGI, Total OpEx.
 * 
 * Body: { fieldPath: string, value: number | null }
 *   fieldPath — dot-path into year1 seed, e.g. "vacancy_pct" or "gpr"
 *   value     — new override value (number), or null to clear override
 */
router.patch('/:dealId/financials/override', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { fieldPath, value } = req.body as { fieldPath: string; value: number | null };
    const userId = req.user?.userId ?? 'unknown';

    if (!fieldPath) {
      return res.status(400).json({ error: 'fieldPath is required' });
    }
    if (value !== null && value !== undefined && typeof value !== 'number') {
      return res.status(400).json({ error: 'value must be a number or null' });
    }

    await applyUserOverride(pool, dealId, fieldPath, value ?? null, userId);

    const result = await pool.query(
      'SELECT year1, updated_at FROM deal_assumptions WHERE deal_id = $1',
      [dealId]
    );

    res.json({
      success: true,
      data: {
        dealId,
        fieldPath,
        appliedValue: value ?? null,
        year1: result.rows[0]?.year1 ?? null,
        updatedAt: result.rows[0]?.updated_at ?? null,
      },
    });
  } catch (error: any) {
    logger.error('Error applying financials override:', error);
    const status = error.message?.includes('No year1 seed') ? 422
      : error.message?.includes('not a layered value') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// ─── Internal helpers ────────────────────────────────────────────────────────

interface OperatingStatement {
  gpr: number | null;
  lossToLease: number | null;
  vacancyPct: number | null;
  concessionsPct: number | null;
  badDebtPct: number | null;
  nonRevenueUnitsPct: number | null;
  otherIncomePerUnit: number | null;
  netRentalIncome: number | null;
  egi: number | null;
  opex: {
    payroll: number | null;
    repairsMaintenance: number | null;
    turnover: number | null;
    contractServices: number | null;
    marketing: number | null;
    utilities: number | null;
    managementFeePct: number | null;
    insurance: number | null;
    realEstateTax: number | null;
    personalPropertyTax: number | null;
    gAndA: number | null;
    hoaDues: number | null;
    amenities: number | null;
    replacementReserves: number | null;
    total: number | null;
  };
  noi: number | null;
  gprDecomposition: {
    gpr: number | null;
    units: number;
    avgRentPerUnit: number | null;
  };
}

function rv(lv: Record<string, unknown> | null | undefined): number | null {
  if (!lv || typeof lv !== 'object') return null;
  const v = (lv as Record<string, unknown>).resolved;
  return typeof v === 'number' ? v : null;
}

function buildOperatingStatement(year1: Record<string, unknown>, units: number): OperatingStatement {
  return {
    gpr:               rv(year1.gpr as Record<string, unknown>),
    lossToLease:       rv(year1.loss_to_lease_pct as Record<string, unknown>),
    vacancyPct:        rv(year1.vacancy_pct as Record<string, unknown>),
    concessionsPct:    rv(year1.concessions_pct as Record<string, unknown>),
    badDebtPct:        rv(year1.bad_debt_pct as Record<string, unknown>),
    nonRevenueUnitsPct:rv(year1.non_revenue_units_pct as Record<string, unknown>),
    otherIncomePerUnit:rv(year1.other_income_per_unit as Record<string, unknown>),
    netRentalIncome:   rv(year1.net_rental_income as Record<string, unknown>),
    egi:               rv(year1.egi as Record<string, unknown>),
    opex: {
      payroll:           rv(year1.payroll as Record<string, unknown>),
      repairsMaintenance:rv(year1.repairs_maintenance as Record<string, unknown>),
      turnover:          rv(year1.turnover as Record<string, unknown>),
      contractServices:  rv(year1.contract_services as Record<string, unknown>),
      marketing:         rv(year1.marketing as Record<string, unknown>),
      utilities:         rv(year1.utilities as Record<string, unknown>),
      managementFeePct:  rv(year1.management_fee_pct as Record<string, unknown>),
      insurance:         rv(year1.insurance as Record<string, unknown>),
      realEstateTax:     rv(year1.real_estate_tax as Record<string, unknown>),
      personalPropertyTax:rv(year1.personal_property_tax as Record<string, unknown>),
      gAndA:             rv(year1.g_and_a as Record<string, unknown>),
      hoaDues:           rv(year1.hoa_dues as Record<string, unknown>),
      amenities:         rv(year1.amenities as Record<string, unknown>),
      replacementReserves: units > 0 ? null : null,
      total:             rv(year1.total_opex as Record<string, unknown>),
    },
    noi: rv(year1.noi as Record<string, unknown>),
    gprDecomposition: {
      gpr:           rv(year1.gpr as Record<string, unknown>),
      units,
      avgRentPerUnit: units > 0 && rv(year1.gpr as Record<string, unknown>) != null
        ? Math.round((rv(year1.gpr as Record<string, unknown>) as number) / units / 12)
        : null,
    },
  };
}

function buildUnitEconomics(os: OperatingStatement, units: number): Record<string, number | null> {
  if (!units) return {};
  const safe = (v: number | null) => v != null ? Math.round(v / units) : null;
  return {
    gprPerUnit: safe(os.gpr),
    egiPerUnit: safe(os.egi),
    opexPerUnit: safe(os.opex.total),
    noiPerUnit: safe(os.noi),
    opexRatioPct: os.egi && os.opex.total ? Math.round((os.opex.total / os.egi) * 10000) / 100 : null,
  };
}

interface IntegrityCheck {
  field: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  brokerValue?: number | null;
  platformValue?: number | null;
  resolvedValue?: number | null;
  deltaBps?: number | null;
}

function computeIntegrityChecks(os: OperatingStatement, year1: Record<string, unknown>): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  function lv(key: string): Record<string, unknown> | null {
    const v = year1[key];
    return v && typeof v === 'object' ? v as Record<string, unknown> : null;
  }
  function num(obj: Record<string, unknown> | null, key: string): number | null {
    if (!obj) return null;
    const v = obj[key];
    return typeof v === 'number' ? v : null;
  }

  // Vacancy check — broker vs platform delta >100bps
  const vacLv = lv('vacancy_pct');
  const vacBroker = num(vacLv, 'broker') ?? num(vacLv, 'om');
  const vacPlatform = num(vacLv, 'platform');
  const vacResolved = os.vacancyPct;
  if (vacBroker != null && vacPlatform != null) {
    const deltaBps = Math.round((vacBroker - vacPlatform) * 100);
    checks.push({
      field: 'vacancy_pct',
      status: Math.abs(deltaBps) > 100 ? 'warn' : 'ok',
      message: Math.abs(deltaBps) > 100
        ? `Vacancy: broker ${(vacBroker * 100).toFixed(1)}% vs platform ${(vacPlatform * 100).toFixed(1)}% (${deltaBps > 0 ? '+' : ''}${deltaBps}bps)`
        : 'Vacancy within 100bps of platform',
      brokerValue: vacBroker, platformValue: vacPlatform, resolvedValue: vacResolved, deltaBps,
    });
  }

  // GPR reconciliation — T12 vs rent roll delta >5%
  const gprLv = lv('gpr');
  const gprT12 = num(gprLv, 't12');
  const gprRR  = num(gprLv, 'rent_roll');
  if (gprT12 != null && gprRR != null && gprT12 > 0) {
    const deltaPct = Math.round(((gprRR - gprT12) / gprT12) * 10000) / 100;
    checks.push({
      field: 'gpr',
      status: Math.abs(deltaPct) > 5 ? 'warn' : 'ok',
      message: Math.abs(deltaPct) > 5
        ? `GPR: rent roll ${deltaPct > 0 ? '+' : ''}${deltaPct}% vs T12 — verify unit mix`
        : 'GPR: T12 and rent roll reconciled',
      deltaBps: Math.round(deltaPct * 100),
    });
  }

  // Real estate tax — T12 vs platform delta >2σ (proxy: >15%)
  const taxLv = lv('real_estate_tax');
  const taxT12 = num(taxLv, 't12');
  const taxPlatform = num(taxLv, 'platform');
  if (taxT12 != null && taxPlatform != null && taxPlatform > 0) {
    const deltaPct = Math.abs((taxT12 - taxPlatform) / taxPlatform);
    checks.push({
      field: 'real_estate_tax',
      status: deltaPct > 0.15 ? 'warn' : 'ok',
      message: deltaPct > 0.15
        ? `Real estate tax: T12 ${(deltaPct * 100).toFixed(0)}% from platform — confirm tax bill`
        : 'Real estate tax confirmed',
    });
  }

  // NOI sanity — must be positive
  if (os.noi != null) {
    checks.push({
      field: 'noi',
      status: os.noi > 0 ? 'ok' : 'error',
      message: os.noi > 0
        ? `NOI positive: $${os.noi.toLocaleString()}`
        : `NOI negative — check expense inputs`,
      resolvedValue: os.noi,
    });
  }

  return checks;
}

function buildNarrative(checks: IntegrityCheck[], os: OperatingStatement | null): string {
  const warns = checks.filter(c => c.status === 'warn' || c.status === 'error');
  if (warns.length === 0) return 'All integrity checks passed. Pro forma is consistent across sources.';
  return warns.map(c => c.message).join(' · ');
}

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

export default router;
