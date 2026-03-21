/**
 * FRED (Federal Reserve Economic Data) Ingestion Service
 * Fetches macro-economic interest rate data from the St. Louis Federal Reserve
 * API: https://api.stlouisfed.org/fred/
 */

import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface FREDSeries {
  metricId: string;
  seriesId: string;
  source: string;
}

interface IngestionResult {
  seriesProcessed: number;
  rowsInserted: number;
  errors: Array<{ series: string; error: string }>;
  startTime: Date;
  endTime: Date;
}

// FRED series mappings to our metrics
const FRED_SERIES: FREDSeries[] = [
  {
    metricId: 'RATE_SOFR',
    seriesId: 'SOFR',
    source: 'fred',
  },
  {
    metricId: 'RATE_TREASURY_10Y',
    seriesId: 'DGS10',
    source: 'fred',
  },
  {
    metricId: 'RATE_MORTGAGE_30Y',
    seriesId: 'MORTGAGE30US',
    source: 'fred',
  },
];

/**
 * Ingest FRED data for macro-economic metrics
 */
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

  try {
    // Process each FRED series
    for (const series of FRED_SERIES) {
      try {
        logger.info(`Fetching FRED series ${series.seriesId} (${series.metricId})...`);

        const rowsInserted = await fetchAndInsertFREDSeries(apiKey, series);
        result.rowsInserted += rowsInserted;
        result.seriesProcessed++;

        logger.info(`Processed ${series.seriesId}: ${rowsInserted} rows inserted`);
      } catch (error) {
        result.errors.push({
          series: series.seriesId,
          error: String(error),
        });
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
  } catch (error) {
    logger.error('FRED ingestion failed:', error);
    throw error;
  }
}

/**
 * Fetch a single FRED series and insert into metric_time_series
 */
async function fetchAndInsertFREDSeries(apiKey: string, series: FREDSeries): Promise<number> {
  let rowsInserted = 0;

  try {
    // FRED API endpoint for observations
    const url = 'https://api.stlouisfed.org/fred/series/observations';

    const params = {
      series_id: series.seriesId,
      api_key: apiKey,
      file_type: 'json',
      observation_start: '2015-01-01',
      sort_order: 'asc',
    };

    logger.debug(`Fetching FRED series: ${series.seriesId}`);

    const response = await axios.get(url, { params });

    if (!response.data || !response.data.observations) {
      throw new Error(`No observations returned for series ${series.seriesId}`);
    }

    const observations = response.data.observations;
    logger.info(`Received ${observations.length} observations for ${series.seriesId}`);

    // Insert each observation
    for (const obs of observations) {
      // FRED uses '.' for missing data
      if (obs.value === '.' || obs.value === null || obs.value === undefined) {
        continue;
      }

      const value = parseFloat(obs.value);
      if (isNaN(value)) {
        continue;
      }

      // Parse date (FRED returns YYYY-MM-DD format)
      const periodDate = new Date(obs.date);
      if (isNaN(periodDate.getTime())) {
        logger.warn(`Invalid date from FRED: ${obs.date}`);
        continue;
      }

      // Determine period type based on observation frequency
      // Most FRED economic data is daily or monthly
      let periodType = 'daily';
      if (obs.date) {
        // If it's the end of month, mark as monthly
        const nextDay = new Date(periodDate);
        nextDay.setDate(nextDay.getDate() + 1);
        if (nextDay.getDate() === 1) {
          periodType = 'monthly';
        }
      }

      await query(
        `
        INSERT INTO metric_time_series
          (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value
        `,
        [
          series.metricId,
          'national', // All FRED data is national (US-level)
          'US',
          'United States',
          obs.date, // period_date
          periodType,
          value,
          series.source,
          1.0, // FRED is official government data
        ]
      );

      rowsInserted++;
    }

    logger.info(`Inserted ${rowsInserted} observations for ${series.seriesId}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`FRED API error for ${series.seriesId}:`, {
        status: error.response?.status,
        message: error.response?.data?.error_message || error.message,
      });
      throw new Error(
        `FRED API error: ${error.response?.data?.error_message || error.message}`
      );
    }
    throw error;
  }

  return rowsInserted;
}
