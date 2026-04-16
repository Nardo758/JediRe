import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface SearchGrowthResult {
  geographyId: string;
  geographyType: string;
  currentSearchIndex: number;
  historicalAvgSearchIndex: number;
  searchGrowthIndex: number;
  confidence: number;
  sources: {
    currentPeriod: string;
    historicalPeriods: number;
    searchTerms: string[];
  };
  computedAt: string;
}

export class SearchGrowthIndexService {
  constructor(private pool: Pool) {}

  async computeForGeography(
    geographyType: string,
    geographyId: string
  ): Promise<SearchGrowthResult | null> {
    const currentResult = await this.pool.query(
      `SELECT value, period_date, source
       FROM metric_time_series
       WHERE metric_id = 'D_SEARCH_VOL'
         AND geography_type = $1
         AND geography_id = $2
       ORDER BY period_date DESC
       LIMIT 1`,
      [geographyType, geographyId]
    );

    if (currentResult.rows.length === 0) return null;

    const currentVal = parseFloat(currentResult.rows[0].value);
    if (!Number.isFinite(currentVal) || currentVal <= 0) return null;

    const latestDate = currentResult.rows[0].period_date;
    const historicalResult = await this.pool.query(
      `SELECT AVG(value::numeric) as avg_val, COUNT(*) as period_count
       FROM metric_time_series
       WHERE metric_id = 'D_SEARCH_VOL'
         AND geography_type = $1
         AND geography_id = $2
         AND period_date < ($3::date - INTERVAL '30 days')
         AND period_date > ($3::date - INTERVAL '5 years')`,
      [geographyType, geographyId, latestDate]
    );

    const historicalAvg = parseFloat(historicalResult.rows[0]?.avg_val);
    const periodCount = parseInt(historicalResult.rows[0]?.period_count) || 0;

    if (!Number.isFinite(historicalAvg) || historicalAvg <= 0) return null;

    const searchGrowthIndex =
      ((currentVal - historicalAvg) / historicalAvg) * 100;

    let confidence = 0.5;
    if (periodCount >= 52) confidence += 0.2;
    else if (periodCount >= 24) confidence += 0.1;
    else if (periodCount >= 12) confidence += 0.05;
    const dataAge = currentResult.rows[0].period_date;
    const daysSinceUpdate = (Date.now() - new Date(dataAge).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate <= 7) confidence += 0.2;
    else if (daysSinceUpdate <= 30) confidence += 0.1;
    confidence = Math.min(confidence, 1.0);

    return {
      geographyId,
      geographyType,
      currentSearchIndex: Math.round(currentVal * 100) / 100,
      historicalAvgSearchIndex: Math.round(historicalAvg * 100) / 100,
      searchGrowthIndex: Math.round(searchGrowthIndex * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      sources: {
        currentPeriod: currentResult.rows[0].period_date,
        historicalPeriods: periodCount,
        searchTerms: ['real estate', 'apartments', 'homes for rent'],
      },
      computedAt: new Date().toISOString(),
    };
  }

  async computeAndStore(
    geographyType: string,
    geographyId: string
  ): Promise<SearchGrowthResult | null> {
    const result = await this.computeForGeography(geographyType, geographyId);
    if (!result) return null;

    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                      confidence = EXCLUDED.confidence, created_at = NOW()`,
      [
        'C_SEARCH_GROWTH_INDEX',
        geographyType,
        geographyId,
        geographyId,
        new Date().toISOString().split('T')[0],
        'weekly',
        result.searchGrowthIndex,
        'Google Trends vs 5yr historical avg',
        result.confidence,
      ]
    );

    logger.info(`[SearchGrowthIndex] Computed for ${geographyType}/${geographyId}: ${result.searchGrowthIndex}%`);
    return result;
  }

  async computeBatchForMsa(msaGeoId: string): Promise<{
    msaIndex: SearchGrowthResult | null;
    submarkets: SearchGrowthResult[];
  }> {
    const msaResult = await this.computeAndStore('msa', msaGeoId);

    const subs = await this.pool.query(
      `SELECT DISTINCT geography_id
       FROM metric_time_series
       WHERE metric_id = 'D_SEARCH_VOL'
         AND geography_type = 'submarket'
         AND geography_id LIKE $1`,
      [`${msaGeoId}%`]
    );

    const submarkets: SearchGrowthResult[] = [];
    for (const row of subs.rows) {
      try {
        const r = await this.computeAndStore('submarket', row.geography_id);
        if (r) submarkets.push(r);
      } catch (err: any) {
        logger.warn(`[SearchGrowthIndex] Submarket ${row.geography_id} failed: ${err.message}`);
      }
    }

    return { msaIndex: msaResult, submarkets };
  }
}
