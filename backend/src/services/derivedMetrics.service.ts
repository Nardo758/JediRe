import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface TSPoint {
  date: string;
  value: number;
}

interface SeriesKey {
  metricId: string;
  geoType: string;
  geoId: string;
}

export class DerivedMetricsService {
  constructor(private pool: Pool) {}

  async computeAll(): Promise<{ computed: number; errors: string[] }> {
    let totalComputed = 0;
    const errors: string[] = [];

    const tasks: Array<{ name: string; fn: () => Promise<number> }> = [
      { name: 'D_SEARCH_MOMENTUM', fn: () => this.computeSearchMomentum() },
      { name: 'D_DIGITAL_SCORE', fn: () => this.computeDigitalScore() },
      { name: 'D_DIGITAL_SHARE', fn: () => this.computeDigitalShare() },
      { name: 'T_EFFECTIVE_ADT', fn: () => this.computeEffectiveADT() },
      { name: 'T_WALKINS', fn: () => this.computePredictedWalkins() },
      { name: 'T_PHYSICAL_SCORE', fn: () => this.computePhysicalScore() },
      { name: 'C_SURGE_INDEX', fn: () => this.computeSurgeIndex() },
      { name: 'C_DIGITAL_PHYSICAL_GAP', fn: () => this.computeDigitalPhysicalGap() },
      { name: 'C_TPI', fn: () => this.computeTrafficPositionIndex() },
      { name: 'C_TVS', fn: () => this.computeTrafficVelocityScore() },
      { name: 'C_TRAFFIC_GROWTH_INDEX', fn: () => this.computeTrafficGrowthIndex() },
      { name: 'S_MONTHS_OF_SUPPLY', fn: () => this.computeMonthsOfSupply() },
      { name: 'M_SUBMARKET_RANK', fn: () => this.computeSubmarketRank() },
      { name: 'R_SUPPLY_RISK', fn: () => this.computeSupplyRisk() },
      { name: 'DEMO_NET_MIGRATION', fn: () => this.computeNetMigration() },
      { name: 'DEMO_POPULATION_DECLINE', fn: () => this.computePopulationDecline() },
      { name: 'DEMO_POPULATION_TREND_3Y', fn: () => this.computePopulationTrend3Y() },
    ];

    for (const task of tasks) {
      try {
        const count = await task.fn();
        totalComputed += count;
        logger.info(`[DerivedMetrics] ${task.name}: ${count} points stored`);
      } catch (err: any) {
        const msg = `${task.name}: ${err.message}`;
        errors.push(msg);
        logger.error(`[DerivedMetrics] Error computing ${task.name}:`, err.message);
      }
    }

    return { computed: totalComputed, errors };
  }

  private async getSeries(metricId: string, geoType?: string, geoId?: string): Promise<TSPoint[]> {
    let query = `SELECT period_date::text as date, AVG(value) as value FROM metric_time_series WHERE metric_id = $1 AND value IS NOT NULL`;
    const params: any[] = [metricId];
    if (geoType) { query += ` AND geography_type = $${params.length + 1}`; params.push(geoType); }
    if (geoId) { query += ` AND geography_id = $${params.length + 1}`; params.push(geoId); }
    query += ` GROUP BY period_date ORDER BY period_date`;
    const res = await this.pool.query(query, params);
    return res.rows.map((r: any) => ({ date: r.date.substring(0, 10), value: parseFloat(r.value) }));
  }

  private async getSeriesAllGeos(metricId: string): Promise<Map<string, TSPoint[]>> {
    const res = await this.pool.query(
      `SELECT geography_type, geography_id, period_date::text as date, AVG(value) as value
       FROM metric_time_series WHERE metric_id = $1 AND value IS NOT NULL
       GROUP BY geography_type, geography_id, period_date
       ORDER BY geography_type, geography_id, period_date`,
      [metricId]
    );
    const map = new Map<string, TSPoint[]>();
    for (const r of res.rows) {
      const key = `${r.geography_type}|${r.geography_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ date: r.date.substring(0, 10), value: parseFloat(r.value) });
    }
    return map;
  }

  private async storeSeries(
    metricId: string, geoType: string, geoId: string, source: string,
    points: TSPoint[], geoName?: string
  ): Promise<number> {
    if (points.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM metric_time_series WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3 AND source = 'derived'`,
        [metricId, geoType, geoId]
      );

      const BATCH = 200;
      for (let b = 0; b < points.length; b += BATCH) {
        const chunk = points.slice(b, b + BATCH);
        const values: string[] = [];
        const params: any[] = [];
        for (const pt of chunk) {
          const base = params.length;
          values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
          params.push(metricId, pt.date, pt.value, source, geoType, geoId, geoName || geoId);
        }
        await client.query(
          `INSERT INTO metric_time_series (metric_id, period_date, value, source, geography_type, geography_id, geography_name)
           VALUES ${values.join(', ')}`,
          params
        );
      }

      await client.query('COMMIT');
      return points.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private qoqChange(series: TSPoint[], quarterMonths: number = 3): TSPoint[] {
    const result: TSPoint[] = [];
    for (let i = quarterMonths; i < series.length; i++) {
      const prev = series[i - quarterMonths].value;
      if (prev !== 0) {
        result.push({ date: series[i].date, value: ((series[i].value - prev) / Math.abs(prev)) * 100 });
      }
    }
    return result;
  }

  private normalize0to100(series: TSPoint[]): TSPoint[] {
    if (series.length === 0) return [];
    const vals = series.map(p => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    if (range === 0) return series.map(p => ({ date: p.date, value: 50 }));
    return series.map(p => ({ date: p.date, value: ((p.value - min) / range) * 100 }));
  }

  private combineSeries(a: TSPoint[], b: TSPoint[], fn: (av: number, bv: number) => number): TSPoint[] {
    const bMap = new Map(b.map(p => [p.date, p.value]));
    const result: TSPoint[] = [];
    for (const pt of a) {
      const bv = bMap.get(pt.date);
      if (bv !== undefined) {
        const val = fn(pt.value, bv);
        if (Number.isFinite(val)) result.push({ date: pt.date, value: val });
      }
    }
    return result;
  }

  async computeSearchMomentum(): Promise<number> {
    const allGeos = await this.getSeriesAllGeos('D_SEARCH_VOL');
    let total = 0;
    for (const [key, series] of allGeos) {
      const [geoType, geoId] = key.split('|');
      const momentum = this.qoqChange(series, 3);
      if (momentum.length > 0) {
        total += await this.storeSeries('D_SEARCH_MOMENTUM', geoType, geoId, 'derived', momentum);
      }
    }
    return total;
  }

  async computeDigitalScore(): Promise<number> {
    const allGeos = await this.getSeriesAllGeos('D_SEARCH_VOL');
    let total = 0;
    for (const [key, series] of allGeos) {
      const [geoType, geoId] = key.split('|');
      const normalized = this.normalize0to100(series);
      if (normalized.length > 0) {
        total += await this.storeSeries('D_DIGITAL_SCORE', geoType, geoId, 'derived', normalized);
      }
    }
    return total;
  }

  async computeDigitalShare(): Promise<number> {
    const searchGeos = await this.getSeriesAllGeos('D_SEARCH_VOL');
    const aadtGeos = await this.getSeriesAllGeos('T_AADT');
    let total = 0;
    for (const [key, searchSeries] of searchGeos) {
      const [geoType, geoId] = key.split('|');
      const aadtKey = `msa|${geoId}`;
      const aadtSeries = aadtGeos.get(aadtKey);
      if (aadtSeries && aadtSeries.length > 0) {
        const avgAadt = aadtSeries.reduce((s, p) => s + p.value, 0) / aadtSeries.length;
        if (avgAadt > 0) {
          const share = searchSeries.map(p => ({
            date: p.date,
            value: Math.min(100, (p.value / (p.value + avgAadt * 30)) * 100)
          }));
          total += await this.storeSeries('D_DIGITAL_SHARE', geoType, geoId, 'derived', share);
        }
      } else {
        const share = searchSeries.map(p => ({ date: p.date, value: 50 }));
        total += await this.storeSeries('D_DIGITAL_SHARE', geoType, geoId, 'derived', share);
      }
    }
    return total;
  }

  async computeEffectiveADT(): Promise<number> {
    const allGeos = await this.getSeriesAllGeos('T_AADT');
    let total = 0;
    for (const [key, series] of allGeos) {
      const [geoType, geoId] = key.split('|');
      const effective = series.map(p => ({ date: p.date, value: p.value * 0.72 }));
      total += await this.storeSeries('T_EFFECTIVE_ADT', geoType, geoId, 'derived', effective);
    }
    return total;
  }

  async computePredictedWalkins(): Promise<number> {
    const allGeos = await this.getSeriesAllGeos('T_AADT');
    let total = 0;
    for (const [key, series] of allGeos) {
      const [geoType, geoId] = key.split('|');
      const walkins = series.map(p => ({ date: p.date, value: Math.round(p.value * 0.0085) }));
      total += await this.storeSeries('T_WALKINS', geoType, geoId, 'derived', walkins);
    }
    return total;
  }

  async computePhysicalScore(): Promise<number> {
    const allGeos = await this.getSeriesAllGeos('T_AADT');
    let total = 0;
    for (const [key, series] of allGeos) {
      const [geoType, geoId] = key.split('|');
      const normalized = this.normalize0to100(series);
      total += await this.storeSeries('T_PHYSICAL_SCORE', geoType, geoId, 'derived', normalized);
    }
    return total;
  }

  async computeSurgeIndex(): Promise<number> {
    const searchGeos = await this.getSeriesAllGeos('D_SEARCH_VOL');
    let total = 0;
    for (const [key, series] of searchGeos) {
      const [geoType, geoId] = key.split('|');
      const momentum = this.qoqChange(series, 3);
      const normalized = this.normalize0to100(momentum);
      if (normalized.length > 0) {
        total += await this.storeSeries('C_SURGE_INDEX', geoType, geoId, 'derived', normalized);
      }
    }

    const aadtGeos = await this.getSeriesAllGeos('T_AADT_YOY');
    for (const [key, series] of aadtGeos) {
      const [geoType, geoId] = key.split('|');
      if (!searchGeos.has(`${geoType}|${geoId}`)) {
        const normalized = this.normalize0to100(series);
        if (normalized.length > 0) {
          total += await this.storeSeries('C_SURGE_INDEX', geoType, geoId, 'derived', normalized);
        }
      }
    }
    return total;
  }

  async computeDigitalPhysicalGap(): Promise<number> {
    const digitalGeos = await this.getSeriesAllGeos('D_DIGITAL_SCORE');
    const physicalGeos = await this.getSeriesAllGeos('T_PHYSICAL_SCORE');
    let total = 0;
    for (const [key, dSeries] of digitalGeos) {
      const [geoType, geoId] = key.split('|');
      const pKey = `msa|${geoId}`;
      const pSeries = physicalGeos.get(pKey) || physicalGeos.get(key);
      if (pSeries) {
        const gap = this.combineSeries(dSeries, pSeries, (d, p) => d - p);
        if (gap.length > 0) {
          total += await this.storeSeries('C_DIGITAL_PHYSICAL_GAP', geoType, geoId, 'derived', gap);
        }
      } else {
        const gap = dSeries.map(p => ({ date: p.date, value: p.value - 50 }));
        total += await this.storeSeries('C_DIGITAL_PHYSICAL_GAP', geoType, geoId, 'derived', gap);
      }
    }
    return total;
  }

  async computeTrafficPositionIndex(): Promise<number> {
    const digitalGeos = await this.getSeriesAllGeos('D_DIGITAL_SCORE');
    const physicalGeos = await this.getSeriesAllGeos('T_PHYSICAL_SCORE');
    let total = 0;
    for (const [key, dSeries] of digitalGeos) {
      const [geoType, geoId] = key.split('|');
      const pKey = `msa|${geoId}`;
      const pSeries = physicalGeos.get(pKey) || physicalGeos.get(key);
      if (pSeries) {
        const tpi = this.combineSeries(dSeries, pSeries, (d, p) => (d * 0.6 + p * 0.4));
        if (tpi.length > 0) {
          total += await this.storeSeries('C_TPI', geoType, geoId, 'derived', tpi);
        }
      } else {
        const tpi = dSeries.map(p => ({ date: p.date, value: p.value * 0.6 + 50 * 0.4 }));
        total += await this.storeSeries('C_TPI', geoType, geoId, 'derived', tpi);
      }
    }
    return total;
  }

  async computeTrafficVelocityScore(): Promise<number> {
    const momentumGeos = await this.getSeriesAllGeos('D_SEARCH_MOMENTUM');
    let total = 0;
    for (const [key, series] of momentumGeos) {
      const [geoType, geoId] = key.split('|');
      const velocity = this.normalize0to100(series);
      if (velocity.length > 0) {
        total += await this.storeSeries('C_TVS', geoType, geoId, 'derived', velocity);
      }
    }
    return total;
  }

  async computeTrafficGrowthIndex(): Promise<number> {
    const searchYoyGeos = await this.getSeriesAllGeos('D_SEARCH_VOL_YOY');
    const aadtYoyGeos = await this.getSeriesAllGeos('T_AADT_YOY');
    let total = 0;

    for (const [key, series] of searchYoyGeos) {
      const [geoType, geoId] = key.split('|');
      const normalized = this.normalize0to100(series);
      if (normalized.length > 0) {
        total += await this.storeSeries('C_TRAFFIC_GROWTH_INDEX', geoType, geoId, 'derived', normalized);
      }
    }

    for (const [key, series] of aadtYoyGeos) {
      if (!searchYoyGeos.has(key)) {
        const [geoType, geoId] = key.split('|');
        const normalized = this.normalize0to100(series);
        if (normalized.length > 0) {
          total += await this.storeSeries('C_TRAFFIC_GROWTH_INDEX', geoType, geoId, 'derived', normalized);
        }
      }
    }
    return total;
  }

  async computeMonthsOfSupply(): Promise<number> {
    const inventoryGeos = await this.getSeriesAllGeos('CS_INVENTORY_UNITS');
    const absorptionGeos = await this.getSeriesAllGeos('CS_ABSORPTION_UNITS');
    const vacancyGeos = await this.getSeriesAllGeos('CS_VACANCY_RATE');
    let total = 0;

    for (const [key, invSeries] of inventoryGeos) {
      const [geoType, geoId] = key.split('|');
      const absSeries = absorptionGeos.get(key);
      const vacSeries = vacancyGeos.get(key);
      if (absSeries && vacSeries) {
        const absMap = new Map(absSeries.map(p => [p.date, p.value]));
        const vacMap = new Map(vacSeries.map(p => [p.date, p.value]));
        const mos: TSPoint[] = [];
        for (const pt of invSeries) {
          const absVal = absMap.get(pt.date);
          const vacPct = vacMap.get(pt.date);
          if (absVal !== undefined && vacPct !== undefined) {
            const vacantUnits = pt.value * (vacPct / 100);
            if (absVal <= 0) {
              mos.push({ date: pt.date, value: 24 });
            } else {
              mos.push({ date: pt.date, value: Math.min(36, Math.max(0, (vacantUnits / absVal) * 12)) });
            }
          }
        }
        if (mos.length > 0) {
          total += await this.storeSeries('S_MONTHS_OF_SUPPLY', geoType, geoId, 'derived', mos);
        }
      }
    }
    return total;
  }

  async computeSubmarketRank(): Promise<number> {
    const rentGrowthGeos = await this.getSeriesAllGeos('CS_EFF_RENT_GROWTH');
    const occupancyGeos = await this.getSeriesAllGeos('CS_OCCUPANCY_RATE');
    const absorptionGeos = await this.getSeriesAllGeos('CS_ABSORPTION_PCT');
    let total = 0;

    const allDates = new Set<string>();
    for (const series of rentGrowthGeos.values()) {
      for (const pt of series) allDates.add(pt.date);
    }

    const accumulated = new Map<string, TSPoint[]>();

    for (const date of allDates) {
      const scores: Array<{ key: string; score: number }> = [];
      for (const [key, rgSeries] of rentGrowthGeos) {
        const rgPt = rgSeries.find(p => p.date === date);
        const occPt = occupancyGeos.get(key)?.find((p: TSPoint) => p.date === date);
        const absPt = absorptionGeos.get(key)?.find((p: TSPoint) => p.date === date);
        if (rgPt) {
          const score = (rgPt.value || 0) * 0.4 + (occPt?.value || 90) * 0.3 + (absPt?.value || 0) * 0.3;
          scores.push({ key, score });
        }
      }
      scores.sort((a, b) => b.score - a.score);
      for (let i = 0; i < scores.length; i++) {
        const pctile = Math.round(((scores.length - i) / scores.length) * 100);
        if (!accumulated.has(scores[i].key)) accumulated.set(scores[i].key, []);
        accumulated.get(scores[i].key)!.push({ date, value: pctile });
      }
    }

    for (const [key, points] of accumulated) {
      const [geoType, geoId] = key.split('|');
      total += await this.storeSeries('M_SUBMARKET_RANK', geoType, geoId, 'derived', points);
    }
    return total;
  }

  async computeSupplyRisk(): Promise<number> {
    const pipelineGeos = await this.getSeriesAllGeos('CS_UNDER_CONSTR_PCT');
    const permitGeos = await this.getSeriesAllGeos('D_PERMIT_VELOCITY_YOY');
    let total = 0;

    for (const [key, series] of pipelineGeos) {
      const [geoType, geoId] = key.split('|');
      const risk = series.map(p => ({
        date: p.date,
        value: Math.min(100, Math.max(0, p.value * 10))
      }));
      if (risk.length > 0) {
        total += await this.storeSeries('R_SUPPLY_RISK', geoType, geoId, 'derived', risk);
      }
    }

    for (const [key, series] of permitGeos) {
      if (!pipelineGeos.has(key)) {
        const [geoType, geoId] = key.split('|');
        const risk = this.normalize0to100(series);
        if (risk.length > 0) {
          total += await this.storeSeries('R_SUPPLY_RISK', geoType, geoId, 'derived', risk);
        }
      }
    }
    return total;
  }

  async computeNetMigration(): Promise<number> {
    const popGeos = await this.getSeriesAllGeos('D_POPULATION');
    let total = 0;
    for (const [key, series] of popGeos) {
      if (series.length < 2) continue;
      const [geoType, geoId] = key.split('|');
      const migration: TSPoint[] = [];
      for (let i = 1; i < series.length; i++) {
        const change = series[i].value - series[i - 1].value;
        const naturalGrowthRate = 0.004;
        const naturalGrowth = series[i - 1].value * naturalGrowthRate;
        migration.push({ date: series[i].date, value: Math.round(change - naturalGrowth) });
      }
      if (migration.length > 0) {
        total += await this.storeSeries('DEMO_NET_MIGRATION', geoType, geoId, 'derived', migration);
      }
    }
    return total;
  }

  async computePopulationDecline(): Promise<number> {
    const popGeos = await this.getSeriesAllGeos('D_POPULATION');
    let total = 0;
    for (const [key, series] of popGeos) {
      if (series.length < 2) continue;
      const [geoType, geoId] = key.split('|');
      const decline: TSPoint[] = [];
      for (let i = 1; i < series.length; i++) {
        decline.push({
          date: series[i].date,
          value: series[i].value < series[i - 1].value ? 1 : 0
        });
      }
      if (decline.length > 0) {
        total += await this.storeSeries('DEMO_POPULATION_DECLINE', geoType, geoId, 'derived', decline);
      }
    }
    return total;
  }

  async computePopulationTrend3Y(): Promise<number> {
    const popGeos = await this.getSeriesAllGeos('D_POPULATION');
    let total = 0;
    for (const [key, series] of popGeos) {
      if (series.length < 4) continue;
      const [geoType, geoId] = key.split('|');
      const trend: TSPoint[] = [];
      for (let i = 3; i < series.length; i++) {
        const startVal = series[i - 3].value;
        if (startVal > 0) {
          const cagr = (Math.pow(series[i].value / startVal, 1 / 3) - 1) * 100;
          trend.push({ date: series[i].date, value: Math.round(cagr * 1000) / 1000 });
        }
      }
      if (trend.length > 0) {
        total += await this.storeSeries('DEMO_POPULATION_TREND_3Y', geoType, geoId, 'derived', trend);
      }
    }
    return total;
  }
}
