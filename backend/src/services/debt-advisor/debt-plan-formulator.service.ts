/**
 * Debt Plan Formulator Service
 *
 * Core service: reads M08 strategy output → classifies rate environment →
 * applies debt context modifiers (size/geography/age/sponsor) → product
 * mapping → phased recommended debt plan.
 *
 * When no M08 strategy output is found, returns { hasStrategy: false } so
 * the frontend can show the "run strategy first" CTA without fabricating
 * a default recommendation.
 */
import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { classifyRateEnvironment, RateEnvironmentResult } from './rate-environment.service';
import { targetLenders, LenderTarget } from './lender-targeting.service';
import { getM08StrategyOutput, M08StrategyOutput } from './m08-strategy-output.service';
import { applyDebtContextModifier, ContextModification } from './debt-context-modifier.service';
import { applyDebtAdvisorPlatformDefault } from '../proforma-adjustment.service';
import { getDealFinancialContext } from '../deal-financial-context.service';
import { cycleIntelligenceService } from '../cycle-intelligence.service';
import { logger } from '../../utils/logger';
import { computeExitWindows } from './exit-window-calculator';
import strategyDebtMapping from './strategy-debt-mapping.json';

/**
 * Computes annual debt service for a loan.
 * For IO periods the service is interest-only; once IO ends it switches to
 * P+I.  We use the first year's payment — i.e., if ioMonths >= 12 the whole
 * first year is IO, otherwise it amortizes.
 */
function computeAnnualDebtService(
  loanAmount: number,
  annualRate: number,
  ioMonths: number,
  amortYears: number
): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  if (ioMonths >= 12) {
    return loanAmount * annualRate;
  }
  if (amortYears <= 0) {
    return loanAmount * annualRate;
  }
  const monthlyRate = annualRate / 12;
  const n = amortYears * 12;
  const pmt = loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
  return pmt * 12;
}

export interface DebtPhase {
  phaseIndex: number;
  phaseLabel: string;
  product: string;
  productLabel: string;
  startMonth: number;
  endMonth: number;
  loanAmountEst: number;
  termYears: number;
  ioMonths: number;
  amortYears: number;
  rateType: 'Fixed' | 'Floating';
  rateEst: number;
  spreadBps?: number;
  ltv: number;
  origFee: number;
  exitFee: number;
  prepayType: string;
  rationale: string;
  lenders: LenderTarget[];
  triggers: MonitoringTrigger[];
  isRefiEvent: boolean;
  refiTriggerOcc?: number;
  refiTriggerDscr?: number;
  dscrAtClose?: number;
  debtYieldAtClose?: number;
}

export interface MonitoringTrigger {
  id: string;
  condition: string;
  currentValue: string;
  threshold: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  action: string;
  severity: 'info' | 'warning' | 'critical';
  phase: number;
}

export interface DebtAlternative {
  label: string;
  product: string;
  productLabel: string;
  rationale: string;
  tradeoff: string;
  deltaAllInBps: number;
  irrImpactBps: number;
}

export interface DebtAdvisorResponse {
  dealId: string;
  computedAt: string;
  hasStrategy: boolean;
  strategyInputs: {
    subStrategyKey: string;
    strategySlug: string;
    strategyName: string;
    holdMonths: number;
    hasStrategy: boolean;
    propertyType: string;
    purchasePrice: number;
    city: string;
    state: string;
    units: number;
    riskScore: number;
    m08Source: 'strategy_analyses' | 'none';
  };
  rateEnvironment: RateEnvironmentResult;
  recommendedStack: DebtPhase[];
  alternatives: DebtAlternative[];
  monitoringTriggers: MonitoringTrigger[];
  contextModifications: {
    narrativeNotes: string[];
    geographyWarning: string | null;
    sizeWarning: string | null;
    recourseRequired: boolean;
    addPcaReserveNote: boolean;
    ltvHaircutPct: number;
  };
  correlationContext: {
    slug: string;
    riskScore: number;
    correlationImplication: string;
    rssAdjustmentBps: number;
  } | null;
  summary: {
    primaryProduct: string;
    primaryProductLabel: string;
    totalClosingCosts: number;
    initialLoanAmount: number;
    blendedAllInRate: number;
    headline: string;
    whyStatement: string;
    estimatedIrrImpactBps: number;
    covenantCushionBps: number;
  };
  divergence?: {
    hasDivergence: boolean;
    configuredLoanAmount?: number;
    configuredRate?: number;
    advisorLoanAmount?: number;
    advisorRate?: number;
    irrImpactBps?: number;
    covenantCushionDeltaBps?: number;
  };
  /**
   * CE-09: snapshot of the auto-applied platform-default write performed by
   * `formulateDebtPlan`. The recommendation is written to the Pro Forma's
   * `per_year_overrides` as `resolution: 'platform'` the moment it is
   * computed, so the deterministic model picks it up without requiring an
   * explicit Accept. `applied` is the count of fields written; `skipped`
   * lists fields where a user override was already present and was
   * intentionally preserved (user > platform precedence).
   */
  platformDefaultsApplied?: {
    applied: number;
    skipped: string[];
    phaseIndex: number;
    fieldsApplied: string[];
  };
  /**
   * CE-16 F3 (W-08): Müller-cycle phase at the time of formulation.
   * Used to apply spread modulation to debt cost basis. Null when
   * m28_cycle_snapshots is unpopulated or the MSA is not tracked.
   */
  cyclePhase?: string | null;
  /**
   * LQ-5: Exit window analysis — optimal refinancing windows from
   * curve troughs + M35 event overlays. Null when curve is stale/missing
   * or no actionable windows exist.
   */
  exitWindows?: import('./exit-window-calculator').ExitWindowAnalysis | null;
}

interface CacheEntry {
  data: DebtAdvisorResponse;
  expiresAt: number;
}

const advisorCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function detectSubStrategy(strategySlug: string, strategyName: string, propertyType: string): string {
  const slug = (strategySlug || '').toLowerCase();
  const s = (strategyName || '').toLowerCase();
  const p = (propertyType || '').toLowerCase();

  if (slug === 'value-add-multifamily' || slug === 'value_add_multifamily') return 'mf_value_add';
  if (slug === 'core-multifamily' || slug === 'core_multifamily') return 'mf_core';
  if (slug === 'core-plus-multifamily' || slug === 'core_plus_multifamily') return 'mf_core_plus';
  if (slug === 'deep-value-multifamily' || slug === 'deep_value_multifamily' || slug === 'heavy-value-add') return 'mf_deep_value_add';
  if (slug === 'distressed-multifamily' || slug === 'distressed_debt') return 'mf_distressed';
  if (slug === 'lease-up-multifamily' || slug === 'lease_up') return 'mf_lease_up';
  if (slug === 'ground-up-mf' || slug === 'new-construction-mf' || slug === 'ground-up-multifamily') return 'mf_ground_up';
  if (slug === 'senior-housing-mf' || slug === 'workforce-housing' || slug === 'cls-multifamily') return 'mf_cls';
  if (slug === 'fix-and-flip' || slug === 'sfr_fix_flip') return 'sfr_fix_flip';
  if (slug === 'brrrr' || slug === 'sfr_brrrr') return 'sfr_brrrr';
  if (slug === 'rental' || slug === 'sfr-hold' || slug === 'buy-and-hold') return 'sfr_hold';
  if (slug === 'sfr-portfolio' || slug === 'scattered-site-sfr') return 'sfr_portfolio';
  if (slug === 'sfr-new-construction' || slug === 'build-to-rent' || slug === 'btr') return 'sfr_new_construction';
  if (slug === 'short-term-rental' || slug === 'str' || slug === 'vacation-rental') return 'sfr_str';
  if (slug === 'nnn-retail' || slug === 'net-lease' || slug === 'retail_nnn') return 'retail_nnn_core';
  if (slug === 'grocery-anchored' || slug === 'community-center') return 'retail_grocery';
  if (slug === 'retail-value-add' || slug === 'strip-center-reposition') return 'retail_value_add';
  if (slug === 'power-center' || slug === 'big-box') return 'retail_power_center';
  if (slug === 'office-core' || slug === 'core-office') return 'office_core';
  if (slug === 'office-value-add' || slug === 'office-repositioning') return 'office_value_add';
  if (slug === 'medical-office' || slug === 'mob') return 'office_medical';
  if (slug === 'flex-office' || slug === 'coworking') return 'office_flex';
  if (slug === 'industrial-core' || slug === 'bulk-distribution') return 'industrial_core';
  if (slug === 'industrial-value-add' || slug === 'industrial-repositioning') return 'industrial_value_add';
  if (slug === 'cold-storage' || slug === 'refrigerated-warehouse') return 'industrial_cold_storage';
  if (slug === 'last-mile' || slug === 'urban-logistics' || slug === 'infill-industrial') return 'industrial_last_mile';
  if (slug === 'full-service-hotel' || slug === 'hospitality-core') return 'hospitality_core';
  if (slug === 'limited-service-hotel' || slug === 'select-service') return 'hospitality_limited_service';
  if (slug === 'extended-stay' || slug === 'extended_stay') return 'hospitality_extended_stay';

  if (s.includes('flip') || s.includes('fix and flip')) return 'sfr_fix_flip';
  if (s.includes('brrrr')) return 'sfr_brrrr';
  if (s.includes('build to rent') || s.includes('build-to-rent')) return 'sfr_new_construction';
  if (s.includes('ground up') || s.includes('ground-up') || s.includes('new construction')) {
    if (p.includes('sfr') || p.includes('single family')) return 'sfr_new_construction';
    return 'mf_ground_up';
  }
  if (s.includes('short term rental') || s.includes('str')) return 'sfr_str';
  if (s.includes('core plus') || s.includes('core-plus')) {
    if (p.includes('multi') || p.includes('apartment')) return 'mf_core_plus';
  }
  if (s.includes('deep value') || s.includes('heavy value') || s.includes('gut rehab')) return 'mf_deep_value_add';
  if (s.includes('distressed') || s.includes('npl') || s.includes('note purchase')) return 'mf_distressed';
  if (s.includes('lease-up') || s.includes('lease up')) return 'mf_lease_up';
  if (s.includes('value add') || s.includes('value-add') || s.includes('renovation') || s.includes('rehab')) {
    if (p.includes('office')) return 'office_value_add';
    if (p.includes('retail') || p.includes('strip') || p.includes('shopping')) return 'retail_value_add';
    if (p.includes('industrial') || p.includes('warehouse') || p.includes('flex')) return 'industrial_value_add';
    return 'mf_value_add';
  }
  if (s.includes('nnn') || s.includes('net lease') || s.includes('single tenant')) return 'retail_nnn_core';
  if (s.includes('grocery') || s.includes('anchored')) return 'retail_grocery';
  if (s.includes('medical') || s.includes('mob')) return 'office_medical';
  if (s.includes('cold storage') || s.includes('refrigerated')) return 'industrial_cold_storage';
  if (s.includes('last mile') || s.includes('infill industrial')) return 'industrial_last_mile';
  if (s.includes('portfolio') && (p.includes('sfr') || p.includes('single family'))) return 'sfr_portfolio';
  if (s.includes('sfr') || s.includes('single family') || s.includes('scattered site')) return 'sfr_hold';
  if (s.includes('hospitality') || s.includes('hotel') || p.includes('hospitality') || p.includes('hotel')) return 'hospitality_core';
  if (s.includes('industrial') || p.includes('industrial') || p.includes('warehouse')) return 'industrial_core';
  if (s.includes('office') || p.includes('office')) return 'office_core';
  if (s.includes('retail') || p.includes('retail')) return 'retail_nnn_core';
  if (s.includes('core') || s.includes('stabilized')) {
    if (p.includes('multi') || p.includes('apartment') || !p) return 'mf_core';
    if (p.includes('office')) return 'office_core';
    if (p.includes('industrial')) return 'industrial_core';
  }
  if (p.includes('multi') || p.includes('apartment')) return 'mf_core';
  return 'default';
}

function getMappingForKey(key: string): Record<string, any> {
  const mappings = strategyDebtMapping.mappings as Record<string, any>;
  return mappings[key] || mappings['default'];
}

function buildMonitoringTriggers(
  subStrategyKey: string,
  holdMonths: number,
  phases: Partial<DebtPhase>[],
  sofr: number,
  numPhases: number = 2
): MonitoringTrigger[] {
  const lastPhaseIdx = numPhases - 1;
  const refiPhaseIdx = Math.min(1, lastPhaseIdx);
  const triggers: MonitoringTrigger[] = [];
  const primaryPhase = phases[0];

  if (subStrategyKey.includes('value_add') || subStrategyKey === 'mf_deep_value_add') {
    triggers.push({
      id: 'refi-stabilization',
      condition: `Occupancy ≥ 92% AND DSCR ≥ 1.35`,
      currentValue: 'Awaiting occupancy milestone',
      threshold: 'Occ ≥ 92%, DSCR ≥ 1.35',
      frequency: 'Monthly',
      action: 'Agency refi eligible — initiate lender conversations, collect trailing 3-month financials',
      severity: 'info',
      phase: 1,
    });
    triggers.push({
      id: 'bridge-extension',
      condition: `Bridge term ending — extension vs refi cost comparison`,
      currentValue: 'Bridge extension fee: 50bps',
      threshold: 'Extension vs refi pricing within 25bps',
      frequency: 'Quarterly',
      action: 'If replacement pricing within 25bps of current all-in, refi instead of extend',
      severity: 'warning',
      phase: 0,
    });
  }

  if (subStrategyKey.includes('brrrr') || subStrategyKey.includes('sfr')) {
    triggers.push({
      id: 'dscr-loan-test',
      condition: `DSCR ≥ 1.20 at stabilized rent`,
      currentValue: 'Pre-stabilization',
      threshold: 'DSCR ≥ 1.20',
      frequency: 'Monthly',
      action: 'Initiate DSCR lender conversations; pull cash-out at refi to deploy into next acquisition',
      severity: 'info',
      phase: 0,
    });
  }

  if (primaryPhase?.rateType === 'Floating') {
    const capExpiryMonth = primaryPhase?.ioMonths || 24;
    triggers.push({
      id: 'rate-cap-replacement',
      condition: `Rate cap expiry at M${capExpiryMonth}`,
      currentValue: `SOFR: ${(sofr * 100).toFixed(2)}%`,
      threshold: 'Cap expiry 90 days out',
      frequency: 'Monthly',
      action: `Budget rate cap replacement; at current SOFR, est. $150-300K for same-strike cap`,
      severity: 'warning',
      phase: 0,
    });
  }

  triggers.push({
    id: 'covenant-dscr',
    condition: `DSCR projected below minimum covenant`,
    currentValue: 'Monitor via projections tab',
    threshold: 'DSCR < covenant minimum',
    frequency: 'Monthly',
    action: 'Reduce distributions to preserve covenant cushion; review NOI assumptions',
    severity: 'critical',
    phase: 0,
  });

  triggers.push({
    id: 'treasury-drop',
    condition: `10yr Treasury drops 75bps below current`,
    currentValue: 'Monitor weekly',
    threshold: 'Treasury -75bps',
    frequency: 'Weekly',
    action: 'Agency rate improves enough to justify refi even with prepay — evaluate savings',
    severity: 'info',
    phase: refiPhaseIdx,
  });

  triggers.push({
    id: 'exit-prepay-window',
    condition: `Within 12mo of hold target exit at M${holdMonths}`,
    currentValue: `Hold target: M${holdMonths}`,
    threshold: 'Within 12mo of exit',
    frequency: 'Quarterly',
    action: 'Calculate exact prepay cost (yield maintenance or defeasance). Begin exit planning with capital stack waterfall.',
    severity: 'info',
    phase: lastPhaseIdx,
  });

  return triggers;
}

const PRODUCT_KEY_ALIASES: Record<string, string> = {
  'agency': 'agency_fixed',
  'agency_dus': 'agency_fixed',
  'fannie': 'agency_fixed',
  'freddie': 'agency_fixed',
  'construction': 'construction_to_perm',
  'ground_up': 'construction_to_perm',
  'bridge_or_agency': 'bridge',
  'debt_fund_fixed': 'bridge',
  'sfr_portfolio': 'portfolio_blanket',
  'conventional_investment': 'dscr_loan',
  'rental_loan': 'dscr_loan',
  'net_lease': 'cmbs_10yr',
  'nnn_net_lease': 'cmbs_10yr',
  'perm_fixed': 'cmbs_10yr',
  'agency_fixed_5yr': 'agency_fixed',
  'agency_fixed_10yr': 'agency_fixed',
  'str_dscr': 'dscr_loan',
};

function normalizeProductKey(key: string): string {
  return PRODUCT_KEY_ALIASES[key] ?? key;
}

function resolveTermYears(phaseStruct: Record<string, any>, defaultYears: number = 3): number {
  if (phaseStruct.termMonths != null) return phaseStruct.termMonths / 12;
  if (phaseStruct.termYears != null) return phaseStruct.termYears;
  return defaultYears;
}

function buildPhases(
  mapping: Record<string, any>,
  rateEnv: RateEnvironmentResult,
  purchasePrice: number,
  holdMonths: number,
  state: string,
  subStrategyKey: string,
  contextMods: ContextModification,
  productHint?: string,
  strategyDrivers?: import('./m08-strategy-output.service').M08StrategyDrivers
): DebtPhase[] {
  const phases: DebtPhase[] = [];
  const sofr = rateEnv.sofr;
  const productLabels = strategyDebtMapping.productLabels as Record<string, string>;

  const structure = mapping.structure || {};
  const phaseStructure = structure.phase1 || structure;

  const rateType: 'Fixed' | 'Floating' =
    rateEnv.ratePreference === 'Fixed' ? 'Fixed' :
    rateEnv.ratePreference === 'Floating' ? 'Floating' :
    (phaseStructure.rateType || 'Floating') as 'Fixed' | 'Floating';

  const spreadBps = phaseStructure.spread ? Math.round(phaseStructure.spread * 10000) : 275;
  const rateEst = rateType === 'Floating'
    ? sofr + (phaseStructure.spread || 0.0275)
    : (phaseStructure.rate || sofr + 0.015);

  const mappingLtv = phaseStructure.targetLtv || phaseStructure.targetLtc || 0.70;
  let targetLtv = strategyDrivers?.targetLtv ?? mappingLtv;
  targetLtv = Math.max(0, targetLtv - contextMods.ltvHaircutPct);

  const phase1LoanM = (purchasePrice * targetLtv) / 1_000_000;
  const termYears = resolveTermYears(phaseStructure, 3);
  const termMonthsActual = termYears * 12;
  const ioMonths = phaseStructure.ioMonths || (rateType === 'Floating' ? termMonthsActual : 24);
  const amortYears = phaseStructure.amortYears || (rateType === 'Fixed' ? 30 : 0);

  const phase1ProductRaw = productHint
    ? normalizeProductKey(productHint)
    : normalizeProductKey(phaseStructure.product || mapping.primaryProduct || 'bridge');
  const primaryProduct = contextMods.productExclusions.includes(phase1ProductRaw)
    ? (mapping.alternatives || []).map(normalizeProductKey).find((a: string) => !contextMods.productExclusions.includes(a)) || 'bridge'
    : phase1ProductRaw;

  const phase1Lenders = targetLenders(primaryProduct, phase1LoanM, state, targetLtv, !contextMods.recourseRequired, 5);
  const phase1EndMonth = Math.min(termMonthsActual, holdMonths);
  const hasPhase2 = !!(structure.phase2 && holdMonths > termMonthsActual);
  const numPhases = hasPhase2 ? 3 : 2;
  const phase1Triggers = buildMonitoringTriggers(subStrategyKey, holdMonths, [{ rateType, ioMonths }], sofr, numPhases);

  const phase1Rationale = contextMods.narrativeNotes.length > 0
    ? `${mapping.rationale} Context notes: ${contextMods.narrativeNotes.slice(0, 2).join(' ')}`
    : mapping.rationale;

  phases.push({
    phaseIndex: 0,
    phaseLabel: 'Phase 1 — Acquisition',
    product: primaryProduct,
    productLabel: productLabels[primaryProduct] || productLabels[mapping.primaryProduct] || primaryProduct.replace(/_/g, ' '),
    startMonth: 0,
    endMonth: phase1EndMonth,
    loanAmountEst: phase1LoanM * 1_000_000,
    termYears,
    ioMonths,
    amortYears,
    rateType,
    rateEst,
    spreadBps: rateType === 'Floating' ? spreadBps : undefined,
    ltv: targetLtv,
    origFee: phaseStructure.origFee || 0.015,
    exitFee: phaseStructure.exitFee || (rateType === 'Floating' ? 0.005 : 0),
    prepayType: phaseStructure.prepayType || (rateType === 'Fixed' ? 'yield_maintenance' : 'open'),
    rationale: phase1Rationale,
    lenders: phase1Lenders,
    triggers: phase1Triggers.filter(t => t.phase === 0),
    isRefiEvent: false,
  });

  if (hasPhase2) {
    const p2 = structure.phase2;
    const refiMonth = strategyDrivers?.phase2TriggerMonth ?? p2.triggerMonth ?? phase1EndMonth;
    const p2Rate = rateEnv.classification === 'Rising'
      ? (p2.rate || 0.055)
      : (p2.rate || sofr + 0.012);
    const p2MappingLtv = p2.targetLtv || 0.65;
    const p2Ltv = Math.max(0, (strategyDrivers?.targetLtv ? Math.min(strategyDrivers.targetLtv, 0.75) : p2MappingLtv) - contextMods.ltvHaircutPct);
    const p2LoanM = (purchasePrice * p2Ltv) / 1_000_000;
    const p2ProductRaw = normalizeProductKey(
      strategyDrivers?.phase2Product ?? p2.product ?? 'agency_fixed'
    );
    const p2Product = contextMods.productExclusions.includes(p2ProductRaw)
      ? 'portfolio_bank'
      : p2ProductRaw;
    const p2TermYears = resolveTermYears(p2, 10);
    const p2Lenders = targetLenders(p2Product, p2LoanM, state, p2Ltv, !contextMods.recourseRequired, 3);
    const refiTriggerOcc = strategyDrivers?.triggerOccupancy ?? p2.triggerOcc;
    const refiTriggerDscr = strategyDrivers?.targetDscr ?? p2.triggerDscr;

    phases.push({
      phaseIndex: 1,
      phaseLabel: 'Phase 2 — Refi / Permanent Financing',
      product: p2Product,
      productLabel: productLabels[p2Product] || p2Product.replace(/_/g, ' '),
      startMonth: refiMonth,
      endMonth: holdMonths,
      loanAmountEst: p2LoanM * 1_000_000,
      termYears: p2TermYears,
      ioMonths: p2.ioMonths || 24,
      amortYears: p2.amortYears || 30,
      rateType: (p2.rateType || 'Fixed') as 'Fixed' | 'Floating',
      rateEst: p2Rate,
      ltv: p2Ltv,
      origFee: 0.010,
      exitFee: 0,
      prepayType: p2.prepayType || 'yield_maintenance',
      rationale: `At stabilization (M${refiMonth}), refinance to long-term fixed ${p2Product.replace(/_/g, ' ')} to lock in permanent capital and extract equity.`,
      lenders: p2Lenders,
      triggers: phase1Triggers.filter(t => t.phase === 1),
      isRefiEvent: true,
      refiTriggerOcc,
      refiTriggerDscr,
    });
  }

  phases.push({
    phaseIndex: phases.length,
    phaseLabel: `Phase ${phases.length + 1} — Exit / Payoff (M${holdMonths})`,
    product: 'exit_payoff',
    productLabel: 'Loan Payoff at Exit',
    startMonth: holdMonths,
    endMonth: holdMonths,
    loanAmountEst: 0,
    termYears: 0,
    ioMonths: 0,
    amortYears: 0,
    rateType: 'Fixed',
    rateEst: 0,
    ltv: 0,
    origFee: 0,
    exitFee: 0,
    prepayType: phases[phases.length - 1]?.prepayType || 'yield_maintenance',
    rationale: `At exit (M${holdMonths}), pay off outstanding balance plus prepayment penalty. Cross-reference Taxes tab for transfer tax. Proceeds flow through Capital Stack waterfall.`,
    lenders: [],
    triggers: phase1Triggers.filter(t => t.phase === numPhases - 1),
    isRefiEvent: false,
  });

  return phases;
}

function buildCorrelationContext(
  m08Output: M08StrategyOutput,
  rateEnv: RateEnvironmentResult
): { slug: string; riskScore: number; correlationImplication: string; rssAdjustmentBps: number } {
  const slug = m08Output.strategySlug;
  // Normalize riskScore to 0-10 scale: DB may store 0-100 (e.g. 75) or 0-10 (e.g. 7.5).
  const rawScore = m08Output.riskScore;
  const riskScore = rawScore > 10 ? Math.round((rawScore / 10) * 10) / 10 : rawScore;
  const cls = rateEnv.classification;

  let implication: string;
  let rssAdj = 0;

  if (cls === 'Rising') {
    rssAdj = riskScore > 7 ? 35 : riskScore > 4 ? 20 : 10;
    implication = `Rising-rate environment amplifies carry risk on floating-rate strategies. ${slug.includes('value_add') || slug.includes('brrrr') ? 'BRRRR/value-add bridge exposure requires rate-cap hedging (≥2yr, SOFR+300 strike).' : 'Consider locking into fixed permanent debt as soon as stabilized occupancy permits.'}`;
  } else if (cls === 'Dropping') {
    rssAdj = -15;
    implication = `Dropping-rate environment benefits floating-rate bridge loans and improves refi optionality. ${slug.includes('hold') ? 'Long-hold strategies may delay perm refi to capture further rate compression.' : 'Accelerate stabilization timeline to maximize refi window before rate floor.'}`;
  } else {
    rssAdj = riskScore > 7 ? 15 : 0;
    implication = `Flat rate environment provides predictable carry; lender credit boxes are fully open. ${slug.includes('nnn') || slug.includes('net_lease') ? 'Net-lease assets command tightest CMBS spreads in stable rate regimes.' : 'Focus on execution speed — current lender competition narrows spreads.'}`;
  }

  return { slug, riskScore, correlationImplication: implication, rssAdjustmentBps: rssAdj };
}

function buildAlternatives(
  mapping: Record<string, any>,
  rateEnv: RateEnvironmentResult,
  contextMods: ContextModification
): DebtAlternative[] {
  const alts: DebtAlternative[] = [];
  const alternatives: string[] = (mapping.alternatives || [])
    .map(normalizeProductKey)
    .filter((a: string) => !contextMods.productExclusions.includes(a));
  const productLabels = strategyDebtMapping.productLabels as Record<string, string>;

  if (alternatives[0]) {
    const deltaA = alternatives[0].includes('fixed') || alternatives[0].includes('agency') ? 15 : -20;
    alts.push({
      label: 'Alt A — Alternative Product',
      product: alternatives[0],
      productLabel: productLabels[alternatives[0]] || alternatives[0].replace(/_/g, ' '),
      rationale: `Alternative lender category for this strategy. Different underwriting standards, pricing, and recourse requirements.`,
      tradeoff: rateEnv.classification === 'Rising'
        ? 'Fixed-rate alternative adds rate certainty but reduces prepay flexibility'
        : 'Floating alternative saves expected 30-50bps over hold but adds rate risk',
      deltaAllInBps: deltaA,
      irrImpactBps: -Math.round(deltaA * 0.25),
    });
  }

  if (rateEnv.classification === 'Rising' && !alternatives[0]?.includes('fixed')) {
    const deltaB = 25;
    alts.push({
      label: 'Alt B — Rate Certainty',
      product: 'cmbs_10yr',
      productLabel: 'CMBS 10-Year Fixed',
      rationale: 'If sponsor wants zero rate risk in a rising rate environment: lock into 10yr fixed CMBS.',
      tradeoff: `Rising rate env: fixed rate saves est. +${Math.round(Math.abs(rateEnv.sofrForward12moBps) * 0.6)}bps vs floating over hold`,
      deltaAllInBps: deltaB,
      irrImpactBps: -Math.round(deltaB * 0.25),
    });
  }

  if (alternatives[1]) {
    const deltaC = 75;
    alts.push({
      label: 'Alt C — High-Leverage Option',
      product: alternatives[1],
      productLabel: productLabels[alternatives[1]] || alternatives[1].replace(/_/g, ' '),
      rationale: 'If leverage needs exceed senior capacity: add mezz or subordinate piece.',
      tradeoff: 'Adding 10% mezz at 12-14% blended raises all-in cost by ~60-90bps',
      deltaAllInBps: deltaC,
      irrImpactBps: -Math.round(deltaC * 0.25),
    });
  }

  return alts;
}

async function fetchDealBasicContext(pool: Pool, dealId: string): Promise<{
  propertyType: string;
  purchasePrice: number;
  city: string;
  state: string;
  units: number;
  holdMonths: number;
  msaId: string | null;
}> {
  const result = await pool.query(
    `SELECT budget, city, state, unit_count, hold_period_years,
            project_type, deal_data,
            deal_data->>'msaId' AS msa_id
     FROM deals
     WHERE id = $1 LIMIT 1`,
    [dealId]
  );

  const deal = result.rows[0];
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const dealData = deal.deal_data || {};
  const rawPurchasePrice =
    (dealData.purchase_price != null ? parseFloat(dealData.purchase_price) : null) ??
    (dealData.purchasePrice != null ? parseFloat(dealData.purchasePrice) : null) ??
    (deal.budget != null ? parseFloat(deal.budget) : null) ??
    5_000_000;
  const purchasePrice = rawPurchasePrice > 0 ? rawPurchasePrice : 5_000_000;

  const holdYears = deal.hold_period_years ? parseInt(deal.hold_period_years) : 5;
  const holdMonths = dealData?.hold_period_months || dealData?.holdPeriodMonths || (holdYears * 12) || 36;

  return {
    propertyType: deal.project_type || 'Multifamily',
    purchasePrice,
    city: deal.city || '',
    state: deal.state || '',
    units: deal.unit_count ? parseInt(deal.unit_count) : 0,
    holdMonths,
    msaId: deal.msa_id || null,
  };
}

export async function formulateDebtPlan(dealId: string, productHint?: string): Promise<DebtAdvisorResponse> {
  if (!productHint) {
    const cached = advisorCache.get(dealId);
    if (cached && Date.now() < cached.expiresAt) return cached.data;
  }

  const pool = getPool();

  const [dealCtx, m08Output, rateEnv, finCtx] = await Promise.all([
    fetchDealBasicContext(pool, dealId),
    getM08StrategyOutput(pool, dealId),
    classifyRateEnvironment(),
    getDealFinancialContext(dealId).catch(() => null),
  ]);

  // CE-16 F3 (W-08): Fetch cycle phase for spread modulation.
  // Non-fatal: null when m28_cycle_snapshots is empty or MSA is untracked.
  let cyclePhaseSnapshot: Awaited<ReturnType<typeof cycleIntelligenceService.getCyclePhase>> = null;
  if (dealCtx.msaId) {
    try {
      cyclePhaseSnapshot = await cycleIntelligenceService.getCyclePhase(dealCtx.msaId);
    } catch (cycleErr: any) {
      logger.warn('[DebtAdvisor] Cycle phase fetch failed — no spread modulation applied', {
        dealId,
        msaId: dealCtx.msaId,
        error: cycleErr.message,
      });
    }
  }

  // Spread modulation table (bps additive to rateEst).
  // Recession → credit tightens (+25bps); Expansion → credit loosens (-10bps).
  const CYCLE_SPREAD_DELTA_BPS: Record<string, number> = {
    recession:   25,
    hypersupply: 15,
    recovery:    -5,
    expansion:  -10,
  };
  const cycleSpreadDeltaBps = cyclePhaseSnapshot
    ? (CYCLE_SPREAD_DELTA_BPS[cyclePhaseSnapshot.lag_phase] ?? 0)
    : 0;

  if (!m08Output) {
    const noStrategyResponse: DebtAdvisorResponse = {
      dealId,
      computedAt: new Date().toISOString(),
      hasStrategy: false,
      strategyInputs: {
        subStrategyKey: 'none',
        strategySlug: '',
        strategyName: '',
        holdMonths: dealCtx.holdMonths,
        hasStrategy: false,
        propertyType: dealCtx.propertyType,
        purchasePrice: dealCtx.purchasePrice,
        city: dealCtx.city,
        state: dealCtx.state,
        units: dealCtx.units,
        riskScore: 0,
        m08Source: 'none',
      },
      rateEnvironment: rateEnv,
      recommendedStack: [],
      alternatives: [],
      monitoringTriggers: [],
      contextModifications: {
        narrativeNotes: [],
        geographyWarning: null,
        sizeWarning: null,
        recourseRequired: false,
        addPcaReserveNote: false,
        ltvHaircutPct: 0,
      },
      correlationContext: null,
      summary: {
        primaryProduct: '',
        primaryProductLabel: '',
        totalClosingCosts: 0,
        initialLoanAmount: 0,
        blendedAllInRate: 0,
        headline: 'Run Strategy Analysis First',
        whyStatement: 'The Debt Advisor requires M08 Strategy Analysis output to formulate a strategy-specific debt recommendation. Navigate to the Strategies tab to run analysis.',
        estimatedIrrImpactBps: 0,
        covenantCushionBps: 0,
      },
    };
    advisorCache.set(dealId, { data: noStrategyResponse, expiresAt: Date.now() + CACHE_TTL_MS });
    return noStrategyResponse;
  }

  const subStrategyKey = detectSubStrategy(m08Output.strategySlug, m08Output.strategyName, dealCtx.propertyType);
  const mapping = getMappingForKey(subStrategyKey);
  const strategyDrivers = m08Output.strategyDrivers;

  // Prefer M08 strategy hold months over deal-level hold period when provided.
  const holdMonths = strategyDrivers.holdMonths ?? dealCtx.holdMonths;

  const estimatedLoan = dealCtx.purchasePrice * (strategyDrivers.targetLtv ?? 0.70);
  const [{ modifications: contextMods }, configureRow] = await Promise.all([
    applyDebtContextModifier(pool, dealId, dealCtx.purchasePrice, dealCtx.state, estimatedLoan),
    pool.query(
      `SELECT per_year_overrides FROM deal_assumptions WHERE deal_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] as any[] })),
  ]);

  const phases = buildPhases(mapping, rateEnv, dealCtx.purchasePrice, holdMonths, dealCtx.state, subStrategyKey, contextMods, productHint, strategyDrivers);

  // CE-16 F3 (W-08): Apply cycle-phase spread modulation to all non-exit phases.
  // rateEst is adjusted additively; spreadBps metadata updated to reflect the new all-in cost.
  if (cycleSpreadDeltaBps !== 0) {
    const spreadDeltaDecimal = cycleSpreadDeltaBps / 10000;
    for (const ph of phases) {
      if (ph.product === 'exit_payoff') continue;
      ph.rateEst = Math.max(0, ph.rateEst + spreadDeltaDecimal);
      if (ph.spreadBps != null) {
        ph.spreadBps = Math.max(0, ph.spreadBps + cycleSpreadDeltaBps);
      }
    }
    logger.debug('[DebtAdvisor] Cycle spread modulation applied', {
      dealId,
      cyclePhase: cyclePhaseSnapshot?.lag_phase,
      spreadDeltaBps: cycleSpreadDeltaBps,
    });
  }

  // Compute DSCR / Debt Yield from T-12 NOI (if available) for each non-exit phase.
  // Falls back to estimate (1% of purchase price/month) when actuals not yet ingested.
  const t12NOI = finCtx?.trailingTwelveNOI ?? null;
  const estimatedAnnualNOI = t12NOI ?? (dealCtx.purchasePrice * 0.06); // 6% cap rate fallback
  for (const ph of phases) {
    if (ph.product === 'exit_payoff' || ph.loanAmountEst <= 0) continue;
    const annualDebtSvc = computeAnnualDebtService(ph.loanAmountEst, ph.rateEst, ph.ioMonths, ph.amortYears);
    if (annualDebtSvc > 0) {
      ph.dscrAtClose        = Math.round((estimatedAnnualNOI / annualDebtSvc) * 100) / 100;
      ph.debtYieldAtClose   = Math.round((estimatedAnnualNOI / ph.loanAmountEst) * 10000) / 10000;
    }
  }

  const alternatives = buildAlternatives(mapping, rateEnv, contextMods);

  const allTriggers = phases.flatMap(p => p.triggers);
  const uniqueTriggers = allTriggers.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);

  const phase1 = phases[0];
  const totalClosingCosts = phase1
    ? phase1.loanAmountEst * (phase1.origFee + phase1.exitFee) + (phase1.rateType === 'Floating' ? phase1.loanAmountEst * 0.005 : 0)
    : 0;

  // Normalize riskScore to 0-10 scale for IRR impact and downstream display.
  const rawRisk = m08Output.riskScore;
  const normalizedRisk = rawRisk > 10 ? rawRisk / 10 : rawRisk;
  const irrImpactBps = normalizedRisk > 7
    ? Math.round((normalizedRisk - 7) * 15)
    : 0;
  const covenantCushionBps = phase1 ? 1500 : 0;

  // Compute divergence: compare advisor recommendation to current Configure values
  // from deal_assumptions.per_year_overrides (durable, survives refresh).
  let divergence: DebtAdvisorResponse['divergence'] = undefined;
  const pyoRaw = configureRow.rows[0]?.per_year_overrides || {};
  if (phase1 && typeof pyoRaw === 'object') {
    const advisorLoan = phase1.loanAmountEst;
    const advisorRate = phase1.rateEst;
    let configLoan: number | undefined;
    let configRate: number | undefined;
    for (const [key, val] of Object.entries(pyoRaw as Record<string, any>)) {
      if (!key.startsWith('debt:')) continue;
      const parts = key.split(':');
      const field = parts[parts.length - 1];
      if (field === 'loanAmount' && typeof val === 'number') configLoan = val;
      if (field === 'interestRate' && typeof val === 'number') configRate = val;
      if (field === 'sofr' && typeof val === 'number' && !configRate) {
        const spreadKey = parts.slice(0, -1).join(':') + ':spread';
        const spread = (pyoRaw as Record<string, any>)[spreadKey];
        if (typeof spread === 'number') configRate = val + spread;
      }
    }
    const loanDeltaPct = configLoan != null
      ? Math.abs((configLoan - advisorLoan) / advisorLoan)
      : 0;
    const rateDeltaBps = configRate != null
      ? Math.abs((configRate - advisorRate) * 10000)
      : 0;
    if (configLoan != null || configRate != null) {
      const hasDivergence = loanDeltaPct > 0.05 || rateDeltaBps > 25;
      const irrDelta = hasDivergence
        ? Math.round(((advisorRate - (configRate ?? advisorRate)) * 10000) * 0.35 + (((advisorLoan - (configLoan ?? advisorLoan)) / advisorLoan) * 10000) * 0.12)
        : 0;
      const covenantDelta = hasDivergence
        ? Math.round(rateDeltaBps * 0.15)
        : 0;
      divergence = {
        hasDivergence,
        configuredLoanAmount: configLoan,
        configuredRate: configRate,
        advisorLoanAmount: advisorLoan,
        advisorRate,
        irrImpactBps: irrDelta,
        covenantCushionDeltaBps: covenantDelta,
      };
    }
  }

  // CE-09: write the recommendation to the Pro Forma's per_year_overrides
  // as `resolution: 'platform'` the moment the plan is computed. User
  // overrides win (writeDebtPlatformDefaults is user-override-safe by the
  // SQL guard in applyDebtAdvisorPlatformDefault). Failures here are
  // non-fatal: the formulated response is still returned so the UI renders
  // the recommendation even if the persistence layer hiccups.
  let platformDefaultsApplied: DebtAdvisorResponse['platformDefaultsApplied'];
  if (phase1) {
    try {
      const writeResult = await writeDebtPlatformDefaults(pool, dealId, phase1, 'debt_advisor');
      platformDefaultsApplied = {
        applied: writeResult.applied,
        skipped: writeResult.skipped,
        phaseIndex: 0,
        fieldsApplied: writeResult.fieldsApplied,
      };
      if (writeResult.skipped.length > 0) {
        logger.info('[DebtAdvisor] Platform defaults applied — some fields preserved by user override', {
          dealId,
          applied: writeResult.applied,
          skipped: writeResult.skipped,
        });
      }
    } catch (writeErr: any) {
      logger.warn('[DebtAdvisor] Platform-default auto-apply failed during formulate — recommendation still returned', {
        dealId,
        error: writeErr.message,
      });
      platformDefaultsApplied = { applied: 0, skipped: [], phaseIndex: 0, fieldsApplied: [] };
    }
  }

  // LQ-5: Compute exit windows (curve troughs + M35 events) — non-fatal.
  // Requires a LoanQuote to function; skip if no quotes available yet.
  let exitWindows: import('./exit-window-calculator').ExitWindowAnalysis | null = null;
  try {
    if (phase1 && phase1.loanAmountEst > 0) {
      const syntheticQuote: import('../loan-quotes/loan-quote.types').LoanQuote = {
        id: `synthetic_${dealId}`,
        orgId: 'platform',
        lender: phase1.lenders[0]?.lender?.name ?? 'Advisor',
        program: phase1.product,
        quoteDate: new Date().toISOString().split('T')[0],
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        indexBasis: 'treasury_10yr',
        rateType: phase1.rateType.toLowerCase() as 'fixed' | 'floating',
        spreadMatrix: {
          program: phase1.product,
          grid: {
            'Tier-3': {
              [phase1.termYears]: { min: 0.0125, max: 0.0150 },
            },
          },
        },
        adjustments: [],
        prepayStructure: { type: phase1.prepayType as any, terms: {} },
        brokerClaims: {
          source: 'debt_advisor_synthetic',
          date: new Date().toISOString().split('T')[0],
          confidence: 0.5,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      exitWindows = await computeExitWindows({
        dealId,
        msaId: dealCtx.msaId ?? undefined,
        currentQuote: syntheticQuote,
        curve: {
          tenorPoints: [
            { tenorYears: 5, rate: rateEnv.treasury10y - 0.0004, seriesCode: 'DGS5' },
            { tenorYears: 7, rate: rateEnv.treasury10y - 0.0007, seriesCode: 'DGS7' },
            { tenorYears: 10, rate: rateEnv.treasury10y, seriesCode: 'DGS10' },
            { tenorYears: 30, rate: rateEnv.treasury10y + 0.0014, seriesCode: 'DGS30' },
          ],
          source: 'FRED_DGS_SYNTHETIC',
          fetchedAt: new Date().toISOString(),
          staleThresholdHours: 24,
          indexBasis: 'treasury',
        },
        dealFinancials: {
          noiAnnual: estimatedAnnualNOI,
          loanAmount: phase1.loanAmountEst,
          holdMonths,
        },
        prepayPenaltyPct: phase1.prepayType === 'yield_maintenance' ? 0.02 : 0.01,
        originationFeePct: phase1.origFee,
      });
    }
  } catch (exitWindowErr: any) {
    logger.warn('[DebtAdvisor] Exit window computation failed — continuing without', {
      dealId,
      error: exitWindowErr.message,
    });
    exitWindows = null;
  }

  const result: DebtAdvisorResponse = {
    dealId,
    computedAt: new Date().toISOString(),
    hasStrategy: true,
    strategyInputs: {
      subStrategyKey,
      strategySlug: m08Output.strategySlug,
      strategyName: m08Output.strategyName,
      holdMonths,
      hasStrategy: true,
      propertyType: dealCtx.propertyType,
      purchasePrice: dealCtx.purchasePrice,
      city: dealCtx.city,
      state: dealCtx.state,
      units: dealCtx.units,
      riskScore: m08Output.riskScore,
      m08Source: m08Output.source,
    },
    rateEnvironment: rateEnv,
    recommendedStack: phases,
    alternatives,
    monitoringTriggers: uniqueTriggers,
    contextModifications: {
      narrativeNotes: contextMods.narrativeNotes,
      geographyWarning: contextMods.geographyWarning,
      sizeWarning: contextMods.sizeWarning,
      recourseRequired: contextMods.recourseRequired,
      addPcaReserveNote: contextMods.addPcaReserveNote,
      ltvHaircutPct: contextMods.ltvHaircutPct,
    },
    correlationContext: buildCorrelationContext(m08Output, rateEnv),
    summary: {
      primaryProduct: mapping.primaryProduct || '',
      primaryProductLabel: mapping.primaryProductLabel || '',
      totalClosingCosts,
      initialLoanAmount: phase1?.loanAmountEst || 0,
      blendedAllInRate: phase1?.rateEst || 0,
      headline: mapping.primaryProductLabel || '',
      whyStatement: mapping.rationale || '',
      estimatedIrrImpactBps: irrImpactBps,
      covenantCushionBps,
    },
    ...(divergence !== undefined ? { divergence } : {}),
    ...(platformDefaultsApplied !== undefined ? { platformDefaultsApplied } : {}),
    cyclePhase: cyclePhaseSnapshot?.lag_phase ?? null,
    exitWindows,
  };

  advisorCache.set(dealId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info('[DebtAdvisor] Formulated debt plan', {
    dealId,
    subStrategyKey,
    strategySlug: m08Output.strategySlug,
    m08Source: m08Output.source,
    phases: phases.length,
    contextNotes: contextMods.narrativeNotes.length,
    platformDefaultsApplied: platformDefaultsApplied?.applied ?? 0,
    platformDefaultsSkipped: platformDefaultsApplied?.skipped.length ?? 0,
    exitWindowsFound: exitWindows?.windows?.length ?? 0,
    exitWindowsBest: exitWindows?.bestWindow?.month ?? null,
  });
  return result;
}

export function bustAdvisorCache(dealId: string): void {
  advisorCache.delete(dealId);
}

/**
 * CE-09: write every debt-plan phase field to the Pro Forma's
 * `per_year_overrides` as `resolution: 'platform'`. Idempotent (same
 * input phase → same writes) and user-override-safe (the SQL guard in
 * `applyDebtAdvisorPlatformDefault` skips writes where the user has
 * `resolution: 'override'` or `'cleared'`).
 *
 * Pre-D3 this only fired from `acceptDebtPlan`; D3 lifts it into
 * `formulateDebtPlan` so the recommendation is live the moment it's
 * computed, exactly like every other platform-layer assumption.
 *
 * Returns the count applied and the list of fields skipped because a
 * user override was already in place — surfaced on
 * `DebtAdvisorResponse.platformDefaultsApplied` so the UI can flag
 * "your override is winning over the platform recommendation here".
 */
async function writeDebtPlatformDefaults(
  pool: Pool,
  dealId: string,
  phase: DebtPhase,
  source: string = 'debt_advisor'
): Promise<{ applied: number; skipped: string[]; fieldsApplied: string[] }> {
  const loanId = 'senior';

  // For floating loans Configure computes effRate = sofr.platform + spread.platform,
  // NOT interestRate.platform. Write the two components separately so Configure
  // resolves the identical rate the Advisor recommended.
  const isFloating = phase.rateType === 'Floating';
  const spreadDecimal = (phase.spreadBps ?? 0) / 10000;
  const sofrDecimal   = isFloating ? Math.max(0, phase.rateEst - spreadDecimal) : null;

  const writes: Array<[string, number | string | null]> = [
    ['loanAmount', phase.loanAmountEst],
    ['termYears',  phase.termYears],
    ['amortYears', phase.amortYears],
    ['ioMonths',   phase.ioMonths],
    ['origFee',    phase.origFee],
    ['exitFee',    phase.exitFee ?? 0],
    ['rateType',   phase.rateType],
    ['prepayType', phase.prepayType],
    ...(isFloating
      ? ([['sofr', sofrDecimal], ['spread', spreadDecimal]] as Array<[string, number | string | null]>)
      : ([['interestRate', phase.rateEst]] as Array<[string, number | string | null]>)
    ),
  ];

  const results = await Promise.all(
    writes.map(async ([field, value]) => {
      const applied = await applyDebtAdvisorPlatformDefault(pool, dealId, loanId, field, value, source);
      return { field, applied };
    })
  );

  const fieldsApplied = results.filter(r => r.applied).map(r => r.field);
  const skipped = results.filter(r => !r.applied).map(r => r.field);

  return { applied: fieldsApplied.length, skipped, fieldsApplied };
}

export async function acceptDebtPlan(
  dealId: string,
  userId: string,
  phaseIndex: number = 0
): Promise<{ success: boolean; message: string }> {
  const plan = await formulateDebtPlan(dealId);

  if (!plan.hasStrategy) {
    return { success: false, message: 'No strategy output found — run M08 Strategy analysis first' };
  }

  const phase = plan.recommendedStack[phaseIndex];
  if (!phase) {
    return { success: false, message: `Phase index ${phaseIndex} not found in recommended stack` };
  }

  // CE-09: the platform defaults already fired in formulateDebtPlan.
  // Accept is now an acknowledgment + alert-registration step; we re-run
  // the write as a confirmation (idempotent, still respects user overrides).
  const pool = getPool();
  let result: { applied: number; skipped: string[]; fieldsApplied: string[] };
  try {
    result = await writeDebtPlatformDefaults(pool, dealId, phase, 'debt_advisor');
  } catch (overrideErr: any) {
    logger.error('[DebtAdvisor] Platform-default pipeline failed on accept — Configure fields not populated', {
      dealId,
      phaseIndex,
      error: overrideErr.message,
    });
    return { success: false, message: `Platform default pipeline failed: ${overrideErr.message}` };
  }

  bustAdvisorCache(dealId);

  logger.info('[DebtAdvisor] Plan accepted (confirmation — defaults already live from formulate)', {
    dealId,
    phaseIndex,
    loanAmount: phase.loanAmountEst,
    rate: phase.rateEst,
    overridesApplied: result.applied,
    overridesSkipped: result.skipped,
  });

  const msg = result.skipped.length > 0
    ? `Debt plan confirmed: ${result.applied} platform defaults applied, ${result.skipped.length} field(s) preserved by user override (${result.skipped.join(', ')})`
    : `Debt plan confirmed: ${result.applied} platform defaults applied`;

  return { success: true, message: msg };
}
