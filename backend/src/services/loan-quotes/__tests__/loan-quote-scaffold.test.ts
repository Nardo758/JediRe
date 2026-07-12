/**
 * loan-quote-scaffold.test.ts
 * Integration tests for the LOAN QUOTE MANAGEMENT design stub.
 */

import type {
  LoanQuote,
  LoanQuoteStore,
  Adjustment,
  SpreadMatrix,
  PrepayStructure,
  BrokerClaimsProvenance,
} from '../loan-quote.types';
import { computeAllInRate, termIndex } from '../pricing-resolver';
import type { PricingInput } from '../pricing-resolver';
import {
  fetchForwardCurve,
  interpolateRate,
  isStale,
  getTermIndex,
} from '../forward-curve';
import type { ForwardCurve, TenorPoint } from '../forward-curve';
import { compareQuotes, flagStaleQuotes } from '../quote-comparison';
import type { QuoteComparisonInput } from '../quote-comparison';
import { extractRateSheet } from '../intake/rate-sheet-extractor';
import type { RateSheetDocument } from '../intake/rate-sheet-extractor';
import { processEmailQuote } from '../intake/email-intake';
import type { FinancingEmail } from '../intake/email-intake';
import { createManualQuote } from '../intake/manual-entry';
import type { ManualQuoteForm } from '../intake/manual-entry';
import type { DebtContext } from '../../debt-advisor/debt-context';

function makeSpreadMatrix(min: number, max: number): SpreadMatrix {
  return {
    program: 'Fannie DUS',
    grid: {
      'Tier-3': {
        7: { min, max },
      },
    },
  };
}

function makeQuote(
  id: string,
  lender: string,
  spreadMin: number,
  spreadMax: number,
  overrides?: Partial<LoanQuote>
): LoanQuote {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    id,
    orgId: 'org_acme',
    lender,
    program: 'Fannie DUS',
    quoteDate: now.split('T')[0],
    expires: futureDate,
    indexBasis: 'treasury_7yr',
    rateType: 'fixed',
    spreadMatrix: makeSpreadMatrix(spreadMin, spreadMax),
    adjustments: [],
    prepayStructure: { type: 'yield_maintenance', terms: {} },
    brokerClaims: { source: lender, date: now.split('T')[0], confidence: 0.9 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMockCurve(): ForwardCurve {
  return {
    tenorPoints: [
      { tenorYears: 5, rate: 0.0427, seriesCode: 'DGS5' },
      { tenorYears: 7, rate: 0.0424, seriesCode: 'DGS7' },
      { tenorYears: 10, rate: 0.0431, seriesCode: 'DGS10' },
      { tenorYears: 30, rate: 0.0445, seriesCode: 'DGS30' },
    ],
    source: 'FRED:DGS5,DGS7,DGS10,DGS30',
    fetchedAt: new Date().toISOString(),
    staleThresholdHours: 24,
    indexBasis: 'treasury',
  };
}

describe('Component 1: LoanQuote types', () => {
  test('LoanQuote can be instantiated with all required fields', () => {
    const provenance: BrokerClaimsProvenance = {
      source: 'NewPoint',
      date: '2024-06-25',
      confidence: 0.95,
    };

    const spreadMatrix: SpreadMatrix = {
      program: 'Fannie DUS',
      grid: {
        'Tier-3': {
          7: { min: 0.0126, max: 0.0136 },
          10: { min: 0.0130, max: 0.0140 },
        },
      },
    };

    const adjustments: Adjustment[] = [
      { name: 'Green', bps: -20, provenance: 'sheet:green' },
      { name: 'MAH', bps: -30, provenance: 'sheet:maht' },
    ];

    const prepay: PrepayStructure = {
      type: 'yield_maintenance',
      terms: { periodMonths: 84 },
    };

    const quote: LoanQuote = {
      id: 'quote_test_001',
      orgId: 'org_acme',
      lender: 'NewPoint',
      program: 'Fannie DUS',
      quoteDate: '2024-06-25',
      expires: '2024-07-02',
      indexBasis: 'treasury_7yr',
      rateType: 'fixed',
      spreadMatrix,
      adjustments,
      prepayStructure: prepay,
      brokerClaims: provenance,
      createdAt: '2024-06-25T00:00:00Z',
      updatedAt: '2024-06-25T00:00:00Z',
    };

    expect(quote.id).toBe('quote_test_001');
    expect(quote.orgId).toBe('org_acme');
    expect(quote.lender).toBe('NewPoint');
    expect(quote.program).toBe('Fannie DUS');
    expect(quote.rateType).toBe('fixed');
    expect(quote.indexBasis).toBe('treasury_7yr');
    expect(quote.spreadMatrix.grid['Tier-3'][7]).toEqual({ min: 0.0126, max: 0.0136 });
    expect(quote.adjustments).toHaveLength(2);
    expect(quote.brokerClaims.confidence).toBe(0.95);
    expect(quote.prepayStructure.type).toBe('yield_maintenance');
  });

  test('LoanQuoteStore interface is defined (type-only, no runtime check)', () => {
    const storeShape: Partial<LoanQuoteStore> = {
      list: async () => [],
    };
    expect(storeShape.list).toBeDefined();
  });
});

describe('Component 2a: Pricing resolver', () => {
  test('computeAllInRate returns PricingResult with all-in rate', () => {
    const quote = makeQuote('quote_001', 'NewPoint', 0.0126, 0.0136);
    const curve = makeMockCurve();

    const input: PricingInput = {
      dealAssumptions: {
        purchasePrice: 5_000_000,
        noiY1: 500_000,
        targetLtv: 0.65,
      },
      targetTier: 'Tier-3',
      targetTerm: 7,
      targetProgram: 'Fannie DUS',
      quote,
      curve,
    };

    const result = computeAllInRate(input);

    expect(result.allInRate).not.toBeNull();
    if (result.allInRate !== null) {
      expect(result.allInRate).toBeGreaterThan(0);
      expect(result.termIndex).toBeCloseTo(0.0424, 4);
      expect(result.spread).toBeCloseTo(0.0131, 4);
      expect(result.adjustments).toHaveLength(0);
      expect(result.totalBps).toBe(0);
      expect(result.provenanceChain).toBeDefined();
      expect(result.provenanceChain.length).toBeGreaterThanOrEqual(4);
    }
  });

  test('computeAllInRate returns honest-absence when matrix tier is missing', () => {
    const quote: LoanQuote = {
      ...makeQuote('quote_002', 'NewPoint', 0.0126, 0.0136),
      spreadMatrix: { program: 'Fannie DUS', grid: {} },
    };
    const curve = makeMockCurve();

    const input: PricingInput = {
      dealAssumptions: {
        purchasePrice: 5_000_000,
        noiY1: 500_000,
        targetLtv: 0.65,
      },
      targetTier: 'Tier-3',
      targetTerm: 7,
      targetProgram: 'Fannie DUS',
      quote,
      curve,
    };

    const result = computeAllInRate(input);
    expect(result.allInRate).toBeNull();
    expect(result.failureReason).toContain('Spread matrix lacks tier');
  });
});

describe('Component 2b: Forward curve', () => {
  test('interpolateRate linearly interpolates between 7yr and 10yr', () => {
    const curve = makeMockCurve();
    const rate = interpolateRate(8, curve);
    expect(rate).toBeCloseTo(0.042633, 5);
  });

  test('interpolateRate returns exact match for 5yr tenor point', () => {
    const curve = makeMockCurve();
    const rate = interpolateRate(5, curve);
    expect(rate).toBe(0.0427);
  });

  test('interpolateRate returns exact match for 10yr tenor point', () => {
    const curve = makeMockCurve();
    const rate = interpolateRate(10, curve);
    expect(rate).toBe(0.0431);
  });

  test('interpolateRate returns null below minimum tenor (no extrapolation)', () => {
    const curve = makeMockCurve();
    const rate = interpolateRate(3, curve);
    expect(rate).toBeNull();
  });

  test('fetchForwardCurve returns a ForwardCurve with tenor points', async () => {
    const curve = await fetchForwardCurve();
    expect(curve.tenorPoints).toHaveLength(4);
    expect(curve.source).toContain('FRED');
    expect(curve.staleThresholdHours).toBe(24);
    expect(new Date(curve.fetchedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('Component 2b: Curve staleness', () => {
  test('isStale returns true for old curve', () => {
    const staleCurve: ForwardCurve = {
      ...makeMockCurve(),
      fetchedAt: '2023-01-01T00:00:00Z',
    };
    expect(isStale(staleCurve)).toBe(true);
  });

  test('isStale returns false for freshly fetched curve', () => {
    const freshCurve: ForwardCurve = {
      ...makeMockCurve(),
      fetchedAt: new Date().toISOString(),
    };
    expect(isStale(freshCurve)).toBe(false);
  });

  test('getTermIndex returns null when curve is stale', () => {
    const staleCurve: ForwardCurve = {
      ...makeMockCurve(),
      fetchedAt: '2023-01-01T00:00:00Z',
    };
    const result = getTermIndex(7, staleCurve, 'treasury_7yr');
    expect(result).toBeNull();
  });

  test('computeAllInRate returns honest-absence when curve is stale', () => {
    const quote = makeQuote('quote_003', 'NewPoint', 0.0126, 0.0136);
    const staleCurve: ForwardCurve = {
      ...makeMockCurve(),
      fetchedAt: '2023-01-01T00:00:00Z',
    };

    const input: PricingInput = {
      dealAssumptions: {
        purchasePrice: 5_000_000,
        noiY1: 500_000,
        targetLtv: 0.65,
      },
      targetTier: 'Tier-3',
      targetTerm: 7,
      targetProgram: 'Fannie DUS',
      quote,
      curve: staleCurve,
    };

    const result = computeAllInRate(input);
    expect(result.allInRate).toBeNull();
    expect(result.failureReason).toContain('stale');
  });
});

describe('Component 3: Quote comparison', () => {
  test('compareQuotes ranks 3 quotes by lowest all-in', () => {
    const quotes = [
      makeQuote('q_high', 'LenderHigh', 0.0200, 0.0220),
      makeQuote('q_low', 'LenderLow', 0.0100, 0.0110),
      makeQuote('q_mid', 'LenderMid', 0.0150, 0.0160),
    ];

    const input: QuoteComparisonInput = {
      deal: {
        purchasePrice: 5_000_000,
        noiY1: 500_000,
        targetLtv: 0.65,
        preferredTerm: 7,
        preferredProgram: 'Fannie DUS',
      },
      quotes,
      objective: 'lowest_all_in',
    };

    const result = compareQuotes(input);

    expect(result.rankedQuotes).toHaveLength(3);
    expect(result.rankedQuotes[0].quote.id).toBe('q_low');
    expect(result.rankedQuotes[1].quote.id).toBe('q_mid');
    expect(result.rankedQuotes[2].quote.id).toBe('q_high');

    expect(result.rankedQuotes[0].rank).toBe(1);
    expect(result.rankedQuotes[1].rank).toBe(2);
    expect(result.rankedQuotes[2].rank).toBe(3);

    expect(result.staleQuotes).toHaveLength(0);
    expect(result.failedQuotes).toHaveLength(0);
  });
});

describe('Component 3: Stale quote handling', () => {
  test('flagStaleQuotes returns quotes past expiry', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const quotes = [
      makeQuote('q_stale', 'StaleLender', 0.0100, 0.0110, { expires: pastDate }),
      makeQuote('q_fresh', 'FreshLender', 0.0150, 0.0160, { expires: futureDate }),
    ];

    const stale = flagStaleQuotes(quotes);
    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe('q_stale');
  });

  test('compareQuotes excludes stale quotes from ranking', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const quotes = [
      makeQuote('q_stale', 'StaleLender', 0.0100, 0.0110, { expires: pastDate }),
      makeQuote('q_fresh', 'FreshLender', 0.0150, 0.0160, { expires: futureDate }),
    ];

    const input: QuoteComparisonInput = {
      deal: {
        purchasePrice: 5_000_000,
        noiY1: 500_000,
        targetLtv: 0.65,
        preferredTerm: 7,
        preferredProgram: 'Fannie DUS',
      },
      quotes,
      objective: 'lowest_all_in',
    };

    const result = compareQuotes(input);

    expect(result.staleQuotes).toHaveLength(1);
    expect(result.staleQuotes[0].id).toBe('q_stale');
    expect(result.rankedQuotes).toHaveLength(1);
    expect(result.rankedQuotes[0].quote.id).toBe('q_fresh');
  });
});

describe('Component 4: Intake channels', () => {
  test('extractRateSheet returns quote with broker_claims provenance', async () => {
    const doc: RateSheetDocument = {
      documentId: 'doc_001',
      fileName: 'NewPoint_Multifamily_2024-06-25.pdf',
      mimeType: 'application/pdf',
      orgId: 'org_acme',
      uploadedBy: 'user_42',
      uploadedAt: new Date().toISOString(),
    };

    const quote = await extractRateSheet(doc);

    expect(quote.lender).toBe('NewPoint');
    expect(quote.program).toBe('Fannie DUS');
    expect(quote.orgId).toBe('org_acme');
    expect(quote.brokerClaims).toBeDefined();
    expect(quote.brokerClaims.source).toContain('rate_sheet_upload');
    expect(quote.brokerClaims.confidence).toBe(0.7);
    expect(quote.spreadMatrix).toBeDefined();
    expect(quote.spreadMatrix.grid['Tier-3'][7]).toEqual({ min: 0.0126, max: 0.0136 });
  });

  test('processEmailQuote returns quote with email sender provenance', async () => {
    const email: FinancingEmail = {
      messageId: 'msg_001',
      from: 'broker@example.com',
      fromName: 'Broker Bob',
      subject: 'NewPoint Rate Sheet - June 25',
      receivedAt: '2024-06-25T10:00:00Z',
      orgId: 'org_acme',
      attachments: [
        {
          attachmentId: 'att_001',
          fileName: 'rate_sheet.pdf',
          mimeType: 'application/pdf',
        },
      ],
      bodyText: 'Please see attached rate sheet.',
    };

    const quote = await processEmailQuote(email);

    expect(quote.lender).toBe('Broker Bob');
    expect(quote.orgId).toBe('org_acme');
    expect(quote.brokerClaims.source).toContain('email');
    expect(quote.brokerClaims.confidence).toBe(0.9);
  });

  test('createManualQuote returns quote with manual entry provenance', () => {
    const form: ManualQuoteForm = {
      orgId: 'org_acme',
      enteredBy: 'user_42',
      lender: 'Phone Quote Bank',
      program: 'Bank Term',
      quoteDate: '2024-06-25',
      expires: '2024-07-02',
      indexBasis: 'SOFR',
      rateType: 'floating',
      spreadMatrix: {
        program: 'Bank Term',
        grid: {
          'Tier-1': {
            5: { min: 0.0200, max: 0.0220 },
          },
        },
      },
      adjustments: [{ name: 'Relationship', bps: -10, provenance: 'phone_call' }],
      prepayStructure: { type: 'step_down', terms: { schedule: [{ year: 1, penaltyPct: 0.03 }] } },
    };

    const quote = createManualQuote(form);

    expect(quote.lender).toBe('Phone Quote Bank');
    expect(quote.rateType).toBe('floating');
    expect(quote.indexBasis).toBe('SOFR');
    expect(quote.brokerClaims.source).toContain('manual');
    expect(quote.brokerClaims.confidence).toBe(1.0);
    expect(quote.prepayStructure.type).toBe('step_down');
  });
});

describe('Integration: DebtContext carries loanQuotes', () => {
  test('DebtContext can include loanQuotes array', () => {
    const quote = makeQuote('quote_ctx_001', 'NewPoint', 0.0126, 0.0136);

    const ctx: DebtContext = {
      dealId: 'deal_123',
      distressFlags: {
        ioExpiryShock: false,
        underwaterEquity: false,
        cashInRefi: false,
      },
      marketRates: { dgs10: 0.0431, sofr: 0.0531 },
      loanProduct: {
        termYears: 7,
        amortYears: 30,
        maxIOYears: 5,
        provenance: 'test',
      },
      m11Sizing: {
        recommendedLoanAmount: 3_250_000,
        bindingConstraint: 'DSCR',
        ltvCap: 3_500_000,
        dscrCap: 3_250_000,
      },
      loanQuotes: [quote],
      assembledAt: new Date().toISOString(),
    };

    expect(ctx.loanQuotes).toBeDefined();
    expect(ctx.loanQuotes).toHaveLength(1);
    expect(ctx.loanQuotes![0].lender).toBe('NewPoint');
    expect(ctx.loanQuotes![0].orgId).toBe('org_acme');
  });

  test('DebtContext works without loanQuotes (backward compatibility)', () => {
    const ctx: DebtContext = {
      dealId: 'deal_124',
      distressFlags: {
        ioExpiryShock: false,
        underwaterEquity: false,
        cashInRefi: false,
      },
      marketRates: { dgs10: 0.0431, sofr: null },
      loanProduct: null,
      m11Sizing: null,
      assembledAt: new Date().toISOString(),
    };

    expect(ctx.loanQuotes).toBeUndefined();
  });
});
