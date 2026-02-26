/**
 * JEDI RE: Traffic Engine Module Wiring
 *
 * PURPOSE: Connects the Traffic Engine (M07) to the rest of the platform.
 *
 * This file addresses the WEAKEST LINK identified in the Module Wiring Blueprint:
 *   Market Intelligence (M05) -> Traffic Engine (M07) -> Development (M03) -> Strategy Arbitrage (M08)
 *
 * EXISTING CODE (2,869 lines, all disconnected):
 *   - trafficPredictionEngine.ts     -> T-01 walk-in prediction (668 lines)
 *   - digitalTrafficService.ts       -> T-03 digital score (338 lines)
 *   - multifamilyTrafficService.ts   -> T-05 traffic-to-lease (555 lines)
 *   - leasingTrafficService.ts       -> leasing metrics (287 lines)
 *   - traffic-correlation.service.ts -> T-04, T-07, T-09 (NEW, fills gaps)
 *   - 4 route files                  -> API endpoints (1,021 lines, unmounted)
 *
 * THIS FILE WIRES:
 *   1. Traffic -> JEDI Score (M25): T-01 walk-ins feed Position signal
 *   2. Traffic -> Strategy Arbitrage (M08): T-04 correlation influences strategy weights
 *   3. Traffic -> ProForma (M09): T-05 lease predictions feed occupancy assumptions
 *   4. Traffic -> Risk (M14): Low traffic flags as risk factor
 *   5. Traffic -> Deal Capsule: T-04 classification as headline insight
 */

import trafficPredictionEngine from './trafficPredictionEngine';
import { trafficCorrelation, trafficTrajectory, competitiveShare } from './traffic-correlation.service';
import type { CorrelationSignal, TrafficTrajectory, CompetitiveShare } from './traffic-correlation.service';

// ============================================================================
// Full Traffic Intelligence Package
// Single call to get all 10 outputs for a property
// ============================================================================

export interface TrafficIntelligence {
  property_id: string;

  // T-01: Weekly Walk-In Prediction
  weekly_walk_ins: number;
  daily_average: number;

  // T-02: Physical Traffic Score (0-100)
  physical_score: number;

  // T-03: Digital Traffic Score (0-100)
  digital_score: number;

  // T-04: Correlation Signal
  correlation: CorrelationSignal;

  // T-05: Traffic-to-Lease Prediction
  expected_weekly_leases: number;
  lease_conversion_rate: number;

  // T-06: Capture Rate
  capture_rate: number;

  // T-07: Traffic Trajectory
  trajectory: TrafficTrajectory;

  // T-08: Generator Proximity Score
  generator_score: number;

  // T-09: Competitive Traffic Share
  competitive_share: CompetitiveShare;

  // T-10: Validation Confidence
  confidence: {
    score: number;
    tier: 'High' | 'Medium' | 'Low';
  };
}

// ============================================================================
// JEDI Score Integration (M25)
// Adds Traffic as a component of the Position signal
// ============================================================================

export interface TrafficScoreContribution {
  // Position signal adjustment (T-01 + T-04 + T-09)
  position_adjustment: number;   // -10 to +10 points on Position signal

  // Risk signal adjustment (low traffic = risk)
  risk_adjustment: number;       // -5 to +5 points on Risk signal

  // Explanation for the JEDI Score narrative
  narrative: string;
}

export function calculateTrafficContributionToJEDI(
  intelligence: TrafficIntelligence
): TrafficScoreContribution {

  let positionAdj = 0;
  let riskAdj = 0;
  const narrativeParts: string[] = [];

  // T-01: Walk-in volume -> Position signal
  // High walk-ins boost Position, low walk-ins penalize
  if (intelligence.weekly_walk_ins > 3000) {
    positionAdj += 5;
    narrativeParts.push(`Strong walk-in traffic (${intelligence.weekly_walk_ins}/week) supports location quality`);
  } else if (intelligence.weekly_walk_ins > 1500) {
    positionAdj += 2;
  } else if (intelligence.weekly_walk_ins < 500) {
    positionAdj -= 5;
    riskAdj -= 3;
    narrativeParts.push(`Weak walk-in traffic (${intelligence.weekly_walk_ins}/week) — location may struggle to attract tenants`);
  }

  // T-04: Correlation signal -> Position signal
  switch (intelligence.correlation.correlation_signal) {
    case 'HIDDEN_GEM':
      positionAdj += 5;
      narrativeParts.push(`Hidden Gem: high foot traffic but low digital visibility — pricing hasn't caught up to location quality`);
      break;
    case 'VALIDATED':
      positionAdj += 2;
      narrativeParts.push(`Validated location: both physical and digital demand confirmed`);
      break;
    case 'HYPE_CHECK':
      riskAdj -= 3;
      narrativeParts.push(`Hype Check: digital interest outpaces physical traffic — investigate whether demand is real`);
      break;
    case 'DEAD_ZONE':
      positionAdj -= 5;
      riskAdj -= 5;
      narrativeParts.push(`Dead Zone: both physical and digital traffic below average — avoid unless catalyst exists`);
      break;
  }

  // T-07: Trajectory -> momentum context
  if (intelligence.trajectory.trend_direction === 'accelerating') {
    positionAdj += 2;
    narrativeParts.push(`Traffic accelerating (+${intelligence.trajectory.eight_week_change_pct}% over 8 weeks)`);
  } else if (intelligence.trajectory.trend_direction === 'decelerating') {
    positionAdj -= 2;
    riskAdj -= 2;
    narrativeParts.push(`Traffic decelerating (${intelligence.trajectory.eight_week_change_pct}% over 8 weeks)`);
  }

  // T-09: Competitive share -> Position signal
  if (intelligence.competitive_share.above_average) {
    positionAdj += 1;
  } else if (intelligence.competitive_share.traffic_share_pct < 3) {
    positionAdj -= 2;
  }

  // Clamp adjustments
  positionAdj = Math.max(-10, Math.min(10, positionAdj));
  riskAdj = Math.max(-5, Math.min(5, riskAdj));

  return {
    position_adjustment: positionAdj,
    risk_adjustment: riskAdj,
    narrative: narrativeParts.join('. ') + '.'
  };
}

// ============================================================================
// Strategy Arbitrage Integration (M08)
// T-04 correlation signal influences strategy recommendations
// ============================================================================

export interface TrafficStrategyModifier {
  // Per-strategy score adjustments based on traffic intelligence
  bts_modifier: number;      // Build-to-Sell
  flip_modifier: number;     // Flip
  rental_modifier: number;   // Rental
  str_modifier: number;      // Short-Term Rental

  // Which strategy benefits most from traffic data
  traffic_favored_strategy: string;
  traffic_insight: string;
}

export function calculateTrafficStrategyModifiers(
  intelligence: TrafficIntelligence
): TrafficStrategyModifier {

  let bts = 0, flip = 0, rental = 0, str = 0;
  const insights: string[] = [];

  // Hidden Gem -> favors Flip and Value-Add (buy before market notices)
  if (intelligence.correlation.correlation_signal === 'HIDDEN_GEM') {
    flip += 8;
    rental += 3;  // Buy-and-hold at below-market price
    insights.push('Hidden Gem favors Flip/Value-Add — buy before digital visibility catches up');
  }

  // Validated -> favors STR and Stabilized Hold (strong location supports premium pricing)
  if (intelligence.correlation.correlation_signal === 'VALIDATED') {
    str += 5;
    rental += 4;
    insights.push('Validated location supports STR premium and long-term rental stability');
  }

  // High walk-ins -> favors STR (tourist/visitor traffic)
  if (intelligence.weekly_walk_ins > 3000) {
    str += 6;
    bts += 3;  // Desirable location for new development
    insights.push('High foot traffic supports STR occupancy and development demand');
  }

  // Strong lease conversion -> favors Rental
  if (intelligence.expected_weekly_leases > 3) {
    rental += 5;
    insights.push(`Strong lease conversion (${intelligence.expected_weekly_leases} leases/week) validates rental strategy`);
  }

  // Accelerating traffic -> favors BTS (growing area)
  if (intelligence.trajectory.trend_direction === 'accelerating') {
    bts += 5;
    flip += 3;
    insights.push('Accelerating traffic signals growing area — development upside');
  }

  // Dead Zone -> penalize everything, especially STR
  if (intelligence.correlation.correlation_signal === 'DEAD_ZONE') {
    bts -= 5;
    flip -= 3;
    rental -= 3;
    str -= 8;
    insights.push('Dead Zone traffic kills STR viability and limits all strategies');
  }

  // Determine which strategy benefits most
  const strategies = [
    { name: 'Build-to-Sell', mod: bts },
    { name: 'Flip', mod: flip },
    { name: 'Rental', mod: rental },
    { name: 'STR', mod: str },
  ];
  const best = strategies.reduce((a, b) => a.mod > b.mod ? a : b);

  return {
    bts_modifier: bts,
    flip_modifier: flip,
    rental_modifier: rental,
    str_modifier: str,
    traffic_favored_strategy: best.name,
    traffic_insight: insights.join('. ') + '.'
  };
}

// ============================================================================
// ProForma Integration (M09)
// Traffic data adjusts occupancy and rent growth assumptions
// ============================================================================

export interface TrafficProFormaInputs {
  // T-05 lease prediction -> occupancy assumption
  implied_annual_leases: number;
  implied_occupancy_support: number;  // % (e.g., 95.2%)

  // T-01 walk-ins -> rent premium/discount justification
  traffic_rent_adjustment_pct: number;  // e.g., +2.1% (high traffic = rent premium)

  // T-07 trajectory -> rent growth rate adjustment
  traffic_growth_adjustment_bps: number;  // e.g., +50bps if accelerating

  // Confidence
  confidence_tier: string;
  source_note: string;
}

export function calculateTrafficProFormaInputs(
  intelligence: TrafficIntelligence,
  totalUnits: number
): TrafficProFormaInputs {

  // T-05 -> annual leases -> implied occupancy
  const annualLeases = intelligence.expected_weekly_leases * 52;
  const annualTurnover = totalUnits * 0.50;  // Assume 50% annual turnover
  const leaseDemandRatio = annualLeases / Math.max(annualTurnover, 1);
  const impliedOccupancy = Math.min(98, 88 + (leaseDemandRatio * 8));  // 88% base + bonus

  // T-01 -> rent premium
  let rentAdj = 0;
  if (intelligence.weekly_walk_ins > 3000) rentAdj = 3.0;
  else if (intelligence.weekly_walk_ins > 2000) rentAdj = 1.5;
  else if (intelligence.weekly_walk_ins > 1000) rentAdj = 0;
  else if (intelligence.weekly_walk_ins < 500) rentAdj = -2.0;

  // T-07 -> rent growth adjustment
  let growthAdj = 0;
  if (intelligence.trajectory.trend_direction === 'accelerating') growthAdj = 50;
  else if (intelligence.trajectory.trend_direction === 'decelerating') growthAdj = -50;

  return {
    implied_annual_leases: Math.round(annualLeases),
    implied_occupancy_support: Math.round(impliedOccupancy * 10) / 10,
    traffic_rent_adjustment_pct: rentAdj,
    traffic_growth_adjustment_bps: growthAdj,
    confidence_tier: intelligence.confidence.tier,
    source_note: `Traffic Engine v1.0: ${intelligence.weekly_walk_ins} walk-ins/week, ${intelligence.correlation.correlation_signal} classification, ${intelligence.trajectory.trend_direction} trajectory`
  };
}

// ============================================================================
// Route Mounting Helper
// Call this from index.ts to wire all traffic routes
// ============================================================================

export function mountTrafficRoutes(app: any): void {
  // These route files exist but are NOT mounted in index.ts
  const trafficRoutes = require('../api/rest/trafficPrediction.routes');
  const trafficAiRoutes = require('../api/rest/traffic-ai.routes');
  const leasingRoutes = require('../api/rest/leasing-traffic.routes');

  app.use('/api/v1/traffic', trafficRoutes.default || trafficRoutes);
  app.use('/api/v1/traffic/ai', trafficAiRoutes.default || trafficAiRoutes);
  app.use('/api/v1/traffic/leasing', leasingRoutes.default || leasingRoutes);

  console.log('Traffic Engine routes mounted: /api/v1/traffic/*');
}
