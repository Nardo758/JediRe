import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface FREDSeries {
  metricId: string;
  seriesId: string;
  source: string;
  geographyType: string;
  geographyId: string;
  geographyName: string;
  periodType: string;
  observationStart?: string;
}

interface IngestionResult {
  seriesProcessed: number;
  rowsInserted: number;
  errors: Array<{ series: string; error: string }>;
  startTime: Date;
  endTime: Date;
}

const FRED_SERIES: FREDSeries[] = [
  { metricId: 'RATE_SOFR', seriesId: 'SOFR', source: 'fred', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'daily' },
  { metricId: 'RATE_TREASURY_10Y', seriesId: 'DGS10', source: 'fred', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'daily' },
  { metricId: 'RATE_MORTGAGE_30Y', seriesId: 'MORTGAGE30US', source: 'fred', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'weekly' },
  { metricId: 'RATE_FED_FUNDS', seriesId: 'FEDFUNDS', source: 'fred', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_CPI_OFFICIAL', seriesId: 'CPIAUCSL', source: 'fred_bls', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_CPI_STICKY', seriesId: 'CORESTICKM159SFRBATL', source: 'fred_atlfed', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_OIL_PRICE', seriesId: 'DCOILWTICO', source: 'fred_eia', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'daily', observationStart: '2000-01-01' },
  { metricId: 'M_UNEMPLOYMENT_RATE', seriesId: 'ATLA013URN', source: 'fred_bls', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_UNEMPLOYMENT_RATE', seriesId: 'UNRATE', source: 'fred_bls', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_BUILDING_PERMITS', seriesId: 'ATLA013BPPRIVSA', source: 'fred_census', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_BUILDING_PERMITS', seriesId: 'PERMIT', source: 'fred_census', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_POPULATION', seriesId: 'ATLPOP', source: 'fred_census', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'annual', observationStart: '2000-01-01' },
  { metricId: 'M_EMPLOYED', seriesId: 'LAUMT131206000000005', source: 'fred_bls', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_PERSONAL_INCOME', seriesId: 'ATLA013PCPI', source: 'fred_bea', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'annual', observationStart: '2000-01-01' },
  { metricId: 'M_LABOR_FORCE', seriesId: 'ATLA013LFN', source: 'fred_bls', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_GDP', seriesId: 'NGMP12060', source: 'fred_bea', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'annual', observationStart: '2000-01-01' },
  { metricId: 'M_HOME_PRICE_INDEX', seriesId: 'ATNHPIUS12060Q', source: 'fred_fhfa', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'quarterly', observationStart: '2000-01-01' },
  { metricId: 'M_CASE_SHILLER_HPI', seriesId: 'ATXRNSA', source: 'fred_sp', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_HOUSING_STARTS', seriesId: 'HOUST', source: 'fred_census', geographyType: 'national', geographyId: 'US', geographyName: 'United States', periodType: 'monthly', observationStart: '2000-01-01' },
  { metricId: 'M_LEISURE_HOSPITALITY_EMP', seriesId: 'ATLA013LEIHN', source: 'fred_bls', geographyType: 'metro', geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', periodType: 'monthly', observationStart: '2000-01-01' },
];

export async function ingestFRED(apiKey: string): Promise<IngestionResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('FRED API key is required');
  }

  const result: IngestionResult = {
    seriesProcessed: 0,
    rowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  for (const series of FRED_SERIES) {
    try {
      logger.info(`Fetching FRED series ${series.seriesId} → ${series.metricId} (${series.geographyId})...`);
      const rowsInserted = await fetchAndInsertFREDSeries(apiKey, series);
      result.rowsInserted += rowsInserted;
      result.seriesProcessed++;
      logger.info(`Processed ${series.seriesId}: ${rowsInserted} rows inserted`);
    } catch (error) {
      result.errors.push({ series: series.seriesId, error: String(error) });
      logger.error(`Error processing FRED series ${series.seriesId}:`, error);
    }
  }

  result.endTime = new Date();
  const duration = result.endTime.getTime() - result.startTime.getTime();
  logger.info(`FRED ingestion complete in ${duration}ms:`, {
    seriesProcessed: result.seriesProcessed,
    rowsInserted: result.rowsInserted,
    errors: result.errors.length,
  });

  return result;
}

async function fetchAndInsertFREDSeries(apiKey: string, series: FREDSeries): Promise<number> {
  let rowsInserted = 0;

  const url = 'https://api.stlouisfed.org/fred/series/observations';
  const params: Record<string, string> = {
    series_id: series.seriesId,
    api_key: apiKey,
    file_type: 'json',
    observation_start: series.observationStart || '2015-01-01',
    sort_order: 'asc',
  };

  let response;
  try {
    response = await axios.get(url, { params, timeout: 30000 });
  } catch (axErr: any) {
    const msg = axErr.response?.data?.error_message || axErr.message || 'Unknown FRED API error';
    throw new Error(`FRED API error for ${series.seriesId}: ${msg}`);
  }

  if (!response.data || !response.data.observations) {
    throw new Error(`No observations returned for series ${series.seriesId}`);
  }

  const observations = response.data.observations;
  logger.info(`Received ${observations.length} observations for ${series.seriesId}`);

  const batchValues: any[][] = [];

  for (const obs of observations) {
    if (obs.value === '.' || obs.value === null || obs.value === undefined) continue;
    const value = parseFloat(obs.value);
    if (isNaN(value)) continue;

    const periodDate = new Date(obs.date);
    if (isNaN(periodDate.getTime())) continue;

    batchValues.push([
      series.metricId,
      series.geographyType,
      series.geographyId,
      series.geographyName,
      obs.date,
      series.periodType,
      value,
      series.source,
      1.0,
    ]);
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < batchValues.length; i += BATCH_SIZE) {
    const batch = batchValues.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const flatValues: any[] = [];

    batch.forEach((row, idx) => {
      const offset = idx * 9;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
      flatValues.push(...row);
    });

    await query(
      `INSERT INTO metric_time_series
        (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (metric_id, geography_type, geography_id, period_date)
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source`,
      flatValues
    );

    rowsInserted += batch.length;
  }

  logger.info(`Inserted ${rowsInserted} observations for ${series.seriesId}`);
  return rowsInserted;
}
