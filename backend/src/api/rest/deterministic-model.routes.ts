// ── Deterministic Model Route ──────────────────────────────────────────────
// POST /api/v1/deterministic
// Pure function model runner — no agent, no DB, no external API calls.
// All math computed in TypeScript per spec docs/F9*.

import { Router, Request, Response } from 'express';
import { runModel, ModelAssumptions } from '../../services/deterministic/deterministic-model-runner';

const router = Router();

/**
 * POST /api/v1/deterministic
 * Body: { assumptions: ModelAssumptions }
 * Returns: { success: true, data: ModelResults, runner: 'deterministic' }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { assumptions } = req.body;

    if (!assumptions) {
      return res.status(400).json({ success: false, error: 'Missing assumptions payload' });
    }

    // Validate required fields
    const required: (keyof ModelAssumptions)[] = [
      'purchasePrice', 'units', 'marketRent', 'loanAmount', 'rate',
      'holdYears', 'lpEquity', 'gpEquity',
    ];

    for (const field of required) {
      if (assumptions[field] == null || typeof assumptions[field] !== 'number') {
        return res.status(400).json({
          success: false,
          error: `Missing or invalid required field: ${field}`,
        });
      }
    }

    // Fill defaults for optional fields
    const a: ModelAssumptions = {
      ...assumptions,
      closingCostsPct: assumptions.closingCostsPct ?? 0.01,
      isFlorida: assumptions.isFlorida ?? false,
      docStampsPct: assumptions.docStampsPct ?? 0,
      intangibleTaxPct: assumptions.intangibleTaxPct ?? 0,
      titleInsurancePct: assumptions.titleInsurancePct ?? 0,
      expenseGrowth: assumptions.expenseGrowth ?? 0.03,
      managementFee: assumptions.managementFee ?? 0.04,
      replacementReserves: assumptions.replacementReserves ?? 250,
      saleCosts: assumptions.saleCosts ?? 0.02,
      originationFeePct: assumptions.originationFeePct ?? 0.01,
      preferredReturn: assumptions.preferredReturn ?? 0.08,
      promoteTiers: assumptions.promoteTiers ?? [0.12, 0.15, 0.20],
      promoteSplits: assumptions.promoteSplits ?? [0.20, 0.50, 0.80],
      rentGrowth: assumptions.rentGrowth ?? [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
      lossToLease: assumptions.lossToLease ?? 0.03,
      vacancyY1: assumptions.vacancyY1 ?? 0.10,
      vacancyStab: assumptions.vacancyStab ?? 0.05,
      concessions: assumptions.concessions ?? 0.02,
      badDebt: assumptions.badDebt ?? 0.005,
      otherIncomePerUnit: assumptions.otherIncomePerUnit ?? 0,
      payrollPerUnit: assumptions.payrollPerUnit ?? 0,
      maintenancePerUnit: assumptions.maintenancePerUnit ?? 0,
      contractServicesPerUnit: assumptions.contractServicesPerUnit ?? 0,
      marketingPerUnit: assumptions.marketingPerUnit ?? 0,
      utilitiesPerUnit: assumptions.utilitiesPerUnit ?? 0,
      adminPerUnit: assumptions.adminPerUnit ?? 0,
      insurancePerUnit: assumptions.insurancePerUnit ?? 0,
      term: assumptions.term ?? 360,
      amort: assumptions.amort ?? 360,
      ioPeriod: assumptions.ioPeriod ?? 0,
      dealType: assumptions.dealType ?? 'existing',
    };

    // Derive LTV
    a.ltv = a.loanAmount / a.purchasePrice;

    const result = runModel(a);

    return res.json({
      success: true,
      data: result,
      runner: 'deterministic',
    });
  } catch (err: any) {
    console.error('[deterministic] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal error running deterministic model',
    });
  }
});

export default router;
