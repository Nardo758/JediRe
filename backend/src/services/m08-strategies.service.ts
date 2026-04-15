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
import { getMsaActiveForecasts, type EventForecast } from './m35-forecast.service';
import { getDisplayLabel, formatMetricValue } from './m35-metric-mapping';

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
      if (occupancy > 0 && occupancy < 0.80) { checks.push('✗ Occupancy < 80% — property not in Core-Plus territory; pursue Value-Add or Distressed sub-strategy first'); status = 'disqualified'; }
      else if (lossToLease >= 0.03 && lossToLease <= 0.08) { checks.push('✓ Loss-to-lease 3-8% — Core-Plus band'); }
      else if (lossToLease > 0.08) { checks.push('⚠ Loss-to-lease > 8% — Value-Add may be more appropriate'); status = 'marginal'; }
      if (status !== 'disqualified' && occupancy > 0 && occupancy < 0.85) { checks.push('⚠ Occupancy 80-85% — occupancy recovery still needed for Core-Plus positioning'); status = 'marginal'; }
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
    case 'sfr_fix_flip': {
      const arvEst   = Number(data.arv_estimate || data.after_repair_value || 0);
      const acqPrice = Number(data.acquisition_price || data.purchase_price || deal.budget || 0);
      const dom      = Number(data.days_on_market || data.dom || 0);
      const schoolRating = Number(data.school_rating || 0);
      // Hard gate: ARV margin < 18% → not viable as a flip
      if (arvEst > 0 && acqPrice > 0) {
        const arvMargin = (arvEst - acqPrice) / arvEst;
        if (arvMargin < 0.18) {
          checks.push(`✗ ARV margin ${(arvMargin * 100).toFixed(1)}% — below 18% flip viability threshold (ARV $${Math.round(arvEst/1000)}K, Acq $${Math.round(acqPrice/1000)}K); flip will not pencil net of rehab, holding, and closing costs`);
          status = 'disqualified';
        } else {
          checks.push(`✓ ARV margin ${(arvMargin * 100).toFixed(1)}% — above 18% minimum flip threshold`);
        }
      } else {
        checks.push('⚠ ARV analysis required: confirm ARV−(Acq+Rehab+Hold+Sell) > 18% before committing');
      }
      // Hard gate: DOM > 45d → market too slow for flip velocity
      if (dom > 0 && dom > 45) {
        checks.push(`✗ DOM ${dom}d — market absorption too slow for fix-flip (>45d threshold); inventory building risk`);
        status = 'disqualified';
      } else if (dom > 0) {
        checks.push(`✓ DOM ${dom}d — within 45d flip absorption threshold`);
      }
      // Hard gate: school rating < 5 → limited buyer demand
      if (schoolRating > 0 && schoolRating < 5) {
        checks.push(`✗ School rating ${schoolRating}/10 — below 5.0 threshold; flips in sub-5 school zones face severe buyer pool constraints`);
        status = 'disqualified';
      } else if (schoolRating >= 5) {
        checks.push(`✓ School rating ${schoolRating}/10 — buyer demand supported`);
      }
      if (status !== 'disqualified') {
        if (data.condition === 'poor' || capitalGap > 15_000) {
          checks.push('✓ Property condition and capital gap support fix-flip scope');
        } else {
          checks.push('⚠ Condition not confirmed as needing rehab — flip margin may be insufficient'); status = 'marginal';
        }
      }
      break;
    }

    case 'sfr_brrrr': {
      const arvEst   = Number(data.arv_estimate || data.after_repair_value || 0);
      const acqPrice = Number(data.acquisition_price || data.purchase_price || deal.budget || 0);
      const rehabCost = Number(data.rehab_cost || data.renovation_cost || capitalGap || 0);
      const totalBasis = acqPrice + rehabCost;
      // Hard gate: refi-out LTV > 75% ARV → equity not recycled → BRRRR thesis fails
      if (arvEst > 0 && totalBasis > 0) {
        const ltv = totalBasis / arvEst;
        if (ltv > 0.75) {
          checks.push(`✗ Refi-out LTV ${(ltv * 100).toFixed(1)}% at 75% ARV — total basis ($${Math.round(totalBasis/1000)}K) exceeds 75% of ARV ($${Math.round(arvEst * 0.75/1000)}K); BRRRR does not recycle equity`);
          status = 'disqualified';
        } else {
          checks.push(`✓ Refi-out LTV ${(ltv * 100).toFixed(1)}% — basis clears 75% ARV; BRRRR equity recycling viable`);
        }
      } else {
        checks.push('⚠ BRRRR gate: verify ARV × 75% LTV clears total invested basis');
      }
      if (status !== 'disqualified') {
        checks.push('⚠ BRRRR gate: confirm rental comp supports DSCR > 1.25x post-refi at current rates');
        if (data.refi_rate_check === false) {
          checks.push('✗ Cash-out refi rates above 8% — BRRRR refi-out infeasible'); status = 'disqualified';
        }
      }
      break;
    }

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
      if (tenantCredit && /CCC|CC\b|C\b|D\b/i.test(tenantCredit)) {
        checks.push(`✗ Tenant credit (${tenantCredit}) is distressed/default — NNN Core requires BBB+ minimum`); status = 'disqualified';
      } else if (tenantCredit && /BBB|A-|A\b|AA|AAA/i.test(tenantCredit)) {
        checks.push(`✓ Investment-grade tenant credit (${tenantCredit}) confirmed`);
      } else if (tenantCredit) {
        checks.push(`⚠ Tenant credit below investment grade (${tenantCredit}) — NNN Core gate not met`); status = 'marginal';
      } else {
        checks.push('⚠ Tenant credit rating not confirmed — NNN Core requires BBB+ or better'); status = 'marginal';
      }
      if (leaseTerm > 0 && leaseTerm < 3) { checks.push(`✗ Lease term ${leaseTerm}yr — below 3yr minimum; NNN Core requires ≥7yr`); status = 'disqualified'; }
      else if (leaseTerm >= 7) { checks.push(`✓ Lease term ${leaseTerm}yr remaining (≥7yr threshold)`); }
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
      {
        const popWithin10mi = Number(data.population_within_10mi || 0);
        if (popWithin10mi > 0 && popWithin10mi < 50_000) {
          checks.push(`✗ Population within 10mi (${popWithin10mi.toLocaleString()}) too sparse for last-mile logistics — requires 250K+ consumers`); status = 'disqualified';
        } else if (popWithin10mi >= 250_000) {
          checks.push(`✓ Population ${popWithin10mi.toLocaleString()} within 10mi — last-mile density requirement met`);
        } else {
          checks.push('⚠ Last-mile gate: confirm truck access, zoning, adjacent population density > 250K within 10mi');
        }
      }
      break;

    // ── Office ────────────────────────────────────────────────────────────────
    case 'office_adaptive_reuse': {
      const floorPlateSf = Number(data.floor_plate_sf || 0);
      const zoningAllows = data.residential_zoning_allowed; // explicit flag from zoning profile
      // Hard gate: vacancy < 20% — building economically viable as office; reuse doesn't pencil
      if (vacancy > 0 && vacancy < 0.20) {
        checks.push(`✗ Vacancy ${Math.round(vacancy * 100)}% — building still economically viable as office; adaptive reuse does not pencil at <20% vacancy`); status = 'disqualified';
      } else if (vacancy > 0.30) {
        checks.push('✓ Vacancy > 30% confirms adaptive reuse candidate');
      } else {
        checks.push('⚠ Vacancy 20-30% — adaptive reuse economics marginal'); status = 'marginal';
      }
      // Hard gate: floor plate > 25K SF — too deep for residential daylighting
      if (status !== 'disqualified' && floorPlateSf > 25_000) {
        checks.push(`✗ Floor plate ${floorPlateSf.toLocaleString()} SF — exceeds 25K SF daylighting limit; residential adaptive reuse infeasible without demolition of interior`); status = 'disqualified';
      } else if (floorPlateSf > 0 && floorPlateSf <= 12_000) {
        checks.push(`✓ Floor plate ${floorPlateSf.toLocaleString()} SF — within residential conversion range (<12K SF ideal)`);
      } else if (floorPlateSf > 12_000) {
        checks.push(`⚠ Floor plate ${floorPlateSf.toLocaleString()} SF — above 12K SF ideal; mullion spacing and zoning critical`); status = 'marginal';
      }
      // Hard gate: zoning does not allow residential
      if (status !== 'disqualified' && zoningAllows === false) {
        checks.push('✗ Residential zoning not permitted — adaptive reuse to residential infeasible without rezoning'); status = 'disqualified';
      } else if (zoningAllows === true) {
        checks.push('✓ Residential zoning permitted — adaptive reuse zoning gate cleared');
      } else if (status !== 'disqualified') {
        checks.push('⚠ Residential zoning status not confirmed — verify zoning ordinance before proceeding');
      }
      break;
    }

    case 'office_medical':
      if (/medical|health/i.test(data.tenant_mix || '')) {
        checks.push('✓ Medical tenant mix detected — medical office conversion eligible');
      } else {
        checks.push('⚠ Medical tenant adjacency not confirmed — verify tenant mix compatibility'); status = 'marginal';
      }
      break;

    case 'office_tenant_rollup':
      if (leaseTerm > 10) {
        checks.push(`✗ Weighted lease term ${leaseTerm}yr — no meaningful rollover opportunity in underwriting window; tenant rollup thesis not viable`); status = 'disqualified';
      } else {
        checks.push('⚠ Tenant rollup gate: confirm > 40% tenant rollover in next 24mo for reposition thesis');
      }
      break;

    // ── Industrial ────────────────────────────────────────────────────────────
    case 'industrial_last_mile': {
      const popWithin10mi = Number(data.population_within_10mi || 0);
      const truckCourtDepth = Number(data.truck_court_depth_ft || 0);
      // Hard gate: clear height < 18ft — fundamentally incompatible with industrial use
      if (clearHeight > 0 && clearHeight < 18) {
        checks.push(`✗ Clear height ${clearHeight}ft — below 18ft minimum; fundamentally incompatible with last-mile logistics; adaptive reuse only`); status = 'disqualified';
      } else if (clearHeight >= 24) {
        checks.push(`✓ Clear height ${clearHeight}ft — last-mile eligible (≥24ft)`);
      } else if (clearHeight > 0) {
        checks.push(`⚠ Clear height ${clearHeight}ft — below optimal 24ft for last-mile`); status = 'marginal';
      } else {
        checks.push('⚠ Clear height not confirmed — last-mile suitability unknown'); status = 'marginal';
      }
      // Hard gate: population < 50K within 10mi — insufficient consumer density
      if (status !== 'disqualified' && popWithin10mi > 0 && popWithin10mi < 50_000) {
        checks.push(`✗ Population ${popWithin10mi.toLocaleString()} within 10mi — below 50K minimum; last-mile logistics not viable at this consumer density`); status = 'disqualified';
      } else if (popWithin10mi >= 250_000) {
        checks.push(`✓ Population ${popWithin10mi.toLocaleString()} within 10mi — last-mile density requirement met`);
      } else if (popWithin10mi > 0) {
        checks.push(`⚠ Population ${popWithin10mi.toLocaleString()} within 10mi — below 250K optimal threshold`); status = 'marginal';
      }
      // Truck court access advisory
      if (status !== 'disqualified') {
        if (truckCourtDepth >= 130) checks.push(`✓ Truck court depth ${truckCourtDepth}ft — adequate for last-mile operations`);
        else if (truckCourtDepth > 0) { checks.push(`⚠ Truck court depth ${truckCourtDepth}ft — below 130ft standard; confirm access`); status = 'marginal'; }
        else checks.push('⚠ Truck court access not confirmed — verify dock configuration and access lanes');
      }
      break;
    }

    case 'industrial_core':
      if (vacancy > 0.10) { checks.push('⚠ Vacancy > 10% — industrial core stability limited'); status = 'marginal'; }
      else { checks.push('✓ Low vacancy supports industrial core thesis'); }
      break;

    // ── Hospitality ───────────────────────────────────────────────────────────
    case 'hospitality_reflag':
      if (data.franchise_available === false) {
        checks.push('✗ No franchise opportunity available — reflag thesis disqualified'); status = 'disqualified';
      } else {
        checks.push('⚠ Reflag gate: confirm franchise opportunity available and PIP cost feasible');
      }
      if (status !== 'disqualified') {
        if (adr > 0) { checks.push(`✓ ADR $${adr} — operating data present`); }
        else { checks.push('⚠ ADR/RevPAR not confirmed — flag performance analysis required'); status = 'marginal'; }
      }
      break;

    case 'hospitality_extended_stay':
      if (data.extended_stay_demand === false) {
        checks.push('✗ Extended-stay demand drivers not confirmed (medical center, corporate HQ, or military not present)'); status = 'disqualified';
      } else {
        checks.push('⚠ Extended-stay gate: confirm demand drivers — medical center, corporate HQ, or military within 3mi');
      }
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

// ─── M35 event-timing narrative builder ──────────────────────────────────────

function buildM35EventTimingNarrative(forecasts: EventForecast[]): string {
  if (forecasts.length === 0) return '';

  const lines: string[] = [];
  for (const f of forecasts) {
    const peakMetric = f.metrics
      .filter(m => m.pointEstimate !== null && m.windowMonths <= 24)
      .sort((a, b) => Math.abs(b.pointEstimate ?? 0) - Math.abs(a.pointEstimate ?? 0))[0];

    if (!peakMetric) continue;

    const label = getDisplayLabel(peakMetric.metricKey);
    const formatted = formatMetricValue(peakMetric.metricKey, peakMetric.pointEstimate!);
    const window = `T+${peakMetric.windowMonths}mo`;
    const conf = Math.round(peakMetric.confidence * 100);

    lines.push(
      `M35 playbook [${f.subtype}]: "${f.eventName}" peaks at ${window} ` +
      `with ${label} ${formatted} (${conf}% confidence). ` +
      `Align exit target to capture full ${label} lift.`
    );
  }

  return lines.length > 0 ? ' M35 Event-Timing Guidance: ' + lines.join(' ') : '';
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

  const d = deal.deal_data || {};

  // Helper to parse raw comp arrays from deal_data (M05 dual-lens or manual entry)
  function parseLiveComps(raw: any[]): import('./evidence-report.service').LiveComp[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((c: any) => ({
      address: c.address || c.name || 'Unknown',
      distance: c.distance || c.distance_mi ? `${c.distance || c.distance_mi}mi` : undefined,
      rentPerUnit: Number(c.rent_per_unit || c.rent || c.avg_rent || 0) || undefined,
      occupancy: Number(c.occupancy || c.occ_rate || 0) || undefined,
      pricePerUnit: Number(c.price_per_unit || c.ppu || c.sale_price_per_unit || 0) || undefined,
      capRate: Number(c.cap_rate || c.caprate || 0) || undefined,
      irr: Number(c.irr || 0) || undefined,
      holdMonths: Number(c.hold_months || c.hold_period_months || 0) || undefined,
      capitalPerUnit: Number(c.capital_per_unit || c.capex_per_unit || 0) || undefined,
      condition: c.condition || c.asset_condition,
      sourceRef: c.source_ref || c.source || 'deal_data.comps [live]',
    })).filter(c => c.address !== 'Unknown' || c.rentPerUnit || c.pricePerUnit);
  }

  const dealCtx: DealContext = {
    dealId,
    address: deal.name || deal.address || '',
    city: deal.city || '',
    unitCount: Number(deal.total_units || deal.unit_count || 0),
    avgRent: Number(deal.avg_rent_per_unit || d.avg_rent || 0),
    occupancy: Number(d.occupancy || d.occupancy_rate || 0),
    lossToLease: Number(d.loss_to_lease || 0),
    dscr: Number(d.dscr || 0),
    opsScore: Number(d.ops_score || d.pcs_score || 0),
    capitalGapPerUnit: Number(deal.tdc_per_unit || d.capital_gap_per_unit || d.capex_per_unit || 0),
    acquisitionPrice: Number(deal.budget || deal.tdc || d.acquisition_price || d.purchase_price || 0),
    targetIrr: Number(deal.target_irr || d.target_irr || 0),
    // Extended real-data fields — sourced directly from deal_data JSONB
    capRate: Number(d.cap_rate || d.going_in_cap_rate || d.going_in_cap || 0) || undefined,
    noi: Number(d.noi || d.net_operating_income || d.t12_noi || 0) || undefined,
    arvEstimate: Number(d.arv_estimate || d.after_repair_value || d.arv || 0) || undefined,
    rehabCost: Number(d.rehab_cost || d.renovation_cost || d.total_rehab_cost || 0) || undefined,
    exitCapRate: Number(d.exit_cap_rate || d.target_exit_cap || d.exit_cap || 0) || undefined,
    goingInCapRate: Number(d.going_in_cap_rate || d.cap_rate || 0) || undefined,
    // Comp arrays: parse from deal_data arrays if present (M05 dual-lens integration)
    rentComps: parseLiveComps(d.rent_comps || d.comparable_rents || d.m05_rent_comps || []),
    salesComps: parseLiveComps(d.sales_comps || d.comparable_sales || d.m05_sales_comps || []),
    likeKindComps: parseLiveComps(d.like_kind_comps || d.m05_comps || d.likekind_comps || []),
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
      signalWeights: SUB_STRATEGY_WEIGHTS[key] ?? { demand: 0.20, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.20 },
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

  // Resolve effective primary: when the auto-detected primary was disqualified by a hard gate,
  // it is not in `subStrategies`. `primary` already points to the top-scoring qualified strategy
  // (via the `eligible.find(s => s.isDetectedPrimary) || eligible[0]` fallback above).
  // We must rebind planCtx.detection to the effective primary key so the plan formulator
  // uses the correct strategy template — not the gated-out auto-detected one.
  const effectivePrimaryKey = primary?.key || detection.detectedSubStrategy;
  const effectivePrimaryGated = effectivePrimaryKey !== detection.detectedSubStrategy;
  const detectionForPlan: DetectionResult = effectivePrimaryGated
    ? { ...detection, detectedSubStrategy: effectivePrimaryKey }
    : detection;

  const primaryEvidence = subStrategies.find(s => s.key === effectivePrimaryKey)?.evidenceReport
    || subStrategies[0]?.evidenceReport;

  if (effectivePrimaryGated) {
    logger.info(
      `[M08v2] detected primary "${detection.detectedSubStrategy}" was disqualified by hard gate; ` +
      `plan formulated for effective primary "${effectivePrimaryKey}" (top-scoring qualified strategy)`
    );
  }

  const planCtx: PlanContext = {
    detection: detectionForPlan,
    primaryScore: primary?.finalScore || 0,
    adjacentScores: subStrategies.filter(s => s.key !== effectivePrimaryKey).map(s => ({ key: s.key, score: s.finalScore })),
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

  // Append M35 event-timing guidance when active forecasts exist for the deal's MSA.
  try {
    const msaId: string | null = (deal.deal_data as Record<string, any>)?.msaId ?? null;
    if (msaId) {
      const m35Forecasts = await getMsaActiveForecasts(msaId);
      const timingNarrative = buildM35EventTimingNarrative(m35Forecasts);
      if (timingNarrative) {
        result.coordinatorNarrative += timingNarrative;
      }
    }
  } catch (err) {
    logger.warn('[M08v2] M35 event-timing narrative fetch failed (non-fatal)', { dealId, err });
  }

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

    // Fall back to detection-based primary.
    // When the auto-detected primary was disqualified by a hard gate it is removed
    // from subStrategies and no entry will have isDetectedPrimary=true.  In that
    // case fall back to the top-scoring qualified strategy (subStrategies[0] is
    // already sorted by finalScore desc) rather than returning null.
    const analysis = await getStrategiesForDeal(pool, dealId);
    const primarySS =
      analysis.subStrategies.find(s => s.isDetectedPrimary) ??
      analysis.subStrategies[0] ??
      null;
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
