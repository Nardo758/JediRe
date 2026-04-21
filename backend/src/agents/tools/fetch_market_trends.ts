/**
 * Tool: fetch_market_trends
 *
 * Returns location-specific market trends for rent growth, vacancy rates,
 * cap rates, and expense growth. Used by CashFlow Agent to calibrate
 * forward projections against actual market momentum.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  state: z.string().describe('State code (required)'),
  msa: z.string().optional().describe('MSA name'),
  submarket: z.string().optional().describe('Submarket name'),
  metrics: z.array(z.string()).optional().default(['rent_growth', 'vacancy_rate', 'cap_rate', 'opex_growth']).describe(
    'Metrics to retrieve: rent_growth | vacancy_rate | cap_rate | opex_growth | noi_growth'
  ),
  asset_class: z.string().optional().describe('Filter by asset class (A, B, C)'),
  periods: z.number().optional().default(8).describe('Number of periods to retrieve (default 8)'),
});

const TrendPointSchema = z.object({
  period: z.string(),
  value: z.number(),
  yoy_change: z.number().nullable(),
});

const MetricTrendSchema = z.object({
  metric_name: z.string(),
  current_value: z.number().nullable(),
  current_yoy: z.number().nullable(),
  trend_direction: z.string(),  // improving | stable | declining
  volatility: z.string(),       // low | moderate | high
  history: z.array(TrendPointSchema),
  forecast_note: z.string().optional(),
});

const OutputSchema = z.object({
  found: z.boolean(),
  location: z.object({
    state: z.string(),
    msa: z.string().nullable(),
    submarket: z.string().nullable(),
  }),
  asset_class: z.string().nullable(),
  trends: z.array(MetricTrendSchema),
  market_outlook: z.string().optional(),
  note: z.string().optional(),
});

export const fetchMarketTrendsTool = {
  name: 'fetch_market_trends',
  description:
    'Returns historical and recent trends for rent growth, vacancy rates, cap rates, and OpEx growth ' +
    'for a specific market. Use to calibrate forward projections — if market rent growth is trending ' +
    'down, apply a conservative adjustment; if vacancy is declining, underwriting can be less aggressive.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  async execute(input: z.infer<typeof InputSchema>) {
    try {
      const { state, msa, submarket, metrics, asset_class, periods } = input;

      const trends: z.infer<typeof MetricTrendSchema>[] = [];

      for (const metricName of metrics ?? ['rent_growth', 'vacancy_rate']) {
        // Build query with location fallback
        const params: unknown[] = [state, metricName, periods];
        let locationFilter: string;
        
        if (submarket) {
          params.push(submarket);
          locationFilter = `AND submarket = $${params.length}`;
        } else if (msa) {
          params.push(msa);
          locationFilter = `AND msa = $${params.length} AND submarket IS NULL`;
        } else {
          locationFilter = 'AND msa IS NULL AND submarket IS NULL';
        }

        let classFilter = '';
        if (asset_class) {
          params.push(asset_class);
          classFilter = `AND (asset_class = $${params.length} OR asset_class IS NULL)`;
        }

        const result = await query(
          `SELECT period, value, yoy_change, mom_change
           FROM market_trends
           WHERE state = $1
             AND metric_name = $2
             ${locationFilter}
             ${classFilter}
           ORDER BY period DESC
           LIMIT $3`,
          params
        );

        if (result.rows.length === 0) {
          // Try broader geography
          const fallbackResult = await query(
            `SELECT period, value, yoy_change
             FROM market_trends
             WHERE state = $1
               AND metric_name = $2
               AND msa IS NULL
               AND submarket IS NULL
             ORDER BY period DESC
             LIMIT $3`,
            [state, metricName, periods]
          );

          if (fallbackResult.rows.length === 0) continue;
          
          const rows = fallbackResult.rows as { period: string; value: number; yoy_change: number | null }[];
          const trend = analyzeTrend(metricName, rows);
          trends.push(trend);
        } else {
          const rows = result.rows as { period: string; value: number; yoy_change: number | null }[];
          const trend = analyzeTrend(metricName, rows);
          trends.push(trend);
        }
      }

      // Generate market outlook
      const marketOutlook = generateMarketOutlook(trends);

      return {
        found: trends.length > 0,
        location: {
          state,
          msa: msa ?? null,
          submarket: submarket ?? null,
        },
        asset_class: asset_class ?? null,
        trends,
        market_outlook: marketOutlook,
        note: trends.length < (metrics?.length ?? 4) 
          ? 'Some metrics unavailable for this market — use regional defaults'
          : undefined,
      };

    } catch (err) {
      logger.error('fetch_market_trends: query error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        location: {
          state: input.state,
          msa: input.msa ?? null,
          submarket: input.submarket ?? null,
        },
        asset_class: input.asset_class ?? null,
        trends: [],
        note: 'Market trends query failed — use conservative national assumptions',
      };
    }
  },
};

function analyzeTrend(
  metricName: string, 
  rows: { period: string; value: number; yoy_change: number | null }[]
): z.infer<typeof MetricTrendSchema> {
  if (rows.length === 0) {
    return {
      metric_name: metricName,
      current_value: null,
      current_yoy: null,
      trend_direction: 'unknown',
      volatility: 'unknown',
      history: [],
    };
  }

  const current = rows[0];
  const history = rows.map(r => ({
    period: r.period,
    value: r.value,
    yoy_change: r.yoy_change,
  })).reverse(); // Chronological order

  // Determine trend direction
  let trendDirection = 'stable';
  if (rows.length >= 3) {
    const recent = rows.slice(0, 3).map(r => r.value);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = rows.slice(3, 6).map(r => r.value);
    if (older.length > 0) {
      const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
      const change = (avgRecent - avgOlder) / Math.abs(avgOlder || 1);
      if (change > 0.05) trendDirection = 'improving';
      else if (change < -0.05) trendDirection = 'declining';
    }
  }

  // Determine volatility
  let volatility = 'low';
  if (rows.length >= 4) {
    const values = rows.map(r => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / Math.abs(mean || 1);
    if (cv > 0.3) volatility = 'high';
    else if (cv > 0.15) volatility = 'moderate';
  }

  // Generate forecast note
  let forecastNote: string | undefined;
  if (metricName === 'rent_growth') {
    if (trendDirection === 'declining') {
      forecastNote = 'Rent growth decelerating — consider conservative forward assumptions';
    } else if (current.value > 5) {
      forecastNote = 'Above-average rent growth — verify sustainability before projecting forward';
    }
  } else if (metricName === 'vacancy_rate') {
    if (trendDirection === 'improving' && current.value < 5) {
      forecastNote = 'Tight market conditions — limited downside vacancy risk';
    } else if (current.value > 8) {
      forecastNote = 'Elevated vacancy — build absorption buffer into projections';
    }
  }

  return {
    metric_name: metricName,
    current_value: current.value,
    current_yoy: current.yoy_change,
    trend_direction: trendDirection,
    volatility,
    history,
    forecast_note: forecastNote,
  };
}

function generateMarketOutlook(trends: z.infer<typeof MetricTrendSchema>[]): string {
  const parts: string[] = [];
  
  const rentTrend = trends.find(t => t.metric_name === 'rent_growth');
  const vacancyTrend = trends.find(t => t.metric_name === 'vacancy_rate');
  const capTrend = trends.find(t => t.metric_name === 'cap_rate');

  if (rentTrend?.current_yoy != null) {
    if (rentTrend.current_yoy > 3) {
      parts.push(`Strong rent growth (${rentTrend.current_yoy.toFixed(1)}% YoY)`);
    } else if (rentTrend.current_yoy < 1) {
      parts.push(`Muted rent growth (${rentTrend.current_yoy.toFixed(1)}% YoY)`);
    }
  }

  if (vacancyTrend?.current_value != null) {
    if (vacancyTrend.current_value < 5) {
      parts.push('tight occupancy');
    } else if (vacancyTrend.current_value > 8) {
      parts.push('elevated vacancy');
    }
  }

  if (capTrend?.trend_direction === 'improving') {
    parts.push('compressing cap rates');
  } else if (capTrend?.trend_direction === 'declining') {
    parts.push('expanding cap rates');
  }

  if (parts.length === 0) return 'Market conditions within normal range.';
  return parts.join(', ') + '.';
}
