/**
 * Flatten the deeply nested ProFormaTab assumptions into the flat key-value
 * format the goal-seeking solver expects.
 *
 * ProFormaTab assumptions structure (buildAssumptionsPayload):
 *   revenue: { rentGrowth: number[], lossToLease, stabilizedOccupancy, collectionLoss, otherIncome }
 *   expenses: { [displayName]: { amount, type, growthRate } }
 *   disposition: { exitCapRate, sellingCosts, saleNOIMethod }
 *   financing: { loanAmount, loanType, interestRate, spread, ... }
 *   acquisition: { purchasePrice, capRate, closingCosts }
 *   capex: { lineItems, contingencyPct, reservesPerUnit }
 *   waterfall: { lpShare, gpShare, hurdles, equityContribution }
 *   dealInfo: { ... }
 *
 * Solver expects:
 *   rent_growth, vacancy_rate, loss_to_lease, collection_loss,
 *   expense_growth, exit_cap_rate, entry_cap_rate, debt_rate, ltv
 */
export function flattenAssumptionsForSolver(
  payload: Record<string, any>,
): {
  baseAssumptions: Record<string, number>;
  expenseLineItems: Record<string, number>;
  dealParams: Record<string, number>;
} {
  const revenue = payload.revenue || {};
  const disposition = payload.disposition || {};
  const financing = payload.financing || {};
  const acquisition = payload.acquisition || {};
  const expenses = payload.expenses || {};

  // Use first-year rent growth as the base
  const firstRentGrowth = Array.isArray(revenue.rentGrowth) && revenue.rentGrowth.length > 0
    ? revenue.rentGrowth[0]
    : 0.03;

  // Blended expense growth rate (mean of all expense line growth rates)
  const expRates = Object.values(expenses).filter((e: any) => typeof e?.growthRate === 'number').map((e: any) => e.growthRate);
  const blendedExpenseGrowth = expRates.length > 0
    ? expRates.reduce((a: number, b: number) => a + b, 0) / expRates.length
    : 0.03;

  const baseAssumptions: Record<string, number> = {
    rent_growth: firstRentGrowth,
    vacancy_rate: 1 - (revenue.stabilizedOccupancy ?? 0.93),
    loss_to_lease: revenue.lossToLease ?? 0.03,
    collection_loss: revenue.collectionLoss ?? 0.015,
    expense_growth: blendedExpenseGrowth,
    exit_cap_rate: disposition.exitCapRate ?? 0.055,
    entry_cap_rate: acquisition.capRate ?? 0.0575,
    debt_rate: financing.interestRate ?? 0.065,
    ltv: financing.loanAmount && acquisition.purchasePrice
      ? financing.loanAmount / acquisition.purchasePrice
      : 0.70,
  };

  // Expense line items: current growth rates keyed by display name
  const expenseLineItems: Record<string, number> = {};
  for (const [key, val] of Object.entries(expenses)) {
    if (typeof (val as any)?.growthRate === 'number') {
      expenseLineItems[key] = (val as any).growthRate;
    }
  }

  const dealParams: Record<string, number> = {
    purchasePrice: acquisition.purchasePrice ?? 10_000_000,
    totalUnits: payload.dealInfo?.totalUnits ?? 100,
    noiAtAcquisition: revenue.noiAtAcquisition ?? acquisition.purchasePrice * (acquisition.capRate ?? 0.0575),
    acquisitionCosts: 0.02,
    exitFees: disposition.sellingCosts ?? 0.03,
  };

  return { baseAssumptions, expenseLineItems, dealParams };
}

/**
 * Apply the solver's output back onto the proforma assumptions payload.
 * Respects the changed list — only overwrites fields the solver touched.
 */
export function applySolverToAssumptions(
  payload: Record<string, any>,
  applyPayload: {
    assumptions: Record<string, number>;
    expenseOverrides: Record<string, number>;
    changed: string[];
  },
): Record<string, any> {
  const updated = JSON.parse(JSON.stringify(payload)); // deep clone

  for (const varId of applyPayload.changed) {
    if (varId === 'rent_growth' && updated.revenue?.rentGrowth) {
      updated.revenue.rentGrowth = [applyPayload.assumptions.rent_growth, ...updated.revenue.rentGrowth.slice(1)];
    } else if (varId === 'vacancy_rate' && updated.revenue?.stabilizedOccupancy != null) {
      // Vacancy = 1 - stabilized occupancy
      updated.revenue.stabilizedOccupancy = 1 - applyPayload.assumptions.vacancy_rate;
    } else if (varId === 'loss_to_lease' && updated.revenue) {
      updated.revenue.lossToLease = applyPayload.assumptions.loss_to_lease;
    } else if (varId === 'collection_loss' && updated.revenue) {
      updated.revenue.collectionLoss = applyPayload.assumptions.collection_loss;
    } else if (varId === 'expense_growth') {
      // Blended expense growth update — we don't modify individual lines here,
      // the expenseOverrides handle per-line-item changes
    } else if (varId === 'exit_cap_rate' && updated.disposition) {
      updated.disposition.exitCapRate = applyPayload.assumptions.exit_cap_rate;
    } else if (varId.startsWith('expense:') && updated.expenses) {
      const key = varId.replace('expense:', '');
      if (updated.expenses[key] && applyPayload.expenseOverrides[key] != null) {
        updated.expenses[key].growthRate = applyPayload.expenseOverrides[key];
      }
    }
  }

  // Apply all expense overrides explicitly
  for (const [key, rate] of Object.entries(applyPayload.expenseOverrides)) {
    if (updated.expenses?.[key]) {
      updated.expenses[key].growthRate = rate;
    }
  }

  return updated;
}
