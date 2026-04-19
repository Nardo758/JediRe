/**
 * Tool: compute_proforma
 *
 * Computes a multi-year pro forma cash flow projection from deal assumptions,
 * T-12 actuals, and rent roll data. All calculations are local — no API call.
 *
 * Returns year-by-year NOI, debt service, cash flow, IRR estimate, and
 * exit proceeds based on terminal cap rate.
 *
 * Required capability: read:financials
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  purchase_price: z.number().describe('Acquisition price'),
  gross_revenue_year1: z.number().describe('Year 1 gross revenue (from T-12 or rent roll)'),
  noi_year1: z.number().describe('Year 1 NOI'),
  ltv_pct: z.number().default(65).describe('Loan-to-value percentage 0-100'),
  interest_rate_pct: z.number().default(6.5).describe('Interest rate percentage'),
  amortization_years: z.number().default(30).describe('Loan amortization period'),
  annual_rent_growth_pct: z.number().default(3.0).describe('Annual rent growth assumption'),
  annual_expense_growth_pct: z.number().default(2.5).describe('Annual expense growth assumption'),
  exit_cap_rate_pct: z.number().default(5.5).describe('Terminal cap rate for exit valuation'),
  hold_period_years: z.number().default(5).describe('Hold period'),
});

const YearSchema = z.object({
  year: z.number(),
  gross_revenue: z.number(),
  noi: z.number(),
  debt_service: z.number(),
  cash_flow: z.number(),
  cash_on_cash_pct: z.number(),
  dscr: z.number(),
});

const OutputSchema = z.object({
  purchase_price: z.number(),
  loan_amount: z.number(),
  equity_invested: z.number(),
  annual_debt_service: z.number(),
  projections: z.array(YearSchema),
  exit_value: z.number(),
  exit_proceeds_to_equity: z.number(),
  estimated_irr_pct: z.number().nullable(),
  avg_cash_on_cash_pct: z.number(),
  year1_cap_rate_pct: z.number(),
  dscr_year1: z.number(),
});

export const computeProformaTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'compute_proforma',
  description:
    'Compute a multi-year pro forma projection from deal assumptions: year-by-year NOI, debt service, ' +
    'cash flow, DSCR, IRR estimate, and exit proceeds from terminal cap rate.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input) => {
    const ltv = input.ltv_pct / 100;
    const loanAmount = input.purchase_price * ltv;
    const equity = input.purchase_price - loanAmount;
    const monthlyRate = input.interest_rate_pct / 100 / 12;
    const numPayments = input.amortization_years * 12;

    const monthlyDebtService = monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;
    const annualDebtService = monthlyDebtService * 12;

    const rgGrowth = 1 + input.annual_rent_growth_pct / 100;
    const expGrowth = 1 + input.annual_expense_growth_pct / 100;

    let grossRev = input.gross_revenue_year1;
    let noi = input.noi_year1;
    const projections = [];
    const cashFlows: number[] = [-equity];

    for (let yr = 1; yr <= input.hold_period_years; yr++) {
      if (yr > 1) {
        grossRev = grossRev * rgGrowth;
        const expenses = (grossRev - noi) * expGrowth;
        noi = grossRev - expenses;
      }
      const cf = noi - annualDebtService;
      const coc = equity > 0 ? (cf / equity) * 100 : 0;
      const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
      cashFlows.push(cf);
      projections.push({
        year: yr,
        gross_revenue: Math.round(grossRev),
        noi: Math.round(noi),
        debt_service: Math.round(annualDebtService),
        cash_flow: Math.round(cf),
        cash_on_cash_pct: Number(coc.toFixed(2)),
        dscr: Number(dscr.toFixed(2)),
      });
    }

    // Exit value
    const exitNoi = projections[projections.length - 1]?.noi ?? noi;
    const exitValue = exitNoi / (input.exit_cap_rate_pct / 100);
    const remainingLoan = loanAmount * 0.85; // simplified (no full amort schedule)
    const exitProceeds = exitValue - remainingLoan;
    cashFlows[cashFlows.length - 1] = (cashFlows[cashFlows.length - 1] ?? 0) + exitProceeds;

    // Simple IRR via Newton's method
    const irr = estimateIRR(cashFlows);

    const avgCoc = projections.reduce((s, p) => s + p.cash_on_cash_pct, 0) / projections.length;

    return {
      purchase_price: input.purchase_price,
      loan_amount: Math.round(loanAmount),
      equity_invested: Math.round(equity),
      annual_debt_service: Math.round(annualDebtService),
      projections,
      exit_value: Math.round(exitValue),
      exit_proceeds_to_equity: Math.round(exitProceeds),
      estimated_irr_pct: irr != null ? Number(irr.toFixed(2)) : null,
      avg_cash_on_cash_pct: Number(avgCoc.toFixed(2)),
      year1_cap_rate_pct: Number(((input.noi_year1 / input.purchase_price) * 100).toFixed(2)),
      dscr_year1: projections[0]?.dscr ?? 0,
    };
  },
};

function estimateIRR(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  let rate = 0.10;
  for (let i = 0; i < 100; i++) {
    const npv = cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
    const dnpv = cashFlows.reduce((sum, cf, t) => sum - t * cf / Math.pow(1 + rate, t + 1), 0);
    if (Math.abs(dnpv) < 1e-12) return null;
    const next = rate - npv / dnpv;
    if (Math.abs(next - rate) < 1e-7) return next * 100;
    rate = next;
  }
  return rate * 100;
}
