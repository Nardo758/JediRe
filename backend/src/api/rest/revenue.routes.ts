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

// ── 24-hour DealContext-scoped beat-plan cache ───────────────────────────────
// Per spec: "Honor a 24-hour DealContext cache keyed by dealId + targetRank + byType."
// Implemented as an in-process Map with a 24h TTL. The cache key includes
// userId so plans are scoped to the requesting user (no cross-user leakage).
// An ownership check is performed BEFORE any cache read.
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

// ── Unit type normalization ───────────────────────────────────────────────────
// Maps free-form unit type strings from rent rolls, comps, and JSONB keys
// to a canonical key so comp-set rents can be matched to cohort unit types.
// The canonical set follows the rent_roll_units convention (e.g. '1BR', '2BR').

const UNIT_TYPE_ALIASES: Array<[RegExp, string]> = [
  [/^(STU|STUDIO|0BR|0B|STUDIO\/LOFT)/i,                   'STU'],
  [/^(1\s*[-/]?\s*BR|1\s*BED|1B|ONE\s*BED|ONEBR|1BR)/i,   '1BR'],
  [/^(2\s*[-/]?\s*BR|2\s*BED|2B|TWO\s*BED|TWOBR|2BR)/i,   '2BR'],
  [/^(3\s*[-/]?\s*BR|3\s*BED|3B|THREE\s*BED|THREEBR|3BR)/i,'3BR'],
  [/^(4\s*[-/]?\s*BR|4\s*BED|4B|FOUR\s*BED|FOURBR|4BR)/i, '4BR'],
];

// Camel-case JSONB keys from market_rent_comps.rents_by_type
const JSONB_KEY_MAP: Record<string, string> = {
  studio:   'STU',
  oneBed:   '1BR',
  twoBed:   '2BR',
  threeBed: '3BR',
  fourBed:  '4BR',
};

export function normalizeUnitType(raw: string): string {
  const s = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  for (const [re, canonical] of UNIT_TYPE_ALIASES) {
    if (re.test(s.replace(/\s/g, ''))) return canonical;
  }
  return raw; // preserve as-is when no alias matches
}

// Result of comp-set market rent lookup: per canonical unit type + overall avg
export interface CompSetRents {
  byType:     Record<string, number>;  // canonical unit type → median asking rent
  overallAvg: number | null;           // property-level avg when no per-type data
  source:     string;                  // human-readable provenance label
}

/**
 * Fetches per-unit-type market rents from the comp set linked to a deal.
 *
 * Source precedence (higher = preferred):
 *   A. market_rent_comps.rents_by_type JSONB (weighted avg across comp properties)
 *   B. comp_unit_types joined to comp_properties (scraped per-type rents)
 *   C. deal_rent_comp_sets.avg_rent (property-level avg, no type breakdown)
 *   D. historical_observations.submarket_avg_asking_rent (submarket-level)
 *
 * Returns null when no comp data is available for the deal.
 */
export async function fetchCompSetRents(
  dealId: string,
  submarketId: string | null,
): Promise<CompSetRents | null> {

  // ── A. market_rent_comps.rents_by_type JSONB ─────────────────────────────
  // Each row may have a rents_by_type object like:
  //   { "oneBed": { "rent": 1997, "units": 158 }, "studio": { "rent": 1627, "units": 67 }, ... }
  // We aggregate across all comp properties using a weighted average (by units).
  const mrcRes = await query(
    `SELECT rents_by_type, avg_asking_rent
     FROM market_rent_comps
     WHERE deal_id = $1 AND (rents_by_type IS NOT NULL OR avg_asking_rent IS NOT NULL)`,
    [dealId],
  );

  if (mrcRes.rows.length > 0) {
    const accumulator: Record<string, { sumRent: number; sumUnits: number }> = {};
    let propertyLevelSum  = 0;
    let propertyLevelCnt  = 0;

    for (const row of mrcRes.rows as any[]) {
      const byType = row.rents_by_type as Record<string, { rent: number; units?: number }> | null;
      const avgAsk = parseFloat(row.avg_asking_rent);

      if (byType && typeof byType === 'object') {
        for (const [rawKey, val] of Object.entries(byType)) {
          const canonical = JSONB_KEY_MAP[rawKey] ?? normalizeUnitType(rawKey);
          const rent  = typeof val === 'object' ? Number(val.rent) : Number(val);
          const units = (typeof val === 'object' && val.units) ? Number(val.units) : 1;
          if (!isNaN(rent) && rent > 0) {
            if (!accumulator[canonical]) accumulator[canonical] = { sumRent: 0, sumUnits: 0 };
            accumulator[canonical].sumRent  += rent * units;
            accumulator[canonical].sumUnits += units;
          }
        }
      }

      if (!isNaN(avgAsk) && avgAsk > 0) {
        propertyLevelSum += avgAsk;
        propertyLevelCnt++;
      }
    }

    const byType: Record<string, number> = {};
    for (const [canonical, acc] of Object.entries(accumulator)) {
      if (acc.sumUnits > 0) byType[canonical] = Math.round(acc.sumRent / acc.sumUnits);
    }

    const overallAvg = propertyLevelCnt > 0
      ? Math.round(propertyLevelSum / propertyLevelCnt)
      : null;

    if (Object.keys(byType).length > 0 || overallAvg !== null) {
      return { byType, overallAvg, source: 'market_rent_comps (comp-set JSONB)' };
    }
  }

  // ── B. comp_unit_types joined to comp_properties ──────────────────────────
  const cutRes = await query(
    `SELECT cu.unit_type, AVG(cu.avg_rent::float) AS avg_rent, COUNT(*) AS cnt
     FROM comp_unit_types cu
     JOIN comp_properties cp ON cp.id = cu.comp_id
     WHERE cp.deal_id = $1 AND cu.avg_rent IS NOT NULL AND cu.avg_rent > 0
     GROUP BY cu.unit_type`,
    [dealId],
  );

  if (cutRes.rows.length > 0) {
    const byType: Record<string, number> = {};
    for (const row of cutRes.rows as any[]) {
      const canonical = normalizeUnitType(String(row.unit_type));
      const rent = parseFloat(row.avg_rent);
      if (!isNaN(rent) && rent > 0) byType[canonical] = Math.round(rent);
    }
    if (Object.keys(byType).length > 0) {
      return { byType, overallAvg: null, source: 'comp_unit_types (scraped comps)' };
    }
  }

  // ── C. deal_rent_comp_sets.avg_rent (property-level, no type breakdown) ───
  const drcsRes = await query(
    `SELECT AVG(avg_rent::float) AS overall_avg
     FROM deal_rent_comp_sets
     WHERE deal_id = $1 AND status = 'active' AND avg_rent IS NOT NULL AND avg_rent > 0`,
    [dealId],
  );

  const drcsAvg = parseFloat((drcsRes.rows[0] as any)?.overall_avg);
  if (!isNaN(drcsAvg) && drcsAvg > 0) {
    return { byType: {}, overallAvg: Math.round(drcsAvg), source: 'deal_rent_comp_sets (property avg)' };
  }

  // ── D. historical_observations.submarket_avg_asking_rent ─────────────────
  if (submarketId) {
    const hoRes = await query(
      `SELECT AVG(submarket_avg_asking_rent::float) AS avg_asking
       FROM historical_observations
       WHERE submarket_id = $1
         AND submarket_avg_asking_rent IS NOT NULL
         AND observation_date >= CURRENT_DATE - INTERVAL '24 months'`,
      [submarketId],
    );
    const hoAvg = parseFloat((hoRes.rows[0] as any)?.avg_asking);
    if (!isNaN(hoAvg) && hoAvg > 0) {
      return { byType: {}, overallAvg: Math.round(hoAvg), source: 'historical_observations (submarket avg asking)' };
    }
  }

  return null;
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

// ── GL-taxonomy map for deal_monthly_actuals_lines ───────────────────────────
// Maps account_label → [display label, M09 category, budget column in deal_monthly_actuals]
type Category = 'controllable' | 'nonControllable';
const GL_TAXONOMY: Record<string, [string, Category, string | null]> = {
  'Maintenance & Repairs':  ['Repair & Maintenance',    'controllable',    'repairs_maintenance'],
  'Admin/Office':           ['Admin & General',          'controllable',    'admin_general'],
  'Landscaping':            ['Landscaping / Contracts',  'controllable',    'contract_services'],
  'Payroll':                ['Payroll',                  'controllable',    'payroll'],
  'Marketing':              ['Marketing',                'controllable',    'marketing'],
  'Make-ready/turnover':    ['Turnover Costs',           'controllable',    'turnover_costs'],
  'Utilities':              ['Utilities',                'nonControllable', 'utilities'],
  'Insurance':              ['Insurance',                'nonControllable', 'insurance'],
  'Property Taxes':         ['Property Taxes',           'nonControllable', 'property_tax'],
  'Management Fees':        ['Management Fee',           'nonControllable', 'management_fee'],
  'Alarm & Cable':          ['Alarm & Cable',            'nonControllable', null],
  'Retail Expense':         ['Retail Expense',           'nonControllable', null],
};

/**
 * Builds ExpenseLine[] by reading GL rows from deal_monthly_actuals_lines (TTM).
 * Finds the property_code via period_month overlap with deal_monthly_actuals,
 * then joins to the GL table and maps each account to the M09 taxonomy.
 * UW targets come from deal_monthly_actuals budget rows (columnar).
 * Falls back to columnar actuals if no GL lines exist.
 */
export async function fetchExpenseLines(
  propertyId: string | null,
  dealId: string,
): Promise<{ lines: ExpenseLine[]; glSource: boolean }> {
  const param = propertyId ?? dealId;

  // Explicit WHERE clauses — no string substitution on param placeholders
  const pcWhere = propertyId
    ? `dma.property_id = $1 AND dma.is_portfolio_asset = TRUE AND dma.is_budget = FALSE AND dma.is_proforma = FALSE`
    : `dma.deal_id = $1 AND dma.is_budget = FALSE AND dma.is_proforma = FALSE`;
  const glActualsWhere = propertyId
    ? `property_id = $2 AND is_portfolio_asset = TRUE AND is_budget = FALSE AND is_proforma = FALSE`
    : `deal_id = $2 AND is_budget = FALSE AND is_proforma = FALSE`;
  const whereBudget = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = TRUE`
    : `deal_id = $1 AND is_budget = TRUE`;
  const whereActualsColumnar = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = FALSE AND is_proforma = FALSE`
    : `deal_id = $1 AND is_budget = FALSE AND is_proforma = FALSE`;

  // ── 1. Discover property_code via period_month overlap ─────────────────────
  // Use a safe IN-subquery (no join) so we never accidentally resolve the wrong
  // property's code when multiple properties share the same calendar months.
  // If the subquery returns more than one distinct property_code the result is
  // ambiguous; we return null and fall through to the columnar path.
  const pcSubWhere = propertyId
    ? `property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = FALSE AND is_proforma = FALSE`
    : `deal_id = $1 AND is_budget = FALSE AND is_proforma = FALSE`;
  const pcRes = await query(
    `SELECT DISTINCT l.property_code
     FROM deal_monthly_actuals_lines l
     WHERE l.period_month IN (
       SELECT report_month FROM deal_monthly_actuals
       WHERE ${pcSubWhere}
       ORDER BY report_month DESC LIMIT 12
     )`,
    [param],
  );
  // Use GL path only when exactly one property_code maps to these months.
  const propertyCode: string | null =
    pcRes.rows.length === 1 ? (pcRes.rows[0] as any).property_code : null;

  // ── 2. Fetch budget totals per taxonomy column (always columnar) ──────────
  const opexCols = [
    'repairs_maintenance', 'contract_services', 'payroll', 'marketing',
    'admin_general', 'turnover_costs',
    'utilities', 'insurance', 'property_tax', 'management_fee', 'hoa_condo_fees',
  ] as const;

  const budSelects = opexCols.map((c) => `SUM(COALESCE(${c}, 0)) AS ${c}`).join(', ');
  const budRes = await query(
    `SELECT ${budSelects}, COUNT(*) AS months
     FROM (SELECT * FROM deal_monthly_actuals
           WHERE ${whereBudget} ORDER BY report_month DESC LIMIT 12) sub`,
    [param],
  );
  const bud      = budRes.rows[0] as Record<string, string> | undefined;
  const budMonths = parseInt((bud as any)?.months ?? '12', 10) || 12;
  const budFactor = 12 / budMonths;

  // Helper: annualised budget for a given column
  const budAnnual = (col: string | null): number => {
    if (!col || !bud) return 0;
    return Math.round(parseFloat(bud[col] ?? '0') * budFactor);
  };

  // ── 3a. GL-level path ──────────────────────────────────────────────────────
  if (propertyCode) {
    // $1 = propertyCode, $2 = param (propertyId or dealId), $3 = label list
    const glRes = await query(
      `SELECT l.account_label, SUM(l.amount) AS amount, COUNT(*) AS months
       FROM deal_monthly_actuals_lines l
       WHERE l.property_code = $1
         AND l.period_month IN (
           SELECT report_month FROM deal_monthly_actuals
           WHERE ${glActualsWhere}
           ORDER BY report_month DESC LIMIT 12
         )
         AND l.account_label = ANY($3)
       GROUP BY l.account_label`,
      [propertyCode, param, Object.keys(GL_TAXONOMY)],
    );

    const glRows = glRes.rows as Array<{ account_label: string; amount: string; months: string }>;

    // Build a lookup: account_label → annualised actual
    const glByLabel: Record<string, number> = {};
    for (const row of glRows) {
      const months = parseInt(row.months, 10) || 1;
      const annualised = Math.round(parseFloat(row.amount) * (12 / months));
      glByLabel[row.account_label] = annualised;
    }

    // Build ExpenseLine[] from taxonomy, pairing GL actual + columnar budget
    const lines: ExpenseLine[] = [];
    for (const [glLabel, [displayLabel, category, budgetCol]] of Object.entries(GL_TAXONOMY)) {
      const actualRunRate = glByLabel[glLabel] ?? 0;
      const uwTarget      = budAnnual(budgetCol);
      if (actualRunRate === 0 && uwTarget === 0) continue;
      lines.push({ label: displayLabel, category, uwTarget, actualRunRate });
    }
    // If GL labels matched the taxonomy → return. If not (0 mapped lines despite
    // having a property_code), fall through to the columnar path so the expense
    // lever is never silently zeroed out.
    if (lines.length > 0) {
      return { lines, glSource: true };
    }
  }

  // ── 3b. Columnar fallback ──────────────────────────────────────────────────
  const actSelects = opexCols.map((c) => `SUM(COALESCE(${c}, 0)) AS ${c}`).join(', ');
  const actRes = await query(
    `SELECT ${actSelects}, COUNT(*) AS months
     FROM (SELECT * FROM deal_monthly_actuals
           WHERE ${whereActualsColumnar} ORDER BY report_month DESC LIMIT 12) sub`,
    [param],
  );
  const act      = actRes.rows[0] as Record<string, string> | undefined;
  if (!act) return { lines: [], glSource: false };

  const actMonths = parseInt((act as any).months, 10) || 1;
  const actFactor = 12 / actMonths;

  const columnarTaxonomy: Record<string, [string, Category]> = {
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
    const uwTarget      = budAnnual(col);
    if (actualRunRate === 0 && uwTarget === 0) continue;
    const [label, category] = columnarTaxonomy[col];
    lines.push({ label, category, uwTarget, actualRunRate });
  }
  return { lines, glSource: false };
}


/**
 * Builds LeaseCohort[] using the following precedence:
 *   1. rent_roll_snapshots.derived_metrics (expiration_waterfall + unit_type_breakdown)
 *      → provides renewalProbability and concessionWeeks per unit type
 *   2. rent_roll_units → provides in-place rents, unit counts, market rents
 *
 * marketRent five-tier precedence:
 *   1. rent_roll_units.market_rent  (per-unit-type, most accurate)
 *   2. compSetRents.byType[canonical] (per-unit-type from comp set JSONB / scraped comps)
 *   3. compSetRents.overallAvg (property-level average from comp set, no type breakdown)
 *   4. msas.avg_rent for city/state (correlation engine city-level proxy)
 *   5. inPlaceRent (last resort — caveat added)
 *
 * If no snapshot is found, falls back to rent_roll_units only (returns caveat).
 */
export async function fetchLeaseCohorts(
  dealId: string,
  city: string,
  state: string,
  compSetRents?: CompSetRents | null,
): Promise<{ cohorts: LeaseCohort[]; caveat: string | null }> {

  // ── 1. Load the latest derived snapshot metrics ────────────────────────────
  const snapRes = await query(
    `SELECT derived_metrics
     FROM rent_roll_snapshots
     WHERE deal_id = $1 AND status = 'derived' AND derived_metrics IS NOT NULL
     ORDER BY snapshot_date DESC LIMIT 1`,
    [dealId],
  );

  // per-type metrics from snapshot: renewalRate + concessionIntensity
  type PerTypeCache = { renewalRate: number; concessionWeeks: number };
  const perType: Record<string, PerTypeCache> = {};

  if (snapRes.rows.length) {
    const derived = (snapRes.rows[0] as any).derived_metrics as {
      unit_type_breakdown?: Array<{
        unit_type: string;
        renewal_rate: number;
        concession_intensity: number;   // avg free weeks
      }>;
      expiration_waterfall?: Array<{
        months_out: number;
        expiring_units: number;
        expiring_pct: number;
      }>;
    };

    for (const ut of derived.unit_type_breakdown ?? []) {
      perType[ut.unit_type] = {
        renewalRate:      ut.renewal_rate,
        concessionWeeks:  ut.concession_intensity,
      };
    }
  }

  const snapshotAvailable = snapRes.rows.length > 0;

  // ── 2. Load unit counts, rents, and expiry from rent_roll_units ────────────
  const unitRes = await query(
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

  if (!unitRes.rows.length) {
    return {
      cohorts: [],
      caveat: snapshotAvailable
        ? 'No active leases in rent roll — revenue lever defaulted to empty.'
        : 'No active leases and no derivation snapshot — revenue lever defaulted to empty.',
    };
  }

  // ── 3. Correlation engine market rent (tier-2): MSA city-level avg_rent ────
  // The correlation engine derives market rent from the msas table.  When
  // rent_roll_units.market_rent is missing we use this city-level proxy
  // (with a caveat) rather than silently defaulting to inPlaceRent.
  const msaRes = await query(
    `SELECT avg_rent FROM msas WHERE name ILIKE $1 AND state_code ILIKE $2 LIMIT 1`,
    [`%${city}%`, state],
  );
  const correlationAvgRent: number | null =
    msaRes.rows.length
      ? parseFloat(String((msaRes.rows[0] as any).avg_rent)) || null
      : null;

  let compSetPerTypeFallbackCount  = 0;
  let compSetOverallFallbackCount  = 0;
  let msaFallbackCount             = 0;
  let inPlaceFallbackCount         = 0;

  const cohorts: LeaseCohort[] = (unitRes.rows as any[]).map((r) => {
    const unitType       = String(r.unit_type || 'Unknown');
    const inPlaceRent    = parseFloat(r.in_place_rent)  || 0;
    const rawMarketRent  = parseFloat(r.market_rent);

    // Five-tier marketRent precedence:
    // 1. rent_roll_units.market_rent (per-unit-type, most accurate)
    // 2. compSetRents.byType[canonical] (per-unit-type from comp set)
    // 3. compSetRents.overallAvg (property-level comp avg, no type breakdown)
    // 4. MSA avg_rent from correlation engine (city-level proxy)
    // 5. inPlaceRent (last resort — caller receives explicit caveat)
    let marketRent: number;
    if (!isNaN(rawMarketRent) && rawMarketRent > 0) {
      marketRent = rawMarketRent;
    } else if (compSetRents) {
      // Try per-unit-type comp rent first (normalize the unit type for lookup)
      const canonical = normalizeUnitType(unitType);
      const perTypeComp = compSetRents.byType[canonical]
        ?? compSetRents.byType[unitType];  // also try raw in case it already matches
      if (perTypeComp && perTypeComp > 0) {
        marketRent = perTypeComp;
        compSetPerTypeFallbackCount++;
      } else if (compSetRents.overallAvg !== null && compSetRents.overallAvg > 0) {
        marketRent = compSetRents.overallAvg;
        compSetOverallFallbackCount++;
      } else if (correlationAvgRent !== null) {
        marketRent = correlationAvgRent;
        msaFallbackCount++;
      } else {
        marketRent = inPlaceRent;
        inPlaceFallbackCount++;
      }
    } else if (correlationAvgRent !== null) {
      marketRent = correlationAvgRent;
      msaFallbackCount++;
    } else {
      marketRent = inPlaceRent;
      inPlaceFallbackCount++;
    }

    const avgConcession  = parseFloat(r.avg_concession) || 0;
    const avgCurRent     = parseFloat(r.avg_cur_rent_for_conc) || 1;

    // Use snapshot-derived renewalRate and concessionWeeks when available;
    // fall back to rent_roll_units fields.
    const snap = perType[unitType];
    const renewalProbability: number = snap
      ? snap.renewalRate
      : (() => {
          const rp = parseFloat(r.renewal_prob);
          return isNaN(rp) || rp === 0 ? 0.55 : rp;
        })();
    const concessionWeeks: number = snap
      ? snap.concessionWeeks
      : avgCurRent > 0 ? Math.round((avgConcession / avgCurRent) * 4 * 10) / 10 : 0;

    const rawMonths = parseFloat(r.avg_months_to_expiry);
    const expiryMonthOffset = isNaN(rawMonths) ? 6 : Math.max(0, Math.min(24, Math.round(rawMonths)));

    return {
      unitType,
      units:              parseInt(r.units, 10) || 0,
      expiryMonthOffset,
      inPlaceRent:        Math.round(inPlaceRent),
      marketRent:         Math.round(marketRent),
      renewalProbability,
      concessionWeeks,
    } as LeaseCohort;
  }).filter((c) => c.units > 0);

  const caveats: Array<string | null> = [];
  if (!snapshotAvailable) {
    caveats.push(
      'No rent-roll derivation snapshot found — renewal rates and concession weeks sourced from rent_roll_units only (less accurate than snapshot derivations).',
    );
  }
  if (compSetPerTypeFallbackCount > 0 && compSetRents) {
    caveats.push(
      `${compSetPerTypeFallbackCount} unit type(s) used per-type comp-set market rent (${compSetRents.source}) — no market_rent in rent roll.`,
    );
  }
  if (compSetOverallFallbackCount > 0 && compSetRents) {
    caveats.push(
      `${compSetOverallFallbackCount} unit type(s) used comp-set overall average rent (${compSetRents.source}) — no per-type comp rents available.`,
    );
  }
  if (msaFallbackCount > 0) {
    caveats.push(
      `${msaFallbackCount} unit type(s) used MSA city-level avg_rent as market_rent proxy (no comp-set or rent-roll market_rent). Repricing lever may differ from actual submarket rates.`,
    );
  }
  if (inPlaceFallbackCount > 0) {
    caveats.push(
      `${inPlaceFallbackCount} unit type(s) had no market_rent, no comp-set data, and no MSA avg_rent — marketRent defaulted to inPlaceRent. Revenue lever may understate repricing opportunity.`,
    );
  }

  return { cohorts, caveat: caveats.filter(Boolean).join(' | ') || null };
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

  try {
    // ── 1. Resolve deal metadata + verify ownership ───────────────────────────
    // IMPORTANT: ownership check happens BEFORE cache lookup so that one user
    // cannot read another user's cached plan by guessing a dealId.
    const dealRes = await query(
      `SELECT d.property_id,
              COALESCE(p.city,       d.city)         AS city,
              COALESCE(p.state_code, 'GA')           AS state,
              p.submarket_id
       FROM deals d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL
       LIMIT 1`,
      [dealId, userId],
    );

    if (!dealRes.rows.length) {
      return res.status(404).json({ success: false, error: `Deal not found: ${dealId}` });
    }

    const propertyId:   string | null = (dealRes.rows[0] as any).property_id ?? null;
    const city:         string         = (dealRes.rows[0] as any).city        || 'Atlanta';
    const state:        string         = (dealRes.rows[0] as any).state       || 'GA';
    const submarketId:  string | null  = (dealRes.rows[0] as any).submarket_id ?? null;

    // ── 2. Cache lookup — keyed by userId so plans are user-scoped ────────────
    const cacheKey = `${userId}:${dealId}:${targetRank}:${byType}:${horizonMonths}`;
    if (!noCache) {
      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, cached: true, dealId, propertyId, city, state, ...cached });
      }
    }

    const caveats: string[] = [];

    // ── 3–7. Assemble inputs in two parallel phases ───────────────────────────
    // Phase A: everything that does not depend on comp-set rents fires together.
    // Phase B: fetchLeaseCohorts uses comp-set rents resolved in phase A so that
    //          CohortRecommendation.marketRent reflects real comp data, not only
    //          the MSA city-level fallback.
    const [actuals, proForma, expenseResult, compSetRents] = await Promise.all([
      fetchActualsSnapshot(propertyId, dealId),
      fetchProFormaTargets(propertyId, dealId),
      fetchExpenseLines(propertyId, dealId),
      fetchCompSetRents(dealId, submarketId),
    ]);

    // Phase B: build lease cohorts with comp-set rents already available.
    const cohortResult = await fetchLeaseCohorts(dealId, city, state, compSetRents ?? undefined);

    if (!actuals)    caveats.push('No TTM actuals found — NOI projected from pro-forma only. Accuracy degraded.');
    if (!proForma)   caveats.push('No budget/pro-forma rows found — beat-plan comparison unavailable.');

    const cohorts = cohortResult.cohorts;
    if (cohortResult.caveat) caveats.push(cohortResult.caveat);
    if (!cohorts.length && !cohortResult.caveat) {
      caveats.push('No active leases in rent roll — revenue lever defaulted to empty.');
    }

    const expenses = expenseResult.lines;
    if (!expenseResult.glSource && expenses.length > 0) {
      caveats.push('GL account lines unavailable — expense breakdown sourced from columnar opex fields (less granular).');
    }

    // ── 7. Market signals ─────────────────────────────────────────────────────
    // When submarket_id is NULL, the correlation engine has no market context;
    // return empty signalsByUnitType so the engine applies its HOLD default.
    let signalsByUnitType: Record<string, MarketSignalSet> = {};

    if (!submarketId) {
      caveats.push(
        'No submarket ID configured for this property — signalsByUnitType is empty. Revenue lever defaulted to HOLD.',
      );
    } else {
      try {
        const engine = new CorrelationEngineService(getPool());
        const report = propertyId
          ? await engine.computeForProperty(propertyId, city, state)
          : await engine.computeCorrelations(city, state);

        const corrs = report.correlations;
        const cor04 = corrs.find((c) => c.id === 'COR-04');
        const cor06 = corrs.find((c) => c.id === 'COR-06');
        const cor15 = corrs.find((c) => c.id === 'COR-15');

        // COR-04: rent runway → rentRunwayBps
        let rentRunwayBps = 0;
        if (cor04?.yValue != null) {
          rentRunwayBps = Math.round(400 - cor04.yValue * 400);
        } else {
          rentRunwayBps = cor04?.signal === 'bullish' ? 150 : cor04?.signal === 'bearish' ? -150 : 0;
        }

        // COR-06: pipeline pressure → pipelinePressurePct
        let pipelinePressurePct = 0.04;
        if      (cor06?.signal === 'bullish')  pipelinePressurePct = 0.02;
        else if (cor06?.signal === 'neutral')  pipelinePressurePct = 0.06;
        else if (cor06?.signal === 'bearish')  pipelinePressurePct = 0.12;

        // COR-15: comp concession trend → concessionWeeks
        let compConcessionTrendWeeks = 0;
        if (cor15?.xValue != null) {
          compConcessionTrendWeeks = Math.round((cor15.xValue / 100) * 4 * 10) / 10;
        } else {
          compConcessionTrendWeeks = cor15?.signal === 'bearish' ? 1 : 0;
        }

        // Traffic velocity from the most recent traffic_predictions rows
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
            // Non-fatal — trafficVelocityPct stays 0
          }
        }

        caveats.push(
          'inMigrationPct set to 0 — no in-migration data pipeline wired yet; signal receives zero weight.',
        );

        const sharedSignal: MarketSignalSet = {
          rentRunwayBps,
          trafficVelocityPct,
          inMigrationPct:          0,
          pipelinePressurePct,
          compConcessionTrendWeeks,
        };

        for (const c of cohorts) {
          signalsByUnitType[c.unitType] = sharedSignal;
        }
      } catch (sigErr) {
        logger.warn('[revenue/beat-plan] Correlation engine failed:', String(sigErr));
        caveats.push(
          'Correlation engine unavailable — signalsByUnitType is empty. Revenue lever defaulted to HOLD.',
        );
      }
    }

    // ── 8. Rank target ────────────────────────────────────────────────────────
    const rankTarget: RankTarget = propertyId
      ? await fetchRankTarget(propertyId, userId, targetRank, byType)
      : { overallRank: targetRank, setSize: 300, byType };

    // ── 9. Fallback values so engine always has valid inputs ──────────────────
    const safeActuals: ActualsSnapshot = actuals ?? {
      gpr: 0, otherIncome: 0, vacancyLoss: 0, egi: 0, opex: 0, noi: 0, units: 0,
    };
    const safeProForma: ProFormaTargets = proForma ?? {
      gpr: 0, otherIncome: 0, vacancyLoss: 0, egi: 0, opex: 0, noi: 0,
    };

    // ── 10. Run engine ────────────────────────────────────────────────────────
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

    // ── 11. Cache (user-scoped key) and return ────────────────────────────────
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
      compSetSource: compSetRents?.source ?? null,
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
