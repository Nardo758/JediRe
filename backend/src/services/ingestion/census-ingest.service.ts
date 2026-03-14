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
 * This ingests data at the ZIP Code Tabulation Area (ZCTA) level
 */

import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface IngestionResult {
  zipCodesProcessed: number;
  rowsInserted: number;
  errors: Array<{ zip: string; error: string }>;
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
 * Ingest Census ACS data for Florida ZIP codes
 * Uses most recent 5-year ACS (2018-2022 in this case)
 */
export async function ingestCensusACS(apiKey: string): Promise<IngestionResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Census API key is required');
  }

  const result: IngestionResult = {
    zipCodesProcessed: 0,
    rowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  try {
    logger.info('Starting Census ACS ingestion for Florida ZIP codes');

    // Build variable list
    const variables = [
      'NAME', // Geographic name
      ACS_VARIABLES.medianIncome,
      ACS_VARIABLES.population,
      ACS_VARIABLES.renterOccupied,
      ACS_VARIABLES.totalOccupied,
    ].join(',');

    logger.debug(`Fetching ACS variables: ${variables}`);

    // Fetch data for all Florida ZCTAs
    const response = await axios.get(CENSUS_BASE_URL, {
      params: {
        get: variables,
        'for': 'zip code tabulation area:*',
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
        const zipCode = record[colIndex['zip code tabulation area']];
        if (!zipCode) {
          continue;
        }

        // Extract numeric value (some values might be strings)
        const medianIncome = parseFloat(record[colIndex[ACS_VARIABLES.medianIncome]]);
        const population = parseFloat(record[colIndex[ACS_VARIABLES.population]]);
        const renterOccupied = parseFloat(record[colIndex[ACS_VARIABLES.renterOccupied]]);
        const totalOccupied = parseFloat(record[colIndex[ACS_VARIABLES.totalOccupied]]);

        // Skip if critical values are invalid
        if (isNaN(population) || population <= 0) {
          continue;
        }

        const periodDate = new Date(2022, 0, 1); // ACS 2018-2022, use end year

        let metricsInserted = 0;

        // Insert median income
        if (!isNaN(medianIncome) && medianIncome > 0) {
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
              'DEMO_MED_INCOME',
              'zip',
              zipCode,
              `ZIP ${zipCode}`,
              periodDate,
              'annual',
              medianIncome,
              'census_acs',
              0.8, // ACS is a sample survey
            ]
          );
          metricsInserted++;
        }

        // Insert population
        if (!isNaN(population) && population > 0) {
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
              'DEMO_POPULATION',
              'zip',
              zipCode,
              `ZIP ${zipCode}`,
              periodDate,
              'annual',
              population,
              'census_acs',
              0.8,
            ]
          );
          metricsInserted++;
        }

        // Insert renter percentage
        if (!isNaN(renterOccupied) && !isNaN(totalOccupied) && totalOccupied > 0) {
          const renterPct = (renterOccupied / totalOccupied) * 100;
          if (!isNaN(renterPct)) {
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
                'DEMO_RENTER_PCT',
                'zip',
                zipCode,
                `ZIP ${zipCode}`,
                periodDate,
                'annual',
                renterPct,
                'census_acs',
                0.8,
              ]
            );
            metricsInserted++;
          }
        }

        result.rowsInserted += metricsInserted;
        result.zipCodesProcessed++;

        if (result.zipCodesProcessed % 100 === 0) {
          logger.info(`Processed ${result.zipCodesProcessed} ZIP codes`);
        }
      } catch (error) {
        result.errors.push({
          zip: record[colIndex['zip code tabulation area']] || 'unknown',
          error: String(error),
        });
        logger.debug(`Error processing ZIP code record:`, error);
      }
    }

    result.endTime = new Date();
    const duration = result.endTime.getTime() - result.startTime.getTime();

    logger.info(`Census ACS ingestion complete in ${duration}ms:`, {
      zipCodesProcessed: result.zipCodesProcessed,
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
