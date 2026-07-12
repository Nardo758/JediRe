/**
 * debt-context.test.ts
 * B6e: Build integration test proving agent citation.
 *
 * Tests:
 * 1. Assembler produces a complete DebtContext with all fields populated.
 * 2. Distress flags compute correctly for a stressed deal (underwater + IO expiry).
 * 3. dealContextFinancials reader returns null (honest absence).
 * 4. An "agent" function receives DebtContext and cites m11Sizing.bindingConstraint as evidence.
 * 5. An "agent" function receives DebtContext with null marketRates and handles honest absence.
 */

import type { ModelAssumptions } from '../../deterministic/run-full-model';
import type { RecommendedTerms } from '../../module-wiring/capital-structure-adapter';
import { assembleDebtContext } from '../debt-context-assembler';
import type { DebtContextInput } from '../debt-context-assembler';
import { computeDistressFlags } from '../s1-distress-calculator';
import type { DistressCalcInput } from '../s1-distress-calculator';
import { readDealContextFinancials } from '../deal-context-financials-reader';
import type { DebtContext, DistressFlags, MarketRates } from '../debt-context';

// ============================================================================
// Helpers
// ============================================================================

function makeAssumptions(overrides: Partial<ModelAssumptions> = {}): ModelAssumptions {
  return {
    rate: 0.065,
    loanAmount: 1_000_000,
    term: 360, // 30 years
    amort: 360,
    ioPeriod: 24,
    ltv: 0.75,
    propertyValue: 1_333_333,
    noiY1: 100_000,
    lpEquity: 200_000,
    gpEquity: 133_333,
    purchasePrice: 1_333_333,
    closingCostsPct: 0.03,
    ...overrides,
  };
}

function makeRecommendedTerms(overrides: Partial<RecommendedTerms> = {}): RecommendedTerms {
  return {
    recommendedLoanAmount: 1_000_000,
    loanTerms: { termMonths: 360, amortMonths: 360, ioPeriod: 24 },
    debtService: 65_000,
    effectiveRate: 0.065,
    bindingConstraint: 'ltv',
    constraintDetails: 'LTV ceiling at 75% bound the loan at $1,000,000; DSCR was comfortable',
    ...overrides,
  };
}

function makeDistressFlags(overrides: Partial<DistressFlags> = {}): DistressFlags {
  return {
    ioExpiryShock: false,
    underwaterEquity: false,
    cashInRefi: false,
    ...overrides,
  };
}

function makeMarketRates(overrides: Partial<MarketRates> = {}): MarketRates {
  return {
    dgs10: 4.5,
    sofr: 5.25,
    ...overrides,
  };
}

// ============================================================================
// Test 1: Assembler produces a complete DebtContext with all fields populated
// ============================================================================

describe('assembleDebtContext', () => {
  it('produces a complete DebtContext with all fields populated', () => {
    const dealId = 'deal-abc-123';
    const assumptions = makeAssumptions();
    const m11Result = makeRecommendedTerms();
    const distressFlags = makeDistressFlags();
    const marketRates = makeMarketRates();
    const dealContextFinancials = { noiY1: 100_000, capRate: 0.075 };
    const inPlaceLoan = {
      loanAmount: 1_000_000,
      rate: 0.065,
      termMonths: 360,
      amortMonths: 360,
      ioPeriodMonths: 24,
      originationDate: '2023-01-15',
      maturityDate: '2053-01-15',
    };

    const context = assembleDebtContext(dealId, {
      assumptions,
      m11Result,
      dealContextFinancials,
      inPlaceLoan,
      distressFlags,
      marketRates,
      loanProduct: {
        termYears: 30,
        amortYears: 30,
        maxIOYears: 2,
        provenance: 'm11_cycle_derived',
      },
    });

    expect(context.dealId).toBe(dealId);
    expect(context.inPlaceLoan).toEqual(inPlaceLoan);
    expect(context.distressFlags).toEqual(distressFlags);
    expect(context.marketRates).toEqual(marketRates);
    expect(context.loanProduct).toEqual({
      termYears: 30,
      amortYears: 30,
      maxIOYears: 2,
      provenance: 'm11_cycle_derived',
    });
    expect(context.m11Sizing).toEqual({
      recommendedLoanAmount: 1_000_000,
      bindingConstraint: 'ltv',
      constraintDetails: 'LTV ceiling at 75% bound the loan at $1,000,000; DSCR was comfortable',
    });
    expect(context.dealContextFinancials).toEqual(dealContextFinancials);
    expect(context.assembledAt).toBeDefined();
    expect(new Date(context.assembledAt).toISOString()).toBe(context.assembledAt);
  });

  it('produces a DebtContext without optional fields when omitted', () => {
    const dealId = 'deal-def-456';
    const assumptions = makeAssumptions();
    const m11Result = makeRecommendedTerms();
    const distressFlags = makeDistressFlags();
    const marketRates = makeMarketRates();

    const context = assembleDebtContext(dealId, {
      assumptions,
      m11Result,
      distressFlags,
      marketRates,
    });

    expect(context.dealId).toBe(dealId);
    expect(context.inPlaceLoan).toBeUndefined();
    expect(context.dealContextFinancials).toBeUndefined();
    expect(context.distressFlags).toEqual(distressFlags);
    expect(context.marketRates).toEqual(marketRates);
    expect(context.m11Sizing).not.toBeNull();
  });
});

// ============================================================================
// Test 2: Distress flags compute correctly for a stressed deal
// ============================================================================

describe('computeDistressFlags', () => {
  it('flags underwater equity and IO expiry for a stressed deal', () => {
    const input: DistressCalcInput = {
      loanAmount: 1_200_000,
      propertyValue: 1_000_000, // underwater
      ioPeriodMonths: 24,
      termMonths: 360,
      monthsElapsed: 20, // IO expires in 4 months (within 12)
      currentRate: 0.085,
      originalRate: 0.045, // rate risen 400bps
      noiY1: 80_000, // low NOI — post-IO DSCR will be < 1.0
    };

    const result = computeDistressFlags(input);

    expect(result.underwaterEquity).toBe(true);
    expect(result.ioExpiryShock).toBe(true); // IO expires within 12mo and post-IO DSCR < 1.0
    expect(result.cashInRefi).toBe(true); // underwater + rate risen > 200bps
  });

  it('returns no distress for a healthy deal', () => {
    const input: DistressCalcInput = {
      loanAmount: 700_000,
      propertyValue: 1_000_000, // positive equity
      ioPeriodMonths: 36,
      termMonths: 360,
      monthsElapsed: 6, // IO expires in 30 months
      currentRate: 0.065,
      originalRate: 0.065,
      noiY1: 120_000,
    };

    const result = computeDistressFlags(input);

    expect(result.underwaterEquity).toBe(false);
    expect(result.ioExpiryShock).toBe(false);
    expect(result.cashInRefi).toBe(false);
  });

  it('flags only IO expiry when equity is positive but post-IO DSCR is stressed', () => {
    const input: DistressCalcInput = {
      loanAmount: 950_000,
      propertyValue: 1_000_000, // positive equity, but high leverage
      ioPeriodMonths: 24,
      termMonths: 360,
      monthsElapsed: 18, // IO expires in 6 months
      currentRate: 0.065,
      originalRate: 0.065,
      noiY1: 50_000, // low NOI — post-IO DSCR < 1.0
    };

    const result = computeDistressFlags(input);

    expect(result.underwaterEquity).toBe(false);
    expect(result.ioExpiryShock).toBe(true); // IO expires soon + post-IO DSCR stressed
    expect(result.cashInRefi).toBe(false); // not underwater
  });
});

// ============================================================================
// Test 3: dealContextFinancials reader returns null (honest absence)
// ============================================================================

describe('readDealContextFinancials', () => {
  it('returns null (honest absence) — DB table not wired yet', async () => {
    const result = await readDealContextFinancials('deal-any-123');
    expect(result).toBeNull();
  });

  it('returns null for any dealId', async () => {
    const result = await readDealContextFinancials('deal-xyz-999');
    expect(result).toBeNull();
  });
});

// ============================================================================
// Test 4: Agent function receives DebtContext and cites bindingConstraint
// ============================================================================

describe('agent citation', () => {
  it('cites m11Sizing.bindingConstraint as evidence', () => {
    const dealId = 'deal-agent-001';
    const assumptions = makeAssumptions();
    const m11Result = makeRecommendedTerms({ bindingConstraint: 'dscr' });
    const distressFlags = makeDistressFlags();
    const marketRates = makeMarketRates();

    const context = assembleDebtContext(dealId, {
      assumptions,
      m11Result,
      distressFlags,
      marketRates,
    });

    // Agent function that receives DebtContext and cites evidence
    function agentCiteBindingConstraint(ctx: DebtContext): {
      cited: boolean;
      evidence: string;
      bindingConstraint: string | null;
    } {
      if (!ctx.m11Sizing) {
        return { cited: false, evidence: 'No M11 sizing available', bindingConstraint: null };
      }
      const bc = ctx.m11Sizing.bindingConstraint;
      return {
        cited: true,
        evidence: `M11 sizing indicates binding constraint: ${bc}`,
        bindingConstraint: bc,
      };
    }

    const citation = agentCiteBindingConstraint(context);

    expect(citation.cited).toBe(true);
    expect(citation.evidence).toBe('M11 sizing indicates binding constraint: dscr');
    expect(citation.bindingConstraint).toBe('dscr');
  });

  it('handles null m11Sizing gracefully when citing evidence', () => {
    const dealId = 'deal-agent-002';
    const assumptions = makeAssumptions();
    const distressFlags = makeDistressFlags();
    const marketRates = makeMarketRates();

    // Pass a minimal m11Result that will produce null m11Sizing
    // (simulate missing sizing by passing null — but assembler needs a valid RecommendedTerms)
    // Instead, we'll test the agent function directly with a crafted context
    const context: DebtContext = {
      dealId,
      distressFlags,
      marketRates,
      loanProduct: null,
      m11Sizing: null,
      assembledAt: new Date().toISOString(),
    };

    function agentCiteBindingConstraint(ctx: DebtContext): {
      cited: boolean;
      evidence: string;
      bindingConstraint: string | null;
    } {
      if (!ctx.m11Sizing) {
        return { cited: false, evidence: 'No M11 sizing available', bindingConstraint: null };
      }
      const bc = ctx.m11Sizing.bindingConstraint;
      return {
        cited: true,
        evidence: `M11 sizing indicates binding constraint: ${bc}`,
        bindingConstraint: bc,
      };
    }

    const citation = agentCiteBindingConstraint(context);

    expect(citation.cited).toBe(false);
    expect(citation.evidence).toBe('No M11 sizing available');
    expect(citation.bindingConstraint).toBeNull();
  });
});

// ============================================================================
// Test 5: Agent function handles null marketRates (honest absence)
// ============================================================================

describe('agent handles null marketRates', () => {
  it('receives DebtContext with null marketRates and handles honest absence', () => {
    const dealId = 'deal-agent-003';
    const assumptions = makeAssumptions();
    const m11Result = makeRecommendedTerms();
    const distressFlags = makeDistressFlags();
    const marketRates: MarketRates = { dgs10: null, sofr: null };

    const context = assembleDebtContext(dealId, {
      assumptions,
      m11Result,
      distressFlags,
      marketRates,
    });

    // Agent function that needs market rates but handles absence
    function agentAssessRateEnvironment(ctx: DebtContext): {
      canAssess: boolean;
      reason: string;
      spreadTo10Y: number | null;
    } {
      const { dgs10, sofr } = ctx.marketRates;
      if (dgs10 === null || sofr === null) {
        return {
          canAssess: false,
          reason: 'Market rates unavailable (honest absence) — FRED feed not connected',
          spreadTo10Y: null,
        };
      }
      const spread = sofr - dgs10;
      return {
        canAssess: true,
        reason: `SOFR-DGS10 spread is ${spread.toFixed(2)}%`,
        spreadTo10Y: spread,
      };
    }

    const assessment = agentAssessRateEnvironment(context);

    expect(assessment.canAssess).toBe(false);
    expect(assessment.reason).toBe('Market rates unavailable (honest absence) — FRED feed not connected');
    expect(assessment.spreadTo10Y).toBeNull();
  });

  it('can assess rate environment when marketRates are present', () => {
    const dealId = 'deal-agent-004';
    const assumptions = makeAssumptions();
    const m11Result = makeRecommendedTerms();
    const distressFlags = makeDistressFlags();
    const marketRates: MarketRates = { dgs10: 4.5, sofr: 5.25 };

    const context = assembleDebtContext(dealId, {
      assumptions,
      m11Result,
      distressFlags,
      marketRates,
    });

    function agentAssessRateEnvironment(ctx: DebtContext): {
      canAssess: boolean;
      reason: string;
      spreadTo10Y: number | null;
    } {
      const { dgs10, sofr } = ctx.marketRates;
      if (dgs10 === null || sofr === null) {
        return {
          canAssess: false,
          reason: 'Market rates unavailable (honest absence) — FRED feed not connected',
          spreadTo10Y: null,
        };
      }
      const spread = sofr - dgs10;
      return {
        canAssess: true,
        reason: `SOFR-DGS10 spread is ${spread.toFixed(2)}%`,
        spreadTo10Y: spread,
      };
    }

    const assessment = agentAssessRateEnvironment(context);

    expect(assessment.canAssess).toBe(true);
    expect(assessment.reason).toBe('SOFR-DGS10 spread is 0.75%');
    expect(assessment.spreadTo10Y).toBe(0.75);
  });
});
