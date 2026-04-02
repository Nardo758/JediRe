import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { METRICS_CATALOG, MetricDefinition } from '../../services/metricsCatalog.service';

const CATALOG_TO_DB: Record<string, string> = {
  SFR_HOME_VALUE: 'home_value_index',
  SFR_HOME_VALUE_GROWTH: 'home_value_index_yoy',
  SFR_PRICE_TO_RENT: 'D_PRICE_TO_RENT',
  MACRO_OIL_PRICE: 'M_OIL_PRICE',
  MACRO_CPI_OFFICIAL: 'M_CPI_OFFICIAL',
  MACRO_CPI_SHADOW: 'M_CPI_SHADOWSTATS',
  F_CAP_RATE: 'CS_CAP_RATE',
  F_RENT_TO_INCOME: 'D_RENT_TO_INCOME',
  F_RENT_GROWTH: 'rent_index_yoy',
  F_RENT_INDEX: 'rent_index',
  F_PRICE_PER_UNIT: 'CS_MEDIAN_PRICE_UNIT',
  E_EMPLOYMENT_GROWTH: 'D_EMP_GROWTH_YOY',
  E_WAGE_GROWTH: 'D_WAGE_GROWTH_YOY',
  E_POPULATION_GROWTH: 'D_POP_GROWTH_YOY',
  E_BIZ_FORMATIONS: 'D_BIZ_FORMATIONS',
  M_VACANCY: 'CS_VACANCY_RATE',
  M_ABSORPTION: 'CS_NET_ABSORPTION',
  S_PIPELINE_UNITS: 'CS_UNDER_CONSTRUCTION',
  S_PIPELINE_TO_STOCK: 'CS_UNDER_CONSTR_PCT',
  S_PERMIT_VELOCITY: 'D_PERMIT_VELOCITY_YOY',
  DEMO_MED_AGE: 'D_MEDIAN_AGE',
  DEMO_HH_GROWTH: 'D_HOUSEHOLD_GROWTH_YOY',
  L_JOBS_PER_UNIT: 'D_JOBS_TO_HOUSING',
  DEMO_POPULATION: 'D_POPULATION',
  DEMO_MED_INCOME: 'D_MEDIAN_INCOME',
  DEMO_RENTER_PCT: 'D_RENTER_PCT',
};

function resolveDbId(catalogId: string): string {
  return CATALOG_TO_DB[catalogId] || catalogId;
}

const router = Router();

router.get('/catalog', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const statsRes = await pool.query(
      `SELECT metric_id,
              COUNT(*) as point_count,
              COUNT(DISTINCT geography_id) as geo_count,
              MIN(period_date)::text as earliest,
              MAX(period_date)::text as latest
       FROM metric_time_series
       WHERE value IS NOT NULL
       GROUP BY metric_id`
    );

    interface MetricStats { pointCount: number; geoCount: number; earliest: string; latest: string; }
    const statsMap = new Map<string, MetricStats>();
    for (const r of statsRes.rows) {
      statsMap.set(r.metric_id, {
        pointCount: parseInt(r.point_count),
        geoCount: parseInt(r.geo_count),
        earliest: r.earliest?.substring(0, 10),
        latest: r.latest?.substring(0, 10),
      });
    }

    interface CatalogEntry {
      id: string; dbMetricId: string; name: string; category: string;
      unit: string; description: string; investmentSignal?: string;
      higherIsBetter?: boolean; source?: string; updateFrequency?: string;
      pointCount: number; geoCount: number; earliest: string; latest: string;
    }
    const metrics: CatalogEntry[] = [];
    for (const m of METRICS_CATALOG) {
      if (m.id.startsWith('OP_')) continue;
      const dbId = resolveDbId(m.id);
      const stats = statsMap.get(dbId) || statsMap.get(m.id);
      if (!stats) continue;

      metrics.push({
        id: m.id,
        dbMetricId: dbId,
        name: m.name,
        category: m.category,
        unit: m.unit,
        description: m.description,
        investmentSignal: m.investmentSignal,
        higherIsBetter: m.higherIsBetter,
        source: m.source,
        updateFrequency: m.updateFrequency,
        pointCount: stats.pointCount,
        geoCount: stats.geoCount,
        earliest: stats.earliest,
        latest: stats.latest,
      });
    }

    const categories = [...new Set(metrics.map(m => m.category))];
    const grouped: Record<string, CatalogEntry[]> = {};
    for (const cat of categories) {
      grouped[cat] = metrics.filter(m => m.category === cat);
    }

    res.json({ success: true, totalMetrics: metrics.length, categories, grouped, metrics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/grid-data', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const metricIds = (req.query.metricIds as string || '').split(',').filter(Boolean).slice(0, 30);
    const geoIds = (req.query.geoIds as string || '').split(',').filter(Boolean).slice(0, 200);

    if (metricIds.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const dbIds = metricIds.map(id => resolveDbId(id));
    const dbToCatalog = new Map<string, string>();
    for (let i = 0; i < metricIds.length; i++) {
      dbToCatalog.set(dbIds[i], metricIds[i]);
    }

    let query = `
      WITH ranked AS (
        SELECT metric_id, geography_type, geography_id, geography_name,
               period_date::text as date, value,
               ROW_NUMBER() OVER (PARTITION BY metric_id, geography_type, geography_id ORDER BY period_date DESC) as rn
        FROM metric_time_series
        WHERE metric_id = ANY($1) AND value IS NOT NULL
    `;
    const params: (string[] | string)[] = [dbIds];

    if (geoIds.length > 0) {
      query += ` AND geography_id = ANY($2)`;
      params.push(geoIds);
    }

    query += `
      )
      SELECT metric_id, geography_type, geography_id, geography_name, date, value, rn
      FROM ranked WHERE rn <= 60
      ORDER BY metric_id, geography_type, geography_id, rn
    `;

    const result = await pool.query(query, params);

    interface TimeSeriesRow {
      metric_id: string;
      geography_type: string;
      geography_id: string;
      geography_name: string;
      date: string;
      value: string;
      rn: string;
    }
    interface GridCell {
      value: number | null;
      previousValue: number | null;
      trailing3Avg: number | null;
      date: string;
      geoName: string;
      geoType: string;
      geoId: string;
      trend: 'up' | 'down' | 'flat' | null;
      yoyChange: number | null;
    }
    const data: Record<string, Record<string, GridCell>> = {};
    const grouped = new Map<string, TimeSeriesRow[]>();

    for (const r of result.rows as TimeSeriesRow[]) {
      const key = `${r.metric_id}|${r.geography_type}|${r.geography_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    for (const [, rows] of grouped) {
      const catalogId = dbToCatalog.get(rows[0].metric_id) || rows[0].metric_id;
      const geoKey = `${rows[0].geography_type}:${rows[0].geography_id}`;

      if (!data[catalogId]) data[catalogId] = {};

      const latest = rows.find(r => +r.rn === 1);
      const previous = rows.find(r => +r.rn === 2);

      const latestVal = latest ? parseFloat(latest.value) : null;
      const prevVal = previous ? parseFloat(previous.value) : null;

      const thirdPoint = rows.find(r => +r.rn === 3);
      const trailing3Vals = [latestVal, prevVal, thirdPoint ? parseFloat(thirdPoint.value) : null].filter((v): v is number => v != null);
      const trailing3Avg = trailing3Vals.length >= 2 ? trailing3Vals.reduce((a, b) => a + b, 0) / trailing3Vals.length : null;

      let yoyChange: number | null = null;
      if (latest) {
        const latestDate = new Date(latest.date);
        const oneYearAgo = new Date(latestDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const targetMs = oneYearAgo.getTime();

        let closestYoy: TimeSeriesRow | null = null;
        let closestDiff = Infinity;
        for (const r of rows) {
          if (+r.rn <= 1) continue;
          const diff = Math.abs(new Date(r.date).getTime() - targetMs);
          if (diff < closestDiff && diff < 45 * 24 * 3600 * 1000) {
            closestDiff = diff;
            closestYoy = r;
          }
        }
        if (closestYoy && parseFloat(closestYoy.value) !== 0) {
          yoyChange = ((parseFloat(latest.value) - parseFloat(closestYoy.value)) / Math.abs(parseFloat(closestYoy.value))) * 100;
        }
      }

      data[catalogId][geoKey] = {
        value: latestVal,
        previousValue: prevVal,
        trailing3Avg,
        date: latest?.date?.substring(0, 10) || '',
        geoName: latest?.geography_name || '',
        geoType: latest?.geography_type || '',
        geoId: latest?.geography_id || '',
        trend: prevVal != null && latestVal != null ? (latestVal > prevVal ? 'up' : latestVal < prevVal ? 'down' : 'flat') : null,
        yoyChange,
      };
    }

    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/insights', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const propertyId = req.query.propertyId as string;

    let runFilter = '';
    const params: string[] = [];
    if (propertyId) {
      runFilter = `AND run_id = (SELECT id FROM driver_analysis_runs WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1)`;
      params.push(propertyId);
    } else {
      runFilter = `AND run_id = (SELECT id FROM driver_analysis_runs ORDER BY created_at DESC LIMIT 1)`;
    }

    const result = await pool.query(`
      SELECT DISTINCT ON (driver_metric_id)
        driver_metric_id, driver_metric_name,
        outcome_metric_id, pearson_r, r_squared, optimal_lag_weeks, direction
      FROM driver_analysis_results
      WHERE ABS(pearson_r) >= 0.4 ${runFilter}
      ORDER BY driver_metric_id, ABS(pearson_r) DESC
    `, params);

    interface InsightEntry {
      outcomeMetricId: string; pearsonR: number; rSquared: number;
      lagWeeks: number; direction: string; driverName: string;
    }
    const insights: Record<string, InsightEntry> = {};
    for (const r of result.rows) {
      insights[r.driver_metric_id] = {
        outcomeMetricId: r.outcome_metric_id,
        pearsonR: parseFloat(r.pearson_r),
        rSquared: parseFloat(r.r_squared),
        lagWeeks: parseInt(r.optimal_lag_weeks),
        direction: r.direction,
        driverName: r.driver_metric_name,
      };
    }

    res.json({ success: true, insights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
