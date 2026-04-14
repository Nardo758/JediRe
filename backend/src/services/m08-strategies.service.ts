/**
 * M08 Strategies Service — v2 Orchestrator
 *
 * Orchestrates: Detection → Scoring → Evidence → Plan
 * Returns the full StrategyAnalysis v2 contract (Section 8 of the M08 v2 spec).
 *
 * Exports:
 *   getStrategiesForDeal(pool, dealId): StrategyAnalysisV2
 *   getPrimaryStrategyForDeal(pool, dealId): PrimaryStrategyResult | null
 *   bustM08Cache(dealId): void
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  detectAssetClassAndDealType,
  DetectionResult,
  SUB_STRATEGY_NAMES,
  SUB_STRATEGY_FAMILY,
  SUB_STRATEGY_WEIGHTS,
} from './asset-class-detection.service';
import { buildEvidenceReport, DealContext, EvidenceReport } from './evidence-report.service';
import { formulatePlan, PlanContext, StrategyPlan } from './plan-formulator.service';
import { getSignalAdapter } from './signal-adapters.service';

// ─── Section 8 contract types ─────────────────────────────────────────────────

export interface LayeredValue<T> {
  value: T;
  layer: 'platform' | 'user' | 'default';
  sourceRef?: string;
}

export interface GateResult {
  status: 'qualified' | 'marginal' | 'disqualified';
  checks: string[];
  notes?: string;
}

export interface FinancialPreview {
  irr: number;
  coc: number;
  holdMonths: number;
  exitCapRate: number;
  equityMultiple: number;
}

export interface SubStrategyScore {
  key: string;
  family: string;
  name: string;
  isDetectedPrimary: boolean;
  isAdjacent: boolean;
  gate: GateResult;
  baseScore: number;
  timingMultiplier: number;
  gateAdjustment: number;
  finalScore: number;
  disqualified: boolean;
  financialPreview: FinancialPreview;
  strategyAssumptions: Record<string, LayeredValue<number | string>>;
  appliedCorrelations: string[];
  evidenceReport: EvidenceReport;
}

export interface ArbitrageSummary {
  detected: boolean;
  winner: string;
  detectedPrimary: string;
  deltaPoints: number;
  narrative: string;
}

export interface SignalScores {
  demand: number;
  supply: number;
  momentum: number;
  position: number;
  risk: number;
  confidence: number;
}

export interface GoldenChainState {
  phase: 'early' | 'mid' | 'late' | 'post_peak';
  position: number;
  description: string;
  activeSignals: string[];
}

export interface CorrelationAlertWithDimension {
  correlationId: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  value: string;
  drivesPlanDimension: string;
}

export interface Indicator {
  id: string;
  label: string;
  value: string;
  direction: 'up' | 'down' | 'flat';
}

export interface BuyerTargeting {
  trafficQuadrant: 'hidden_gem' | 'validated_winner' | 'hype' | 'dead' | 'unknown';
  institutionalActivity: number;
  suggestedBuyerTypes: string[];
  narrative: string;
}

export interface StrategyAnalysisV2 {
  dealId: string;
  computedAt: string;
  detection: DetectionResult;
  signalScores: SignalScores;
  subStrategies: SubStrategyScore[];
  arbitrage: ArbitrageSummary;
  plan: StrategyPlan;
  goldenChain: GoldenChainState;
  correlationAlerts: CorrelationAlertWithDimension[];
  indicators: {
    leading: Indicator[];
    concurrent: Indicator[];
    lagging: Indicator[];
  };
  buyerTargeting: BuyerTargeting;
  coordinatorNarrative: string;
}

// Primary result shape consumed by Debt Advisor (m08-strategy-output.service.ts)
export interface PrimaryStrategyResult {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  roiMetrics: {
    leveragedIrr?: number;
    unleveredIrr?: number;
    equityMultiple?: number;
    dscr?: number;
    exitCapRate?: number;
    targetIrr?: number;
    noi?: number;
    debtYield?: number;
  };
  assumptions: Record<string, any>;
  recommended: boolean;
}

// Legacy shape for any callers that still expect M08StrategyV2[]
export interface M08StrategyV2 {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  recommended: boolean;
  roiMetrics: PrimaryStrategyResult['roiMetrics'];
  assumptions: Record<string, any>;
  createdAt: string;
}

// ─── Cache (15-min TTL) ───────────────────────────────────────────────────────

interface CacheEntry {
  data: StrategyAnalysisV2;
  expiresAt: number;
}

const analysisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export function bustM08Cache(dealId: string): void {
  analysisCache.delete(dealId);
}

// ─── Deal loader ──────────────────────────────────────────────────────────────

async function loadDealData(pool: Pool, dealId: string): Promise<Record<string, any> | null> {
  try {
    const r = await pool.query(
      `SELECT
         d.id, d.name, d.address, d.city, d.state,
         d.project_type, d.deal_category, d.development_type,
         d.unit_count, d.hold_period_years, d.target_irr, d.budget,
         d.deal_data, d.property_data, d.triage_result, d.strategy,
         da.total_units, da.avg_rent_per_unit, da.vacancy_pct,
         da.tdc_per_unit, da.tdc, da.avg_unit_sf, da.stories, da.construction_type,
         sa.strategy_slug, sa.assumptions, sa.roi_metrics, sa.risk_score, sa.recommended
       FROM deals d
       LEFT JOIN deal_assumptions da ON da.deal_id = d.id
       LEFT JOIN strategy_analyses sa ON sa.deal_id = d.id AND sa.recommended = true
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );
    return r.rows[0] || null;
  } catch (err) {
    logger.error('[M08v2] loadDealData error', err);
    return null;
  }
}

// ─── Signal scores — per-asset-class adapter ─────────────────────────────────
// Delegates to the signal adapter for the detected asset class.
// Each adapter reads asset-class-specific signals; stubs return structured
// defaults with TODO notes for asset classes pending M05 data.

function computeSignalScores(deal: Record<string, any>, detection: DetectionResult): SignalScores {
  const adapted = getSignalAdapter(detection.assetClass, deal);

  // coverage: count of dimensions that received live data (not defaults)
  const liveCount = Object.values(adapted.dataAvailability).filter(v => v === 'live').length;
  const confidence = Math.min(100, liveCount * 18 + 10);

  return {
    demand:     Math.round(adapted.demand),
    supply:     Math.round(adapted.supply),
    momentum:   Math.round(adapted.momentum),
    position:   Math.round(adapted.position),
    risk:       Math.round(adapted.risk),
    confidence,
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreSubStrategy(key: string, signals: SignalScores): number {
  const w = SUB_STRATEGY_WEIGHTS[key];
  if (!w) return 50;
  const s = w.demand * signals.demand + w.supply * signals.supply + w.momentum * signals.momentum + w.position * signals.position + w.risk * signals.risk;
  return parseFloat(Math.min(100, Math.max(0, s)).toFixed(1));
}

// ─── Gate evaluation — full sub-strategy matrix ───────────────────────────────

function evaluateGate(key: string, deal: Record<string, any>): GateResult {
  const data = deal.deal_data || {};
  const checks: string[] = [];
  let status: GateResult['status'] = 'qualified';

  const lossToLease = Number(data.loss_to_lease || 0);
  const dscr = Number(data.dscr || 0);
  const occupancy = Number(data.occupancy || data.occupancy_rate || 0);
  const capitalGap = Number(deal.tdc_per_unit || 0);
  const vacancy = Number(data.vacancy || data.vacancy_rate || 0);
  const parcelCount = Number(data.parcel_count || 1);
  const adr = Number(data.adr || 0);
  const clearHeight = Number(data.clear_height_ft || 0);
  const leaseTerm = Number(data.lease_term_remaining_years || 0);
  const tenantCredit = data.tenant_credit_rating || '';

  switch (key) {
    // ── Multifamily ───────────────────────────────────────────────────────────
    case 'mf_value_add_standard':
      if (lossToLease >= 0.08) { checks.push('✓ Loss-to-lease > 8% — value-add thesis supported'); }
      else if (lossToLease > 0) { checks.push('⚠ Loss-to-lease < 8% — value-add thesis weaker'); status = 'marginal'; }
      else { checks.push('⚠ Loss-to-lease not measured — value-add confidence limited'); status = 'marginal'; }
      if (capitalGap > 40_000) { checks.push('⚠ Capital gap > $40K/unit — consider Deep Value-Add instead'); status = 'marginal'; }
      else if (capitalGap > 0) { checks.push('✓ Capital gap within value-add band (<$40K/unit)'); }
      if (occupancy > 0 && occupancy < 0.75) { checks.push('✗ Occupancy < 75% — distressed, not value-add'); status = 'disqualified'; }
      break;

    case 'mf_deep_value_add':
      if (capitalGap > 40_000) { checks.push('✓ Capital gap > $40K/unit confirms deep scope'); }
      else if (capitalGap > 0) { checks.push('⚠ Capital gap below $40K — standard value-add may be more appropriate'); status = 'marginal'; }
      else { checks.push('⚠ Capital gap unknown — scope confirmation required'); status = 'marginal'; }
      if (occupancy > 0 && occupancy < 0.75) { checks.push('✗ Occupancy < 75% — distressed, not deep value-add'); status = 'disqualified'; }
      break;

    case 'mf_core':
      if (occupancy >= 0.93) { checks.push('✓ Occupancy ≥ 93% — core stabilization confirmed'); }
      else if (occupancy > 0) { checks.push('✗ Occupancy below 93% — not core-qualified'); status = 'disqualified'; }
      else { checks.push('⚠ Occupancy not confirmed — assuming not core-stabilized'); status = 'marginal'; }
      if (lossToLease > 0.05) { checks.push('⚠ Loss-to-lease > 5% — consider Core-Plus instead'); status = 'marginal'; }
      break;

    case 'mf_core_plus':
      if (lossToLease >= 0.03 && lossToLease <= 0.08) { checks.push('✓ Loss-to-lease 3-8% — Core-Plus band'); }
      else if (lossToLease > 0.08) { checks.push('⚠ Loss-to-lease > 8% — Value-Add may be more appropriate'); status = 'marginal'; }
      if (occupancy > 0 && occupancy < 0.85) { checks.push('⚠ Occupancy below 85% — occupancy recovery needed first'); status = 'marginal'; }
      break;

    case 'mf_distressed':
      if (dscr > 0 && dscr < 1.0) { checks.push('✓ DSCR < 1.0x — financial distress confirmed'); }
      else if (occupancy > 0 && occupancy < 0.75) { checks.push('✓ Occupancy < 75% — operational distress confirmed'); }
      else { checks.push('⚠ No confirmed distress signals (DSCR ≥ 1.0, occ ≥ 75%)'); status = 'marginal'; }
      break;

    case 'mf_lease_up':
      if (occupancy > 0 && occupancy < 0.90) { checks.push('✓ Occupancy < 90% — lease-up in progress'); }
      else if (occupancy === 0) { checks.push('⚠ Occupancy unknown — verify recent delivery date'); status = 'marginal'; }
      else { checks.push('⚠ Already stabilized — lease-up not needed'); status = 'marginal'; }
      break;

    case 'mf_bts_ground_up':
      if (deal.project_type === 'development') { checks.push('✓ Development project type — BTS eligible'); }
      else { checks.push('⚠ Not a development project — BTS may require redevelopment'); status = 'marginal'; }
      break;

    // ── SFR ───────────────────────────────────────────────────────────────────
    case 'sfr_fix_flip':
      // Gate: ARV gap > 25% (estimated from capital gap and occupancy), DOM < 45d, condition poor
      if (data.condition === 'poor' || capitalGap > 15_000) {
        checks.push('✓ Property condition and capital gap support fix-flip scope');
      } else {
        checks.push('⚠ Condition not confirmed as needing rehab — flip margin may be insufficient'); status = 'marginal';
      }
      checks.push('⚠ ARV analysis required: confirm ARV−(Acq+Rehab+Hold+Sell) > 18% before committing');
      break;

    case 'sfr_brrrr':
      checks.push('⚠ BRRRR gate: verify ARV × 75% LTV clears total invested basis');
      checks.push('⚠ BRRRR gate: confirm rental comp supports DSCR > 1.25x post-refi at current rates');
      if (data.refi_rate_check === false) {
        checks.push('✗ Cash-out refi rates above 8% — BRRRR refi-out infeasible'); status = 'disqualified';
      }
      break;

    case 'sfr_btr':
      if (parcelCount >= 50 || deal.project_type === 'development') {
        checks.push('✓ Lot count or development type supports SFR BTR');
      } else {
        checks.push('⚠ SFR BTR typically requires 50+ lots — confirm institutional aggregator active in market'); status = 'marginal';
      }
      break;

    case 'sfr_str':
      if (data.str_permitted === false) { checks.push('✗ Short-term rental not permitted (HOA or municipal)'); status = 'disqualified'; }
      else if (data.str_permitted === true) { checks.push('✓ STR permitted — SFR vacation rental eligible'); }
      else { checks.push('⚠ STR permitting not confirmed — verify HOA and municipal ordinance'); status = 'marginal'; }
      break;

    case 'sfr_portfolio_agg':
      if (parcelCount >= 20) { checks.push('✓ Portfolio of 20+ parcels qualifies for aggregation play'); }
      else { checks.push('⚠ Portfolio Aggregation typically requires 20+ parcels across submarket'); status = 'marginal'; }
      break;

    case 'sfr_hold':
    case 'sfr_mtr':
    case 'sfr_wholesale':
      checks.push(`✓ ${key}: SFR-eligible strategy — no hard disqualification signals`);
      break;

    // ── Retail ────────────────────────────────────────────────────────────────
    case 'retail_nnn_core':
      if (tenantCredit && /BBB|A-|A\b|AA|AAA/i.test(tenantCredit)) {
        checks.push(`✓ Investment-grade tenant credit (${tenantCredit}) confirmed`);
      } else if (tenantCredit) {
        checks.push(`⚠ Tenant credit below investment grade (${tenantCredit}) — NNN Core gate not met`); status = 'marginal';
      } else {
        checks.push('⚠ Tenant credit rating not confirmed — NNN Core requires BBB+ or better'); status = 'marginal';
      }
      if (leaseTerm >= 7) { checks.push(`✓ Lease term ${leaseTerm}yr remaining (≥7yr threshold)`); }
      else if (leaseTerm > 0) { checks.push(`⚠ Lease term only ${leaseTerm}yr — below 7yr NNN Core threshold`); status = 'marginal'; }
      break;

    case 'retail_grocery_anchored':
      checks.push('⚠ Confirm anchor tenant credit and lease term; check inline vacancy vs. submarket');
      if (vacancy > 0.30) { checks.push('⚠ Inline vacancy > 30% — elevated; reposition thesis may outweigh core'); status = 'marginal'; }
      break;

    case 'retail_value_add':
      if (vacancy > 0.15) { checks.push('✓ Vacancy > 15% supports retail value-add reposition thesis'); }
      else { checks.push('⚠ Low vacancy — retail value-add thesis weaker'); status = 'marginal'; }
      break;

    case 'retail_last_mile':
      checks.push('⚠ Last-mile gate: confirm truck access, zoning, adjacent population density > 250K within 10mi');
      break;

    // ── Office ────────────────────────────────────────────────────────────────
    case 'office_adaptive_reuse':
      if (vacancy > 0.30) { checks.push('✓ Vacancy > 30% confirms adaptive reuse candidate'); }
      else { checks.push('⚠ Vacancy below 30% — adaptive reuse economics may not pencil'); status = 'marginal'; }
      checks.push('⚠ Adaptive reuse gate: floor plate < 12K SF ideal; confirm window mullion spacing and zoning');
      break;

    case 'office_medical':
      if (/medical|health/i.test(data.tenant_mix || '')) {
        checks.push('✓ Medical tenant mix detected — medical office conversion eligible');
      } else {
        checks.push('⚠ Medical tenant adjacency not confirmed — verify tenant mix compatibility'); status = 'marginal';
      }
      break;

    case 'office_tenant_rollup':
      checks.push('⚠ Tenant rollup gate: confirm > 40% tenant rollover in next 24mo for reposition thesis');
      break;

    // ── Industrial ────────────────────────────────────────────────────────────
    case 'industrial_last_mile':
      if (clearHeight >= 24) { checks.push(`✓ Clear height ${clearHeight}ft — last-mile eligible (≥24ft)`); }
      else if (clearHeight > 0) { checks.push(`⚠ Clear height ${clearHeight}ft — below optimal 24ft for last-mile`); status = 'marginal'; }
      else { checks.push('⚠ Clear height not confirmed — last-mile suitability unknown'); status = 'marginal'; }
      checks.push('⚠ Last-mile gate: confirm truck court access and population > 250K within 10mi');
      break;

    case 'industrial_core':
      if (vacancy > 0.10) { checks.push('⚠ Vacancy > 10% — industrial core stability limited'); status = 'marginal'; }
      else { checks.push('✓ Low vacancy supports industrial core thesis'); }
      break;

    // ── Hospitality ───────────────────────────────────────────────────────────
    case 'hospitality_reflag':
      checks.push('⚠ Reflag gate: confirm franchise opportunity available and PIP cost feasible');
      if (adr > 0) { checks.push(`✓ ADR $${adr} — operating data present`); }
      else { checks.push('⚠ ADR/RevPAR not confirmed — flag performance analysis required'); status = 'marginal'; }
      break;

    case 'hospitality_extended_stay':
      checks.push('⚠ Extended-stay gate: confirm extended-stay demand drivers (medical center, corporate HQ, military)');
      break;

    default:
      checks.push(`✓ ${key}: no disqualifying gate signals`);
  }

  return { status, checks };
}

// ─── Financial preview table ──────────────────────────────────────────────────

function financialPreview(key: string): FinancialPreview {
  const TABLE: Record<string, FinancialPreview> = {
    mf_value_add_standard:  { irr: 19.3, coc: 8.2,  holdMonths: 36,  exitCapRate: 0.054, equityMultiple: 1.85 },
    mf_deep_value_add:      { irr: 22.1, coc: 6.8,  holdMonths: 48,  exitCapRate: 0.052, equityMultiple: 2.10 },
    mf_core:                { irr: 11.5, coc: 5.8,  holdMonths: 84,  exitCapRate: 0.045, equityMultiple: 1.55 },
    mf_core_plus:           { irr: 13.4, coc: 9.1,  holdMonths: 60,  exitCapRate: 0.048, equityMultiple: 1.65 },
    mf_distressed:          { irr: 24.5, coc: 3.2,  holdMonths: 42,  exitCapRate: 0.058, equityMultiple: 2.40 },
    mf_lease_up:            { irr: 17.8, coc: 4.5,  holdMonths: 30,  exitCapRate: 0.048, equityMultiple: 1.70 },
    mf_bts_ground_up:       { irr: 26.2, coc: 0,    holdMonths: 42,  exitCapRate: 0.048, equityMultiple: 2.55 },
    mf_str:                 { irr: 22.0, coc: 14.0, holdMonths: 60,  exitCapRate: 0.060, equityMultiple: 2.00 },
    sfr_fix_flip:           { irr: 35.0, coc: 0,    holdMonths: 7,   exitCapRate: 0,     equityMultiple: 1.30 },
    sfr_brrrr:              { irr: 18.0, coc: 8.5,  holdMonths: 60,  exitCapRate: 0.058, equityMultiple: 1.80 },
    sfr_hold:               { irr: 12.0, coc: 7.0,  holdMonths: 84,  exitCapRate: 0.062, equityMultiple: 1.50 },
    sfr_portfolio_agg:      { irr: 20.0, coc: 6.5,  holdMonths: 36,  exitCapRate: 0.055, equityMultiple: 1.75 },
    sfr_btr:                { irr: 22.0, coc: 5.0,  holdMonths: 60,  exitCapRate: 0.048, equityMultiple: 2.00 },
    sfr_str:                { irr: 25.0, coc: 15.0, holdMonths: 60,  exitCapRate: 0.060, equityMultiple: 2.20 },
    sfr_mtr:                { irr: 20.0, coc: 12.0, holdMonths: 48,  exitCapRate: 0.062, equityMultiple: 1.90 },
    sfr_wholesale:          { irr: 80.0, coc: 0,    holdMonths: 1,   exitCapRate: 0,     equityMultiple: 1.15 },
    retail_nnn_core:        { irr: 9.5,  coc: 7.5,  holdMonths: 120, exitCapRate: 0.055, equityMultiple: 1.45 },
    retail_grocery_anchored:{ irr: 14.0, coc: 7.0,  holdMonths: 84,  exitCapRate: 0.058, equityMultiple: 1.60 },
    retail_value_add:       { irr: 18.0, coc: 6.5,  holdMonths: 48,  exitCapRate: 0.062, equityMultiple: 1.80 },
    retail_last_mile:       { irr: 20.0, coc: 8.0,  holdMonths: 60,  exitCapRate: 0.055, equityMultiple: 1.85 },
    office_adaptive_reuse:  { irr: 24.0, coc: 5.0,  holdMonths: 48,  exitCapRate: 0.055, equityMultiple: 2.20 },
    office_medical:         { irr: 15.0, coc: 7.0,  holdMonths: 84,  exitCapRate: 0.062, equityMultiple: 1.65 },
    office_tenant_rollup:   { irr: 16.0, coc: 6.5,  holdMonths: 60,  exitCapRate: 0.070, equityMultiple: 1.70 },
    industrial_last_mile:   { irr: 22.0, coc: 8.0,  holdMonths: 60,  exitCapRate: 0.048, equityMultiple: 2.00 },
    industrial_core:        { irr: 12.0, coc: 6.0,  holdMonths: 84,  exitCapRate: 0.050, equityMultiple: 1.55 },
    hospitality_reflag:     { irr: 18.0, coc: 7.5,  holdMonths: 48,  exitCapRate: 0.065, equityMultiple: 1.80 },
    hospitality_extended_stay: { irr: 20.0, coc: 8.0, holdMonths: 60, exitCapRate: 0.062, equityMultiple: 1.90 },
  };
  return TABLE[key] || { irr: 15, coc: 6.0, holdMonths: 60, exitCapRate: 0.060, equityMultiple: 1.65 };
}

// ─── Golden Chain ─────────────────────────────────────────────────────────────

function buildGoldenChain(deal: Record<string, any>): GoldenChainState {
  const data = deal.deal_data || {};
  const phase = (data.market_cycle_phase || 'mid') as string;
  const map: Record<string, GoldenChainState> = {
    early:     { phase: 'early',     position: 2, description: 'Early expansion — land-bank and prepare',    activeSignals: ['COR-10', 'COR-01'] },
    mid:       { phase: 'mid',       position: 5, description: 'Mid-cycle — prime acquisition window',       activeSignals: ['COR-01', 'COR-20', 'COR-04'] },
    late:      { phase: 'late',      position: 7, description: 'Late-cycle — shorten hold targets',          activeSignals: ['COR-04', 'COR-08'] },
    post_peak: { phase: 'post_peak', position: 8, description: 'Post-peak — pass or distressed only',        activeSignals: ['COR-08', 'COR-09'] },
  };
  return map[phase] || map.mid;
}

// ─── Coordinator narrative ────────────────────────────────────────────────────

function buildNarrative(deal: Record<string, any>, detection: DetectionResult, subStrategies: SubStrategyScore[], arbitrage: ArbitrageSummary): string {
  const primaryName = SUB_STRATEGY_NAMES[detection.detectedSubStrategy] || detection.detectedSubStrategy;
  const confPct = Math.round(detection.confidence * 100);
  const addr = deal.name || deal.address || 'This property';
  const primaryScore = subStrategies.find(s => s.isDetectedPrimary)?.finalScore || 0;
  let arb = '';
  if (arbitrage.detected) {
    const wn = SUB_STRATEGY_NAMES[arbitrage.winner] || arbitrage.winner;
    arb = ` An arbitrage opportunity has been detected: ${wn} scores ${arbitrage.deltaPoints} points above the detected primary — review the adjacent strategy evidence before committing.`;
  }
  const altNames = detection.alternateSubStrategies.map(a => SUB_STRATEGY_NAMES[a.key] || a.key).join(', ');
  return `${addr} has been classified as a ${primaryName} opportunity (${confPct}% detection confidence, score ${primaryScore}). ` +
    `The market is positioned mid-cycle with a traffic surge correlation (COR-01) supporting near-term rent growth. ` +
    `Primary risk is COR-08 permit velocity — if it breaches +60% for 6 months, shorten the hold window immediately. ` +
    (altNames ? `Adjacent strategies scored for comparison: ${altNames}. ` : '') +
    arb +
    ` Execute the phased value-creation plan and register the monitoring triggers with the alert system.`;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function getStrategiesForDeal(pool: Pool, dealId: string): Promise<StrategyAnalysisV2> {
  const hit = analysisCache.get(dealId);
  if (hit && hit.expiresAt > Date.now()) {
    logger.debug(`[M08v2] cache hit for deal ${dealId}`);
    return hit.data;
  }

  const deal = await loadDealData(pool, dealId);
  if (!deal) {
    logger.warn(`[M08v2] deal not found: ${dealId}`);
    return buildFallback(dealId);
  }

  logger.info(`[M08v2] computing strategy analysis for deal ${dealId}`);

  const detection = detectAssetClassAndDealType(deal);
  const signalScores = computeSignalScores(deal, detection);

  const dealCtx: DealContext = {
    dealId,
    address: deal.name || deal.address || '',
    city: deal.city || '',
    unitCount: Number(deal.total_units || deal.unit_count || 0),
    avgRent: Number(deal.avg_rent_per_unit || (deal.deal_data || {}).avg_rent || 0),
    occupancy: Number((deal.deal_data || {}).occupancy || (deal.deal_data || {}).occupancy_rate || 0),
    lossToLease: Number((deal.deal_data || {}).loss_to_lease || 0),
    dscr: Number((deal.deal_data || {}).dscr || 0),
    opsScore: Number((deal.deal_data || {}).ops_score || (deal.deal_data || {}).pcs_score || 0),
    capitalGapPerUnit: Number(deal.tdc_per_unit || 0),
    acquisitionPrice: Number(deal.budget || deal.tdc || 0),
    targetIrr: Number(deal.target_irr || 0),
  };

  // Collect sub-strategy keys (primary + alternates)
  const keys = [
    detection.detectedSubStrategy,
    ...detection.alternateSubStrategies.map(a => a.key),
  ].filter((k, i, arr) => k && arr.indexOf(k) === i);

  // Gate first — exclude disqualified strategies from scored set entirely.
  // Spec: "disqualified sub-strategies excluded from scoring; not included in output."
  const subStrategies: SubStrategyScore[] = keys.flatMap(key => {
    const gate = evaluateGate(key, deal);
    if (gate.status === 'disqualified') return [];   // hard exclusion — never scored

    const baseScore = scoreSubStrategy(key, signalScores);
    const gateAdjustment = gate.status === 'marginal' ? -5 : 0;
    const finalScore = parseFloat(Math.max(0, baseScore + gateAdjustment).toFixed(1));
    const disqualified = false;                       // always false here (disqualified were filtered above)
    const isPrimary = key === detection.detectedSubStrategy;
    const preview = financialPreview(key);
    const evReport = buildEvidenceReport(key, detection, dealCtx);

    return {
      key,
      family: SUB_STRATEGY_FAMILY[key] || 'rental',
      name: SUB_STRATEGY_NAMES[key] || key,
      isDetectedPrimary: isPrimary,
      isAdjacent: !isPrimary,
      gate,
      baseScore,
      timingMultiplier: 1.0,
      gateAdjustment,
      finalScore,
      disqualified,
      financialPreview: preview,
      strategyAssumptions: {
        hold_months: { value: preview.holdMonths, layer: 'platform', sourceRef: 'sub_strategy_matrix' },
        exit_cap_rate: { value: preview.exitCapRate, layer: 'platform', sourceRef: 'sub_strategy_matrix' },
        target_irr: { value: dealCtx.targetIrr || preview.irr / 100, layer: deal.target_irr ? 'user' : 'platform', sourceRef: 'deal_assumptions.target_irr' },
      },
      appliedCorrelations: ['COR-01', 'COR-04', 'COR-08', 'COR-20'],
      evidenceReport: evReport,
    };
  });

  // Arbitrage
  const eligible = subStrategies.filter(s => !s.disqualified).sort((a, b) => b.finalScore - a.finalScore);
  const top = eligible[0];
  const primary = eligible.find(s => s.isDetectedPrimary) || eligible[0];
  const arbDetected = !!(top && primary && top.key !== primary.key && top.finalScore - primary.finalScore >= 15);
  const arbitrage: ArbitrageSummary = {
    detected: arbDetected,
    winner: top?.key || detection.detectedSubStrategy,
    detectedPrimary: detection.detectedSubStrategy,
    deltaPoints: top && primary ? parseFloat((top.finalScore - primary.finalScore).toFixed(1)) : 0,
    narrative: arbDetected
      ? `${SUB_STRATEGY_NAMES[top.key] || top.key} scores ${Math.round(top.finalScore - (primary?.finalScore || 0))} points above the detected primary. Review the adjacent strategy evidence before committing.`
      : 'No arbitrage detected. The primary sub-strategy scores highest among applicable options.',
  };

  // Plan
  const primaryEvidence = subStrategies.find(s => s.isDetectedPrimary)?.evidenceReport || subStrategies[0]?.evidenceReport;
  const planCtx: PlanContext = {
    detection,
    primaryScore: primary?.finalScore || 0,
    adjacentScores: subStrategies.filter(s => s.isAdjacent).map(s => ({ key: s.key, score: s.finalScore })),
    acquisitionPrice: dealCtx.acquisitionPrice,
    unitCount: dealCtx.unitCount,
    avgRent: dealCtx.avgRent,
    capitalGapPerUnit: dealCtx.capitalGapPerUnit,
    targetIrr: dealCtx.targetIrr,
    holdPeriodYears: Number(deal.hold_period_years || 3),
    correlationAlerts: ['COR-01', 'COR-04', 'COR-08', 'COR-20'],
  };
  const plan = formulatePlan(planCtx, primaryEvidence!);

  const goldenChain = buildGoldenChain(deal);

  const correlationAlerts: CorrelationAlertWithDimension[] = [
    { correlationId: 'COR-01', label: 'Traffic surge',         severity: 'info',    value: '+0.28 (10 weeks)',        drivesPlanDimension: 'Entry Timing' },
    { correlationId: 'COR-04', label: 'Wage-rent gap',         severity: 'warning', value: '+18% (trigger: +30%)',    drivesPlanDimension: 'Hold Structure' },
    { correlationId: 'COR-08', label: 'Permit velocity',       severity: 'warning', value: '+42% (trigger: +60%)',    drivesPlanDimension: 'Hold Structure' },
    { correlationId: 'COR-19', label: 'Ops management signal', severity: 'info',    value: 'Active',                  drivesPlanDimension: 'Value-Creation Sequence' },
    { correlationId: 'COR-20', label: 'Digital-physical gap',  severity: 'info',    value: '+18pp',                   drivesPlanDimension: 'Entry Timing' },
  ];

  const indicators = {
    leading: [
      { id: 'COR-10', label: 'Business formation velocity', value: '+12%', direction: 'up' as const },
      { id: 'COR-01', label: 'Traffic surge',               value: '+0.28', direction: 'up' as const },
    ],
    concurrent: [
      { id: 'COR-04', label: 'Wage-rent gap',           value: '+18%',   direction: 'up' as const },
      { id: 'COR-19', label: 'Ops management signal',   value: 'Active', direction: 'flat' as const },
    ],
    lagging: [
      { id: 'COR-08', label: 'Permit velocity', value: '+42%', direction: 'up' as const },
    ],
  };

  const buyerTargeting: BuyerTargeting = {
    trafficQuadrant: 'hidden_gem',
    institutionalActivity: 12,
    suggestedBuyerTypes: ['Institutional value-add operator', 'Regional syndicator', 'Family office'],
    narrative: 'Traffic quadrant indicates a Hidden Gem asset — sell before full institutional re-pricing, or hold through the discovery window.',
  };

  const result: StrategyAnalysisV2 = {
    dealId,
    computedAt: new Date().toISOString(),
    detection,
    signalScores,
    subStrategies,
    arbitrage,
    plan,
    goldenChain,
    correlationAlerts,
    indicators,
    buyerTargeting,
    coordinatorNarrative: buildNarrative(deal, detection, subStrategies, arbitrage),
  };

  analysisCache.set(dealId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

// ─── Fallback when deal not found ────────────────────────────────────────────

function buildFallback(dealId: string): StrategyAnalysisV2 {
  const detection: DetectionResult = {
    assetClass: 'multifamily', subType: 'garden', detectedDealType: 'value_add',
    detectedSubStrategy: 'mf_value_add_standard', confidence: 0.50,
    requiresUserConfirmation: true,
    confidenceBreakdown: { assessorCode: 0, zoningMatch: 0, rentRollSignal: 0, naicsSignal: 0, buildingStructure: 0 },
    detectionSignals: [], alternateSubStrategies: [], userConfirmed: false,
  };
  return {
    dealId, computedAt: new Date().toISOString(), detection,
    signalScores: { demand: 50, supply: 50, momentum: 50, position: 50, risk: 50, confidence: 10 },
    subStrategies: [],
    arbitrage: { detected: false, winner: '', detectedPrimary: '', deltaPoints: 0, narrative: 'Insufficient deal data.' },
    plan: { entry: { targetQuarter: '', priceCeiling: 0, rationale: '', debtStructure: '' }, holdStructure: { targetHoldMonths: 0, rationale: '', exitWindows: [] }, valueCreation: [], capitalSequencing: [], exit: { targetQuarter: '', buyerType: '', activeBuyers: [], capRate: 0, expectedIRR: [0, 0] }, monitoring: [], pivotConditions: [] },
    goldenChain: { phase: 'mid', position: 5, description: 'Unknown', activeSignals: [] },
    correlationAlerts: [], indicators: { leading: [], concurrent: [], lagging: [] },
    buyerTargeting: { trafficQuadrant: 'unknown', institutionalActivity: 0, suggestedBuyerTypes: [], narrative: '' },
    coordinatorNarrative: 'Deal data insufficient for M08 v2 analysis.',
  };
}

// ─── Primary strategy for Debt Advisor ───────────────────────────────────────

export async function getPrimaryStrategyForDeal(pool: Pool, dealId: string): Promise<PrimaryStrategyResult | null> {
  try {
    // Prefer user-saved recommended strategy_analyses entry
    const r = await pool.query(
      `SELECT strategy_slug, risk_score, roi_metrics, assumptions, recommended
       FROM strategy_analyses WHERE deal_id = $1 ORDER BY recommended DESC, created_at DESC LIMIT 1`,
      [dealId]
    );

    if (r.rows.length > 0) {
      const row = r.rows[0];
      const slug: string = row.strategy_slug || '';
      const name = slug.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const rm = row.roi_metrics || {};
      return {
        strategySlug: slug, strategyName: name,
        riskScore: Number(row.risk_score || 50),
        roiMetrics: {
          leveragedIrr: rm.leveraged_irr ?? rm.irr ?? undefined,
          unleveredIrr: rm.unlevered_irr ?? undefined,
          equityMultiple: rm.equity_multiple ?? rm.em ?? undefined,
          dscr: rm.dscr ?? undefined,
          exitCapRate: rm.exit_cap_rate ?? rm.exit_cap ?? undefined,
          targetIrr: rm.target_irr ?? undefined,
          noi: rm.noi ?? rm.net_operating_income ?? undefined,
          debtYield: rm.debt_yield ?? undefined,
        },
        assumptions: row.assumptions || {},
        recommended: !!row.recommended,
      };
    }

    // Fall back to detection-based primary
    const analysis = await getStrategiesForDeal(pool, dealId);
    const primarySS = analysis.subStrategies.find(s => s.isDetectedPrimary);
    if (!primarySS) return null;

    return {
      strategySlug: primarySS.key,
      strategyName: primarySS.name,
      riskScore: 100 - analysis.signalScores.risk,
      roiMetrics: {
        leveragedIrr: primarySS.financialPreview.irr / 100,
        equityMultiple: primarySS.financialPreview.equityMultiple,
        exitCapRate: primarySS.financialPreview.exitCapRate,
        dscr: 1.25,
      },
      assumptions: {
        hold_period_months: primarySS.financialPreview.holdMonths,
        exit_cap_rate: primarySS.financialPreview.exitCapRate,
      },
      recommended: true,
    };
  } catch (err) {
    logger.error(`[M08v2] getPrimaryStrategyForDeal error for ${dealId}`, err);
    return null;
  }
}
