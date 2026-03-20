/**
 * Census ACS (American Community Survey) Ingestion Service
 * Fetches demographic and economic data from Census Bureau
 * API: https://api.census.gov/data/2022/acs/acs5
 *
 * Variables:
 * - B19013_001E: Median household income
 * - B01003_001E: Total population
 * - B25003_003E: Renter-occupied housing units
 * - B25003_001E: Total occupied housing units
 *
 * This ingests data at the county level for Florida (state FIPS 12)
 */

import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface IngestionResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: Array<{ county: string; error: string }>;
  startTime: Date;
  endTime: Date;
}

const CENSUS_BASE_URL = 'https://api.census.gov/data/2022/acs/acs5';

/**
 * ACS variables to fetch
 */
const ACS_VARIABLES = {
  medianIncome: 'B19013_001E',
  population: 'B01003_001E',
  renterOccupied: 'B25003_003E',
  totalOccupied: 'B25003_001E',
};

/**
 * Ingest Census ACS data for Florida counties
 * Uses most recent 5-year ACS (2018-2022 in this case)
 */
export async function ingestCensusACS(apiKey: string): Promise<IngestionResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Census API key is required');
  }

  const result: IngestionResult = {
    countiesProcessed: 0,
    rowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  try {
    logger.info('Starting Census ACS ingestion for Florida counties');

    // Build variable list
    const variables = [
      'NAME', // Geographic name
      ACS_VARIABLES.medianIncome,
      ACS_VARIABLES.population,
      ACS_VARIABLES.renterOccupied,
      ACS_VARIABLES.totalOccupied,
    ].join(',');

    logger.debug(`Fetching ACS variables: ${variables}`);

    // Fetch data for all Florida counties (state FIPS 12)
    // County-level geography properly supports in=state filtering
    const response = await axios.get(CENSUS_BASE_URL, {
      params: {
        get: variables,
        'for': 'county:*',
        'in': 'state:12', // Florida FIPS
        key: apiKey,
      },
      timeout: 30000,
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid Census API response format');
    }

    const data = response.data;
    // First row is header
    const header = data[0];
    const records = data.slice(1);

    logger.info(`Received ${records.length} records from Census ACS API`);

    // Find column indices
    const colIndex: Record<string, number> = {};
    header.forEach((col: string, idx: number) => {
      colIndex[col] = idx;
    });

    for (const record of records) {
      try {
        // Census county API returns state+county FIPS separately — combine them
        const stateCode = record[colIndex['state']];
        const countyCode = record[colIndex['county']];
        if (!stateCode || !countyCode) continue;

        const countyFips = `${stateCode}${countyCode}`; // e.g. "12086" for Miami-Dade
        const countyName = record[colIndex['NAME']] || `County ${countyFips}`;

        const medianIncome = parseFloat(record[colIndex[ACS_VARIABLES.medianIncome]]);
        const population = parseFloat(record[colIndex[ACS_VARIABLES.population]]);
        const renterOccupied = parseFloat(record[colIndex[ACS_VARIABLES.renterOccupied]]);
        const totalOccupied = parseFloat(record[colIndex[ACS_VARIABLES.totalOccupied]]);

        if (isNaN(population) || population <= 0) continue;

        const periodDate = new Date(2022, 0, 1); // ACS 2018-2022, use end year
        let metricsInserted = 0;

        const insertMetric = async (metricId: string, value: number) => {
          if (isNaN(value) || value <= 0) return;
          await query(
            `INSERT INTO metric_time_series
               (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (metric_id, geography_type, geography_id, period_date)
             DO UPDATE SET value = EXCLUDED.value`,
            [metricId, 'county', countyFips, countyName, periodDate, 'annual', value, 'census_acs', 0.8]
          );
          metricsInserted++;
        };

        await insertMetric('DEMO_MED_INCOME', medianIncome);
        await insertMetric('DEMO_POPULATION', population);

        if (!isNaN(renterOccupied) && !isNaN(totalOccupied) && totalOccupied > 0) {
          await insertMetric('DEMO_RENTER_PCT', (renterOccupied / totalOccupied) * 100);
        }

        result.rowsInserted += metricsInserted;
        result.countiesProcessed++;
      } catch (error) {
        result.errors.push({
          county: record[colIndex['county']] || 'unknown',
          error: String(error),
        });
        logger.debug(`Error processing county record:`, error);
      }
    }

    result.endTime = new Date();
    const duration = result.endTime.getTime() - result.startTime.getTime();

    logger.info(`Census ACS ingestion complete in ${duration}ms:`, {
      countiesProcessed: result.countiesProcessed,
      rowsInserted: result.rowsInserted,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Census API error:`, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
      throw new Error(
        `Census API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

export default { ingestCensusACS };
