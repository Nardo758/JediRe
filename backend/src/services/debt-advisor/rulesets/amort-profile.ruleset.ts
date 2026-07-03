/**
 * Amortization Profile Ruleset
 *
 * Default amortization assumptions by lender type.  These are
 * platform-estimate fallbacks used when a debt position lacks
 * explicit amortization terms.
 */

import type { LenderType } from './vintage-spread.ruleset';

export interface AmortProfile {
  amortizationYears?: number;
  rateType?: 'fixed' | 'floating' | 'fixed_or_floating';
  amortizationType?: 'IO' | 'amortizing' | 'partial_IO';
  ioPeriodMonths?: number;
  refiExpected?: boolean;
}

export const AMORT_PROFILE_RULESET = {
  version: '2026-07-03',
  provenanceTag: 'platform_estimate',
  rules: [
    { trigger: { lender_type: 'agency' as LenderType },   defaults: { amortizationYears: 30, rateType: 'fixed', ioPeriodMonths: 0 } },
    { trigger: { lender_type: 'bank' as LenderType },     defaults: { amortizationYears: 25, rateType: 'fixed_or_floating', ioPeriodMonths: 12 } },
    { trigger: { lender_type: 'bridge' as LenderType },   defaults: { amortizationType: 'IO', refiExpected: true, ioPeriodMonths: 36 } },
    { trigger: { lender_type: 'cmbs' as LenderType },     defaults: { amortizationYears: 30, rateType: 'fixed', ioPeriodMonths: 24 } },
    { trigger: { lender_type: 'life_co' as LenderType },  defaults: { amortizationYears: 30, rateType: 'fixed', ioPeriodMonths: 0 } },
  ],
  fallback: { amortizationYears: 30, rateType: 'fixed', ioPeriodMonths: 0 } as AmortProfile,
};

/**
 * Resolve an amortization profile for a lender type.
 */
export function resolveAmortProfile(lenderType: LenderType | undefined | null): AmortProfile & { provenance: string } {
  if (!lenderType) {
    return { ...AMORT_PROFILE_RULESET.fallback, provenance: 'platform_estimate_fallback_no_lender_type' };
  }
  const rule = AMORT_PROFILE_RULESET.rules.find(r => r.trigger.lender_type === lenderType);
  if (rule) {
    return { ...rule.defaults, provenance: 'platform_estimate' };
  }
  return { ...AMORT_PROFILE_RULESET.fallback, provenance: 'platform_estimate_fallback_unmatched_lender_type' };
}
