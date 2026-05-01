/**
 * Debt Bundle Registry
 *
 * Each debt bundle has:
 *   - Parameter vector (debt_rate, ltv, io_period, refinance_spread_estimate)
 *   - Factor loadings (especially F1 — rate environment)
 *   - μ_bundle (center of debt variables given this bundle choice)
 *   - Σ_bundle (covariance of debt variables — fixed vs floating matters)
 *
 * Capital stack co-movement detection:
 *   "double-up" = deal's IRR and debt choice both load on F1 in the same direction.
 *   When IRR expects falling rates (exit cap compression) AND debt is floating,
 *   a rate shock hits both channels simultaneously.
 */

import { SIGMA_VARIABLES } from './sigma-variable-registry';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DebtBundle {
  id: string;
  name: string;
  description: string;
  /** Key parameters (defaults; actual available rates vary) */
  params: DebtBundleParams;
  /** Does this bundle have fixed rate? */
  rateLocked: boolean;
  /** What year (relative to acquisition) does IO end? null = IO for full term */
  ioExpirationYear: number | null;
  /** When does refinance risk materialize? */
  refinanceWindow: string;
  /** F1 loading on debt_rate: 0.0 for fixed, ~0.95 for floating */
  f1Loading: number;
  /** Double-up flag: what does this bundle's IRR variance look like in up-rate vs down-rate? */
  doubleUpNote: string;
  /** Rate-cap covariance within this bundle */
  rateCapCorrelation: number;
  /** Default amortization period (years), null = interest-only */
  amortizationYears: number | null;
  /** Typical origination timeline (months) */
  closingTimelineMonths: number;
  /** LTV range typically available */
  ltvRange: [number, number];
  /** Typical spread above SOFR/treasury for this product */
  typicalSpread: number;
}

export interface DebtBundleParams {
  debtRate: number; // as decimal 0.055 = 5.5%
  ltv: number; // as decimal 0.75 = 75%
  ioPeriod: number; // years
  amortization: number; // years (0 = interest-only)
  originationFees: number; // as decimal 0.01 = 1%
  prepaymentPenalty: string;
}

// ─── The Bundle Catalog ─────────────────────────────────────────────────────

export const DEBT_BUNDLES: Record<string, DebtBundle> = {
  'hud_221d4': {
    id: 'hud_221d4',
    name: 'HUD 221(d)(4)',
    description: 'HUD-insured loan for multifamily construction/substantial rehab. Fixed rate, 35-year amortization, up to 83% LTV. Slow closing (6-9 months) but lowest rate + longest term.',
    params: {
      debtRate: 0.050,
      ltv: 0.83,
      ioPeriod: 0, // no IO; full amort from day 1
      amortization: 35,
      originationFees: 0.01,
      prepaymentPenalty: 'Yield maintenance, declining over time',
    },
    rateLocked: true,
    ioExpirationYear: null,
    refinanceWindow: 'Year 35+ (fully amortizing)',
    f1Loading: 0.0,
    doubleUpNote: 'No double-up risk. Rate is fixed for 35 years. Only exit cap is exposed to F1. Single-channel risk.',
    rateCapCorrelation: 0.0,
    amortizationYears: 35,
    closingTimelineMonths: 7,
    ltvRange: [0.75, 0.83],
    typicalSpread: 0.045, // ~4.5% over 10Y treasury
  },

  'agency_fixed_5yr_io': {
    id: 'agency_fixed_5yr_io',
    name: 'Agency Fixed (5yr IO)',
    description: 'Fannie Mae / Freddie Mac fixed-rate multifamily loan. 5-year interest-only period, then amortizing. Popular for short-to-medium holds.',
    params: {
      debtRate: 0.0575,
      ltv: 0.75,
      ioPeriod: 5,
      amortization: 30,
      originationFees: 0.0075,
      prepaymentPenalty: 'Yield maintenance or defeasance',
    },
    rateLocked: true,
    ioExpirationYear: 5,
    refinanceWindow: 'Year 5 (if held past IO period, DSCR changes as amort kicks in)',
    f1Loading: 0.0,
    doubleUpNote: 'Rate locked for 5 years. If hold period ≤ 5 years, no double-up. If held longer, refinance at year 5 exposes to F1 then.',
    rateCapCorrelation: 0.0,
    amortizationYears: 30,
    closingTimelineMonths: 3,
    ltvRange: [0.65, 0.80],
    typicalSpread: 0.015, // ~150bps over 10Y
  },

  'agency_floating': {
    id: 'agency_floating',
    name: 'Agency Floating',
    description: 'Fannie Mae / Freddie Mac floating-rate multifamily loan. Ties to SOFR. Lower initial rate but exposes to rate movements.',
    params: {
      debtRate: 0.065, // SOFR + 250 initially
      ltv: 0.70,
      ioPeriod: 3,
      amortization: 30,
      originationFees: 0.005,
      prepaymentPenalty: 'Soft lockout, then open',
    },
    rateLocked: false,
    ioExpirationYear: 3,
    refinanceWindow: 'Continuous (rate resets quarterly to SOFR). Year 3 IO expiration adds cash flow pressure.',
    f1Loading: 0.95,
    doubleUpNote: 'Significant double-up risk. Both debt_rate and exit_cap load on F1. If F1 spikes, debt service rises AND exit cap widens simultaneously. Maximum joint shock.',
    rateCapCorrelation: 0.55, // rate and cap moderately correlated through F1
    amortizationYears: 30,
    closingTimelineMonths: 2,
    ltvRange: [0.60, 0.75],
    typicalSpread: 0.025, // 250bps over SOFR
  },

  'bridge_floating': {
    id: 'bridge_floating',
    name: 'Bridge Floating (3yr + 2x1yr ext)',
    description: 'Short-term floating-rate bridge loan. 3-year initial term with two 1-year extensions. Higher rate but faster close and flexible prepay.',
    params: {
      debtRate: 0.075, // SOFR + 375
      ltv: 0.70,
      ioPeriod: 3,
      amortization: 0, // interest-only for full term
      originationFees: 0.01,
      prepaymentPenalty: '1% soft, free after 12 months',
    },
    rateLocked: false,
    ioExpirationYear: null, // IO for full term
    refinanceWindow: 'Year 2-3 (acute refinance risk — must exit or refinance before term expires)',
    f1Loading: 0.95,
    doubleUpNote: 'Maximum double-up risk. Floating debt with acute term window. If F1 rises near exit, you face higher debt-serve AND wider caps with the clock ticking. The window risk is the additional threat — you can\'t wait out the shock.',
    rateCapCorrelation: 0.55,
    amortizationYears: null,
    closingTimelineMonths: 1.5,
    ltvRange: [0.60, 0.75],
    typicalSpread: 0.0375, // 375bps over SOFR
  },

  'cmbs_5yr_fixed': {
    id: 'cmbs_5yr_fixed',
    name: 'CMBS (5yr Fixed)',
    description: 'Commercial Mortgage-Backed Securities fixed-rate loan. 5-year term, full amortization. Non-recourse but with carveouts. Locked for the term but yield maintenance prepayment.',
    params: {
      debtRate: 0.060,
      ltv: 0.70,
      ioPeriod: 0, // no IO typically
      amortization: 30,
      originationFees: 0.01,
      prepaymentPenalty: 'Yield maintenance or defeasance (expensive)',
    },
    rateLocked: true,
    ioExpirationYear: null,
    refinanceWindow: 'Year 5 (balloon payment — must refinance or sell)',
    f1Loading: 0.0,
    doubleUpNote: 'Rate locked for term. Year 5 refinance risk if held longer. Single-channel during hold, refinance window at exit.',
    rateCapCorrelation: 0.0,
    amortizationYears: 30,
    closingTimelineMonths: 4,
    ltvRange: [0.60, 0.75],
    typicalSpread: 0.0175, // ~175bps over 10Y
  },
};

// ─── Double-Up Detection ────────────────────────────────────────────────────

export interface DoubleUpAssessment {
  bundleId: string;
  severity: 'none' | 'low' | 'moderate' | 'high';
  channels: string[];
  explanation: string;
}

/**
 * Assess double-up exposure for a deal given its chosen debt bundle and
 * the directional assumption about F1.
 */
export function assessDoubleUp(
  bundleId: string,
  dealF1Sensitivity: number, // ∂IRR/∂F1: how much does IRR change per σ of F1?
): DoubleUpAssessment {
  const bundle = DEBT_BUNDLES[bundleId];
  if (!bundle) {
    return { bundleId, severity: 'none', channels: [], explanation: 'Unknown bundle' };
  }

  const channels: string[] = [];
  let severity: 'none' | 'low' | 'moderate' | 'high' = 'none';

  // Channel 1: debt rate exposure
  if (bundle.f1Loading > 0.5) {
    channels.push(`Debt rate (F1 loading = ${bundle.f1Loading.toFixed(2)})`);
  }

  // Channel 2: exit cap (assumed to have some F1 exposure)
  const exitCapSensitivity = 0.65; // from variable registry factor loading on exit_cap_rate
  channels.push(`Exit cap rate (F1 loading = ${exitCapSensitivity.toFixed(2)})`);

  // How many channels are exposed to F1?
  const exposedChannels = (bundle.f1Loading > 0.5 ? 1 : 0) + 1; // debt + cap
  const f1Exposed = bundle.f1Loading > 0.5;

  if (exposedChannels >= 2 && f1Exposed) {
    severity = 'high';
  } else if (exposedChannels >= 2) {
    severity = 'moderate';
  } else {
    severity = 'none';
  }

  // Additional: window risk
  let explanation: string;
  if (bundle.refinanceWindow.includes('acute') || bundle.refinanceWindow.includes('Year 2-3')) {
    explanation = `Double-up detected: both debt and exit cap load on F1 (rate environment). ${channels.join(' + ')}. Additionally, the bundle has a acute refinance window (${bundle.refinanceWindow}) — you cannot wait out a rate shock.`;
    severity = 'high';
  } else if (f1Exposed) {
    explanation = `Partial double-up: ${channels.join(' + ')}. Consider fixed-rate refinance to insulate debt channel.`;
  } else {
    explanation = `No double-up risk: debt channel is insulated (${bundle.rateLocked ? 'fixed rate' : 'low F1 loading'}). Single-channel exposure only (exit cap).`;
  }

  return { bundleId, severity, channels, explanation };
}

/**
 * Get IRRR variance per bundle.
 * Var(IRR | bundle) = sensitivityᵀ · Σ_bundle · sensitivity
 *
 * Simplified: approximate as proportional to (bundle.f1Loading * dealF1Sensitivity)²
 * plus base variance from other factors.
 */
export function estimateBundleIRRVariance(
  bundleId: string,
  dealF1Sensitivity: number, // ∂IRR/∂F1
  baseVariance: number, // variance from non-F1 factors
): number {
  const bundle = DEBT_BUNDLES[bundleId];
  if (!bundle) return baseVariance;

  const f1Contribution = Math.pow(bundle.f1Loading * dealF1Sensitivity, 2);
  const rateCapCoVar = 2 * bundle.f1Loading * 0.65 * bundle.rateCapCorrelation * dealF1Sensitivity * 0.5;

  return baseVariance + f1Contribution + rateCapCoVar;
}
