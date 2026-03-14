/**
 * BLS QCEW (Quarterly Census of Employment and Wages) Ingestion Service
 * Fetches employment and wage data for Florida counties
 * API: https://api.bls.gov/publicAPI/v2/timeseries/data/
 *
 * QCEW Series ID Format: ENU{FIPS}50010
 * - E = Employment data
 * - NU = Not seasonally adjusted
 * - {FIPS} = 5-digit county FIPS code
 * - 50010 = All industries, all establishment sizes, total employment
 *
 * Wage data is in the same series (avg weekly wage)
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

/**
 * Florida county FIPS codes (12001-12133, odd numbers only)
 * FL uses odd FIPS codes for counties
 */
const FLORIDA_COUNTY_FIPS: string[] = [
  '12001', '12003', '12005', '12007', '12009', '12011', '12013', '12015', '12017', '12019',
  '12021', '12023', '12025', '12027', '12029', '12031', '12033', '12035', '12037', '12039',
  '12041', '12043', '12045', '12047', '12049', '12051', '12053', '12055', '12057', '12059',
  '12061', '12063', '12065', '12067', '12069', '12071', '12073', '12075', '12077', '12079',
  '12081', '12083', '12085', '12087', '12089', '12091', '12093', '12095', '12097', '12099',
  '12101', '12103', '12105', '12107', '12109', '12111', '12113', '12115', '12117', '12119',
  '12121', '12123', '12125', '12127', '12129', '12131', '12133',
];

const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BATCH_SIZE = 50; // BLS allows 50 series per request
const REQUEST_DELAY = 100; // ms between requests to avoid rate limiting

/**
 * Ingest BLS QCEW data for all Florida counties
 */
export async function ingestBLSQCEW(apiKey: string): Promise<IngestionResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('BLS API key is required');
  }

  const result: IngestionResult = {
    countiesProcessed: 0,
    rowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  try {
    // Build series IDs for employment (ENU)
    const seriesIds = FLORIDA_COUNTY_FIPS.map(fips => `ENU${fips}50010`);

    logger.info(`Processing ${seriesIds.length} BLS series for ${FLORIDA_COUNTY_FIPS.length} Florida counties`);

    // Batch the series into groups of 50 (BLS API limit)
    for (let i = 0; i < seriesIds.length; i += BATCH_SIZE) {
      const batch = seriesIds.slice(i, Math.min(i + BATCH_SIZE, seriesIds.length));

      try {
        const batchResult = await fetchAndInsertBLSBatch(apiKey, batch, FLORIDA_COUNTY_FIPS.slice(i, Math.min(i + BATCH_SIZE, FLORIDA_COUNTY_FIPS.length)));
        result.countiesProcessed += batchResult.countiesProcessed;
        result.rowsInserted += batchResult.rowsInserted;
        result.errors.push(...batchResult.errors);

        // Add delay between requests to avoid rate limiting
        if (i + BATCH_SIZE < seriesIds.length) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }
      } catch (error) {
        logger.error(`Error processing batch at index ${i}:`, error);
        result.errors.push({
          county: `batch_${i}`,
          error: String(error),
        });
      }
    }

    result.endTime = new Date();
    const duration = result.endTime.getTime() - result.startTime.getTime();

    logger.info(`BLS QCEW ingestion complete in ${duration}ms:`, {
      countiesProcessed: result.countiesProcessed,
      rowsInserted: result.rowsInserted,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('BLS QCEW ingestion failed:', error);
    throw error;
  }
}

/**
 * Fetch a batch of BLS series and insert into metric_time_series
 */
async function fetchAndInsertBLSBatch(
  apiKey: string,
  seriesIds: string[],
  fipsCodes: string[]
): Promise<IngestionResult> {
  const result: IngestionResult = {
    countiesProcessed: 0,
    rowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  try {
    logger.debug(`Fetching ${seriesIds.length} BLS series: ${seriesIds.join(', ')}`);

    const response = await axios.post(
      BLS_BASE_URL,
      {
        seriesid: seriesIds,
        startyear: new Date().getFullYear() - 10, // Last 10 years
        endyear: new Date().getFullYear(),
        registrationkey: apiKey,
      },
      {
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.Results || !response.data.Results.series) {
      throw new Error('Invalid BLS API response format');
    }

    const series = response.data.Results.series;

    for (const s of series) {
      try {
        const seriesId = s.seriesID;
        // Extract FIPS code from series ID (ENU{FIPS}50010)
        const fipsMatch = seriesId.match(/ENU(\d{5})50010/);

        if (!fipsMatch) {
          logger.warn(`Could not extract FIPS from series ID: ${seriesId}`);
          continue;
        }

        const fipsCode = fipsMatch[1];
        let metricsInserted = 0;

        // Process data points
        if (!s.data || !Array.isArray(s.data)) {
          logger.warn(`No data in series ${seriesId}`);
          continue;
        }

        for (const dataPoint of s.data) {
          try {
            // BLS returns data in period format (YYYY-Q#)
            const [year, quarter] = parseQCEWPeriod(dataPoint.period);

            if (!year || !quarter) {
              continue;
            }

            // Convert to first day of quarter
            const monthOfQuarter = (quarter - 1) * 3; // Q1 = Jan (0), Q2 = Apr (3), etc.
            const periodDate = new Date(year, monthOfQuarter, 1);

            const value = parseFloat(dataPoint.value);
            if (isNaN(value)) {
              continue;
            }

            // Insert employment metric
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
                'E_EMPLOYMENT',
                'county',
                fipsCode,
                getCountyName(fipsCode),
                periodDate,
                'quarterly',
                value,
                'bls_qcew',
                1.0, // BLS QCEW is a census, not a survey
              ]
            );

            // Compute YoY growth if we have previous year's data
            // This would be done in a separate pass for simplicity

            metricsInserted++;
          } catch (error) {
            logger.debug(`Error processing data point for ${seriesId}:`, error);
          }
        }

        result.rowsInserted += metricsInserted;
        result.countiesProcessed++;

        logger.info(`Inserted ${metricsInserted} records for county FIPS ${fipsCode}`);
      } catch (error) {
        result.errors.push({
          county: s.seriesID,
          error: String(error),
        });
        logger.error(`Error processing series ${s.seriesID}:`, error);
      }
    }

    result.endTime = new Date();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`BLS API error:`, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
      throw new Error(
        `BLS API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }

  return result;
}

/**
 * Parse BLS period format (e.g., "2023Q1" -> [2023, 1])
 */
function parseQCEWPeriod(period: string): [number | null, number | null] {
  const match = period.match(/(\d{4})Q(\d)/);
  if (!match) {
    return [null, null];
  }
  return [parseInt(match[1]), parseInt(match[2])];
}

/**
 * Get Florida county name by FIPS code
 */
function getCountyName(fipsCode: string): string {
  const countyNames: Record<string, string> = {
    '12001': 'Alachua', '12003': 'Baker', '12005': 'Bradford', '12007': 'Brevard',
    '12009': 'Broward', '12011': 'Calhoun', '12013': 'Charlotte', '12015': 'Citrus',
    '12017': 'Clay', '12019': 'Collier', '12021': 'Columbia', '12023': 'DeSoto',
    '12025': 'Dixie', '12027': 'Duval', '12029': 'Escambia', '12031': 'Flagler',
    '12033': 'Franklin', '12035': 'Gadsden', '12037': 'Gilchrist', '12039': 'Glades',
    '12041': 'Gulf', '12043': 'Hamilton', '12045': 'Hardee', '12047': 'Hendry',
    '12049': 'Hernando', '12051': 'Highlands', '12053': 'Hillsborough', '12055': 'Holmes',
    '12057': 'Indian River', '12059': 'Jackson', '12061': 'Jefferson', '12063': 'Lafayette',
    '12065': 'Lake', '12067': 'Lee', '12069': 'Leon', '12071': 'Levy',
    '12073': 'Liberty', '12075': 'Madison', '12077': 'Manatee', '12079': 'Marion',
    '12081': 'Martin', '12083': 'Miami-Dade', '12085': 'Monroe', '12087': 'Nassau',
    '12089': 'Okaloosa', '12091': 'Okeechobee', '12093': 'Orange', '12095': 'Osceola',
    '12097': 'Palm Beach', '12099': 'Pasco', '12101': 'Pinellas', '12103': 'Polk',
    '12105': 'Putnam', '12107': 'St. Johns', '12109': 'St. Lucie', '12111': 'Santa Rosa',
    '12113': 'Sarasota', '12115': 'Seminole', '12117': 'Sumter', '12119': 'Suwannee',
    '12121': 'Taylor', '12123': 'Union', '12125': 'Volusia', '12127': 'Wakulla',
    '12129': 'Walton', '12131': 'Washington', '12133': 'Lafayette',
  };
  return countyNames[fipsCode] || `County ${fipsCode}`;
}

export default { ingestBLSQCEW };
