/**
 * M28 Rate Data Ingestion Script
 * Fetches daily rate data from FRED and stores in m28_rate_environment
 * Run daily via cron: 0 8 * * * (8am daily)
 */

import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import {
  fredApiClient,
  FRED_SERIES,
  calculateM2YoY,
  determinePolicyStance,
  determineForwardDirection,
} from '../utils/fred-api.client';

const pool = getPool();

interface RateDataPoint {
  snapshot_date: string;
  ffr: number | null;
  sofr: number | null;
  t10y: number | null;
  t30y_mtg: number | null;
  m2_yoy: number | null;
  m2_level: number | null;
  fed_balance_sheet: number | null;
  dxy: number | null;
  policy_stance: string;
  forward_direction: string;
}

async function ingestRateData(dateOverride?: string) {
  const targetDate = dateOverride || new Date().toISOString().split('T')[0];
  
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`M28 Rate Data Ingestion - ${targetDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  try {
    // Check if data already exists for this date
    const existing = await pool.query(
      'SELECT 1 FROM m28_rate_environment WHERE snapshot_date = $1',
      [targetDate]
    );

    if (existing.rows.length > 0) {
      console.log(`⏭️  Data already exists for ${targetDate}. Skipping.`);
      return;
    }

    // Fetch all series
    console.log('📊 Fetching rate data from FRED...');
    
    const latestValues = await fredApiClient.getMultipleLatest([
      FRED_SERIES.FFR,
      FRED_SERIES.SOFR,
      FRED_SERIES.T10Y,
      FRED_SERIES.MTG30Y,
      FRED_SERIES.M2,
      FRED_SERIES.FED_ASSETS,
      FRED_SERIES.DXY,
    ]);

    // Calculate M2 YoY (need historical data)
    console.log('📈 Calculating M2 year-over-year growth...');
    const m2Historical = await fredApiClient.getSeries(
      FRED_SERIES.M2,
      undefined,
      undefined,
      13 // Last 13 months
    );
    
    const m2YoyData = calculateM2YoY(m2Historical);
    const m2Yoy = m2YoyData.length > 0 
      ? parseFloat(m2YoyData[m2YoyData.length - 1].value)
      : null;

    // Determine policy stance
    const ffrHistorical = await fredApiClient.getSeries(
      FRED_SERIES.FFR,
      undefined,
      undefined,
      90 // Last 90 days
    );
    const policyStance = determinePolicyStance(ffrHistorical);

    // Determine forward direction
    const ffr = latestValues[FRED_SERIES.FFR] || 0;
    const t10y = latestValues[FRED_SERIES.T10Y] || 0;
    const forwardDirection = determineForwardDirection(ffr, t10y);

    // Build data object
    const rateData: RateDataPoint = {
      snapshot_date: targetDate,
      ffr: latestValues[FRED_SERIES.FFR],
      sofr: latestValues[FRED_SERIES.SOFR],
      t10y: latestValues[FRED_SERIES.T10Y],
      t30y_mtg: latestValues[FRED_SERIES.MTG30Y],
      m2_yoy: m2Yoy,
      m2_level: latestValues[FRED_SERIES.M2],
      fed_balance_sheet: latestValues[FRED_SERIES.FED_ASSETS],
      dxy: latestValues[FRED_SERIES.DXY],
      policy_stance: policyStance,
      forward_direction: forwardDirection,
    };

    // Insert into database
    console.log('💾 Storing in database...');
    await pool.query(
      `INSERT INTO m28_rate_environment (
        snapshot_date, ffr, sofr, t10y, t30y_mtg, m2_yoy, m2_level,
        fed_balance_sheet, dxy, policy_stance, forward_direction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        rateData.snapshot_date,
        rateData.ffr,
        rateData.sofr,
        rateData.t10y,
        rateData.t30y_mtg,
        rateData.m2_yoy,
        rateData.m2_level,
        rateData.fed_balance_sheet,
        rateData.dxy,
        rateData.policy_stance,
        rateData.forward_direction,
      ]
    );

    // Calculate cap spread (if we have market data)
    // This would pull from M05 market intelligence for current cap rates
    // For now, we'll skip this and calculate on-demand

    console.log('\n✅ Rate data ingestion complete!');
    console.log(`   FFR: ${rateData.ffr}%`);
    console.log(`   10Y: ${rateData.t10y}%`);
    console.log(`   30Y Mortgage: ${rateData.t30y_mtg}%`);
    console.log(`   M2 YoY: ${rateData.m2_yoy?.toFixed(2)}%`);
    console.log(`   Policy Stance: ${rateData.policy_stance}`);
    console.log(`   Forward Direction: ${rateData.forward_direction}`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Rate data ingestion failed:', error.message);
    throw error;
  }
}

/**
 * Backfill historical rate data
 */
async function backfillRateData(startDate: string, endDate: string) {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`M28 Rate Data Backfill: ${startDate} to ${endDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  try {
    // Fetch all series for date range
    const seriesData = await fredApiClient.getMultipleSeries(
      [
        FRED_SERIES.FFR,
        FRED_SERIES.SOFR,
        FRED_SERIES.T10Y,
        FRED_SERIES.MTG30Y,
        FRED_SERIES.M2,
        FRED_SERIES.FED_ASSETS,
        FRED_SERIES.DXY,
      ],
      startDate,
      endDate
    );

    // Calculate M2 YoY for the range
    const m2YoyData = calculateM2YoY(seriesData[FRED_SERIES.M2]);

    // Build map of date -> values
    const dateMap: Record<string, any> = {};

    Object.entries(seriesData).forEach(([seriesId, observations]) => {
      observations.forEach(obs => {
        if (!dateMap[obs.date]) {
          dateMap[obs.date] = {};
        }
        dateMap[obs.date][seriesId] = parseFloat(obs.value);
      });
    });

    // Add M2 YoY
    m2YoyData.forEach(obs => {
      if (dateMap[obs.date]) {
        dateMap[obs.date].m2_yoy = parseFloat(obs.value);
      }
    });

    // Determine policy stance for each date
    const ffrData = seriesData[FRED_SERIES.FFR];
    
    // Insert each date
    let inserted = 0;
    let skipped = 0;

    for (const [date, values] of Object.entries(dateMap)) {
      // Check if already exists
      const existing = await pool.query(
        'SELECT 1 FROM m28_rate_environment WHERE snapshot_date = $1',
        [date]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Calculate policy stance (simplified for backfill)
      const ffrValue = values[FRED_SERIES.FFR] || 0;
      const policyStance = ffrValue < 0.5 ? 'emergency' : 'neutral';

      // Calculate forward direction
      const t10yValue = values[FRED_SERIES.T10Y] || 0;
      const forwardDirection = determineForwardDirection(ffrValue, t10yValue);

      await pool.query(
        `INSERT INTO m28_rate_environment (
          snapshot_date, ffr, sofr, t10y, t30y_mtg, m2_yoy, m2_level,
          fed_balance_sheet, dxy, policy_stance, forward_direction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          date,
          values[FRED_SERIES.FFR] || null,
          values[FRED_SERIES.SOFR] || null,
          values[FRED_SERIES.T10Y] || null,
          values[FRED_SERIES.MTG30Y] || null,
          values.m2_yoy || null,
          values[FRED_SERIES.M2] || null,
          values[FRED_SERIES.FED_ASSETS] || null,
          values[FRED_SERIES.DXY] || null,
          policyStance,
          forwardDirection,
        ]
      );

      inserted++;
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Inserted: ${inserted} records`);
    console.log(`   Skipped: ${skipped} records (already exist)`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    if (command === 'backfill') {
      const startDate = args[1]; // YYYY-MM-DD
      const endDate = args[2];   // YYYY-MM-DD
      
      if (!startDate || !endDate) {
        console.error('Usage: npm run ingest-rate-data backfill <startDate> <endDate>');
        console.error('Example: npm run ingest-rate-data backfill 2024-01-01 2025-12-31');
        process.exit(1);
      }

      await backfillRateData(startDate, endDate);
    } else {
      // Daily ingestion
      const dateOverride = args[0]; // Optional: YYYY-MM-DD
      await ingestRateData(dateOverride);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ingestRateData, backfillRateData };
