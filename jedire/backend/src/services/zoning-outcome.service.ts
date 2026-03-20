import { Pool } from 'pg';
import { zoningEventBus, ZONING_EVENTS } from './zoning-event-bus.service';

export interface PredictionLog {
  dealId?: string;
  municipality: string;
  state?: string;
  districtCode?: string;
  predictionType: string;
  predictedValue?: number;
  predictedProbability?: number;
  predictedTimelineMonths?: number;
  context?: Record<string, any>;
  analysisId?: string;
  userId?: string;
}

export interface OutcomeReport {
  predictionId?: string;
  dealId?: string;
  municipality: string;
  state?: string;
  districtCode?: string;
  outcomeType: string;
  actualOutcome: string;
  actualValue?: number;
  actualTimelineMonths?: number;
  actualCost?: number;
  conditions?: string[];
  notes?: string;
  reportedBy: string;
}

export interface CalibrationResult {
  municipality: string;
  districtCode?: string;
  predictionType: string;
  totalPredictions: number;
  totalOutcomes: number;
  avgPredictedProbability: number;
  actualApprovalRate: number;
  probabilityBias: number;
  avgPredictedTimeline: number;
  avgActualTimeline: number;
  timelineBias: number;
  accuracy: number;
}

export class ZoningOutcomeService {
  constructor(private pool: Pool) {}

  async logPrediction(pred: PredictionLog): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO zoning_predictions
       (deal_id, municipality, state, district_code, prediction_type,
        predicted_value, predicted_probability, predicted_timeline_months,
        context, analysis_id, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        pred.dealId || null, pred.municipality, pred.state || null,
        pred.districtCode || null, pred.predictionType,
        pred.predictedValue || null, pred.predictedProbability || null,
        pred.predictedTimelineMonths || null,
        pred.context ? JSON.stringify(pred.context) : '{}',
        pred.analysisId || null, pred.userId || null,
      ]
    );
    return result.rows[0].id;
  }

  async recordOutcome(report: OutcomeReport): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO zoning_outcomes
       (prediction_id, deal_id, municipality, state, district_code,
        outcome_type, actual_outcome, actual_value, actual_timeline_months,
        actual_cost, conditions, notes, reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        report.predictionId || null, report.dealId || null,
        report.municipality, report.state || null, report.districtCode || null,
        report.outcomeType, report.actualOutcome,
        report.actualValue || null, report.actualTimelineMonths || null,
        report.actualCost || null, report.conditions || [],
        report.notes || null, report.reportedBy,
      ]
    );

    zoningEventBus.publish(ZONING_EVENTS.OUTCOME_RECORDED, {
      outcomeId: result.rows[0].id,
      predictionId: report.predictionId,
      municipality: report.municipality,
      actualOutcome: report.actualOutcome,
    });

    return result.rows[0].id;
  }

  async calibrate(municipality: string, districtCode?: string): Promise<CalibrationResult[]> {
    const conditions = ['LOWER(p.municipality) = LOWER($1)'];
    const params: any[] = [municipality];
    let idx = 2;

    if (districtCode) {
      conditions.push(`LOWER(p.district_code) = LOWER($${idx++})`);
      params.push(districtCode);
    }

    const where = conditions.join(' AND ');

    const result = await this.pool.query(
      `SELECT
         p.municipality,
         p.district_code,
         p.prediction_type,
         COUNT(p.id) as total_predictions,
         COUNT(o.id) as total_outcomes,
         AVG(p.predicted_probability) as avg_predicted_prob,
         AVG(CASE WHEN LOWER(o.actual_outcome) IN ('approved','approved_with_conditions') THEN 100.0 ELSE 0.0 END) as actual_approval_rate,
         AVG(p.predicted_timeline_months) FILTER (WHERE p.predicted_timeline_months IS NOT NULL) as avg_predicted_timeline,
         AVG(o.actual_timeline_months) FILTER (WHERE o.actual_timeline_months IS NOT NULL) as avg_actual_timeline
       FROM zoning_predictions p
       LEFT JOIN zoning_outcomes o ON o.prediction_id = p.id
       WHERE ${where}
       GROUP BY p.municipality, p.district_code, p.prediction_type
       HAVING COUNT(o.id) > 0
       ORDER BY COUNT(o.id) DESC`,
      params
    );

    return result.rows.map(row => {
      const avgPredProb = parseFloat(row.avg_predicted_prob) || 0;
      const actualRate = parseFloat(row.actual_approval_rate) || 0;
      const avgPredTimeline = parseFloat(row.avg_predicted_timeline) || 0;
      const avgActualTimeline = parseFloat(row.avg_actual_timeline) || 0;

      return {
        municipality: row.municipality,
        districtCode: row.district_code,
        predictionType: row.prediction_type,
        totalPredictions: parseInt(row.total_predictions),
        totalOutcomes: parseInt(row.total_outcomes),
        avgPredictedProbability: avgPredProb,
        actualApprovalRate: actualRate,
        probabilityBias: avgPredProb - actualRate,
        avgPredictedTimeline: avgPredTimeline,
        avgActualTimeline: avgActualTimeline,
        timelineBias: avgPredTimeline - avgActualTimeline,
        accuracy: 100 - Math.abs(avgPredProb - actualRate),
      };
    });
  }

  async getOutcomeSummary(municipality: string): Promise<{
    totalPredictions: number;
    totalOutcomes: number;
    overallAccuracy: number;
    avgProbabilityBias: number;
    avgTimelineBias: number;
  }> {
    const calibrations = await this.calibrate(municipality);

    if (calibrations.length === 0) {
      return {
        totalPredictions: 0,
        totalOutcomes: 0,
        overallAccuracy: 0,
        avgProbabilityBias: 0,
        avgTimelineBias: 0,
      };
    }

    const totalPredictions = calibrations.reduce((s, c) => s + c.totalPredictions, 0);
    const totalOutcomes = calibrations.reduce((s, c) => s + c.totalOutcomes, 0);
    const weightedAccuracy = calibrations.reduce((s, c) => s + c.accuracy * c.totalOutcomes, 0) / Math.max(totalOutcomes, 1);
    const avgProbBias = calibrations.reduce((s, c) => s + c.probabilityBias, 0) / calibrations.length;
    const avgTimeBias = calibrations.reduce((s, c) => s + c.timelineBias, 0) / calibrations.length;

    return {
      totalPredictions,
      totalOutcomes,
      overallAccuracy: weightedAccuracy,
      avgProbabilityBias: avgProbBias,
      avgTimelineBias: avgTimeBias,
    };
  }
}
