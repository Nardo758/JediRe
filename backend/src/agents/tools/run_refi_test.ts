/**
 * run_refi_test Tool
 * 
 * Tests refinance feasibility at a projected exit point.
 * Used by CashFlow agent to validate exit assumptions in underwriting.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const runRefiTestSchema = z.object({
  deal_id: z.string().describe('Deal ID to test refi for'),
  scenario_name: z.string().default('Agent Underwriting Test'),
  scenario_type: z.enum(['underwriting', 'operational', 'stress_test']).default('underwriting'),
  
  // NOI and value assumptions
  assumed_noi: z.number().describe('Projected NOI at refi date'),
  assumed_cap_rate: z.number().optional().describe('Exit cap rate to calculate value'),
  assumed_value: z.number().optional().describe('Direct value assumption (overrides cap rate calc)'),
  
  // Loan constraints
  max_ltv: z.number().default(75).describe('Maximum LTV allowed'),
  min_dscr: z.number().default(1.25).describe('Minimum DSCR required'),
  min_debt_yield: z.number().default(8.0).describe('Minimum debt yield required (%)'),
  
  // Rate assumptions
  assumed_base_rate: z.number().optional().describe('Base rate (SOFR or Treasury)'),
  assumed_spread_bps: z.number().default(180).describe('Spread over base rate in bps'),
  
  // Existing debt
  existing_balance: z.number().optional().describe('Current loan balance to pay off'),
});

export type RunRefiTestInput = z.infer<typeof runRefiTestSchema>;

export interface RefiTestResult {
  scenarioName: string;
  scenarioType: string;
  testDate: string;
  
  // Inputs
  assumedNoi: number;
  assumedValue: number;
  impliedCapRate: number;
  assumedAllInRate: number;
  
  // Constraints
  maxLtv: number;
  minDscr: number;
  minDebtYield: number;
  
  // Results by constraint
  maxLoanByLtv: number;
  maxLoanByDscr: number;
  maxLoanByDebtYield: number;
  
  // Final result
  constrainedBy: 'ltv' | 'dscr' | 'debt_yield';
  maxLoanProceeds: number;
  
  // Cash analysis
  existingBalance: number;
  cashOutAvailable: number;
  requiresPaydown: boolean;
  paydownRequired: number;
  
  // Post-refi metrics
  newAnnualDebtService: number;
  dscrPostRefi: number;
  debtYieldPostRefi: number;
  ltvPostRefi: number;
  
  // Feasibility
  isFeasible: boolean;
  feasibilityNotes: string;
  
  // Sensitivity
  breakEvenNoi: number;
  breakEvenCapRate: number;
}

/**
 * Run a refinance test scenario
 */
export async function runRefiTest(input: RunRefiTestInput): Promise<RefiTestResult> {
  logger.info('[run_refi_test] Running refi scenario', {
    dealId: input.deal_id,
    scenarioName: input.scenario_name,
  });

  // Calculate value if not provided
  let assumedValue = input.assumed_value ?? 0;
  let impliedCapRate = input.assumed_cap_rate ?? 0;
  
  if (!assumedValue && input.assumed_cap_rate) {
    assumedValue = input.assumed_noi / (input.assumed_cap_rate / 100);
    impliedCapRate = input.assumed_cap_rate;
  } else if (assumedValue && !impliedCapRate) {
    impliedCapRate = (input.assumed_noi / assumedValue) * 100;
  }

  // Rate assumptions
  const baseRate = input.assumed_base_rate ?? 4.25; // Default 10Y Treasury
  const spreadBps = input.assumed_spread_bps;
  const allInRate = baseRate + spreadBps / 100;

  // Calculate max loan by each constraint
  
  // 1. Max by LTV
  const maxLoanByLtv = assumedValue * (input.max_ltv / 100);

  // 2. Max by DSCR
  // Debt constant for 30-year amortization
  const monthlyRate = allInRate / 100 / 12;
  const numPayments = 30 * 12;
  const debtConstant = (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1) * 12;
  const maxLoanByDscr = input.assumed_noi / (input.min_dscr * debtConstant);

  // 3. Max by Debt Yield
  const maxLoanByDebtYield = input.assumed_noi / (input.min_debt_yield / 100);

  // Binding constraint
  const maxLoanProceeds = Math.min(maxLoanByLtv, maxLoanByDscr, maxLoanByDebtYield);
  
  let constrainedBy: 'ltv' | 'dscr' | 'debt_yield';
  if (maxLoanProceeds === maxLoanByLtv) constrainedBy = 'ltv';
  else if (maxLoanProceeds === maxLoanByDscr) constrainedBy = 'dscr';
  else constrainedBy = 'debt_yield';

  // Cash analysis
  const existingBalance = input.existing_balance ?? 0;
  const cashOutAvailable = Math.max(0, maxLoanProceeds - existingBalance);
  const requiresPaydown = maxLoanProceeds < existingBalance;
  const paydownRequired = requiresPaydown ? existingBalance - maxLoanProceeds : 0;

  // Post-refi metrics
  const newAnnualDebtService = maxLoanProceeds * debtConstant;
  const dscrPostRefi = input.assumed_noi / newAnnualDebtService;
  const debtYieldPostRefi = (input.assumed_noi / maxLoanProceeds) * 100;
  const ltvPostRefi = (maxLoanProceeds / assumedValue) * 100;

  // Feasibility check
  const isFeasible = !requiresPaydown && dscrPostRefi >= input.min_dscr;
  
  let feasibilityNotes = '';
  if (requiresPaydown) {
    feasibilityNotes = `Refi NOT feasible without equity. Max proceeds $${(maxLoanProceeds / 1e6).toFixed(2)}M < existing balance $${(existingBalance / 1e6).toFixed(2)}M. Requires $${(paydownRequired / 1e6).toFixed(2)}M paydown.`;
  } else if (cashOutAvailable > 0) {
    feasibilityNotes = `Refi FEASIBLE with $${(cashOutAvailable / 1e6).toFixed(2)}M cash out. Constrained by ${constrainedBy.toUpperCase()}. Post-refi DSCR: ${dscrPostRefi.toFixed(2)}x.`;
  } else {
    feasibilityNotes = `Refi feasible at breakeven (no cash out). Constrained by ${constrainedBy.toUpperCase()}.`;
  }

  // Sensitivity: what NOI needed to hit 75% LTV?
  const targetLoan = assumedValue * 0.75;
  const breakEvenNoi = targetLoan * debtConstant * input.min_dscr;
  
  // What cap rate makes current NOI work?
  const breakEvenCapRate = (input.assumed_noi / (existingBalance / (input.max_ltv / 100))) * 100;

  // Save to database
  await query(
    `INSERT INTO refi_test_scenarios (
      deal_id, scenario_name, scenario_type, test_date,
      assumed_noi, assumed_value, assumed_cap_rate,
      max_ltv, min_dscr, min_debt_yield,
      assumed_spread_bps, assumed_base_rate, assumed_all_in_rate,
      max_loan_by_ltv, max_loan_by_dscr, max_loan_by_dy,
      constrained_by, max_loan_proceeds,
      existing_balance, cash_out_available,
      new_debt_service, dscr_post_refi,
      is_feasible, feasibility_notes
    ) VALUES (
      $1, $2, $3, CURRENT_DATE,
      $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19,
      $20, $21,
      $22, $23
    )`,
    [
      input.deal_id, input.scenario_name, input.scenario_type,
      input.assumed_noi, assumedValue, impliedCapRate,
      input.max_ltv, input.min_dscr, input.min_debt_yield,
      spreadBps, baseRate, allInRate,
      maxLoanByLtv, maxLoanByDscr, maxLoanByDebtYield,
      constrainedBy, maxLoanProceeds,
      existingBalance, cashOutAvailable,
      newAnnualDebtService, dscrPostRefi,
      isFeasible, feasibilityNotes,
    ]
  );

  const result: RefiTestResult = {
    scenarioName: input.scenario_name,
    scenarioType: input.scenario_type,
    testDate: new Date().toISOString().split('T')[0],
    
    assumedNoi: input.assumed_noi,
    assumedValue,
    impliedCapRate,
    assumedAllInRate: allInRate,
    
    maxLtv: input.max_ltv,
    minDscr: input.min_dscr,
    minDebtYield: input.min_debt_yield,
    
    maxLoanByLtv,
    maxLoanByDscr,
    maxLoanByDebtYield,
    
    constrainedBy,
    maxLoanProceeds,
    
    existingBalance,
    cashOutAvailable,
    requiresPaydown,
    paydownRequired,
    
    newAnnualDebtService,
    dscrPostRefi,
    debtYieldPostRefi,
    ltvPostRefi,
    
    isFeasible,
    feasibilityNotes,
    
    breakEvenNoi,
    breakEvenCapRate,
  };

  logger.info('[run_refi_test] Test complete', {
    dealId: input.deal_id,
    isFeasible,
    constrainedBy,
    maxLoanProceeds,
  });

  return result;
}

/**
 * Tool definition for agent registration
 */
export const runRefiTestTool = {
  name: 'run_refi_test',
  description: `Test refinance feasibility at a projected exit point.
Calculates max loan proceeds under LTV, DSCR, and debt yield constraints.
Shows which constraint is binding and whether cash-out is achievable.

Use during underwriting to validate exit assumptions.
Use during operations to test current refi options.`,
  schema: runRefiTestSchema,
  execute: runRefiTest,
};
