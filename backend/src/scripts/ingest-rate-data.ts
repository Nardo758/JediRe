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
  gdp_growth_pct: number | null;
  cpi_yoy_pct: number | null;
  unrate: number | null;
  consumer_sentiment: number | null;
}

async function ingestRateData(dateOverride?: string) {
  const targetDate = dateOverride || new Date().toISOString().split('T')[0];
  
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`M28 Rate Data Ingestion - ${targetDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  try {
    // Check if macro indicators need updating (allow upsert even if row exists)
    const existing = await pool.query(
      'SELECT gdp_growth_pct FROM m28_rate_environment WHERE snapshot_date = $1',
      [targetDate]
    );
    const macroAlreadyFilled = existing.rows.length > 0 && existing.rows[0].gdp_growth_pct !== null;

    if (existing.rows.length > 0 && macroAlreadyFilled) {
      console.log(`⏭️  Complete data already exists for ${targetDate}. Skipping.`);
      return;
    }

    // Fetch rate series + macro indicators in parallel
    console.log('📊 Fetching rate + macro data from FRED...');
    const [latestValues, m2Historical, ffrHistorical, cpiHistorical, gdpHistorical] = await Promise.all([
      fredApiClient.getMultipleLatest([
        FRED_SERIES.FFR,
        FRED_SERIES.SOFR,
        FRED_SERIES.T10Y,
        FRED_SERIES.MTG30Y,
        FRED_SERIES.M2,
        FRED_SERIES.FED_ASSETS,
        FRED_SERIES.DXY,
        FRED_SERIES.UNRATE,
        FRED_SERIES.UMCSENT,
      ]),
      // sortDesc=true fetches most recent N observations, then reverses to ascending order
      fredApiClient.getSeries(FRED_SERIES.M2, undefined, undefined, 13, true),
      fredApiClient.getSeries(FRED_SERIES.FFR, undefined, undefined, 90, true),
      fredApiClient.getSeries(FRED_SERIES.CPI, undefined, undefined, 14, true),
      fredApiClient.getSeries(FRED_SERIES.GDP, undefined, undefined, 6, true),
    ]);

    // M2 YoY
    const m2YoyData = calculateM2YoY(m2Historical);
    const m2Yoy = m2YoyData.length > 0
      ? parseFloat(m2YoyData[m2YoyData.length - 1].value)
      : null;

    // CPI YoY (month-over-month-ago-12)
    let cpiYoy: number | null = null;
    if (cpiHistorical.length >= 13) {
      const latest = parseFloat(cpiHistorical[cpiHistorical.length - 1].value);
      const yearAgo = parseFloat(cpiHistorical[cpiHistorical.length - 13].value);
      if (!isNaN(latest) && !isNaN(yearAgo) && yearAgo > 0) {
        cpiYoy = parseFloat(((latest - yearAgo) / yearAgo * 100).toFixed(2));
      }
    }

    // GDP YoY (quarterly — compare to 4 quarters ago)
    let gdpYoy: number | null = null;
    if (gdpHistorical.length >= 5) {
      const gdpLatest = parseFloat(gdpHistorical[gdpHistorical.length - 1].value);
      const gdpYearAgo = parseFloat(gdpHistorical[gdpHistorical.length - 5].value);
      if (!isNaN(gdpLatest) && !isNaN(gdpYearAgo) && gdpYearAgo > 0) {
        gdpYoy = parseFloat(((gdpLatest - gdpYearAgo) / gdpYearAgo * 100).toFixed(2));
      }
    }

    const policyStance = determinePolicyStance(ffrHistorical);
    const ffr = latestValues[FRED_SERIES.FFR] || 0;
    const t10y = latestValues[FRED_SERIES.T10Y] || 0;
    const forwardDirection = determineForwardDirection(ffr, t10y);

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
      gdp_growth_pct: gdpYoy,
      cpi_yoy_pct: cpiYoy,
      unrate: latestValues[FRED_SERIES.UNRATE],
      consumer_sentiment: latestValues[FRED_SERIES.UMCSENT],
    };

    // Upsert — insert or update macro columns if row already exists
    console.log('💾 Storing in database...');
    await pool.query(
      `INSERT INTO m28_rate_environment (
        snapshot_date, ffr, sofr, t10y, t30y_mtg, m2_yoy, m2_level,
        fed_balance_sheet, dxy, policy_stance, forward_direction,
        gdp_growth_pct, cpi_yoy_pct, unrate, consumer_sentiment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (snapshot_date) DO UPDATE SET
        ffr                = EXCLUDED.ffr,
        sofr               = EXCLUDED.sofr,
        t10y               = EXCLUDED.t10y,
        t30y_mtg           = EXCLUDED.t30y_mtg,
        m2_yoy             = EXCLUDED.m2_yoy,
        m2_level           = EXCLUDED.m2_level,
        fed_balance_sheet  = EXCLUDED.fed_balance_sheet,
        dxy                = EXCLUDED.dxy,
        policy_stance      = EXCLUDED.policy_stance,
        forward_direction  = EXCLUDED.forward_direction,
        gdp_growth_pct     = EXCLUDED.gdp_growth_pct,
        cpi_yoy_pct        = EXCLUDED.cpi_yoy_pct,
        unrate             = EXCLUDED.unrate,
        consumer_sentiment = EXCLUDED.consumer_sentiment`,
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
        rateData.gdp_growth_pct,
        rateData.cpi_yoy_pct,
        rateData.unrate,
        rateData.consumer_sentiment,
      ]
    );

    console.log('\n✅ Rate + macro data ingestion complete!');
    console.log(`   FFR: ${rateData.ffr}%  |  10Y: ${rateData.t10y}%  |  Mortgage: ${rateData.t30y_mtg}%`);
    console.log(`   M2 YoY: ${rateData.m2_yoy?.toFixed(2)}%  |  Policy: ${rateData.policy_stance}  |  Direction: ${rateData.forward_direction}`);
    console.log(`   GDP YoY: ${rateData.gdp_growth_pct?.toFixed(2)}%  |  CPI YoY: ${rateData.cpi_yoy_pct?.toFixed(2)}%  |  UNRATE: ${rateData.unrate}%  |  Sentiment: ${rateData.consumer_sentiment}`);
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
