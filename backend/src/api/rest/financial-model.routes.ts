import { Router, Request, Response } from 'express';
import { financialModelEngine } from '../../services/financial-model-engine.service';
import { excelExportService } from '../../services/excel-export.service';
import { getPool } from '../../database/connection';
import { dealVersionsService, type SaveTrigger, type DealVersionRow } from '../../services/proforma/deal-versions.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireDealAccess } from '../../middleware/deal-access';
import type { ProFormaAssumptions } from '../../services/financial-model-engine.service';
import { parseSummaryMetrics, computeAnnualDebtService } from './financial-model.snapshot-parser';
import { getFieldSeries } from '../../services/proforma/periodic-seeder.service';
import type { ProFormaPeriodicSeed } from '../../services/proforma/periodic-field.types';

// ──────────────────────────────────────────────────────────────────────────
// Agent Version Helpers
//
// Reads deal_underwriting_snapshots + agent_runs and returns synthetic
// DealVersionRow objects so the frontend version picker can surface
// CashFlow Agent runs alongside user-saved versions.
// ──────────────────────────────────────────────────────────────────────────

function extractVal(entry: unknown): number | undefined {
  if (entry == null) return undefined;
  if (typeof entry === 'number') return entry;
  if (typeof entry === 'object' && 'value' in (entry as object)) {
    const v = (entry as Record<string, unknown>).value;
    if (typeof v === 'number') return v;
  }
  return undefined;
}

// Maps proforma_json (both old flat-number format and new evidence-object format)
// plus optional agent_runs.output structured data into the ModelAssumptions +
// ModelResults shape expected by CompareTab. Unmapped proforma_json keys are
// preserved under assumptions._agentFields so no data is silently dropped.
function mapProformaJsonToSnapshot(
  pj: Record<string, unknown>,
  agentOutput?: Record<string, unknown> | null,
): { assumptions: Record<string, unknown>; results: Record<string, unknown> } {
  const v = (key: string) => extractVal(pj[key]);

  // ── Assumptions: acquisition ────────────────────────────────────────────
  const purchasePrice = v('purchase_price');
  const capRate = v('year1_cap_rate');

  // ── Assumptions: disposition ────────────────────────────────────────────
  const exitCapRate = v('exit.cap_rate') ?? v('exit_cap_rate_pct');

  // ── Assumptions: hold ───────────────────────────────────────────────────
  const holdPeriod = v('hold_period_years');

  // ── Assumptions: revenue ────────────────────────────────────────────────
  const vacancyRaw = v('assumptions.growth.vacancy_stabilized') ?? v('vacancy_rate_pct');
  const stabilizedOccupancy = vacancyRaw != null ? 1 - vacancyRaw : undefined;
  const collectionLoss = v('revenue.bad_debt');
  const grossPotentialRent = v('revenue.gross_potential_rent');
  const effectiveGrossIncome = v('revenue.effective_gross_income');
  const vacancyLoss = v('revenue.vacancy_loss');
  const otherIncome = v('revenue.other_income');

  // ── Assumptions: financing ──────────────────────────────────────────────
  const loanAmount = v('debt.first_lien_amount') ?? v('loan_amount');
  const interestRate = v('debt.first_lien_rate') ?? v('interest_rate_pct');
  const amortizationYears = v('amortization_years');

  // ── Assumptions: growth ─────────────────────────────────────────────────
  const opexGrowthPct = v('assumptions.growth.expense_y1') ?? v('annual_expense_growth_pct');
  const rentGrowthPct = v('assumptions.growth.rent_y1') ?? v('annual_rent_growth_pct');

  // ── Assumptions: expenses ───────────────────────────────────────────────
  const expenses: Record<string, number | undefined> = {
    payroll: v('expense.payroll'),
    turnover: v('expense.turnover'),
    insurance: v('expense.insurance'),
    marketing: v('expense.marketing'),
    utilities: v('expense.utilities'),
    propertyTax: v('expense.property_tax') ?? v('taxes_per_unit'),
    managementFee: v('expense.management_fee') ?? (() => {
      const pct = v('management_fee_pct');
      return pct != null && effectiveGrossIncome != null ? pct * effectiveGrossIncome : undefined;
    })(),
    contractServices: v('expense.contract_services'),
    repairsMaintenance: v('expense.repairs_maintenance'),
    replacementReserves: v('expense.replacement_reserves'),
  };

  // ── Results: summary ────────────────────────────────────────────────────
  // Resolution order: output.summary nested object → output top-level fields
  // → proforma_json flat keys (old format). The type guard ensures we only
  // treat output.summary as structured data when it actually is an object
  // (current runs produce a text narrative; future runs may produce structured).
  const outFields = (agentOutput ?? {}) as Record<string, unknown>;
  const summaryObj: Record<string, unknown> =
    outFields.summary != null &&
    typeof outFields.summary === 'object' &&
    !Array.isArray(outFields.summary)
      ? (outFields.summary as Record<string, unknown>)
      : {};
  const pickNum = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const fromSummary = extractVal(summaryObj[key]);
      if (fromSummary != null) return fromSummary;
      const fromOutput = extractVal(outFields[key]);
      if (fromOutput != null) return fromOutput;
    }
    return undefined;
  };
  const irrFromOutput = pickNum('irr', 'five_yr_irr');
  const noiFromOutput = pickNum('noi', 'noi_year1');
  const dscrFromOutput = pickNum('dscr', 'dscr_year1', 'year1_dscr');
  const cocFromOutput = pickNum('cash_on_cash', 'cashOnCash', 'avg_cash_on_cash');
  const emFromOutput = pickNum('equity_multiple', 'equityMultiple');
  const lpIrrFromOutput = pickNum('lp_irr', 'lpIrr');
  const gpIrrFromOutput = pickNum('gp_irr', 'gpIrr');

  // ── Parsed fallbacks from narrative summary (new-format agent runs) ─────────
  //
  // New-format proforma_json carries evidence fields (e.g. exit.cap_rate: {value,...})
  // but NOT pre-computed result metrics. The CashFlow Agent reliably writes these into
  // the text narrative when the deal has a computable return:
  //   • "5-yr IRR 18.1%" / "Projected 5-yr IRR 18.1%" / "5-yr IRR estimated at -7.5%"
  //   • "$1.5M NOI" / "~$2.0M NOI" / "NOI projected ~$2.0M"
  // When a deal does not pencil the agent omits IRR/NOI, so undefined → "—" in the
  // Compare tab is correct behaviour (not a data gap).
  //
  // Annual Debt Service is computed from loan parameters (exact amortization formula)
  // and is used only for DSCR when a reliable parsed NOI is available.

  const summaryText: string =
    typeof outFields.summary === 'string' ? outFields.summary : '';

  const parsedSummaryMetrics = parseSummaryMetrics(summaryText);

  // Annual Debt Service from standard amortizing mortgage formula (monthly payment × 12).
  // Defensive: interestRate > 1 is treated as percent (e.g. 6.05 → 0.0605) by the utility.
  const computedAds = computeAnnualDebtService(loanAmount, interestRate, amortizationYears);

  // DSCR: only compute when we have a reliable NOI (parsed from narrative) + ADS
  const computedDscr: number | undefined =
    parsedSummaryMetrics.noi != null && computedAds != null && computedAds > 0
      ? parsedSummaryMetrics.noi / computedAds
      : undefined;

  // Cash-on-cash: (NOI − ADS) / equity  when equity is derivable from parsed purchase price.
  // equity = purchasePrice − loanAmount; falls back to undefined if either is missing.
  const computedCashOnCash: number | undefined = (() => {
    const resolvedNoi = parsedSummaryMetrics.noi;
    const resolvedAds = computedAds;
    const resolvedPurchasePrice =
      parsedSummaryMetrics.purchasePrice ?? v('purchase_price') ?? purchasePrice;
    if (resolvedNoi == null || resolvedAds == null || resolvedPurchasePrice == null) return undefined;
    const equity = resolvedPurchasePrice - (loanAmount ?? 0);
    if (equity <= 0) return undefined;
    return (resolvedNoi - resolvedAds) / equity;
  })();

  // Final resolution: stored flat key → agent output field → parsed/computed from narrative
  const irr = v('five_yr_irr') ?? irrFromOutput ?? parsedSummaryMetrics.irr;
  const cashOnCash =
    v('avg_cash_on_cash') ?? cocFromOutput ?? parsedSummaryMetrics.cashOnCash ?? computedCashOnCash;
  const noi = v('noi_year1') ?? noiFromOutput ?? parsedSummaryMetrics.noi;
  const annualDebtService = v('annual_debt_service') ?? computedAds;
  const dscr = v('dscr_year1') ?? v('year1_dscr') ?? dscrFromOutput ?? computedDscr;
  const equityMultiple = v('equity_multiple') ?? v('equity') ?? emFromOutput;
  const lpIrr = lpIrrFromOutput;
  const gpIrr = gpIrrFromOutput;

  // ── Preserve unmapped fields ────────────────────────────────────────────
  const mappedKeys = new Set([
    'purchase_price', 'year1_cap_rate',
    'exit.cap_rate', 'exit_cap_rate_pct',
    'hold_period_years',
    'assumptions.growth.vacancy_stabilized', 'vacancy_rate_pct',
    'revenue.bad_debt', 'revenue.gross_potential_rent', 'revenue.effective_gross_income',
    'revenue.vacancy_loss', 'revenue.other_income',
    'debt.first_lien_amount', 'loan_amount', 'debt.first_lien_rate', 'interest_rate_pct',
    'amortization_years',
    'assumptions.growth.expense_y1', 'annual_expense_growth_pct',
    'assumptions.growth.rent_y1', 'annual_rent_growth_pct',
    'expense.payroll', 'expense.turnover', 'expense.insurance', 'expense.marketing',
    'expense.utilities', 'expense.property_tax', 'taxes_per_unit',
    'expense.management_fee', 'management_fee_pct',
    'expense.contract_services', 'expense.repairs_maintenance', 'expense.replacement_reserves',
    'five_yr_irr', 'avg_cash_on_cash', 'noi_year1', 'dscr_year1', 'year1_dscr',
    'equity_multiple', 'equity', 'annual_debt_service',
    'ltv_pct', 'units', 'gross_revenue_year1', 'insurance_per_unit',
  ]);
  const agentFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(pj)) {
    if (!mappedKeys.has(key)) {
      agentFields[key] = val;
    }
  }

  return {
    assumptions: {
      acquisition: { purchasePrice, capRate },
      disposition: { exitCapRate },
      holdPeriod,
      revenue: { stabilizedOccupancy, collectionLoss, grossPotentialRent, effectiveGrossIncome, vacancyLoss, otherIncome },
      financing: { loanAmount, interestRate, amortizationYears },
      opexGrowthPct,
      rentGrowthPct,
      expenses,
      _agentFields: Object.keys(agentFields).length > 0 ? agentFields : undefined,
    },
    results: {
      summary: { irr, cashOnCash, noi, dscr, equityMultiple, lpIrr, gpIrr, annualDebtService },
    },
  };
}

async function getAgentVersionRows(dealId: string): Promise<DealVersionRow[]> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    deal_id: string;
    agent_run_id: string;
    proforma_json: Record<string, unknown>;
    created_at: string;
    agent_version: string | null;
    completed_at: string | null;
    agent_output: Record<string, unknown> | null;
  }>(
    `SELECT dus.id, dus.deal_id, dus.agent_run_id, dus.proforma_json, dus.created_at,
            ar.agent_version, ar.completed_at, ar.output AS agent_output
       FROM deal_underwriting_snapshots dus
       INNER JOIN agent_runs ar ON ar.id = dus.agent_run_id
                               AND ar.completed_at IS NOT NULL
                               AND ar.status = 'succeeded'
      WHERE dus.deal_id = $1
      ORDER BY dus.created_at DESC
      LIMIT 5`,
    [dealId]
  );

  return result.rows.map((row, idx) => {
    const ts = row.completed_at ?? row.created_at;
    const date = new Date(ts);
    const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ver = row.agent_version ?? '';
    const versionTag = ver ? (ver.startsWith('v') ? `Agent ${ver}` : `Agent v${ver}`) : 'Agent';
    const note = `${versionTag} — ${dateLabel}`;
    const snap = mapProformaJsonToSnapshot(row.proforma_json ?? {}, row.agent_output);

    return {
      id: `agent-${row.id}`,
      deal_id: row.deal_id,
      version_number: 900 - idx,
      created_at: ts,
      created_by: null,
      layered_state_snapshot: snap,
      model_versions: ver ? { cashflow_agent: ver } : {},
      override_divergences: [],
      save_trigger: 'agent_run' as SaveTrigger,
      note,
    };
  });
}

const router = Router();

// In-process idempotency cache.
// Value is a live Promise while the build is running so concurrent requests
// with the same key share a single LLM call rather than spawning duplicates.
// On completion the entry is replaced with the full serialised response payload
// so cache hits replay exactly the first response (including assumptionsHash).
type IdempPayload = { data: unknown; assumptionsHash: string };
const _idempotencyCache = new Map<string, Promise<IdempPayload> | { payload: IdempPayload; ts: number }>();
const IDEMPOTENCY_TTL_MS = 10_000;

// ──────────────────────────────────────────────────────────────────────────
// Save-Driven Versioning (Spec §13)
//
// All version endpoints are gated by requireAuth + requireDealAccess so that
// the audit trail cannot be read or written across tenants. Authentication is
// enforced first, then deal-level org membership is checked against the
// authenticated user.
// ──────────────────────────────────────────────────────────────────────────

router.get(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const [userVersions, agentVersions] = await Promise.all([
        dealVersionsService.listVersions(dealId),
        getAgentVersionRows(dealId),
      ]);
      return res.json({ success: true, data: [...userVersions, ...agentVersions] });
    } catch (error: any) {
      console.error('List versions error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      // Audit-integrity: server is authoritative for `created_by`, `model_versions`,
      // and `override_divergences` (Spec §13). Client-supplied values for those
      // fields are intentionally ignored to prevent audit-trail tampering.
      const { snapshot, trigger, note } = req.body ?? {};
      if (!snapshot || typeof snapshot !== 'object') {
        return res.status(400).json({ error: 'snapshot (object) is required' });
      }
      const allowedTriggers: SaveTrigger[] = ['user_save', 'chat_command', 'auto_prompt'];
      const safeTrigger: SaveTrigger | undefined =
        trigger && allowedTriggers.includes(trigger) ? trigger : undefined;
      const userId = (req.user as any)?.userId ?? null;
      const row = await dealVersionsService.saveVersion({
        dealId,
        userId,
        snapshot,
        // modelVersions + divergences intentionally omitted — server stamps them.
        trigger: safeTrigger,
        note: note ?? null,
      });
      return res.status(201).json({ success: true, data: row });
    } catch (error: any) {
      console.error('Save version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/:dealId/versions/:versionNumber',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versionNumber = Number(req.params.versionNumber);
      if (!Number.isFinite(versionNumber) || versionNumber < 1) {
        return res.status(400).json({ error: 'versionNumber must be a positive integer' });
      }
      const version = await dealVersionsService.getVersion(req.params.dealId, versionNumber);
      if (!version) return res.status(404).json({ error: 'version not found' });
      return res.json({ success: true, data: version });
    } catch (error: any) {
      console.error('Get version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Maps the F9 frontend proforma format to the engine's ProFormaAssumptions format.
 * The frontend sends:
 *   { dealInfo, acquisition, disposition, revenue, expenses, debt, sensitivityOverrides }
 * The engine expects:
 *   { dealInfo, acquisition, disposition, revenue, expenses, financing, capex, waterfall }
 */
export function normalizeToEngineFormat(raw: any): ProFormaAssumptions {
  const d = raw.dealInfo ?? {};
  const acq = raw.acquisition ?? {};
  const dsp = raw.disposition ?? {};
  const rev = raw.revenue ?? {};
  const exp = raw.expenses ?? {};
  const debt = raw.financing ?? raw.debt ?? {};
  const um = raw.unitMix ?? [];

  // Map unitMix from { unitType, units, rent, sf, assigns } to { floorPlan, unitSize, beds, ... }
  const unitMix = um.length > 0
    ? um.map((u: any) => ({
        floorPlan: u.floorPlan || u.unitType || u.assigns || 'Unit',
        unitSize: u.unitSize || u.sf || 0,
        beds: u.beds ?? 1,
        units: u.units || 1,
        occupied: u.occupied ?? Math.round((u.units || 1) * ((rev.stabilizedOccupancy ?? 0.93))),
        vacant: u.vacant ?? Math.round((u.units || 1) * (1 - (rev.stabilizedOccupancy ?? 0.93))),
        marketRent: u.marketRent || u.rent || 1500,
        inPlaceRent: u.inPlaceRent || u.rent || 1500,
      }))
    : [{
        floorPlan: 'Default',
        unitSize: d.netRentableSF ? Math.round(d.netRentableSF / (d.totalUnits || 1)) : 800,
        beds: 1,
        units: d.totalUnits || 1,
        occupied: Math.round((d.totalUnits || 1) * 0.93),
        vacant: Math.round((d.totalUnits || 1) * 0.07),
        marketRent: 1500,
        inPlaceRent: 1400,
      }];

  // Normalize otherIncome from frontend format if present
  const otherIncome: Record<string, { perUnitMonth: number; penetration: number }> = {};
  if (rev.otherIncome) {
    for (const [k, v] of Object.entries(rev.otherIncome)) {
      const oi = v as any;
      if (typeof oi === 'number') {
        otherIncome[k] = { perUnitMonth: oi, penetration: 1.0 };
      } else if (oi && typeof oi === 'object') {
        otherIncome[k] = {
          perUnitMonth: oi.perUnitMonth ?? oi.perUnit ?? 0,
          penetration: oi.penetration ?? 1.0,
        };
      }
    }
  }

  // Build financing from the frontend debt object
  const interestRate = debt.interestRate != null ? (debt.interestRate > 1 ? debt.interestRate / 100 : debt.interestRate) : 0.065;
  const term = debt.term ?? 60;
  const amortization = debt.amortization ?? 30;
  const loanAmount = debt.loanAmount ?? (acq.purchasePrice ? Math.round(acq.purchasePrice * 0.75) : 0);

  // Support flat frontend keys (lpEquity, gpEquity, purchasePrice directly on raw)
  // in addition to nested format.
  const flatPurchasePrice = typeof raw.purchasePrice === 'number' ? raw.purchasePrice : 0;
  const flatLoanAmount   = typeof raw.loanAmount === 'number' ? raw.loanAmount : 0;
  const flatLpEquity     = typeof raw.lpEquity === 'number' ? raw.lpEquity : 0;
  const flatGpEquity     = typeof raw.gpEquity === 'number' ? raw.gpEquity : 0;
  const flatHoldYears    = typeof raw.holdYears === 'number' ? raw.holdYears : 5;

  // Auto-detect decimal vs percentage format: > 1 means percentage, <= 1 means already decimal
  const pct = (v: number | undefined, fallback: number): number => {
    if (v == null) return fallback;
    return v > 1 ? v / 100 : v;
  };
  const pctArray = (arr: number[] | undefined, fallback: number[]): number[] => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return fallback;
    return arr.map((v: number) => v > 1 ? v / 100 : v);
  };
  const revRentGrowth = pctArray(rev.rentGrowth, [0.03, 0.03, 0.03, 0.03, 0.03]);

  return {
    dealInfo: {
      dealName: d.dealName ?? 'Deal',
      totalUnits: d.totalUnits ?? 0,
      netRentableSF: d.netRentableSF ?? 0,
      vintage: d.vintage ?? 1980,
      address: d.address ?? '',
      city: d.city ?? '',
      state: d.state ?? '',
    },
    modelType: raw.modelType ?? 'existing',
    holdPeriod: flatHoldYears ?? raw.holdPeriod ?? 5,
    unitMix,
    acquisition: {
      purchasePrice: flatPurchasePrice > 0 ? flatPurchasePrice : (acq.purchasePrice ?? 0),
      capRate: pct(acq.capRate, 0.06),
      closingCosts: acq.closingCosts ?? { legal: 50000, appraisal: 15000, inspection: 10000, title: 15000 },
    },
    disposition: {
      exitCapRate: pct(dsp.exitCapRate, 0.065),
      sellingCosts: dsp.sellingCosts ?? 0.02,
      saleNOIMethod: dsp.saleNOIMethod ?? 'terminal',
    },
    revenue: {
      rentGrowth: revRentGrowth,
      lossToLease: pct(rev.lossToLease, 0.03),
      stabilizedOccupancy: pct(rev.stabilizedOccupancy, 0.93),
      collectionLoss: pct(rev.collectionLoss, 0.015),
      otherIncome,
    },
    expenses: (() => {
      const mapped: Record<string, { amount: number; type: string; growthRate: number }> = {};
      for (const [k, v] of Object.entries(exp)) {
        const e = v as any;
        if (!e || typeof e !== 'object') continue;
        // Normalize growthRate from percentage to decimal
        const gr = e.growthRate ?? 3;
        mapped[k] = {
          amount: e.amount ?? 0,
          type: e.type ?? 'sf',
          growthRate: gr > 1 ? gr / 100 : gr,
        };
      }
      return mapped;
    })(),
    financing: {
      loanAmount: flatLoanAmount > 0 ? flatLoanAmount : loanAmount,
      loanType: debt.rateType ?? 'fixed',
      interestRate,
      spread: debt.spread ?? 0.025,
      term,
      amortization,
      ioPeriod: debt.ioPeriod ?? 0,
      originationFee: debt.originationFee ?? 0.01,
      rateCapCost: debt.rateCapCost ?? 0,
      prepayPenalty: debt.prepayPenalty ?? 0,
    },
    capex: {
      lineItems: raw.capexLineItems ?? [],
      contingencyPct: 0.10,
      reservesPerUnit: 250,
    },
    waterfall: {
      lpShare: 0.99,
      gpShare: 0.01,
      hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }],
      equityContribution: flatPurchasePrice > 0 && flatLoanAmount > 0
        ? flatPurchasePrice - flatLoanAmount
        : flatLpEquity + flatGpEquity > 0
          ? flatLpEquity + flatGpEquity
          : loanAmount > 0
            ? (acq.purchasePrice ?? flatPurchasePrice ?? 0) - loanAmount
            : Math.round((acq.purchasePrice ?? flatPurchasePrice ?? 50000000) * 0.25),
    },
  };
}

// ── F-P1-A: Server-fetch path ────────────────────────────────────────────────
// Fetches the latest stored ProFormaAssumptions from deal_financial_models for a
// given dealId.  This is the "server-fetch" path: identical data to what the
// client had on its last successful build, without requiring the client to resend
// the full assumptions blob.
//
// Equivalence proof: running /build with the result of this function should
// produce identical model outputs to a /build call with the same assumptions blob
// the client originally supplied — because it IS that blob (deal_financial_models
// stores the ProFormaAssumptions verbatim in the `assumptions` column).
// B1 (F-P1): client path retired — server-fetch is the only build path.
async function buildAssumptionsFromStore(
  dealId: string,
  pool: ReturnType<typeof getPool>
): Promise<ProFormaAssumptions> {
  const result = await pool.query(
    `SELECT assumptions FROM deal_financial_models
     WHERE deal_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [dealId]
  );
  if (result.rows.length === 0) {
    throw new Error(
      `F-P1-A server-fetch: no completed model found for deal ${dealId}. ` +
      `Cannot reconstruct assumptions — client must supply assumptions body for first build.`
    );
  }
  const raw = result.rows[0].assumptions;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProFormaAssumptions;
}

router.post('/build', async (req: Request, res: Response) => {
  try {
    // B1 (F-P1): client-supplied assumptions body retired. Server-fetch is now the
    // ONLY build path. If a caller supplies `assumptions`, reject with a named error
    // so integrations learn to remove it. The `serverFetch` flag is also retired.
    const { dealId, assumptions, sensitivityOverrides } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    if (assumptions !== undefined) {
      return res.status(400).json({
        error:
          'F-P1-B1: client-supplied assumptions body is rejected. ' +
          'This endpoint now fetches assumptions from the server store exclusively. ' +
          'Remove the `assumptions` field from the request body.',
      });
    }

    // Server-fetch path (F-P1-A — now the only path)
    let resolvedAssumptions: ProFormaAssumptions;
    const assumptionsSource = 'server_store';
    try {
      const pool = getPool();
      resolvedAssumptions = await buildAssumptionsFromStore(dealId, pool);
    } catch (sfErr: any) {
      return res.status(400).json({ error: sfErr.message });
    }

    const normalized = resolvedAssumptions;

    const idempKey = req.headers['idempotency-key'] as string | undefined;
    if (idempKey) {
      const cacheKey = `${dealId}:${idempKey}`;
      const entry = _idempotencyCache.get(cacheKey);

      if (entry) {
        if (entry instanceof Promise) {
          // A concurrent request is already building — await the shared promise
          // and replay its payload verbatim (same data AND same assumptionsHash).
          const payload = await entry;
          return res.json({ success: true, ...payload, idempotent: true });
        }
        const completed = entry as { payload: IdempPayload; ts: number };
        if (Date.now() - completed.ts < IDEMPOTENCY_TTL_MS) {
          return res.json({ success: true, ...completed.payload, idempotent: true });
        }
        // Lazy prune: entry exists but TTL has elapsed — remove before rebuilding.
        _idempotencyCache.delete(cacheKey);
      }

      // Store the in-flight promise before awaiting so concurrent duplicates
      // attach to it rather than spawning independent LLM calls.
      const promise: Promise<IdempPayload> = financialModelEngine.buildModel(dealId, normalized, (req as AuthenticatedRequest).user?.userId)
        .then(({ result, assumptionsHash }) => {
          const pl: IdempPayload = { data: result, assumptionsHash };
          _idempotencyCache.set(cacheKey, { payload: pl, ts: Date.now() });
          return pl;
        })
        .catch(err => { _idempotencyCache.delete(cacheKey); throw err; });
      _idempotencyCache.set(cacheKey, promise);
      const payload = await promise;
      return res.json({ success: true, ...payload });
    }

    const { result, assumptionsHash } = await financialModelEngine.buildModel(dealId, normalized, (req as AuthenticatedRequest).user?.userId);
    return res.json({ success: true, data: result, assumptionsHash, assumptionsSource });
  } catch (error: any) {
    console.error('Financial model build error:', error.message);
    // T7 (TOKEN_LEAK_REMEDIATION_TRANCHE1): propagate the real upstream
    // status instead of hardcoding 500 for everything. Prior to this fix, a
    // 402 (quota exhausted) or a provider outage looked identical to a
    // generic internal error to the frontend/user — no way to tell "your
    // AI budget ran out" from "the server crashed."
    const upstreamStatus = error?.status ?? error?.response?.status;
    const msg = String(error?.message ?? '');
    let status = 500;
    if (typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus < 600) {
      status = upstreamStatus;
    } else if (/daily ai spend cap|usage limit reached|credits remaining/i.test(msg)) {
      status = 402;
    } else if (/no llm provider configured/i.test(msg)) {
      status = 503;
    }
    return res.status(status).json({ error: error.message || 'Failed to build financial model' });
  }
});

router.get('/:dealId/latest', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    // Optional: caller passes ?assumptionsHash=<hex> to get a staleness signal.
    const currentHash = typeof req.query.assumptionsHash === 'string'
      ? req.query.assumptionsHash
      : undefined;
    const model = await financialModelEngine.getLatestModel(dealId, currentHash);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found for this deal' });
    }
    return res.json({ success: true, data: model });
  } catch (error: any) {
    console.error('Get latest model error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/export/excel', requireAuth, requireDealAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const model = await financialModelEngine.getLatestModel(dealId);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found. Build a model first.' });
    }

    if (!model.results?.annualCashFlow || !Array.isArray(model.results.annualCashFlow)) {
      return res.status(400).json({ error: 'Model results incomplete — no annual cash flow data available for export' });
    }

    const filepath = await excelExportService.generateWorkbook(dealId, model.assumptions, model.results);

    const fs = await import('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(500).json({ error: 'Excel file generation failed' });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE deal_financial_models SET excel_path = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM deal_financial_models WHERE deal_id = $2 AND status = 'complete' ORDER BY created_at DESC LIMIT 1)`,
      [filepath, dealId]
    );

    return res.download(filepath, undefined, (err) => {
      if (err && !res.headersSent) {
        console.error('Excel download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (error: any) {
    console.error('Excel export error:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/financial-model/:dealId/periodic
 * Phase 5 — F9 Period Rendering: returns full period-indexed field series.
 * Backward-compatible: returns 404 if no periodic seed exists (pre-Phase-2 deals).
 */
router.get('/:dealId/periodic', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { field } = req.query;
    const pool = getPool();

    const result = await pool.query(
      `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );

    const periodicSeed: ProFormaPeriodicSeed | null = result.rows[0]?.periodic_seed
      ? (typeof result.rows[0].periodic_seed === 'string'
          ? JSON.parse(result.rows[0].periodic_seed)
          : result.rows[0].periodic_seed)
      : null;

    if (!periodicSeed) {
      return res.status(404).json({ error: 'No periodic seed found for this deal' });
    }

    if (field && typeof field === 'string') {
      const series = getFieldSeries(periodicSeed, field);
      if (!series) {
        return res.status(404).json({ error: `Field '${field}' not found in periodic seed` });
      }
      return res.json({ success: true, field, series });
    }

    // Return all fields (keyed by field name)
    const allSeries: Record<string, Array<{ month: string; resolved: number | null; zone: string }>> = {};
    for (const fieldName of Object.keys(periodicSeed.fields)) {
      const s = getFieldSeries(periodicSeed, fieldName);
      if (s) allSeries[fieldName] = s;
    }

    return res.json({ success: true, boundary: periodicSeed.boundary, fields: allSeries });
  } catch (error: any) {
    console.error('Periodic data error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
