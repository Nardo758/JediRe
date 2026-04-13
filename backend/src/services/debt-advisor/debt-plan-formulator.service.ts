/**
 * Debt Plan Formulator Service
 * Core service: reads M08 strategy output (strategy_analyses) + rate environment + product mapping
 * and produces a phased recommended debt plan.
 */
import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { classifyRateEnvironment, RateEnvironmentResult } from './rate-environment.service';
import { targetLenders, LenderTarget } from './lender-targeting.service';
import { applyFinancialsOverride } from '../proforma-adjustment.service';
import { logger } from '../../utils/logger';
import strategyDebtMapping from './strategy-debt-mapping.json';

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
}

export interface StrategyCorrelationContext {
  slug: string;
  riskScore: number;
  correlationImplication: string;
  rssAdjustmentBps: number;
}

export interface DebtAdvisorResponse {
  dealId: string;
  computedAt: string;
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
  };
  rateEnvironment: RateEnvironmentResult;
  recommendedStack: DebtPhase[];
  alternatives: DebtAlternative[];
  monitoringTriggers: MonitoringTrigger[];
  correlationContext: StrategyCorrelationContext | null;
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
  if (slug === 'lease-up-multifamily' || slug === 'lease_up' || slug === 'ground-up-multifamily') return 'mf_lease_up';
  if (slug === 'ground-up-mf' || slug === 'new-construction-mf') return 'mf_ground_up';
  if (slug === 'senior-housing-mf' || slug === 'workforce-housing') return 'mf_cls';

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

  if (s.includes('flip') || s.includes('fix and flip') || s.includes('fix_flip')) return 'sfr_fix_flip';
  if (s.includes('brrrr')) return 'sfr_brrrr';
  if (s.includes('build_to_sell') || s.includes('build to sell') || s.includes('ground up') || s.includes('ground-up') || s.includes('new construction')) {
    if (p.includes('sfr') || p.includes('single family')) return 'sfr_new_construction';
    return 'mf_ground_up';
  }
  if (s.includes('str') || s.includes('short term rental') || s.includes('short-term rental')) return 'sfr_str';
  if (s.includes('core plus') || s.includes('core-plus')) {
    if (p.includes('multi') || p.includes('apartment')) return 'mf_core_plus';
  }
  if (s.includes('deep value') || s.includes('heavy value') || s.includes('gut')) return 'mf_deep_value_add';
  if (s.includes('distressed') || s.includes('note') || s.includes('npl')) return 'mf_distressed';
  if (s.includes('lease-up') || s.includes('lease up') || s.includes('lease_up')) return 'mf_lease_up';
  if (s.includes('value add') || s.includes('value-add') || s.includes('rental_value_add') || s.includes('renovation') || s.includes('rehab')) {
    if (p.includes('office')) return 'office_value_add';
    if (p.includes('retail') || p.includes('strip') || p.includes('shopping')) return 'retail_value_add';
    if (p.includes('industrial') || p.includes('warehouse') || p.includes('flex')) return 'industrial_value_add';
    return 'mf_value_add';
  }
  if (s.includes('nnn') || s.includes('net lease') || s.includes('single tenant')) return 'retail_nnn_core';
  if (s.includes('grocery') || s.includes('community center') || s.includes('anchored')) return 'retail_grocery';
  if (s.includes('medical') || s.includes('mob')) return 'office_medical';
  if (s.includes('cold storage') || s.includes('refrigerated')) return 'industrial_cold_storage';
  if (s.includes('last mile') || s.includes('infill industrial')) return 'industrial_last_mile';
  if (s.includes('portfolio') && (p.includes('sfr') || p.includes('single family'))) return 'sfr_portfolio';
  if (s.includes('sfr') || s.includes('single family') || s.includes('scattered site')) return 'sfr_hold';
  if (s.includes('hospitality') || s.includes('hotel') || p.includes('hospitality') || p.includes('hotel')) return 'hospitality_core';
  if (s.includes('industrial') || p.includes('industrial') || p.includes('warehouse')) return 'industrial_core';
  if (s.includes('office') || p.includes('office')) return 'office_core';
  if (s.includes('retail') || p.includes('retail')) return 'retail_nnn_core';
  if (s.includes('core') || s.includes('stabilized') || s.includes('rental_stabilized')) {
    if (p.includes('multi') || p.includes('apartment') || !p) return 'mf_core';
    if (p.includes('office')) return 'office_core';
    if (p.includes('industrial')) return 'industrial_core';
  }
  if (p.includes('multi') || p.includes('apartment')) return 'mf_core';
  return 'default';
}

function getMappingForKey(key: string): typeof strategyDebtMapping.mappings[keyof typeof strategyDebtMapping.mappings] {
  const mappings = strategyDebtMapping.mappings as Record<string, any>;
  return mappings[key] || mappings['default'];
}

function buildMonitoringTriggers(
  subStrategyKey: string,
  holdMonths: number,
  phases: Partial<DebtPhase>[],
  sofr: number
): MonitoringTrigger[] {
  const triggers: MonitoringTrigger[] = [];
  const primaryPhase = phases[0];

  if (subStrategyKey.includes('value_add') || subStrategyKey === 'mf_value_add' || subStrategyKey === 'mf_deep_value_add') {
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
      action: 'If replacement pricing is within 25bps of current all-in, refi instead of extend',
      severity: 'warning',
      phase: 0,
    });
  }

  if (subStrategyKey.includes('brrrr') || subStrategyKey.includes('sfr')) {
    triggers.push({
      id: 'dscr-loan-test',
      condition: `DSCR ≥ 1.20 at stabilized rent — enables DSCR refi or portfolio loan`,
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
      action: `Budget rate cap replacement; at current SOFR curve, estimate $150-300K for same-strike cap`,
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
    action: 'Agency rate improves enough to justify refi even with prepay penalty — evaluate savings',
    severity: 'info',
    phase: Math.min(1, phases.length - 1),
  });

  const exitMonth = holdMonths;
  triggers.push({
    id: 'exit-prepay-window',
    condition: `Within 12mo of hold target exit at M${exitMonth}`,
    currentValue: `Hold target: M${exitMonth}`,
    threshold: 'Within 12mo of exit',
    frequency: 'Quarterly',
    action: 'Calculate exact prepay cost (yield maintenance or defeasance). Begin exit planning with capital stack waterfall.',
    severity: 'info',
    phase: phases.length - 1,
  });

  return triggers;
}

function buildPhases(
  mapping: ReturnType<typeof getMappingForKey>,
  rateEnv: RateEnvironmentResult,
  purchasePrice: number,
  holdMonths: number,
  state: string,
  subStrategyKey: string
): DebtPhase[] {
  const phases: DebtPhase[] = [];
  const sofr = rateEnv.sofr;

  const structure = (mapping as any).structure || {};
  const phaseStructure = structure.phase1 || structure;

  const rateType: 'Fixed' | 'Floating' =
    rateEnv.ratePreference === 'Fixed' ? 'Fixed' :
    rateEnv.ratePreference === 'Floating' ? 'Floating' :
    (phaseStructure.rateType || 'Floating') as 'Fixed' | 'Floating';

  const spreadBps = phaseStructure.spread ? Math.round(phaseStructure.spread * 10000) : 275;
  const rateEst = rateType === 'Floating'
    ? sofr + (phaseStructure.spread || 0.0275)
    : (phaseStructure.rate || sofr + 0.015);

  const targetLtv = phaseStructure.targetLtv || phaseStructure.targetLtc || 0.70;
  const phase1LoanM = (purchasePrice * targetLtv) / 1_000_000;
  const termYears = phaseStructure.termYears || 3;
  const ioMonths = phaseStructure.ioMonths || (rateType === 'Floating' ? termYears * 12 : 24);
  const amortYears = phaseStructure.amortYears || (rateType === 'Fixed' ? 30 : 0);

  const phase1Lenders = targetLenders(
    (mapping as any).primaryProduct,
    phase1LoanM,
    state,
    targetLtv,
    true,
    3
  );

  const phase1EndMonth = Math.min(termYears * 12, holdMonths);
  const phase1Triggers = buildMonitoringTriggers(subStrategyKey, holdMonths, [{ rateType, ioMonths }], sofr);

  phases.push({
    phaseIndex: 0,
    phaseLabel: 'Phase 1 — Acquisition',
    product: (mapping as any).primaryProduct,
    productLabel: (mapping as any).primaryProductLabel,
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
    rationale: (mapping as any).rationale,
    lenders: phase1Lenders,
    triggers: phase1Triggers.filter(t => t.phase === 0),
    isRefiEvent: false,
  });

  if (structure.phase2 && holdMonths > (termYears * 12)) {
    const p2 = structure.phase2;
    const refiMonth = p2.triggerMonth || phase1EndMonth;
    const p2Rate = rateEnv.classification === 'Rising'
      ? (p2.rate || 0.055)
      : (p2.rate || sofr + 0.012);
    const p2LoanM = (purchasePrice * (p2.targetLtv || 0.65)) / 1_000_000;
    const p2Lenders = targetLenders(
      p2.product || 'agency_fixed',
      p2LoanM,
      state,
      p2.targetLtv || 0.65,
      true,
      3
    );

    phases.push({
      phaseIndex: 1,
      phaseLabel: 'Phase 2 — Refi / Permanent Financing',
      product: p2.product || 'agency_fixed',
      productLabel: (strategyDebtMapping.productLabels as Record<string,string>)[p2.product] || p2.product || 'Agency Fixed',
      startMonth: refiMonth,
      endMonth: holdMonths,
      loanAmountEst: p2LoanM * 1_000_000,
      termYears: p2.termYears || 10,
      ioMonths: p2.ioMonths || 24,
      amortYears: p2.amortYears || 30,
      rateType: (p2.rateType || 'Fixed') as 'Fixed' | 'Floating',
      rateEst: p2Rate,
      ltv: p2.targetLtv || 0.65,
      origFee: 0.010,
      exitFee: 0,
      prepayType: p2.prepayType || 'yield_maintenance',
      rationale: `At stabilization (M${refiMonth}), refinance to long-term fixed ${(p2.product || '').replace(/_/g, ' ')} to lock in permanent capital and extract equity.`,
      lenders: p2Lenders,
      triggers: phase1Triggers.filter(t => t.phase === 1),
      isRefiEvent: true,
      refiTriggerOcc: p2.triggerOcc,
      refiTriggerDscr: p2.triggerDscr,
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
    rationale: `At exit (M${holdMonths}), pay off outstanding balance plus any prepayment penalty. Cross-reference Taxes tab for transfer tax. Proceeds flow through Capital Stack waterfall.`,
    lenders: [],
    triggers: phase1Triggers.filter(t => t.phase === phases.length - 1),
    isRefiEvent: false,
  });

  return phases;
}

function buildAlternatives(
  mapping: ReturnType<typeof getMappingForKey>,
  rateEnv: RateEnvironmentResult,
  purchasePrice: number
): DebtAlternative[] {
  const alts: DebtAlternative[] = [];
  const alternatives = (mapping as any).alternatives || [];
  const productLabels = strategyDebtMapping.productLabels as Record<string, string>;

  if (alternatives[0]) {
    alts.push({
      label: 'Alt A — Alternative Product',
      product: alternatives[0],
      productLabel: productLabels[alternatives[0]] || alternatives[0].replace(/_/g, ' '),
      rationale: `Alternative lender category for this strategy. Different underwriting standards, pricing, and recourse requirements.`,
      tradeoff: rateEnv.classification === 'Rising'
        ? 'Fixed-rate alternative adds rate certainty but reduces prepay flexibility'
        : 'Floating alternative saves expected 30-50bps over hold but adds rate risk',
      deltaAllInBps: alternatives[0].includes('fixed') || alternatives[0].includes('agency') ? 15 : -20,
    });
  }

  if (rateEnv.classification === 'Rising' && !alternatives[0]?.includes('fixed')) {
    alts.push({
      label: 'Alt B — Rate Certainty',
      product: 'cmbs_10yr',
      productLabel: 'CMBS 10-Year Fixed',
      rationale: 'If sponsor wants zero rate risk in a rising rate environment: lock into 10yr fixed CMBS. Sacrifices prepay flexibility for rate certainty.',
      tradeoff: `In rising rate environment, fixed rate saves estimated +${Math.round(Math.abs(rateEnv.sofrForward12moBps) * 0.6)}bps vs floating over hold`,
      deltaAllInBps: 25,
    });
  }

  if (alternatives[1]) {
    alts.push({
      label: 'Alt C — High-Leverage Option',
      product: alternatives[1],
      productLabel: productLabels[alternatives[1]] || alternatives[1].replace(/_/g, ' '),
      rationale: 'If leverage needs exceed senior capacity: add mezz or subordinate piece. Increases total proceeds but blended cost rises.',
      tradeoff: 'Adding 10% mezz at 12-14% blended raises all-in cost by ~60-90bps',
      deltaAllInBps: 75,
    });
  }

  return alts;
}

async function fetchStrategyCorrelationContext(
  pool: Pool,
  dealId: string,
  strategySlug: string
): Promise<StrategyCorrelationContext | null> {
  try {
    const result = await pool.query(
      `SELECT signal_a, signal_b, lead_lag_months, correlation, implication
       FROM strategy_arbitrage
       WHERE deal_id = $1
       ORDER BY ABS(correlation) DESC LIMIT 1`,
      [dealId]
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    const corr = parseFloat(row.correlation) || 0;
    const rssAdjBps = Math.round(Math.abs(corr) * 40);
    return {
      slug: strategySlug,
      riskScore: corr,
      correlationImplication: row.implication || `${row.signal_a} leads ${row.signal_b} by ${row.lead_lag_months}mo (corr ${corr.toFixed(2)})`,
      rssAdjustmentBps: corr < 0 ? rssAdjBps : -rssAdjBps,
    };
  } catch {
    return null;
  }
}

async function fetchDealContext(dealId: string): Promise<{
  strategySlug: string;
  strategyName: string;
  holdMonths: number;
  propertyType: string;
  purchasePrice: number;
  city: string;
  state: string;
  units: number;
  hasStrategy: boolean;
  riskScore: number;
  roiMetrics: Record<string, any>;
}> {
  const pool = getPool();

  const [dealResult, m08Result] = await Promise.allSettled([
    pool.query(
      `SELECT d.name, d.purchase_price, d.city, d.state, d.units,
              d.project_type, d.property_type_key, d.hold_period_years,
              dd.deal_data
       FROM deals d
       LEFT JOIN deal_data dd ON dd.deal_id = d.id
       WHERE d.id = $1 LIMIT 1`,
      [dealId]
    ),
    pool.query(
      `SELECT strategy_slug, risk_score, roi_metrics, assumptions, recommended
       FROM strategy_analyses
       WHERE deal_id = $1
       ORDER BY recommended DESC, created_at DESC LIMIT 1`,
      [dealId]
    ),
  ]);

  const deal = dealResult.status === 'fulfilled' ? dealResult.value.rows[0] : null;
  const m08 = m08Result.status === 'fulfilled' ? m08Result.value.rows[0] : null;

  const purchasePrice = deal?.purchase_price ? parseFloat(deal.purchase_price) : 5_000_000;
  const holdYears = deal?.hold_period_years ? parseInt(deal.hold_period_years) : 5;
  const dealData = deal?.deal_data || {};
  const holdMonths = (dealData?.hold_period_months) || (holdYears * 12) || 36;

  const strategySlug = m08?.strategy_slug || '';
  const riskScore = m08?.risk_score ? parseFloat(m08.risk_score) : 0;
  const roiMetrics = m08?.roi_metrics || {};

  const strategyName = strategySlug
    ? strategySlug.replace(/-/g, ' ').replace(/_/g, ' ')
    : (deal?.project_type || '');

  return {
    strategySlug,
    strategyName,
    holdMonths,
    propertyType: deal?.project_type || deal?.property_type_key || 'Multifamily',
    purchasePrice,
    city: deal?.city || '',
    state: deal?.state || '',
    units: deal?.units ? parseInt(deal.units) : 0,
    hasStrategy: !!strategySlug,
    riskScore,
    roiMetrics,
  };
}

export async function formulateDebtPlan(dealId: string): Promise<DebtAdvisorResponse> {
  const cached = advisorCache.get(dealId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const pool = getPool();
  const [dealCtx, rateEnv] = await Promise.all([
    fetchDealContext(dealId),
    classifyRateEnvironment(),
  ]);

  const subStrategyKey = detectSubStrategy(dealCtx.strategySlug, dealCtx.strategyName, dealCtx.propertyType);
  const mapping = getMappingForKey(subStrategyKey);
  const phases = buildPhases(mapping, rateEnv, dealCtx.purchasePrice, dealCtx.holdMonths, dealCtx.state, subStrategyKey);
  const alternatives = buildAlternatives(mapping, rateEnv, dealCtx.purchasePrice);

  const correlationContext = await fetchStrategyCorrelationContext(pool, dealId, dealCtx.strategySlug);

  if (correlationContext && correlationContext.rssAdjustmentBps !== 0) {
    alternatives.forEach(alt => {
      alt.deltaAllInBps += correlationContext.rssAdjustmentBps;
    });
  }

  const allTriggers = phases.flatMap(p => p.triggers);
  const uniqueTriggers = allTriggers.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);

  const phase1 = phases[0];
  const totalClosingCosts = phase1
    ? phase1.loanAmountEst * (phase1.origFee + phase1.exitFee) + (phase1.rateType === 'Floating' ? phase1.loanAmountEst * 0.005 : 0)
    : 0;

  const estimatedIrrImpactBps = dealCtx.riskScore > 70
    ? Math.round((dealCtx.riskScore - 70) * 1.5)
    : 0;

  const covenantCushionBps = phase1
    ? Math.round((1.35 - 1.20) * 10000)
    : 1500;

  const result: DebtAdvisorResponse = {
    dealId,
    computedAt: new Date().toISOString(),
    strategyInputs: {
      subStrategyKey,
      strategySlug: dealCtx.strategySlug,
      strategyName: dealCtx.strategyName,
      holdMonths: dealCtx.holdMonths,
      hasStrategy: dealCtx.hasStrategy,
      propertyType: dealCtx.propertyType,
      purchasePrice: dealCtx.purchasePrice,
      city: dealCtx.city,
      state: dealCtx.state,
      units: dealCtx.units,
      riskScore: dealCtx.riskScore,
    },
    rateEnvironment: rateEnv,
    recommendedStack: phases,
    alternatives,
    monitoringTriggers: uniqueTriggers,
    correlationContext,
    summary: {
      primaryProduct: (mapping as any).primaryProduct,
      primaryProductLabel: (mapping as any).primaryProductLabel,
      totalClosingCosts,
      initialLoanAmount: phase1?.loanAmountEst || 0,
      blendedAllInRate: phase1?.rateEst || 0,
      headline: (mapping as any).primaryProductLabel,
      whyStatement: (mapping as any).rationale,
      estimatedIrrImpactBps,
      covenantCushionBps,
    },
  };

  advisorCache.set(dealId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info('[DebtAdvisor] Formulated debt plan', { dealId, subStrategyKey, strategySlug: dealCtx.strategySlug, phases: phases.length });
  return result;
}

export function bustAdvisorCache(dealId: string): void {
  advisorCache.delete(dealId);
}

export async function acceptDebtPlan(
  dealId: string,
  userId: string,
  phaseIndex: number = 0
): Promise<{ success: boolean; message: string }> {
  try {
    const plan = await formulateDebtPlan(dealId);
    const phase = plan.recommendedStack[phaseIndex];
    if (!phase) return { success: false, message: 'Phase not found' };

    const pool = getPool();

    const loanId = 'senior';
    await Promise.all([
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:loanAmount`, 1, phase.loanAmountEst, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:interestRate`, 1, phase.rateEst, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:termYears`, 1, phase.termYears, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:amortYears`, 1, phase.amortYears, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:ioMonths`, 1, phase.ioMonths, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:origFee`, 1, phase.origFee, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:exitFee`, 1, phase.exitFee, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:rateType`, 1, phase.rateType, userId),
      applyFinancialsOverride(pool, dealId, `debt:${loanId}:prepayType`, 1, phase.prepayType, userId),
    ].map(p => p.catch(() => null)));

    bustAdvisorCache(dealId);
    logger.info('[DebtAdvisor] Plan accepted, overrides applied via financials pipeline', { dealId, phaseIndex, loanAmount: phase.loanAmountEst });
    return { success: true, message: 'Debt plan accepted and Configure fields populated' };
  } catch (err: any) {
    logger.error('[DebtAdvisor] acceptDebtPlan failed', { dealId, error: err.message });
    return { success: false, message: err.message };
  }
}
