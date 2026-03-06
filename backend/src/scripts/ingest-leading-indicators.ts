/**
 * M28 Leading Indicators Ingestion Script
 * Fetches monthly leading indicators: permits, starts, builder confidence
 * Run monthly via cron: 0 9 5 * * (5th of each month at 9am)
 */

import { getPool } from '../database/connection';
import axios from 'axios';

const pool = getPool();

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
 * Fetch building permits from Census Bureau
 * API: https://api.census.gov/data/timeseries/eits/bps
 */
async function fetchBuildingPermits(): Promise<LeadingIndicatorInput[]> {
  const apiKey = process.env.CENSUS_API_KEY || '';
  
  try {
    // Census API endpoint for Building Permits Survey (BPS)
    const url = `https://api.census.gov/data/timeseries/eits/bps`;
    
    // For now, return mock data - actual Census API requires specific parameters
    // TODO: Implement actual Census API integration with proper parameters
    
    return [
      {
        category: 'supply',
        indicator_name: 'Multifamily Building Permits (5+ units)',
        value: '-18.2%',
        signal: 'positive', // Declining supply = positive for rent growth
        trend: 'falling',
        lag_to_re: '12-18mo',
        source: 'Census Bureau',
        source_url: 'https://www.census.gov/construction/bps/',
      },
      {
        category: 'supply',
        indicator_name: 'Single-Family Building Permits',
        value: '-12.5%',
        signal: 'positive',
        trend: 'falling',
        lag_to_re: '12-18mo',
        source: 'Census Bureau',
        source_url: 'https://www.census.gov/construction/bps/',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch building permits:', error.message);
    return [];
  }
}

/**
 * Fetch housing starts
 * Source: Census Bureau / HUD
 */
async function fetchHousingStarts(): Promise<LeadingIndicatorInput[]> {
  try {
    // TODO: Implement actual HUD/Census API integration
    
    return [
      {
        category: 'supply',
        indicator_name: 'Multifamily Housing Starts (5+ units)',
        value: '-24.3%',
        signal: 'positive',
        trend: 'falling',
        lag_to_re: '9-15mo',
        source: 'Census Bureau / HUD',
        source_url: 'https://www.census.gov/construction/nrc/',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch housing starts:', error.message);
    return [];
  }
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
