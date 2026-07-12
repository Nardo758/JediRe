/**
 * B5: R3 + R5 — IO from lease-up profile + binding constraint reported
 *
 * Proves:
 * 1. Lease-up deal with stabilization at month 18 → IO = 18 months (capped by product maxIO)
 * 2. Existing deal (no monthsToStabilize) → IO falls back to LTV-tier
 * 3. User override ioPeriod=36 → wins regardless of stabilization
 * 4. Binding constraint reported: ltv binds, dscr binds, io binds, user_override binds
 */

import { getRecommendedTerms } from '../../module-wiring/capital-structure-adapter';

describe('B5: R3 — IO from lease-up profile (getRecommendedTerms)', () => {
  const BASE = {
    noiY1: 500_000,
    purchasePrice: 10_000_000,
    ltv: 0.75,
    rate: 0.065,
  };

  test('lease-up deal: IO = monthsToStabilize (capped by product maxIO)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      monthsToStabilize: 18,
      dealContext: { lenderType: 'bridge', dealMode: 'lease_up' }, // bridge maxIOYears = 3 = 36 months
    });
    // Production: lease-up IO = min(monthsToStabilize, maxIO*12) = min(18, 36) = 18
    expect(terms.loanTerms.ioPeriod).toBe(18);
    expect(terms.bindingConstraint).toBe('io');
  });

  test('existing deal (no monthsToStabilize): IO falls back to LTV tier (LTV > 0.75 = 24)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.80,
    });
    expect(terms.loanTerms.ioPeriod).toBe(24);
  });

  test('existing deal (no monthsToStabilize): IO falls back to LTV tier (0.65 < LTV <= 0.75 = 12)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.70,
    });
    expect(terms.loanTerms.ioPeriod).toBe(12);
  });

  test('existing deal (no monthsToStabilize): IO falls back to LTV tier (LTV <= 0.65 = 0)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.60,
    });
    expect(terms.loanTerms.ioPeriod).toBe(0);
  });

  test('user override ioPeriodMonths wins over lease-up profile', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      monthsToStabilize: 18,
      ioPeriodMonths: 36,
      dealContext: { lenderType: 'bridge', dealMode: 'lease_up' },
    });
    expect(terms.loanTerms.ioPeriod).toBe(36);
    // Production: user_override only when overriding lease-up profile
    expect(terms.bindingConstraint).toBe('user_override');
  });

  test('user override ioPeriodMonths wins over LTV tier', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.60,
      ioPeriodMonths: 12,
    });
    expect(terms.loanTerms.ioPeriod).toBe(12);
    expect(terms.bindingConstraint).toBe('user_override');
  });

  test('IO capped by agency product maxIOYears = 0 years (0 months)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.60,
      monthsToStabilize: 72, // 72 months to stabilize
      dealContext: { lenderType: 'agency', dealMode: 'lease_up' },
    });
    // agency maxIOYears = 0 = 0 months cap → min(72, 0) = 0
    expect(terms.loanTerms.ioPeriod).toBe(0);
    expect(terms.bindingConstraint).toBe('io');
  });

  test('IO capped by bank product maxIOYears = 1 year (12 months)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.60,
      monthsToStabilize: 48,
      dealContext: { lenderType: 'bank', dealMode: 'lease_up' },
    });
    // bank maxIOYears = 1 = 12 months cap → min(48, 12) = 12
    expect(terms.loanTerms.ioPeriod).toBe(12);
    expect(terms.bindingConstraint).toBe('io');
  });

  test('IO capped by bridge product maxIOYears = 3 years (36 months)', () => {
    const terms = getRecommendedTerms({
      ...BASE,
      ltv: 0.60,
      monthsToStabilize: 48,
      dealContext: { lenderType: 'bridge', dealMode: 'lease_up' },
    });
    // bridge maxIOYears = 3 = 36 months cap → min(48, 36) = 36
    expect(terms.loanTerms.ioPeriod).toBe(36);
    expect(terms.bindingConstraint).toBe('io');
  });
});

describe('B5: R5 — Binding constraint reported (getRecommendedTerms)', () => {
  test('LTV binds when DSCR cap > LTV cap (high NOI)', () => {
    const terms = getRecommendedTerms({
      noiY1: 1_000_000,
      purchasePrice: 10_000_000,
      ltv: 0.75,
      rate: 0.065,
    });

    expect(terms.bindingConstraint).toBe('ltv');
    expect(terms.constraintDetails).toContain('LTV');
  });

  test('DSCR binds when LTV cap > DSCR cap (low NOI)', () => {
    const terms = getRecommendedTerms({
      noiY1: 300_000,
      purchasePrice: 10_000_000,
      ltv: 0.75,
      rate: 0.065,
    });

    expect(terms.bindingConstraint).toBe('dscr');
    expect(terms.constraintDetails).toContain('DSCR');
  });

  test('IO binds when dealMode is lease_up and monthsToStabilize drives IO', () => {
    const terms = getRecommendedTerms({
      noiY1: 500_000,
      purchasePrice: 10_000_000,
      ltv: 0.75,
      rate: 0.065,
      monthsToStabilize: 18,
      dealContext: { lenderType: 'bridge', dealMode: 'lease_up' },
    });

    expect(terms.bindingConstraint).toBe('io');
    expect(terms.constraintDetails).toContain('lease-up');
  });
});

describe('B5: R3 — getRecommendedTerms with monthsToStabilize integration', () => {
  test('lease-up deal with monthsToStabilize uses lease-up profile', () => {
    const terms = getRecommendedTerms({
      noiY1: 500_000,
      purchasePrice: 10_000_000,
      ltv: 0.75,
      rate: 0.065,
      monthsToStabilize: 18,
      dealContext: { lenderType: 'bridge', dealMode: 'lease_up' },
    });

    // IO = min(18, 36) = 18 months
    expect(terms.loanTerms.ioPeriod).toBe(18);
    expect(terms.bindingConstraint).toBe('io');
  });

  test('existing deal without monthsToStabilize uses LTV tier', () => {
    const terms = getRecommendedTerms({
      noiY1: 500_000,
      purchasePrice: 10_000_000,
      ltv: 0.75,
      rate: 0.065,
      dealContext: { dealMode: 'existing' },
    });

    // LTV = 0.75 → 0.65 < LTV <= 0.75 tier → 12 months
    expect(terms.loanTerms.ioPeriod).toBe(12);
  });
});
