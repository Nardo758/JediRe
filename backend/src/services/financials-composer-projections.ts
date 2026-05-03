// ── Projections builder ───────────────────────────────────────────────────────
// Generates the projections array that ProjectionsTab expects. Each year is an
// object with flat keys matching the tab's RowDef definitions. Year 1 reads
// from the year1Rows resolved values; subsequent years apply rent growth to
// revenue items and expense growth to expense items.

interface ProjYear {
  year: number;
  // Revenue
  gpr: number | null; vacancyLoss: number | null; lossToLease: number | null;
  concessions: number | null; badDebt: number | null; nru: number | null;
  nri: number | null; otherIncome: number | null; egi: number | null;
  // Expenses (camelCase keys matching ProjectionsTab RowDef)
  payroll: number | null; repairs: number | null; turnover: number | null;
  contractSvc: number | null; marketing: number | null; utilities: number | null;
  gAndA: number | null; mgmtFee: number | null; insurance: number | null;
  reTaxes: number | null; reserves: number | null; totalOpex: number | null;
  // NOI
  noi: number | null; opMargin: number | null; noiPerUnit: number | null;
  // Debt Service
  interest: number | null; principal: number | null; annualDS: number | null;
  // Cash Flow
  cfbt: number | null; cfads: number | null;
  // After-Tax
  depreciation: number | null; taxableIncome: number | null;
  taxPayable: number | null; afterTaxCfads: number | null;
  // Exit/Disposition
  exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
  sellingCosts: number | null; dispositionDocStamps: number | null;
  loanPayoff: number | null; dispositionTaxPayable: number | null;
  netSaleProceeds: number | null;
  // Metrics strip
  occupancy: number | null; dscr: number | null; debtYield: number | null;
  coc: number | null; cumulativeEM: number | null; capRatePct: number | null;
  noiMarginPct: number | null; opexRatioPct: number | null;
  rentGrowthPct: number | null;
}

function buildProjections(
  rows: OSRow[],
  totalUnits: number,
  y1: any,
  purchasePrice: number | null,
  totalOpexY1: number | null,
): ProjYear[] {
  // Extract year 1 resolved values from OSRow[]
  const r = (field: string): number | null => {
    const row = rows.find(rr => rr.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  // Alias for expense rows (same extraction)
  const expense = r;

  const gprY1          = r('gpr');
  const vacancyLossY1  = r('vacancy_loss');
  const lossToLeaseY1  = r('loss_to_lease');
  const concessionsY1  = r('concessions');
  const badDebtY1      = r('bad_debt');
  const nruY1          = r('non_revenue_units');
  const nriY1          = r('net_rental_income');
  const otherIncY1     = r('other_income');
  const egiY1          = r('egi');

  const payrollY1     = expense('payroll');
  const repairsY1     = expense('repairs_maintenance');
  const turnoverY1    = expense('turnover');
  const contractSvcY1 = expense('contract_services');
  const marketingY1   = expense('marketing');
  const utilitiesY1   = expense('utilities');
  const gAndAY1       = expense('g_and_a');
  const mgmtFeeY1     = expense('management_fee');
  const insuranceY1   = expense('insurance');
  const reTaxesY1     = expense('real_estate_taxes');
  const reservesY1    = expense('replacement_reserves');
  const noiY1         = r('noi');

  // Growth rates from y1 seed
  const rentGrowth = ((): number => {
    const v = y1?.rent_growth;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && v.resolved != null) return v.resolved;
    return 0.03;
  })();
  const expenseGrowth = ((): number => {
    const v = y1?.expense_growth;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && v.resolved != null) return v.resolved;
    return 0.03;
  })();

  // Capital stack
  const loanAmount    = y1?.loanAmount ?? null;
  const interestRate = ((): number => {
    const v = y1?.interestRate;
    if (typeof v === 'number') return v;
    return 0.065;
  })();
  const holdYears = ((): number => {
    const v = y1?.holdYears;
    if (typeof v === 'number') return v;
    return 5;
  })();
  const exitCap = ((): number => {
    const v = y1?.exitCap;
    if (typeof v === 'number') return v;
    return 0.0625;
  })();
  const sellingCostsPct = ((): number => {
    const v = y1?.sellingCosts;
    if (typeof v === 'number') return v;
    return 0.02;
  })();

  // Compute constant-payment debt service
  const monthlyRate = interestRate / 12;
  const numPayments = 360; // 30-year amort
  let monthlyPayment = 0;
  if (loanAmount && loanAmount > 0 && monthlyRate > 0) {
    monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  const annualDS = monthlyPayment * 12;

  // Build 10 years
  const years: ProjYear[] = [];
  for (let yi = 0; yi < 10; yi++) {
    const yearNum = yi + 1;
    const rg = Math.pow(1 + rentGrowth, yi);
    const eg = Math.pow(1 + expenseGrowth, yi);

    const scale = (val: number | null): number | null =>
      val != null ? val * rg : null;
    const expenseScale = (val: number | null): number | null =>
      val != null ? val * eg : null;

    const gpr         = scale(gprY1);
    const vacancyLoss = scale(vacancyLossY1);
    const lossToLease = scale(lossToLeaseY1);
    const concessions = scale(concessionsY1);
    const badDebt     = scale(badDebtY1);
    const nru         = scale(nruY1);
    const nri         = scale(nriY1);
    const otherIncome = scale(otherIncY1);
    const egi         = scale(egiY1);

    const payroll     = expenseScale(payrollY1);
    const repairs     = expenseScale(repairsY1);
    const turnover    = expenseScale(turnoverY1);
    const contractSvc = expenseScale(contractSvcY1);
    const marketing   = expenseScale(marketingY1);
    const utilities   = expenseScale(utilitiesY1);
    const gAndA       = expenseScale(gAndAY1);
    const mgmtFee     = expenseScale(mgmtFeeY1);
    const insurance   = expenseScale(insuranceY1);
    const reTaxes     = expenseScale(reTaxesY1);
    const reserves    = expenseScale(reservesY1);
    const totalOpex   = expenseScale(totalOpexY1);

    // If totalOpex is null, sum individual items
    const totalOpexCalc = totalOpex ?? (
      (payroll != null || repairs != null)
        ? ((payroll ?? 0) + (repairs ?? 0) + (turnover ?? 0) + (contractSvc ?? 0) +
           (marketing ?? 0) + (utilities ?? 0) + (gAndA ?? 0) + (mgmtFee ?? 0) +
           (insurance ?? 0) + (reTaxes ?? 0) + (reserves ?? 0))
        : null
    );

    const noi = scale(noiY1) ?? (
      (egi != null && totalOpexCalc != null) ? egi - totalOpexCalc : null
    );
    const opMargin       = noi != null && egi != null && egi > 0 ? noi / egi : null;
    const noiPerUnit     = totalUnits > 0 && noi != null ? noi / totalUnits : null;

    // Debt service (constant payment)
    const annualDSVal = loanAmount != null ? annualDS : null;
    const interest = loanAmount != null ? loanAmount * interestRate : null;
    const principal = annualDSVal != null && interest != null ? annualDSVal - interest : null;
    const cfbt = noi != null && annualDSVal != null ? noi - annualDSVal : null;
    const cfads = cfbt;

    // Sale year disposition (only on holdYears)
    let exitNoiVal: number | null = null;
    let grossSaleValue: number | null = null;
    let sellingCostsVal: number | null = null;
    let netSaleProceedsVal: number | null = null;
    const isSaleYear = yearNum === holdYears;
    if (isSaleYear && noi != null) {
      exitNoiVal = noi;
      grossSaleValue = exitCap > 0 ? noi / exitCap : null;
      sellingCostsVal = grossSaleValue != null ? grossSaleValue * sellingCostsPct : null;
      const loanBalance = loanAmount != null
        ? Math.max(0, loanAmount - (principal ?? 0) * yi)
        : null;
      netSaleProceedsVal = grossSaleValue != null && sellingCostsVal != null && loanBalance != null
        ? grossSaleValue - sellingCostsVal - loanBalance
        : null;
    }

    // Metrics strip
    const occupancy = gpr != null && gpr > 0 && vacancyLoss != null
      ? (gpr - vacancyLoss) / gpr : null;
    const dscr = annualDSVal != null && annualDSVal > 0 && noi != null
      ? noi / annualDSVal : null;
    const debtYield = loanAmount != null && loanAmount > 0 && noi != null
      ? noi / loanAmount : null;
    const coc = cfbt != null && loanAmount != null && loanAmount > 0
      ? cfbt / (loanAmount * 0.01) : null;
    const cumEM = null;
    const capRatePct = purchasePrice != null && purchasePrice > 0 && noi != null
      ? noi / purchasePrice : null;
    const noiMarginPct = opMargin;
    const opexRatioPct = totalOpexCalc != null && egi != null && egi > 0
      ? totalOpexCalc / egi : null;
    const rentGrowthPct = yi === 0 ? rentGrowth : null;

    years.push({
      year: yearNum,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru, nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities, gAndA,
      mgmtFee, insurance, reTaxes, reserves,
      totalOpex: totalOpexCalc,
      noi, opMargin, noiPerUnit,
      interest, principal, annualDS: annualDSVal,
      cfbt, cfads,
      depreciation: null, taxableIncome: null, taxPayable: null, afterTaxCfads: null,
      exitNoi: exitNoiVal,
      exitCap: isSaleYear ? exitCap : null,
      grossSaleValue,
      sellingCosts: sellingCostsVal,
      dispositionDocStamps: null,
      loanPayoff: isSaleYear ? loanAmount : null,
      dispositionTaxPayable: null,
      netSaleProceeds: netSaleProceedsVal,
      occupancy, dscr, debtYield, coc, cumulativeEM: cumEM, capRatePct,
      noiMarginPct, opexRatioPct, rentGrowthPct,
    });
  }
  return years;
}
