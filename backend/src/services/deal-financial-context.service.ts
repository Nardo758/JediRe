import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export interface FinancialDataSource {
  sourceType: string;
  sourceRef?: string;
  sourceDate?: string;
}

export interface MonthlyActual {
  reportMonth: string;
  revenue: number;
  expenses: number;
  noi: number;
  occupancy?: number;
  sourceDocumentType?: string;
  sourcePeriodLabel?: string;
  dataSource?: string;
}

export interface LeaseSnapshot {
  unitNumber: string;
  tenantName?: string;
  monthlyRent: number;
  effectiveRent?: number;
  leaseStart?: string;
  leaseEnd?: string;
  status: string;
  concessionAmount?: number;
  sourceType?: string;
}

export interface BalanceSheetSnapshot {
  reportMonth: string;
  totalAssets: number;
  totalLiabilities: number;
  netEquity: number;
  cashReserves?: number;
  replacementReserves?: number;
  escrowBalance?: number;
  sourceType?: string;
}

export interface CapExItem {
  category: string;
  description?: string;
  budgetedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  completionPct: number;
  status: string;
  sourceType?: string;
}

export interface DebtItem {
  lender: string;
  loanType: string;
  originalBalance: number;
  currentBalance: number;
  interestRate: number;
  rateType: string;
  maturityDate?: string;
  monthlyPayment: number;
  dscr?: number;
  ltv?: number;
  isActive: boolean;
  sourceType?: string;
}

export interface DealFinancialContext {
  dealId: string;
  propertyId: string | null;
  hasFinancialData: boolean;

  assumptions: {
    totalUnits?: number;
    rentPerUnit?: number;
    vacancyRate?: number;
    opexRatio?: number;
    exitCap?: number;
    interestRate?: number;
    ltc?: number;
    holdPeriodYears?: number;
    hardCostPsf?: number;
    softCostPct?: number;
    provenance?: FinancialDataSource;
  };

  recentActuals: MonthlyActual[];
  trailingTwelveNOI: number | null;
  trailingTwelveRevenue: number | null;
  trailingTwelveExpenses: number | null;
  avgOccupancy: number | null;

  leases: {
    totalUnitsLeased: number;
    totalUnitsVacant: number;
    avgRent: number;
    totalMonthlyIncome: number;
    upcomingExpirations: number;
    items: LeaseSnapshot[];
  };

  balanceSheet: BalanceSheetSnapshot | null;

  capex: {
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    avgCompletion: number;
    items: CapExItem[];
  };

  debt: {
    totalBalance: number;
    weightedAvgRate: number;
    totalMonthlyService: number;
    nearestMaturity: string | null;
    items: DebtItem[];
  };

  dataSources: {
    hasUploadedPnL: boolean;
    hasUploadedRentRoll: boolean;
    hasUploadedBalanceSheet: boolean;
    hasUploadedCapex: boolean;
    hasUploadedDebt: boolean;
    hasManualAssumptions: boolean;
    lastUploadDate: string | null;
  };
}

export async function getDealFinancialContext(dealId: string): Promise<DealFinancialContext> {
  const pool = getPool();

  const propResult = await pool.query(
    `SELECT property_id FROM deals WHERE id = $1
     UNION SELECT id FROM properties WHERE id = $1
     LIMIT 1`,
    [dealId]
  );
  const propertyId = propResult.rows[0]?.property_id || dealId;

  const [
    assumptionsRes,
    actualsRes,
    leasesRes,
    balanceSheetRes,
    capexRes,
    debtRes,
  ] = await Promise.all([
    pool.query(
      `SELECT * FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT report_month, revenue, operating_expenses, noi, occupancy_pct,
              source_document_type, source_period_label, data_source
       FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_budget = false
       ORDER BY report_month DESC
       LIMIT 12`,
      [propertyId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT unit_number, tenant_name, monthly_rent, effective_rent,
              lease_start, lease_end, lease_status, concession_amount, source_type
       FROM deal_lease_transactions
       WHERE deal_id = $1
       ORDER BY unit_number`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT report_month, total_assets, total_liabilities, total_equity,
              reserves, replacement_reserve, escrows, source_type
       FROM deal_balance_sheets
       WHERE deal_id = $1
       ORDER BY report_month DESC
       LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT category, description, budgeted_amount, actual_amount,
              remaining_amount, completion_pct, status, source_type
       FROM deal_capex_items
       WHERE deal_id = $1
       ORDER BY category`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT lender, loan_type, original_amount, current_balance,
              interest_rate, rate_type, maturity_date, monthly_payment,
              dscr, ltv, is_active, source_type
       FROM deal_debt_schedule
       WHERE deal_id = $1 AND is_active = true
       ORDER BY current_balance DESC`,
      [dealId]
    ).catch(() => ({ rows: [] })),
  ]);

  const assumptions = assumptionsRes.rows[0] || {};
  const actuals = actualsRes.rows;
  const leaseRows = leasesRes.rows;
  const bsRaw = balanceSheetRes.rows[0] || null;
  const capexRows = capexRes.rows;
  const debtRows = debtRes.rows;

  const t12Actuals = actuals.slice(0, 12);
  const trailingTwelveNOI = t12Actuals.length > 0
    ? t12Actuals.reduce((s: number, r: any) => s + (Number(r.noi) || 0), 0)
    : null;
  const trailingTwelveRevenue = t12Actuals.length > 0
    ? t12Actuals.reduce((s: number, r: any) => s + (Number(r.revenue) || 0), 0)
    : null;
  const trailingTwelveExpenses = t12Actuals.length > 0
    ? t12Actuals.reduce((s: number, r: any) => s + (Number(r.operating_expenses) || 0), 0)
    : null;
  const avgOccupancy = t12Actuals.length > 0
    ? t12Actuals.reduce((s: number, r: any) => s + (Number(r.occupancy_pct) || 0), 0) / t12Actuals.length
    : null;

  const occupiedLeases = leaseRows.filter((l: any) => l.lease_status === 'occupied' || l.lease_status === 'active');
  const vacantLeases = leaseRows.filter((l: any) => l.lease_status === 'vacant' || l.lease_status === 'available');
  const avgRent = occupiedLeases.length > 0
    ? occupiedLeases.reduce((s: number, l: any) => s + (Number(l.monthly_rent) || 0), 0) / occupiedLeases.length
    : 0;
  const totalMonthlyIncome = occupiedLeases.reduce((s: number, l: any) => s + (Number(l.monthly_rent) || 0), 0);

  const now = new Date();
  const sixMonthsOut = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const upcomingExpirations = occupiedLeases.filter((l: any) => {
    if (!l.lease_end) return false;
    const end = new Date(l.lease_end);
    return end <= sixMonthsOut && end >= now;
  }).length;

  const totalCapexBudget = capexRows.reduce((s: number, c: any) => s + (Number(c.budgeted_amount) || 0), 0);
  const totalCapexSpent = capexRows.reduce((s: number, c: any) => s + (Number(c.actual_amount) || 0), 0);
  const totalCapexRemaining = capexRows.reduce((s: number, c: any) => s + (Number(c.remaining_amount) || 0), 0);
  const avgCapexCompletion = capexRows.length > 0
    ? capexRows.reduce((s: number, c: any) => s + (Number(c.completion_pct) || 0), 0) / capexRows.length
    : 0;

  const totalDebtBalance = debtRows.reduce((s: number, d: any) => s + (Number(d.current_balance) || 0), 0);
  const totalDebtService = debtRows.reduce((s: number, d: any) => s + (Number(d.monthly_payment) || 0), 0);
  const weightedAvgRate = totalDebtBalance > 0
    ? debtRows.reduce((s: number, d: any) =>
        s + (Number(d.interest_rate) || 0) * (Number(d.current_balance) || 0), 0) / totalDebtBalance
    : 0;
  const maturities = debtRows
    .filter((d: any) => d.maturity_date)
    .map((d: any) => d.maturity_date)
    .sort();
  const nearestMaturity = maturities.length > 0 ? maturities[0] : null;

  const hasUploadedPnL = actuals.some((a: any) => a.data_source === 'upload' || a.data_source === 'csv_upload');
  const hasUploadedRentRoll = leaseRows.some((l: any) => l.source_type === 'upload' || l.source_type === 'csv_upload');
  const hasUploadedBalanceSheet = bsRaw?.source_type === 'upload' || bsRaw?.source_type === 'csv_upload';
  const hasUploadedCapex = capexRows.some((c: any) => c.source_type === 'upload' || c.source_type === 'csv_upload');
  const hasUploadedDebt = debtRows.some((d: any) => d.source_type === 'upload' || d.source_type === 'csv_upload');
  const hasManualAssumptions = assumptions.source_type === 'manual';

  const allDates = [
    ...actuals.map((a: any) => a.report_month),
    ...(bsRaw ? [bsRaw.report_month] : []),
  ].filter(Boolean).sort().reverse();
  const lastUploadDate = allDates[0] || null;

  const hasFinancialData = actuals.length > 0 || leaseRows.length > 0 ||
    bsRaw !== null || capexRows.length > 0 || debtRows.length > 0 ||
    Object.keys(assumptions).length > 0;

  return {
    dealId,
    propertyId,
    hasFinancialData,
    assumptions: {
      totalUnits: Number(assumptions.total_units) || undefined,
      rentPerUnit: Number(assumptions.avg_rent_per_unit) || undefined,
      vacancyRate: assumptions.vacancy_pct != null ? Number(assumptions.vacancy_pct) : undefined,
      opexRatio: assumptions.opex_ratio != null ? Number(assumptions.opex_ratio) : undefined,
      exitCap: assumptions.exit_cap != null ? Number(assumptions.exit_cap) : undefined,
      interestRate: assumptions.interest_rate != null ? Number(assumptions.interest_rate) : undefined,
      ltc: assumptions.ltc != null ? Number(assumptions.ltc) : undefined,
      holdPeriodYears: Number(assumptions.hold_period_years) || undefined,
      hardCostPsf: Number(assumptions.hard_cost_psf) || undefined,
      softCostPct: assumptions.soft_cost_pct != null ? Number(assumptions.soft_cost_pct) : undefined,
      provenance: assumptions.source_type ? {
        sourceType: assumptions.source_type,
        sourceRef: assumptions.source_ref,
        sourceDate: assumptions.source_date,
      } : undefined,
    },
    recentActuals: actuals.map((a: any) => ({
      reportMonth: a.report_month,
      revenue: Number(a.revenue) || 0,
      expenses: Number(a.operating_expenses) || 0,
      noi: Number(a.noi) || 0,
      occupancy: Number(a.occupancy_pct) || undefined,
      sourceDocumentType: a.source_document_type,
      sourcePeriodLabel: a.source_period_label,
      dataSource: a.data_source,
    })),
    trailingTwelveNOI,
    trailingTwelveRevenue,
    trailingTwelveExpenses,
    avgOccupancy,
    leases: {
      totalUnitsLeased: occupiedLeases.length,
      totalUnitsVacant: vacantLeases.length,
      avgRent,
      totalMonthlyIncome,
      upcomingExpirations,
      items: leaseRows.map((l: any) => ({
        unitNumber: l.unit_number,
        tenantName: l.tenant_name,
        monthlyRent: Number(l.monthly_rent) || 0,
        effectiveRent: Number(l.effective_rent) || undefined,
        leaseStart: l.lease_start,
        leaseEnd: l.lease_end,
        status: l.lease_status,
        concessionAmount: Number(l.concession_amount) || undefined,
        sourceType: l.source_type,
      })),
    },
    balanceSheet: bsRaw ? {
      reportMonth: bsRaw.report_month,
      totalAssets: Number(bsRaw.total_assets) || 0,
      totalLiabilities: Number(bsRaw.total_liabilities) || 0,
      netEquity: Number(bsRaw.total_equity) || 0,
      cashReserves: Number(bsRaw.reserves) || undefined,
      replacementReserves: Number(bsRaw.replacement_reserve) || undefined,
      escrowBalance: Number(bsRaw.escrows) || undefined,
      sourceType: bsRaw.source_type,
    } : null,
    capex: {
      totalBudgeted: totalCapexBudget,
      totalSpent: totalCapexSpent,
      totalRemaining: totalCapexRemaining,
      avgCompletion: avgCapexCompletion,
      items: capexRows.map((c: any) => ({
        category: c.category,
        description: c.description,
        budgetedAmount: Number(c.budgeted_amount) || 0,
        actualAmount: Number(c.actual_amount) || 0,
        remainingAmount: Number(c.remaining_amount) || 0,
        completionPct: Number(c.completion_pct) || 0,
        status: c.status,
        sourceType: c.source_type,
      })),
    },
    debt: {
      totalBalance: totalDebtBalance,
      weightedAvgRate,
      totalMonthlyService: totalDebtService,
      nearestMaturity,
      items: debtRows.map((d: any) => ({
        lender: d.lender,
        loanType: d.loan_type,
        originalBalance: Number(d.original_amount) || 0,
        currentBalance: Number(d.current_balance) || 0,
        interestRate: Number(d.interest_rate) || 0,
        rateType: d.rate_type,
        maturityDate: d.maturity_date,
        monthlyPayment: Number(d.monthly_payment) || 0,
        dscr: Number(d.dscr) || undefined,
        ltv: Number(d.ltv) || undefined,
        isActive: d.is_active,
        sourceType: d.source_type,
      })),
    },
    dataSources: {
      hasUploadedPnL,
      hasUploadedRentRoll,
      hasUploadedBalanceSheet,
      hasUploadedCapex,
      hasUploadedDebt,
      hasManualAssumptions,
      lastUploadDate,
    },
  };
}

export function formatFinancialContextForPrompt(ctx: DealFinancialContext): string {
  if (!ctx.hasFinancialData) {
    return 'No financial data available for this deal. Analysis will be based on deal specs and market data only.';
  }

  let prompt = '';

  if (ctx.assumptions.totalUnits || ctx.assumptions.rentPerUnit) {
    prompt += `\nDEAL ASSUMPTIONS${ctx.assumptions.provenance ? ` (Source: ${ctx.assumptions.provenance.sourceType})` : ''}:\n`;
    if (ctx.assumptions.totalUnits) prompt += `- Total Units: ${ctx.assumptions.totalUnits}\n`;
    if (ctx.assumptions.rentPerUnit) prompt += `- Rent/Unit: $${ctx.assumptions.rentPerUnit.toLocaleString()}/mo\n`;
    if (ctx.assumptions.vacancyRate != null) prompt += `- Vacancy Rate: ${(ctx.assumptions.vacancyRate * 100).toFixed(1)}%\n`;
    if (ctx.assumptions.opexRatio != null) prompt += `- OpEx Ratio: ${(ctx.assumptions.opexRatio * 100).toFixed(1)}%\n`;
    if (ctx.assumptions.exitCap != null) prompt += `- Exit Cap: ${(ctx.assumptions.exitCap * 100).toFixed(2)}%\n`;
    if (ctx.assumptions.interestRate != null) prompt += `- Interest Rate: ${(ctx.assumptions.interestRate * 100).toFixed(2)}%\n`;
    if (ctx.assumptions.ltc != null) prompt += `- LTC: ${(ctx.assumptions.ltc * 100).toFixed(1)}%\n`;
    if (ctx.assumptions.holdPeriodYears) prompt += `- Hold Period: ${ctx.assumptions.holdPeriodYears} years\n`;
    if (ctx.assumptions.hardCostPsf) prompt += `- Hard Cost/SF: $${ctx.assumptions.hardCostPsf.toLocaleString()}\n`;
    if (ctx.assumptions.softCostPct != null) prompt += `- Soft Cost: ${(ctx.assumptions.softCostPct * 100).toFixed(1)}%\n`;
  }

  if (ctx.trailingTwelveNOI !== null) {
    prompt += `\nTRAILING 12-MONTH ACTUALS (from uploaded P&L):\n`;
    prompt += `- T12 Revenue: $${ctx.trailingTwelveRevenue!.toLocaleString()}\n`;
    prompt += `- T12 Expenses: $${ctx.trailingTwelveExpenses!.toLocaleString()}\n`;
    prompt += `- T12 NOI: $${ctx.trailingTwelveNOI.toLocaleString()}\n`;
    if (ctx.avgOccupancy) prompt += `- Avg Occupancy: ${ctx.avgOccupancy.toFixed(1)}%\n`;
    prompt += `- Months of data: ${ctx.recentActuals.length}\n`;

    if (ctx.recentActuals.length >= 2) {
      const latest = ctx.recentActuals[0];
      const prior = ctx.recentActuals[1];
      const noiTrend = latest.noi - prior.noi;
      prompt += `- NOI Trend: ${noiTrend >= 0 ? '+' : ''}$${noiTrend.toLocaleString()} (latest vs prior month)\n`;
    }
  }

  if (ctx.leases.totalUnitsLeased > 0 || ctx.leases.totalUnitsVacant > 0) {
    const totalUnits = ctx.leases.totalUnitsLeased + ctx.leases.totalUnitsVacant;
    const occRate = totalUnits > 0 ? (ctx.leases.totalUnitsLeased / totalUnits * 100).toFixed(1) : 'N/A';
    prompt += `\nRENT ROLL SUMMARY:\n`;
    prompt += `- Occupied Units: ${ctx.leases.totalUnitsLeased} / ${totalUnits} (${occRate}%)\n`;
    prompt += `- Average Rent: $${ctx.leases.avgRent.toLocaleString()}/mo\n`;
    prompt += `- Total Monthly Income: $${ctx.leases.totalMonthlyIncome.toLocaleString()}\n`;
    if (ctx.leases.upcomingExpirations > 0) {
      prompt += `- Upcoming Expirations (6mo): ${ctx.leases.upcomingExpirations} leases\n`;
    }
  }

  if (ctx.balanceSheet) {
    prompt += `\nBALANCE SHEET (${ctx.balanceSheet.reportMonth}):\n`;
    prompt += `- Total Assets: $${ctx.balanceSheet.totalAssets.toLocaleString()}\n`;
    prompt += `- Total Liabilities: $${ctx.balanceSheet.totalLiabilities.toLocaleString()}\n`;
    prompt += `- Net Equity: $${ctx.balanceSheet.netEquity.toLocaleString()}\n`;
    if (ctx.balanceSheet.cashReserves) prompt += `- Cash Reserves: $${ctx.balanceSheet.cashReserves.toLocaleString()}\n`;
    if (ctx.balanceSheet.replacementReserves) prompt += `- Replacement Reserves: $${ctx.balanceSheet.replacementReserves.toLocaleString()}\n`;
  }

  if (ctx.capex.items.length > 0) {
    prompt += `\nCAPEX SUMMARY:\n`;
    prompt += `- Total Budget: $${ctx.capex.totalBudgeted.toLocaleString()}\n`;
    prompt += `- Spent: $${ctx.capex.totalSpent.toLocaleString()} (${ctx.capex.totalBudgeted > 0 ? ((ctx.capex.totalSpent / ctx.capex.totalBudgeted) * 100).toFixed(0) : 0}%)\n`;
    prompt += `- Remaining: $${ctx.capex.totalRemaining.toLocaleString()}\n`;
    prompt += `- Avg Completion: ${ctx.capex.avgCompletion.toFixed(0)}%\n`;
    prompt += `- Active Items: ${ctx.capex.items.length}\n`;
  }

  if (ctx.debt.items.length > 0) {
    prompt += `\nDEBT SUMMARY:\n`;
    prompt += `- Total Outstanding: $${ctx.debt.totalBalance.toLocaleString()}\n`;
    prompt += `- Wtd Avg Rate: ${ctx.debt.weightedAvgRate.toFixed(2)}%\n`;
    prompt += `- Monthly Debt Service: $${ctx.debt.totalMonthlyService.toLocaleString()}\n`;
    if (ctx.debt.nearestMaturity) prompt += `- Nearest Maturity: ${ctx.debt.nearestMaturity}\n`;
    const avgDscr = ctx.debt.items.filter((d) => d.dscr).reduce((s, d) => s + (d.dscr || 0), 0) / (ctx.debt.items.filter(d => d.dscr).length || 1);
    if (avgDscr > 0) prompt += `- Avg DSCR: ${avgDscr.toFixed(2)}x\n`;
  }

  const sources: string[] = [];
  if (ctx.dataSources.hasUploadedPnL) sources.push('P&L (uploaded)');
  if (ctx.dataSources.hasUploadedRentRoll) sources.push('Rent Roll (uploaded)');
  if (ctx.dataSources.hasUploadedBalanceSheet) sources.push('Balance Sheet (uploaded)');
  if (ctx.dataSources.hasUploadedCapex) sources.push('CapEx Report (uploaded)');
  if (ctx.dataSources.hasUploadedDebt) sources.push('Debt Schedule (uploaded)');
  if (ctx.dataSources.hasManualAssumptions) sources.push('Assumptions (manual entry)');

  if (sources.length > 0) {
    prompt += `\nDATA PROVENANCE:\n- Sources: ${sources.join(', ')}\n`;
    if (ctx.dataSources.lastUploadDate) {
      prompt += `- Latest Data: ${ctx.dataSources.lastUploadDate}\n`;
    }
  }

  return prompt;
}
