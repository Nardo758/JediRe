/**
 * Debt Tracking Service
 * 
 * Manages debt positions, refinance events, and covenant compliance.
 * Integrates with both underwriting (refi tests) and operations (real-time monitoring).
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface DebtPosition {
  id?: string;
  dealId: string;
  loanName: string;
  lenderName?: string;
  loanType: 'agency' | 'cmbs' | 'bank' | 'bridge' | 'life_co' | 'debt_fund';
  
  originalPrincipal: number;
  currentBalance?: number;
  ltvAtOrigination?: number;
  
  rateType: 'fixed' | 'floating';
  baseRate?: string;
  spreadBps?: number;
  currentRate: number;
  rateFloor?: number;
  rateCap?: number;
  
  rateCapPurchased?: boolean;
  rateCapStrike?: number;
  rateCapExpiry?: Date;
  hedgeType?: 'cap' | 'swap' | 'collar' | 'none';
  hedgeExpiryDate?: Date;

  originationDate: Date;
  maturityDate: Date;
  extensionOptions?: number;
  extensionTermMonths?: number;
  
  amortizationType?: 'IO' | 'amortizing' | 'partial_IO';
  ioPeriodMonths?: number;
  amortizationYears?: number;
  
  monthlyPayment?: number;
  annualDebtService?: number;
  
  dscrCovenant?: number;
  ltvCovenant?: number;
  debtYieldCovenant?: number;
  
  prepaymentType?: 'open' | 'yield_maintenance' | 'defeasance' | 'step_down';
  prepaymentPenaltyPct?: number;
  prepayLockoutUntil?: Date;
}

export interface RefiTestScenario {
  dealId: string;
  debtId?: string;
  scenarioName: string;
  scenarioType: 'underwriting' | 'operational' | 'stress_test';
  testDate: Date;
  
  assumedNoi: number;
  assumedValue: number;
  assumedCapRate?: number;
  assumedRateEnvironment?: string;
  
  maxLtv: number;
  minDscr: number;
  minDebtYield: number;
  
  assumedSpreadBps?: number;
  assumedBaseRate?: number;
  assumedAllInRate?: number;
  
  existingBalance?: number;
}

export interface RefiTestResult {
  maxLoanByLtv: number;
  maxLoanByDscr: number;
  maxLoanByDy: number;
  constrainedBy: 'ltv' | 'dscr' | 'debt_yield';
  maxLoanProceeds: number;
  cashOutAvailable: number;
  newDebtService: number;
  dscrPostRefi: number;
  isFeasible: boolean;
  feasibilityNotes: string;
}

// ─── Debt Position Management ─────────────────────────────────────────

/**
 * Create or update a debt position
 */
export async function upsertDebtPosition(debt: DebtPosition): Promise<string> {
  const result = await query(
    `INSERT INTO debt_positions (
      deal_id, loan_name, lender_name, loan_type,
      original_principal, current_balance, ltv_at_origination,
      rate_type, base_rate, spread_bps, current_rate, rate_floor, rate_cap,
      rate_cap_purchased, rate_cap_strike, rate_cap_expiry,
      origination_date, maturity_date, extension_options, extension_term_months,
      amortization_type, io_period_months, amortization_years,
      monthly_payment, annual_debt_service,
      dscr_covenant, ltv_covenant, debt_yield_covenant,
      prepayment_type, prepayment_penalty_pct, prepay_lockout_until,
      hedge_type, hedge_expiry_date
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16,
      $17, $18, $19, $20,
      $21, $22, $23,
      $24, $25,
      $26, $27, $28,
      $29, $30, $31,
      $32, $33
    )
    ON CONFLICT (id) WHERE id IS NOT NULL DO UPDATE SET
      current_balance = EXCLUDED.current_balance,
      current_rate = EXCLUDED.current_rate,
      monthly_payment = EXCLUDED.monthly_payment,
      hedge_type = EXCLUDED.hedge_type,
      hedge_expiry_date = EXCLUDED.hedge_expiry_date,
      updated_at = NOW()
    RETURNING id`,
    [
      debt.dealId, debt.loanName, debt.lenderName, debt.loanType,
      debt.originalPrincipal, debt.currentBalance ?? debt.originalPrincipal, debt.ltvAtOrigination,
      debt.rateType, debt.baseRate, debt.spreadBps, debt.currentRate, debt.rateFloor, debt.rateCap,
      debt.rateCapPurchased ?? false, debt.rateCapStrike, debt.rateCapExpiry,
      debt.originationDate, debt.maturityDate, debt.extensionOptions ?? 0, debt.extensionTermMonths,
      debt.amortizationType, debt.ioPeriodMonths, debt.amortizationYears,
      debt.monthlyPayment, debt.annualDebtService,
      debt.dscrCovenant, debt.ltvCovenant, debt.debtYieldCovenant,
      debt.prepaymentType, debt.prepaymentPenaltyPct, debt.prepayLockoutUntil,
      debt.hedgeType ?? 'none', debt.hedgeExpiryDate ?? null,
    ]
  );
  
  return result.rows[0]?.id;
}

/**
 * Get all debt positions for a deal
 */
export async function getDebtPositions(dealId: string): Promise<DebtPosition[]> {
  const result = await query(
    `SELECT * FROM debt_positions WHERE deal_id = $1 AND status = 'active' ORDER BY origination_date`,
    [dealId]
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    loanName: String(row.loan_name),
    lenderName: row.lender_name as string | undefined,
    loanType: row.loan_type as DebtPosition['loanType'],
    originalPrincipal: Number(row.original_principal),
    currentBalance: Number(row.current_balance),
    ltvAtOrigination: row.ltv_at_origination ? Number(row.ltv_at_origination) : undefined,
    rateType: row.rate_type as 'fixed' | 'floating',
    baseRate: row.base_rate as string | undefined,
    spreadBps: row.spread_bps ? Number(row.spread_bps) : undefined,
    currentRate: Number(row.current_rate),
    rateFloor: row.rate_floor ? Number(row.rate_floor) : undefined,
    rateCap: row.rate_cap ? Number(row.rate_cap) : undefined,
    rateCapPurchased: Boolean(row.rate_cap_purchased),
    rateCapStrike: row.rate_cap_strike ? Number(row.rate_cap_strike) : undefined,
    rateCapExpiry: row.rate_cap_expiry ? new Date(row.rate_cap_expiry as string) : undefined,
    hedgeType: row.hedge_type ? (row.hedge_type as DebtPosition['hedgeType']) : undefined,
    hedgeExpiryDate: row.hedge_expiry_date ? new Date(row.hedge_expiry_date as string) : undefined,
    originationDate: new Date(row.origination_date as string),
    maturityDate: new Date(row.maturity_date as string),
    extensionOptions: Number(row.extension_options ?? 0),
    amortizationType: row.amortization_type as DebtPosition['amortizationType'],
    monthlyPayment: row.monthly_payment ? Number(row.monthly_payment) : undefined,
    annualDebtService: row.annual_debt_service ? Number(row.annual_debt_service) : undefined,
    dscrCovenant: row.dscr_covenant ? Number(row.dscr_covenant) : undefined,
    ltvCovenant: row.ltv_covenant ? Number(row.ltv_covenant) : undefined,
    debtYieldCovenant: row.debt_yield_covenant ? Number(row.debt_yield_covenant) : undefined,
    prepaymentType: row.prepayment_type as DebtPosition['prepaymentType'],
  }));
}

/**
 * Update covenant compliance status
 */
export async function updateCovenantCompliance(
  debtId: string,
  currentDscr: number,
  currentLtv: number,
  currentDebtYield: number
): Promise<{ status: 'compliant' | 'watch' | 'breach'; violations: string[] }> {
  const result = await query(
    `SELECT dscr_covenant, ltv_covenant, debt_yield_covenant FROM debt_positions WHERE id = $1`,
    [debtId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Debt position not found');
  }
  
  const debt = result.rows[0] as Record<string, number>;
  const violations: string[] = [];
  
  if (debt.dscr_covenant && currentDscr < debt.dscr_covenant) {
    violations.push(`DSCR ${currentDscr.toFixed(2)}x below covenant ${debt.dscr_covenant.toFixed(2)}x`);
  }
  if (debt.ltv_covenant && currentLtv > debt.ltv_covenant) {
    violations.push(`LTV ${currentLtv.toFixed(1)}% exceeds covenant ${debt.ltv_covenant.toFixed(1)}%`);
  }
  if (debt.debt_yield_covenant && currentDebtYield < debt.debt_yield_covenant) {
    violations.push(`Debt yield ${currentDebtYield.toFixed(1)}% below covenant ${debt.debt_yield_covenant.toFixed(1)}%`);
  }
  
  const status = violations.length > 0 ? 'breach' : 
    (currentDscr < (debt.dscr_covenant ?? 0) * 1.1 ? 'watch' : 'compliant');
  
  await query(
    `UPDATE debt_positions 
     SET current_dscr = $1, current_ltv = $2, current_debt_yield = $3, covenant_status = $4, updated_at = NOW()
     WHERE id = $5`,
    [currentDscr, currentLtv, currentDebtYield, status, debtId]
  );
  
  return { status, violations };
}

// ─── Refi Testing ─────────────────────────────────────────────────────

/**
 * Run a refinance test scenario
 */
export async function runRefiTest(scenario: RefiTestScenario): Promise<RefiTestResult> {
  const {
    assumedNoi,
    assumedValue,
    maxLtv,
    minDscr,
    minDebtYield,
    assumedAllInRate,
    existingBalance,
  } = scenario;
  
  const rate = assumedAllInRate ?? 6.5; // Default rate assumption
  
  // Calculate max loan by each constraint
  const maxLoanByLtv = assumedValue * (maxLtv / 100);
  
  // Max loan by DSCR: NOI / (minDscr * debt service constant)
  // Assume 30-year amortization for debt constant calculation
  const monthlyRate = rate / 100 / 12;
  const numPayments = 30 * 12;
  const debtConstant = (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1) * 12;
  const maxLoanByDscr = assumedNoi / (minDscr * debtConstant);
  
  // Max loan by debt yield: NOI / minDebtYield
  const maxLoanByDy = assumedNoi / (minDebtYield / 100);
  
  // Binding constraint
  const maxLoanProceeds = Math.min(maxLoanByLtv, maxLoanByDscr, maxLoanByDy);
  let constrainedBy: 'ltv' | 'dscr' | 'debt_yield';
  if (maxLoanProceeds === maxLoanByLtv) constrainedBy = 'ltv';
  else if (maxLoanProceeds === maxLoanByDscr) constrainedBy = 'dscr';
  else constrainedBy = 'debt_yield';
  
  // Cash out available
  const cashOutAvailable = Math.max(0, maxLoanProceeds - (existingBalance ?? 0));
  
  // New debt service
  const newDebtService = maxLoanProceeds * debtConstant;
  
  // Post-refi DSCR
  const dscrPostRefi = assumedNoi / newDebtService;
  
  // Feasibility
  const isFeasible = maxLoanProceeds >= (existingBalance ?? 0) * 0.95 && dscrPostRefi >= minDscr;
  
  let feasibilityNotes = '';
  if (!isFeasible) {
    if (maxLoanProceeds < (existingBalance ?? 0)) {
      feasibilityNotes = `Proceeds ($${(maxLoanProceeds / 1e6).toFixed(1)}M) insufficient to pay off existing debt ($${((existingBalance ?? 0) / 1e6).toFixed(1)}M). Need additional equity.`;
    } else {
      feasibilityNotes = `Post-refi DSCR ${dscrPostRefi.toFixed(2)}x below minimum ${minDscr.toFixed(2)}x.`;
    }
  } else {
    feasibilityNotes = `Refi feasible. Max proceeds $${(maxLoanProceeds / 1e6).toFixed(1)}M (${constrainedBy} constrained). Cash out: $${(cashOutAvailable / 1e6).toFixed(1)}M.`;
  }
  
  // Save scenario result
  await query(
    `INSERT INTO refi_test_scenarios (
      deal_id, debt_id, scenario_name, scenario_type, test_date,
      assumed_noi, assumed_value, assumed_cap_rate, assumed_rate_environment,
      max_ltv, min_dscr, min_debt_yield,
      assumed_spread_bps, assumed_base_rate, assumed_all_in_rate,
      max_loan_by_ltv, max_loan_by_dscr, max_loan_by_dy, constrained_by, max_loan_proceeds,
      existing_balance, cash_out_available, new_debt_service, dscr_post_refi,
      is_feasible, feasibility_notes
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24,
      $25, $26
    )`,
    [
      scenario.dealId, scenario.debtId, scenario.scenarioName, scenario.scenarioType, scenario.testDate,
      assumedNoi, assumedValue, scenario.assumedCapRate, scenario.assumedRateEnvironment,
      maxLtv, minDscr, minDebtYield,
      scenario.assumedSpreadBps, scenario.assumedBaseRate, assumedAllInRate,
      maxLoanByLtv, maxLoanByDscr, maxLoanByDy, constrainedBy, maxLoanProceeds,
      existingBalance, cashOutAvailable, newDebtService, dscrPostRefi,
      isFeasible, feasibilityNotes,
    ]
  );
  
  return {
    maxLoanByLtv,
    maxLoanByDscr,
    maxLoanByDy,
    constrainedBy,
    maxLoanProceeds,
    cashOutAvailable,
    newDebtService,
    dscrPostRefi,
    isFeasible,
    feasibilityNotes,
  };
}

/**
 * Record a refinance event
 */
export async function recordRefinance(
  dealId: string,
  oldDebtId: string,
  newDebtId: string,
  refiDate: Date,
  closingCosts: number,
  refiRationale?: string
): Promise<string> {
  // Get old and new debt details
  const oldDebtResult = await query(
    `SELECT current_balance, current_rate, monthly_payment FROM debt_positions WHERE id = $1`,
    [oldDebtId]
  );
  const newDebtResult = await query(
    `SELECT original_principal, current_rate, monthly_payment FROM debt_positions WHERE id = $1`,
    [newDebtId]
  );
  
  const oldDebt = oldDebtResult.rows[0] as Record<string, number>;
  const newDebt = newDebtResult.rows[0] as Record<string, number>;
  
  const netProceeds = newDebt.original_principal - oldDebt.current_balance - closingCosts;
  
  const result = await query(
    `INSERT INTO refinance_events (
      deal_id, old_debt_id, new_debt_id, refi_date,
      old_loan_balance, new_loan_amount, closing_costs, net_proceeds,
      old_rate, new_rate, old_payment, new_payment,
      refi_rationale
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13
    ) RETURNING id`,
    [
      dealId, oldDebtId, newDebtId, refiDate,
      oldDebt.current_balance, newDebt.original_principal, closingCosts, netProceeds,
      oldDebt.current_rate, newDebt.current_rate, oldDebt.monthly_payment, newDebt.monthly_payment,
      refiRationale,
    ]
  );
  
  // Mark old debt as refinanced
  await query(
    `UPDATE debt_positions SET status = 'refinanced', refinanced_by = $1 WHERE id = $2`,
    [newDebtId, oldDebtId]
  );
  
  logger.info('[debt-tracking] Recorded refinance', {
    dealId,
    oldDebtId,
    newDebtId,
    cashOut: netProceeds,
  });
  
  return result.rows[0]?.id;
}

// ─── Maturity Monitoring ──────────────────────────────────────────────

/**
 * Get upcoming loan maturities across portfolio
 */
export async function getUpcomingMaturities(monthsAhead = 24): Promise<{
  dealId: string;
  dealName: string;
  loanName: string;
  lenderName: string;
  currentBalance: number;
  maturityDate: Date;
  daysToMaturity: number;
  urgency: 'critical' | 'watch' | 'ok';
  extensionOptions: number;
}[]> {
  const result = await query(`
    SELECT 
      d.id as deal_id,
      d.name as deal_name,
      dp.loan_name,
      dp.lender_name,
      dp.current_balance,
      dp.maturity_date,
      dp.maturity_date - CURRENT_DATE as days_to_maturity,
      dp.extension_options,
      CASE 
        WHEN dp.maturity_date <= CURRENT_DATE + INTERVAL '12 months' THEN 'critical'
        WHEN dp.maturity_date <= CURRENT_DATE + INTERVAL '24 months' THEN 'watch'
        ELSE 'ok'
      END as urgency
    FROM deals d
    JOIN debt_positions dp ON dp.deal_id = d.id
    WHERE dp.status = 'active'
      AND dp.maturity_date <= CURRENT_DATE + ($1 || ' months')::interval
    ORDER BY dp.maturity_date
  `, [monthsAhead]);
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    dealId: String(row.deal_id),
    dealName: String(row.deal_name),
    loanName: String(row.loan_name),
    lenderName: String(row.lender_name ?? ''),
    currentBalance: Number(row.current_balance),
    maturityDate: new Date(row.maturity_date as string),
    daysToMaturity: Number(row.days_to_maturity),
    urgency: row.urgency as 'critical' | 'watch' | 'ok',
    extensionOptions: Number(row.extension_options ?? 0),
  }));
}

/**
 * Get portfolio debt summary
 */
export async function getPortfolioDebtSummary(): Promise<{
  totalDebt: number;
  weightedAvgRate: number;
  avgDscr: number;
  maturitiesNext12Mo: number;
  maturitiesNext24Mo: number;
  floatingRateExposure: number;
  fixedRateExposure: number;
}> {
  const result = await query(`
    SELECT 
      SUM(current_balance) as total_debt,
      SUM(current_balance * current_rate) / NULLIF(SUM(current_balance), 0) as weighted_rate,
      AVG(current_dscr) as avg_dscr,
      SUM(CASE WHEN maturity_date <= CURRENT_DATE + INTERVAL '12 months' THEN current_balance ELSE 0 END) as maturing_12mo,
      SUM(CASE WHEN maturity_date <= CURRENT_DATE + INTERVAL '24 months' THEN current_balance ELSE 0 END) as maturing_24mo,
      SUM(CASE WHEN rate_type = 'floating' THEN current_balance ELSE 0 END) as floating,
      SUM(CASE WHEN rate_type = 'fixed' THEN current_balance ELSE 0 END) as fixed
    FROM debt_positions
    WHERE status = 'active'
  `);
  
  const row = result.rows[0] as Record<string, number>;
  
  return {
    totalDebt: Number(row.total_debt ?? 0),
    weightedAvgRate: Number(row.weighted_rate ?? 0),
    avgDscr: Number(row.avg_dscr ?? 0),
    maturitiesNext12Mo: Number(row.maturing_12mo ?? 0),
    maturitiesNext24Mo: Number(row.maturing_24mo ?? 0),
    floatingRateExposure: Number(row.floating ?? 0),
    fixedRateExposure: Number(row.fixed ?? 0),
  };
}
