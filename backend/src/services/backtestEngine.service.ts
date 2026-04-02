import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface CorrelationCandidate {
  leaderMetric: string;
  lagWeeks: number;
  correlationR: number;
  slope: number;
  intercept: number;
  trainSampleSize: number;
}

interface ForecastPoint {
  date: string;
  forecastValue: number;
  actualValue: number;
  error: number;
  errorPct: number;
  directionCorrect: boolean;
}

interface AccuracyResult {
  outcomeMetric: string;
  leaderMetric: string;
  modelType: string;
  rmse: number;
  mae: number;
  mape: number;
  directionalAccuracy: number;
  rSquared: number;
  sampleSizeTrain: number;
  sampleSizeTest: number;
  bestLagWeeks: number;
  trainCorrelationR: number;
  forecasts: ForecastPoint[];
}

export interface BacktestConfig {
  trainPct?: number;
  maxLagWeeks?: number;
  minCorrelation?: number;
  topNLeaders?: number;
  outcomeMetrics?: string[];
}

export interface BacktestRunResult {
  runId: number;
  propertyId: string;
  propertyName: string;
  trainPeriod: { start: string; end: string };
  testPeriod: { start: string; end: string };
  accuracyResults: AccuracyResult[];
  summary: {
    totalModels: number;
    avgMape: number;
    avgDirectionalAccuracy: number;
    bestModel: { outcomeMetric: string; leaderMetric: string; mape: number; r: number } | null;
    worstModel: { outcomeMetric: string; leaderMetric: string; mape: number } | null;
  };
}

const DEFAULT_OUTCOME_METRICS = [
  'OP_OCCUPANCY_PCT',
  'OP_EFFECTIVE_RENT',
  'OP_TRAFFIC',
  'OP_NET_LEASES',
  'OP_LEASED_PCT',
  'OP_WALKINS',
  'OP_APPLICATIONS',
  'OP_MOVE_INS',
  'OP_MOVE_OUTS',
  'OP_AVG_MARKET_RENT',
  'OP_TOTAL_VACANT',
];

const LEADER_SOURCES = ['costar', 'costar_forecast', 'fred', 'census_acs5', 'bls', 'census_bfs', 'google_trends', 'dot_traffic', 'derived', 'zillow'];

function safeFinite(v: number, fallback: number = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

function clampConfig(config: BacktestConfig): Required<Omit<BacktestConfig, 'outcomeMetrics'>> & { outcomeMetrics: string[] } {
  return {
    trainPct: Math.max(0.3, Math.min(0.9, config.trainPct ?? 0.7)),
    maxLagWeeks: Math.max(1, Math.min(52, config.maxLagWeeks ?? 26)),
    minCorrelation: Math.max(0.1, Math.min(0.99, config.minCorrelation ?? 0.3)),
    topNLeaders: Math.max(1, Math.min(50, config.topNLeaders ?? 10)),
    outcomeMetrics: config.outcomeMetrics ?? DEFAULT_OUTCOME_METRICS,
  };
}

export class BacktestEngineService {
  constructor(private pool: Pool) {}

  async runBacktest(
    propertyId: string,
    config: BacktestConfig = {}
  ): Promise<BacktestRunResult> {
    const {
      trainPct,
      maxLagWeeks,
      minCorrelation,
      topNLeaders,
      outcomeMetrics,
    } = clampConfig(config);

    const propRes = await this.pool.query(
      `SELECT DISTINCT geography_name FROM metric_time_series WHERE geography_id = $1 LIMIT 1`,
      [propertyId]
    );
    const propertyName = propRes.rows[0]?.geography_name || propertyId;

    const dateRange = await this.pool.query(
      `SELECT MIN(period_date)::text as earliest, MAX(period_date)::text as latest
       FROM metric_time_series
       WHERE geography_id = $1 AND source = 'property_ops' AND value IS NOT NULL
         AND metric_id NOT IN ('OP_BEG_OCCUPANCY', 'OP_END_OCCUPANCY', 'OP_TOTAL_VACANT', 'OP_TOTAL_NOTICE', 'OP_NET_LEASES')`,
      [propertyId]
    );

    if (!dateRange.rows[0]?.earliest) {
      throw new Error(`No property data found for ${propertyId}`);
    }

    const earliest = new Date(dateRange.rows[0].earliest);
    const latest = new Date(dateRange.rows[0].latest);
    const totalDays = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
    const trainDays = Math.floor(totalDays * trainPct);

    const trainEnd = new Date(earliest.getTime() + trainDays * 24 * 60 * 60 * 1000);
    const testStart = new Date(trainEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

    const trainStartStr = earliest.toISOString().substring(0, 10);
    const trainEndStr = trainEnd.toISOString().substring(0, 10);
    const testStartStr = testStart.toISOString().substring(0, 10);
    const testEndStr = latest.toISOString().substring(0, 10);

    logger.info(`[Backtest] ${propertyName}: Train ${trainStartStr} -> ${trainEndStr}, Test ${testStartStr} -> ${testEndStr}`);

    const runRes = await this.pool.query(
      `INSERT INTO backtest_runs (property_id, property_name, train_start, train_end, test_start, test_end, outcome_metrics, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running')
       RETURNING id`,
      [propertyId, propertyName, trainStartStr, trainEndStr, testStartStr, testEndStr, outcomeMetrics, JSON.stringify(config)]
    );
    const runId = runRes.rows[0].id;

    try {
      const leaderMetrics = await this.getLeaderMetrics(propertyId);
      logger.info(`[Backtest] Found ${leaderMetrics.length} potential leader metrics`);

      const accuracyResults: AccuracyResult[] = [];

      for (const outcomeMetric of outcomeMetrics) {
        const outcomeSeries = await this.getPropertySeries(propertyId, outcomeMetric);
        if (outcomeSeries.length < 20) {
          logger.warn(`[Backtest] Skipping ${outcomeMetric}: only ${outcomeSeries.length} points`);
          continue;
        }

        const trainOutcome = outcomeSeries.filter(p => p.date <= trainEndStr);
        const testOutcome = outcomeSeries.filter(p => p.date >= testStartStr);

        if (trainOutcome.length < 12 || testOutcome.length < 8) {
          continue;
        }

        const candidates: CorrelationCandidate[] = [];

        for (const leaderMetric of leaderMetrics) {
          const leaderSeries = await this.getLeaderSeries(leaderMetric, trainEndStr);
          if (leaderSeries.length < 8) continue;

          const best = this.findBestLag(
            leaderSeries, trainOutcome, maxLagWeeks, minCorrelation
          );

          if (best) {
            candidates.push({
              leaderMetric,
              lagWeeks: best.lagWeeks,
              correlationR: best.r,
              slope: best.slope,
              intercept: best.intercept,
              trainSampleSize: best.sampleSize,
            });
          }
        }

        candidates.sort((a, b) => Math.abs(b.correlationR) - Math.abs(a.correlationR));
        const topCandidates = candidates.slice(0, topNLeaders);

        for (const candidate of topCandidates) {
          const fullLeaderSeries = await this.getLeaderSeries(candidate.leaderMetric, testEndStr);
          const forecasts = this.generateForecasts(
            candidate, fullLeaderSeries, testOutcome
          );

          if (forecasts.length < 4) continue;

          const accuracy = this.computeAccuracy(
            outcomeMetric, candidate, forecasts, trainOutcome.length
          );

          if (!Number.isFinite(accuracy.rmse) || !Number.isFinite(accuracy.mape)) {
            logger.warn(`[Backtest] Skipping non-finite model: ${outcomeMetric} <- ${candidate.leaderMetric}`);
            continue;
          }

          accuracyResults.push(accuracy);

          await this.persistForecasts(runId, candidate, forecasts, outcomeMetric);
          await this.persistAccuracy(runId, accuracy);
        }
      }

      const summary = this.computeSummary(accuracyResults);

      await this.pool.query(
        `UPDATE backtest_runs SET status = 'completed', summary = $2, leader_metrics_used = $3, completed_at = NOW()
         WHERE id = $1`,
        [
          runId,
          JSON.stringify(summary),
          accuracyResults.map(a => a.leaderMetric),
        ]
      );

      logger.info(`[Backtest] Run #${runId} complete: ${accuracyResults.length} models, avg MAPE ${summary.avgMape.toFixed(2)}%`);

      return {
        runId,
        propertyId,
        propertyName,
        trainPeriod: { start: trainStartStr, end: trainEndStr },
        testPeriod: { start: testStartStr, end: testEndStr },
        accuracyResults,
        summary,
      };
    } catch (err) {
      await this.pool.query(
        `UPDATE backtest_runs SET status = 'failed', summary = $2, completed_at = NOW() WHERE id = $1`,
        [runId, JSON.stringify({ error: String(err) })]
      );
      throw err;
    }
  }

  private async getPropertySeries(propertyId: string, metricId: string): Promise<TimeSeriesPoint[]> {
    const res = await this.pool.query(
      `SELECT period_date::text as date, value
       FROM metric_time_series
       WHERE geography_id = $1 AND metric_id = $2 AND value IS NOT NULL
       ORDER BY period_date`,
      [propertyId, metricId]
    );
    return res.rows.map((r: any) => ({
      date: r.date.substring(0, 10),
      value: parseFloat(r.value),
    }));
  }

  private async getLeaderMetrics(propertyId: string): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT DISTINCT metric_id FROM metric_time_series
       WHERE source = ANY($1)
         AND metric_id NOT LIKE 'OP_%'
         AND value IS NOT NULL
       GROUP BY metric_id
       HAVING COUNT(*) >= 12
       ORDER BY metric_id`,
      [LEADER_SOURCES]
    );
    return res.rows.map((r: any) => r.metric_id);
  }

  private async getLeaderSeries(metricId: string, maxDate: string): Promise<TimeSeriesPoint[]> {
    const res = await this.pool.query(
      `SELECT period_date::text as date, AVG(value) as value
       FROM metric_time_series
       WHERE metric_id = $1 AND value IS NOT NULL AND period_date <= $2
       GROUP BY period_date
       ORDER BY period_date`,
      [metricId, maxDate]
    );
    return res.rows.map((r: any) => ({
      date: r.date.substring(0, 10),
      value: parseFloat(r.value),
    }));
  }

  private findBestLag(
    leaderSeries: TimeSeriesPoint[],
    outcomeSeries: TimeSeriesPoint[],
    maxLagWeeks: number,
    minCorrelation: number
  ): { lagWeeks: number; r: number; slope: number; intercept: number; sampleSize: number } | null {
    let bestResult: { lagWeeks: number; r: number; slope: number; intercept: number; sampleSize: number } | null = null;
    let bestAbsR = 0;

    const leaderByDate = new Map<string, number>();
    for (const p of leaderSeries) {
      leaderByDate.set(p.date, p.value);
    }

    const leaderDates = leaderSeries.map(p => new Date(p.date).getTime());
    const findNearestLeaderValue = (targetDate: Date, lagWeeks: number): number | null => {
      const laggedDate = new Date(targetDate.getTime() - lagWeeks * 7 * 24 * 60 * 60 * 1000);
      const laggedTime = laggedDate.getTime();

      let closestIdx = -1;
      let closestDist = Infinity;
      for (let i = 0; i < leaderDates.length; i++) {
        const dist = Math.abs(leaderDates[i] - laggedTime);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0 && closestDist < 45 * 24 * 60 * 60 * 1000) {
        return leaderSeries[closestIdx].value;
      }
      return null;
    };

    for (let lag = 0; lag <= maxLagWeeks; lag += (lag < 12 ? 1 : 2)) {
      const xVals: number[] = [];
      const yVals: number[] = [];

      for (const outcomePoint of outcomeSeries) {
        const leaderVal = findNearestLeaderValue(new Date(outcomePoint.date), lag);
        if (leaderVal !== null) {
          xVals.push(leaderVal);
          yVals.push(outcomePoint.value);
        }
      }

      if (xVals.length < 12) continue;

      const { r, slope, intercept } = this.linearRegression(xVals, yVals);

      if (!Number.isFinite(r)) continue;

      if (Math.abs(r) > bestAbsR && Math.abs(r) >= minCorrelation) {
        bestAbsR = Math.abs(r);
        bestResult = { lagWeeks: lag, r, slope, intercept, sampleSize: xVals.length };
      }
    }

    return bestResult;
  }

  private generateForecasts(
    candidate: CorrelationCandidate,
    leaderSeries: TimeSeriesPoint[],
    testOutcome: TimeSeriesPoint[]
  ): ForecastPoint[] {
    const forecasts: ForecastPoint[] = [];
    const leaderByTime = new Map<number, number>();
    for (const p of leaderSeries) {
      leaderByTime.set(new Date(p.date).getTime(), p.value);
    }

    const leaderTimes = Array.from(leaderByTime.keys()).sort((a, b) => a - b);

    let prevActual: number | null = null;

    for (const outcomePoint of testOutcome) {
      const targetTime = new Date(outcomePoint.date).getTime();
      const laggedTime = targetTime - candidate.lagWeeks * 7 * 24 * 60 * 60 * 1000;

      let closestIdx = -1;
      let closestDist = Infinity;
      for (let i = 0; i < leaderTimes.length; i++) {
        const dist = Math.abs(leaderTimes[i] - laggedTime);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx < 0 || closestDist > 45 * 24 * 60 * 60 * 1000) continue;

      const leaderVal = leaderByTime.get(leaderTimes[closestIdx])!;
      const forecastValue = candidate.slope * leaderVal + candidate.intercept;

      if (!Number.isFinite(forecastValue)) continue;

      const actualValue = outcomePoint.value;
      const error = forecastValue - actualValue;
      const errorPct = actualValue !== 0 ? (Math.abs(error) / Math.abs(actualValue)) * 100 : NaN;

      let directionCorrect: boolean;
      if (prevActual === null) {
        directionCorrect = false;
      } else {
        const actualDirection = actualValue >= prevActual ? 1 : -1;
        const forecastDirection = forecastValue >= prevActual ? 1 : -1;
        directionCorrect = actualDirection === forecastDirection;
      }

      forecasts.push({
        date: outcomePoint.date,
        forecastValue: safeFinite(Math.round(forecastValue * 100) / 100),
        actualValue,
        error: safeFinite(Math.round(error * 100) / 100),
        errorPct: Number.isFinite(errorPct) ? Math.round(errorPct * 100) / 100 : 0,
        directionCorrect,
      });

      prevActual = actualValue;
    }

    return forecasts;
  }

  private computeAccuracy(
    outcomeMetric: string,
    candidate: CorrelationCandidate,
    forecasts: ForecastPoint[],
    trainSize: number
  ): AccuracyResult {
    const errors = forecasts.map(f => f.forecastValue - f.actualValue);
    const absErrors = errors.map(e => Math.abs(e));
    const squaredErrors = errors.map(e => e * e);

    const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / errors.length);
    const mae = absErrors.reduce((a, b) => a + b, 0) / errors.length;

    const nonZeroForecasts = forecasts.filter(f => f.actualValue !== 0);
    const mape = nonZeroForecasts.length > 0
      ? nonZeroForecasts.reduce((s, f) => s + (Math.abs(f.forecastValue - f.actualValue) / Math.abs(f.actualValue)) * 100, 0) / nonZeroForecasts.length
      : 0;

    const directionForecasts = forecasts.slice(1);
    const directionalAccuracy = directionForecasts.length > 0
      ? (directionForecasts.filter(f => f.directionCorrect).length / directionForecasts.length) * 100
      : 0;

    const actualMean = forecasts.reduce((s, f) => s + f.actualValue, 0) / forecasts.length;
    const ssTot = forecasts.reduce((s, f) => s + (f.actualValue - actualMean) ** 2, 0);
    const ssRes = squaredErrors.reduce((a, b) => a + b, 0);
    const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    return {
      outcomeMetric,
      leaderMetric: candidate.leaderMetric,
      modelType: 'linear_regression',
      rmse: safeFinite(Math.round(rmse * 100) / 100),
      mae: safeFinite(Math.round(mae * 100) / 100),
      mape: safeFinite(Math.round(mape * 100) / 100),
      directionalAccuracy: safeFinite(Math.round(directionalAccuracy * 100) / 100),
      rSquared: safeFinite(Math.round(rSquared * 10000) / 10000),
      sampleSizeTrain: trainSize,
      sampleSizeTest: forecasts.length,
      bestLagWeeks: candidate.lagWeeks,
      trainCorrelationR: safeFinite(Math.round(candidate.correlationR * 10000) / 10000),
      forecasts,
    };
  }

  private computeSummary(results: AccuracyResult[]) {
    if (results.length === 0) {
      return {
        totalModels: 0,
        avgMape: 0,
        avgDirectionalAccuracy: 0,
        bestModel: null,
        worstModel: null,
      };
    }

    const avgMape = results.reduce((s, r) => s + r.mape, 0) / results.length;
    const avgDir = results.reduce((s, r) => s + r.directionalAccuracy, 0) / results.length;

    const sorted = [...results].sort((a, b) => a.mape - b.mape);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    return {
      totalModels: results.length,
      avgMape: Math.round(avgMape * 100) / 100,
      avgDirectionalAccuracy: Math.round(avgDir * 100) / 100,
      bestModel: best ? {
        outcomeMetric: best.outcomeMetric,
        leaderMetric: best.leaderMetric,
        mape: best.mape,
        r: best.trainCorrelationR,
      } : null,
      worstModel: worst ? {
        outcomeMetric: worst.outcomeMetric,
        leaderMetric: worst.leaderMetric,
        mape: worst.mape,
      } : null,
    };
  }

  private async persistForecasts(
    runId: number,
    candidate: CorrelationCandidate,
    forecasts: ForecastPoint[],
    outcomeMetric: string
  ): Promise<void> {
    for (const f of forecasts) {
      await this.pool.query(
        `INSERT INTO backtest_forecasts
         (run_id, outcome_metric, leader_metric, lag_weeks, correlation_r, forecast_date, forecast_value, actual_value, error, error_pct, direction_correct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [runId, outcomeMetric, candidate.leaderMetric, candidate.lagWeeks, safeFinite(candidate.correlationR),
         f.date, f.forecastValue, f.actualValue, f.error, f.errorPct, f.directionCorrect]
      );
    }
  }

  private async persistAccuracy(runId: number, accuracy: AccuracyResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO backtest_accuracy
       (run_id, outcome_metric, leader_metric, model_type, rmse, mae, mape, directional_accuracy,
        r_squared, sample_size_train, sample_size_test, best_lag_weeks, train_correlation_r)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [runId, accuracy.outcomeMetric, accuracy.leaderMetric, accuracy.modelType,
       accuracy.rmse, accuracy.mae, accuracy.mape, accuracy.directionalAccuracy,
       accuracy.rSquared, accuracy.sampleSizeTrain, accuracy.sampleSizeTest,
       accuracy.bestLagWeeks, accuracy.trainCorrelationR]
    );
  }

  private linearRegression(x: number[], y: number[]): { r: number; slope: number; intercept: number } {
    const n = x.length;
    if (n < 3) return { r: 0, slope: 0, intercept: 0 };

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    const ssXY = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
    const ssXX = x.reduce((s, xi) => s + (xi - meanX) ** 2, 0);
    const ssYY = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);

    if (ssXX === 0 || ssYY === 0) return { r: 0, slope: 0, intercept: meanY };

    const slope = ssXY / ssXX;
    const intercept = meanY - slope * meanX;
    const r = ssXY / Math.sqrt(ssXX * ssYY);

    return { r, slope, intercept };
  }

  async getRunResults(runId: number): Promise<any> {
    const runRes = await this.pool.query('SELECT * FROM backtest_runs WHERE id = $1', [runId]);
    if (runRes.rows.length === 0) return null;

    const accuracyRes = await this.pool.query(
      'SELECT * FROM backtest_accuracy WHERE run_id = $1 ORDER BY mape ASC', [runId]
    );

    const forecastRes = await this.pool.query(
      'SELECT * FROM backtest_forecasts WHERE run_id = $1 ORDER BY outcome_metric, leader_metric, forecast_date', [runId]
    );

    return {
      run: runRes.rows[0],
      accuracy: accuracyRes.rows,
      forecasts: forecastRes.rows,
    };
  }

  async getPropertyResults(propertyId: string): Promise<any[]> {
    const runsRes = await this.pool.query(
      'SELECT * FROM backtest_runs WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]
    );

    const results = [];
    for (const run of runsRes.rows) {
      const accuracyRes = await this.pool.query(
        'SELECT * FROM backtest_accuracy WHERE run_id = $1 ORDER BY mape ASC', [run.id]
      );
      results.push({
        run,
        accuracy: accuracyRes.rows,
      });
    }
    return results;
  }

  async getAllRuns(): Promise<any[]> {
    const res = await this.pool.query(
      'SELECT * FROM backtest_runs ORDER BY created_at DESC'
    );
    return res.rows;
  }
}
