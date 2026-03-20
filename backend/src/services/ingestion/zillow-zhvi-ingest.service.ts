/**
 * Zillow ZHVI (Zillow Home Value Index) Ingestion Service
 * Processes monthly home value data for ZIP codes in Florida
 * CSV format: RegionID, SizeRank, RegionName, RegionType, StateName, then monthly date columns
 */

import * as fs from 'fs';
import * as csv from 'csv-parse';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface ZHVIRow {
  RegionID: string;
  SizeRank: string;
  RegionName: string;
  RegionType: string;
  StateName: string;
  [key: string]: string; // Monthly date columns
}

interface IngestionResult {
  zipsProcessed: number;
  rowsInserted: number;
  yoyRowsInserted: number;
  errors: Array<{ zip: string; error: string }>;
  startTime: Date;
  endTime: Date;
}

/**
 * Ingest Zillow ZHVI CSV file into metric_time_series
 */
export async function ingestZillowZHVI(filePath: string): Promise<IngestionResult> {
  const result: IngestionResult = {
    zipsProcessed: 0,
    rowsInserted: 0,
    yoyRowsInserted: 0,
    errors: [],
    startTime: new Date(),
    endTime: new Date(),
  };

  try {
    const rows: ZHVIRow[] = [];

    // Parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv.parse({ columns: true, skip_empty_lines: true }))
        .on('data', (row: ZHVIRow) => {
          rows.push(row);
        })
        .on('error', reject)
        .on('end', resolve);
    });

    logger.info(`Parsed ${rows.length} rows from ZHVI CSV`);

    // Filter to Florida ZIP codes
    const floridaZips = rows.filter(
      (row) =>
        row.StateName === 'FL' &&
        row.RegionType &&
        (row.RegionType.includes('Zip') || row.RegionType.includes('zip'))
    );

    logger.info(`Found ${floridaZips.length} Florida ZIP codes`);

    // Extract date columns (all columns except the metadata ones)
    const metadataColumns = ['RegionID', 'SizeRank', 'RegionName', 'RegionType', 'StateName'];
    const dateColumns = Object.keys(floridaZips[0]).filter(
      (col) => !metadataColumns.includes(col)
    );

    logger.info(`Found ${dateColumns.length} date columns (months of data)`);

    // Process each ZIP code
    for (const row of floridaZips) {
      try {
        const zipCode = row.RegionName;

        // Insert values for each date
        for (const dateStr of dateColumns) {
          const value = parseFloat(row[dateStr]);

          // Skip missing data
          if (isNaN(value)) {
            continue;
          }

          // Parse date from column header (e.g., "2015-01-31")
          const periodDate = new Date(dateStr);
          if (isNaN(periodDate.getTime())) {
            logger.warn(`Invalid date format: ${dateStr}`);
            continue;
          }

          // Insert into metric_time_series
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
              'SFR_HOME_VALUE', // metric_id
              'zip', // geography_type
              zipCode, // geography_id
              zipCode, // geography_name
              periodDate.toISOString().split('T')[0], // period_date (YYYY-MM-DD)
              'monthly', // period_type
              value, // value
              'zillow_zhvi', // source
              1.0, // confidence (official data source)
            ]
          );

          result.rowsInserted++;
        }

        result.zipsProcessed++;

        // Log progress every 100 zips
        if (result.zipsProcessed % 100 === 0) {
          logger.info(`Processed ${result.zipsProcessed} ZIP codes, ${result.rowsInserted} rows inserted`);
        }
      } catch (error) {
        result.errors.push({
          zip: row.RegionName,
          error: String(error),
        });
        logger.error(`Error processing ZIP ${row.RegionName}:`, error);
      }
    }

    // Compute YoY growth for each zip with 12+ months of data
    logger.info('Computing Year-over-Year growth rates...');
    const yoyResult = await computeZHVIYoYGrowth();
    result.yoyRowsInserted = yoyResult;

    result.endTime = new Date();
    const duration = result.endTime.getTime() - result.startTime.getTime();

    logger.info(`ZHVI ingestion complete in ${duration}ms:`, {
      zipsProcessed: result.zipsProcessed,
      rowsInserted: result.rowsInserted,
      yoyRowsInserted: result.yoyRowsInserted,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('ZHVI ingestion failed:', error);
    throw error;
  }
}

/**
 * Compute Year-over-Year growth rates from ZHVI base values
 */
async function computeZHVIYoYGrowth(): Promise<number> {
  let rowsInserted = 0;

  try {
    // Get all distinct ZIP codes with ZHVI data
    const zipsResult = await query(
      `
      SELECT DISTINCT geography_id FROM metric_time_series
      WHERE metric_id = 'SFR_HOME_VALUE' AND geography_type = 'zip'
      `
    );

    const zips = zipsResult.rows.map((r) => r.geography_id);

    for (const zip of zips) {
      // Get all monthly values sorted by date
      const valuesResult = await query(
        `
        SELECT period_date, value
        FROM metric_time_series
        WHERE metric_id = 'SFR_HOME_VALUE' AND geography_id = $1 AND geography_type = 'zip'
        ORDER BY period_date ASC
        `,
        [zip]
      );

      const values = valuesResult.rows;

      // Only compute if we have 13+ months (12 months back + current)
      if (values.length < 13) {
        continue;
      }

      // For each month from month 12 onwards, compute YoY
      for (let i = 12; i < values.length; i++) {
        const currentDate = values[i].period_date;
        const currentValue = values[i].value;
        const priorYearValue = values[i - 12].value;

        if (currentValue && priorYearValue) {
          const yoyGrowth = ((currentValue - priorYearValue) / priorYearValue) * 100;

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
              'SFR_HOME_VALUE_GROWTH', // metric_id
              'zip', // geography_type
              zip, // geography_id
              zip, // geography_name
              currentDate, // period_date
              'monthly', // period_type
              yoyGrowth, // value (%)
              'zillow_zhvi', // source
              1.0, // confidence
            ]
          );

          rowsInserted++;
        }
      }
    }

    logger.info(`Computed YoY growth for ${zips.length} ZIPs, inserted ${rowsInserted} rows`);
  } catch (error) {
    logger.error('Error computing YoY growth:', error);
    throw error;
  }

  return rowsInserted;
}
