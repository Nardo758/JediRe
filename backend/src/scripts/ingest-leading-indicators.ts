/**
 * M28 Leading Indicators Ingestion Script
 * Fetches monthly leading indicators: permits, starts, builder confidence
 * Run monthly via cron: 0 9 5 * * (5th of each month at 9am)
 */

import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import axios from 'axios';
import { fredApiClient } from '../utils/fred-api.client';

const pool = getPool();

// ── FRED helpers ──────────────────────────────────────────────────────────────

async function fredLatestAndYoY(
  seriesId: string,
  startYear = new Date().getFullYear() - 2
): Promise<{ latest: number | null; yoyPct: number | null; date: string | null }> {
  const startDate = `${startYear}-01-01`;
  const observations = await fredApiClient.getSeries(seriesId, startDate);
  if (!observations || observations.length === 0) return { latest: null, yoyPct: null, date: null };

  const valid = observations.filter(o => o.value !== '.' && o.value !== '');
  if (valid.length === 0) return { latest: null, yoyPct: null, date: null };

  const latest = valid[valid.length - 1];
  const latestVal = parseFloat(latest.value);
  const latestDate = latest.date as string;

  // Find same month one year ago
  const yearAgoDate = latestDate.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1));
  const yearAgo = valid.find(o => (o.date as string) === yearAgoDate);
  let yoyPct: number | null = null;
  if (yearAgo) {
    const prevVal = parseFloat(yearAgo.value);
    if (!isNaN(prevVal) && prevVal !== 0) {
      yoyPct = parseFloat(((latestVal - prevVal) / prevVal * 100).toFixed(1));
    }
  }

  return { latest: latestVal, yoyPct, date: latestDate };
}

interface LeadingIndicatorInput {
  category: 'supply' | 'demand' | 'macro' | 'sentiment';
  indicator_name: string;
  value: string;
  signal: 'positive' | 'negative' | 'neutral' | 'mixed';
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
  lag_to_re: string;
  source: string;
  source_url?: string;
}

/**
 * Fetch building permits via FRED API (Atlanta MSA + national aggregates).
 *
 * Note: The Census BPS timeseries API endpoint returns 404 for the
 * query parameters documented publicly. FRED carries the same BPS data
 * and is already wired in the codebase.
 *
 * FRED series used:
 *   ATLA013BPPRIV  — All private structures, Atlanta MSA (not SA)
 *   ATLA013BP1FHSA — 1-unit structures, Atlanta MSA (SA)
 *   PERMIT         — National housing permits (proxy for multifamily trend)
 */
async function fetchBuildingPermits(): Promise<LeadingIndicatorInput[]> {
  const results: LeadingIndicatorInput[] = [];

  try {
    // Atlanta MSA — total private structures permitted
    const atlanta = await fredLatestAndYoY('ATLA013BPPRIV');
    if (atlanta.latest !== null) {
      const yoy = atlanta.yoyPct;
      const trend = yoy === null ? 'stable' : yoy > 5 ? 'rising' : yoy < -5 ? 'falling' : 'stable';
      // Rising permits = more supply coming = negative for rent growth in 12-18mo
      const signal: 'positive' | 'negative' | 'neutral' = yoy === null ? 'neutral' : yoy < -5 ? 'positive' : yoy > 5 ? 'negative' : 'neutral';
      results.push({
        category: 'supply',
        indicator_name: 'Atlanta MSA — New Housing Permits (all types)',
        value: yoy !== null ? `${yoy >= 0 ? '+' : ''}${yoy}% YoY (${Math.round(atlanta.latest).toLocaleString()} structures)` : `${Math.round(atlanta.latest).toLocaleString()} structures`,
        signal,
        trend,
        lag_to_re: '12-18mo',
        source: 'FRED / Census BPS',
        source_url: 'https://fred.stlouisfed.org/series/ATLA013BPPRIV',
      });
    }

    // Atlanta MSA — 1-unit (single-family) as separate signal
    const sf = await fredLatestAndYoY('ATLA013BP1FHSA');
    if (sf.latest !== null) {
      const yoy = sf.yoyPct;
      const trend = yoy === null ? 'stable' : yoy > 5 ? 'rising' : yoy < -5 ? 'falling' : 'stable';
      results.push({
        category: 'supply',
        indicator_name: 'Atlanta MSA — Single-Family Permits',
        value: yoy !== null ? `${yoy >= 0 ? '+' : ''}${yoy}% YoY (${Math.round(sf.latest).toLocaleString()} units)` : `${Math.round(sf.latest).toLocaleString()} units`,
        signal: 'neutral',
        trend,
        lag_to_re: '12-18mo',
        source: 'FRED / Census BPS',
        source_url: 'https://fred.stlouisfed.org/series/ATLA013BP1FHSA',
      });
    }
  } catch (error: any) {
    console.error('Failed to fetch Atlanta building permits from FRED:', error.message);
  }

  // Fallback to national permits if Atlanta series unavailable
  if (results.length === 0) {
    try {
      const national = await fredLatestAndYoY('PERMIT');
      if (national.latest !== null) {
        const yoy = national.yoyPct;
        const trend = yoy === null ? 'stable' : yoy > 5 ? 'rising' : yoy < -5 ? 'falling' : 'stable';
        results.push({
          category: 'supply',
          indicator_name: 'National Housing Permits (all types)',
          value: yoy !== null ? `${yoy >= 0 ? '+' : ''}${yoy}% YoY` : `${Math.round(national.latest).toLocaleString()} units`,
          signal: 'neutral',
          trend,
          lag_to_re: '12-18mo',
          source: 'FRED / Census BPS',
          source_url: 'https://fred.stlouisfed.org/series/PERMIT',
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch national permits:', err.message);
    }
  }

  return results;
}

/**
 * Fetch housing starts from FRED.
 * HOUST5F — 5+ unit starts, seasonally adjusted annual rate
 * HOUST   — total starts, SA annual rate
 */
async function fetchHousingStarts(): Promise<LeadingIndicatorInput[]> {
  const results: LeadingIndicatorInput[] = [];

  try {
    const mf = await fredLatestAndYoY('HOUST5F');
    if (mf.latest !== null) {
      const yoy = mf.yoyPct;
      const trend = yoy === null ? 'stable' : yoy > 5 ? 'rising' : yoy < -5 ? 'falling' : 'stable';
      const signal: 'positive' | 'negative' | 'neutral' = yoy === null ? 'neutral' : yoy < -5 ? 'positive' : yoy > 5 ? 'negative' : 'neutral';
      results.push({
        category: 'supply',
        indicator_name: 'Multifamily Housing Starts (5+ units, SAAR)',
        value: yoy !== null ? `${yoy >= 0 ? '+' : ''}${yoy}% YoY (${Math.round(mf.latest).toLocaleString()}K SAAR)` : `${Math.round(mf.latest).toLocaleString()}K SAAR`,
        signal,
        trend,
        lag_to_re: '9-15mo',
        source: 'FRED / Census Bureau',
        source_url: 'https://fred.stlouisfed.org/series/HOUST5F',
      });
    }

    const total = await fredLatestAndYoY('HOUST');
    if (total.latest !== null) {
      const yoy = total.yoyPct;
      const trend = yoy === null ? 'stable' : yoy > 5 ? 'rising' : yoy < -5 ? 'falling' : 'stable';
      results.push({
        category: 'supply',
        indicator_name: 'Total Housing Starts (SAAR)',
        value: yoy !== null ? `${yoy >= 0 ? '+' : ''}${yoy}% YoY (${Math.round(total.latest).toLocaleString()}K SAAR)` : `${Math.round(total.latest).toLocaleString()}K SAAR`,
        signal: 'neutral',
        trend,
        lag_to_re: '9-15mo',
        source: 'FRED / Census Bureau',
        source_url: 'https://fred.stlouisfed.org/series/HOUST',
      });
    }
  } catch (error: any) {
    console.error('Failed to fetch housing starts from FRED:', error.message);
  }

  return results;
}

/**
 * Fetch NAHB Builder Confidence Index
 * Source: NAHB (may require scraping or manual entry)
 */
async function fetchBuilderConfidence(): Promise<LeadingIndicatorInput[]> {
  try {
    // NAHB data typically requires scraping or manual entry
    // For now, return mock data
    
    return [
      {
        category: 'sentiment',
        indicator_name: 'NAHB/Wells Fargo Housing Market Index',
        value: '47',
        signal: 'negative', // <50 = pessimism
        trend: 'stable',
        lag_to_re: '6-12mo',
        source: 'NAHB',
        source_url: 'https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch builder confidence:', error.message);
    return [];
  }
}

/**
 * Fetch consumer confidence
 * Source: Conference Board (may require subscription)
 */
async function fetchConsumerConfidence(): Promise<LeadingIndicatorInput[]> {
  try {
    // Conference Board data requires subscription
    // For now, return mock data
    
    return [
      {
        category: 'demand',
        indicator_name: 'Consumer Confidence Index',
        value: '98.5',
        signal: 'neutral',
        trend: 'stable',
        lag_to_re: '3-6mo',
        source: 'Conference Board',
        source_url: 'https://www.conference-board.org/topics/consumer-confidence',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch consumer confidence:', error.message);
    return [];
  }
}

/**
 * Fetch net migration estimates
 * Source: Census Bureau / state agencies
 */
async function fetchNetMigration(): Promise<LeadingIndicatorInput[]> {
  try {
    // TODO: Implement Census API for migration data
    
    return [
      {
        category: 'demand',
        indicator_name: 'Net Domestic Migration (Florida)',
        value: '+318,000',
        signal: 'positive',
        trend: 'rising',
        lag_to_re: '6-12mo',
        source: 'Census Bureau',
        source_url: 'https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-total.html',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch net migration:', error.message);
    return [];
  }
}

/**
 * Main ingestion function
 */
async function ingestLeadingIndicators(snapshotDate?: string) {
  const targetDate = snapshotDate || new Date().toISOString().split('T')[0];
  
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`M28 Leading Indicators Ingestion - ${targetDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  try {
    // Check if data already exists
    const existing = await pool.query(
      'SELECT COUNT(*) FROM m28_leading_indicators WHERE snapshot_date = $1',
      [targetDate]
    );

    const existingCount = parseInt(existing.rows[0].count);
    if (existingCount > 0) {
      console.log(`⏭️  ${existingCount} indicators already exist for ${targetDate}. Skipping.`);
      return;
    }

    // Fetch all indicators
    console.log('📊 Fetching leading indicators...');
    
    const [
      permits,
      starts,
      builderConfidence,
      consumerConfidence,
      migration,
    ] = await Promise.all([
      fetchBuildingPermits(),
      fetchHousingStarts(),
      fetchBuilderConfidence(),
      fetchConsumerConfidence(),
      fetchNetMigration(),
    ]);

    const allIndicators = [
      ...permits,
      ...starts,
      ...builderConfidence,
      ...consumerConfidence,
      ...migration,
    ];

    // Insert into database
    console.log(`💾 Storing ${allIndicators.length} indicators...`);
    
    let inserted = 0;
    for (const indicator of allIndicators) {
      await pool.query(
        `INSERT INTO m28_leading_indicators (
          snapshot_date, category, indicator_name, value,
          signal, trend, lag_to_re, source, source_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (snapshot_date, category, indicator_name) DO UPDATE SET
          value = EXCLUDED.value,
          signal = EXCLUDED.signal,
          trend = EXCLUDED.trend,
          updated_at = NOW()`,
        [
          targetDate,
          indicator.category,
          indicator.indicator_name,
          indicator.value,
          indicator.signal,
          indicator.trend,
          indicator.lag_to_re,
          indicator.source,
          indicator.source_url || null,
        ]
      );
      inserted++;
    }

    console.log('\n✅ Leading indicators ingestion complete!');
    console.log(`   Inserted/Updated: ${inserted} indicators\n`);

    // Print summary by category
    const summary = allIndicators.reduce((acc, ind) => {
      acc[ind.category] = (acc[ind.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📋 Summary by category:');
    Object.entries(summary).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} indicators`);
    });
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Leading indicators ingestion failed:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════

async function main() {
  try {
    const snapshotDate = process.argv[2]; // Optional: YYYY-MM-DD
    await ingestLeadingIndicators(snapshotDate);

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

export { ingestLeadingIndicators };
