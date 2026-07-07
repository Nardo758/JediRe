/**
 * Deal Assumptions API Routes
 * 
 * Endpoints for managing deal underwriting assumptions
 */

import axios from 'axios';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireCapability } from '../../middleware/rbac';
import { moduleEventBus, ModuleEventType } from '../../services/module-wiring/module-event-bus';
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
import { buildF9Workbook } from '../../services/f9-financial-export.service';
import { randomUUID } from 'crypto';
import {
  getStanceForDeal,
  saveStance,
  resetStance,
  computeAffectedFields,
  applyStanceToFinancials,
  type StanceModulation,
} from '../../services/operatorStance.service';
import type { OperatorStancePatch } from '../../types/operator-stance';
import { propagateUnitMix } from '../../services/unit-mix-propagation.service';
import { triggerStabilizationRecheck } from '../../services/stabilization-recheck.service';

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
        ...result,
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
      input.unitMix != null ? JSON.stringify(input.unitMix) : null,
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

    // Wire agent system: financials updated (non-blocking)
    setImmediate(async () => {
      try {
        const { onFinancialsUploaded } = await import('../../services/agents/platform-hooks');
        await onFinancialsUploaded({ dealId, userId: req.user!.userId, type: 'actuals', source: 'manual' });
      } catch { /* non-fatal */ }
    });
    
    res.json({
      success: true,
      data: result
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
      'SELECT target_units, budget FROM deals WHERE id = $1 /* B4a-safe: inside assertDealOrgAccess-guarded handler */',
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      ...(assumptionsResult || {}),
      ...overrides
    };
    
    const site = siteResult || {};
    const deal = dealResult;
    
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
      // R9: irr_levered, equity_multiple, noi_stabilized retired as output-scalar
      // columns per F-P1 Phase 2 operator ruling. These are derivable from
      // deal_financial_models.results and must not be denormalized into deal_assumptions.
      // tdc, tdc_per_unit, yield_on_cost, stabilized_value, profit_margin are
      // development-deal output scalars (not in R9 retirement list) and remain.
      await pool.query(`
        UPDATE deal_assumptions SET
          tdc = $2,
          tdc_per_unit = $3,
          yield_on_cost = $4,
          stabilized_value = $5,
          profit_margin = $6,
          last_computed_at = NOW()
        WHERE deal_id = $1
      `, [
        dealId,
        returns.tdc,
        returns.tdcPerUnit,
        returns.yieldOnCost,
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

    const propertyId = propLookup.property_id;

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
      data: result
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
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching deal context:', error);
    res.status(500).json({ error: error.message });
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

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
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
 * PATCH /:dealId/purchase-price
 *
 * Dual-write purchase_price into BOTH deal_data (JSONB, canonical for the
 * financial composer) AND deals.budget (pipeline column used by map, deal
 * cards, and list views) in a single atomic UPDATE.
 *
 * Background: financials-composer (proforma-adjustment.service.ts:2212-2218)
 * reads deal_data.purchase_price first, falling back to deal_data.asking_price
 * and then deals.budget. Pipeline views read deals.budget directly. Writing
 * only one column causes divergence visible to operators comparing the F9
 * model against the deal list. Both columns are kept in sync here until a
 * future schema migration decides which is the sole canonical column.
 *
 * Remaining one-sided writers (see TODO_DEAL_TERMS_FOLLOWUP.md #15/#16):
 *   - Deal creation (inline-deals.routes.ts POST /) — writes budget only
 *   - Deal update  (inline-deals.routes.ts PATCH /:id) — writes budget only
 *
 * Body: { purchasePrice: number }
 */
router.patch('/:dealId/purchase-price', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;

    // Strict payload contract: exactly one field (`purchasePrice`) is allowed.
    // Reject extra keys — e.g. closeDate belongs to PATCH /:dealId/assumptions/dates,
    // not here. Silently ignoring extras would let scope creep in and muddy
    // the endpoint's single responsibility.
    const bodyKeys = Object.keys(req.body ?? {});
    const unknownKeys = bodyKeys.filter(k => k !== 'purchasePrice');
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        error: `Unexpected field(s): ${unknownKeys.join(', ')}. Only purchasePrice is accepted.`,
      });
    }

    const { purchasePrice } = req.body as { purchasePrice: number };

    if (typeof purchasePrice !== 'number' || purchasePrice <= 0 || !Number.isFinite(purchasePrice)) {
      return res.status(400).json({ error: 'purchasePrice must be a positive finite number' });
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    // Atomic dual-write: deal_data.purchase_price (financial composer source)
    // + deals.budget (pipeline view source). Both must stay in sync until a
    // future schema migration picks one as the sole canonical column.
    await pool.query(
      `UPDATE deals
         SET deal_data  = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object('purchase_price', $2::numeric),
             budget     = $2,
             updated_at = NOW()
       WHERE id = $1`,
      [dealId, purchasePrice]
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching purchase price:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/hold-period
 *
 * Surgical write for hold_period_years — avoids the bulk PUT which would
 * set source_ref = NULL (no COALESCE on that column). Only touches the
 * one column; all other deal_assumptions columns are preserved.
 *
 * Body: { holdPeriodYears: number }
 */
router.patch('/:dealId/assumptions/hold-period', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const { holdPeriodYears } = req.body as { holdPeriodYears: number };

    if (typeof holdPeriodYears !== 'number' || holdPeriodYears < 1 || holdPeriodYears > 36 || !Number.isInteger(holdPeriodYears)) {
      return res.status(400).json({ error: 'holdPeriodYears must be an integer between 1 and 36' });
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, hold_period_years, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         hold_period_years = $2,
         updated_at        = NOW()`,
      [dealId, holdPeriodYears]
    );

    res.json({ success: true });

    triggerStabilizationRecheck(dealId);
  } catch (error: any) {
    logger.error('Error patching hold period:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/targets
 *
 * Surgical write for operator return hurdles (Item 3 — DealTermsTab).
 * Accepts any subset of { targetIrr, targetEm, targetCoc }; null clears the field.
 * Body: { targetIrr?: number | null, targetEm?: number | null, targetCoc?: number | null }
 */
router.patch('/:dealId/assumptions/targets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const { targetIrr, targetEm, targetCoc } = req.body as {
      targetIrr?: number | null;
      targetEm?: number | null;
      targetCoc?: number | null;
    };

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, target_irr, target_em, target_coc, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         target_irr  = COALESCE($2, deal_assumptions.target_irr),
         target_em   = COALESCE($3, deal_assumptions.target_em),
         target_coc  = COALESCE($4, deal_assumptions.target_coc),
         updated_at  = NOW()`,
      [dealId, targetIrr ?? null, targetEm ?? null, targetCoc ?? null]
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching return targets:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── apply-from-module: field registry ──────────────────────────────────────

/**
 * Canonical field paths accepted by POST /assumptions/apply-from-module.
 * Each entry describes where to write the value and how to validate it.
 *
 * storage types:
 *   'deals_data'       — writes to deals.deal_data JSONB (+ deals.budget if dualWriteBudget)
 *   'deal_assumptions' — writes to a named scalar column in deal_assumptions
 *
 * All values are expected in their canonical DB unit:
 *   purchasePrice  — nominal dollar amount (e.g. 5_000_000)
 *   holdPeriodYears— positive integer (e.g. 5)
 *   exitCapRate    — decimal fraction (e.g. 0.055 for 5.5%)
 *   targetIrr      — decimal fraction (e.g. 0.15 for 15%)
 */
type ModuleFieldTarget =
  | { storage: 'deals_data';    dataKey: string; dualWriteBudget?: true }
  | { storage: 'deal_assumptions'; column: string }
  | { storage: 'deal_assumptions_pyo' };  // value stored only in per_year_overrides metaKey

const MODULE_FIELD_REGISTRY: Record<string, ModuleFieldTarget> = {
  'acquisition.purchasePrice': { storage: 'deals_data',    dataKey: 'purchase_price', dualWriteBudget: true },
  'hold.holdPeriodYears':      { storage: 'deal_assumptions', column: 'hold_period_years' },
  'disposition.exitCapRate':   { storage: 'deal_assumptions', column: 'exit_cap' },
  'targets.targetIrr':         { storage: 'deal_assumptions', column: 'target_irr' },
  'revenue.rentGrowth[0]':     { storage: 'deal_assumptions_pyo' },
  'debt.interestRate':         { storage: 'deal_assumptions', column: 'interest_rate' },
  'debt.ltcPct':               { storage: 'deal_assumptions', column: 'ltc' },
  'debt.loanAmount':           { storage: 'deals_data', dataKey: 'loan_amount' },
};

function validateModuleFieldValue(fieldPath: string, value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'value must be a finite number or null';
  }
  switch (fieldPath) {
    case 'acquisition.purchasePrice':
      return value > 0 ? null : 'purchasePrice must be positive';
    case 'hold.holdPeriodYears':
      return (Number.isInteger(value) && value >= 1 && value <= 36)
        ? null : 'holdPeriodYears must be an integer between 1 and 36';
    case 'disposition.exitCapRate':
      return (value > 0 && value < 1)
        ? null : 'exitCapRate must be a decimal fraction (e.g. 0.055 for 5.5%)';
    case 'targets.targetIrr':
      return (value > 0 && value < 1)
        ? null : 'targetIrr must be a decimal fraction (e.g. 0.15 for 15%)';
    case 'revenue.rentGrowth[0]':
      return (value > 0 && value <= 0.30)
        ? null : 'rentGrowth[0] must be a decimal fraction between 0 and 0.30 (e.g. 0.032 for 3.2%)';
    case 'debt.interestRate':
      return (value > 0 && value < 1)
        ? null : 'interestRate must be a decimal fraction (e.g. 0.065 for 6.5%)';
    case 'debt.ltcPct':
      return (value > 0 && value <= 1)
        ? null : 'ltcPct must be a decimal fraction between 0 and 1 (e.g. 0.65 for 65%)';
    case 'debt.loanAmount':
      return value > 0 ? null : 'loanAmount must be a positive dollar amount';
    default:
      return null;
  }
}

/**
 * POST /:dealId/assumptions/apply-from-module
 *
 * Cross-module assumption write gateway (Track 6, T6.1).
 *
 * Accepts a batch of field writes from a named source module (e.g. Strategy Engine,
 * Event Timeline, Goal Seek). For each field the endpoint:
 *   1. Checks whether the field has been locked by a user-source write
 *      (`per_year_overrides['module:source:{fieldPath}'].source === 'user'`).
 *      If locked and `force` is not true → field added to `conflicts[]`, skipped.
 *   2. Writes the value to the appropriate DB storage location.
 *   3. Records provenance metadata in `per_year_overrides['module:source:{fieldPath}']`
 *      so subsequent reads can surface the originating module and timestamp.
 *
 * Body:
 *   { source: LayeredValueSource, appliedAt: ISO-string,
 *     fields: [{ fieldPath, value, evidence?, force? }] }
 *
 * Response:
 *   { applied: [{ fieldPath, value }], conflicts: [{ fieldPath, reason, existingValue }] }
 *
 * Supported field paths (T6.4):
 *   acquisition.purchasePrice  — deals.deal_data.purchase_price + deals.budget
 *   hold.holdPeriodYears       — deal_assumptions.hold_period_years
 *   disposition.exitCapRate    — deal_assumptions.exit_cap
 *   targets.targetIrr          — deal_assumptions.target_irr
 *
 * Track 6 source literals (LayeredValueSource): strategy:entry, strategy:exit,
 *   event_timeline, goal_seek (plus any existing source literal).
 */
router.post('/:dealId/assumptions/apply-from-module', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;

    const body = req.body as {
      source?: unknown;
      appliedAt?: unknown;
      fields?: unknown;
    };

    if (typeof body.source !== 'string' || body.source.trim().length === 0) {
      return res.status(400).json({ error: 'source must be a non-empty string' });
    }
    if (body.appliedAt !== undefined && typeof body.appliedAt !== 'string') {
      return res.status(400).json({ error: 'appliedAt must be an ISO timestamp string' });
    }
    if (!Array.isArray(body.fields) || body.fields.length === 0) {
      return res.status(400).json({ error: 'fields must be a non-empty array' });
    }

    const source: string = body.source.trim();
    const appliedAt: string = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();

    type FieldRequest = { fieldPath: unknown; value: unknown; evidence?: unknown; force?: unknown };
    const fieldRequests = body.fields as FieldRequest[];

    for (let i = 0; i < fieldRequests.length; i++) {
      const f = fieldRequests[i];
      if (typeof f.fieldPath !== 'string' || f.fieldPath.trim().length === 0) {
        return res.status(400).json({ error: `fields[${i}].fieldPath must be a non-empty string` });
      }
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    const pyRes = await pool.query(
      `SELECT per_year_overrides FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    const existingPyo = (pyRes?.per_year_overrides ?? {}) as Record<string, unknown>;

    const applied: Array<{ fieldPath: string; value: unknown }> = [];
    const conflicts: Array<{ fieldPath: string; reason: string; existingValue: unknown }> = [];
    const pyPatch: Record<string, unknown> = {};

    for (const f of fieldRequests) {
      const fieldPath = (f.fieldPath as string).trim();
      const value = f.value;
      const force = f.force === true;

      const target = MODULE_FIELD_REGISTRY[fieldPath];
      if (!target) {
        conflicts.push({ fieldPath, reason: 'unsupported_field_path', existingValue: null });
        continue;
      }

      const validationError = validateModuleFieldValue(fieldPath, value);
      if (validationError) {
        conflicts.push({ fieldPath, reason: `invalid_value: ${validationError}`, existingValue: null });
        continue;
      }

      const metaKey = `module:source:${fieldPath}`;
      const existingMeta = existingPyo[metaKey] as { source?: string; value?: unknown } | undefined;
      if (existingMeta?.source === 'user' && !force) {
        conflicts.push({ fieldPath, reason: 'user_locked', existingValue: existingMeta.value });
        continue;
      }

      if (target.storage === 'deals_data') {
        const dataKey = target.dataKey;
        if (target.dualWriteBudget) {
          await pool.query(
            `UPDATE deals
               SET deal_data  = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object($2::text, $3::numeric),
                   budget     = $3,
                   updated_at = NOW()
             WHERE id = $1`,
            [dealId, dataKey, value]
          );
        } else {
          await pool.query(
            `UPDATE deals
               SET deal_data  = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object($2::text, $3::numeric),
                   updated_at = NOW()
             WHERE id = $1`,
            [dealId, dataKey, value]
          );
        }
      } else if (target.storage === 'deal_assumptions_pyo') {
        // No dedicated column — value lives only in per_year_overrides via pyPatch below.
        // Ensure the deal_assumptions row exists so the pyo merge has a target row.
        await pool.query(
          `INSERT INTO deal_assumptions (deal_id, updated_at)
           VALUES ($1, NOW())
           ON CONFLICT (deal_id) DO NOTHING`,
          [dealId]
        );
      } else {
        const col = (target as { storage: 'deal_assumptions'; column: string }).column;
        await pool.query(
          `INSERT INTO deal_assumptions (deal_id, ${col}, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (deal_id) DO UPDATE SET ${col} = $2, updated_at = NOW()`,
          [dealId, value]
        );
      }

      pyPatch[metaKey] = { source, value, appliedAt, appliedBy: 'module', fieldPath };
      applied.push({ fieldPath, value });
    }

    if (Object.keys(pyPatch).length > 0) {
      const patchJson = JSON.stringify(pyPatch);
      await pool.query(
        `INSERT INTO deal_assumptions (deal_id, per_year_overrides, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (deal_id) DO UPDATE
           SET per_year_overrides = COALESCE(deal_assumptions.per_year_overrides, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()`,
        [dealId, patchJson]
      );
    }

    res.json({ applied, conflicts });
  } catch (error: any) {
    logger.error('Error in apply-from-module:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /:dealId/assumptions/strategy-annotation
 * Persists strategy-plan annotation fields (non-numeric, audit-only) to
 * deals.deal_data under the key `strategy_plan_annotations.{section}`.
 *
 * Body: { section: 'entry'|'exit', annotations: Record<string, string> }
 */
router.post('/:dealId/assumptions/strategy-annotation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { section, annotations } = req.body as { section?: unknown; annotations?: unknown };

    if (section !== 'entry' && section !== 'exit') {
      return res.status(400).json({ error: "section must be 'entry' or 'exit'" });
    }
    if (!annotations || typeof annotations !== 'object' || Array.isArray(annotations)) {
      return res.status(400).json({ error: 'annotations must be a plain object' });
    }

    if (!await assertDealOrgAccess(dealId, req.user?.userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    const sectionPatch = JSON.stringify({
      ...(annotations as object),
      savedAt: new Date().toISOString(),
    });
    // jsonb_set performs a nested merge so saving 'entry' never overwrites 'exit' and vice versa.
    await pool.query(
      `UPDATE deals
         SET deal_data  = jsonb_set(
               COALESCE(deal_data, '{}'::jsonb),
               ARRAY['strategy_plan_annotations', $1::text],
               $2::jsonb,
               true
             ),
             updated_at = NOW()
       WHERE id = $3`,
      [section, sectionPatch, dealId],
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Error storing strategy annotation:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:dealId/assumptions/strategy
 *
 * Unified surgical write for both Investment Strategy and Exit Strategy.
 * Both fields are stored as LV-shaped JSONB so M08 can later write the
 * `detected` slot without a schema migration.
 *
 * Body (both optional — partial payloads safe):
 *   { exitStrategy?: 'Sale' | 'Refinance' | 'Hold' | null,
 *     investmentStrategy?: 'Build-to-Sell' | 'Flip' | 'Rental' | 'Short-Term Rental' |
 *                          'Value-Add' | 'Redevelopment' | 'Lease-Up' | null }
 *
 * Null clears the operator override; detected slot is always preserved.
 * Shape per field: { detected: {value,confidence,source}|null, override: string|null }
 *
 * Side-effect: saving investmentStrategy also derives and writes deals.deal_type
 * via investmentStrategyToDealType() (A2-derived pattern — Task #1233).
 *
 * Supersedes: PATCH /:dealId/assumptions/exit-strategy (flat TEXT, removed May 2026)
 * Task #613 — Strategy fields LV persistence
 *
 * Emits: deal:strategy-changed CustomEvent (frontend only, after F9 refresh)
 */

/**
 * Maps an investmentStrategy value to the canonical deals.deal_type value.
 * Returns undefined when no mapping exists (e.g. null strategy → no write).
 * Task #1233 — A2-derived pattern.
 */
function investmentStrategyToDealType(strategy: string): string | undefined {
  const map: Record<string, string> = {
    'Build-to-Sell':    'development',
    'Flip':             'value_add',
    'Rental':           'existing',
    'Short-Term Rental':'existing',
    'Value-Add':        'value_add',
    'Redevelopment':    'redevelopment',
    'Lease-Up':         'lease_up',
    'Land Hold':        'existing',  // Task #1265 — Phase 1 approximation; Phase 2 adds 'land_hold' DealTypeKey
  };
  return map[strategy];
}

router.patch('/:dealId/assumptions/strategy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const body = req.body as { exitStrategy?: string | null; investmentStrategy?: string | null };

    const EXIT_VALID = ['Sale', 'Refinance', 'Hold'];
    const INV_VALID  = ['Build-to-Sell', 'Flip', 'Land Hold', 'Lease-Up', 'Redevelopment', 'Rental', 'Short-Term Rental', 'Value-Add'];

    if ('exitStrategy' in body && body.exitStrategy !== null && body.exitStrategy !== undefined
        && !EXIT_VALID.includes(body.exitStrategy)) {
      return res.status(400).json({ error: `exitStrategy must be one of: ${EXIT_VALID.join(', ')}` });
    }
    if ('investmentStrategy' in body && body.investmentStrategy !== null && body.investmentStrategy !== undefined
        && !INV_VALID.includes(body.investmentStrategy)) {
      return res.status(400).json({ error: `investmentStrategy must be one of: ${INV_VALID.join(', ')}` });
    }

    // Use an explicit client transaction so that the deal_assumptions write and the
    // derived deals.deal_type write (A2-derived, Task #1233) are atomic — if either
    // update fails, neither is committed.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
        return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
      }

      // Ensure the deal_assumptions row exists before patching.
      await client.query(
        `INSERT INTO deal_assumptions (deal_id, updated_at) VALUES ($1, NOW())
         ON CONFLICT (deal_id) DO NOTHING`,
        [dealId]
      );

      // Build update expression dynamically — only touch fields that were provided.
      // Each field updates only the `override` slot; the `detected` slot is preserved
      // so a future M08 write is not overwritten.
      const sets: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [dealId];

      if ('exitStrategy' in body) {
        const val = body.exitStrategy ?? null;
        params.push(val);
        sets.push(
          `exit_strategy_lv =
             COALESCE(exit_strategy_lv, '{"detected":null}'::jsonb)
             || jsonb_build_object('override', $${params.length}::text)`
        );
      }

      if ('investmentStrategy' in body) {
        const val = body.investmentStrategy ?? null;
        params.push(val);
        sets.push(
          `investment_strategy_lv =
             COALESCE(investment_strategy_lv, '{"detected":null}'::jsonb)
             || jsonb_build_object('override', $${params.length}::text)`
        );
      }

      if (sets.length > 1) {
        await client.query(
          `UPDATE deal_assumptions SET ${sets.join(', ')} WHERE deal_id = $1`,
          params
        );
      }

      // A2-derived (Task #1233): when investmentStrategy is being set to a non-null value,
      // derive and write deals.deal_type in the same transaction so all downstream consumers
      // (Pattern B routing, RegimeExpand, tab visibility, cashflow agent prompt) see the
      // correct value immediately. Only write when the mapping produces a defined result;
      // null strategy leaves deal_type unchanged.
      if ('investmentStrategy' in body && body.investmentStrategy != null) {
        const derivedDealType = investmentStrategyToDealType(body.investmentStrategy);
        if (derivedDealType !== undefined) {
          await client.query(
            `UPDATE deals SET deal_type = $1 WHERE id = $2`,
            [derivedDealType, dealId]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (txError: any) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Error patching strategy fields:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/ltl-controls
 *
 * Task #1540 (Piece B1) — Operator controls for LTL forward trajectory.
 *
 * Fields (both optional; send only what is changing):
 *   ltlBaselineSource      — 'live' | 't12' | null (null = auto: live when present, else T12)
 *   markToMarketCaptureRate — 0–1 decimal fraction (null = revert to platform default 0.33)
 *
 * Body: { ltlBaselineSource?: 'live' | 't12' | null, markToMarketCaptureRate?: number | null }
 */
router.patch('/:dealId/assumptions/ltl-controls', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const body = req.body as {
      ltlBaselineSource?: 'live' | 't12' | null;
      markToMarketCaptureRate?: number | null;
    };

    // Validate ltlBaselineSource
    if ('ltlBaselineSource' in body && body.ltlBaselineSource !== null) {
      if (body.ltlBaselineSource !== 'live' && body.ltlBaselineSource !== 't12') {
        return res.status(400).json({ error: 'ltlBaselineSource must be "live", "t12", or null' });
      }
    }

    // Validate markToMarketCaptureRate
    if ('markToMarketCaptureRate' in body && body.markToMarketCaptureRate !== null) {
      const r = body.markToMarketCaptureRate;
      if (typeof r !== 'number' || r < 0 || r > 1) {
        return res.status(400).json({ error: 'markToMarketCaptureRate must be a decimal between 0 and 1' });
      }
    }

    if (!('ltlBaselineSource' in body) && !('markToMarketCaptureRate' in body)) {
      return res.status(400).json({ error: 'At least one of ltlBaselineSource or markToMarketCaptureRate must be provided' });
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    // Always pass both column values; use COALESCE on the conflict path to
    // preserve the existing value when the caller omits a field.
    // Both columns are also included in the INSERT column list so that a fresh
    // deal_assumptions row (no prior conflict) has them written correctly.
    const baselineSrc = 'ltlBaselineSource' in body ? (body.ltlBaselineSource ?? null) : undefined;
    const captureRate = 'markToMarketCaptureRate' in body ? (body.markToMarketCaptureRate ?? null) : undefined;

    // Build parameterised INSERT so values are written on both INSERT and UPDATE paths.
    const cols = ['deal_id', 'updated_at'];
    const vals: string[] = ['$1', 'NOW()'];
    const params: unknown[] = [dealId];

    if (baselineSrc !== undefined) {
      params.push(baselineSrc);
      cols.push('ltl_baseline_source');
      vals.push(`$${params.length}`);
    }
    if (captureRate !== undefined) {
      params.push(captureRate);
      cols.push('mark_to_market_capture_rate');
      vals.push(`$${params.length}`);
    }

    // Conflict SET: re-use the same positional params.
    // pIdx starts at 1 ($1 = dealId); each optional column increments to match
    // the position assigned during the INSERT values build above.
    const conflictSets = ['updated_at = NOW()'];
    let pIdx = 1; // $1 already consumed by dealId
    if (baselineSrc !== undefined) {
      pIdx++;
      conflictSets.push(`ltl_baseline_source = $${pIdx}`);
    }
    if (captureRate !== undefined) {
      pIdx++;
      conflictSets.push(`mark_to_market_capture_rate = $${pIdx}`);
    }

    await pool.query(
      `INSERT INTO deal_assumptions (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       ON CONFLICT (deal_id) DO UPDATE SET ${conflictSets.join(', ')}`,
      params
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching LTL controls:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/selling-costs
 *
 * Surgical write for selling/disposition cost % (Item 5 — DealTermsTab).
 * Stored as decimal (0.02 = 2%). Null resets to platform default (2%).
 * Body: { sellingCostsPct: number | null }
 */
router.patch('/:dealId/assumptions/selling-costs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const { sellingCostsPct } = req.body as { sellingCostsPct: number | null };

    if (sellingCostsPct !== null && (typeof sellingCostsPct !== 'number' || sellingCostsPct < 0 || sellingCostsPct > 1)) {
      return res.status(400).json({ error: 'sellingCostsPct must be a decimal between 0 and 1 (e.g. 0.02 for 2%)' });
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, selling_costs_pct, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         selling_costs_pct = $2,
         updated_at        = NOW()`,
      [dealId, sellingCostsPct]
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching selling costs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/adoption-timeline
 *
 * Saves the adoption/lease-up timeline for development and lease-up deals.
 * Fields (all optional, null to clear):
 *   constructionMonths        — months from deal close to CO
 *   leaseUpMonths             — months from CO to stabilized occupancy
 *   absorptionUnitsPerMonth   — units leased per month during ramp
 *   stabilizationTargetPct    — target occupancy as decimal (0.95 = 95%)
 *
 * Task #1271.
 */
router.patch('/:dealId/assumptions/adoption-timeline', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const body = req.body as Record<string, number | null | undefined>;

    // Validate only fields that are explicitly provided (undefined = field absent = no change).
    // Return 400 for out-of-range values rather than throwing into a 500.
    const validateField = (name: string, v: number | null | undefined, min: number, max: number): number | null | undefined => {
      if (v === undefined) return undefined; // absent — do not touch this column
      if (v === null) return null;           // explicit null — clear this column
      if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
        res.status(400).json({ error: `${name} must be a finite number between ${min} and ${max}` });
        throw Object.assign(new Error('validation'), { _sent: true });
      }
      return v;
    };

    const cm  = validateField('constructionMonths',      body.constructionMonths,      0, 120);
    const lum = validateField('leaseUpMonths',            body.leaseUpMonths,            0, 120);
    const apm = validateField('absorptionUnitsPerMonth',  body.absorptionUnitsPerMonth,  0, 10000);
    const stp = validateField('stabilizationTargetPct',   body.stabilizationTargetPct,   0, 1);

    // Build a partial SET clause updating only columns that are present in the request
    const setClauses: string[] = ['updated_at = NOW()'];
    const sqlParams: (number | null | string)[] = [dealId];
    const addCol = (col: string, val: number | null | undefined) => {
      if (val !== undefined) {
        sqlParams.push(val);
        setClauses.push(`${col} = $${sqlParams.length}`);
      }
    };
    addCol('construction_months',        cm);
    addCol('lease_up_months',            lum);
    addCol('absorption_units_per_month', apm);
    addCol('stabilization_target_pct',   stp);

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET ${setClauses.join(', ')}`,
      sqlParams
    );

    res.json({ success: true, data: { constructionMonths: cm, leaseUpMonths: lum, absorptionUnitsPerMonth: apm, stabilizationTargetPct: stp } });

    // Re-detect lifecycle_profile when construction_months changes — non-fatal, fire-and-forget.
    if (cm !== undefined) {
      setImmediate(async () => {
        try {
          const { detectLifecycleProfile } = await import('../../services/lifecycle-profile.service');
          const assumRow = await pool.query(
            `SELECT construction_months, total_units FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
            [dealId]
          );
          const ar = assumRow;
          const dealDataRes = await pool.query(
            `SELECT deal_data->'extraction_rent_roll'->>'weighted_occupancy_pct' AS occ,
                    deal_data->'capex_schedule'->>'total_budget' AS total_budget
             FROM deals WHERE id = $1 /* B4a-safe */`,
            [dealId]
          );
          const rawOcc = dealDataRes?.occ;
          const occupancyPct = rawOcc != null ? parseFloat(rawOcc) || null : null;
          const totalBudget = parseFloat(dealDataRes?.total_budget ?? '') || null;
          const units = ar?.total_units != null ? +ar.total_units : null;
          const renovationBudgetPerUnit = totalBudget != null && units != null && units > 0
            ? totalBudget / units : null;
          const detected = detectLifecycleProfile({
            constructionMonths: ar?.construction_months != null ? +parseFloat(ar.construction_months) : null,
            currentOccupancyPct: occupancyPct,
            renovationBudgetPerUnit,
          });
          await pool.query(
            `UPDATE deal_assumptions SET lifecycle_profile = $2, updated_at = NOW() WHERE deal_id = $1`,
            [dealId, detected]
          );
          logger.info(`[adoption-timeline PATCH] lifecycle_profile re-detected as ${detected} for deal ${dealId}`);
        } catch (redetectErr: any) {
          logger.warn(`[adoption-timeline PATCH] lifecycle re-detection failed (non-fatal): ${redetectErr.message}`);
        }
      });
    }
  } catch (error: any) {
    if (error._sent) return;
    logger.error('Error patching adoption timeline:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/stabilization-window
 *
 * Phase 1A — Pro Forma stabilization window controls.
 * Accepts:
 *   stabilizationTargetPct    — vacancy threshold as decimal occupancy (0.95 = 5% vacancy target)
 *   stabilizationYearOverride — operator manual pin for Pro Forma window year (integer ≥ 1, null to clear)
 *
 * Writes to deal_assumptions.stabilization_target_pct and
 * deal_assumptions.stabilization_year_override.
 */
router.patch('/:dealId/assumptions/stabilization-window', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const body = req.body as Record<string, number | null | undefined>;

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const sqlParams: (number | null | string)[] = [dealId];

    const addCol = (col: string, val: number | null | undefined) => {
      if (val === undefined) return;
      if (val !== null) {
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          throw Object.assign(new Error(`${col}: must be a finite number or null`), { _sent: false });
        }
      }
      sqlParams.push(val);
      setClauses.push(`${col} = $${sqlParams.length}`);
    };

    // stabilizationTargetPct: decimal occupancy threshold (0–1)
    const stp = body.stabilizationTargetPct;
    if (stp !== undefined && stp !== null && (typeof stp !== 'number' || stp < 0 || stp > 1)) {
      return res.status(400).json({ error: 'stabilizationTargetPct must be between 0 and 1' });
    }
    addCol('stabilization_target_pct', stp);

    // stabilizationYearOverride: positive integer year or null to clear
    const syo = body.stabilizationYearOverride;
    if (syo !== undefined && syo !== null && (typeof syo !== 'number' || !Number.isInteger(syo) || syo < 1)) {
      return res.status(400).json({ error: 'stabilizationYearOverride must be a positive integer or null' });
    }
    addCol('stabilization_year_override', syo);

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET ${setClauses.join(', ')}`,
      sqlParams
    );

    res.json({ success: true });
  } catch (error: any) {
    if (error._sent) return;
    logger.error('Error patching stabilization window:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/adoption-timeline/clear
 *
 * Clears all adoption timeline fields for the deal (resets to platform defaults).
 * Task #1271.
 */
router.patch('/:dealId/assumptions/adoption-timeline/clear', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    await pool.query(
      `UPDATE deal_assumptions SET
         construction_months        = NULL,
         lease_up_months            = NULL,
         absorption_units_per_month = NULL,
         stabilization_target_pct   = NULL,
         updated_at                 = NOW()
       WHERE deal_id = $1`,
      [dealId]
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error clearing adoption timeline:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /:dealId/assumptions/closing-costs
 *
 * Surgical write for closing cost sub-line overrides (Item 2 — DealTermsTab).
 * Stores each provided sub-line as its own su: key in per_year_overrides.
 * The composer sums any set sub-lines to derive suClosingCosts; existing
 * aggregate su:closingCosts override is used only when no sub-lines are set.
 * Pass null for a field to clear its override (reverts to platform estimate share).
 * Body: { brokerFee?, legalDD?, lenderOrig?, reserves?, other? }  — all optional
 */
router.patch('/:dealId/assumptions/closing-costs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const { brokerFee, legalDD, lenderOrig, reserves, other } = req.body as {
      brokerFee?:  number | null;
      legalDD?:    number | null;
      lenderOrig?: number | null;
      reserves?:   number | null;
      other?:      number | null;
    };

    const fields: Record<string, number | null | undefined> = { brokerFee, legalDD, lenderOrig, reserves, other };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && (typeof v !== 'number' || v < 0)) {
        return res.status(400).json({ error: `${k} must be a non-negative number or null` });
      }
    }

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
    }

    const suMap: Array<[string, string]> = [
      ['brokerFee',  'closingCostsBrokerFee'],
      ['legalDD',    'closingCostsLegalDD'],
      ['lenderOrig', 'closingCostsLenderOrig'],
      ['reserves',   'closingCostsReserves'],
      ['other',      'closingCostsOther'],
    ];

    // Build a dynamic JSONB expression that merges/removes sub-line keys
    const params: unknown[] = [dealId];
    let pyrExpr = `COALESCE(deal_assumptions.per_year_overrides, '{}'::jsonb)`;
    let anyField = false;

    for (const [field, suKey] of suMap) {
      const val = fields[field];
      if (val === undefined) continue; // not in body — leave untouched
      anyField = true;
      if (val === null) {
        // Remove the key
        pyrExpr = `(${pyrExpr} - 'su:${suKey}')`;
      } else {
        params.push(val);
        pyrExpr = `(${pyrExpr} || jsonb_build_object('su:${suKey}', jsonb_build_object('value', $${params.length}::numeric)))`;
      }
    }

    if (!anyField) return res.json({ success: true });

    // INSERT uses '{}' as the starting point when the row doesn't exist yet
    const insertExpr = pyrExpr.replace(
      `COALESCE(deal_assumptions.per_year_overrides, '{}'::jsonb)`,
      `'{}'::jsonb`,
    );

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, per_year_overrides, updated_at)
       VALUES ($1, ${insertExpr}, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         per_year_overrides = ${pyrExpr},
         updated_at         = NOW()`,
      params,
    );

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error patching closing costs:', error);
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
    const holdYears = Math.min(Math.max(parseInt(req.query.hold as string) || 10, 1), 36);
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
router.patch('/:dealId/financials/override', requireAuth, requireCapability('edit:capital_structure'), async (req: AuthenticatedRequest, res: Response) => {
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
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
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

    const RECHECK_FIELDS = new Set(['vacancyPct', 'marketRentPerUnit']);
    if (RECHECK_FIELDS.has(field)) {
      triggerStabilizationRecheck(dealId);
    }
  } catch (error: any) {
    logger.error('Error applying financials override:', error);
    const status = error.message?.includes('No year1 seed') ? 422
      : error.message?.includes('not a layered value') || error.message?.includes('Field path invalid') ? 400
      : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

/**
 * ─── Monthly assumption overrides (Section 5A traffic + LEASING schedule) ────
 *
 * GET  /:dealId/assumptions/monthly
 *   Returns all stored monthly overrides for the deal as:
 *   { overrides: { [fieldKey]: { [absMonth]: string } } }
 *
 * PATCH /:dealId/assumptions/monthly
 *   Body: { field: string, month: number, value: string | null }
 *   Upserts or clears a single cell.  value=null deletes the row.
 */
router.get('/:dealId/assumptions/monthly', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId ?? 'unknown';
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { rows } = await pool.query(
      `SELECT field_key, abs_month, value FROM deal_monthly_assumptions WHERE deal_id = $1 ORDER BY field_key, abs_month`,
      [dealId]
    );
    const overrides: Record<string, Record<number, string>> = {};
    for (const row of rows) {
      if (!overrides[row.field_key]) overrides[row.field_key] = {};
      overrides[row.field_key][row.abs_month] = row.value;
    }
    res.json({ success: true, data: { overrides } });
  } catch (err: any) {
    logger.error('GET monthly assumptions error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:dealId/assumptions/monthly', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { field, month, value } = req.body as { field: string; month: number; value: string | null };
    const userId = req.user?.userId ?? 'unknown';

    if (!field || typeof field !== 'string') return res.status(400).json({ error: 'field required' });
    if (!Number.isInteger(month) || month < 1 || month > 120) return res.status(400).json({ error: 'month must be 1–120' });

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (value === null || value === undefined) {
      await pool.query(
        `DELETE FROM deal_monthly_assumptions WHERE deal_id = $1 AND field_key = $2 AND abs_month = $3`,
        [dealId, field, month]
      );
    } else {
      await pool.query(
        `INSERT INTO deal_monthly_assumptions (deal_id, field_key, abs_month, value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (deal_id, field_key, abs_month)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [dealId, field, month, String(value)]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error('PATCH monthly assumptions error:', err);
    res.status(500).json({ error: err.message });
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
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
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
    const year1 = typeof res.year1 === 'string'
      ? JSON.parse(res.year1)
      : res.year1;
    if (!year1) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'deal_assumptions.year1 is empty' };
    }
    const current = Array.isArray(year1.other_income_user_lines) ? year1.other_income_user_lines : [];
    const next = mutator(current);
    year1.other_income_user_lines = next;
    recomputeDerived(year1);

    // Write user lines into the active scenario first (non-destructive jsonb_set).
    // The trg_sync_underwriting_scenario trigger does a FULL OVERWRITE of
    // deal_assumptions.year1 with NEW.year1 every time a scenario row is touched
    // (e.g. by seedCapitalStructureDefaults on every GET /financials). Without this
    // write, the trigger would erase other_income_user_lines on the next GET.
    // jsonb_set leaves all other scenario fields intact; the trigger then syncs
    // the scenario's year1 (now including user lines) to deal_assumptions.
    await client.query(
      `UPDATE deal_underwriting_scenarios
          SET year1      = jsonb_set(COALESCE(year1, '{}'), '{other_income_user_lines}', $1::jsonb),
              updated_at = NOW()
        WHERE deal_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [JSON.stringify(next), dealId]
    );

    // Explicit deal_assumptions write follows the scenario update (and the
    // trigger it fires) so this becomes the last write within the transaction —
    // guaranteeing deal_assumptions.year1 is always the full year1 with user lines.
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

/**
 * Validates and normalises an optional adoption block. Returns { ok: true, adoption }
 * on success (adoption may be null to clear it), or { ok: false, error } on bad input.
 * Task #1147.
 */
function validateAdoption(raw: unknown): { ok: true; adoption: AdoptionBlock | null } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, adoption: undefined as any }; // not provided — leave as-is
  if (raw === null) return { ok: true, adoption: null }; // explicit null → clear ramp
  if (typeof raw !== 'object') return { ok: false, error: 'adoption must be an object or null' };
  const a = raw as Record<string, unknown>;
  if (typeof a.ramp_start_period !== 'number' || !Number.isFinite(a.ramp_start_period) || a.ramp_start_period < 0)
    return { ok: false, error: 'adoption.ramp_start_period must be a non-negative number' };
  if (typeof a.ramp_duration_months !== 'number' || !Number.isFinite(a.ramp_duration_months) || a.ramp_duration_months < 0)
    return { ok: false, error: 'adoption.ramp_duration_months must be a non-negative number' };
  if (typeof a.steady_state_monthly !== 'number' || !Number.isFinite(a.steady_state_monthly) || a.steady_state_monthly < 0)
    return { ok: false, error: 'adoption.steady_state_monthly must be a non-negative number' };
  if (typeof a.probability_adopted !== 'number' || !Number.isFinite(a.probability_adopted) || a.probability_adopted < 0 || a.probability_adopted > 1)
    return { ok: false, error: 'adoption.probability_adopted must be a number between 0 and 1' };
  return {
    ok: true,
    adoption: {
      ramp_start_period:    a.ramp_start_period    as number,
      ramp_duration_months: a.ramp_duration_months as number,
      steady_state_monthly: a.steady_state_monthly as number,
      probability_adopted:  a.probability_adopted  as number,
    },
  };
}
type AdoptionBlock = { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null;

router.post('/:dealId/financials/other-income/user-lines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { label, monthly, qty, rate, frequency, note, source_tag, confirmed, adoption: rawAdoption } = req.body as {
      label: string; monthly?: number; qty?: number; rate?: number; frequency?: string; note?: string; source_tag?: string; confirmed?: boolean; adoption?: unknown;
    };
    if (!label || typeof label !== 'string' || !label.trim()) {
      logger.warn('User-line POST rejected: missing label', { dealId, body: req.body });
      return res.status(400).json({ error: 'label is required' });
    }
    if (source_tag !== undefined && (typeof source_tag !== 'string' || source_tag.length > 128)) {
      return res.status(400).json({ error: 'source_tag must be a string ≤ 128 chars' });
    }
    const derived = deriveMonthly({ monthly, qty, rate, frequency });
    if (derived.ok === false) {
      logger.warn('User-line POST rejected by deriveMonthly', { dealId, body: req.body, reason: derived.error });
      return res.status(400).json({ error: derived.error });
    }
    const adoptionResult = validateAdoption(rawAdoption);
    if (!adoptionResult.ok) return res.status(400).json({ error: adoptionResult.error });

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
        ...(source_tag ? { source_tag: source_tag.trim() } : {}),
        ...(confirmed === true ? { confirmed: true } : {}),
        ...(rawAdoption !== undefined ? { adoption: adoptionResult.adoption } : {}),
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
    const { label, monthly, qty, rate, frequency, note, confirmed, adoption: rawAdoption } = req.body as {
      label?: string; monthly?: number; qty?: number; rate?: number; frequency?: string; note?: string; confirmed?: boolean; adoption?: unknown;
    };
    if (label != null && typeof label !== 'string') return res.status(400).json({ error: 'label must be a string' });
    const adoptionResult = rawAdoption !== undefined ? validateAdoption(rawAdoption) : null;
    if (adoptionResult && !adoptionResult.ok) return res.status(400).json({ error: adoptionResult.error });
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
        ...(confirmed !== undefined ? (confirmed === true ? { confirmed: true } : { confirmed: false }) : {}),
        updated_at: new Date().toISOString(),
      };
      // Apply per-unit fields explicitly: present → set, absent → drop the
      // key entirely so the persisted JSON doesn't carry stale qty/rate.
      if (nextQty  != null) updated.qty       = nextQty;       else delete updated.qty;
      if (nextRate != null) updated.rate      = nextRate;      else delete updated.rate;
      if (nextFreq != null) updated.frequency = nextFreq;      else delete updated.frequency;
      // Adoption block: explicitly null → clear; present object → replace; absent → preserve.
      if (adoptionResult) {
        if (adoptionResult.adoption === null) delete updated.adoption;
        else updated.adoption = adoptionResult.adoption;
      }
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

/**
 * PATCH /:dealId/financials/other-income/category-overrides
 *
 * Saves a user override for a single other-income category's resolved value.
 * Task #1145 — OtherIncomeTab editable categories.
 *
 * Body: { category: string, value: number | null }
 *   category — one of the CATS keys: parking | pet | storage | laundry | rubs | fees | insurance_admin | other
 *   value    — annual $/yr override, or null to clear (restores seeder-reconciled value)
 *
 * Persists to deal_assumptions.year1.other_income_overrides[category].
 * The financials-composer reads this map and applies user_override resolution.
 */
const VALID_OI_CATEGORIES = new Set(['parking','pet','storage','laundry','rubs','fees','insurance_admin','other']);

router.patch('/:dealId/financials/other-income/category-overrides', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { category, value } = req.body as { category: string; value: number | null };
    const userId = req.user?.userId ?? 'unknown';

    if (!category || typeof category !== 'string' || !VALID_OI_CATEGORIES.has(category)) {
      return res.status(400).json({ error: `category must be one of: ${[...VALID_OI_CATEGORIES].join(', ')}` });
    }
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({ error: 'value must be a non-negative number or null' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
        return res.status(403).json({ success: false, error: 'Not authorized for this deal' });
      }

      const res2 = await client.query(
        `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 FOR UPDATE`,
        [dealId]
      );
      if (res2.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'deal_assumptions not seeded for this deal yet' });
      }

      const year1 = typeof res2.year1 === 'string'
        ? JSON.parse(res2.year1)
        : res2.year1;

      if (!year1) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'deal_assumptions.year1 is empty' });
      }

      // Mutate the overrides map in-place
      if (!year1.other_income_overrides || typeof year1.other_income_overrides !== 'object') {
        year1.other_income_overrides = {};
      }
      if (value === null) {
        delete year1.other_income_overrides[category];
        // Remove the key entirely when empty to keep the JSONB clean
        if (Object.keys(year1.other_income_overrides).length === 0) {
          delete year1.other_income_overrides;
        }
      } else {
        year1.other_income_overrides[category] = value;
      }

      await client.query(
        `UPDATE deal_assumptions SET year1 = $1::jsonb, updated_at = NOW() WHERE deal_id = $2`,
        [JSON.stringify(year1), dealId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, data: { dealId, category, value } });
  } catch (error: any) {
    logger.error('Error saving other income category override:', error);
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
        const dbNarrative = dbRow?.narrative_text ?? null;
        const dbGeneratedAt = dbRow?.narrative_generated_at;
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
    const holdYears = Math.min(Math.max(parseInt(req.query.hold as string) || 10, 1), 36);

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

    // Audit trail — fire-and-forget; never blocks the download
    pool.query(
      `INSERT INTO activity_log
         (id, deal_id, user_id, user_name, user_email, action, entity_type, entity_id, metadata, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $3, 'financials.export', 'deal', $4, $5, NOW())`,
      [
        dealId,
        req.user!.userId,
        req.user!.email,
        dealId,
        JSON.stringify({ hold_years: holdYears, filename, deal_name: data.dealName }),
      ],
    ).catch((err: unknown) => logger.warn('Export audit log failed (non-fatal):', err));

    res.send(buffer);
  } catch (error: unknown) {
    logger.error('Error exporting deal financials XLSX:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OperatorStance endpoints
//
// Routes use distinct sub-paths (/stance, /stance/reset, /stance/affected-fields)
// so they cannot collide with /:dealId/financials or other parameterized routes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /:dealId/stance
 * Returns the resolved OperatorStance (persisted or MARKET defaults).
 */
router.get('/:dealId/stance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const stance = await getStanceForDeal(dealId, userId);
    res.json({ stance });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * PUT /:dealId/stance
 * Merge-patch the stance for a deal. Partial updates are supported.
 * Triggers a background stance-only reblend against the last cached snapshot.
 */
router.put('/:dealId/stance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const patch = req.body as OperatorStancePatch;
    const stance = await saveStance(dealId, userId, patch);
    res.json({ stance, reblendTriggered: true });
  } catch (error: unknown) {
    logger.error('Error saving operator stance:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('Invalid stance') ? 400 : msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * POST /:dealId/stance/reset
 * Reset stance to MARKET defaults (deletes persisted stance).
 */
router.post('/:dealId/stance/reset', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const stance = await resetStance(dealId, userId);
    res.json({ stance, message: 'Stance reset to MARKET defaults' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * GET /:dealId/stance/affected-fields
 *
 * Returns the union of proforma field paths affected by the current stance,
 * with per-field net bps deltas and source tags. Two-tier logic:
 *
 *   source='snapshot'  — fields with stanceModulated=true in the latest
 *                        deal_underwriting_snapshots row. This is the ground
 *                        truth after a Cashflow Agent run or reblend.
 *   source='rules'     — fields that the current stance WILL modulate when
 *                        the agent next runs but are not yet in the snapshot
 *                        (stance was updated since last reblend, or agent
 *                        has never run). Computed deterministically from
 *                        STANCE_MODULATED_FIELD_PATHS + computeStanceDelta().
 *
 * The response deliberately includes both tiers so the Console UI can show
 * yellow markers immediately after a PUT /stance without waiting for reblend.
 * Callers that want only persisted-snapshot fields should filter by source.
 */
router.get('/:dealId/stance/affected-fields', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const stance = await getStanceForDeal(dealId, userId);
    const affectedFields = await computeAffectedFields(dealId, stance);
    res.json({
      stance: { underwritingPosture: stance.underwritingPosture, defaulted: stance.defaulted },
      affectedFields,
      totalModulatedFields: affectedFields.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

// ─── M22 Floor-Plan Cost Write-Back ──────────────────────────────────────────
/**
 * PATCH /api/v1/deals/:dealId/m22/floor-plan-cost
 *
 * Persists a per-floor-plan renovation cost override from the FloorPlanGrid UI
 * (Pattern A) back to the M22 capex_schedule. Called by FloorPlanGrid on blur /
 * after 800ms debounce when the sponsor edits the "Reno Cost per Unit" cell.
 *
 * Body: { floor_plan_id: string; cost_per_unit: number | null }
 *
 * Storage: persists to deal_assumptions.assumptions under the JSON path
 *   capex_schedule → floor_plan_costs → {floor_plan_id}
 *
 * This is the M22 capex_schedule shared state for Phase 1.
 * `deal_assumptions.assumptions.capex_schedule` is the canonical Phase 1
 * store for all M22 capex data that does not yet have a dedicated DB table.
 * Both FloorPlanGrid and M22's own UI surface read from and write to this
 * path (last-write-wins, per spec § Q6). The FloorPlanGrid reads it back
 * on next render through the agent payload / GET deal-financials response.
 *
 * Phase 2 follow-on (#800 / #802): wire the module-wiring orchestrator's
 * `capex_schedule.updated` event so S&U, Cap Stack, and M14 Risk recompute
 * immediately after a cost write.
 */
router.patch('/:dealId/m22/floor-plan-cost', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const { floor_plan_id, cost_per_unit } = req.body as {
      floor_plan_id: string;
      cost_per_unit: number | null;
    };

    if (!floor_plan_id || typeof floor_plan_id !== 'string') {
      return res.status(400).json({ error: 'floor_plan_id is required' });
    }
    if (cost_per_unit !== null && (typeof cost_per_unit !== 'number' || cost_per_unit < 0)) {
      return res.status(400).json({ error: 'cost_per_unit must be a non-negative number or null' });
    }

    const pool = getPool();

    // Verify deal ownership
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Upsert the floor-plan cost override into deal_assumptions JSONB.
    // INSERT ON CONFLICT ensures the row is created if it doesn't exist yet,
    // preventing silent non-persist when no deal_assumptions row exists yet.
    const overridePayload = JSON.stringify({
      cost_per_unit,
      updated_at: new Date().toISOString(),
    });
    // Store under capex_schedule.floor_plan_costs.{floor_plan_id} — this IS the
    // M22 shared state key path. The nested jsonb_set builds the path one level
    // at a time so intermediate keys are created if absent.
    const upsertResult = await pool.query(
      `INSERT INTO deal_assumptions (deal_id, assumptions, updated_at)
       VALUES (
         $3,
         jsonb_set(
           jsonb_set('{}'::jsonb, ARRAY['capex_schedule'], '{}'::jsonb, true),
           ARRAY['capex_schedule', 'floor_plan_costs', $1],
           $2::jsonb,
           true
         ),
         NOW()
       )
       ON CONFLICT (deal_id) DO UPDATE
       SET assumptions = jsonb_set(
         jsonb_set(
           COALESCE(deal_assumptions.assumptions, '{}'::jsonb),
           ARRAY['capex_schedule'],
           COALESCE(
             (COALESCE(deal_assumptions.assumptions, '{}'::jsonb))->'capex_schedule',
             '{}'::jsonb
           ),
           true
         ),
         ARRAY['capex_schedule', 'floor_plan_costs', $1],
         $2::jsonb,
         true
       ),
       updated_at = NOW()`,
      [floor_plan_id, overridePayload, dealId]
    );
    if ((upsertResult.rowCount ?? 0) === 0) {
      return res.status(500).json({ error: 'Failed to persist floor-plan cost override' });
    }

    logger.info(`M22 floor-plan cost override saved: deal=${dealId} plan=${floor_plan_id} cost=${cost_per_unit}`);

    // Emit M22 DATA_UPDATED so the module wiring orchestrator cascades recomputes
    // to the P2-4 pipeline consumers: Sources & Uses (capital-structure-adapter),
    // Cap Stack (wireCapitalStack), and M14 Risk (applyM14RiskAdjustments).
    // The orchestrator subscribes to ModuleEventType.DATA_UPDATED in its
    // initialize() handler and calls executeCascade from the downstream modules.
    moduleEventBus.emitDebounced({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M22' as Parameters<typeof moduleEventBus.emitDebounced>[0]['sourceModule'],
      dealId,
      data: {
        source: 'floor_plan_grid_cost_override',
        floor_plan_id,
        cost_per_unit,
      },
      timestamp: new Date(),
    });

    return res.json({ ok: true, floor_plan_id, cost_per_unit });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`M22 floor-plan cost write-back failed: ${msg}`);
    return res.status(500).json({ error: msg });
  }
});

// ─── M22 Floor-Plan Positioning Write-Back ────────────────────────────────────
/**
 * PATCH /api/v1/deals/:dealId/m22/floor-plan-positioning
 *
 * Persists per-floor-plan positioning percentile, capture rate, and custom
 * post-reno target rent from the FloorPlanGrid UI back to the M22 capex_schedule.
 * Called by FloorPlanGrid after 800ms debounce when the sponsor edits the
 * Positioning or Capture Rate cells.
 *
 * Body: {
 *   floor_plan_id: string;
 *   positioning_percentile: number;
 *   capture_rate: number;
 *   post_reno_target_rent: number | null;
 * }
 *
 * Storage: deal_assumptions.assumptions.capex_schedule.floor_plan_positions.{id}
 *
 * After persisting, emits M22 DATA_UPDATED so the P2-4 projections adapter can
 * incorporate updated positioning into the per-unit walk (phase-weighted
 * blended occupancy and rent growth curves in M07ProjectionsAdapter).
 */
router.patch('/:dealId/m22/floor-plan-positioning', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const { floor_plan_id, positioning_percentile, capture_rate, post_reno_target_rent } = req.body as {
      floor_plan_id: string;
      positioning_percentile: number;
      capture_rate: number;
      post_reno_target_rent: number | null;
    };

    if (!floor_plan_id || typeof floor_plan_id !== 'string') {
      return res.status(400).json({ error: 'floor_plan_id is required' });
    }
    if (typeof positioning_percentile !== 'number' || typeof capture_rate !== 'number') {
      return res.status(400).json({ error: 'positioning_percentile and capture_rate must be numbers' });
    }

    const pool = getPool();

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const payload = JSON.stringify({
      positioning_percentile,
      capture_rate,
      post_reno_target_rent,
      updated_at: new Date().toISOString(),
    });

    const upsertResult = await pool.query(
      `INSERT INTO deal_assumptions (deal_id, assumptions, updated_at)
       VALUES (
         $3,
         jsonb_set(
           jsonb_set('{}'::jsonb, ARRAY['capex_schedule'], '{}'::jsonb, true),
           ARRAY['capex_schedule', 'floor_plan_positions', $1],
           $2::jsonb,
           true
         ),
         NOW()
       )
       ON CONFLICT (deal_id) DO UPDATE
       SET assumptions = jsonb_set(
         jsonb_set(
           COALESCE(deal_assumptions.assumptions, '{}'::jsonb),
           ARRAY['capex_schedule'],
           COALESCE(
             (COALESCE(deal_assumptions.assumptions, '{}'::jsonb))->'capex_schedule',
             '{}'::jsonb
           ),
           true
         ),
         ARRAY['capex_schedule', 'floor_plan_positions', $1],
         $2::jsonb,
         true
       ),
       updated_at = NOW()`,
      [floor_plan_id, payload, dealId]
    );
    if ((upsertResult.rowCount ?? 0) === 0) {
      return res.status(500).json({ error: 'Failed to persist floor-plan positioning override' });
    }

    logger.info(`M22 floor-plan positioning saved: deal=${dealId} plan=${floor_plan_id} pct=${positioning_percentile} cap=${capture_rate}`);

    // Emit so M07ProjectionsAdapter recalculates per-unit walk with updated
    // positioning inputs (rent growth curves, absorption pacing).
    moduleEventBus.emitDebounced({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M22' as Parameters<typeof moduleEventBus.emitDebounced>[0]['sourceModule'],
      dealId,
      data: {
        source: 'floor_plan_grid_positioning_override',
        floor_plan_id,
        positioning_percentile,
        capture_rate,
      },
      timestamp: new Date(),
    });

    return res.json({ ok: true, floor_plan_id, positioning_percentile, capture_rate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`M22 floor-plan positioning write-back failed: ${msg}`);
    return res.status(500).json({ error: msg });
  }
});

// ─── Manual Unit Mix CRUD ─────────────────────────────────────────────────────
/**
 * PATCH /:dealId/unit-mix
 *
 * Persists the analyst-built unit mix array for development deals (no rent roll).
 * Replaces deal_assumptions.unit_mix with the supplied array, then fires
 * propagateUnitMix(dealId, 'manual') so financial_models, 3D design, dev capacity,
 * and deals.target_units all stay in sync.
 *
 * Body: { unitMix: Array<ManualUnitType> }
 *
 * ManualUnitType fields (stored as-is; the proforma service reads type/count/avg_sqft/
 * in_place_rent/market_rent regardless of extra fields):
 *   id           string   — client-generated UUID
 *   type         string   — floor plan label (e.g. "1BR/1BA")
 *   bedrooms     number   — 0 = Studio, 1, 2, 3, 4+
 *   bathrooms    number   — 0.5 step
 *   count        number   — unit count > 0
 *   avg_sqft     number   — average square footage
 *   in_place_rent number  — projected rent $/mo
 *   market_rent  number|null
 *   notes        string|null
 *   source       'manual'
 */
router.patch('/:dealId/unit-mix', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const { unitMix } = req.body as { unitMix: unknown[] };

    if (!Array.isArray(unitMix)) {
      return res.status(400).json({ error: 'unitMix must be an array' });
    }

    const pool = getPool();

    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const validated = unitMix.map((entry: any) => {
      const count   = Number(entry.count ?? 0);
      const avg_sqft = entry.avg_sqft != null ? Number(entry.avg_sqft) : null;
      const in_place_rent = entry.in_place_rent != null ? Number(entry.in_place_rent) : null;
      const market_rent   = entry.market_rent  != null ? Number(entry.market_rent)  : null;
      // Validate numeric fields; reject rows with NaN/negative values
      if (!Number.isFinite(count) || count <= 0)             return null;
      if (avg_sqft     != null && (!Number.isFinite(avg_sqft)     || avg_sqft     <= 0)) return null;
      if (in_place_rent!= null && (!Number.isFinite(in_place_rent)|| in_place_rent <= 0)) return null;
      if (market_rent  != null && (!Number.isFinite(market_rent)  || market_rent  <= 0)) return null;
      return {
        id:            entry.id ?? randomUUID(),
        type:          String(entry.type ?? entry.label ?? 'Unknown'),
        bedrooms:      entry.bedrooms  != null ? Number(entry.bedrooms)  : null,
        bathrooms:     entry.bathrooms != null ? Number(entry.bathrooms) : null,
        count,
        avg_sqft,
        in_place_rent,
        market_rent,
        notes:         entry.notes ?? null,
        source:        'manual',
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    const dealTargetUnits: number | null = dealCheck.target_units
      ? Number(dealCheck.target_units)
      : null;
    const totalCount = validated.reduce((s, e) => s + e.count, 0);

    // Hard-block over-allocation: analysts can add rows incrementally (sum < target is fine),
    // but exceeding the target corrupts downstream capacity calculations.
    if (dealTargetUnits != null && dealTargetUnits > 0 && totalCount > dealTargetUnits) {
      return res.status(400).json({
        error: `Unit count (${totalCount}) exceeds deal target (${dealTargetUnits}) by ${totalCount - dealTargetUnits}. Reduce counts before saving.`,
        code: 'UNIT_COUNT_EXCESS',
        totalCount,
        dealTargetUnits,
      });
    }

    // Balanced = sum exactly equals target (or no target set)
    const balanced = dealTargetUnits == null || dealTargetUnits <= 0
      ? true
      : totalCount === dealTargetUnits;

    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, unit_mix, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (deal_id) DO UPDATE
       SET unit_mix   = $2::jsonb,
           updated_at = NOW()`,
      [dealId, JSON.stringify(validated)]
    );

    // Write the manual mix into deals.module_outputs.unitMixOverride so that
    // getAuthoritativeUnitMix() (priority #1 source) picks it up before calling
    // propagateUnitMix. Include `bedrooms` explicitly so parseUnitMixData()
    // classifies by bedroom count rather than label heuristics — this is critical
    // for custom labels ("Plan A") and 4BR+ units which otherwise drop from totals.
    const overridePayload = validated.map(e => ({
      unitType:  e.type,
      type:      e.type,
      bedrooms:  e.bedrooms,   // numeric classifier for parseUnitMixData()
      count:     e.count,
      avgSF:     e.avg_sqft ?? 0,
      inPlaceRent: e.in_place_rent ?? null,
      marketRent:  e.market_rent  ?? null,
    }));
    await pool.query(
      `UPDATE deals
       SET module_outputs = jsonb_set(
         COALESCE(module_outputs, '{}'::jsonb),
         '{unitMixOverride}',
         $2::jsonb
       )
       WHERE id = $1`,
      [dealId, JSON.stringify(overridePayload)]
    );

    logger.info(`Manual unit mix saved: deal=${dealId} rows=${validated.length} balanced=${balanced}`);

    // Only propagate to downstream modules (financial model, 3D, capacity) when
    // the mix is fully balanced — avoids partial totals corrupting target_units.
    let propagationResult: Awaited<ReturnType<typeof propagateUnitMix>> | null = null;
    if (balanced) {
      propagationResult = await propagateUnitMix(dealId, 'manual');
    }

    return res.json({
      ok: true,
      rows: validated.length,
      totalCount,
      dealTargetUnits,
      balanced,
      ...(propagationResult ? {
        propagation: {
          success: propagationResult.success,
          modulesUpdated: propagationResult.modulesUpdated,
        },
      } : { propagation: null }),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Manual unit mix save failed: ${msg}`);
    return res.status(500).json({ error: msg });
  }
});

export default router;

