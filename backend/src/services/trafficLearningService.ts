/**
 * JEDI RE Traffic Learning Service (v2)
 *
 * The engine that gets smarter with every upload.
 *
 * Implements:
 *   - Excel upload parsing & validation (7-metric funnel)
 *   - Per-metric error tracking (MAPE)
 *   - EMA recalibration of conversion rates (α=0.15, dampened α=0.05 for outliers)
 *   - Bias detection (>75% same-direction across 4+ consecutive uploads)
 *   - Confidence scoring based on data volume
 *   - Cross-property anonymized learning (submarket calibration)
 *
 * Calibration source: Highlands at Berewick (290 units, 243 weeks)
 */

import { pool } from '../database';

// ============================================================================
// Interfaces
// ============================================================================

export interface WeeklyActuals {
  property_id: string;
  week_ending: string; // ISO date (Sunday)
  // Required (5)
  traffic: number;
  net_leases: number;
  occupancy_pct: number;
  effective_rent: number;
  // Optional (7) — enable better learning
  in_person_tours?: number | null;
  applications?: number | null;
  move_ins?: number | null;
  move_outs?: number | null;
  concessions?: number | null;
  market_rent?: number | null;
  notes?: string | null;
}

export interface ValidationResult {
  week_ending: string;
  metrics_reported: number;
  per_metric_errors: Record<string, { predicted: number; actual: number; error_pct: number; status: string }>;
  overall_mape: number;
  calibration_applied: boolean;
  calibration_details: Record<string, { old_rate: number; new_rate: number; alpha: number }>;
  quality_checks: {
    consistency: 'pass' | 'fail' | 'skip';
    outlier: 'pass' | 'fail' | 'skip';
    continuity: 'pass' | 'fail' | 'skip';
  };
  bias_status: { detected: boolean; direction?: string; consecutive: number };
}

export interface LearnedRates {
  property_id: string;
  tour_rate: number;
  app_rate: number;
  lease_rate: number;
  renewal_rate: number | null;
  tour_rate_seasonal: Record<string, number>;
  app_rate_seasonal: Record<string, number>;
  lease_rate_seasonal: Record<string, number>;
  data_weeks: number;
  confidence_level: string;
  stabilized_occupancy: number | null;
  effective_rent_growth_rate: number | null;
  seasonal_index: number[];
  // Bias tracking
  consecutive_same_direction: number;
  bias_direction: 'over' | 'under' | null;
}

export interface UploadParseResult {
  success: boolean;
  rows_parsed: number;
  rows_valid: number;
  rows_invalid: number;
  errors: string[];
  actuals: WeeklyActuals[];
}

// ============================================================================
// Constants — Highlands at Berewick calibration baseline
// ============================================================================

const DEFAULT_RATES = {
  tour_rate: 0.56,       // MF avg from 243 weeks (v1 was 0.05!)
  app_rate: 0.44,        // MF avg from 243 weeks (v1 was 0.20)
  lease_rate: 0.75,      // MF avg from 243 weeks (v1 was 0.765)
  renewal_rate: 0.58,
};

const SEASONAL_DEFAULTS: Record<string, Record<string, number>> = {
  tour_rate: { summer: 0.62, winter: 0.48, spring: 0.56, fall: 0.52 },
  app_rate: { summer: 0.52, winter: 0.32, spring: 0.44, fall: 0.38 },
  lease_rate: { summer: 0.78, winter: 0.70, spring: 0.75, fall: 0.73 },
};

// EMA smoothing constants
const ALPHA_STANDARD = 0.15;   // Converges in ~15 uploads
const ALPHA_DAMPENED = 0.05;   // For outliers (|error| > 3σ)
const OUTLIER_Z_THRESHOLD = 2.5;

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  cold_start: 0,
  early: 4,
  calibrating: 13,
  trained: 52,
  high_fidelity: 104,
};

// Bias detection
const BIAS_CONSECUTIVE_THRESHOLD = 4;
const BIAS_DIRECTION_THRESHOLD = 0.75;

// ============================================================================
// Service
// ============================================================================

export class TrafficLearningService {

  /**
   * Parse uploaded Excel/CSV data into structured actuals
   */
  parseUpload(rows: Record<string, any>[]): UploadParseResult {
    const errors: string[] = [];
    const actuals: WeeklyActuals[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Normalize column names (case-insensitive, trim whitespace)
      const normalized: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        normalized[key.trim().toLowerCase().replace(/\s+/g, '_').replace(/%/g, 'pct')] = val;
      }

      // Required fields
      const weekEnding = this.parseDate(normalized.week_ending || normalized.weekending);
      const traffic = this.parseNumber(normalized.traffic || normalized.walk_ins || normalized.walkins);
      const netLeases = this.parseNumber(normalized.net_leases || normalized.netleases || normalized.leases);
      const occPct = this.parseNumber(normalized.occupancy_pct || normalized.occupancypct || normalized.occupancy || normalized.occ);
      const effRent = this.parseNumber(normalized.effective_rent || normalized.effectiverent || normalized.eff_rent);

      if (!weekEnding) { errors.push(`Row ${rowNum}: Missing or invalid 'Week Ending' date`); continue; }
      if (traffic === null) { errors.push(`Row ${rowNum}: Missing 'Traffic' (walk-ins)`); continue; }
      if (netLeases === null) { errors.push(`Row ${rowNum}: Missing 'Net Leases'`); continue; }
      if (occPct === null) { errors.push(`Row ${rowNum}: Missing 'Occupancy %'`); continue; }
      if (effRent === null) { errors.push(`Row ${rowNum}: Missing 'Effective Rent'`); continue; }

      // Range validation
      if (traffic < 0 || traffic > 500) { errors.push(`Row ${rowNum}: Traffic ${traffic} out of range (0-500)`); continue; }
      if (netLeases < -10 || netLeases > 50) { errors.push(`Row ${rowNum}: Net Leases ${netLeases} out of range`); continue; }
      if (occPct < 0 || occPct > 100) { errors.push(`Row ${rowNum}: Occupancy ${occPct}% out of range`); continue; }
      if (effRent < 0 || effRent > 20000) { errors.push(`Row ${rowNum}: Eff Rent $${effRent} out of range`); continue; }

      // Optional fields
      const tours = this.parseNumber(normalized.in_person_tours || normalized.tours || normalized.inpersontours);
      const apps = this.parseNumber(normalized.applications || normalized.apps);
      const moveIns = this.parseNumber(normalized.move_ins || normalized.moveins);
      const moveOuts = this.parseNumber(normalized.move_outs || normalized.moveouts);
      const concessions = this.parseNumber(normalized.concessions);
      const marketRent = this.parseNumber(normalized.market_rent || normalized.marketrent);
      const notes = normalized.notes?.toString() || null;

      actuals.push({
        property_id: '', // Set by caller
        week_ending: weekEnding,
        traffic, net_leases: netLeases, occupancy_pct: occPct, effective_rent: effRent,
        in_person_tours: tours, applications: apps,
        move_ins: moveIns, move_outs: moveOuts,
        concessions, market_rent: marketRent, notes,
      });
    }

    return {
      success: errors.length === 0 && actuals.length > 0,
      rows_parsed: rows.length,
      rows_valid: actuals.length,
      rows_invalid: rows.length - actuals.length,
      errors,
      actuals,
    };
  }

  /**
   * Main validation + learning loop for a single week of actuals
   */
  async validateAndLearn(propertyId: string, actuals: WeeklyActuals): Promise<ValidationResult> {
    actuals.property_id = propertyId;

    // Step 1: Get prediction for this week
    const prediction = await this.getPredictionForWeek(propertyId, actuals.week_ending);

    // Step 2: Calculate per-metric errors
    const errors = this.calculatePerMetricErrors(prediction, actuals);
    const metricsReported = Object.keys(errors).length;
    const mape = this.calculateMAPE(errors);

    // Step 3: Quality checks
    const qualityChecks = this.runQualityChecks(actuals, propertyId);

    // Step 4: Load current learned rates
    const rates = await this.getOrCreateLearnedRates(propertyId);

    // Step 5: Recalibrate conversion rates (EMA)
    const calibrationDetails = this.recalibrateRates(rates, actuals, prediction);
    const calibrationApplied = Object.keys(calibrationDetails).length > 0;

    // Step 6: Update seasonal index
    this.updateSeasonalIndex(rates, actuals);

    // Step 7: Update occupancy & rent tracking
    if (actuals.occupancy_pct) {
      rates.stabilized_occupancy = this.ema(
        actuals.occupancy_pct, rates.stabilized_occupancy || actuals.occupancy_pct, 0.10
      );
    }
    if (actuals.effective_rent && rates.data_weeks >= 52) {
      // Calculate rent growth from stored history
      const rentGrowth = await this.calculateRentGrowthRate(propertyId);
      if (rentGrowth !== null) rates.effective_rent_growth_rate = rentGrowth;
    }

    // Step 8: Detect bias
    const biasStatus = this.detectBias(rates, errors);

    // Step 9: Update confidence level
    rates.data_weeks += 1;
    rates.confidence_level = this.getConfidenceLevel(rates.data_weeks);

    // Step 10: Save everything
    await this.saveLearnedRates(rates);
    await this.saveValidation(propertyId, actuals, prediction, errors, mape, calibrationApplied, calibrationDetails);

    return {
      week_ending: actuals.week_ending,
      metrics_reported: metricsReported,
      per_metric_errors: errors,
      overall_mape: mape,
      calibration_applied: calibrationApplied,
      calibration_details: calibrationDetails,
      quality_checks: qualityChecks,
      bias_status: biasStatus,
    };
  }

  /**
   * Get learned rates for a property (or create defaults)
   */
  async getOrCreateLearnedRates(propertyId: string): Promise<LearnedRates> {
    const result = await pool.query(
      `SELECT * FROM traffic_learned_rates WHERE property_id = $1`,
      [propertyId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        property_id: propertyId,
        tour_rate: parseFloat(row.tour_rate),
        app_rate: parseFloat(row.app_rate),
        lease_rate: parseFloat(row.lease_rate),
        renewal_rate: row.renewal_rate ? parseFloat(row.renewal_rate) : null,
        tour_rate_seasonal: row.tour_rate_seasonal || {},
        app_rate_seasonal: row.app_rate_seasonal || {},
        lease_rate_seasonal: row.lease_rate_seasonal || {},
        data_weeks: row.data_weeks,
        confidence_level: row.confidence_level,
        stabilized_occupancy: row.stabilized_occupancy ? parseFloat(row.stabilized_occupancy) : null,
        effective_rent_growth_rate: row.effective_rent_growth_rate ? parseFloat(row.effective_rent_growth_rate) : null,
        seasonal_index: row.seasonal_index || [],
        consecutive_same_direction: row.consecutive_same_direction || 0,
        bias_direction: row.bias_direction || null,
      };
    }

    const submarketRates = await this.lookupSubmarketCalibration(propertyId);

    const defaults: LearnedRates = {
      property_id: propertyId,
      ...DEFAULT_RATES,
      ...(submarketRates || {}),
      tour_rate_seasonal: { ...SEASONAL_DEFAULTS.tour_rate },
      app_rate_seasonal: { ...SEASONAL_DEFAULTS.app_rate },
      lease_rate_seasonal: { ...SEASONAL_DEFAULTS.lease_rate },
      data_weeks: 0,
      confidence_level: submarketRates ? 'submarket_calibrated' : 'cold_start',
      stabilized_occupancy: null,
      effective_rent_growth_rate: null,
      seasonal_index: [],
      consecutive_same_direction: 0,
      bias_direction: null,
    };

    await pool.query(`
      INSERT INTO traffic_learned_rates (property_id, tour_rate, app_rate, lease_rate, renewal_rate,
        tour_rate_seasonal, app_rate_seasonal, lease_rate_seasonal, data_weeks, confidence_level, seasonal_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (property_id) DO NOTHING
    `, [
      propertyId, defaults.tour_rate, defaults.app_rate, defaults.lease_rate, defaults.renewal_rate,
      JSON.stringify(defaults.tour_rate_seasonal), JSON.stringify(defaults.app_rate_seasonal),
      JSON.stringify(defaults.lease_rate_seasonal), 0, 'cold_start', JSON.stringify([]),
    ]);

    return defaults;
  }

  /**
   * Get confidence score (0-100) and tier based on data volume
   */
  getConfidenceScore(dataWeeks: number): { score: number; tier: 'Low' | 'Medium' | 'High' } {
    let score: number;
    if (dataWeeks === 0) score = 40;
    else if (dataWeeks < 4) score = 40 + (dataWeeks / 4) * 15;
    else if (dataWeeks < 13) score = 55 + ((dataWeeks - 4) / 9) * 15;
    else if (dataWeeks < 52) score = 70 + ((dataWeeks - 13) / 39) * 15;
    else if (dataWeeks < 104) score = 85 + ((dataWeeks - 52) / 52) * 7;
    else score = Math.min(97, 92 + (dataWeeks - 104) / 200);

    const tier = score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low';
    return { score: Math.round(score), tier };
  }

  // ──────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────

  private async lookupSubmarketCalibration(
    propertyId: string
  ): Promise<{ tour_rate: number; app_rate: number; lease_rate: number } | null> {
    try {
      const propResult = await pool.query(
        `SELECT p.city, p.state_code, p.submarket_id
         FROM properties p WHERE p.id = $1 LIMIT 1`,
        [propertyId]
      );
      if (propResult.rows.length === 0) return null;

      const { city, state_code, submarket_id } = propResult.rows[0];

      let calRow: any = null;

      if (submarket_id) {
        const r = await pool.query(
          `SELECT avg_tour_conversion, avg_closing_ratio, sample_count
           FROM traffic_submarket_calibration
           WHERE submarket_id = $1 AND sample_count >= 1
           ORDER BY sample_count DESC LIMIT 1`,
          [submarket_id]
        );
        if (r.rows.length > 0) calRow = r.rows[0];
      }

      if (!calRow && city && state_code) {
        const r = await pool.query(
          `SELECT avg_tour_conversion, avg_closing_ratio, sample_count
           FROM traffic_submarket_calibration
           WHERE city = $1 AND state = $2 AND sample_count >= 1
           ORDER BY sample_count DESC LIMIT 1`,
          [city, state_code]
        );
        if (r.rows.length > 0) calRow = r.rows[0];
      }

      if (!calRow) return null;

      const overrides: { tour_rate: number; app_rate: number; lease_rate: number } = {
        tour_rate: DEFAULT_RATES.tour_rate,
        app_rate: DEFAULT_RATES.app_rate,
        lease_rate: DEFAULT_RATES.lease_rate,
      };

      if (calRow.avg_tour_conversion && Number(calRow.avg_tour_conversion) > 0) {
        overrides.tour_rate = Number(calRow.avg_tour_conversion);
      }
      if (calRow.avg_closing_ratio && Number(calRow.avg_closing_ratio) > 0) {
        overrides.lease_rate = Number(calRow.avg_closing_ratio);
      }

      console.log(`📊 Submarket calibration applied for property ${propertyId}: tour_rate=${overrides.tour_rate}, lease_rate=${overrides.lease_rate} (${calRow.sample_count} deals)`);
      return overrides;
    } catch (err: any) {
      console.error(`[TrafficLearning] Submarket calibration lookup failed:`, err.message);
      return null;
    }
  }

  private async getPredictionForWeek(propertyId: string, weekEnding: string): Promise<Record<string, number>> {
    const weekDate = new Date(weekEnding);
    const yearStart = new Date(weekDate.getFullYear(), 0, 1);
    const week = Math.ceil((weekDate.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const year = weekDate.getFullYear();

    const result = await pool.query(`
      SELECT weekly_walk_ins, in_person_tours, applications, net_leases,
             occupancy_pct, effective_rent, closing_ratio,
             tour_rate, app_rate, lease_rate
      FROM traffic_predictions
      WHERE property_id = $1 AND prediction_week = $2 AND prediction_year = $3
      LIMIT 1
    `, [propertyId, week, year]);

    if (result.rows.length === 0) {
      return { traffic: 0, tours: 0, apps: 0, net_leases: 0, occupancy_pct: 0, effective_rent: 0, closing_ratio: 0 };
    }

    const row = result.rows[0];
    return {
      traffic: row.weekly_walk_ins || 0,
      tours: row.in_person_tours || 0,
      apps: row.applications || 0,
      net_leases: row.net_leases || 0,
      occupancy_pct: row.occupancy_pct ? parseFloat(row.occupancy_pct) : 0,
      effective_rent: row.effective_rent ? parseFloat(row.effective_rent) : 0,
      closing_ratio: row.closing_ratio ? parseFloat(row.closing_ratio) : 0,
      tour_rate: row.tour_rate ? parseFloat(row.tour_rate) : 0,
      app_rate: row.app_rate ? parseFloat(row.app_rate) : 0,
      lease_rate: row.lease_rate ? parseFloat(row.lease_rate) : 0,
    };
  }

  private calculatePerMetricErrors(
    prediction: Record<string, number>,
    actuals: WeeklyActuals
  ): Record<string, { predicted: number; actual: number; error_pct: number; status: string }> {
    const errors: Record<string, { predicted: number; actual: number; error_pct: number; status: string }> = {};

    const pairs: Array<{ key: string; pred: number; actual: number | null | undefined; threshold: number }> = [
      { key: 'traffic', pred: prediction.traffic, actual: actuals.traffic, threshold: 0.15 },
      { key: 'tours', pred: prediction.tours, actual: actuals.in_person_tours, threshold: 0.20 },
      { key: 'apps', pred: prediction.apps, actual: actuals.applications, threshold: 0.25 },
      { key: 'net_leases', pred: prediction.net_leases, actual: actuals.net_leases, threshold: 0.25 },
      { key: 'occupancy_pct', pred: prediction.occupancy_pct, actual: actuals.occupancy_pct, threshold: 0.01 },
      { key: 'effective_rent', pred: prediction.effective_rent, actual: actuals.effective_rent, threshold: 0.01 },
    ];

    for (const { key, pred, actual, threshold } of pairs) {
      if (actual === null || actual === undefined) continue;
      const errPct = actual !== 0 ? Math.abs(pred - actual) / actual : 0;
      errors[key] = {
        predicted: pred,
        actual,
        error_pct: Math.round(errPct * 10000) / 10000,
        status: errPct <= threshold ? 'good' : errPct <= threshold * 2.5 ? 'warn' : 'bad',
      };
    }

    return errors;
  }

  private calculateMAPE(errors: Record<string, { error_pct: number }>): number {
    const values = Object.values(errors);
    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, e) => sum + e.error_pct, 0) / values.length) * 10000) / 10000;
  }

  private recalibrateRates(
    rates: LearnedRates,
    actuals: WeeklyActuals,
    prediction: Record<string, number>
  ): Record<string, { old_rate: number; new_rate: number; alpha: number }> {
    const details: Record<string, { old_rate: number; new_rate: number; alpha: number }> = {};

    // Minimum 4 weeks before overriding v1 defaults
    const blendFactor = rates.data_weeks < 4
      ? rates.data_weeks / 4
      : rates.data_weeks < 13 ? 0.5 + (rates.data_weeks - 4) / 18 : 1.0;

    // Tour rate: only when tours AND traffic both reported
    if (actuals.in_person_tours != null && actuals.traffic > 0) {
      const actualTourRate = actuals.in_person_tours / actuals.traffic;
      const alpha = this.isOutlier(actualTourRate, rates.tour_rate, 0.3) ? ALPHA_DAMPENED : ALPHA_STANDARD;
      const newRate = this.ema(actualTourRate, rates.tour_rate, alpha * blendFactor);
      if (Math.abs(newRate - rates.tour_rate) > 0.001) {
        details.tour_rate = { old_rate: rates.tour_rate, new_rate: newRate, alpha };
        rates.tour_rate = newRate;
      }
    }

    // App rate: only when apps AND tours both reported
    if (actuals.applications != null && actuals.in_person_tours != null && actuals.in_person_tours > 0) {
      const actualAppRate = actuals.applications / actuals.in_person_tours;
      const alpha = this.isOutlier(actualAppRate, rates.app_rate, 0.3) ? ALPHA_DAMPENED : ALPHA_STANDARD;
      const newRate = this.ema(actualAppRate, rates.app_rate, alpha * blendFactor);
      if (Math.abs(newRate - rates.app_rate) > 0.001) {
        details.app_rate = { old_rate: rates.app_rate, new_rate: newRate, alpha };
        rates.app_rate = newRate;
      }
    }

    // Lease rate: only when net_leases AND apps both reported
    if (actuals.net_leases != null && actuals.applications != null && actuals.applications > 0) {
      const actualLeaseRate = actuals.net_leases / actuals.applications;
      const alpha = this.isOutlier(actualLeaseRate, rates.lease_rate, 0.3) ? ALPHA_DAMPENED : ALPHA_STANDARD;
      const newRate = this.ema(actualLeaseRate, rates.lease_rate, alpha * blendFactor);
      if (Math.abs(newRate - rates.lease_rate) > 0.001) {
        details.lease_rate = { old_rate: rates.lease_rate, new_rate: newRate, alpha };
        rates.lease_rate = newRate;
      }
    }

    return details;
  }

  private updateSeasonalIndex(rates: LearnedRates, actuals: WeeklyActuals): void {
    if (!actuals.traffic || actuals.traffic <= 0) return;

    const weekDate = new Date(actuals.week_ending);
    const yearStart = new Date(weekDate.getFullYear(), 0, 1);
    const weekNum = Math.ceil((weekDate.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Initialize 52-week index if empty
    if (!rates.seasonal_index || rates.seasonal_index.length !== 52) {
      rates.seasonal_index = new Array(52).fill(1.0);
    }

    // Only update if not an outlier
    const idx = Math.min(weekNum - 1, 51);
    const currentFactor = rates.seasonal_index[idx];
    // Normalize traffic to get a seasonal factor (relative to recent average)
    // Simple approach: just track the ratio vs the running average
    const avgTraffic = rates.seasonal_index.reduce((s, v) => s + v, 0) / 52;
    if (avgTraffic > 0) {
      const actualFactor = actuals.traffic / avgTraffic;
      if (!this.isOutlier(actualFactor, currentFactor, 1.0)) {
        rates.seasonal_index[idx] = this.ema(actualFactor, currentFactor, ALPHA_STANDARD);
      }
    }
  }

  private detectBias(
    rates: LearnedRates,
    errors: Record<string, { predicted: number; actual: number; error_pct: number }>
  ): { detected: boolean; direction?: string; consecutive: number } {
    // Determine overall direction for this upload
    const errorEntries = Object.values(errors);
    if (errorEntries.length < 3) {
      return { detected: false, consecutive: 0 };
    }

    const overCount = errorEntries.filter(e => e.predicted > e.actual).length;
    const underCount = errorEntries.filter(e => e.predicted < e.actual).length;
    const direction = overCount > underCount ? 'over' : underCount > overCount ? 'under' : null;

    if (!direction) {
      rates.consecutive_same_direction = 0;
      return { detected: false, consecutive: 0 };
    }

    // Track consecutive same-direction errors
    if (rates.bias_direction === direction) {
      rates.consecutive_same_direction = (rates.consecutive_same_direction || 0) + 1;
    } else {
      rates.consecutive_same_direction = 1;
      rates.bias_direction = direction;
    }

    const detected = rates.consecutive_same_direction >= BIAS_CONSECUTIVE_THRESHOLD;

    return {
      detected,
      direction,
      consecutive: rates.consecutive_same_direction,
    };
  }

  private runQualityChecks(
    actuals: WeeklyActuals,
    _propertyId: string
  ): { consistency: 'pass' | 'fail' | 'skip'; outlier: 'pass' | 'fail' | 'skip'; continuity: 'pass' | 'fail' | 'skip' } {
    // Consistency: closing ratio should roughly equal net_leases / traffic
    let consistency: 'pass' | 'fail' | 'skip' = 'skip';
    if (actuals.traffic > 0 && actuals.net_leases >= 0) {
      const impliedClosingRatio = actuals.net_leases / actuals.traffic;
      consistency = impliedClosingRatio <= 1.0 ? 'pass' : 'fail';
    }

    // Outlier: z-score check (simplified — check if traffic is unreasonably high/low)
    let outlier: 'pass' | 'fail' | 'skip' = 'pass';
    if (actuals.traffic > 200) outlier = 'fail'; // Extremely high for multifamily
    if (actuals.occupancy_pct > 100 || actuals.occupancy_pct < 50) outlier = 'fail';

    // Continuity check would require historical context — skip for single-week validation
    const continuity: 'pass' | 'fail' | 'skip' = 'skip';

    return { consistency, outlier, continuity };
  }

  private async calculateRentGrowthRate(propertyId: string): Promise<number | null> {
    const result = await pool.query(`
      SELECT actual_effective_rent, observation_week, observation_year
      FROM traffic_validation
      WHERE property_id = $1 AND actual_effective_rent IS NOT NULL
      ORDER BY observation_year DESC, observation_week DESC
      LIMIT 52
    `, [propertyId]);

    if (result.rows.length < 26) return null; // Need at least 6 months

    const latest = parseFloat(result.rows[0].actual_effective_rent);
    const oldest = parseFloat(result.rows[result.rows.length - 1].actual_effective_rent);

    if (oldest <= 0) return null;

    const weeks = result.rows.length;
    const annualGrowth = Math.pow(latest / oldest, 52 / weeks) - 1;
    return Math.round(annualGrowth * 10000) / 10000;
  }

  private getConfidenceLevel(dataWeeks: number): string {
    if (dataWeeks >= CONFIDENCE_THRESHOLDS.high_fidelity) return 'high_fidelity';
    if (dataWeeks >= CONFIDENCE_THRESHOLDS.trained) return 'trained';
    if (dataWeeks >= CONFIDENCE_THRESHOLDS.calibrating) return 'calibrating';
    if (dataWeeks >= CONFIDENCE_THRESHOLDS.early) return 'early';
    return 'cold_start';
  }

  private async saveLearnedRates(rates: LearnedRates): Promise<void> {
    await pool.query(`
      INSERT INTO traffic_learned_rates (
        property_id, tour_rate, app_rate, lease_rate, renewal_rate,
        tour_rate_seasonal, app_rate_seasonal, lease_rate_seasonal,
        data_weeks, confidence_level, stabilized_occupancy, effective_rent_growth_rate,
        seasonal_index, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (property_id) DO UPDATE SET
        tour_rate = EXCLUDED.tour_rate,
        app_rate = EXCLUDED.app_rate,
        lease_rate = EXCLUDED.lease_rate,
        renewal_rate = EXCLUDED.renewal_rate,
        tour_rate_seasonal = EXCLUDED.tour_rate_seasonal,
        app_rate_seasonal = EXCLUDED.app_rate_seasonal,
        lease_rate_seasonal = EXCLUDED.lease_rate_seasonal,
        data_weeks = EXCLUDED.data_weeks,
        confidence_level = EXCLUDED.confidence_level,
        stabilized_occupancy = EXCLUDED.stabilized_occupancy,
        effective_rent_growth_rate = EXCLUDED.effective_rent_growth_rate,
        seasonal_index = EXCLUDED.seasonal_index,
        updated_at = NOW()
    `, [
      rates.property_id, rates.tour_rate, rates.app_rate, rates.lease_rate, rates.renewal_rate,
      JSON.stringify(rates.tour_rate_seasonal), JSON.stringify(rates.app_rate_seasonal),
      JSON.stringify(rates.lease_rate_seasonal),
      rates.data_weeks, rates.confidence_level,
      rates.stabilized_occupancy, rates.effective_rent_growth_rate,
      JSON.stringify(rates.seasonal_index),
    ]);
  }

  private async saveValidation(
    propertyId: string,
    actuals: WeeklyActuals,
    prediction: Record<string, number>,
    errors: Record<string, any>,
    mape: number,
    calibrationApplied: boolean,
    calibrationDetails: Record<string, any>
  ): Promise<void> {
    const weekDate = new Date(actuals.week_ending);
    const yearStart = new Date(weekDate.getFullYear(), 0, 1);
    const week = Math.ceil((weekDate.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const year = weekDate.getFullYear();

    await pool.query(`
      INSERT INTO traffic_validation (
        property_id, user_id, actual_weekly_walk_ins, actual_weekly_tours, actual_weekly_leases,
        actual_applications, actual_occupancy_pct, actual_effective_rent, actual_closing_ratio,
        observation_week, observation_year, predicted_walk_ins,
        variance_pct, variance_direction, metrics_reported, per_metric_errors,
        mape, calibration_applied, calibration_details, data_source
      ) VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'excel_upload')
      ON CONFLICT (property_id, observation_week, observation_year) DO UPDATE SET
        actual_weekly_walk_ins = EXCLUDED.actual_weekly_walk_ins,
        actual_weekly_tours = EXCLUDED.actual_weekly_tours,
        actual_weekly_leases = EXCLUDED.actual_weekly_leases,
        actual_applications = EXCLUDED.actual_applications,
        actual_occupancy_pct = EXCLUDED.actual_occupancy_pct,
        actual_effective_rent = EXCLUDED.actual_effective_rent,
        mape = EXCLUDED.mape,
        calibration_applied = EXCLUDED.calibration_applied,
        calibration_details = EXCLUDED.calibration_details
    `, [
      propertyId,
      actuals.traffic,
      actuals.in_person_tours || null,
      actuals.net_leases,
      actuals.applications || null,
      actuals.occupancy_pct,
      actuals.effective_rent,
      actuals.traffic > 0 ? actuals.net_leases / actuals.traffic * 100 : null,
      week, year,
      prediction.traffic,
      prediction.traffic > 0 ? ((actuals.traffic - prediction.traffic) / prediction.traffic * 100) : null,
      actuals.traffic > prediction.traffic ? 'over' : actuals.traffic < prediction.traffic ? 'under' : 'accurate',
      Object.keys(errors).length,
      JSON.stringify(errors),
      mape,
      calibrationApplied,
      JSON.stringify(calibrationDetails),
    ]);
  }

  private ema(actual: number, current: number, alpha: number): number {
    return alpha * actual + (1 - alpha) * current;
  }

  private isOutlier(value: number, mean: number, stdMultiple: number): boolean {
    // Simplified: if value deviates more than stdMultiple × mean from mean, it's an outlier
    return Math.abs(value - mean) > stdMultiple * Math.abs(mean);
  }

  private parseDate(value: any): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? parseFloat(value.replace(/[$,%]/g, '')) : Number(value);
    return isNaN(n) ? null : n;
  }
}

export const trafficLearning = new TrafficLearningService();
