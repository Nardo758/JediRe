/**
 * fetch_debt_assumptions Tool
 * 
 * Retrieves typical debt terms by loan type and market.
 * Used by CashFlow agent to model realistic financing scenarios.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const fetchDebtAssumptionsSchema = z.object({
  state: z.string().optional().describe('State code (e.g., TX, GA)'),
  msa: z.string().optional().describe('MSA name'),
  loan_type: z.enum(['agency', 'cmbs', 'bank', 'bridge', 'life_co', 'debt_fund']).optional(),
  asset_class: z.enum(['A', 'B', 'C']).optional(),
  loan_amount_min: z.number().optional().describe('Minimum loan amount for filtering'),
  loan_amount_max: z.number().optional().describe('Maximum loan amount for filtering'),
});

export type FetchDebtAssumptionsInput = z.infer<typeof fetchDebtAssumptionsSchema>;

export interface DebtAssumptionsResult {
  loanType: string;
  typicalTerms: {
    maxLtv: number;
    minDscr: number;
    minDebtYield: number;
    typicalSpreadBps: number;
    typicalTermYears: number;
    amortizationYears: number;
    ioPeriodMonths: number;
    prepaymentType: string;
  };
  currentRateEnvironment: {
    baseRate: string;
    currentBaseRate: number;
    allInRate: number;
  };
  marketAdjustments: {
    factor: string;
    adjustment: string;
  }[];
  recentDeals: {
    closingDate: string;
    loanAmount: number;
    ltv: number;
    rate: number;
    lender: string;
  }[];
  sampleCount: number;
}

/**
 * Fetch debt assumptions for underwriting
 */
export async function fetchDebtAssumptions(
  input: FetchDebtAssumptionsInput
): Promise<DebtAssumptionsResult[]> {
  logger.info('[fetch_debt_assumptions] Fetching debt terms', input);

  // Build conditions for filtering historical debt
  const conditions: string[] = ['dp.status IN (\'active\', \'refinanced\', \'paid_off\')'];
  const params: unknown[] = [];

  if (input.loan_type) {
    params.push(input.loan_type);
    conditions.push(`dp.loan_type = $${params.length}`);
  }

  // Get historical debt data grouped by loan type
  const historicalQuery = `
    SELECT 
      dp.loan_type,
      AVG(dp.ltv_at_origination) as avg_ltv,
      AVG(dp.current_rate) as avg_rate,
      AVG(dp.spread_bps) as avg_spread,
      AVG(EXTRACT(YEAR FROM AGE(dp.maturity_date, dp.origination_date))) as avg_term,
      AVG(dp.amortization_years) as avg_amort,
      AVG(dp.io_period_months) as avg_io,
      AVG(dp.dscr_covenant) as avg_dscr_cov,
      AVG(dp.debt_yield_covenant) as avg_dy_cov,
      MODE() WITHIN GROUP (ORDER BY dp.prepayment_type) as common_prepay,
      COUNT(*) as sample_count
    FROM debt_positions dp
    JOIN deals d ON d.id = dp.deal_id
    WHERE ${conditions.join(' AND ')}
      AND dp.origination_date >= CURRENT_DATE - INTERVAL '3 years'
    GROUP BY dp.loan_type
  `;

  const historicalResult = await query(historicalQuery, params);

  // Get recent deals for context
  const recentDealsQuery = `
    SELECT 
      dp.loan_type,
      dp.origination_date,
      dp.original_principal,
      dp.ltv_at_origination,
      dp.current_rate,
      dp.lender_name
    FROM debt_positions dp
    WHERE dp.status IN ('active', 'refinanced')
      AND dp.origination_date >= CURRENT_DATE - INTERVAL '12 months'
    ORDER BY dp.origination_date DESC
    LIMIT 20
  `;

  const recentResult = await query(recentDealsQuery, []);

  // Default market assumptions if no historical data
  const defaultTermsByType: Record<string, DebtAssumptionsResult['typicalTerms']> = {
    agency: {
      maxLtv: 75,
      minDscr: 1.25,
      minDebtYield: 8.0,
      typicalSpreadBps: 180,
      typicalTermYears: 10,
      amortizationYears: 30,
      ioPeriodMonths: 0,
      prepaymentType: 'yield_maintenance',
    },
    cmbs: {
      maxLtv: 70,
      minDscr: 1.30,
      minDebtYield: 9.0,
      typicalSpreadBps: 220,
      typicalTermYears: 10,
      amortizationYears: 30,
      ioPeriodMonths: 24,
      prepaymentType: 'defeasance',
    },
    bridge: {
      maxLtv: 80,
      minDscr: 1.10,
      minDebtYield: 7.0,
      typicalSpreadBps: 350,
      typicalTermYears: 3,
      amortizationYears: 0, // IO only
      ioPeriodMonths: 36,
      prepaymentType: 'open',
    },
    bank: {
      maxLtv: 65,
      minDscr: 1.35,
      minDebtYield: 10.0,
      typicalSpreadBps: 200,
      typicalTermYears: 5,
      amortizationYears: 25,
      ioPeriodMonths: 12,
      prepaymentType: 'step_down',
    },
    life_co: {
      maxLtv: 65,
      minDscr: 1.35,
      minDebtYield: 9.5,
      typicalSpreadBps: 160,
      typicalTermYears: 10,
      amortizationYears: 30,
      ioPeriodMonths: 0,
      prepaymentType: 'yield_maintenance',
    },
    debt_fund: {
      maxLtv: 75,
      minDscr: 1.15,
      minDebtYield: 7.5,
      typicalSpreadBps: 400,
      typicalTermYears: 3,
      amortizationYears: 0,
      ioPeriodMonths: 36,
      prepaymentType: 'open',
    },
  };

  // Current rate environment (would ideally come from a rate feed)
  const rateEnvironment = {
    SOFR: 4.85,
    '10Y_Treasury': 4.25,
    Prime: 8.50,
  };

  // Build results
  const results: DebtAssumptionsResult[] = [];
  const loanTypes = input.loan_type 
    ? [input.loan_type] 
    : ['agency', 'cmbs', 'bridge', 'bank', 'life_co', 'debt_fund'];

  for (const loanType of loanTypes) {
    const historical = (historicalResult.rows as Record<string, unknown>[]).find(
      r => r.loan_type === loanType
    );
    const defaults = defaultTermsByType[loanType];

    // Determine base rate for this loan type
    let baseRate: string;
    let currentBaseRate: number;
    if (['bridge', 'debt_fund'].includes(loanType)) {
      baseRate = 'SOFR';
      currentBaseRate = rateEnvironment.SOFR;
    } else {
      baseRate = '10Y Treasury';
      currentBaseRate = rateEnvironment['10Y_Treasury'];
    }

    const spreadBps = historical?.avg_spread 
      ? Number(historical.avg_spread) 
      : defaults.typicalSpreadBps;

    const typicalTerms = {
      maxLtv: historical?.avg_ltv ? Math.round(Number(historical.avg_ltv)) : defaults.maxLtv,
      minDscr: historical?.avg_dscr_cov ? Number(historical.avg_dscr_cov) : defaults.minDscr,
      minDebtYield: historical?.avg_dy_cov ? Number(historical.avg_dy_cov) : defaults.minDebtYield,
      typicalSpreadBps: Math.round(spreadBps),
      typicalTermYears: historical?.avg_term ? Math.round(Number(historical.avg_term)) : defaults.typicalTermYears,
      amortizationYears: historical?.avg_amort ? Math.round(Number(historical.avg_amort)) : defaults.amortizationYears,
      ioPeriodMonths: historical?.avg_io ? Math.round(Number(historical.avg_io)) : defaults.ioPeriodMonths,
      prepaymentType: (historical?.common_prepay as string) ?? defaults.prepaymentType,
    };

    // Market adjustments
    const marketAdjustments: { factor: string; adjustment: string }[] = [];
    
    if (input.asset_class === 'C') {
      marketAdjustments.push({ factor: 'Class C property', adjustment: '-5% LTV, +50bps spread' });
    }
    if (input.msa?.toLowerCase().includes('secondary')) {
      marketAdjustments.push({ factor: 'Secondary market', adjustment: '+25-50bps spread' });
    }

    // Recent deals of this type
    const recentDeals = (recentResult.rows as Record<string, unknown>[])
      .filter(r => r.loan_type === loanType)
      .slice(0, 5)
      .map(r => ({
        closingDate: new Date(r.origination_date as string).toISOString().split('T')[0],
        loanAmount: Number(r.original_principal),
        ltv: Number(r.ltv_at_origination ?? 0),
        rate: Number(r.current_rate),
        lender: String(r.lender_name ?? 'Unknown'),
      }));

    results.push({
      loanType,
      typicalTerms,
      currentRateEnvironment: {
        baseRate,
        currentBaseRate,
        allInRate: currentBaseRate + spreadBps / 100,
      },
      marketAdjustments,
      recentDeals,
      sampleCount: Number(historical?.sample_count ?? 0),
    });
  }

  logger.info('[fetch_debt_assumptions] Returning assumptions', {
    loanTypes: results.map(r => r.loanType),
  });

  return results;
}

/**
 * Tool definition for agent registration
 */
export const fetchDebtAssumptionsTool = {
  name: 'fetch_debt_assumptions',
  description: `Retrieve typical debt financing terms by loan type and market.
Returns max LTV, min DSCR, spreads, terms, and current rate environment.
Use to model realistic debt scenarios in underwriting.

Loan types: agency (Fannie/Freddie), cmbs, bridge, bank, life_co, debt_fund`,
  schema: fetchDebtAssumptionsSchema,
  execute: fetchDebtAssumptions,
};
