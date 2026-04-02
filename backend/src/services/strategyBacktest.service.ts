import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { translateMetricId } from '../utils/metricTranslation';

interface StrategyCondition {
  id: string;
  metricId: string;
  operator: string;
  value: number | [number, number] | string | null;
  weight: number;
  required: boolean;
}

interface ScreeningResult {
  screeningDate: string;
  forwardMonths: number;
  outcomeMetric: string;
  screenedGeos: string[];
  screenedAvg: number;
  unscreenedAvg: number;
  alpha: number;
  hitRate: number;
  screenedCount: number;
  totalCount: number;
}

interface BacktestSummary {
  strategyId: string;
  outcomeMetric: string;
  avgAlpha1y: number;
  avgAlpha3y: number;
  avgAlpha5y: number;
  avgHitRate: number;
  consistencyScore: number;
  signalDecay: Record<string, number>;
  grade: string;
  dataCoverage: {
    screeningDates: number;
    avgGeosPerScreen: number;
    conditionsCovered: number;
    totalConditions: number;
    evaluationPath: string;
  };
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

const COSTAR_METRIC_MAP: Record<string, string> = {
  'F_CAP_RATE': 'CS_CAP_RATE',
  'M_VACANCY': 'CS_VACANCY_RATE',
  'F_RENT_GROWTH': 'CS_RENT_GROWTH',
  'M_ABSORPTION': 'CS_NET_ABSORPTION',
  'F_RENT_TO_INCOME': 'CS_EFFECTIVE_RENT',
  'S_PIPELINE_UNITS': 'CS_CONSTR_STARTS_12MO',
  'E_WAGE_GROWTH': 'CS_EFF_RENT_GROWTH',
};

const COSTAR_OUTCOME_METRIC = 'CS_EFF_RENT_GROWTH';
const ZILLOW_OUTCOME_METRIC = 'rent_index_yoy';

const PROXY_INVERSE: Record<string, boolean> = {
  'F_CAP_RATE': true,
  'M_VACANCY': true,
  'F_RENT_TO_INCOME': true,
  'S_PIPELINE_TO_STOCK': true,
  'S_PERMIT_VELOCITY': true,
  'S_PIPELINE_UNITS': true,
  'O_DEBT_MATURITY_MO': true,
  'K_GOOGLE_RATING': true,
};

const FORWARD_MONTHS = [3, 6, 12, 24, 36, 60];

function generateQuarterlyDates(startYear: number, endYear: number): string[] {
  const dates: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const m of [1, 4, 7, 10]) {
      dates.push(`${y}-${String(m).padStart(2, '0')}-01`);
    }
  }
  return dates;
}

function findLatestAsOf(
  series: TimeSeriesPoint[],
  asOfDate: string
): number | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].date <= asOfDate) return series[i].value;
  }
  return undefined;
}

function findClosestInWindow(
  series: TimeSeriesPoint[],
  targetDate: string,
  windowMonths: number
): number | undefined {
  const target = new Date(targetDate);
  const windowStart = new Date(target);
  windowStart.setMonth(windowStart.getMonth() - windowMonths);
  const winStartStr = windowStart.toISOString().split('T')[0];

  let best: number | undefined;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].date <= targetDate && series[i].date >= winStartStr) {
      best = series[i].value;
      break;
    }
  }
  return best;
}

export class StrategyBacktestService {
  constructor(private pool: Pool) {}

  async runBacktest(strategyId: string): Promise<{
    results: ScreeningResult[];
    summary: BacktestSummary;
  }> {
    const stratRes = await this.pool.query(
      `SELECT * FROM strategy_definitions WHERE id = $1`,
      [strategyId]
    );
    if (stratRes.rows.length === 0) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const strategy = stratRes.rows[0];
    const conditions: StrategyCondition[] =
      typeof strategy.conditions === 'string'
        ? JSON.parse(strategy.conditions)
        : strategy.conditions;
    const scope: string = strategy.scope || 'msa';
    const combinator: string = strategy.combinator || 'AND';

    const useCostar = scope === 'submarket' && this.canUseCostar(conditions);
    const evaluationPath = useCostar ? 'costar' : 'zillow-proxy';
    const geoType = useCostar ? 'submarket' : 'metro';
    const outcomeMetric = useCostar ? COSTAR_OUTCOME_METRIC : ZILLOW_OUTCOME_METRIC;

    logger.info(`Strategy backtest: ${strategy.name} (${evaluationPath})`, {
      strategyId,
      scope,
      conditionCount: conditions.length,
    });

    const conditionDbMetrics = useCostar
      ? [...new Set(conditions.filter(c => COSTAR_METRIC_MAP[c.metricId]).map(c => COSTAR_METRIC_MAP[c.metricId]))]
      : [...new Set(conditions.map(c => translateMetricId(c.metricId)))];

    const allNeededMetrics = [...new Set([...conditionDbMetrics, outcomeMetric])];

    const dataRes = await this.pool.query(
      `SELECT metric_id, geography_id, period_date::text as period_date, value
       FROM metric_time_series
       WHERE geography_type = $1
         AND metric_id = ANY($2)
         AND value IS NOT NULL
       ORDER BY metric_id, geography_id, period_date`,
      [geoType, allNeededMetrics]
    );

    const tsData = new Map<string, Map<string, TimeSeriesPoint[]>>();
    for (const row of dataRes.rows) {
      const val = parseFloat(row.value);
      if (!isFinite(val)) continue;

      if (!tsData.has(row.metric_id)) tsData.set(row.metric_id, new Map());
      const metricMap = tsData.get(row.metric_id)!;
      if (!metricMap.has(row.geography_id)) metricMap.set(row.geography_id, []);
      metricMap.get(row.geography_id)!.push({
        date: row.period_date.substring(0, 10),
        value: val,
      });
    }

    const latestOutcomeDate = this.findLatestDate(tsData.get(outcomeMetric));
    if (!latestOutcomeDate) {
      return {
        results: [],
        summary: this.computeSummary(strategyId, [], outcomeMetric, conditions, evaluationPath),
      };
    }

    const now = new Date();
    const startYear = now.getFullYear() - 10;
    const maxScreenDate = new Date(latestOutcomeDate);
    maxScreenDate.setFullYear(maxScreenDate.getFullYear() - 2);
    const endYear = Math.min(maxScreenDate.getFullYear(), now.getFullYear() - 2);
    const screeningDates = generateQuarterlyDates(startYear, endYear);

    const allResults: ScreeningResult[] = [];

    for (const screenDate of screeningDates) {
      const passingGeos: string[] = [];
      const allGeos: string[] = [];

      if (useCostar) {
        this.screenCostar(conditions, combinator, screenDate, tsData, passingGeos, allGeos);
      } else {
        this.screenZillowProxy(conditions, combinator, screenDate, tsData, passingGeos, allGeos);
      }

      if (passingGeos.length === 0 || passingGeos.length === allGeos.length || allGeos.length < 10) {
        continue;
      }

      for (const fwd of FORWARD_MONTHS) {
        const outcomeDate = new Date(screenDate);
        outcomeDate.setMonth(outcomeDate.getMonth() + fwd);
        const outcomeDateStr = outcomeDate.toISOString().split('T')[0];

        if (outcomeDateStr > latestOutcomeDate) continue;

        const result = this.measureOutcomeFromCache(
          passingGeos,
          allGeos,
          screenDate,
          fwd,
          outcomeDateStr,
          outcomeMetric,
          tsData
        );

        if (result && result.totalCount >= 5) {
          allResults.push(result);
        }
      }
    }

    await this.storeResults(strategyId, allResults);
    const summary = this.computeSummary(strategyId, allResults, outcomeMetric, conditions, evaluationPath);
    await this.storeSummary(strategyId, outcomeMetric, summary);

    logger.info(`Strategy backtest complete: ${strategy.name} → Grade ${summary.grade}`, {
      strategyId,
      grade: summary.grade,
      avgHitRate: summary.avgHitRate,
      avgAlpha1y: summary.avgAlpha1y,
      resultCount: allResults.length,
    });

    return { results: allResults, summary };
  }

  private findLatestDate(metricMap: Map<string, TimeSeriesPoint[]> | undefined): string | null {
    if (!metricMap) return null;
    let latest = '';
    for (const series of metricMap.values()) {
      if (series.length > 0) {
        const last = series[series.length - 1].date;
        if (last > latest) latest = last;
      }
    }
    return latest || null;
  }

  private canUseCostar(conditions: StrategyCondition[]): boolean {
    let mapped = 0;
    for (const c of conditions) {
      if (COSTAR_METRIC_MAP[c.metricId]) mapped++;
    }
    return mapped >= Math.ceil(conditions.length / 2);
  }

  private screenCostar(
    conditions: StrategyCondition[],
    combinator: string,
    screenDate: string,
    tsData: Map<string, Map<string, TimeSeriesPoint[]>>,
    passingGeos: string[],
    allGeos: string[]
  ): void {
    const mappedConds = conditions
      .filter(c => COSTAR_METRIC_MAP[c.metricId])
      .map(c => ({ ...c, dbMetric: COSTAR_METRIC_MAP[c.metricId] }));

    if (mappedConds.length === 0) return;

    const geoSet = new Set<string>();
    for (const c of mappedConds) {
      const metricMap = tsData.get(c.dbMetric);
      if (metricMap) {
        for (const geoId of metricMap.keys()) geoSet.add(geoId);
      }
    }

    for (const geoId of geoSet) {
      allGeos.push(geoId);

      const condResults = mappedConds.map(c => {
        const series = tsData.get(c.dbMetric)?.get(geoId);
        if (!series) return null;
        const val = findLatestAsOf(series, screenDate);
        if (val === undefined) return null;
        return this.evaluateConditionValue(c.operator, c.value, val);
      });

      const valid = condResults.filter(r => r !== null) as boolean[];
      if (valid.length === 0) continue;

      const passes = combinator === 'AND' ? valid.every(r => r) : valid.some(r => r);
      if (passes) passingGeos.push(geoId);
    }
  }

  private screenZillowProxy(
    conditions: StrategyCondition[],
    combinator: string,
    screenDate: string,
    tsData: Map<string, Map<string, TimeSeriesPoint[]>>,
    passingGeos: string[],
    allGeos: string[]
  ): void {
    const mappedConds = conditions.map(c => ({
      ...c,
      dbMetric: translateMetricId(c.metricId),
      isInverse: PROXY_INVERSE[c.metricId] || false,
    }));

    const distributions = new Map<string, number[]>();
    const geoValues = new Map<string, Map<string, number>>();
    const geoSet = new Set<string>();

    for (const c of mappedConds) {
      const metricMap = tsData.get(c.dbMetric);
      if (!metricMap) continue;

      const vals: number[] = [];
      for (const [geoId, series] of metricMap.entries()) {
        const val = findLatestAsOf(series, screenDate);
        if (val === undefined) continue;

        geoSet.add(geoId);
        if (!geoValues.has(geoId)) geoValues.set(geoId, new Map());
        geoValues.get(geoId)!.set(c.dbMetric, val);
        vals.push(val);
      }

      if (vals.length > 0) {
        distributions.set(c.dbMetric, [...vals].sort((a, b) => a - b));
      }
    }

    for (const geoId of geoSet) {
      allGeos.push(geoId);
      const geoVals = geoValues.get(geoId);
      if (!geoVals) continue;

      const condResults = mappedConds.map(c => {
        const val = geoVals.get(c.dbMetric);
        if (val === undefined) return null;
        const dist = distributions.get(c.dbMetric);
        if (!dist || dist.length === 0) return null;

        if (c.value != null && !c.isInverse) {
          return this.evaluateConditionValue(c.operator, c.value, val);
        }

        const percentile = this.getPercentile(dist, val);
        const effectiveOp = c.isInverse ? this.invertOperator(c.operator) : c.operator;
        return this.evaluatePercentileCondition(effectiveOp, c.value, percentile);
      });

      const valid = condResults.filter(r => r !== null) as boolean[];
      if (valid.length === 0) continue;

      const passes = combinator === 'AND' ? valid.every(r => r) : valid.some(r => r);
      if (passes) passingGeos.push(geoId);
    }
  }

  private getPercentile(sortedDist: number[], value: number): number {
    let idx = 0;
    for (let i = 0; i < sortedDist.length; i++) {
      if (sortedDist[i] <= value) idx = i + 1;
      else break;
    }
    return (idx / sortedDist.length) * 100;
  }

  private invertOperator(op: string): string {
    switch (op) {
      case 'gt': return 'lt';
      case 'gte': return 'lte';
      case 'lt': return 'gt';
      case 'lte': return 'gte';
      default: return op;
    }
  }

  private evaluatePercentileCondition(
    operator: string,
    _threshold: number | [number, number] | string | null,
    percentile: number
  ): boolean {
    switch (operator) {
      case 'gt':
      case 'gte':
      case 'increasing':
        return percentile >= 60;
      case 'lt':
      case 'lte':
      case 'decreasing':
        return percentile <= 40;
      case 'between':
        return percentile >= 25 && percentile <= 75;
      default:
        return percentile >= 60;
    }
  }

  private evaluateConditionValue(
    operator: string,
    threshold: number | [number, number] | string | null,
    value: number
  ): boolean {
    switch (operator) {
      case 'gt': return value > (threshold as number);
      case 'gte': return value >= (threshold as number);
      case 'lt': return value < (threshold as number);
      case 'lte': return value <= (threshold as number);
      case 'between': {
        const [min, max] = threshold as [number, number];
        return value >= min && value <= max;
      }
      case 'increasing': return true;
      case 'decreasing': return true;
      default: return value > (threshold as number);
    }
  }

  private measureOutcomeFromCache(
    screenedGeos: string[],
    allGeos: string[],
    screenDate: string,
    forwardMonths: number,
    outcomeDateStr: string,
    outcomeMetric: string,
    tsData: Map<string, Map<string, TimeSeriesPoint[]>>
  ): ScreeningResult | null {
    const outcomeMap = tsData.get(outcomeMetric);
    if (!outcomeMap) return null;

    const screenedSet = new Set(screenedGeos);
    const screenedOutcomes: number[] = [];
    const unscreenedOutcomes: number[] = [];
    const allOutcomes: number[] = [];

    for (const geoId of allGeos) {
      const series = outcomeMap.get(geoId);
      if (!series) continue;
      const val = findClosestInWindow(series, outcomeDateStr, 3);
      if (val === undefined || !isFinite(val)) continue;

      allOutcomes.push(val);
      if (screenedSet.has(geoId)) {
        screenedOutcomes.push(val);
      } else {
        unscreenedOutcomes.push(val);
      }
    }

    if (screenedOutcomes.length === 0 || allOutcomes.length < 5) return null;

    const screenedAvg = screenedOutcomes.reduce((a, b) => a + b, 0) / screenedOutcomes.length;
    const unscreenedAvg = unscreenedOutcomes.length > 0
      ? unscreenedOutcomes.reduce((a, b) => a + b, 0) / unscreenedOutcomes.length
      : screenedAvg;
    const alpha = screenedAvg - unscreenedAvg;

    const allSorted = [...allOutcomes].sort((a, b) => a - b);
    const allMedian = allSorted[Math.floor(allSorted.length / 2)];
    const hitCount = screenedOutcomes.filter(v => v > allMedian).length;
    const hitRate = (hitCount / screenedOutcomes.length) * 100;

    return {
      screeningDate: screenDate,
      forwardMonths,
      outcomeMetric,
      screenedGeos: screenedGeos.slice(0, 20),
      screenedAvg: parseFloat(screenedAvg.toFixed(4)),
      unscreenedAvg: parseFloat(unscreenedAvg.toFixed(4)),
      alpha: parseFloat(alpha.toFixed(4)),
      hitRate: parseFloat(hitRate.toFixed(1)),
      screenedCount: screenedOutcomes.length,
      totalCount: allOutcomes.length,
    };
  }

  private async storeResults(strategyId: string, results: ScreeningResult[]): Promise<void> {
    await this.pool.query(
      `DELETE FROM strategy_backtest_results WHERE strategy_id = $1`,
      [strategyId]
    );

    if (results.length === 0) return;

    const batchSize = 30;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const values: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const r of batch) {
        values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, NOW())`);
        params.push(
          strategyId, r.screeningDate, r.outcomeMetric, r.forwardMonths,
          JSON.stringify(r.screenedGeos.slice(0, 20)),
          r.screenedAvg, r.unscreenedAvg, r.alpha, r.hitRate,
          r.screenedCount, r.totalCount
        );
        idx += 11;
      }

      await this.pool.query(
        `INSERT INTO strategy_backtest_results
         (strategy_id, screening_date, outcome_metric_id, forward_months,
          screened_geographies, screened_avg, unscreened_avg, alpha, hit_rate,
          screened_count, total_count, computed_at)
         VALUES ${values.join(', ')}`,
        params
      );
    }
  }

  private async storeSummary(strategyId: string, outcomeMetric: string, summary: BacktestSummary): Promise<void> {
    await this.pool.query(
      `INSERT INTO strategy_backtest_summary
       (strategy_id, outcome_metric_id, avg_alpha_1y, avg_alpha_3y, avg_alpha_5y,
        avg_hit_rate, consistency_score, signal_decay, grade, data_coverage, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (strategy_id, outcome_metric_id)
       DO UPDATE SET avg_alpha_1y = $3, avg_alpha_3y = $4, avg_alpha_5y = $5,
                     avg_hit_rate = $6, consistency_score = $7, signal_decay = $8,
                     grade = $9, data_coverage = $10, computed_at = NOW()`,
      [
        strategyId, outcomeMetric,
        summary.avgAlpha1y, summary.avgAlpha3y, summary.avgAlpha5y,
        summary.avgHitRate, summary.consistencyScore,
        JSON.stringify(summary.signalDecay), summary.grade,
        JSON.stringify(summary.dataCoverage),
      ]
    );
  }

  private computeSummary(
    strategyId: string,
    results: ScreeningResult[],
    outcomeMetric: string,
    conditions: StrategyCondition[],
    evaluationPath: string
  ): BacktestSummary {
    const byForward = new Map<number, ScreeningResult[]>();
    for (const r of results) {
      if (!byForward.has(r.forwardMonths)) byForward.set(r.forwardMonths, []);
      byForward.get(r.forwardMonths)!.push(r);
    }

    const avgAlpha = (months: number): number => {
      const group = byForward.get(months) || [];
      if (group.length === 0) return 0;
      return parseFloat((group.reduce((s, r) => s + r.alpha, 0) / group.length).toFixed(4));
    };

    const allHitRates = results.filter(r => r.screenedCount > 0).map(r => r.hitRate);
    const avgHitRate = allHitRates.length > 0
      ? parseFloat((allHitRates.reduce((s, h) => s + h, 0) / allHitRates.length).toFixed(1))
      : 0;

    const signalDecay: Record<string, number> = {};
    for (const fm of FORWARD_MONTHS) {
      signalDecay[`${fm}m`] = avgAlpha(fm);
    }

    const alpha1y = avgAlpha(12);
    const alpha3y = avgAlpha(36);
    const alpha5y = avgAlpha(60);

    const positiveAlphaCount = results.filter(r => r.alpha > 0).length;
    const consistencyScore = results.length > 0
      ? parseFloat(((positiveAlphaCount / results.length) * 100).toFixed(1))
      : 0;

    const conditionsCovered = evaluationPath === 'costar'
      ? conditions.filter(c => COSTAR_METRIC_MAP[c.metricId]).length
      : conditions.length;

    const avgGeosPerScreen = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.totalCount, 0) / results.length)
      : 0;

    const grade = this.computeGrade(avgHitRate, alpha1y, consistencyScore);

    return {
      strategyId,
      outcomeMetric,
      avgAlpha1y: alpha1y,
      avgAlpha3y: alpha3y,
      avgAlpha5y: alpha5y,
      avgHitRate,
      consistencyScore,
      signalDecay,
      grade,
      dataCoverage: {
        screeningDates: new Set(results.map(r => r.screeningDate)).size,
        avgGeosPerScreen,
        conditionsCovered,
        totalConditions: conditions.length,
        evaluationPath,
      },
    };
  }

  private computeGrade(hitRate: number, alpha1y: number, consistency: number): string {
    if (hitRate >= 65 && alpha1y >= 2 && consistency >= 60) return 'A';
    if (hitRate >= 58 && alpha1y >= 1 && consistency >= 55) return 'B+';
    if (hitRate >= 52 && alpha1y >= 0.3 && consistency >= 45) return 'B';
    if (hitRate >= 48 && alpha1y > 0 && consistency >= 35) return 'C';
    if (hitRate >= 40 || alpha1y > 0) return 'D';
    return 'F';
  }

  async getResults(strategyId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM strategy_backtest_results
       WHERE strategy_id = $1
       ORDER BY screening_date, forward_months`,
      [strategyId]
    );
    return res.rows;
  }

  async getSummary(strategyId: string): Promise<any | null> {
    const res = await this.pool.query(
      `SELECT * FROM strategy_backtest_summary WHERE strategy_id = $1`,
      [strategyId]
    );
    return res.rows[0] || null;
  }

  async getLeaderboard(): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT sbs.*, sd.name as strategy_name, sd.description, sd.scope, sd.type
       FROM strategy_backtest_summary sbs
       JOIN strategy_definitions sd ON sd.id = sbs.strategy_id
       ORDER BY
         CASE sbs.grade
           WHEN 'A' THEN 1
           WHEN 'B+' THEN 2
           WHEN 'B' THEN 3
           WHEN 'C' THEN 4
           WHEN 'D' THEN 5
           WHEN 'F' THEN 6
         END,
         sbs.avg_hit_rate DESC`
    );
    return res.rows;
  }

  async getAllSummaries(): Promise<Record<string, any>> {
    const res = await this.pool.query(
      `SELECT DISTINCT ON (strategy_id) *
       FROM strategy_backtest_summary
       ORDER BY strategy_id, computed_at DESC`
    );
    const map: Record<string, any> = {};
    for (const row of res.rows) {
      map[row.strategy_id] = row;
    }
    return map;
  }

  async runAllPresets(): Promise<{ strategyId: string; name: string; grade: string }[]> {
    const presets = await this.pool.query(
      `SELECT id, name FROM strategy_definitions WHERE type = 'preset' ORDER BY name`
    );

    const results: { strategyId: string; name: string; grade: string }[] = [];

    for (const preset of presets.rows) {
      try {
        logger.info(`Running backtest for preset: ${preset.name}`);
        const { summary } = await this.runBacktest(preset.id);
        results.push({
          strategyId: preset.id,
          name: preset.name,
          grade: summary.grade,
        });
      } catch (err) {
        logger.error(`Backtest failed for ${preset.name}: ${String(err)}`);
        results.push({
          strategyId: preset.id,
          name: preset.name,
          grade: 'N/A',
        });
      }
    }

    return results;
  }
}
