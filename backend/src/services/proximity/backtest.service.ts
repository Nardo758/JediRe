/**
 * Backtest Service
 * 
 * Validates predictions against historical outcomes:
 * - Rent growth predictions
 * - Occupancy forecasts
 * - IRR projections
 * - Event impact estimates
 */

import { Pool } from 'pg';
import { MarketSnapshot, BacktestRun } from './types';

export interface BacktestConfig {
  name?: string;
  type: 'rent_growth' | 'occupancy' | 'irr' | 'event_impact';
  
  // Time windows
  trainingStart: Date;
  trainingEnd: Date;
  validationStart: Date;
  validationEnd: Date;
  
  // Scope
  geographyType?: string;
  geographyIds?: string[];
  
  // Features to use
  features?: string[];
  
  // Model config
  modelType?: string;
  hyperparameters?: Record<string, any>;
}

export interface BacktestResult {
  run: BacktestRun;
  predictions: Array<{
    geographyId: string;
    period: string;
    predicted: number;
    actual: number;
    error: number;
    errorPct: number;
  }>;
  featureImportance: Record<string, number>;
  insights: string[];
}

export class BacktestService {
  constructor(private pool: Pool) {}
  
  /**
   * Run a backtest for rent growth predictions
   */
  async backtestRentGrowth(config: BacktestConfig): Promise<BacktestResult> {
    const runId = await this.createBacktestRun(config);
    
    try {
      // Get training data
      const trainingSnapshots = await this.getSnapshots(
        config.geographyType || 'submarket',
        config.geographyIds || [],
        config.trainingStart,
        config.trainingEnd
      );
      
      // Get validation data
      const validationSnapshots = await this.getSnapshots(
        config.geographyType || 'submarket',
        config.geographyIds || [],
        config.validationStart,
        config.validationEnd
      );
      
      // Build simple regression model
      const model = this.buildRentGrowthModel(trainingSnapshots, config.features);
      
      // Make predictions on validation set
      const predictions: BacktestResult['predictions'] = [];
      let sumAbsError = 0;
      let sumSqError = 0;
      let sumAbsPctError = 0;
      let correctDirection = 0;
      
      for (const snapshot of validationSnapshots) {
        const predicted = this.predictRentGrowth(snapshot, model);
        const actual = snapshot.rentGrowthYoy || 0;
        const error = predicted - actual;
        const errorPct = actual !== 0 ? (error / actual) * 100 : 0;
        
        predictions.push({
          geographyId: snapshot.geographyId,
          period: snapshot.snapshotDate.toISOString().slice(0, 7),
          predicted,
          actual,
          error,
          errorPct
        });
        
        sumAbsError += Math.abs(error);
        sumSqError += error * error;
        sumAbsPctError += Math.abs(errorPct);
        
        if ((predicted >= 0 && actual >= 0) || (predicted < 0 && actual < 0)) {
          correctDirection++;
        }
      }
      
      const n = predictions.length;
      const mae = n > 0 ? sumAbsError / n : 0;
      const rmse = n > 0 ? Math.sqrt(sumSqError / n) : 0;
      const mape = n > 0 ? sumAbsPctError / n : 0;
      const directionAccuracy = n > 0 ? (correctDirection / n) * 100 : 0;
      
      // Generate insights
      const insights = this.generateInsights(predictions, model, config.type);
      
      // Update run with results
      await this.updateBacktestRun(runId, {
        sampleSize: n,
        mae,
        rmse,
        mape,
        directionAccuracyPct: directionAccuracy,
        featureImportance: model.featureImportance,
        status: 'completed'
      });
      
      const run = await this.getBacktestRun(runId);
      
      return {
        run: run!,
        predictions,
        featureImportance: model.featureImportance,
        insights
      };
    } catch (error) {
      await this.updateBacktestRun(runId, {
        status: 'failed',
        errorMessage: String(error)
      });
      throw error;
    }
  }
  
  /**
   * Backtest event impact predictions
   */
  async backtestEventImpact(config: BacktestConfig): Promise<BacktestResult> {
    const runId = await this.createBacktestRun(config);
    
    try {
      // Get historical events with outcomes
      const eventsWithOutcomes = await this.pool.query(`
        SELECT 
          me.*,
          eo.measurement_period,
          eo.rent_change_pct AS actual_rent_change,
          eo.occupancy_change_pct AS actual_occ_change
        FROM market_events me
        JOIN event_outcomes eo ON eo.event_id = me.id
        WHERE me.effective_date BETWEEN $1 AND $2
          -- Task #371: include analyst-confirmed and active events alongside
          -- completed ones; exclude unreviewed ('rumored', 'announced') and
          -- 'cancelled' so low-quality news extractions can't poison the
          -- training/validation set.
          AND me.status IN ('confirmed', 'active', 'completed')
          AND eo.measurement_period = '12mo'
      `, [config.trainingStart, config.validationEnd]);
      
      const predictions: BacktestResult['predictions'] = [];
      let sumAbsError = 0;
      let correctDirection = 0;
      
      for (const row of eventsWithOutcomes.rows) {
        // Simple prediction based on event type and magnitude
        const predicted = this.predictEventImpact(row);
        const actual = parseFloat(row.actual_rent_change) || 0;
        const error = predicted - actual;
        
        predictions.push({
          geographyId: row.geography_id,
          period: row.event_name,
          predicted,
          actual,
          error,
          errorPct: actual !== 0 ? (error / actual) * 100 : 0
        });
        
        sumAbsError += Math.abs(error);
        
        if ((predicted >= 0 && actual >= 0) || (predicted < 0 && actual < 0)) {
          correctDirection++;
        }
      }
      
      const n = predictions.length;
      const mae = n > 0 ? sumAbsError / n : 0;
      const directionAccuracy = n > 0 ? (correctDirection / n) * 100 : 0;
      
      const insights = [
        `Analyzed ${n} historical events`,
        `Direction accuracy: ${directionAccuracy.toFixed(1)}%`,
        `Mean absolute error: ${mae.toFixed(2)}%`
      ];
      
      await this.updateBacktestRun(runId, {
        sampleSize: n,
        mae,
        directionAccuracyPct: directionAccuracy,
        status: 'completed'
      });
      
      const run = await this.getBacktestRun(runId);
      
      return {
        run: run!,
        predictions,
        featureImportance: {
          event_type: 0.35,
          expected_magnitude: 0.25,
          jobs_affected: 0.20,
          distance: 0.20
        },
        insights
      };
    } catch (error) {
      await this.updateBacktestRun(runId, {
        status: 'failed',
        errorMessage: String(error)
      });
      throw error;
    }
  }
  
  /**
   * Validate event-impact predictions against ground-truth outcomes.
   *
   * For each row in `event_outcomes`, this:
   *  1. Pulls the parent `market_events` row (event_type, magnitude, jobs_affected, ...)
   *  2. Joins the closest `market_snapshots` row at the outcome's
   *     measurement_start_date for the same geography to recover the
   *     market-baseline rent_growth_yoy at event time.
   *  3. Generates a "what the engine would have predicted" rent_change_pct
   *     using the same heuristic the correlation engine uses for forward
   *     event impact (see `predictEventImpact`), additively combined with
   *     the baseline market growth recovered from the snapshot.
   *  4. Compares to the actual `rent_change_pct` and reports MAE, RMSE,
   *     direction accuracy, and a 0-100 calibration score per event_type
   *     and overall.
   *
   * Scoring semantics (heuristic, not formal statistical calibration):
   *  - `mae` and `rmse` are in percentage points of rent change.
   *  - `directionAccuracyPct` is the share of rows whose predicted sign
   *    matches the actual sign (predicted >= 0 ↔ actual >= 0).
   *  - `calibrationScore` = mean of (a) `max(0, 100 - mae*10)` and
   *    (b) `directionAccuracyPct`, bounded to [0,100]. It is meant as a
   *    quick-glance trustworthiness signal, NOT a Brier/reliability score.
   *
   * Baseline fallback:
   *  - If no `market_snapshots` row exists within ±180 days of the
   *    outcome's `measurement_start_date` for the same geography, the
   *    baseline rent_growth_yoy is treated as 0 and reported as
   *    `baselineRentGrowthYoy: null` in the per-row trace, so callers
   *    can tell when the baseline term was unavailable.
   *
   * Zero-LLM, deterministic.
   */
  async validateEventOutcomes(opts: {
    geographyType?: 'msa' | 'submarket';
    geographyId?: string;
    measurementPeriod?: '6mo' | '12mo' | '24mo';
  } = {}): Promise<{
    overall: {
      sampleSize: number;
      mae: number;
      rmse: number;
      directionAccuracyPct: number;
      calibrationScore: number;
    };
    perEventType: Array<{
      eventType: string;
      sampleSize: number;
      mae: number;
      rmse: number;
      directionAccuracyPct: number;
      calibrationScore: number;
      avgAttributionConfidence: number;
    }>;
    predictions: Array<{
      eventId: string;
      eventName: string;
      eventType: string;
      geographyType: string;
      geographyId: string;
      measurementPeriod: string;
      measurementStartDate: string;
      predicted: number;
      actual: number;
      baselineRentGrowthYoy: number | null;
      error: number;
      attributionConfidence: number | null;
    }>;
  }> {
    const filters: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (opts.geographyType) {
      filters.push(`eo.geography_type = $${p++}`);
      params.push(opts.geographyType);
    }
    if (opts.geographyId) {
      filters.push(`eo.geography_id = $${p++}`);
      params.push(opts.geographyId);
    }
    if (opts.measurementPeriod) {
      filters.push(`eo.measurement_period = $${p++}`);
      params.push(opts.measurementPeriod);
    }

    const whereClause = filters.length > 0
      ? `AND ${filters.join(' AND ')}`
      : '';

    // For each outcome, pick the market_snapshots row in the same geography
    // closest in time to measurement_start_date (within +/- 180 days) to use
    // as the market baseline. LATERAL keeps it one-row-per-outcome.
    const rows = await this.pool.query(
      `
      SELECT
        eo.event_id,
        eo.measurement_period,
        eo.measurement_start_date,
        eo.measurement_end_date,
        eo.geography_type,
        eo.geography_id,
        eo.rent_change_pct AS actual_rent_change,
        eo.attribution_confidence,
        me.event_type,
        me.event_name,
        me.expected_impact_magnitude,
        me.expected_impact_direction,
        me.jobs_affected,
        ms.rent_growth_yoy AS baseline_rent_growth_yoy
      FROM event_outcomes eo
      JOIN market_events me ON me.id = eo.event_id
      LEFT JOIN LATERAL (
        SELECT rent_growth_yoy
        FROM market_snapshots
        WHERE geography_type = eo.geography_type
          AND geography_id = eo.geography_id
          AND snapshot_date BETWEEN
            (eo.measurement_start_date - INTERVAL '180 days')
            AND
            (eo.measurement_start_date + INTERVAL '180 days')
        ORDER BY ABS(snapshot_date - eo.measurement_start_date)
        LIMIT 1
      ) ms ON TRUE
      WHERE eo.rent_change_pct IS NOT NULL
        ${whereClause}
      ORDER BY eo.measurement_start_date
      `,
      params
    );

    interface PredRow {
      eventId: string;
      eventName: string;
      eventType: string;
      geographyType: string;
      geographyId: string;
      measurementPeriod: string;
      measurementStartDate: string;
      predicted: number;
      actual: number;
      baselineRentGrowthYoy: number | null;
      error: number;
      attributionConfidence: number | null;
    }

    const predictions: PredRow[] = [];

    for (const row of rows.rows) {
      const baseline = row.baseline_rent_growth_yoy != null
        ? parseFloat(row.baseline_rent_growth_yoy)
        : null;

      // Engine prediction = event-attributable lift + market baseline growth
      // (same shape as a forward forecast: trend + event uplift).
      const eventLift = this.predictEventImpact({
        event_type: row.event_type,
        expected_impact_magnitude: row.expected_impact_magnitude,
        jobs_affected: row.jobs_affected
      });
      const predicted = eventLift + (baseline ?? 0);
      const actual = parseFloat(row.actual_rent_change) || 0;

      predictions.push({
        eventId: row.event_id,
        eventName: row.event_name,
        eventType: row.event_type,
        geographyType: row.geography_type,
        geographyId: row.geography_id,
        measurementPeriod: row.measurement_period,
        measurementStartDate: new Date(row.measurement_start_date)
          .toISOString().slice(0, 10),
        predicted,
        actual,
        baselineRentGrowthYoy: baseline,
        error: predicted - actual,
        attributionConfidence: row.attribution_confidence != null
          ? parseFloat(row.attribution_confidence)
          : null
      });
    }

    const summarize = (rowsIn: PredRow[]) => {
      const n = rowsIn.length;
      if (n === 0) {
        return {
          sampleSize: 0,
          mae: 0,
          rmse: 0,
          directionAccuracyPct: 0,
          calibrationScore: 0,
          avgAttributionConfidence: 0
        };
      }
      let sumAbs = 0;
      let sumSq = 0;
      let correctDir = 0;
      let confSum = 0;
      let confN = 0;
      for (const r of rowsIn) {
        sumAbs += Math.abs(r.error);
        sumSq += r.error * r.error;
        const samePos = r.predicted >= 0 && r.actual >= 0;
        const sameNeg = r.predicted < 0 && r.actual < 0;
        if (samePos || sameNeg) correctDir++;
        if (r.attributionConfidence != null) {
          confSum += r.attributionConfidence;
          confN++;
        }
      }
      const mae = sumAbs / n;
      const rmse = Math.sqrt(sumSq / n);
      const directionAccuracyPct = (correctDir / n) * 100;
      // Calibration: 100 when MAE = 0, decays linearly to 0 by MAE = 10pp,
      // then averaged 50/50 with direction accuracy. Bounded [0,100].
      const maeScore = Math.max(0, 100 - mae * 10);
      const calibrationScore = Math.max(
        0,
        Math.min(100, (maeScore + directionAccuracyPct) / 2)
      );
      return {
        sampleSize: n,
        mae,
        rmse,
        directionAccuracyPct,
        calibrationScore,
        avgAttributionConfidence: confN > 0 ? confSum / confN : 0
      };
    };

    const overallSummary = summarize(predictions);

    const byType = new Map<string, PredRow[]>();
    for (const r of predictions) {
      const arr = byType.get(r.eventType) ?? [];
      arr.push(r);
      byType.set(r.eventType, arr);
    }

    const perEventType = Array.from(byType.entries())
      .map(([eventType, rs]) => {
        const s = summarize(rs);
        return {
          eventType,
          sampleSize: s.sampleSize,
          mae: s.mae,
          rmse: s.rmse,
          directionAccuracyPct: s.directionAccuracyPct,
          calibrationScore: s.calibrationScore,
          avgAttributionConfidence: s.avgAttributionConfidence
        };
      })
      .sort((a, b) => b.sampleSize - a.sampleSize);

    return {
      overall: {
        sampleSize: overallSummary.sampleSize,
        mae: overallSummary.mae,
        rmse: overallSummary.rmse,
        directionAccuracyPct: overallSummary.directionAccuracyPct,
        calibrationScore: overallSummary.calibrationScore
      },
      perEventType,
      predictions
    };
  }

  /**
   * Get similar historical deals for comparison
   */
  async getSimilarDealsPerformance(params: {
    dealType?: string;
    submarket?: string;
    vintage?: number;
    units?: number;
    assetClass?: string;
  }): Promise<Array<{
    dealId: string;
    dealName: string;
    acquisitionDate: Date;
    projectedIrr: number;
    actualIrr: number;
    projectedExitCap: number;
    actualExitCap: number;
    holdPeriodYears: number;
    keyFactors: string[];
  }>> {
    // Query archive deals with actuals
    const result = await this.pool.query(`
      SELECT 
        ad.id,
        ad.deal_name,
        ad.acquisition_date,
        ad.projected_irr,
        ad.actual_irr,
        ad.projected_exit_cap,
        ad.actual_exit_cap,
        EXTRACT(YEAR FROM ad.disposition_date) - EXTRACT(YEAR FROM ad.acquisition_date) AS hold_years,
        ad.submarket,
        ad.asset_class,
        ad.units
      FROM archive_deals ad
      WHERE ad.actual_irr IS NOT NULL
        AND ($1::text IS NULL OR ad.deal_type = $1)
        AND ($2::text IS NULL OR ad.submarket = $2)
        AND ($3::int IS NULL OR ABS(EXTRACT(YEAR FROM ad.acquisition_date) - $3) <= 3)
        AND ($4::int IS NULL OR ABS(ad.units - $4) / ad.units::float < 0.5)
        AND ($5::text IS NULL OR ad.asset_class = $5)
      ORDER BY ad.acquisition_date DESC
      LIMIT 20
    `, [params.dealType, params.submarket, params.vintage, params.units, params.assetClass]);
    
    return result.rows.map(row => {
      const keyFactors: string[] = [];
      
      // Analyze what drove performance
      if (row.actual_irr > row.projected_irr * 1.1) {
        keyFactors.push('Outperformed projections');
      } else if (row.actual_irr < row.projected_irr * 0.9) {
        keyFactors.push('Underperformed projections');
      }
      
      if (row.actual_exit_cap < row.projected_exit_cap) {
        keyFactors.push('Cap rate compression');
      } else if (row.actual_exit_cap > row.projected_exit_cap) {
        keyFactors.push('Cap rate expansion');
      }
      
      return {
        dealId: row.id,
        dealName: row.deal_name,
        acquisitionDate: new Date(row.acquisition_date),
        projectedIrr: parseFloat(row.projected_irr) || 0,
        actualIrr: parseFloat(row.actual_irr) || 0,
        projectedExitCap: parseFloat(row.projected_exit_cap) || 0,
        actualExitCap: parseFloat(row.actual_exit_cap) || 0,
        holdPeriodYears: parseFloat(row.hold_years) || 0,
        keyFactors
      };
    });
  }
  
  /**
   * Capture a market snapshot
   */
  async captureSnapshot(
    geographyType: string,
    geographyId: string,
    geographyName: string,
    snapshotDate: Date = new Date()
  ): Promise<MarketSnapshot> {
    // Aggregate current market metrics
    // This would pull from various sources in production
    
    const snapshot: Partial<MarketSnapshot> = {
      geographyType,
      geographyId,
      geographyName,
      snapshotDate,
      snapshotType: 'monthly'
    };
    
    // Get rent data from apartment_locator_properties
    const rentData = await this.pool.query(`
      SELECT 
        COUNT(*) AS total_properties,
        SUM(total_units) AS total_units,
        AVG(avg_asking_rent) AS avg_asking_rent,
        AVG(avg_effective_rent) AS avg_effective_rent,
        AVG(occupancy_pct) AS avg_occupancy
      FROM apartment_locator_properties
      WHERE city ILIKE $1 OR state = $2
    `, [geographyId, geographyId]);
    
    if (rentData.rows[0]) {
      const row = rentData.rows[0];
      snapshot.totalProperties = parseInt(row.total_properties) || undefined;
      snapshot.totalUnits = parseInt(row.total_units) || undefined;
      snapshot.avgAskingRent = parseFloat(row.avg_asking_rent) || undefined;
      snapshot.avgEffectiveRent = parseFloat(row.avg_effective_rent) || undefined;
      snapshot.avgOccupancyPct = parseFloat(row.avg_occupancy) || undefined;
    }
    
    // Get supply pipeline from events
    const supplyData = await this.pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'active' THEN units_affected ELSE 0 END) AS under_construction,
        SUM(CASE WHEN effective_date > CURRENT_DATE THEN units_affected ELSE 0 END) AS planned_24mo
      FROM market_events
      WHERE event_type IN ('supply_delivery', 'supply_groundbreaking', 'supply_announced')
        AND geography_id = $1
        AND effective_date <= CURRENT_DATE + INTERVAL '24 months'
    `, [geographyId]);
    
    if (supplyData.rows[0]) {
      const row = supplyData.rows[0];
      snapshot.unitsUnderConstruction = parseInt(row.under_construction) || undefined;
      snapshot.plannedUnits24mo = parseInt(row.planned_24mo) || undefined;
    }
    
    // Insert snapshot
    const result = await this.pool.query(`
      INSERT INTO market_snapshots (
        geography_type, geography_id, geography_name, snapshot_date, snapshot_type,
        total_properties, total_units, avg_asking_rent, avg_effective_rent, avg_occupancy_pct,
        units_under_construction, planned_units_24mo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (geography_type, geography_id, snapshot_date) DO UPDATE SET
        total_properties = EXCLUDED.total_properties,
        total_units = EXCLUDED.total_units,
        avg_asking_rent = EXCLUDED.avg_asking_rent,
        avg_effective_rent = EXCLUDED.avg_effective_rent,
        avg_occupancy_pct = EXCLUDED.avg_occupancy_pct,
        units_under_construction = EXCLUDED.units_under_construction
      RETURNING *
    `, [
      snapshot.geographyType, snapshot.geographyId, snapshot.geographyName,
      snapshot.snapshotDate, snapshot.snapshotType,
      snapshot.totalProperties, snapshot.totalUnits,
      snapshot.avgAskingRent, snapshot.avgEffectiveRent, snapshot.avgOccupancyPct,
      snapshot.unitsUnderConstruction, snapshot.plannedUnits24mo
    ]);
    
    return this.mapRowToSnapshot(result.rows[0]);
  }
  
  /**
   * Get historical snapshots
   */
  async getSnapshots(
    geographyType: string,
    geographyIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<MarketSnapshot[]> {
    let query = `
      SELECT * FROM market_snapshots
      WHERE geography_type = $1
        AND snapshot_date BETWEEN $2 AND $3
    `;
    
    const params: any[] = [geographyType, startDate, endDate];
    
    if (geographyIds.length > 0) {
      query += ` AND geography_id = ANY($4)`;
      params.push(geographyIds);
    }
    
    query += ` ORDER BY geography_id, snapshot_date`;
    
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToSnapshot(row));
  }
  
  /**
   * Build simple rent growth model
   */
  private buildRentGrowthModel(snapshots: MarketSnapshot[], features?: string[]): {
    coefficients: Record<string, number>;
    intercept: number;
    featureImportance: Record<string, number>;
  } {
    // Simple heuristic model (would use ML in production)
    const coefficients: Record<string, number> = {
      occupancy: 0.15,       // Higher occupancy → higher rent growth
      supply_pressure: -0.08, // More supply → lower rent growth
      job_growth: 0.5,       // Job growth → rent growth
      affordability: -0.1    // High rent/income → lower growth
    };
    
    const featureImportance: Record<string, number> = {
      occupancy: 0.30,
      supply_pressure: 0.25,
      job_growth: 0.25,
      affordability: 0.20
    };
    
    return {
      coefficients,
      intercept: 0.02, // 2% baseline
      featureImportance
    };
  }
  
  /**
   * Predict rent growth for a snapshot
   */
  private predictRentGrowth(snapshot: MarketSnapshot, model: ReturnType<typeof this.buildRentGrowthModel>): number {
    let prediction = model.intercept;
    
    // Occupancy factor
    if (snapshot.avgOccupancyPct) {
      const occFactor = (snapshot.avgOccupancyPct - 95) / 100;
      prediction += model.coefficients.occupancy * occFactor;
    }
    
    // Supply pressure
    if (snapshot.unitsUnderConstruction && snapshot.totalUnits) {
      const supplyPressure = snapshot.unitsUnderConstruction / snapshot.totalUnits;
      prediction += model.coefficients.supply_pressure * supplyPressure;
    }
    
    // Job growth
    if (snapshot.jobGrowthYoy) {
      prediction += model.coefficients.job_growth * snapshot.jobGrowthYoy;
    }
    
    return prediction * 100; // Return as percentage
  }
  
  /**
   * Predict event impact
   */
  private predictEventImpact(event: any): number {
    // Base impact by event type
    const baseImpact: Record<string, number> = {
      employer_move: 3.0,
      employer_expansion: 2.5,
      employer_layoff: -2.0,
      employer_closure: -3.0,
      transit_opening: 4.0,
      supply_delivery: -1.5,
      grocery_opening: 1.5,
      economic_shock: -5.0
    };
    
    let impact = baseImpact[event.event_type] || 0;
    
    // Adjust by magnitude
    if (event.expected_impact_magnitude === 'transformative') {
      impact *= 2.0;
    } else if (event.expected_impact_magnitude === 'major') {
      impact *= 1.5;
    } else if (event.expected_impact_magnitude === 'minor') {
      impact *= 0.5;
    }
    
    // Adjust by jobs affected
    if (event.jobs_affected) {
      const jobsFactor = Math.min(Math.abs(event.jobs_affected) / 1000, 2);
      impact *= (1 + jobsFactor * 0.2);
      if (event.jobs_affected < 0) impact *= -1;
    }
    
    return impact;
  }
  
  /**
   * Generate insights from backtest results
   */
  private generateInsights(
    predictions: BacktestResult['predictions'],
    model: any,
    backtestType: string
  ): string[] {
    const insights: string[] = [];
    
    const n = predictions.length;
    if (n === 0) return ['No predictions to analyze'];
    
    // Calculate summary stats
    const avgError = predictions.reduce((sum, p) => sum + p.error, 0) / n;
    const avgAbsError = predictions.reduce((sum, p) => sum + Math.abs(p.error), 0) / n;
    
    // Bias detection
    if (avgError > 0.5) {
      insights.push(`Model tends to over-predict by ${avgError.toFixed(2)}%`);
    } else if (avgError < -0.5) {
      insights.push(`Model tends to under-predict by ${Math.abs(avgError).toFixed(2)}%`);
    } else {
      insights.push('Model shows minimal systematic bias');
    }
    
    // Feature importance
    const topFeature = Object.entries(model.featureImportance)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];
    if (topFeature) {
      insights.push(`Most predictive factor: ${topFeature[0]} (${((topFeature[1] as number) * 100).toFixed(0)}% importance)`);
    }
    
    // Accuracy assessment
    if (avgAbsError < 1) {
      insights.push('High accuracy: average error under 1%');
    } else if (avgAbsError < 3) {
      insights.push('Moderate accuracy: average error under 3%');
    } else {
      insights.push('Lower accuracy: consider additional features');
    }
    
    return insights;
  }
  
  /**
   * Create backtest run record
   */
  private async createBacktestRun(config: BacktestConfig): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO backtest_runs (
        backtest_name, backtest_type,
        training_start, training_end, validation_start, validation_end,
        geography_type, geography_ids, property_filter,
        model_type, features_used, hyperparameters,
        status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'running', NOW())
      RETURNING id
    `, [
      config.name, config.type,
      config.trainingStart, config.trainingEnd, config.validationStart, config.validationEnd,
      config.geographyType, config.geographyIds, config.hyperparameters,
      config.modelType, config.features, config.hyperparameters
    ]);
    
    return result.rows[0].id;
  }
  
  /**
   * Update backtest run
   */
  private async updateBacktestRun(runId: string, updates: Partial<BacktestRun>): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [runId];
    let paramIndex = 2;
    
    if (updates.sampleSize !== undefined) {
      setClauses.push(`sample_size = $${paramIndex++}`);
      params.push(updates.sampleSize);
    }
    if (updates.mae !== undefined) {
      setClauses.push(`mae = $${paramIndex++}`);
      params.push(updates.mae);
    }
    if (updates.rmse !== undefined) {
      setClauses.push(`rmse = $${paramIndex++}`);
      params.push(updates.rmse);
    }
    if (updates.mape !== undefined) {
      setClauses.push(`mape = $${paramIndex++}`);
      params.push(updates.mape);
    }
    if (updates.directionAccuracyPct !== undefined) {
      setClauses.push(`direction_accuracy_pct = $${paramIndex++}`);
      params.push(updates.directionAccuracyPct);
    }
    if (updates.featureImportance !== undefined) {
      setClauses.push(`feature_importance = $${paramIndex++}`);
      params.push(JSON.stringify(updates.featureImportance));
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
      if (updates.status === 'completed' || updates.status === 'failed') {
        setClauses.push(`completed_at = NOW()`);
      }
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      params.push(updates.errorMessage);
    }
    
    if (setClauses.length > 0) {
      await this.pool.query(
        `UPDATE backtest_runs SET ${setClauses.join(', ')} WHERE id = $1`,
        params
      );
    }
  }
  
  /**
   * Get backtest run by ID
   */
  private async getBacktestRun(runId: string): Promise<BacktestRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM backtest_runs WHERE id = $1',
      [runId]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      backtestName: row.backtest_name,
      backtestType: row.backtest_type,
      trainingStart: new Date(row.training_start),
      trainingEnd: new Date(row.training_end),
      validationStart: new Date(row.validation_start),
      validationEnd: new Date(row.validation_end),
      geographyType: row.geography_type,
      geographyIds: row.geography_ids,
      propertyFilter: row.property_filter,
      modelType: row.model_type,
      featuresUsed: row.features_used,
      hyperparameters: row.hyperparameters,
      sampleSize: row.sample_size,
      mae: row.mae ? parseFloat(row.mae) : undefined,
      rmse: row.rmse ? parseFloat(row.rmse) : undefined,
      mape: row.mape ? parseFloat(row.mape) : undefined,
      rSquared: row.r_squared ? parseFloat(row.r_squared) : undefined,
      directionAccuracyPct: row.direction_accuracy_pct ? parseFloat(row.direction_accuracy_pct) : undefined,
      within1pctAccuracy: row.within_1pct_accuracy ? parseFloat(row.within_1pct_accuracy) : undefined,
      within5pctAccuracy: row.within_5pct_accuracy ? parseFloat(row.within_5pct_accuracy) : undefined,
      featureImportance: row.feature_importance,
      status: row.status,
      errorMessage: row.error_message,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  }
  
  /**
   * Map database row to MarketSnapshot
   */
  private mapRowToSnapshot(row: any): MarketSnapshot {
    return {
      id: row.id,
      geographyType: row.geography_type,
      geographyId: row.geography_id,
      geographyName: row.geography_name,
      snapshotDate: new Date(row.snapshot_date),
      snapshotType: row.snapshot_type,
      totalProperties: row.total_properties,
      totalUnits: row.total_units,
      avgAskingRent: row.avg_asking_rent ? parseFloat(row.avg_asking_rent) : undefined,
      avgEffectiveRent: row.avg_effective_rent ? parseFloat(row.avg_effective_rent) : undefined,
      avgRentPsf: row.avg_rent_psf ? parseFloat(row.avg_rent_psf) : undefined,
      rentGrowthMom: row.rent_growth_mom ? parseFloat(row.rent_growth_mom) : undefined,
      rentGrowthYoy: row.rent_growth_yoy ? parseFloat(row.rent_growth_yoy) : undefined,
      avgOccupancyPct: row.avg_occupancy_pct ? parseFloat(row.avg_occupancy_pct) : undefined,
      availableUnits: row.available_units,
      vacancyRate: row.vacancy_rate ? parseFloat(row.vacancy_rate) : undefined,
      netAbsorptionUnits: row.net_absorption_units,
      avgDaysToLease: row.avg_days_to_lease,
      propertiesOfferingConcessionsPct: row.properties_offering_concessions_pct ? parseFloat(row.properties_offering_concessions_pct) : undefined,
      avgConcessionWeeks: row.avg_concession_weeks ? parseFloat(row.avg_concession_weeks) : undefined,
      avgConcessionValue: row.avg_concession_value ? parseFloat(row.avg_concession_value) : undefined,
      unitsUnderConstruction: row.units_under_construction,
      unitsPermittedTrailing12mo: row.units_permitted_trailing_12mo,
      unitsDeliveredTrailing12mo: row.units_delivered_trailing_12mo,
      transactionCountTrailing12mo: row.transaction_count_trailing_12mo,
      avgPricePerUnit: row.avg_price_per_unit ? parseFloat(row.avg_price_per_unit) : undefined,
      avgPricePsf: row.avg_price_psf ? parseFloat(row.avg_price_psf) : undefined,
      avgCapRate: row.avg_cap_rate ? parseFloat(row.avg_cap_rate) : undefined,
      unemploymentRate: row.unemployment_rate ? parseFloat(row.unemployment_rate) : undefined,
      jobGrowthYoy: row.job_growth_yoy ? parseFloat(row.job_growth_yoy) : undefined,
      populationGrowthYoy: row.population_growth_yoy ? parseFloat(row.population_growth_yoy) : undefined,
      medianHouseholdIncome: row.median_household_income ? parseFloat(row.median_household_income) : undefined
    };
  }
}

// Singleton factory
let backtestServiceInstance: BacktestService | null = null;

export function getBacktestService(pool: Pool): BacktestService {
  if (!backtestServiceInstance) {
    backtestServiceInstance = new BacktestService(pool);
  }
  return backtestServiceInstance;
}
