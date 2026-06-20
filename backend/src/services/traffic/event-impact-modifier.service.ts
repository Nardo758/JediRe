/**
 * Event Impact Modifier Service
 *
 * Blends forward-looking event predictions with backward-looking correlation
 * engine measured feedback to produce a calibrated traffic multiplier.
 *
 * Forward-looking input:  classified_demand_events from M06 (predictive)
 * Backward-looking inputs: backtest_runs calibration scores,
 *                         event_causality_results direction,
 *                         learning_adjustments systematic bias
 *
 * The same pattern is used by cash flow agents when applying event deltas
 * to underwriting assumptions (see event-deltas.service.ts).
 *
 * Algorithm:
 *   1. Compute raw forward impact = Σ(event.impact × confidence × distance_decay)
 *   2. For each event type, look up historical calibration score from backtest_runs
 *      → accuracy_discount = calibrationScore / 100 (0.0–1.0)
 *   3. For each event type, look up causality direction from event_causality_results
 *      → causality_discount = 1.0 if event_drives_market, 0.5 if market_attracts_event
 *   4. Apply weighted learning adjustment from learning_adjustments table
 *   5. final_multiplier = 1.0 + (raw_forward_impact × accuracy_discount × causality_discount) + learning_adjustment
 *   6. Clamp to [0.70, 1.40]
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DemandEvent {
  event_type: string;
  impact: number;            // expected magnitude (e.g., jobs affected, units)
  confidence: 'high' | 'medium' | 'low';
  distance_miles: number;      // distance from subject property
  announced_date?: string;
  materialization_date?: string;
}

export interface EventModifierInputs {
  events: DemandEvent[];
  propertyState?: string;
  propertyMsa?: string;
  propertySubmarket?: string;
  assetClass?: string;
  propertyId?: string;
  dealId?: string;
}

export interface EventModifierResult {
  multiplier: number;          // final multiplier clamped to [0.70, 1.40]
  rawForwardImpact: number;    // before discounts
  accuracyDiscount: number;    // weighted average calibration score
  causalityDiscount: number;    // weighted average causality confidence
  learningAdjustment: number;   // systematic bias correction
  eventContributions: Array<{
    eventType: string;
    impact: number;
    distanceDecay: number;
    confidenceWeight: number;
    weightedImpact: number;
    calibrationScore: number | null;
    causalityDirection: string | null;
  }>;
  confidence: 'high' | 'medium' | 'low';
  dataSources: string[];
  missingSources: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CONFIDENCE_MAP: Record<string, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

const MULTIPLIER_FLOOR = 0.70;
const MULTIPLIER_CEILING = 1.40;
const DISTANCE_DECAY_HALFLIFE_MILES = 5;

// ─── Service ─────────────────────────────────────────────────────────────────

export class EventImpactModifierService {
  constructor(private pool: Pool) {}

  /**
   * Compute the blended event impact multiplier for traffic prediction.
   */
  async computeEventModifier(inputs: EventModifierInputs): Promise<EventModifierResult> {
    const { events, propertyState, propertyMsa, propertySubmarket, assetClass } = inputs;

    const dataSources: string[] = [];
    const missingSources: string[] = [];

    if (events.length === 0) {
      return this.emptyResult();
    }

    // Step 1: Compute raw forward-looking impact with distance decay
    const eventContributions = events.map((event) => {
      const confidenceWeight = CONFIDENCE_MAP[event.confidence] ?? 0.5;
      const distanceDecay = 1 / (1 + (event.distance_miles || 0) / DISTANCE_DECAY_HALFLIFE_MILES);
      const weightedImpact = (event.impact || 0) * confidenceWeight * distanceDecay;

      return {
        eventType: event.event_type,
        impact: event.impact || 0,
        distanceDecay: parseFloat(distanceDecay.toFixed(4)),
        confidenceWeight,
        weightedImpact: parseFloat(weightedImpact.toFixed(4)),
        calibrationScore: null as number | null,
        causalityDirection: null as string | null,
      };
    });

    const rawForwardImpact = eventContributions.reduce((sum, ec) => sum + ec.weightedImpact, 0);

    // Step 2: Look up historical backtest calibration scores per event type
    const eventTypes = [...new Set(events.map((e) => e.event_type))];
    const calibrationScores = await this.getCalibrationScores(eventTypes);
    if (Object.keys(calibrationScores).length > 0) {
      dataSources.push('backtest_runs');
    } else {
      missingSources.push('backtest_runs');
    }

    let totalCalibrationWeight = 0;
    let weightedCalibrationSum = 0;

    for (const ec of eventContributions) {
      const score = calibrationScores[ec.eventType] ?? null;
      ec.calibrationScore = score;
      if (score != null) {
        const weight = Math.abs(ec.weightedImpact);
        weightedCalibrationSum += score * weight;
        totalCalibrationWeight += weight;
      }
    }

    const accuracyDiscount =
      totalCalibrationWeight > 0
        ? weightedCalibrationSum / totalCalibrationWeight / 100
        : 0.8; // default 80% trust when no backtest data

    // Step 3: Look up causality directions per event type
    const causalityDirections = await this.getCausalityDirections(
      eventTypes,
      propertyMsa || propertySubmarket
    );
    if (Object.keys(causalityDirections).length > 0) {
      dataSources.push('event_causality_results');
    } else {
      missingSources.push('event_causality_results');
    }

    let totalCausalityWeight = 0;
    let weightedCausalitySum = 0;

    for (const ec of eventContributions) {
      const dir = causalityDirections[ec.eventType] ?? null;
      ec.causalityDirection = dir;
      if (dir) {
        const weight = Math.abs(ec.weightedImpact);
        // event_drives_market → full trust (1.0), market_attracts_event → half trust (0.5)
        // simultaneous → 0.75, bidirectional → 0.85, insufficient_data → 0.6
        const discount =
          dir === 'event_drives_market' ? 1.0 :
          dir === 'market_attracts_event' ? 0.5 :
          dir === 'simultaneous' ? 0.75 :
          dir === 'bidirectional' ? 0.85 :
          0.6;
        weightedCausalitySum += discount * weight;
        totalCausalityWeight += weight;
      }
    }

    const causalityDiscount =
      totalCausalityWeight > 0
        ? weightedCausalitySum / totalCausalityWeight
        : 0.7; // default 70% when no causality data

    // Step 4: Look up learning adjustments for systematic bias
    const learningAdjustment = await this.getLearningAdjustment({
      state: propertyState,
      msa: propertyMsa,
      submarket: propertySubmarket,
      assetClass,
      assumptionName: 'event_impact_multiplier',
    });

    if (learningAdjustment != null) {
      dataSources.push('learning_adjustments');
    } else {
      missingSources.push('learning_adjustments');
    }

    // Step 5: Blend into final multiplier
    // Normalize raw forward impact to a multiplier delta (±15% max from events alone)
    const normalizedImpact = Math.tanh(rawForwardImpact / 100) * 0.15;
    const blendedImpact = normalizedImpact * accuracyDiscount * causalityDiscount;
    const finalMultiplier = 1.0 + blendedImpact + (learningAdjustment || 0);
    const clampedMultiplier = Math.max(MULTIPLIER_FLOOR, Math.min(MULTIPLIER_CEILING, finalMultiplier));

    // Confidence rating based on data availability
    const hasCalibration = Object.keys(calibrationScores).length > 0;
    const hasCausality = Object.keys(causalityDirections).length > 0;
    const hasLearning = learningAdjustment != null;

    const confidence: EventModifierResult['confidence'] =
      hasCalibration && hasCausality && hasLearning ? 'high' :
      hasCalibration || hasCausality ? 'medium' :
      'low';

    return {
      multiplier: parseFloat(clampedMultiplier.toFixed(4)),
      rawForwardImpact: parseFloat(rawForwardImpact.toFixed(4)),
      accuracyDiscount: parseFloat(accuracyDiscount.toFixed(4)),
      causalityDiscount: parseFloat(causalityDiscount.toFixed(4)),
      learningAdjustment: parseFloat((learningAdjustment || 0).toFixed(4)),
      eventContributions,
      confidence,
      dataSources,
      missingSources,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private emptyResult(): EventModifierResult {
    return {
      multiplier: 1.0,
      rawForwardImpact: 0,
      accuracyDiscount: 0.8,
      causalityDiscount: 0.7,
      learningAdjustment: 0,
      eventContributions: [],
      confidence: 'low',
      dataSources: [],
      missingSources: ['classified_demand_events'],
    };
  }

  /**
   * Get latest calibration score per event type from backtest_runs.
   * Returns { event_type: calibrationScore } where calibrationScore is 0–100.
   */
  private async getCalibrationScores(
    eventTypes: string[]
  ): Promise<Record<string, number>> {
    if (eventTypes.length === 0) return {};

    try {
      const result = await this.pool.query(
        `SELECT
           event_type,
           AVG(calibration_score) AS avg_calibration_score
         FROM backtest_runs
         WHERE backtest_type = 'event_impact'
           AND event_type = ANY($1)
           AND status = 'completed'
           AND computed_at >= NOW() - INTERVAL '90 days'
         GROUP BY event_type`,
        [eventTypes]
      );

      const scores: Record<string, number> = {};
      for (const row of result.rows) {
        if (row.avg_calibration_score != null) {
          scores[row.event_type] = parseFloat(row.avg_calibration_score);
        }
      }
      return scores;
    } catch (err) {
      logger.warn('EventImpactModifier: backtest_runs query failed', { error: (err as Error).message });
      return {};
    }
  }

  /**
   * Get dominant causality direction per event type from event_causality_results.
   * Returns { event_type: direction } where direction is the most common.
   */
  private async getCausalityDirections(
    eventTypes: string[],
    geographyId?: string
  ): Promise<Record<string, string>> {
    if (eventTypes.length === 0) return {};

    try {
      const geoClause = geographyId ? 'AND geography_id = $2' : '';
      const params = geographyId ? [eventTypes, geographyId] : [eventTypes];

      const result = await this.pool.query(
        `SELECT
           event_type,
           MODE() WITHIN GROUP (ORDER BY overall_direction) AS dominant_direction,
           COUNT(*) AS sample_size
         FROM event_causality_results
         WHERE event_type = ANY($1)
           ${geoClause}
           AND computed_at >= NOW() - INTERVAL '180 days'
         GROUP BY event_type`,
        params
      );

      const directions: Record<string, string> = {};
      for (const row of result.rows) {
        if (row.dominant_direction && row.sample_size >= 3) {
          directions[row.event_type] = row.dominant_direction;
        }
      }
      return directions;
    } catch (err) {
      logger.warn('EventImpactModifier: event_causality_results query failed', { error: (err as Error).message });
      return {};
    }
  }

  /**
   * Get the latest learning adjustment for the given context.
   */
  private async getLearningAdjustment(ctx: {
    state?: string;
    msa?: string;
    submarket?: string;
    assetClass?: string;
    assumptionName: string;
  }): Promise<number | null> {
    try {
      const result = await this.pool.query(
        `SELECT adjustment_value, adjustment_direction, adjustment_type
         FROM learning_adjustments
         WHERE assumption_name = $1
           AND (state IS NULL OR state = $2)
           AND (msa IS NULL OR msa = $3)
           AND (asset_class IS NULL OR asset_class = $4)
           AND created_at >= NOW() - INTERVAL '90 days'
         ORDER BY
           CASE WHEN state IS NOT NULL THEN 1 ELSE 0 END DESC,
           CASE WHEN msa IS NOT NULL THEN 1 ELSE 0 END DESC,
           CASE WHEN asset_class IS NOT NULL THEN 1 ELSE 0 END DESC,
           created_at DESC
         LIMIT 1`,
        [ctx.assumptionName, ctx.state || '', ctx.msa || '', ctx.assetClass || '']
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      let value = parseFloat(row.adjustment_value) || 0;

      // Convert to a simple additive multiplier delta
      if (row.adjustment_type === 'multiplicative') {
        value = value - 1.0; // e.g., 1.05 → +0.05
      } else if (row.adjustment_type === 'additive_bps') {
        value = value / 10000; // bps to multiplier delta
      } else if (row.adjustment_type === 'percentile_shift') {
        value = value * 0.001; // rough conversion
      }

      return row.adjustment_direction === 'decrease' ? -value : value;
    } catch (err) {
      logger.warn('EventImpactModifier: learning_adjustments query failed', { error: (err as Error).message });
      return null;
    }
  }
}

// ─── Singleton instance (uses the same pool as traffic engine) ─────────────────

import { pool } from '../../database';
export const eventImpactModifierService = new EventImpactModifierService(pool);
