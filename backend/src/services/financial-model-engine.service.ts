import axios from 'axios';
import { getPool } from '../database/connection';
import { getFinancialInputsFromModules, FinancialModuleInputs } from './module-wiring/data-flow-router';
import { dataFlowRouter } from './module-wiring/data-flow-router';
import { logger } from '../utils/logger';

const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

export interface ProFormaAssumptions {
  dealInfo: {
    dealName: string;
    totalUnits: number;
    netRentableSF: number;
    vintage: number;
    address: string;
    city: string;
    state: string;
  };
  modelType: 'development' | 'existing';
  holdPeriod: number;
  unitMix: Array<{
    floorPlan: string;
    unitSize: number;
    beds: number;
    units: number;
    occupied: number;
    vacant: number;
    marketRent: number;
    inPlaceRent: number;
  }>;
  acquisition: {
    purchasePrice: number;
    capRate: number;
    closingCosts: Record<string, number>;
  };
  disposition: {
    exitCapRate: number;
    sellingCosts: number;
    saleNOIMethod: string;
  };
  revenue: {
    rentGrowth: number[];
    lossToLease: number;
    stabilizedOccupancy: number;
    collectionLoss: number;
    otherIncome: Record<string, { perUnitMonth: number; penetration: number }>;
  };
  expenses: Record<string, { amount: number; type: string; growthRate: number }>;
  financing: {
    loanAmount: number;
    loanType: string;
    interestRate: number;
    spread: number;
    term: number;
    amortization: number;
    ioPeriod: number;
    originationFee: number;
    rateCapCost: number;
    prepayPenalty: number;
  };
  capex: {
    lineItems: Array<{ description: string; amount: number }>;
    contingencyPct: number;
    reservesPerUnit: number;
  };
  waterfall: {
    lpShare: number;
    gpShare: number;
    hurdles: Array<{
      hurdleRate: number;
      promoteToGP: number;
      lpSplit: number;
    }>;
    equityContribution: number;
  };
  development?: {
    landCost: number;
    hardCostPerSF: number;
    hardCostContingency: number;
    softCostPct: number;
    developerFee: number;
    constructionPeriod: number;
    leaseUpVelocity: number;
    constructionLoanLTC: number;
    constructionLoanRate: number;
  };
}

export interface FinancialModelResult {
  summary: {
    irr: number;
    equityMultiple: number;
    cashOnCash: number[];
    noiYear1: number;
    noiStabilized: number;
    purchaseCapRate: number;
    yieldOnCost: number;
    exitValue: number;
    netProceeds: number;
    totalEquity: number;
    totalDebt: number;
    dscr: number[];
    debtYield: number[];
  };
  annualCashFlow: Array<{
    year: number;
    potentialRent: number;
    lossToLease: number;
    vacancy: number;
    collectionLoss: number;
    netRentalIncome: number;
    otherIncome: number;
    effectiveGrossRevenue: number;
    operatingExpenses: Record<string, number>;
    totalExpenses: number;
    noi: number;
    replacementReserves: number;
    noiAfterReserves: number;
    debtService: number;
    capitalExpenditures: number;
    beforeTaxCashFlow: number;
    leveredCashFlow: number;
  }>;
  sourcesAndUses: {
    sources: Record<string, number>;
    uses: Record<string, number>;
  };
  debtMetrics: {
    loanAmount: number;
    annualDebtService: number;
    dscr: number;
    ltv: number;
    ltc: number;
    debtYield: number;
  };
  sensitivityAnalysis: {
    exitCapVsHoldPeriod: Array<{
      holdPeriod: number;
      capRate: number;
      irr: number;
      equityMultiple: number;
    }>;
    rentGrowthVsHoldPeriod: Array<{
      holdPeriod: number;
      rentGrowth: number;
      irr: number;
      equityMultiple: number;
    }>;
  };
  waterfallDistributions: Array<{
    year: number;
    lpDistribution: number;
    gpDistribution: number;
    gpPromote: number;
    totalDistribution: number;
  }>;
  developmentSchedule?: Array<{
    month: number;
    hardCostDraw: number;
    softCostDraw: number;
    interestDraw: number;
    loanBalance: number;
    equityDraw: number;
    occupiedUnits: number;
    revenue: number;
  }>;
}

export class FinancialModelEngineService {
  async buildModel(dealId: string, assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    const pool = getPool();

    // PHASE 2: Enhance assumptions with M26 tax and M27 comp data
    const { m26m27ProFormaEnhancer } = await import('./financial-model-engine.m26-m27-enhancer');
    const enhancedAssumptions = await m26m27ProFormaEnhancer.enhanceAssumptions(dealId, assumptions);
    
    // Log enhancement summary
    const enhancementSummary = m26m27ProFormaEnhancer.getEnhancementSummary(enhancedAssumptions);
    logger.info(`M26/M27→M09 Enhancement for deal ${dealId}:\n${enhancementSummary}`);

    const insertResult = await pool.query(
      `INSERT INTO deal_financial_models (deal_id, model_type, assumptions, status) 
       VALUES ($1, $2, $3, 'building') RETURNING id`,
      [dealId, assumptions.modelType, JSON.stringify(enhancedAssumptions)]
    );
    const modelId = insertResult.rows[0].id;

    try {
      const result = await this.callClaudeForModel(enhancedAssumptions);

      await pool.query(
        `UPDATE deal_financial_models SET results = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(result), modelId]
      );

      return result;
    } catch (error: any) {
      await pool.query(
        `UPDATE deal_financial_models SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [error.message, modelId]
      );
      throw error;
    }
  }

  async getLatestModel(dealId: string): Promise<{ assumptions: ProFormaAssumptions; results: FinancialModelResult; createdAt: string } | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT assumptions, results, created_at FROM deal_financial_models 
       WHERE deal_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      assumptions: typeof row.assumptions === 'string' ? JSON.parse(row.assumptions) : row.assumptions,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
      createdAt: row.created_at,
    };
  }

  private async callClaudeForModel(assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(assumptions.modelType);
    const userPrompt = this.buildUserPrompt(assumptions);

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const text = response.data.content?.[0]?.text || '';

    let parsed: FinancialModelResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const rawJson = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

      let depth = 0;
      let start = -1;
      let end = -1;
      for (let i = 0; i < rawJson.length; i++) {
        if (rawJson[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (rawJson[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }

      if (start === -1 || end === -1) {
        throw new Error('Claude did not return valid JSON. Response starts with: ' + text.substring(0, 200));
      }

      try {
        parsed = JSON.parse(rawJson.substring(start, end));
      } catch (parseErr: any) {
        throw new Error('Failed to parse Claude response as JSON: ' + parseErr.message);
      }
    }

    if (!parsed.summary || !parsed.annualCashFlow) {
      throw new Error('Claude response missing required fields (summary, annualCashFlow)');
    }

    return parsed;
  }

  private buildSystemPrompt(modelType: string): string {
    return `You are an expert real estate financial analyst who builds institutional-grade financial models for multifamily real estate investments. You produce precise, detailed financial projections.

You will receive a set of Pro Forma assumptions for a ${modelType === 'development' ? 'ground-up development' : 'stabilized existing asset acquisition'} deal. Your job is to build a complete financial model and return the results as structured JSON.

CRITICAL RULES:
1. All dollar amounts should be rounded to the nearest dollar (no cents).
2. All percentages should be expressed as decimals (0.05 = 5%).
3. Use monthly compounding for interest calculations.
4. Rent growth is applied at the beginning of each operating year.
5. Operating expenses grow at their specified rate (default 3% if not specified).
6. Management fee is calculated as a percentage of Effective Gross Revenue.
7. Replacement reserves grow at inflation rate.
8. IRR should be calculated using the standard XIRR methodology on equity cash flows.
9. DSCR = NOI / Annual Debt Service.
10. Debt Yield = NOI / Loan Amount.
11. For the sensitivity analysis, vary exit cap rate by -50bps, -25bps, 0, +25bps, +50bps and hold period by the given period and ±1 year.
12. For rent growth sensitivity, vary by -1%, -0.5%, 0, +0.5%, +1%.
${modelType === 'development' ? `
13. Construction costs are drawn monthly over the construction period.
14. Lease-up begins after construction completion at the specified velocity (units/month).
15. Operating income during lease-up is proportional to occupied units.
16. Construction loan interest accrues on drawn balance.
` : ''}

Return ONLY valid JSON matching the FinancialModelResult schema. No explanation, no markdown.`;
  }

  private buildUserPrompt(a: ProFormaAssumptions): string {
    const totalUnits = a.dealInfo.totalUnits;
    const avgRent = a.unitMix.length > 0
      ? a.unitMix.reduce((sum, u) => sum + u.marketRent * u.units, 0) / totalUnits
      : 1500;
    const totalSF = a.dealInfo.netRentableSF || a.unitMix.reduce((sum, u) => sum + u.unitSize * u.units, 0);

    const expenseLines = Object.entries(a.expenses).map(([name, e]) =>
      `  - ${name}: $${e.amount}/year, type: ${e.type}, growth: ${(e.growthRate * 100).toFixed(1)}%`
    ).join('\n');

    const otherIncomeLines = Object.entries(a.revenue.otherIncome || {}).map(([name, oi]) =>
      `  - ${name}: $${oi.perUnitMonth}/unit/month, penetration: ${(oi.penetration * 100).toFixed(0)}%`
    ).join('\n');

    const capexLines = (a.capex.lineItems || []).map(item =>
      `  - ${item.description}: $${item.amount}`
    ).join('\n');

    const waterfallLines = (a.waterfall.hurdles || []).map((h, i) =>
      `  Tier ${i + 1}: ${(h.hurdleRate * 100).toFixed(1)}% hurdle, GP promote ${(h.promoteToGP * 100).toFixed(0)}%, LP split ${(h.lpSplit * 100).toFixed(0)}%`
    ).join('\n');

    let prompt = `Build a complete financial model for this ${a.modelType === 'development' ? 'development' : 'existing asset'} deal:

DEAL INFO:
- Name: ${a.dealInfo.dealName}
- Location: ${a.dealInfo.city}, ${a.dealInfo.state}
- Total Units: ${totalUnits}
- Net Rentable SF: ${totalSF}
- Year Built: ${a.dealInfo.vintage}
- Hold Period: ${a.holdPeriod} years

UNIT MIX:
${a.unitMix.map(u => `- ${u.floorPlan}: ${u.units} units, ${u.unitSize} SF, ${u.beds} bed, Market Rent: $${u.marketRent}/mo, In-Place: $${u.inPlaceRent}/mo, Occupied: ${u.occupied}/${u.units}`).join('\n')}

Average Market Rent: $${avgRent.toFixed(0)}/unit/mo ($${(avgRent / (totalSF / totalUnits)).toFixed(2)}/SF)

ACQUISITION:
- Purchase Price: $${a.acquisition.purchasePrice}
- Going-In Cap Rate: ${(a.acquisition.capRate * 100).toFixed(2)}%
- Closing Costs: ${JSON.stringify(a.acquisition.closingCosts)}

DISPOSITION:
- Exit Cap Rate: ${(a.disposition.exitCapRate * 100).toFixed(2)}%
- Selling Costs: ${(a.disposition.sellingCosts * 100).toFixed(2)}% of sale price
- Sale NOI Method: ${a.disposition.saleNOIMethod}

REVENUE ASSUMPTIONS:
- Annual Rent Growth: ${a.revenue.rentGrowth.map(r => (r * 100).toFixed(1) + '%').join(', ')}
- Loss-to-Lease: ${(a.revenue.lossToLease * 100).toFixed(1)}%
- Stabilized Occupancy: ${(a.revenue.stabilizedOccupancy * 100).toFixed(1)}%
- Collection Loss: ${(a.revenue.collectionLoss * 100).toFixed(2)}%
- Other Income:
${otherIncomeLines || '  (none)'}

OPERATING EXPENSES:
${expenseLines || '  (none)'}

FINANCING:
- Loan Amount: $${a.financing.loanAmount}
- Type: ${a.financing.loanType}
- Interest Rate: ${(a.financing.interestRate * 100).toFixed(2)}%
- Spread: ${(a.financing.spread * 100).toFixed(2)}%
- Term: ${a.financing.term} years
- Amortization: ${a.financing.amortization} years
- IO Period: ${a.financing.ioPeriod} months
- Origination Fee: ${(a.financing.originationFee * 100).toFixed(2)}%
- Rate Cap Cost: $${a.financing.rateCapCost}
- Prepayment Penalty: ${(a.financing.prepayPenalty * 100).toFixed(2)}%

CAPITAL EXPENDITURES:
${capexLines || '  (none)'}
- Contingency: ${(a.capex.contingencyPct * 100).toFixed(0)}%
- Replacement Reserves: $${a.capex.reservesPerUnit}/unit/year

WATERFALL:
- Total Equity: $${a.waterfall.equityContribution}
- LP/GP Split: ${(a.waterfall.lpShare * 100).toFixed(0)}/${(a.waterfall.gpShare * 100).toFixed(0)}
${waterfallLines || '  No promote structure'}`;

    if (a.modelType === 'development' && a.development) {
      prompt += `

DEVELOPMENT SPECIFIC:
- Land Cost: $${a.development.landCost}
- Hard Cost: $${a.development.hardCostPerSF}/SF
- Hard Cost Contingency: ${(a.development.hardCostContingency * 100).toFixed(0)}%
- Soft Cost: ${(a.development.softCostPct * 100).toFixed(1)}% of hard cost
- Developer Fee: ${(a.development.developerFee * 100).toFixed(1)}% of cost
- Construction Period: ${a.development.constructionPeriod} months
- Lease-Up Velocity: ${a.development.leaseUpVelocity} units/month
- Construction Loan LTC: ${(a.development.constructionLoanLTC * 100).toFixed(0)}%
- Construction Loan Rate: ${(a.development.constructionLoanRate * 100).toFixed(2)}%`;
    }

    prompt += `

Now build the complete model and return the FinancialModelResult JSON with:
1. summary (IRR, equity multiple, CoC by year, NOI, cap rates, exit value, debt metrics)
2. annualCashFlow (one object per year with full income statement lines)
3. sourcesAndUses
4. debtMetrics
5. sensitivityAnalysis (exitCapVsHoldPeriod grid, rentGrowthVsHoldPeriod grid)
6. waterfallDistributions (by year)
${a.modelType === 'development' ? '7. developmentSchedule (monthly during construction + lease-up)' : ''}

Return ONLY valid JSON. No markdown, no explanation.`;

    return prompt;
  }

  async getUpstreamModuleInputs(dealId: string): Promise<FinancialModuleInputs> {
    return getFinancialInputsFromModules(dealId);
  }

  publishResultsToDataFlow(dealId: string, result: FinancialModelResult): void {
    dataFlowRouter.publishModuleData('M09', dealId, {
      noi: result.summary.noiYear1,
      irr: result.summary.irr,
      coc_return: result.summary.cashOnCash?.[0] ?? null,
      cash_flow_projections: result.annualCashFlow,
      equity_multiple: result.summary.equityMultiple,
      cap_rate: result.summary.purchaseCapRate,
    });
    logger.info('Financial model results published to data flow router', { dealId });
  }
}

export const financialModelEngine = new FinancialModelEngineService();
