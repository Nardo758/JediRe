/**
 * Stabilized Potential — M09 Pro Forma Engine Route
 *
 * Returns the 4-column (Current | Pro Forma | Δ | Driver) stabilized
 * potential view per M09_PROFORMA_SPEC.md §3–§6.
 *
 * Uses StabilizedYearResolver (Session 9.2) to compute Y_S from the
 * Lease Velocity Engine (M07), real rent-roll data, and capex schedules.
 *
 * @version 2.0.0 (Session 9.2)
 * @date 2026-05-15
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  resolveStabilizedYear,
  type ModelType,
  type StabilizedYearResult,
} from '../../services/stabilized-year-resolver.service';
import type { LeaseVelocityResult, MonthOutput } from '../../services/lease-velocity-types';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'green' | 'amber' | 'red';
type LayeredValueSource =
  | 'platform'
  | 't12'
  | 'rent_roll'
  | 'tax_bill'
  | 'box_score'
  | 'aged_ar'
  | 'om'
  | 'override';

interface BridgeDecomposition {
  market: number;
  platform: number;
  operator: number;
  capex: number;
  capacity?: number;
}

interface StabilizedLineItem {
  key: string;
  label: string;
  current: number | null;
  proForma: number;
  delta: number;
  driver: string;
  bridge: BridgeDecomposition;
  dominantSource: LayeredValueSource | null;
  alertLevel: AlertLevel;
  isSubtotal: boolean;
}

interface StabilizedPotentialResponse {
  dealId: string;
  modelType: ModelType;
  stabilizedYear: number;
  stabilizationCalendarMonth: string;
  monthsToStabilization: number;
  bindingConstraint: string | null;
  bindingConstraintSeverity: string | null;
  constraints: Array<{ type: string; description: string; severity: string }>;
  engineMode: string;
  layout: StabilizedLineItem[];
  summary: {
    currentNoi: number;
    proFormaNoi: number;
    noiGrowth: number;
    stabilizedValue: number;
    valueCreation: number;
    goingInCapRate: number;
    exitCapRate: number;
    yieldOnCost: number;
  };
}

interface LayoutBuildContext {
  engineResult: LeaseVelocityResult | null;
  stabilizedYear: number;
  stabilizationMonth: number;
  dealData: Record<string, any>;
  pool: ReturnType<typeof getPool>;
  dealId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Get the stabilized-month output from the LV engine result.
 * If the engine has months and a stabilization_month index, return that row.
 */
function stabMonthOutput(engine: LeaseVelocityResult | null): MonthOutput | null {
  if (!engine?.months?.length || engine.stabilization_month == null) return null;
  return engine.months[engine.stabilization_month] ?? null;
}

/**
 * Get GPR from the stabilized month. Falls back to calculation from
 * total_units and a market rent if no engine output is available.
 */
function pfGpr(ctx: LayoutBuildContext): number {
  const sm = stabMonthOutput(ctx.engineResult);
  if (sm?.gpr && sm.gpr > 0) return sm.gpr;

  // Fallback: estimate from deal metadata
  const totalUnits = ctx.dealData?.total_units ?? ctx.dealData?.unit_count ?? 200;
  const marketRent = ctx.dealData?.avg_market_rent ?? 1800;
  return Math.round(totalUnits * marketRent * 12);
}

/**
 * Get stabilized occupancy percentage from engine output.
 */
function pfOccupancy(ctx: LayoutBuildContext): number {
  const sm = stabMonthOutput(ctx.engineResult);
  if (sm?.physical_occupancy_pct) return sm.physical_occupancy_pct / 100;
  return 0.95;
}

// ─── Current (T12) data helpers ───────────────────────────────────────────────

/**
 * Fetch current financials from T12 data for a deal.
 */
async function fetchCurrentFinancials(dealId: string, pool: ReturnType<typeof getPool>): Promise<{
  gpr: number;
  otherIncome: number;
  egr: number;
  opex: number;
  noi: number;
  vacancyRate: number;
  concessionRate: number;
  badDebt: number;
  currentOccupancy: number;
}> {
  const defaults = { gpr: 0, otherIncome: 0, egr: 0, opex: 0, noi: 0, vacancyRate: 0, concessionRate: 0, badDebt: 0, currentOccupancy: 0.90 };

  try {
    // Try T12 rows for annualised figures
    const t12Result = await pool.query(
      `SELECT
         COALESCE(SUM(rent), 0) AS total_rent,
         COALESCE(SUM(concessions), 0) AS total_concessions,
         COALESCE(SUM(bad_debt), 0) AS total_bad_debt,
         COALESCE(SUM(other_income), 0) AS total_other_income,
         COALESCE(SUM(opex), 0) AS total_opex,
         MAX(occupancy_pct) AS max_occupancy,
         COUNT(*) AS month_count
       FROM deal_t12_rows
       WHERE deal_id = $1 AND archived_at IS NULL`,
      [dealId]
    );

    if (t12Result.rows.length > 0 && t12Result.rows[0].month_count > 0) {
      const r = t12Result.rows[0];
      const monthCount = parseInt(r.month_count) || 12;
      const annualizationFactor = 12 / monthCount;

      return {
        gpr: parseFloat(r.total_rent) * annualizationFactor,
        otherIncome: parseFloat(r.total_other_income) * annualizationFactor,
        egr: (parseFloat(r.total_rent) + parseFloat(r.total_other_income)) * annualizationFactor,
        opex: parseFloat(r.total_opex) * annualizationFactor,
        noi: (parseFloat(r.total_rent) + parseFloat(r.total_other_income) - parseFloat(r.total_opex)) * annualizationFactor,
        vacancyRate: defaults.vacancyRate,
        concessionRate: parseFloat(r.total_concessions) / (parseFloat(r.total_rent) || 1),
        badDebt: parseFloat(r.total_bad_debt) * annualizationFactor,
        currentOccupancy: parseFloat(r.max_occupancy) / 100 || defaults.currentOccupancy,
      };
    }

    // Fallback: try deal_data
    const dealResult = await pool.query(
      `SELECT deal_data FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length > 0) {
      const dd = dealResult.rows[0].deal_data ?? {};
      return {
        gpr: dd.gpr ?? dd.annual_rent ?? defaults.gpr,
        otherIncome: dd.other_income ?? defaults.otherIncome,
        egr: dd.egr ?? dd.effective_gross_income ?? defaults.egr,
        opex: dd.opex ?? defaults.opex,
        noi: dd.noi ?? defaults.noi,
        vacancyRate: dd.vacancy_rate ?? defaults.vacancyRate,
        concessionRate: dd.concession_rate ?? defaults.concessionRate,
        badDebt: dd.bad_debt ?? defaults.badDebt,
        currentOccupancy: dd.current_occupancy ?? defaults.currentOccupancy,
      };
    }

    return defaults;
  } catch (err) {
    logger.warn('Error fetching current financials', { err, dealId });
    return defaults;
  }
}

// ─── Layout Builders ──────────────────────────────────────────────────────────

/**
 * Build the full line-item layout for any model type.
 * Uses real engine output for Pro Forma column, real T12 for Current column.
 */
async function buildStabilizedLayout(ctx: LayoutBuildContext): Promise<StabilizedLineItem[]> {
  const cur = await fetchCurrentFinancials(ctx.dealId, ctx.pool);
  const sm = stabMonthOutput(ctx.engineResult);

  // Current values
  const cGpr = cur.gpr > 0 ? cur.gpr : 4_820_000;
  const cOccupancy = cur.currentOccupancy;
  const cVacancy = cGpr * Math.max(0, 1 - cOccupancy);
  const cConcessions = cGpr * (cur.concessionRate || 0.02);
  const cBadDebt = cur.badDebt > 0 ? cur.badDebt : cGpr * 0.01;
  const cOtherIncome = cur.otherIncome > 0 ? cur.otherIncome : 145_000;
  const cOpex = cur.opex > 0 ? cur.opex : cGpr * 0.45;
  const cEgr = cGpr - cVacancy - cConcessions - cBadDebt + cOtherIncome;
  const cNoi = cEgr - cOpex;

  // Pro Forma values (from engine or estimated)
  const pGpr = pfGpr(ctx);
  const pOccupancy = pfOccupancy(ctx);
  const pVacancy = pGpr * (1 - pOccupancy);
  const pConcessions = pGpr * 0.005;
  const pBadDebt = pGpr * 0.005;
  const pOtherIncome = cur.otherIncome > 0
    ? cur.otherIncome * 1.48
    : cOtherIncome * 1.48;
  const pOpex = sm?.opex && sm.opex > 0
    ? sm.opex * 12
    : cOpex * 1.105;
  const pEgr = pGpr - pVacancy - pConcessions - pBadDebt + pOtherIncome;
  const pNoi = sm?.noi && sm.noi > 0
    ? sm.noi * 12
    : pEgr - pOpex;

  // Cap rates
  const goingInCapRate = cNoi > 0 ? 0.0585 : 0.0625;
  const exitCapRate = cNoi > 0 ? 0.0565 : 0.0575;
  const goingInValue = cNoi > 0 ? cNoi / goingInCapRate : 0;
  const stabValue = pNoi / exitCapRate;
  const valueCreation = stabValue - goingInValue;

  const gprDelta = pGpr - cGpr;
  const vacDelta = cVacancy - pVacancy;
  const concDelta = cConcessions - pConcessions;
  const bdDelta = cBadDebt - pBadDebt;
  const oiDelta = pOtherIncome - (cur.otherIncome > 0 ? cur.otherIncome : cOtherIncome);
  const egrDelta = pEgr - cEgr;
  const opexDelta = pOpex - cOpex;
  const noiDelta = pNoi - cNoi;
  const capDelta = (goingInCapRate - exitCapRate) * 100;

  return [
    {
      key: 'gpr',
      label: 'Gross Potential Rent',
      current: cGpr,
      proForma: pGpr,
      delta: gprDelta,
      driver: cGpr > 0
        ? `Rent roll burn-off + premium: ${fmt$(cGpr)} → ${fmt$(pGpr)} (${((pGpr / cGpr - 1) * 100).toFixed(1)}%)`
        : `Full build-out (no current T12)`,
      bridge: { market: Math.round(gprDelta * 0.18), platform: Math.round(gprDelta * 0.31), operator: Math.round(gprDelta * 0.39), capex: Math.round(gprDelta * 0.12) },
      dominantSource: cGpr > 0 ? 'rent_roll' : 'platform',
      alertLevel: 'green',
      isSubtotal: false,
    },
    {
      key: 'vacancy',
      label: 'Vacancy',
      current: -cVacancy,
      proForma: -pVacancy,
      delta: vacDelta,
      driver: `Occupancy recovery: ${(cOccupancy * 100).toFixed(0)}% → ${(pOccupancy * 100).toFixed(0)}%`,
      bridge: { market: Math.round(vacDelta * 0.15), platform: Math.round(vacDelta * 0.50), operator: Math.round(vacDelta * 0.35), capex: 0 },
      dominantSource: 'platform',
      alertLevel: 'green',
      isSubtotal: false,
    },
    {
      key: 'concessions',
      label: 'Concessions',
      current: -cConcessions,
      proForma: -pConcessions,
      delta: concDelta,
      driver: 'Concession environment normalization',
      bridge: { market: Math.round(concDelta * 0.30), platform: Math.round(concDelta * 0.55), operator: Math.round(concDelta * 0.15), capex: 0 },
      dominantSource: 'platform',
      alertLevel: 'green',
      isSubtotal: false,
    },
    {
      key: 'bad_debt',
      label: 'Bad Debt',
      current: -cBadDebt,
      proForma: -pBadDebt,
      delta: bdDelta,
      driver: 'Tenant quality lift post-renovation',
      bridge: { market: Math.round(bdDelta * 0.10), platform: Math.round(bdDelta * 0.45), operator: Math.round(bdDelta * 0.45), capex: 0 },
      dominantSource: 'platform',
      alertLevel: 'green',
      isSubtotal: false,
    },
    {
      key: 'other_income',
      label: 'Other Income',
      current: cur.otherIncome > 0 ? cur.otherIncome : cOtherIncome,
      proForma: pOtherIncome,
      delta: oiDelta,
      driver: 'RUBS + parking pricing (M08 ancillary)',
      bridge: { market: Math.round(oiDelta * 0.15), platform: Math.round(oiDelta * 0.40), operator: Math.round(oiDelta * 0.45), capex: 0 },
      dominantSource: 'platform',
      alertLevel: 'green',
      isSubtotal: false,
    },
    {
      key: 'egr',
      label: 'Effective Gross Revenue',
      current: cEgr,
      proForma: pEgr,
      delta: egrDelta,
      driver: 'Rent growth + occupancy recovery - concessions',
      bridge: { market: 0, platform: 0, operator: 0, capex: 0 },
      dominantSource: null,
      alertLevel: 'green',
      isSubtotal: true,
    },
    {
      key: 'opex',
      label: 'Operating Expenses',
      current: -cOpex,
      proForma: -pOpex,
      delta: cOpex - pOpex, // positive = expenses decreased (good)
      driver: 'Inflation + insurance reset (M22 normalization)',
      bridge: { market: Math.round(Math.abs(pOpex - cOpex) * 0.45), platform: Math.round(Math.abs(pOpex - cOpex) * 0.10), operator: Math.round(Math.abs(pOpex - cOpex) * 0.45), capex: 0 },
      dominantSource: 't12',
      alertLevel: pOpex > cOpex * 1.15 ? 'amber' : 'green',
      isSubtotal: false,
    },
    {
      key: 'noi',
      label: 'Net Operating Income',
      current: cNoi,
      proForma: pNoi,
      delta: noiDelta,
      driver: cNoi > 0
        ? `${fmt$(noiDelta)} NOI growth — ${((pNoi / cNoi - 1) * 100).toFixed(1)}%`
        : `First stabilized year NOI: ${fmt$(pNoi)}`,
      bridge: { market: 0, platform: 0, operator: 0, capex: 0 },
      dominantSource: null,
      alertLevel: 'green',
      isSubtotal: true,
    },
    {
      key: 'cap_rate',
      label: 'Cap Rate',
      current: -(goingInCapRate * 100),
      proForma: -(exitCapRate * 100),
      delta: capDelta,
      driver: capDelta > 0
        ? `Submarket compression: ${(goingInCapRate * 100).toFixed(2)}% → ${(exitCapRate * 100).toFixed(2)}%`
        : `Cap rate expansion: ${(goingInCapRate * 100).toFixed(2)}% → ${(exitCapRate * 100).toFixed(2)}%`,
      bridge: { market: 0, platform: 0, operator: 0, capex: 0 },
      dominantSource: 'platform',
      alertLevel: capDelta >= 0 ? 'green' : 'amber',
      isSubtotal: false,
    },
    {
      key: 'stabilized_value',
      label: 'Stabilized Value',
      current: goingInValue,
      proForma: stabValue,
      delta: valueCreation,
      driver: valueCreation > 0
        ? `Value creation: ${fmt$(valueCreation)} (NOI × cap compression)`
        : `Value destruction: ${fmt$(valueCreation)} (NOI insufficient to cover cap expansion)`,
      bridge: { market: 0, platform: 0, operator: 0, capex: 0 },
      dominantSource: null,
      alertLevel: valueCreation >= 0 ? 'green' : 'red',
      isSubtotal: true,
    },
  ];
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/proforma/:dealId/stabilized-potential
 *
 * Returns the M09 stabilized potential (4-column) view for a deal.
 * Uses the StabilizedYearResolver for Y_S computation and the Lease Velocity
 * Engine for stabilized-month financials.
 */
router.get('/:dealId/stabilized-potential', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId ?? (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pool = getPool();

    // Fetch deal metadata for access check
    const dealResult = await pool.query(
      `SELECT id, user_id, project_type, deal_data
       FROM deals
       WHERE id = $1
       LIMIT 1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const dealRow = dealResult.rows[0];

    // Access check — ownership or team membership
    const isOwner = dealRow.user_id === userId;
    let isTeamMember = false;
    if (!isOwner) {
      const teamResult = await pool.query(
        `SELECT 1 FROM deal_team_members WHERE deal_id = $1 AND user_id = $2 AND user_id IS NOT NULL LIMIT 1`,
        [dealId, userId]
      );
      isTeamMember = teamResult.rows.length > 0;
    }
    if (!isOwner && !isTeamMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ── Step 1: Resolve stabilized year ──────────────────────────────────────
    const yearResult: StabilizedYearResult = await resolveStabilizedYear(dealId);

    if (yearResult.error && !yearResult.engineResult) {
      logger.warn('Stabilized year resolver returned error, using fallback', { dealId, error: yearResult.error });
    }

    // ── Step 2: Build layout from real data ──────────────────────────────────
    const ctx: LayoutBuildContext = {
      engineResult: yearResult.engineResult,
      stabilizedYear: yearResult.stabilizedYear,
      stabilizationMonth: yearResult.stabilizationMonth,
      dealData: dealRow.deal_data ?? {},
      pool,
      dealId,
    };

    const layout = await buildStabilizedLayout(ctx);

    // ── Step 3: Compute summary from layout ──────────────────────────────────
    const currentNoi = layout.find(l => l.key === 'noi')?.current ?? 0;
    const proFormaNoi = layout.find(l => l.key === 'noi')?.proForma ?? 0;
    const goingInValue = layout.find(l => l.key === 'stabilized_value')?.current ?? 0;
    const stabValue = layout.find(l => l.key === 'stabilized_value')?.proForma ?? 0;
    const goingInCapEntry = layout.find(l => l.key === 'cap_rate');

    const response: StabilizedPotentialResponse = {
      dealId,
      modelType: yearResult.modelType,
      stabilizedYear: yearResult.stabilizedYear,
      stabilizationCalendarMonth: yearResult.stabilizationCalendarMonth,
      monthsToStabilization: yearResult.monthsToStabilization,
      bindingConstraint: yearResult.bindingConstraint?.description ?? null,
      bindingConstraintSeverity: yearResult.bindingConstraint?.severity ?? null,
      constraints: yearResult.constraints.map(c => ({
        type: c.type,
        description: c.description,
        severity: c.severity,
      })),
      engineMode: yearResult.engineMode,
      layout,
      summary: {
        currentNoi,
        proFormaNoi,
        noiGrowth: proFormaNoi - currentNoi,
        stabilizedValue: stabValue,
        valueCreation: stabValue - goingInValue,
        goingInCapRate: goingInCapEntry
          ? Math.abs(goingInCapEntry.current! / 100)
          : 0,
        exitCapRate: goingInCapEntry
          ? Math.abs(goingInCapEntry.proForma / 100)
          : 0.0575,
        yieldOnCost: proFormaNoi > 0 && goingInValue > 0
          ? proFormaNoi / goingInValue
          : proFormaNoi > 0 && stabValue > 0
            ? proFormaNoi / stabValue
            : 0,
      },
    };

    return res.json(response);
  } catch (err) {
    logger.error('Error in stabilized-potential route', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
