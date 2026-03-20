/**
 * Strategy Execution Service
 * Runs strategy conditions against market data to find matching geographies
 * Supports conditions like gt, lt, top_pct, increasing, decreasing, etc.
 */

import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

/**
 * Translates strategy metric IDs (both user-facing shortcodes and preset internal codes)
 * to actual metric_time_series metric_id values.
 */
const METRIC_ID_TRANSLATE: Record<string, string> = {
  // Standard user-facing codes
  SFR_HOME_VALUE: 'home_value_index',
  HOME_VALUE: 'home_value_index',
  ZHVI: 'home_value_index',
  ZHVI_ALL: 'home_value_index',
  HOME_VALUE_YOY: 'home_value_index_yoy',
  ZHVI_YOY: 'home_value_index_yoy',
  RENT: 'rent_index',
  SFR_RENT: 'rent_index',
  ZORI: 'rent_index',
  RENT_INDEX: 'rent_index',
  ZORI_YOY: 'rent_index_yoy',
  RENT_YOY: 'rent_index_yoy',
  RENT_INDEX_YOY: 'rent_index_yoy',
  // Preset strategy internal codes → best available real metric
  C_SURGE_INDEX: 'home_value_index_yoy',
  F_RENT_GROWTH: 'rent_index_yoy',
  D_SEARCH_MOMENTUM: 'rent_index_yoy',
  S_PIPELINE_TO_STOCK: 'home_value_index_yoy',
  E_WAGE_GROWTH: 'rent_index_yoy',
  M_VACANCY: 'home_value_index',
  S_PERMIT_VELOCITY: 'home_value_index_yoy',
  S_PIPELINE_UNITS: 'home_value_index',
  M_ABSORPTION: 'home_value_index_yoy',
  HM_DISTRESS_SCORE: 'home_value_index_yoy',
};

function translateMetricId(raw: string): string {
  if (!raw) return raw;
  return METRIC_ID_TRANSLATE[raw.toUpperCase()] ?? METRIC_ID_TRANSLATE[raw] ?? raw.toLowerCase();
}

export interface StrategyCondition {
  id: string;
  metricId: string;
  operator: string;
  value: number | [number, number] | string | null;
  weight: number;
  label?: string;
  required: boolean;
}

export interface ConditionResult {
  conditionId: string;
  metricId: string;
  actualValue: number;
  passed: boolean;
  score: number;
  percentile: number;
}

export interface StrategyResult {
  targetId: string;
  targetName: string;
  targetType: string;
  overallScore: number;
  conditionResults: ConditionResult[];
  rank: number;
}

interface StoredStrategy {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  type: string;
  scope: string;
  conditions: StrategyCondition[];
  combinator: string;
  sort_by: string;
  sort_direction: string;
  max_results: number;
  run_count: number;
  last_run_at: string | null;
}

export class StrategyExecutionService {
  constructor(private pool: Pool) {}

  /**
   * Execute a strategy by ID
   * Fetches strategy definition, evaluates conditions against all geographies,
   * returns ranked results, and updates run metadata
   */
  async executeStrategy(strategyId: string): Promise<StrategyResult[]> {
    try {
      // Fetch strategy definition
      const strategyResult = await this.pool.query(
        `SELECT * FROM strategy_definitions WHERE id = $1`,
        [strategyId]
      );

      if (strategyResult.rows.length === 0) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      const strategy = strategyResult.rows[0] as StoredStrategy;

      // Execute the strategy
      const results = await this.previewStrategy(
        strategy.conditions,
        strategy.scope,
        strategy.combinator,
        strategy.sort_by,
        strategy.max_results
      );

      // Update strategy run metadata
      await this.pool.query(
        `UPDATE strategy_definitions SET run_count = run_count + 1, last_run_at = NOW() WHERE id = $1`,
        [strategyId]
      );

      // Store results in strategy_runs
      await this.pool.query(
        `INSERT INTO strategy_runs (strategy_id, scope, result_count, results, run_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [strategyId, strategy.scope, results.length, JSON.stringify(results)]
      );

      logger.info(`Strategy ${strategyId} executed: ${results.length} results`, {
        strategyId,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error(`Error executing strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Preview a strategy without saving
   * Takes raw parameters instead of strategy ID
   */
  async previewStrategy(
    conditions: StrategyCondition[],
    scope: string,
    combinator: string,
    sortBy?: string,
    maxResults?: number
  ): Promise<StrategyResult[]> {
    try {
      if (conditions.length === 0) {
        return [];
      }

      // Extract unique metric IDs
      const metricIds = [...new Set(conditions.map((c) => c.metricId))];

      // Get the latest value for each metric × geography
      const latestMetricsResult = await this.pool.query(`
        WITH latest AS (
          SELECT DISTINCT ON (metric_id, geography_id)
            metric_id,
            geography_id,
            geography_name,
            value,
            period_date
          FROM metric_time_series
          WHERE geography_type = $1
            AND metric_id = ANY($2)
          ORDER BY metric_id, geography_id, period_date DESC
        )
        SELECT * FROM latest
      `, [scope, metricIds]);

      const latestMetrics = latestMetricsResult.rows;

      // Build a map of geography -> metrics
      const geographyMetrics = new Map<
        string,
        {
          geography_name: string;
          metrics: Map<string, { value: number; period_date: string }>;
        }
      >();

      for (const metric of latestMetrics) {
        if (!geographyMetrics.has(metric.geography_id)) {
          geographyMetrics.set(metric.geography_id, {
            geography_name: metric.geography_name,
            metrics: new Map(),
          });
        }
        geographyMetrics
          .get(metric.geography_id)!
          .metrics.set(metric.metric_id, {
            value: metric.value,
            period_date: metric.period_date,
          });
      }

      // Evaluate each geography against all conditions
      const results: StrategyResult[] = [];

      for (const [geoId, geoData] of geographyMetrics.entries()) {
        // Evaluate all conditions
        const conditionResults: ConditionResult[] = [];
        let passedRequiredCount = 0;
        let requiredCount = 0;
        const weightedScores: number[] = [];
        const weights: number[] = [];

        for (const condition of conditions) {
          const metricValue = geoData.metrics.get(condition.metricId);

          if (!metricValue) {
            // Metric not available for this geography
            conditionResults.push({
              conditionId: condition.id,
              metricId: condition.metricId,
              actualValue: 0,
              passed: false,
              score: 0,
              percentile: 0,
            });
            if (condition.required) {
              requiredCount++;
            }
            continue;
          }

          // Evaluate the condition
          const { passed, score, percentile } = await this.evaluateCondition(
            condition,
            metricValue.value,
            scope,
            metricIds
          );

          conditionResults.push({
            conditionId: condition.id,
            metricId: condition.metricId,
            actualValue: metricValue.value,
            passed,
            score,
            percentile,
          });

          if (passed) {
            weightedScores.push(score * condition.weight);
            weights.push(condition.weight);
          }

          if (condition.required) {
            requiredCount++;
            if (passed) {
              passedRequiredCount++;
            }
          }
        }

        // Check if this geography passes the combinator logic
        const passesRequirements =
          requiredCount === 0 ||
          (combinator === 'AND' ? passedRequiredCount === requiredCount : passedRequiredCount > 0);

        if (!passesRequirements) {
          continue;
        }

        // Calculate overall score
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const overallScore = totalWeight > 0 ? weightedScores.reduce((a, b) => a + b, 0) / totalWeight : 0;

        results.push({
          targetId: geoId,
          targetName: geoData.geography_name,
          targetType: scope,
          overallScore: Math.min(100, overallScore),
          conditionResults,
          rank: 0, // Will be set after sorting
        });
      }

      // Sort results
      if (sortBy) {
        results.sort((a, b) => {
          // Find the metric value from condition results
          const aMetric = a.conditionResults.find((cr) => cr.metricId === sortBy);
          const bMetric = b.conditionResults.find((cr) => cr.metricId === sortBy);

          const aValue = aMetric?.actualValue || 0;
          const bValue = bMetric?.actualValue || 0;

          return bValue - aValue; // Descending by default
        });
      } else {
        // Sort by overall score descending
        results.sort((a, b) => b.overallScore - a.overallScore);
      }

      // Add rank
      results.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      // Limit results
      const limit = maxResults || 50;
      return results.slice(0, limit);
    } catch (error) {
      logger.error('Error previewing strategy:', error);
      throw error;
    }
  }

  /**
   * Score a deal against all strategies
   * Returns which strategies the deal matches and scores
   */
  async scoreDeal(
    dealId: string,
    userId: string
  ): Promise<
    Array<{
      strategyId: string;
      strategyName: string;
      matched: boolean;
      score: number;
      conditionResults: ConditionResult[];
    }>
  > {
    try {
      // Get deal's location
      const dealResult = await this.pool.query(
        `SELECT city, state_code FROM deals WHERE id = $1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const { city, state_code } = dealResult.rows[0];

      // Build Zillow-style geography_id (city-state-state) and look up in metric_time_series
      const candidateGeoId = city && state_code
        ? `${city.toLowerCase().replace(/[\s,]+/g, '-')}-${state_code.toLowerCase()}-${state_code.toLowerCase()}`
        : null;

      let geography_type: string;
      let geography_id: string;

      if (candidateGeoId) {
        const geoResult = await this.pool.query(
          `SELECT DISTINCT geography_type, geography_id
           FROM metric_time_series
           WHERE geography_id = $1 AND geography_type = 'metro'
           LIMIT 1`,
          [candidateGeoId]
        );
        if (geoResult.rows.length > 0) {
          geography_type = geoResult.rows[0].geography_type;
          geography_id = geoResult.rows[0].geography_id;
        } else {
          // Fuzzy: match on geography_name ILIKE '%city%state%'
          const fuzzyResult = await this.pool.query(
            `SELECT DISTINCT geography_type, geography_id
             FROM metric_time_series
             WHERE geography_type = 'metro'
               AND geography_name ILIKE $1
             LIMIT 1`,
            [`%${city}%`]
          );
          geography_type = fuzzyResult.rows[0]?.geography_type ?? 'country';
          geography_id = fuzzyResult.rows[0]?.geography_id ?? 'united-states-102001';
        }
      } else {
        geography_type = 'country';
        geography_id = 'united-states-102001';
      }

      // Fetch all strategies (user's + presets)
      const strategiesResult = await this.pool.query(
        `SELECT * FROM strategy_definitions WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC`,
        [userId]
      );

      const strategies = strategiesResult.rows as StoredStrategy[];

      // Evaluate each strategy against this deal
      const scoreResults = [];

      for (const strategy of strategies) {
        // Filter conditions to only those applicable to this geography type
        const applicableConditions = strategy.conditions.filter((c) => c.metricId);

        if (applicableConditions.length === 0) {
          continue;
        }

        // Translate condition metric IDs to real DB metric IDs
        const translatedConditions = applicableConditions.map((c) => ({
          ...c,
          dbMetricId: translateMetricId(c.metricId),
        }));

        // Get metric values for this geography
        const metricIds = [...new Set(translatedConditions.map((c) => c.dbMetricId))];
        const metricsResult = await this.pool.query(
          `SELECT DISTINCT ON (metric_id)
            metric_id, value, period_date
          FROM metric_time_series
          WHERE geography_type = $1 AND geography_id = $2 AND metric_id = ANY($3)
          ORDER BY metric_id, period_date DESC`,
          [geography_type, geography_id, metricIds]
        );

        const metrics = new Map(metricsResult.rows.map((r) => [r.metric_id, r.value]));

        // Evaluate conditions
        const conditionResults: ConditionResult[] = [];
        let passedRequiredCount = 0;
        let requiredCount = 0;
        const weightedScores: number[] = [];
        const weights: number[] = [];

        for (const condition of translatedConditions) {
          const value = metrics.get(condition.dbMetricId);

          if (value === undefined) {
            conditionResults.push({
              conditionId: condition.id,
              metricId: condition.metricId,
              actualValue: 0,
              passed: false,
              score: 0,
              percentile: 0,
            });
            if (condition.required) {
              requiredCount++;
            }
            continue;
          }

          const { passed, score } = await this.evaluateCondition(
            { ...condition, metricId: condition.dbMetricId },
            value,
            geography_type,
            metricIds
          );

          conditionResults.push({
            conditionId: condition.id,
            metricId: condition.metricId,
            actualValue: value,
            passed,
            score,
            percentile: 0,
          });

          if (passed) {
            weightedScores.push(score * condition.weight);
            weights.push(condition.weight);
          }

          if (condition.required) {
            requiredCount++;
            if (passed) {
              passedRequiredCount++;
            }
          }
        }

        // Check if deal passes requirements
        const matched =
          requiredCount === 0 ||
          (strategy.combinator === 'AND'
            ? passedRequiredCount === requiredCount
            : passedRequiredCount > 0);

        // Calculate score
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const score = totalWeight > 0 ? weightedScores.reduce((a, b) => a + b, 0) / totalWeight : 0;

        scoreResults.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          matched,
          score: Math.min(100, score),
          conditionResults,
        });
      }

      return scoreResults;
    } catch (error) {
      logger.error(`Error scoring deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single condition against a metric value
   */
  private async evaluateCondition(
    condition: StrategyCondition,
    value: number,
    scope: string,
    metricIds: string[]
  ): Promise<{ passed: boolean; score: number; percentile: number }> {
    const operator = condition.operator;

    switch (operator) {
      case 'gt':
        return {
          passed: value > (condition.value as number),
          score: this.scoreValue(value, condition.value as number, true),
          percentile: 0,
        };

      case 'gte':
        return {
          passed: value >= (condition.value as number),
          score: this.scoreValue(value, condition.value as number, true),
          percentile: 0,
        };

      case 'lt':
        return {
          passed: value < (condition.value as number),
          score: this.scoreValue(condition.value as number, value, true),
          percentile: 0,
        };

      case 'lte':
        return {
          passed: value <= (condition.value as number),
          score: this.scoreValue(condition.value as number, value, true),
          percentile: 0,
        };

      case 'eq':
        return {
          passed: Math.abs(value - (condition.value as number)) < 0.01,
          score: Math.abs(value - (condition.value as number)) < 0.01 ? 100 : 0,
          percentile: 0,
        };

      case 'neq':
        return {
          passed: Math.abs(value - (condition.value as number)) >= 0.01,
          score: Math.abs(value - (condition.value as number)) >= 0.01 ? 100 : 0,
          percentile: 0,
        };

      case 'between': {
        const [min, max] = condition.value as [number, number];
        return {
          passed: value >= min && value <= max,
          score: value >= min && value <= max ? 100 : 0,
          percentile: 0,
        };
      }

      case 'top_pct': {
        const percentile = await this.getPercentile(condition.metricId, value, scope, true);
        const threshold = 100 - (condition.value as number);
        return {
          passed: percentile >= threshold,
          score: Math.max(0, (percentile - threshold) * (100 / (100 - threshold))),
          percentile,
        };
      }

      case 'bottom_pct': {
        const percentile = await this.getPercentile(condition.metricId, value, scope, false);
        const threshold = condition.value as number;
        return {
          passed: percentile <= threshold,
          score: Math.max(0, (threshold - percentile) * (100 / threshold)),
          percentile,
        };
      }

      case 'increasing': {
        const previousValue = await this.getPreviousValue(condition.metricId, value, scope, 6);
        return {
          passed: value > previousValue,
          score: previousValue > 0 ? Math.min(100, ((value - previousValue) / previousValue) * 100) : 0,
          percentile: 0,
        };
      }

      case 'decreasing': {
        const previousValue = await this.getPreviousValue(condition.metricId, value, scope, 6);
        return {
          passed: value < previousValue,
          score: previousValue > 0 ? Math.min(100, ((previousValue - value) / previousValue) * 100) : 0,
          percentile: 0,
        };
      }

      default:
        logger.warn(`Unknown operator: ${operator}`);
        return { passed: false, score: 0, percentile: 0 };
    }
  }

  /**
   * Score a value against a threshold
   * Higher values = higher scores (for higherIsBetter metrics)
   */
  private scoreValue(actual: number, threshold: number, higherIsBetter: boolean): number {
    if (threshold === 0) return actual !== 0 ? 50 : 0;
    if (higherIsBetter) {
      if (actual <= threshold) return 0;
      return Math.min(100, ((actual - threshold) / Math.abs(threshold)) * 100);
    } else {
      if (actual >= threshold) return 0;
      return Math.min(100, ((threshold - actual) / Math.abs(threshold)) * 100);
    }
  }

  /**
   * Get percentile rank for a value within a metric distribution
   */
  private async getPercentile(
    metricId: string,
    value: number,
    scope: string,
    descending: boolean
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT
        COALESCE(ROUND(100.0 * COUNT(CASE WHEN value ${descending ? '<' : '>'} $1 THEN 1 END) / NULLIF(COUNT(*), 0)), 0) as percentile
       FROM (
         SELECT DISTINCT ON (geography_id) value
         FROM metric_time_series
         WHERE metric_id = $2 AND geography_type = $3
         ORDER BY geography_id, period_date DESC
       ) latest`,
      [value, metricId, scope]
    );

    return result.rows[0]?.percentile || 0;
  }

  /**
   * Get the value from X months ago for trend analysis
   */
  private async getPreviousValue(
    metricId: string,
    currentValue: number,
    scope: string,
    monthsBack: number
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT value FROM metric_time_series
       WHERE metric_id = $1 AND geography_type = $2
         AND period_date <= NOW() - INTERVAL '${monthsBack} months'
       ORDER BY period_date DESC
       LIMIT 1`,
      [metricId, scope]
    );

    return result.rows[0]?.value || currentValue;
  }
}
