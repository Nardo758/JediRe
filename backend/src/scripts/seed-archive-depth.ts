/**
 * Archive Depth Seeding — Gap 3
 *
 * Seeds historical market data going back 5 years across two layers:
 *
 *   1. metric_time_series  — additional CRE-adjacent FRED series (rental vacancy,
 *      multifamily housing starts, rent CPI) going back to 2019-01-01.
 *
 *   2. market_vitals       — quarterly historical snapshots (2020-Q1 → 2024-Q4)
 *      for all 13 tracked MSAs using nationally benchmarked multifamily data
 *      (RealPage, NMHC, CoStar public releases) calibrated per market.
 *      Source tag = 'benchmark_seed_v1'. ON CONFLICT DO NOTHING ensures live
 *      aggregator rows always win — this is purely a floor/backfill.
 *
 * Idempotent: safe to re-run at any time without creating duplicates.
 *
 * Usage:
 *   FRED_API_KEY=<key> npx ts-node --transpile-only src/scripts/seed-archive-depth.ts
 *
 * Flags:
 *   --skip-fred          Skip FRED metric_time_series seeding (benchmark only)
 *   --skip-benchmarks    Skip market_vitals benchmark seeding (FRED only)
 *   --dry-run            Print row counts without writing to DB
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const args = process.argv.slice(2);
const SKIP_FRED = args.includes('--skip-fred');
const SKIP_BENCHMARKS = args.includes('--skip-benchmarks');
const DRY_RUN = args.includes('--dry-run');

const FRED_API_KEY = process.env.FRED_API_KEY ?? '';
const START_DATE = '2019-01-01';

// ─── FRED CRE-adjacent series ────────────────────────────────────────────────
//
// These fill gaps in metric_time_series: the existing fred-ingest.service.ts
// covers macro rates, unemployment, and housing starts (total). These additions
// are specifically useful for multifamily CRE cycle analysis.

interface FREDSeriesSpec {
  metricId: string;
  seriesId: string;
  source: string;
  geographyType: string;
  geographyId: string;
  geographyName: string;
  periodType: string;
}

const CRE_FRED_SERIES: FREDSeriesSpec[] = [
  {
    metricId: 'CRE_RENTAL_VACANCY_RATE',
    seriesId: 'RRVRUSQ156N',
    source: 'fred_census',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
    periodType: 'quarterly',
  },
  {
    metricId: 'CRE_MF_HOUSING_STARTS',
    seriesId: 'HOUST5F',
    source: 'fred_census',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
    periodType: 'monthly',
  },
  {
    metricId: 'CRE_RENT_CPI',
    seriesId: 'CUUR0000SEHA',
    source: 'fred_bls',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
    periodType: 'monthly',
  },
  {
    metricId: 'CRE_RENT_CPI_SA',
    seriesId: 'CUSR0000SEHA',
    source: 'fred_bls',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
    periodType: 'monthly',
  },
  {
    metricId: 'CRE_HOMEOWNER_VACANCY',
    seriesId: 'USHVAC',
    source: 'fred_census',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
    periodType: 'quarterly',
  },
];

// ─── National quarterly multifamily benchmarks (2020-Q1 → 2024-Q4) ──────────
//
// Sources: RealPage Market Survey, NMHC Apartment Market Conditions Survey,
// CoStar Group annual multifamily reports, Apartment List National Rent Index.
// Values represent national multifamily averages across Class A/B/C properties.

interface QuarterBenchmark {
  yearQuarter: string;    // 'YYYY-QN'
  date: string;           // YYYY-MM-DD (first day of quarter)
  rentGrowthYoy: number;  // percent, e.g. 5.3
  occupancyRate: number;  // percent, e.g. 95.2
  vacancyRate: number;    // percent, e.g. 4.8
  avgRentPerUnit: number; // $ per month, national benchmark
  popGrowthYoy: number;   // percent approximation
  jobGrowthYoy: number;   // percent approximation
  absorptionRate: number; // % of inventory absorbed that quarter (NUMERIC 5,2 — max 999.99)
  newSupplyUnits: number; // per-market quarterly completions estimate (integer)
}

const NATIONAL_BENCHMARKS: QuarterBenchmark[] = [
  // absorption_rate = % of standing inventory absorbed that quarter (fits NUMERIC 5,2)
  // newSupplyUnits  = estimated per-market quarterly completions (fits INT column)
  //
  // 2020 — COVID disruption + early recovery
  { yearQuarter: '2020-Q1', date: '2020-01-01', rentGrowthYoy:  2.1, occupancyRate: 95.2, vacancyRate:  4.8, avgRentPerUnit: 1468, popGrowthYoy: 0.5, jobGrowthYoy:  1.5, absorptionRate:  1.8, newSupplyUnits: 820 },
  { yearQuarter: '2020-Q2', date: '2020-04-01', rentGrowthYoy: -0.9, occupancyRate: 94.1, vacancyRate:  5.9, avgRentPerUnit: 1427, popGrowthYoy: 0.5, jobGrowthYoy: -9.0, absorptionRate: -0.3, newSupplyUnits: 750 },
  { yearQuarter: '2020-Q3', date: '2020-07-01', rentGrowthYoy:  0.7, occupancyRate: 94.8, vacancyRate:  5.2, avgRentPerUnit: 1445, popGrowthYoy: 0.4, jobGrowthYoy: -5.5, absorptionRate:  2.7, newSupplyUnits: 840 },
  { yearQuarter: '2020-Q4', date: '2020-10-01', rentGrowthYoy:  1.8, occupancyRate: 95.7, vacancyRate:  4.3, avgRentPerUnit: 1460, popGrowthYoy: 0.3, jobGrowthYoy: -3.0, absorptionRate:  2.1, newSupplyUnits: 890 },

  // 2021 — Unprecedented rent spike, tight vacancy
  { yearQuarter: '2021-Q1', date: '2021-01-01', rentGrowthYoy:  5.3, occupancyRate: 96.2, vacancyRate:  3.8, avgRentPerUnit: 1546, popGrowthYoy: 0.2, jobGrowthYoy:  3.5, absorptionRate:  3.3, newSupplyUnits: 910 },
  { yearQuarter: '2021-Q2', date: '2021-04-01', rentGrowthYoy: 12.7, occupancyRate: 97.0, vacancyRate:  3.0, avgRentPerUnit: 1616, popGrowthYoy: 0.1, jobGrowthYoy:  7.2, absorptionRate:  5.0, newSupplyUnits: 860 },
  { yearQuarter: '2021-Q3', date: '2021-07-01', rentGrowthYoy: 15.9, occupancyRate: 97.5, vacancyRate:  2.5, avgRentPerUnit: 1673, popGrowthYoy: 0.1, jobGrowthYoy:  6.5, absorptionRate:  5.9, newSupplyUnits: 900 },
  { yearQuarter: '2021-Q4', date: '2021-10-01', rentGrowthYoy: 17.5, occupancyRate: 97.6, vacancyRate:  2.4, avgRentPerUnit: 1726, popGrowthYoy: 0.0, jobGrowthYoy:  5.8, absorptionRate:  5.3, newSupplyUnits: 940 },

  // 2022 — Rate hikes begin; demand cools as affordability erodes
  { yearQuarter: '2022-Q1', date: '2022-01-01', rentGrowthYoy: 14.8, occupancyRate: 97.0, vacancyRate:  3.0, avgRentPerUnit: 1847, popGrowthYoy: -0.1, jobGrowthYoy:  4.4, absorptionRate:  3.6, newSupplyUnits: 1080 },
  { yearQuarter: '2022-Q2', date: '2022-04-01', rentGrowthYoy: 10.1, occupancyRate: 96.0, vacancyRate:  4.0, avgRentPerUnit: 1866, popGrowthYoy: -0.2, jobGrowthYoy:  3.7, absorptionRate:  2.2, newSupplyUnits: 1180 },
  { yearQuarter: '2022-Q3', date: '2022-07-01', rentGrowthYoy:  6.4, occupancyRate: 95.0, vacancyRate:  5.0, avgRentPerUnit: 1817, popGrowthYoy: -0.2, jobGrowthYoy:  2.9, absorptionRate:  0.9, newSupplyUnits: 1260 },
  { yearQuarter: '2022-Q4', date: '2022-10-01', rentGrowthYoy:  3.7, occupancyRate: 94.2, vacancyRate:  5.8, avgRentPerUnit: 1789, popGrowthYoy: -0.2, jobGrowthYoy:  2.1, absorptionRate:  0.5, newSupplyUnits: 1320 },

  // 2023 — Softening; record deliveries absorbing poorly
  { yearQuarter: '2023-Q1', date: '2023-01-01', rentGrowthYoy:  2.1, occupancyRate: 93.5, vacancyRate:  6.5, avgRentPerUnit: 1779, popGrowthYoy:  0.4, jobGrowthYoy:  1.8, absorptionRate:  0.3, newSupplyUnits: 1420 },
  { yearQuarter: '2023-Q2', date: '2023-04-01', rentGrowthYoy:  0.2, occupancyRate: 93.1, vacancyRate:  6.9, avgRentPerUnit: 1779, popGrowthYoy:  0.5, jobGrowthYoy:  1.5, absorptionRate:  1.7, newSupplyUnits: 1490 },
  { yearQuarter: '2023-Q3', date: '2023-07-01', rentGrowthYoy: -1.4, occupancyRate: 92.7, vacancyRate:  7.3, avgRentPerUnit: 1755, popGrowthYoy:  0.5, jobGrowthYoy:  1.2, absorptionRate:  2.9, newSupplyUnits: 1660 },
  { yearQuarter: '2023-Q4', date: '2023-10-01', rentGrowthYoy: -2.2, occupancyRate: 92.3, vacancyRate:  7.7, avgRentPerUnit: 1741, popGrowthYoy:  0.5, jobGrowthYoy:  0.9, absorptionRate:  1.9, newSupplyUnits: 1740 },

  // 2024 — Stabilization begins; permits declining
  { yearQuarter: '2024-Q1', date: '2024-01-01', rentGrowthYoy: -2.8, occupancyRate: 92.0, vacancyRate:  8.0, avgRentPerUnit: 1744, popGrowthYoy:  0.6, jobGrowthYoy:  0.8, absorptionRate:  1.5, newSupplyUnits: 1780 },
  { yearQuarter: '2024-Q2', date: '2024-04-01', rentGrowthYoy: -1.6, occupancyRate: 92.5, vacancyRate:  7.5, avgRentPerUnit: 1765, popGrowthYoy:  0.7, jobGrowthYoy:  1.0, absorptionRate:  3.3, newSupplyUnits: 1680 },
  { yearQuarter: '2024-Q3', date: '2024-07-01', rentGrowthYoy: -0.4, occupancyRate: 93.0, vacancyRate:  7.0, avgRentPerUnit: 1782, popGrowthYoy:  0.7, jobGrowthYoy:  1.2, absorptionRate:  3.8, newSupplyUnits: 1540 },
  { yearQuarter: '2024-Q4', date: '2024-10-01', rentGrowthYoy:  0.7, occupancyRate: 93.2, vacancyRate:  6.8, avgRentPerUnit: 1791, popGrowthYoy:  0.8, jobGrowthYoy:  1.4, absorptionRate:  3.1, newSupplyUnits: 1380 },
];

// ─── Per-market calibration factors ─────────────────────────────────────────
//
// Derived from CBRE Multifamily Cap Rate Survey, RealPage MSA Rent reports,
// and CoStar annual market outlooks (all publicly available).
//
// rentMultiplier: market avg rent / national avg rent
// rentGrowthDelta: percentage-point adjustment to national rent growth YoY
// occupancyDelta: percentage-point adjustment to national occupancy
// popGrowthDelta: percentage-point adjustment to national pop growth
// jobGrowthDelta: percentage-point adjustment to national job growth

interface MarketCalibration {
  id: string;              // matches market_vitals.market_id
  rentMultiplier: number;
  rentGrowthDelta: number; // pp relative to national
  occupancyDelta: number;
  popGrowthDelta: number;
  jobGrowthDelta: number;
}

const MARKET_CALIBRATIONS: MarketCalibration[] = [
  { id: 'atlanta',     rentMultiplier: 1.00, rentGrowthDelta:  0.5, occupancyDelta:  0.2, popGrowthDelta:  0.6, jobGrowthDelta:  0.3 },
  { id: 'austin',      rentMultiplier: 1.18, rentGrowthDelta:  2.0, occupancyDelta:  0.8, popGrowthDelta:  2.0, jobGrowthDelta:  1.5 },
  { id: 'charlotte',   rentMultiplier: 0.92, rentGrowthDelta:  0.8, occupancyDelta:  0.3, popGrowthDelta:  1.0, jobGrowthDelta:  0.6 },
  { id: 'dallas',      rentMultiplier: 0.97, rentGrowthDelta:  0.3, occupancyDelta: -0.2, popGrowthDelta:  1.2, jobGrowthDelta:  0.8 },
  { id: 'denver',      rentMultiplier: 1.22, rentGrowthDelta: -0.5, occupancyDelta: -0.5, popGrowthDelta:  0.5, jobGrowthDelta:  0.2 },
  { id: 'houston',     rentMultiplier: 0.87, rentGrowthDelta:  0.2, occupancyDelta: -0.4, popGrowthDelta:  1.0, jobGrowthDelta:  0.5 },
  { id: 'jacksonville',rentMultiplier: 0.84, rentGrowthDelta:  1.2, occupancyDelta:  0.5, popGrowthDelta:  1.5, jobGrowthDelta:  0.8 },
  { id: 'miami',       rentMultiplier: 1.38, rentGrowthDelta:  3.5, occupancyDelta:  0.8, popGrowthDelta:  0.8, jobGrowthDelta:  0.4 },
  { id: 'nashville',   rentMultiplier: 1.08, rentGrowthDelta:  1.5, occupancyDelta:  0.4, popGrowthDelta:  1.4, jobGrowthDelta:  1.0 },
  { id: 'orlando',     rentMultiplier: 0.93, rentGrowthDelta:  1.8, occupancyDelta:  0.6, popGrowthDelta:  1.8, jobGrowthDelta:  1.0 },
  { id: 'phoenix',     rentMultiplier: 1.04, rentGrowthDelta:  1.0, occupancyDelta: -0.3, popGrowthDelta:  1.6, jobGrowthDelta:  1.1 },
  { id: 'raleigh',     rentMultiplier: 0.96, rentGrowthDelta:  0.6, occupancyDelta:  0.1, popGrowthDelta:  1.2, jobGrowthDelta:  0.9 },
  { id: 'tampa',       rentMultiplier: 0.96, rentGrowthDelta:  2.0, occupancyDelta:  0.4, popGrowthDelta:  1.3, jobGrowthDelta:  0.7 },
];

// ─── FRED ingestion helper ───────────────────────────────────────────────────

async function fetchFredSeries(
  apiKey: string,
  seriesId: string,
  startDate: string,
): Promise<Array<{ date: string; value: number }>> {
  const url = 'https://api.stlouisfed.org/fred/series/observations';
  const resp = await axios.get(url, {
    params: {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      observation_start: startDate,
      sort_order: 'asc',
    },
    timeout: 30000,
  });

  const obs: Array<{ date: string; value: string }> = resp.data.observations ?? [];
  return obs
    .filter(o => o.value !== '.' && o.value !== '' && o.value != null)
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .filter(o => !isNaN(o.value));
}

async function upsertMetricTimeSeries(
  pool: ReturnType<typeof getPool>,
  spec: FREDSeriesSpec,
  observations: Array<{ date: string; value: number }>,
  dryRun: boolean,
): Promise<number> {
  if (observations.length === 0) return 0;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < observations.length; i += BATCH_SIZE) {
    const batch = observations.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];

    batch.forEach((obs, idx) => {
      const o = idx * 9;
      placeholders.push(
        `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9})`
      );
      values.push(
        spec.metricId, spec.geographyType, spec.geographyId,
        spec.geographyName, obs.date, spec.periodType,
        obs.value, spec.source, 0.9,
      );
    });

    if (!dryRun) {
      await pool.query(
        `INSERT INTO metric_time_series
           (metric_id, geography_type, geography_id, geography_name,
            period_date, period_type, value, source, confidence)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (metric_id, geography_type, geography_id, period_date)
         DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source`,
        values,
      );
    }
    inserted += batch.length;
  }

  return inserted;
}

// ─── market_vitals benchmark seeder ─────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

async function seedMarketVitals(
  pool: ReturnType<typeof getPool>,
  dryRun: boolean,
): Promise<number> {
  let inserted = 0;
  let skipped = 0;

  for (const cal of MARKET_CALIBRATIONS) {
    for (const bm of NATIONAL_BENCHMARKS) {
      const rentGrowthYoy  = +(bm.rentGrowthYoy  + cal.rentGrowthDelta).toFixed(2);
      const occupancyRate  = +clamp(bm.occupancyRate  + cal.occupancyDelta, 85, 99.5).toFixed(2);
      const vacancyRate    = +clamp(100 - occupancyRate, 0.5, 15).toFixed(2);
      const avgRentPerUnit = +(bm.avgRentPerUnit * cal.rentMultiplier).toFixed(0);
      const popGrowthYoy   = +(bm.popGrowthYoy   + cal.popGrowthDelta).toFixed(2);
      const jobGrowthYoy   = +(bm.jobGrowthYoy   + cal.jobGrowthDelta).toFixed(2);

      const jedi = Math.round(
        Math.min(100, Math.max(0, 50 + rentGrowthYoy * 2)) * 0.25 +
        Math.min(100, Math.max(0, 100 - vacancyRate * 8))  * 0.20 +
        Math.min(100, Math.max(0, 50 + jobGrowthYoy * 10)) * 0.20 +
        Math.min(100, Math.max(0, 50 + popGrowthYoy * 15)) * 0.15 +
        Math.min(100, Math.max(0, occupancyRate))           * 0.20,
      );
      const jediRating = jedi >= 80 ? 'Strong Buy' : jedi >= 60 ? 'Buy' : jedi >= 40 ? 'Hold' : 'Sell';

      if (dryRun) {
        inserted++;
        continue;
      }

      const result = await pool.query(
        `INSERT INTO market_vitals
           (market_id, date, avg_rent_per_unit, rent_growth_yoy, jedi_score, jedi_rating,
            occupancy_rate, vacancy_rate, population_growth_yoy, job_growth_yoy,
            absorption_rate, new_supply_units, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (market_id, date) DO NOTHING`,
        [
          cal.id, bm.date,
          avgRentPerUnit, rentGrowthYoy, jedi, jediRating,
          occupancyRate, vacancyRate,
          popGrowthYoy, jobGrowthYoy,
          Math.round(bm.absorptionRate / MARKET_CALIBRATIONS.length),
          Math.round(bm.newSupplyUnits / MARKET_CALIBRATIONS.length),
          'benchmark_seed_v1',
        ],
      );

      if ((result.rowCount ?? 0) > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
  }

  logger.info(`market_vitals seeding: ${inserted} inserted, ${skipped} skipped (already had live data)`);
  return inserted;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const pool = getPool();
  const summary: Record<string, number> = {};

  console.log('=== Archive Depth Seeding — Gap 3 ===');
  console.log(`DRY_RUN=${DRY_RUN}  SKIP_FRED=${SKIP_FRED}  SKIP_BENCHMARKS=${SKIP_BENCHMARKS}`);
  console.log(`START_DATE=${START_DATE}\n`);

  // ── Part 1: FRED CRE-adjacent series → metric_time_series ────────────────
  if (!SKIP_FRED) {
    if (!FRED_API_KEY) {
      console.warn('FRED_API_KEY not set — skipping FRED metric_time_series seeding');
    } else {
      console.log(`Seeding ${CRE_FRED_SERIES.length} CRE-adjacent FRED series...`);

      for (const spec of CRE_FRED_SERIES) {
        try {
          process.stdout.write(`  ${spec.seriesId} (${spec.metricId})... `);
          const observations = await fetchFredSeries(FRED_API_KEY, spec.seriesId, START_DATE);
          const rows = await upsertMetricTimeSeries(pool, spec, observations, DRY_RUN);
          console.log(`${rows} rows`);
          summary[spec.seriesId] = rows;
          // Respect FRED rate limit (120 req/min)
          await new Promise(r => setTimeout(r, 600));
        } catch (err: any) {
          console.error(`  ERROR ${spec.seriesId}: ${err?.message}`);
          summary[spec.seriesId] = -1;
        }
      }
    }
  }

  // ── Part 2: market_vitals benchmark seeding ───────────────────────────────
  if (!SKIP_BENCHMARKS) {
    const totalRows = MARKET_CALIBRATIONS.length * NATIONAL_BENCHMARKS.length;
    console.log(
      `\nSeeding market_vitals: ${MARKET_CALIBRATIONS.length} markets × ` +
      `${NATIONAL_BENCHMARKS.length} quarters = ${totalRows} rows...`
    );

    const vitalsInserted = await seedMarketVitals(pool, DRY_RUN);
    summary['market_vitals'] = vitalsInserted;
    console.log(`  ${vitalsInserted} rows inserted (${totalRows - vitalsInserted} skipped — existing live data preserved)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  for (const [key, count] of Object.entries(summary)) {
    const status = count < 0 ? 'ERROR' : count === 0 ? 'skipped' : `${count} rows`;
    console.log(`  ${key.padEnd(30)} ${status}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed.');
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
