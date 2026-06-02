/**
 * Revenue Routes
 *
 * Repricing synthesizer endpoints for the Asset Hub REVENUE screen.
 * Mounted at /api/v1/revenue in index.replit.ts.
 *
 * Endpoints:
 *   GET /:dealId/course        — legacy BUY/HOLD/WATCH signal (kept for backward compat)
 *   GET /:dealId/beat-plan     — NOI bridge + expense findings + per-cohort repricing (Phase B)
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { synthesizeRepricingCourse, DealNotFoundError } from '../../services/repricing-synthesizer.service';
import { query, getPool } from '../../database/connection';
import { CorrelationEngineService } from '../../services/correlationEngine.service';
import {
  proFormaBeatEngine,
  ProFormaTargets,
  ActualsSnapshot,
  LeaseCohort,
  MarketSignalSet,
  ExpenseLine,
  RankTarget,
  EngineInputs,
  BeatPlan,
} from '../../services/revenue/revenue-engine.service';

const router = Router();

// ── Simple in-memory beat-plan cache (24-hour TTL) ──────────────────────────
const BEAT_PLAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const beatPlanCache = new Map<string, { plan: BeatPlan; cachedAt: number }>();

function getCached(key: string): BeatPlan | null {
  const entry = beatPlanCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BEAT_PLAN_CACHE_TTL_MS) {
    beatPlanCache.delete(key);
    return null;
  }
  return entry.plan;
}

function setCache(key: string, plan: BeatPlan): void {
  beatPlanCache.set(key, { plan, cachedAt: Date.now() });
}

// ── Input assemblers ─────────────────────────────────────────────────────────

/** Returns annualized TTM actuals from the last ≤12 non-budget months. */
async function fetchActualsSnapshot(
  propertyId: string | null,
  dealId: string,
): Promise<ActualsSnapshot | null> {
  const whereClause = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = FALSE AND is_proforma = FALSE`
    : `deal_id = $1 AND is_budget = FALSE AND is_proforma = FALSE`;
  const param = propertyId ?? dealId;

  const res = await query(
    `SELECT
       report_month,
       total_units,
       COALESCE(gross_potential_rent, 0)    AS gpr,
       COALESCE(vacancy_loss, 0)            AS vac,
       COALESCE(other_income, 0) + COALESCE(utility_reimbursement, 0)
         + COALESCE(late_fees, 0) + COALESCE(misc_income, 0) AS other,
       COALESCE(effective_gross_income, 0)  AS egi,
       COALESCE(total_opex, 0)              AS opex,
       COALESCE(noi, 0)                     AS noi
     FROM deal_monthly_actuals
     WHERE ${whereClause}
     ORDER BY report_month DESC
     LIMIT 12`,
    [param],
  );

  if (!res.rows.length) return null;

  const rows = res.rows as any[];
  const n = rows.length;
  const factor = 12 / n;

  const gpr         = rows.reduce((s, r) => s + parseFloat(r.gpr),   0) * factor;
  const vacancyLoss = rows.reduce((s, r) => s + parseFloat(r.vac),   0) * factor;
  const otherIncome = rows.reduce((s, r) => s + parseFloat(r.other), 0) * factor;
  const egi         = rows.reduce((s, r) => s + parseFloat(r.egi),   0) * factor;
  const opex        = rows.reduce((s, r) => s + parseFloat(r.opex),  0) * factor;
  const noi         = rows.reduce((s, r) => s + parseFloat(r.noi),   0) * factor;
  const units       = parseInt(rows[0].total_units, 10) || 0;

  return {
    gpr: Math.round(gpr),
    otherIncome: Math.round(otherIncome),
    vacancyLoss: -Math.abs(Math.round(vacancyLoss)),   // always negative
    egi: Math.round(egi),
    opex: Math.round(opex),
    noi: Math.round(noi),
    units,
  };
}

/** Returns annualized pro-forma targets from the most recent ≤12 budget months. */
async function fetchProFormaTargets(
  propertyId: string | null,
  dealId: string,
): Promise<ProFormaTargets | null> {
  const whereClause = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = TRUE`
    : `deal_id = $1 AND is_budget = TRUE`;
  const param = propertyId ?? dealId;

  const res = await query(
    `SELECT
       COALESCE(gross_potential_rent, 0)    AS gpr,
       COALESCE(vacancy_loss, 0)            AS vac,
       COALESCE(other_income, 0) + COALESCE(utility_reimbursement, 0)
         + COALESCE(late_fees, 0) + COALESCE(misc_income, 0) AS other,
       COALESCE(effective_gross_income, 0)  AS egi,
       COALESCE(total_opex, 0)              AS opex,
       COALESCE(noi, 0)                     AS noi
     FROM deal_monthly_actuals
     WHERE ${whereClause}
     ORDER BY report_month DESC
     LIMIT 12`,
    [param],
  );

  if (!res.rows.length) return null;

  const rows   = res.rows as any[];
  const n      = rows.length;
  const factor = 12 / n;

  const gpr         = rows.reduce((s, r) => s + parseFloat(r.gpr),   0) * factor;
  const vacancyLoss = rows.reduce((s, r) => s + parseFloat(r.vac),   0) * factor;
  const otherIncome = rows.reduce((s, r) => s + parseFloat(r.other), 0) * factor;
  const egi         = rows.reduce((s, r) => s + parseFloat(r.egi),   0) * factor;
  const opex        = rows.reduce((s, r) => s + parseFloat(r.opex),  0) * factor;
  const noi         = rows.reduce((s, r) => s + parseFloat(r.noi),   0) * factor;

  return {
    gpr: Math.round(gpr),
    otherIncome: Math.round(otherIncome),
    vacancyLoss: -Math.abs(Math.round(vacancyLoss)),
    egi: Math.round(egi),
    opex: Math.round(opex),
    noi: Math.round(noi),
  };
}

/** Months between two dates (always ≥0). */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth()   - from.getMonth()),
  );
}

/**
 * Builds LeaseCohort[] from rent_roll_units.
 * Groups by unit_type; expiryMonthOffset = avg months until lease_end.
 */
async function fetchLeaseCohorts(dealId: string): Promise<LeaseCohort[]> {
  const res = await query(
    `SELECT
       unit_type,
       COUNT(*)                               AS units,
       AVG(current_rent::float)               AS in_place_rent,
       AVG(market_rent::float)                AS market_rent,
       AVG(CASE WHEN renewal_status IN ('accepted','pending') THEN 1.0 ELSE 0.0 END) AS renewal_prob,
       AVG(COALESCE(concession_amount::float, 0)) AS avg_concession,
       AVG(current_rent::float)               AS avg_cur_rent_for_conc,
       AVG(
         EXTRACT(YEAR  FROM AGE(lease_end, NOW())) * 12 +
         EXTRACT(MONTH FROM AGE(lease_end, NOW()))
       )                                      AS avg_months_to_expiry
     FROM rent_roll_units
     WHERE deal_id = $1
       AND status IN ('occupied', 'notice')
       AND lease_end > NOW()
     GROUP BY unit_type
     ORDER BY unit_type`,
    [dealId],
  );

  const now = new Date();
  return (res.rows as any[]).map((r) => {
    const inPlaceRent    = parseFloat(r.in_place_rent)  || 0;
    const marketRent     = parseFloat(r.market_rent)    || inPlaceRent;
    const avgConcession  = parseFloat(r.avg_concession) || 0;
    const avgCurRent     = parseFloat(r.avg_cur_rent_for_conc) || 1;
    // concessionWeeks: concession_amount / monthly_rent * 4 weeks
    const concessionWeeks = avgCurRent > 0 ? Math.round((avgConcession / avgCurRent) * 4 * 10) / 10 : 0;

    // renewalProbability: 0.55 default when no renewal_status data
    const renewalProb = parseFloat(r.renewal_prob);
    const renewalProbability = isNaN(renewalProb) || renewalProb === 0 ? 0.55 : renewalProb;

    const rawMonths = parseFloat(r.avg_months_to_expiry);
    const expiryMonthOffset = isNaN(rawMonths) ? 6 : Math.max(0, Math.min(24, Math.round(rawMonths)));

    return {
      unitType:           String(r.unit_type || 'Unknown'),
      units:              parseInt(r.units, 10) || 0,
      expiryMonthOffset,
      inPlaceRent:        Math.round(inPlaceRent),
      marketRent:         Math.round(marketRent),
      renewalProbability,
      concessionWeeks,
    } as LeaseCohort;
  }).filter((c) => c.units > 0);
}

/**
 * Builds ExpenseLine[] from deal_monthly_actuals opex columns.
 * Taxonomy per M09 spec:
 *   controllable:    R&M, contract services, payroll, marketing, admin, turnover
 *   nonControllable: utilities, insurance, tax, management fee, HOA
 */
async function fetchExpenseLines(
  propertyId: string | null,
  dealId: string,
): Promise<ExpenseLine[]> {
  const whereActuals = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = FALSE AND is_proforma = FALSE`
    : `deal_id = $1 AND is_budget = FALSE AND is_proforma = FALSE`;
  const whereBudget = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = TRUE`
    : `deal_id = $1 AND is_budget = TRUE`;
  const param = propertyId ?? dealId;

  const opexCols = [
    'repairs_maintenance', 'contract_services', 'payroll', 'marketing',
    'admin_general', 'turnover_costs',
    'utilities', 'insurance', 'property_tax', 'management_fee', 'hoa_condo_fees',
  ] as const;

  const selects = opexCols.map((c) => `SUM(COALESCE(${c}, 0)) AS ${c}`).join(', ');

  const [actualsRes, budgetRes] = await Promise.all([
    query(
      `SELECT ${selects}, COUNT(*) AS months
       FROM (SELECT * FROM deal_monthly_actuals
             WHERE ${whereActuals} ORDER BY report_month DESC LIMIT 12) sub`,
      [param],
    ),
    query(
      `SELECT ${selects}, COUNT(*) AS months
       FROM (SELECT * FROM deal_monthly_actuals
             WHERE ${whereBudget} ORDER BY report_month DESC LIMIT 12) sub`,
      [param],
    ),
  ]);

  const act  = actualsRes.rows[0]  as Record<string, string> | undefined;
  const bud  = budgetRes.rows[0]   as Record<string, string> | undefined;
  if (!act) return [];

  const actMonths = parseInt((act as any).months, 10) || 1;
  const budMonths = parseInt((bud as any)?.months ?? '12', 10) || 12;
  const actFactor = 12 / actMonths;
  const budFactor = 12 / budMonths;

  type Category = 'controllable' | 'nonControllable';
  const taxonomy: Record<string, [string, Category]> = {
    repairs_maintenance: ['Repair & Maintenance',   'controllable'],
    contract_services:   ['Contract Services',       'controllable'],
    payroll:             ['Payroll',                 'controllable'],
    marketing:           ['Marketing',               'controllable'],
    admin_general:       ['Admin & General',         'controllable'],
    turnover_costs:      ['Turnover Costs',          'controllable'],
    utilities:           ['Utilities',               'nonControllable'],
    insurance:           ['Insurance',               'nonControllable'],
    property_tax:        ['Property Tax',            'nonControllable'],
    management_fee:      ['Management Fee',          'nonControllable'],
    hoa_condo_fees:      ['HOA / Condo Fees',        'nonControllable'],
  };

  const lines: ExpenseLine[] = [];
  for (const col of opexCols) {
    const actualRunRate = Math.round(parseFloat(act[col] ?? '0') * actFactor);
    const uwTarget      = Math.round(parseFloat(bud?.[col] ?? '0') * budFactor);
    // Skip lines where both are zero (column not used for this deal)
    if (actualRunRate === 0 && uwTarget === 0) continue;
    const [label, category] = taxonomy[col];
    lines.push({ label, category, uwTarget, actualRunRate });
  }
  return lines;
}


/** Fetches rank target from asset_rank_targets; falls back to a default. */
async function fetchRankTarget(
  propertyId: string,
  userId: string,
  overallRankDefault: number,
  byType: boolean,
): Promise<RankTarget> {
  const res = await query(
    `SELECT target_rank, target_config, updated_at
     FROM asset_rank_targets
     WHERE property_id = $1 AND user_id = $2
     LIMIT 1`,
    [propertyId, userId],
  );

  // Count comparison set from property_records (same query as rankings router)
  const countRes = await query(
    `SELECT COUNT(*) FROM property_records WHERE property_type = 'Multifamily' AND units > 50`,
  );
  const setSize = parseInt((countRes.rows[0] as any)?.count, 10) || 300;

  if (!res.rows.length) {
    return { overallRank: overallRankDefault, setSize, byType };
  }

  const row    = res.rows[0] as any;
  const config = (row.target_config ?? {}) as Record<string, any>;
  return {
    overallRank: parseInt(row.target_rank, 10) || overallRankDefault,
    setSize,
    byType:      config.byType ?? byType,
    perType:     config.perType ?? undefined,
  };
}

// ── Route: GET /api/v1/revenue/:dealId/beat-plan ────────────────────────────
/**
 * Assembles all six engine inputs from live data, runs proFormaBeatEngine(),
 * and returns the BeatPlan (NOI bridge + expense findings + per-cohort repricing).
 *
 * Query params:
 *   targetRank  {number}  — desired rank in the comp set (default: 1)
 *   byType      {boolean} — rank targets per unit type (default: false)
 *   noCache     {boolean} — bypass the 24-hour cache (default: false)
 *   horizon     {number}  — planning horizon in months (default: 12)
 */
router.get('/:dealId/beat-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId     = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const targetRank    = Math.max(1, parseInt(String(req.query.targetRank ?? '1'), 10) || 1);
  const byType        = String(req.query.byType) === 'true';
  const noCache       = String(req.query.noCache) === 'true';
  const horizonMonths = Math.max(1, Math.min(24, parseInt(String(req.query.horizon ?? '12'), 10) || 12));

  const cacheKey = `${dealId}:${targetRank}:${byType}:${horizonMonths}`;
  if (!noCache) {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }
  }

  try {
    // ── 1. Resolve deal metadata ─────────────────────────────────────────────
    const dealRes = await query(
      `SELECT d.property_id,
              COALESCE(p.city,       d.city)      AS city,
              COALESCE(p.state_code, 'GA')        AS state
       FROM deals d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL
       LIMIT 1`,
      [dealId, userId],
    );

    if (!dealRes.rows.length) {
      return res.status(404).json({ success: false, error: `Deal not found: ${dealId}` });
    }

    const propertyId: string | null = (dealRes.rows[0] as any).property_id ?? null;
    const city:  string = (dealRes.rows[0] as any).city  || 'Atlanta';
    const state: string = (dealRes.rows[0] as any).state || 'GA';

    const caveats: string[] = [];

    // ── 2–6. Assemble inputs in parallel where possible ───────────────────────
    const [actuals, proForma, cohorts, expenses] = await Promise.all([
      fetchActualsSnapshot(propertyId, dealId),
      fetchProFormaTargets(propertyId, dealId),
      fetchLeaseCohorts(dealId),
      fetchExpenseLines(propertyId, dealId),
    ]);

    if (!actuals) caveats.push('No TTM actuals found — NOI projected from pro-forma only. Accuracy degraded.');
    if (!proForma) caveats.push('No budget/pro-forma rows found — beat-plan comparison unavailable.');
    if (!cohorts.length) caveats.push('No active leases in rent roll — revenue lever defaulted to empty.');

    // Market signals (sequential — correlation engine needs actuals)
    const signalsCaveats: string[] = [];
    let signalsByUnitType: Record<string, MarketSignalSet> = {};

    try {
      const engine = new CorrelationEngineService(getPool());
      const report = await engine.computeCorrelationsWithPropertyData(city, state, {
        avgEffRent: actuals && actuals.units > 0
          ? (actuals.egi / actuals.units) / 12   // monthly eff rent per unit (egi is annual, units is total)
          : undefined,
      });

      const corrs = report.correlations;
      const cor04 = corrs.find((c) => c.id === 'COR-04');
      const cor06 = corrs.find((c) => c.id === 'COR-06');
      const cor15 = corrs.find((c) => c.id === 'COR-15');

      let rentRunwayBps = 0;
      if (cor04?.yValue != null) {
        const rentGrowthBpsAnnual = cor04.yValue * 400;
        rentRunwayBps = 400 - rentGrowthBpsAnnual;
      } else {
        rentRunwayBps = cor04?.signal === 'bullish' ? 150 : cor04?.signal === 'bearish' ? -150 : 0;
      }

      let pipelinePressurePct = 0.04;
      if (cor06?.signal === 'bullish')  pipelinePressurePct = 0.02;
      else if (cor06?.signal === 'neutral')  pipelinePressurePct = 0.06;
      else if (cor06?.signal === 'bearish')  pipelinePressurePct = 0.12;

      let compConcessionTrendWeeks = 0;
      if (cor15?.xValue != null) {
        compConcessionTrendWeeks = Math.round((cor15.xValue / 100) * 4 * 10) / 10;
      } else {
        compConcessionTrendWeeks = cor15?.signal === 'bearish' ? 1 : 0;
      }

      let trafficVelocityPct = 0;
      if (propertyId) {
        try {
          const tpRes = await query(
            `SELECT market_demand_score FROM traffic_predictions
             WHERE property_id = $1
             ORDER BY prediction_year DESC, prediction_week DESC LIMIT 3`,
            [propertyId],
          );
          if (tpRes.rows.length) {
            const avgScore = (tpRes.rows as any[]).reduce(
              (s, r) => s + parseFloat(r.market_demand_score || '50'), 0,
            ) / tpRes.rows.length;
            trafficVelocityPct = Math.round(((avgScore - 50) / 50) * 0.10 * 10000) / 10000;
          }
        } catch {
          // Non-fatal
        }
      }

      signalsCaveats.push(
        'inMigrationPct set to 0 — no in-migration data pipeline wired yet; signal receives zero weight.',
      );

      const sharedSignal: MarketSignalSet = {
        rentRunwayBps:           Math.round(rentRunwayBps),
        trafficVelocityPct,
        inMigrationPct:          0,
        pipelinePressurePct,
        compConcessionTrendWeeks,
      };

      // Apply the same city-level signal to all unit types in the rent roll
      for (const c of cohorts) {
        signalsByUnitType[c.unitType] = sharedSignal;
      }
    } catch (sigErr) {
      logger.warn('[revenue/beat-plan] Correlation engine failed:', String(sigErr));
      signalsCaveats.push(
        'Correlation engine unavailable — signalsByUnitType is empty. Revenue lever defaulted to HOLD.',
      );
    }

    caveats.push(...signalsCaveats);

    // Rank target
    const rankTarget: RankTarget = propertyId
      ? await fetchRankTarget(propertyId, userId, targetRank, byType)
      : { overallRank: targetRank, setSize: 300, byType };

    // ── 7. Fallback values so engine always has valid inputs ──────────────────
    const safeActuals: ActualsSnapshot = actuals ?? {
      gpr: 0, otherIncome: 0, vacancyLoss: 0, egi: 0, opex: 0, noi: 0, units: 0,
    };
    const safeProForma: ProFormaTargets = proForma ?? {
      gpr: 0, otherIncome: 0, vacancyLoss: 0, egi: 0, opex: 0, noi: 0,
    };

    // ── 8. Run engine ─────────────────────────────────────────────────────────
    const engineInputs: EngineInputs = {
      proForma:          safeProForma,
      actuals:           safeActuals,
      cohorts,
      signalsByUnitType,
      expenses,
      rankTarget,
      horizonMonths,
    };

    const beatPlan = proFormaBeatEngine(engineInputs);

    // Merge route-level caveats into the engine's own caveats
    beatPlan.caveats.unshift(...caveats);

    // ── 9. Cache and return ───────────────────────────────────────────────────
    setCache(cacheKey, beatPlan);

    return res.json({
      success:  true,
      cached:   false,
      dealId,
      propertyId,
      city,
      state,
      computedAt:    new Date().toISOString(),
      horizonMonths,
      ...beatPlan,
    });
  } catch (err) {
    logger.error('[revenue/beat-plan] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute beat plan' });
  }
});

// ── Route: GET /api/v1/revenue/:dealId/course (legacy) ──────────────────────
/**
 * GET /api/v1/revenue/:dealId/course
 *
 * Kept for backward compatibility. Returns the legacy BUY/HOLD/WATCH signal.
 * Use /beat-plan for the full NOI bridge + expense + cohort repricing.
 *
 * Response shape (RepricingCourse):
 *   signal:            'BUY' | 'HOLD' | 'WATCH'
 *   confidence:        'high' | 'medium' | 'low'
 *   captured_per_mo:   estimated monthly dollar capture
 *   net_lift_pct:      projected net effective-rent lift (0–1 fraction)
 *   recommended_rents: [{month, unit_type, recommended_rent}]  — 12-month ramp
 *   computed_at:       ISO timestamp
 *   basis:             debug snapshot of input signals used
 */
router.get('/:dealId/course', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const course = await synthesizeRepricingCourse(dealId, userId);
    res.json({ success: true, ...course });
  } catch (err) {
    if (err instanceof DealNotFoundError) {
      return res.status(404).json({ success: false, error: err.message });
    }
    logger.error('[revenue] repricing course error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute repricing course' });
  }
});

export default router;
