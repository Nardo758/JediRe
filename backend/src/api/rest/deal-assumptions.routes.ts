/**
 * Deal Assumptions API Routes
 * 
 * Endpoints for managing deal underwriting assumptions
 */

import axios from 'axios';
import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { bustM08Cache } from '../../services/m08-strategies.service';
import { 
  DealAssumptionsInput, 
  SiteDataInput, 
  ComputedReturns,
  DEFAULT_ASSUMPTIONS 
} from '../../types/deal-assumptions.types';
import * as XLSX from 'xlsx';
import { seedProFormaYear1 } from '../../services/proforma-seeder.service';
import { getDealFinancials, applyFinancialsOverride } from '../../services/proforma-adjustment.service';
import { buildF9Workbook, buildProjectionsForExport } from '../../services/f9-financial-export.service';
import { randomUUID } from 'crypto';

// ─── IRR bisection helper ─────────────────────────────────────────────────────
/**
 * Compute Internal Rate of Return via bisection.
 * cashFlows[0] is the t=0 outflow (negative equityAtClose).
 * cashFlows[i] for i>0 are the annual free cash flows.
 * Returns null if equity is zero, no sign change exists, or solution diverges.
 */
function computeIrr(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const npv = (r: number) => cashFlows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  const v0 = npv(0);
  if (v0 === 0) return 0;
  let lo = -0.9999, hi = 10.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const m = npv(mid);
    if (Math.abs(m) < 1e-4 || (hi - lo) < 1e-8) return +mid.toFixed(6);
    if (v0 > 0 ? m > 0 : m < 0) lo = mid; else hi = mid;
  }
  return +((lo + hi) / 2).toFixed(6);
}

// ─── AI Coordinator config ────────────────────────────────────────────────────
const ANTHROPIC_API_KEY  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL       = 'claude-sonnet-4-5';

const router = Router();

// ─── Narrative types and cache ───────────────────────────────────────────────
export interface NarrativeBlock {
  id: string;
  label: string;
  summary: string;
  detail: string | null;
  status: 'ok' | 'warn' | 'info';
}

interface NarrativeCacheEntry {
  text: string | null;
  blocks: NarrativeBlock[];
  generatedAt: number;
}

// Two-layer cache: in-memory (fast) + DB (persistent across restarts)
const narrativeCache = new Map<string, NarrativeCacheEntry>();
const NARRATIVE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * AI Coordinator: generates a structured narrative for a deal using Claude.
 * Returns null if the API key is not set (graceful degradation).
 */
async function generateAiNarrative(
  data: Awaited<ReturnType<typeof getDealFinancials>>,
  blocks: NarrativeBlock[],
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    logger.warn('AI_INTEGRATIONS_ANTHROPIC_API_KEY not set — narrative will be block-derived only');
    return null;
  }
  try {
    const cs  = data.capitalStack;
    const tp  = data.trafficProjection;
    const ass = data.assumptions;
    const gpr = ass.gprDecomposition;

    const context = [
      `Deal: ${data.dealName} | ${data.totalUnits} units`,
      cs.purchasePrice != null ? `Purchase Price: $${(cs.purchasePrice / 1e6).toFixed(2)}M` : '',
      cs.loanAmount    != null ? `Loan: $${(cs.loanAmount / 1e6).toFixed(2)}M` : '',
      ass.exitCap      != null ? `Assumed Exit Cap: ${(ass.exitCap * 100).toFixed(2)}%` : '',
      tp?.calibrated.exitCap != null ? `M07 Platform Exit Cap: ${(tp.calibrated.exitCap * 100).toFixed(2)}%` : '',
      ass.rentGrowthYr1 != null ? `Assumed Yr-1 Rent Growth: ${(ass.rentGrowthYr1 * 100).toFixed(2)}%` : '',
      tp?.calibrated.rentGrowthPct != null ? `M07 Rent Growth: ${(tp.calibrated.rentGrowthPct * 100).toFixed(2)}%` : '',
      gpr?.brokerPerUnitMo != null ? `Broker GPR: $${gpr.brokerPerUnitMo.toFixed(0)}/unit/mo` : '',
      gpr?.platformPerUnitMo != null ? `Platform GPR: $${gpr.platformPerUnitMo.toFixed(0)}/unit/mo` : '',
      tp?.leasingSignals?.confidence != null ? `M07 Confidence: ${tp.leasingSignals.confidence.toFixed(0)}%` : '',
    ].filter(Boolean).join('\n');

    const blockSummaries = blocks.map(b => `[${b.status.toUpperCase()}] ${b.label}: ${b.summary}`).join('\n');

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        model: CLAUDE_MODEL,
        max_tokens: 400,
        temperature: 0.2,
        system: 'You are JediRE F9 Financial Intelligence. Write a concise 2-3 sentence deal intelligence summary for a real estate underwriter. Be specific about numbers. Use financial professional language. Do not use bullet points.',
        messages: [{
          role: 'user',
          content: `Synthesize the following deal signals into a 2-3 sentence intelligence narrative:\n\n${context}\n\nStructured findings:\n${blockSummaries}`,
        }],
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 20000,
      },
    );
    return (response.data?.content?.[0]?.text as string | undefined) ?? null;
  } catch (err: unknown) {
    logger.warn('AI Coordinator narrative generation failed (non-fatal):', err instanceof Error ? err.message : err);
    return null;
  }
}

let narrativeColsMigrated = false;

async function ensureNarrativeColumns(): Promise<void> {
  if (narrativeColsMigrated) return;
  try {
    await pool.query(`
      ALTER TABLE deal_assumptions
        ADD COLUMN IF NOT EXISTS narrative_text TEXT,
        ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ
    `);
    narrativeColsMigrated = true;
  } catch (err: unknown) {
    logger.warn('Could not ensure narrative columns (non-fatal):', err);
  }
}
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

    // Bust M08 strategy cache — assumption changes invalidate strategy analysis
    bustM08Cache(dealId);
    
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

    // Fetch close/sale dates stored in deal_data jsonb
    const dateRes = await pool.query(
      `SELECT deal_data->>'close_date' AS close_date, deal_data->>'sale_date' AS sale_date FROM deals WHERE id = $1`,
      [dealId]
    );
    const closeDate: string | null = dateRes.rows[0]?.close_date ?? null;
    const saleDate: string | null  = dateRes.rows[0]?.sale_date  ?? null;

    // Compute hold-period returns from F9 projection engine
    const projs = buildProjectionsForExport(data, holdYears);
    const equity = data.capitalStack.equityAtClose ?? 0;
    let returns: typeof data.returns = null;
    if (equity > 0 && projs.length > 0) {
      const lastProj = projs[projs.length - 1];
      // Build IRR cash flows: [-equity, cfbt_1, ..., cfbt_n-1, cfbt_n + netSaleProceeds_n]
      const cashFlows: number[] = [-equity];
      for (let i = 0; i < projs.length - 1; i++) {
        cashFlows.push(projs[i].cfbt);
      }
      cashFlows.push((lastProj.cfbt ?? 0) + (lastProj.netSaleProceeds ?? 0));
      const irr = computeIrr(cashFlows);
      const equityMultiple = lastProj.cumulativeEM ?? null;
      const cashOnCash = projs.length > 0 ? (projs[0].coc ?? null) : null;
      returns = { irr, equityMultiple, cashOnCash } as any;
    }

    res.json({ success: true, data: { ...data, returns, closeDate, saleDate } });
  } catch (error: any) {
    logger.error('Error fetching deal financials:', error);
    const status = (error as Error).message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/dates
 *
 * Persist close date and target sale date for a deal.
 * Stored in deals.deal_data jsonb as { close_date, sale_date }.
 */
router.patch('/:dealId/assumptions/dates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const { closeDate, saleDate } = req.body as { closeDate?: string | null; saleDate?: string | null };

    const own = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2`,
      [dealId, userId]
    );
    if (own.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized for this deal' });
    }

    await pool.query(
      `UPDATE deals
         SET deal_data  = deal_data || jsonb_build_object(
               'close_date', $2::text,
               'sale_date',  $3::text
             ),
             updated_at = NOW()
       WHERE id = $1`,
      [dealId, closeDate ?? null, saleDate ?? null]
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching deal dates:', error);
    res.status(500).json({ error: error.message });
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
    const { field, year = null, value, strValue, rationale } = req.body as {
      field: string;
      year?: number | null;
      value: number | string | boolean | null;
      strValue?: string;
      // F9 Tier-1: Buyer's justification when an override is outside the
      // P10–P90 confidence band. Persisted to the user-assumption layer so
      // it survives reload and shows up in the audit trail (spec §9).
      rationale?: string | null;
    };
    const userId = req.user?.userId ?? 'unknown';

    // IDOR guard: applyFinancialsOverride uses userId only for audit metadata
    // and does not verify deal ownership, so we must enforce it here. This
    // path now also serves Task #519's `other_income_breakdown.<cat>` paths
    // delegated from the inline-deals router (which only checked ownership
    // on its unit_mix branch).
    const own = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2`,
      [dealId, userId]
    );
    if (own.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized for this deal' });
    }

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: 'field is required (camelCase field name, e.g. "vacancyPct")' });
    }
    // String fields: debt (loanTypeLabel, rateType, prepayType) and wf (waterfallType, assetMgmtBasis)
    const isStrField = (field.startsWith('debt:') || field.startsWith('wf:')) && strValue != null;
    // Boolean fields: per-deal flags routed through "da:" prefix (e.g. da:use_unit_mix_for_gpr)
    const isFlagField = field.startsWith('da:');
    if (!isStrField && !isFlagField && value !== null && value !== undefined && typeof value !== 'number') {
      return res.status(400).json({ error: 'value must be a number or null' });
    }
    if (isFlagField && value !== null && value !== undefined && typeof value !== 'boolean' && typeof value !== 'number') {
      return res.status(400).json({ error: 'value for da:* flags must be boolean, 0/1, or null' });
    }
    if (rationale != null && typeof rationale !== 'string') {
      return res.status(400).json({ error: 'rationale must be a string or omitted' });
    }

    // applyFinancialsOverride accepts number | string | boolean | null for typed override fields
    const effectiveValue: number | string | boolean | null = isStrField
      ? strValue!
      : isFlagField
        ? (value as boolean | number | null)
        : (value as number | null);
    const result = await applyFinancialsOverride(
      pool, dealId, field, year ?? null, effectiveValue, userId,
      rationale ?? null,
    );
    res.json({ success: true, data: { dealId, ...result } });
  } catch (error: any) {
    logger.error('Error applying financials override:', error);
    const status = error.message?.includes('No year1 seed') ? 422
      : error.message?.includes('not a layered value') || error.message?.includes('Field path invalid') ? 400
      : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

/**
 * ─── User-added ancillary income lines (Task #519) ──────────────────────────
 * Custom rows that don't fit the canonical other_income_breakdown categories
 * (e.g. "Solar revenue", "Cell tower lease", "Vending"). Each line carries a
 * monthly $ amount and contributes to EGI via recomputeDerived(). All three
 * routes load year1, mutate `other_income_user_lines`, recompute derived
 * fields (NRI/EGI/NOI/per-unit), and persist.
 */
type MutateResult =
  | { ok: true; user_lines: any[]; year1: any }
  | { ok: false; status: 403 | 404; error: string };

async function mutateUserLines(
  dealId: string,
  userId: string,
  mutator: (lines: any[]) => any[]
): Promise<MutateResult> {
  const { recomputeDerived } = await import('../../services/proforma-seeder.service');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ownership check (IDOR guard) — must match deals.user_id.
    const own = await client.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2`,
      [dealId, userId]
    );
    if (own.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 403, error: 'Not authorized for this deal' };
    }
    // Row-lock the assumptions row to serialize concurrent CRUD on user_lines.
    const res = await client.query(
      `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 FOR UPDATE`,
      [dealId]
    );
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'deal_assumptions not seeded for this deal yet' };
    }
    const year1 = typeof res.rows[0].year1 === 'string'
      ? JSON.parse(res.rows[0].year1)
      : res.rows[0].year1;
    if (!year1) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'deal_assumptions.year1 is empty' };
    }
    const current = Array.isArray(year1.other_income_user_lines) ? year1.other_income_user_lines : [];
    const next = mutator(current);
    year1.other_income_user_lines = next;
    recomputeDerived(year1);
    await client.query(
      `UPDATE deal_assumptions SET year1 = $1::jsonb, updated_at = NOW() WHERE deal_id = $2`,
      [JSON.stringify(year1), dealId]
    );
    await client.query('COMMIT');
    return { ok: true, user_lines: next, year1 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Resolve `monthly` from optional per-unit pricing fields. Server is the
 * single source of truth — when qty + rate are supplied we ALWAYS recompute
 * monthly so the three fields stay in lock-step regardless of what the
 * client posts. Returns null when inputs are invalid (caller responds 400).
 */
function deriveMonthly(input: {
  monthly?: number; qty?: number; rate?: number; frequency?: string;
}): { ok: true; monthly: number; qty?: number; rate?: number; frequency?: 'monthly' | 'annual' }
  | { ok: false; error: string } {
  const { qty, rate } = input;
  // Strict frequency validation — silently coercing "weekly" / typos to
  // monthly would mutate user data without an error and is a correctness
  // hazard. Accept only the documented enum values; null/undefined falls
  // through to the per-unit default of 'monthly' below.
  let freq: 'monthly' | 'annual' | undefined;
  if (input.frequency === undefined || input.frequency === null) {
    freq = undefined;
  } else if (input.frequency === 'monthly' || input.frequency === 'annual') {
    freq = input.frequency;
  } else {
    return { ok: false, error: "frequency must be 'monthly' or 'annual'" };
  }
  if (qty != null || rate != null) {
    if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) return { ok: false, error: 'qty must be a non-negative number when provided' };
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) return { ok: false, error: 'rate must be a non-negative number when provided' };
    const effectiveFreq = freq ?? 'monthly';
    const monthly = effectiveFreq === 'annual' ? (qty * rate) / 12 : qty * rate;
    return { ok: true, monthly, qty, rate, frequency: effectiveFreq };
  }
  // No per-unit pricing — fall back to caller-supplied flat monthly.
  if (typeof input.monthly !== 'number' || !Number.isFinite(input.monthly) || input.monthly < 0) {
    return { ok: false, error: 'monthly must be a non-negative number' };
  }
  return { ok: true, monthly: input.monthly };
}

router.post('/:dealId/financials/other-income/user-lines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { label, monthly, qty, rate, frequency, note } = req.body as {
      label: string; monthly?: number; qty?: number; rate?: number; frequency?: string; note?: string;
    };
    if (!label || typeof label !== 'string' || !label.trim()) {
      logger.warn('User-line POST rejected: missing label', { dealId, body: req.body });
      return res.status(400).json({ error: 'label is required' });
    }
    const derived = deriveMonthly({ monthly, qty, rate, frequency });
    if (derived.ok === false) {
      logger.warn('User-line POST rejected by deriveMonthly', { dealId, body: req.body, reason: derived.error });
      return res.status(400).json({ error: derived.error });
    }
    const userId = req.user?.userId ?? 'unknown';
    const result = await mutateUserLines(dealId, userId, (lines) => [
      ...lines,
      {
        id: randomUUID(),
        label: label.trim(),
        monthly: derived.monthly,
        ...(derived.qty != null ? { qty: derived.qty } : {}),
        ...(derived.rate != null ? { rate: derived.rate } : {}),
        ...(derived.frequency ? { frequency: derived.frequency } : {}),
        note: note?.trim() || undefined,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    ]);
    if (result.ok === false) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, data: { dealId, userLines: result.user_lines } });
  } catch (error: any) {
    logger.error('Error adding ancillary user line:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Tagged error so the outer route can map mutator-side validation to 400. */
class UserLineValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'UserLineValidationError'; }
}

router.patch('/:dealId/financials/other-income/user-lines/:lineId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, lineId } = req.params;
    const { label, monthly, qty, rate, frequency, note } = req.body as {
      label?: string; monthly?: number; qty?: number; rate?: number; frequency?: string; note?: string;
    };
    if (label != null && typeof label !== 'string') return res.status(400).json({ error: 'label must be a string' });
    const userId = req.user?.userId ?? 'unknown';
    // Determine the user's INTENT from which fields were posted:
    //   • any of {qty, rate, frequency} present → per-unit mode (merge with
    //     stored values; recompute monthly = qty × rate)
    //   • only `monthly` present (no qty/rate)  → flat mode (clear stored
    //     qty/rate so the line genuinely switches from calculated to flat)
    //   • nothing relevant → label/note-only edit (preserve current shape)
    const wantsPerUnit = qty !== undefined || rate !== undefined || frequency !== undefined;
    const wantsFlatMonthly = !wantsPerUnit && monthly !== undefined;
    const result = await mutateUserLines(dealId, userId, (lines) => {
      const idx = lines.findIndex((l: any) => l.id === lineId);
      if (idx < 0) return lines;
      const cur = lines[idx];

      let nextMonthly: number = cur.monthly;
      let nextQty: number | undefined = cur.qty;
      let nextRate: number | undefined = cur.rate;
      let nextFreq: 'monthly' | 'annual' | undefined = cur.frequency;

      if (wantsPerUnit) {
        const merged = {
          qty:       qty       !== undefined ? qty       : cur.qty,
          rate:      rate      !== undefined ? rate      : cur.rate,
          frequency: frequency !== undefined ? frequency : cur.frequency,
        };
        const derived = deriveMonthly(merged);
        if (derived.ok === false) throw new UserLineValidationError(derived.error);
        nextMonthly = derived.monthly;
        nextQty = derived.qty;
        nextRate = derived.rate;
        nextFreq = derived.frequency;
      } else if (wantsFlatMonthly) {
        // Switch-to-flat: clear stored per-unit fields so subsequent reads
        // don't re-derive monthly from qty × rate.
        const derived = deriveMonthly({ monthly });
        if (derived.ok === false) throw new UserLineValidationError(derived.error);
        nextMonthly = derived.monthly;
        nextQty = undefined;
        nextRate = undefined;
        nextFreq = undefined;
      }
      // else: label/note-only edit — keep monthly/qty/rate/frequency as-is.

      const updated: any = {
        ...cur,
        ...(label != null ? { label: label.trim() } : {}),
        monthly: nextMonthly,
        ...(note !== undefined ? { note: note?.trim() || undefined } : {}),
        updated_at: new Date().toISOString(),
      };
      // Apply per-unit fields explicitly: present → set, absent → drop the
      // key entirely so the persisted JSON doesn't carry stale qty/rate.
      if (nextQty  != null) updated.qty       = nextQty;       else delete updated.qty;
      if (nextRate != null) updated.rate      = nextRate;      else delete updated.rate;
      if (nextFreq != null) updated.frequency = nextFreq;      else delete updated.frequency;
      lines[idx] = updated;
      return lines;
    });
    if (result.ok === false) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, data: { dealId, userLines: result.user_lines } });
  } catch (error: any) {
    if (error instanceof UserLineValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error updating ancillary user line:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:dealId/financials/other-income/user-lines/:lineId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, lineId } = req.params;
    const userId = req.user?.userId ?? 'unknown';
    const result = await mutateUserLines(dealId, userId, (lines) => lines.filter((l: any) => l.id !== lineId));
    if (result.ok === false) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, data: { dealId, userLines: result.user_lines } });
  } catch (error: any) {
    logger.error('Error deleting ancillary user line:', error);
    res.status(500).json({ error: error.message });
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
 * Build structured narrative blocks from DealFinancials.
 * Blocks cover: rent growth delta, traffic trajectory, vacancy math,
 * exit cap derivation, broker divergence, and lease-up velocity.
 */
function buildNarrativeBlocks(data: Awaited<ReturnType<typeof getDealFinancials>>): NarrativeBlock[] {
  const blocks: NarrativeBlock[] = [];
  const sig = data.trafficProjection?.leasingSignals;
  const gpd = data.assumptions.gprDecomposition;

  // ── 1. Rent Growth Delta ──────────────────────────────────────────────────
  const rentGr1    = data.assumptions.rentGrowthYr1;
  const platRentGr = data.trafficProjection?.calibrated.rentGrowthPct;
  if (rentGr1 != null || platRentGr != null) {
    const delta = rentGr1 != null && platRentGr != null ? rentGr1 - platRentGr : null;
    const status: NarrativeBlock['status'] = delta != null && Math.abs(delta) > 0.02 ? 'warn' : 'ok';
    blocks.push({
      id:      'rent_growth_delta',
      label:   'Rent Growth',
      summary: platRentGr != null
        ? `platform rent growth ${(platRentGr * 100).toFixed(1)}%/yr`
        : `yr-1 rent growth ${((rentGr1 ?? 0) * 100).toFixed(1)}%/yr`,
      detail:  delta != null
        ? `assumption vs platform: ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp`
        : null,
      status,
    });
  }

  // ── 2. Traffic Trajectory (M07 confidence) ────────────────────────────────
  if (sig?.confidence != null) {
    const status: NarrativeBlock['status'] = sig.confidence >= 80 ? 'ok' : sig.confidence >= 60 ? 'warn' : 'info';
    blocks.push({
      id:    'traffic_confidence',
      label: 'M07 Confidence',
      summary: `M07 model confidence: ${sig.confidence}%`,
      detail: [
        sig.t01WeeklyTours   != null ? `tour velocity ${sig.t01WeeklyTours.toFixed(1)}/wk`             : null,
        sig.t05ClosingRatio  != null ? `capture rate ${(sig.t05ClosingRatio * 100).toFixed(1)}%`        : null,
        sig.t06WeeklyLeases  != null ? `net leases ${sig.t06WeeklyLeases.toFixed(1)}/wk`               : null,
      ].filter((s): s is string => s !== null).join(' · ') || null,
      status,
    });
  }

  // ── 3. Vacancy Math ───────────────────────────────────────────────────────
  const calibVac = data.trafficProjection?.calibrated.vacancyPct;
  const yr1Vac   = data.trafficProjection?.yearly.find(t => t.year === 1)?.vacancyPct;
  if (calibVac != null || yr1Vac != null) {
    blocks.push({
      id:      'vacancy_math',
      label:   'Vacancy Analysis',
      summary: yr1Vac != null
        ? `yr-1 vacancy ${(yr1Vac * 100).toFixed(1)}%`
        : `platform vacancy ${((calibVac ?? 0) * 100).toFixed(1)}%`,
      detail:  yr1Vac != null && calibVac != null
        ? `platform: ${(calibVac * 100).toFixed(1)}%  ·  yr-1 M07: ${(yr1Vac * 100).toFixed(1)}%`
        : null,
      status: 'ok',
    });
  }

  // ── 4. Exit Cap Derivation ────────────────────────────────────────────────
  const assumedCap   = data.assumptions.exitCap;
  const platformCap  = data.trafficProjection?.calibrated.exitCap;
  if (assumedCap != null || platformCap != null) {
    const delta = assumedCap != null && platformCap != null ? assumedCap - platformCap : null;
    const status: NarrativeBlock['status'] = delta != null && Math.abs(delta) > 0.005 ? 'warn' : 'ok';
    blocks.push({
      id:      'exit_cap_derivation',
      label:   'Exit Cap Rate',
      summary: platformCap != null
        ? `platform exit cap ${(platformCap * 100).toFixed(2)}%`
        : `assumed exit cap ${((assumedCap ?? 0) * 100).toFixed(2)}%`,
      detail:  delta != null
        ? `assumption vs platform: ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(2)}pp`
        : null,
      status,
    });
  }

  // ── 5. Broker Divergence ─────────────────────────────────────────────────
  if (gpd?.brokerAnnual != null && gpd?.resolvedAnnual != null) {
    const deltaAbs = gpd.brokerAnnual - gpd.resolvedAnnual;
    const deltaPct = gpd.resolvedAnnual !== 0 ? deltaAbs / gpd.resolvedAnnual : null;
    const status: NarrativeBlock['status'] = deltaPct != null && Math.abs(deltaPct) > 0.05 ? 'warn' : 'ok';
    blocks.push({
      id:      'broker_divergence',
      label:   'GPR Broker Divergence',
      summary: deltaPct != null
        ? `broker GPR ${deltaPct > 0 ? '+' : ''}${(deltaPct * 100).toFixed(1)}% vs resolved`
        : `broker annual $${gpd.brokerAnnual.toLocaleString()}`,
      detail:  `broker: $${gpd.brokerAnnual.toLocaleString()}  ·  resolved: $${gpd.resolvedAnnual.toLocaleString()}  ·  delta: $${Math.abs(deltaAbs).toLocaleString()}`,
      status,
    });
  }

  // ── 6. Lease-Up Trajectory ────────────────────────────────────────────────
  if (sig?.t07LeaseUpWeeksTo95 != null) {
    const status: NarrativeBlock['status'] = sig.t07LeaseUpWeeksTo95 <= 52 ? 'ok' : sig.t07LeaseUpWeeksTo95 <= 78 ? 'warn' : 'info';
    blocks.push({
      id:      'lease_up_trajectory',
      label:   'Lease-Up Velocity',
      summary: `lease-up to 95% in ${sig.t07LeaseUpWeeksTo95} wks`,
      detail:  sig.stabilizedOccupancyPct != null
        ? `stabilized occupancy: ${(sig.stabilizedOccupancyPct * 100).toFixed(1)}%`
        : null,
      status,
    });
  }

  return blocks;
}

/**
 * GET /:dealId/financials/narrative
 *
 * Returns M07-synthesized narrative for the deal as both a plain string and
 * structured NarrativeBlock array. Response is cached in-memory for 24 h.
 * Narrative text is also persisted to DB (narrative_text / narrative_generated_at)
 * for recovery across restarts.
 * Use ?refresh=true to force regeneration.
 */
router.get('/:dealId/financials/narrative', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    // ── Layer 1: in-memory cache (includes blocks) ────────────────────────
    const memCached = narrativeCache.get(dealId);
    if (!forceRefresh && memCached && (now - memCached.generatedAt) < NARRATIVE_TTL_MS) {
      return res.json({
        success: true,
        data: {
          narrative:  memCached.text,
          blocks:     memCached.blocks,
          cachedAt:   new Date(memCached.generatedAt).toISOString(),
          source:     'memory',
          fresh:      false,
        },
      });
    }

    // ── Layer 2: DB cache (survives restarts) ─────────────────────────────
    // Read persisted narrative_text + generated_at from DB; if within TTL,
    // use DB text + rebuild blocks from current financials (blocks are derived, not stored)
    await ensureNarrativeColumns();
    if (!forceRefresh) {
      try {
        const dbRow = await pool.query<{ narrative_text: string|null; narrative_generated_at: Date|null }>(
          `SELECT narrative_text, narrative_generated_at FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
          [dealId],
        );
        const dbNarrative = dbRow.rows[0]?.narrative_text ?? null;
        const dbGeneratedAt = dbRow.rows[0]?.narrative_generated_at;
        if (dbNarrative && dbGeneratedAt) {
          const dbAge = now - new Date(dbGeneratedAt).getTime();
          if (dbAge < NARRATIVE_TTL_MS) {
            // DB cache is fresh — rebuild blocks from current financials, serve from DB
            const freshData = await getDealFinancials(pool, dealId, 10);
            const freshBlocks = buildNarrativeBlocks(freshData);
            const dbCachedAt = new Date(dbGeneratedAt).getTime();
            narrativeCache.set(dealId, { text: dbNarrative, blocks: freshBlocks, generatedAt: dbCachedAt });
            return res.json({
              success: true,
              data: {
                narrative:  dbNarrative,
                blocks:     freshBlocks,
                cachedAt:   new Date(dbGeneratedAt).toISOString(),
                source:     'db',
                fresh:      false,
              },
            });
          }
        }
      } catch (dbErr: unknown) {
        logger.warn('Narrative DB read failed (non-fatal):', dbErr);
      }
    }

    // ── Layer 3: fresh derivation + AI Coordinator narrative ──────────────
    const data   = await getDealFinancials(pool, dealId, 10);
    const blocks = buildNarrativeBlocks(data);
    // AI Coordinator: generate rich narrative text; falls back to block-derived text if unavailable
    const aiText = await generateAiNarrative(data, blocks);
    const narrative = aiText
      ?? (blocks.length > 0 ? blocks.map(b => b.summary).join(' · ') : data.assumptions.narrative);

    // Persist to DB (non-blocking — fire-and-forget)
    pool.query(
      `UPDATE deal_assumptions
          SET narrative_text = $2, narrative_generated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, narrative],
    ).catch((err: unknown) => logger.warn('Narrative DB persist failed (non-fatal):', err));

    narrativeCache.set(dealId, { text: narrative, blocks, generatedAt: now });

    res.json({
      success: true,
      data: {
        narrative,
        blocks,
        cachedAt: new Date(now).toISOString(),
        source:   'fresh',
        fresh:    true,
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
