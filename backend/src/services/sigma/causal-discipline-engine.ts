/**
 * Causal Discipline Engine — Channel Routing & Cause/Symptom Separation
 *
 * Implements the two architectural invariants from M08 Addendum:
 *
 * Invariant A — Channel Routing:
 *   Every event has a single primary channel of impact. Events flow through
 *   their primary channel only. Downstream effects appear via cross-module
 *   integration, never via parallel event injection.
 *
 * Invariant B — Cause/Symptom Separation:
 *   Strategy scores compose multiplicatively from a projected component
 *   (built from causal inputs) and a validation component (built from
 *   symptom observations). Causes and symptoms are never additively combined.
 *
 * spec: Causal_Discipline_Addendum.md
 */

import type { Logger } from 'pino';
import { createLogger } from '../utils/logger';
import { calibrationLedger } from './calibration-ledger';
import { hmmRegimeClassifier } from './hmm-regime-classifier';
import { analogEngine } from './analog-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PrimaryChannel = 'M07_traffic' | 'M09_proforma_direct' | 'M03_devcap' | 'M14_macro' | 'multi_channel';
export type MetricCategory = 'cause' | 'symptom' | 'state';
export type QuadrantState = 'confirmed_strong' | 'hidden_gem' | 'frothy' | 'confirmed_weak'
  | 'confirmed_tight' | 'hidden_distress' | 'resilient_absorption' | 'confirmed_loose'
  | 'unknown';

export interface EventTypeDeclaration {
  eventSubtype: string;
  primaryChannel: PrimaryChannel;
  multiChannelPathways?: { channel: PrimaryChannel; pathway: string }[];
  rationale: string;
}

export interface ChannelRoutingPolicy {
  eventSubtype: string;
  primaryChannel: PrimaryChannel;
  allowedSubscribers: string[];
  forbiddenSubscribers: string[];
}

export interface CauseMetric {
  metricId: string;
  name: string;
  category: 'demand_cause' | 'supply_cause' | 'macro_cause';
}

export interface SymptomMetric {
  metricId: string;
  name: string;
  category: 'demand_symptom' | 'supply_symptom' | 'macro_symptom';
}

export interface ExpectedState {
  marketId: string;
  expectedDemandStrength: number;
  expectedSupplyPressure: number;
  confidence: number;
  regime: string;
  nEffective: number;
  computedAt: Date;
}

export interface ObservedState {
  marketId: string;
  observedDemandIntensity: number;
  observedSupplyPressure: number;
  nMetrics: number;
  computedAt: Date;
}

export interface ValidationResult {
  ratio: number;
  validationFactor: number;
  quadrantState: QuadrantState;
}

export interface StrategySubScore {
  dimension: 'demand' | 'supply' | 'momentum' | 'position' | 'risk';
  expected: number;
  observed: number;
  validationFactor: number;
  score: number;
  state: QuadrantState;
  regime: string;
  nEffective: number;
  details: string[];
}

export interface ScoredDeal {
  dealId: string;
  marketId: string;
  subScores: StrategySubScore[];
  compositeScore: number;
  computedAt: Date;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('causal-discipline');

// ─── Constants ─────────────────────────────────────────────────────────────

const V_FLOOR = 0.7;
const V_CEILING = 1.3;

// ─── Event Type Registry (Spec §3.1) ─────────────────────────────────────────

const EVENT_SUBTYPE_REGISTRY: EventTypeDeclaration[] = [
  { eventSubtype: 'employer_expansion', primaryChannel: 'M07_traffic', rationale: 'Creates demand; price/occupancy split is endogenous to M07 market-clearing' },
  { eventSubtype: 'employer_contraction', primaryChannel: 'M07_traffic', rationale: 'Removes demand; same logic in reverse' },
  { eventSubtype: 'major_relocation_announcement', primaryChannel: 'multi_channel',
    multiChannelPathways: [
      { channel: 'M07_traffic', pathway: 'Headcount via M07 — demand pool grows over 6-18 months' },
      { channel: 'M14_macro', pathway: 'Sentiment — cap rate compression in weeks via capital markets' },
    ],
    rationale: 'Headcount and sentiment are causally distinct (housing demand vs capital allocation)' },
  { eventSubtype: 'in_migration_driver', primaryChannel: 'M07_traffic', rationale: 'Demand pool input' },
  { eventSubtype: 'demographic_shift', primaryChannel: 'M07_traffic', rationale: 'Demand composition input' },
  { eventSubtype: 'multifamily_delivery', primaryChannel: 'M07_traffic', rationale: 'Competition for the same demand pool' },
  { eventSubtype: 'multifamily_permit', primaryChannel: 'M07_traffic', rationale: 'Future competition; M03 also reads for development feasibility' },
  { eventSubtype: 'demolition', primaryChannel: 'M07_traffic', rationale: 'Removes competition' },
  { eventSubtype: 'conversion', primaryChannel: 'M07_traffic', rationale: 'Net effect on stock' },
  { eventSubtype: 'rent_control_passage', primaryChannel: 'M09_proforma_direct', rationale: 'Discontinuous policy ceiling; not market-clearing-mediated' },
  { eventSubtype: 'tax_abatement', primaryChannel: 'M09_proforma_direct', rationale: 'Direct expense path change' },
  { eventSubtype: 'entitlement_approval', primaryChannel: 'M03_devcap', rationale: 'Permits developable supply; not present-period market' },
  { eventSubtype: 'zoning_upzoning', primaryChannel: 'M03_devcap', rationale: 'Future supply potential' },
  { eventSubtype: 'rate_move', primaryChannel: 'M14_macro', rationale: 'Macro factor; flows to cap rates and debt directly' },
  { eventSubtype: 'recession_indicator', primaryChannel: 'M14_macro', rationale: 'Macro regime signal' },
  { eventSubtype: 'regional_shock', primaryChannel: 'multi_channel',
    multiChannelPathways: [
      { channel: 'M07_traffic', pathway: 'Demand disruption — damaged inventory removed from market' },
      { channel: 'M14_macro', pathway: 'Risk repricing — insurance costs spike, climate risk premium expands' },
    ],
    rationale: 'Both demand disruption and risk repricing are real, independent pathways' },
];

const CAUSE_METRICS: CauseMetric[] = [
  { metricId: 'employer_concentration', name: 'Employer Event Concentration', category: 'demand_cause' },
  { metricId: 'in_migration_trend', name: 'In-Migration Trend', category: 'demand_cause' },
  { metricId: 'demographic_projection', name: 'Demographic Projection', category: 'demand_cause' },
  { metricId: 'wage_growth_trend', name: 'Wage Growth Trend', category: 'demand_cause' },
  { metricId: 'transportation_infra', name: 'Transportation Infrastructure', category: 'demand_cause' },
  { metricId: 'delivery_pipeline', name: 'Multifamily Delivery Pipeline', category: 'supply_cause' },
  { metricId: 'permit_trend', name: 'Permit Trend', category: 'supply_cause' },
  { metricId: 'demolition_rate', name: 'Demolition Rate', category: 'supply_cause' },
  { metricId: 'conversion_rate', name: 'Conversion Rate', category: 'supply_cause' },
  { metricId: 'regulatory_supply_effect', name: 'Regulatory Supply Effect', category: 'supply_cause' },
  { metricId: 'rate_trend', name: 'Rate Trend', category: 'macro_cause' },
  { metricId: 'recession_probability', name: 'Recession Probability', category: 'macro_cause' },
  { metricId: 'capital_flow_trend', name: 'Capital Flow Trend', category: 'macro_cause' },
];

const SYMPTOM_METRICS: SymptomMetric[] = [
  { metricId: 'C_SURGE_INDEX', name: 'Surge Index', category: 'demand_symptom' },
  { metricId: 'C_TPI', name: 'Traffic Power Index', category: 'demand_symptom' },
  { metricId: 'C_TVS', name: 'Total Visit Score', category: 'demand_symptom' },
  { metricId: 'search_volume_momentum', name: 'Search Volume Momentum', category: 'demand_symptom' },
  { metricId: 'lead_volume', name: 'Lead Volume', category: 'demand_symptom' },
  { metricId: 'application_volume', name: 'Application Volume', category: 'demand_symptom' },
  { metricId: 'days_to_lease', name: 'Days to Lease', category: 'demand_symptom' },
  { metricId: 'social_sentiment', name: 'Social Sentiment', category: 'demand_symptom' },
  { metricId: 'concession_trends', name: 'Concession Trends', category: 'supply_symptom' },
  { metricId: 'days_on_market', name: 'Days on Market', category: 'supply_symptom' },
  { metricId: 'comp_absorption_rate', name: 'Comp Set Absorption Rate', category: 'supply_symptom' },
  { metricId: 'lease_up_velocity', name: 'Lease-Up Velocity Differential', category: 'supply_symptom' },
  { metricId: 'transaction_volume', name: 'Transaction Volume', category: 'macro_symptom' },
  { metricId: 'cap_rate_movement', name: 'Cap Rate Movement', category: 'macro_symptom' },
  { metricId: 'sentiment_score', name: 'Sentiment Score', category: 'macro_symptom' },
];

// ─── Channel Routing Policy (Spec §3.4) ─────────────────────────────────────

const CHANNEL_POLICIES: Record<string, ChannelRoutingPolicy> = {};

function buildChannelPolicies(): void {
  for (const decl of EVENT_SUBTYPE_REGISTRY) {
    if (decl.primaryChannel === 'multi_channel') {
      // For multi-channel, each pathway is independently routed
      // Both allowed
      CHANNEL_POLICIES[decl.eventSubtype] = {
        eventSubtype: decl.eventSubtype,
        primaryChannel: 'multi_channel',
        allowedSubscribers: ['M07', 'M14', 'M37', 'M36', 'M38'],
        forbiddenSubscribers: ['M09', 'M08'],
      };
    } else {
      // Build allowed/forbidden based on primary channel
      const subscribers: ChannelRoutingPolicy = {
        eventSubtype: decl.eventSubtype,
        primaryChannel: decl.primaryChannel,
        allowedSubscribers: ['M37', 'M36', 'M38'],
        forbiddenSubscribers: [],
      };

      // Add primary
      const primaryModule = decl.primaryChannel.split('_')[0] as string; // 'M07', 'M09', etc.
      subscribers.allowedSubscribers.unshift(primaryModule);

      // Forbidden: all downstream modules not in allowed
      const allModules = ['M07', 'M08', 'M09', 'M14', 'M25', 'M03', 'M06'];
      for (const mod of allModules) {
        if (!subscribers.allowedSubscribers.includes(mod) && mod !== primaryModule) {
          if (mod === 'M08' || mod === 'M09' || mod === 'M14' || mod === 'M25') {
            subscribers.forbiddenSubscribers.push(mod);
          }
        }
      }

      CHANNEL_POLICIES[decl.eventSubtype] = subscribers;
    }
  }
}

buildChannelPolicies();

// ─── Class ───────────────────────────────────────────────────────────────────

export class CausalDisciplineEngine {
  // M07 outputs (expected state)
  private expectedStates: Map<string, ExpectedState> = new Map();
  // Observed state (from symptoms)
  private observedStates: Map<string, ObservedState> = new Map();

  constructor() {}

  // ─── Channel Routing (Invariant A) ───────────────────────────────────

  /**
   * Get channel routing declaration for an event subtype.
   * spec §3.1
   */
  getEventChannel(eventSubtype: string): EventTypeDeclaration | undefined {
    return EVENT_SUBTYPE_REGISTRY.find(e => e.eventSubtype === eventSubtype);
  }

  /**
   * Get channel routing policy for an event subtype.
   * spec §3.4
   */
  getChannelPolicy(eventSubtype: string): ChannelRoutingPolicy | undefined {
    return CHANNEL_POLICIES[eventSubtype];
  }

  /**
   * Validate an event against channel routing policy.
   * spec §3.4: Audit mechanism.
   *
   * @returns { valid: boolean; violations: string[] }
   */
  validateEventRouting(eventSubtype: string, subscriber: string): { valid: boolean; violations: string[] } {
    const policy = CHANNEL_POLICIES[eventSubtype];
    if (!policy) {
      return { valid: false, violations: [`No channel policy for event subtype: ${eventSubtype}`] };
    }
    const violations: string[] = [];
    if (policy.forbiddenSubscribers.includes(subscriber)) {
      violations.push(
        `Subscriber ${subscriber} is forbidden for event ${eventSubtype}. ` +
        `Primary: ${policy.primaryChannel}. Must read downstream state instead.`
      );
    }
    return { valid: violations.length === 0, violations };
  }

  /**
   * Get all event type declarations for deployment-time policy check.
   */
  getAllEventDeclarations(): EventTypeDeclaration[] {
    return EVENT_SUBTYPE_REGISTRY;
  }

  getChannelPolicies(): ChannelRoutingPolicy[] {
    return Object.values(CHANNEL_POLICIES);
  }

  // ─── Cause/Symptom Registry ─────────────────────────────────────────

  getCauseMetrics(filterCategory?: string): CauseMetric[] {
    if (filterCategory) return CAUSE_METRICS.filter(m => m.category === filterCategory);
    return CAUSE_METRICS;
  }

  getSymptomMetrics(filterCategory?: string): SymptomMetric[] {
    if (filterCategory) return SYMPTOM_METRICS.filter(m => m.category === filterCategory);
    return SYMPTOM_METRICS;
  }

  classifyMetric(metricId: string): { category: MetricCategory; causeInfo?: CauseMetric; symptomInfo?: SymptomMetric } {
    const cause = CAUSE_METRICS.find(m => m.metricId === metricId);
    if (cause) return { category: 'cause', causeInfo: cause };
    const symptom = SYMPTOM_METRICS.find(m => m.metricId === metricId);
    if (symptom) return { category: 'symptom', symptomInfo: symptom };
    return { category: 'state' };
  }

  // ─── Expected State (from M07 causes) ───────────────────────────────

  /**
   * Record expected state from M07 traffic engine output.
   * spec §4.2: Track 1 — Expected (from causes).
   */
  recordExpectedState(state: ExpectedState): void {
    this.expectedStates.set(state.marketId, state);
    log.info({
      marketId: state.marketId,
      expectedDemand: state.expectedDemandStrength,
      expectedSupply: state.expectedSupplyPressure,
      regime: state.regime,
      confidence: state.confidence,
    }, 'Expected state recorded');
  }

  getExpectedState(marketId: string): ExpectedState | undefined {
    return this.expectedStates.get(marketId);
  }

  // ─── Observed State (from symptoms) ────────────────────────────────

  /**
   * Record observed state from symptom aggregation.
   * spec §4.2: Track 2 — Observed (from symptoms).
   */
  recordObservedState(state: ObservedState): void {
    this.observedStates.set(state.marketId, state);
    log.info({
      marketId: state.marketId,
      observedDemand: state.observedDemandIntensity,
      observedSupply: state.observedSupplyPressure,
      nMetrics: state.nMetrics,
    }, 'Observed state recorded');
  }

  getObservedState(marketId: string): ObservedState | undefined {
    return this.observedStates.get(marketId);
  }

  // ─── Validation Factor (Spec §4.3) ─────────────────────────────────

  /**
   * Compute validation factor from expected vs observed ratio.
   * spec §4.3: bounded f ∈ [0.7, 1.3]
   *
   *   ratio ≥ 1.5        → 1.30  (strong confirmation, uplift capped)
   *   1.2 ≤ ratio < 1.5  → 1.15
   *   0.85 ≤ ratio < 1.2 → 1.00  (normal confirmation)
   *   0.5 ≤ ratio < 0.85 → 0.85
   *   ratio < 0.5        → 0.70  (strong contradiction)
   */
  computeValidationFactor(
    expected: number,
    observed: number,
    isDemand: boolean, // true = demand, false = supply
  ): ValidationResult {
    // Handle near-zero expected (spec §4.3 special case)
    const threshold = 0.1;
    if (expected < threshold && observed > threshold) {
      // "Hidden Surge" — supply-side hidden frothy / demand-side hidden gem
      const quadrant: QuadrantState = isDemand ? 'hidden_gem' : 'hidden_distress';
      let validationFactor = isDemand ? 0.85 : 1.15;
      return { ratio: observed / Math.max(expected, 0.01), validationFactor, quadrantState: quadrant };
    }
    if (expected < threshold && observed <= threshold) {
      return { ratio: 1.0, validationFactor: 1.0, quadrantState: 'confirmed_weak' };
    }

    const ratio = observed / Math.max(expected, 0.0001);

    let valFactor: number;
    if (ratio >= 1.5) valFactor = 1.30;
    else if (ratio >= 1.2) valFactor = 1.15;
    else if (ratio >= 0.85) valFactor = 1.00;
    else if (ratio >= 0.5) valFactor = 0.85;
    else valFactor = 0.70;

    // Clamp
    valFactor = Math.max(V_FLOOR, Math.min(V_CEILING, valFactor));

    // Determine quadrant state
    const quadrant = this.determineQuadrant(isDemand, expected, observed, ratio);

    return { ratio: Math.round(ratio * 100) / 100, validationFactor: valFactor, quadrantState: quadrant };
  }

  /**
   * Determine quadrant state from expected vs observed (spec §4.5).
   */
  private determineQuadrant(isDemand: boolean, expected: number, observed: number, ratio: number): QuadrantState {
    const highThreshold = 0.55;
    const expectedHigh = expected >= highThreshold;
    const observedHigh = observed >= highThreshold;

    if (isDemand) {
      if (expectedHigh && observedHigh) return 'confirmed_strong';
      if (expectedHigh && !observedHigh) return 'hidden_gem';
      if (!expectedHigh && observedHigh) return 'frothy';
      return 'confirmed_weak';
    } else {
      // Supply: higher expected pressure = worse. expectedSupplyPressure high = loose
      const pressureHigh = expected >= highThreshold;
      if (!pressureHigh && !observedHigh) return 'confirmed_tight';
      if (!pressureHigh && observedHigh) return 'hidden_distress';
      if (pressureHigh && !observedHigh) return 'resilient_absorption';
      return 'confirmed_loose';
    }
  }

  // ─── Sub-Score Composition (Spec §4.3) ──────────────────────────────

  /**
   * Compute a strategy sub-score from expected and observed inputs.
   * spec §4.3: Score = Expected × validation_factor
   *
   * For supply: Score = (1 - expected_supply_pressure) × validation_factor
   *   (higher score = less supply pressure = better)
   */
  computeSubScore(
    dimension: 'demand' | 'supply',
    expectedStrength: number,    // For demand: projected demand [0,1]; for supply: projected pressure [0,1]
    observedIntensity: number,   // For demand: observed activity [0,1]; for supply: observed pressure [0,1]
    regime?: string,
    nEffective?: number,
  ): StrategySubScore {
    // Compute validation
    const isDemand = dimension === 'demand';
    const validation = this.computeValidationFactor(expectedStrength, observedIntensity, isDemand);

    // Expected component: for demand use directly; for supply invert
    const expected = isDemand ? expectedStrength : 1 - expectedStrength;

    // Final score
    const score = expected * validation.validationFactor;

    // Details
    const details: string[] = [];
    if (regime) {
      details.push(`Regime: ${regime}`);
    }
    details.push(`Expected: ${Math.round(expected * 100)}%, Observed: ${Math.round(observedIntensity * 100)}%`);
    details.push(`Validation factor: ${validation.validationFactor}`);
    details.push(`State: ${validation.quadrantState}`);

    return {
      dimension,
      expected,
      observed: observedIntensity,
      validationFactor: validation.validationFactor,
      score: Math.round(score * 10000) / 10000,
      state: validation.quadrantState,
      regime: regime ?? 'unknown',
      nEffective: nEffective ?? 0,
      details,
    };
  }

  // ─── Full Deal Scoring (Spec §4.2) ──────────────────────────────────

  /**
   * Score a deal using the cause/symptom split.
   * Combines demand, supply, momentum, position, risk dimensions.
   * spec §4.2-4.5
   */
  scoreDeal(
    dealId: string,
    marketId: string,
    inputs: {
      expectedDemandStrength: number;
      expectedSupplyPressure: number;
      observedDemandIntensity: number;
      observedSupplyPressure: number;
      momentumScore?: number;
      positionScore?: number;
      riskScore?: number;
    },
    regime?: string,
    nEffective?: number,
  ): ScoredDeal {
    // Get regime if not provided
    const currentRegime = regime ?? 'Expansion';
    const effectiveN = nEffective ?? 0;

    // Sub-scores
    const demandScore = this.computeSubScore(
      'demand',
      inputs.expectedDemandStrength,
      inputs.observedDemandIntensity,
      currentRegime,
      effectiveN,
    );

    const supplyScore = this.computeSubScore(
      'supply',
      inputs.expectedSupplyPressure,
      inputs.observedSupplyPressure,
      currentRegime,
      effectiveN,
    );

    // Momentum, Position, Risk are simpler (just with validation framing)
    const momentumScore: StrategySubScore = {
      dimension: 'momentum',
      expected: inputs.momentumScore ?? 0.5,
      observed: 0.5,
      validationFactor: 1.0,
      score: inputs.momentumScore ?? 0.5,
      state: 'unknown',
      regime: currentRegime,
      nEffective: effectiveN,
      details: [`Momentum: ${Math.round((inputs.momentumScore ?? 0.5) * 100)}%`],
    };

    const positionSubScore: StrategySubScore = {
      dimension: 'position',
      expected: inputs.positionScore ?? 0.5,
      observed: 0.5,
      validationFactor: 1.0,
      score: inputs.positionScore ?? 0.5,
      state: 'unknown',
      regime: currentRegime,
      nEffective: effectiveN,
      details: [`Position: ${Math.round((inputs.positionScore ?? 0.5) * 100)}%`],
    };

    const riskSubScore: StrategySubScore = {
      dimension: 'risk',
      expected: inputs.riskScore ?? 0.5,
      observed: 0.5,
      validationFactor: 1.0,
      score: 1 - (inputs.riskScore ?? 0.5), // lower risk = higher score
      state: 'unknown',
      regime: currentRegime,
      nEffective: effectiveN,
      details: [`Risk: ${Math.round((inputs.riskScore ?? 0.5) * 100)}%`],
    };

    const subScores: StrategySubScore[] = [demandScore, supplyScore, momentumScore, positionSubScore, riskSubScore];

    // Composite: weighted average
    const weights = { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.20 };
    const compositeScore = subScores.reduce((s, ss) =>
      s + ss.score * (weights[ss.dimension] ?? 0.15), 0
    );

    const result: ScoredDeal = {
      dealId,
      marketId,
      subScores,
      compositeScore: Math.round(compositeScore * 10000) / 10000,
      computedAt: new Date(),
    };

    // Log to calibration ledger if active scoring
    calibrationLedger.recordPrediction({
      predictionId: `csd_score_${dealId}_${Date.now()}`,
      emittedAt: new Date(),
      source: { module: 'CausalDisciplineEngine', version: '1.0', dealId },
      metric: 'composite_score',
      assetClass: 'multifamily',
      regimeAtPrediction: currentRegime,
      predictionType: 'point_with_ci',
      pointEstimate: compositeScore,
      realizationHorizonMonths: 12,
      realizationTargetDate: new Date(Date.now() + 365 * 86400 * 1000),
      context: {
        rationaleSummary: `Causal Discipline score: Demand ${demandScore.score.toFixed(3)}, Supply ${supplyScore.score.toFixed(3)}, state=${demandScore.state}`,
      },
    });

    return result;
  }

  // ─── Discrepancy Feedback Loop (Spec §7) ────────────────────────────

  /**
   * Detect persistent discrepancies between expected and observed states.
   * spec §7: Discrepancy feedback loop.
   *
   * A market with sustained Hidden Gem (4+ weeks) emits a discrepancy signal.
   * Persistent Frothy also signals.
   */
  detectDiscrepancies(
    weeklyStates: { expected: ExpectedState; observed: ObservedState; date: Date }[],
    minWeeks: number = 4,
  ): {
    marketId: string;
    quadrantState: QuadrantState;
    weeksPersistent: number;
    likelyExplanation: string;
    actionable: boolean;
  }[] {
    const results: {
      marketId: string;
      quadrantState: QuadrantState;
      weeksPersistent: number;
      likelyExplanation: string;
      actionable: boolean;
    }[] = [];

    // Group by market
    const marketWeeks = new Map<string, { state: QuadrantState; date: Date }[]>();

    for (const week of weeklyStates) {
      const validation = this.computeValidationFactor(
        week.expected.expectedDemandStrength,
        week.observed.observedDemandIntensity,
        true,
      );
      const entries = marketWeeks.get(week.expected.marketId) ?? [];
      entries.push({ state: validation.quadrantState, date: week.date });
      marketWeeks.set(week.expected.marketId, entries);
    }

    for (const [marketId, states] of marketWeeks.entries()) {
      const sorted = [...states].sort((a, b) => a.date.getTime() - b.date.getTime());
      const recentWeeks = sorted.slice(-minWeeks);

      // Check if all recent weeks are same state
      if (recentWeeks.length < minWeeks) continue;

      const state = recentWeeks[0].state;
      const allSame = recentWeeks.every(w => w.state === state);

      if (allSame && (state === 'hidden_gem' || state === 'frothy')) {
        let explanation = '';
        let actionable = false;

        if (state === 'hidden_gem') {
          explanation = 'Expected demand high but observed not materializing. Possible: lag effect, demand leak, or missing cause.';
          actionable = true;
        } else {
          explanation = 'Observed activity exceeds underlying drivers. Possible: anticipatory, speculative, or missing cause.';
          actionable = true;
        }

        results.push({
          marketId,
          quadrantState: state,
          weeksPersistent: recentWeeks.length,
          likelyExplanation: explanation,
          actionable,
        });
      }
    }

    return results;
  }

  // ─── Stats ──────────────────────────────────────────────────────────

  getStats(): {
    nExpectedStates: number;
    nObservedStates: number;
    nEventTypes: number;
    nCauseMetrics: number;
    nSymptomMetrics: number;
  } {
    return {
      nExpectedStates: this.expectedStates.size,
      nObservedStates: this.observedStates.size,
      nEventTypes: EVENT_SUBTYPE_REGISTRY.length,
      nCauseMetrics: CAUSE_METRICS.length,
      nSymptomMetrics: SYMPTOM_METRICS.length,
    };
  }
}

export const causalDisciplineEngine = new CausalDisciplineEngine();
export default causalDisciplineEngine;
