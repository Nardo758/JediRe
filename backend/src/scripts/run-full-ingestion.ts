#!/usr/bin/env npx tsx
/**
 * Consolidated Full Ingestion Script
 *
 * Handles all data ingestion in one go with:
 * - Connection retry logic (survives helium DB drops)
 * - Small-batch inserts (no long-running transactions)
 * - Progress reporting
 * - Graceful error isolation per step
 *
 * Usage:
 *   npx tsx backend/src/scripts/run-full-ingestion.ts
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --step=municipalities
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --step=zoning
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --step=fl-benchmarks
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --step=enrichment
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --step=property-zoning
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:password@helium/heliumdb?sslmode=disable';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let pool: Pool;

function createPool(): Pool {
  return new Pool({
    connectionString: DATABASE_URL,
    max: 3,
    min: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 30000,
  });
}

async function queryWithRetry(text: string, params?: any[], retries = MAX_RETRIES): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (err: any) {
      const isConnectionError = [
        'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
        'connection terminated unexpectedly',
        'Connection terminated',
        'timeout expired',
        'server closed the connection unexpectedly',
      ].some(msg => err.message?.includes(msg) || err.code === msg);

      if (isConnectionError && attempt < retries) {
        console.log(`  [retry ${attempt}/${retries}] Connection error: ${err.message.slice(0, 80)}. Waiting ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS * attempt);
        try { await pool.end(); } catch {}
        pool = createPool();
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function elapsed(start: number): string {
  const s = (Date.now() - start) / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

interface StepResult {
  step: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  processed: number;
  errors: number;
  duration: string;
  details: string;
}

const results: StepResult[] = [];

// ─── Step 1: Seed API Municipalities ───────────────────────────────

async function stepSeedMunicipalities(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Seed API Municipalities';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 1: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let processed = 0;
  let errors = 0;

  try {
    let CITY_APIS: Record<string, any>;
    try {
      const mod = await import('../services/municipal-api-connectors');
      CITY_APIS = mod.CITY_APIS;
    } catch (err: any) {
      console.log(`  Skipping: municipal-api-connectors not available (${err.message.slice(0, 60)})`);
      return { step, status: 'skipped', processed: 0, errors: 0, duration: elapsed(start), details: 'Module not available' };
    }

    const cityIds = Object.keys(CITY_APIS);
    console.log(`  Found ${cityIds.length} API-enabled municipalities`);

    for (const cityId of cityIds) {
      try {
        const config = CITY_APIS[cityId];
        const county = cityId.includes('county')
          ? config.name.replace(' County', '')
          : config.name;

        await queryWithRetry(
          `INSERT INTO municipalities (id, name, state, county, has_api, api_type, api_url, data_quality)
           VALUES ($1, $2, $3, $4, TRUE, $5, $6, 'excellent')
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, has_api = TRUE,
             api_type = EXCLUDED.api_type, api_url = EXCLUDED.api_url,
             data_quality = 'excellent'`,
          [cityId, config.name, config.state, county, config.type || 'arcgis', config.url || '']
        );
        processed++;
      } catch (err: any) {
        console.log(`  Error seeding ${cityId}: ${err.message.slice(0, 80)}`);
        errors++;
      }
    }

    console.log(`  Done: ${processed} seeded, ${errors} errors (${elapsed(start)})`);
    return { step, status: errors > 0 ? 'partial' : 'success', processed, errors, duration: elapsed(start), details: `${processed} municipalities` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed, errors: errors + 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 2: Fetch Zoning Districts from APIs ──────────────────────

async function stepFetchZoningDistricts(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Fetch Zoning Districts';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 2: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let processed = 0;
  let errors = 0;
  let totalDistricts = 0;

  try {
    let fetchZoningData: any, saveAPIDistricts: any, CITY_APIS: Record<string, any>;
    try {
      const mod = await import('../services/municipal-api-connectors');
      fetchZoningData = mod.fetchZoningData;
      saveAPIDistricts = mod.saveAPIDistricts;
      CITY_APIS = mod.CITY_APIS;
    } catch (err: any) {
      console.log(`  Skipping: municipal-api-connectors not available`);
      return { step, status: 'skipped', processed: 0, errors: 0, duration: elapsed(start), details: 'Module not available' };
    }

    const munis = await queryWithRetry(
      `SELECT id, name, state FROM municipalities WHERE has_api = true ORDER BY state, name`
    );
    console.log(`  ${munis.rows.length} municipalities with API access`);

    const existing = await queryWithRetry(
      `SELECT municipality_id, COUNT(*) as cnt FROM zoning_districts GROUP BY municipality_id`
    );
    const existingMap = new Map(existing.rows.map((r: any) => [r.municipality_id, parseInt(r.cnt)]));

    for (const muni of munis.rows) {
      const cityId = muni.id;
      if (!CITY_APIS[cityId]) {
        continue;
      }

      const existCount = existingMap.get(cityId) || 0;
      if (existCount > 0) {
        console.log(`  ${muni.name}, ${muni.state}: already has ${existCount} districts, skipping`);
        processed++;
        continue;
      }

      try {
        console.log(`  Fetching ${muni.name}, ${muni.state}...`);
        const districts = await fetchZoningData(cityId);
        const saved = await saveAPIDistricts(districts);
        totalDistricts += saved;

        await queryWithRetry(
          `UPDATE municipalities SET total_zoning_districts = $1, last_scraped_at = NOW(), data_quality = 'good' WHERE id = $2`,
          [districts.length, cityId]
        );

        console.log(`    ${districts.length} districts found, ${saved} saved`);
        processed++;
        await sleep(500);
      } catch (err: any) {
        console.log(`    Error fetching ${muni.name}: ${err.message.slice(0, 80)}`);
        errors++;
      }
    }

    console.log(`  Done: ${processed} cities processed, ${totalDistricts} new districts, ${errors} errors (${elapsed(start)})`);
    return { step, status: errors > 0 ? 'partial' : 'success', processed, errors, duration: elapsed(start), details: `${totalDistricts} districts from ${processed} cities` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed, errors: errors + 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 3: Florida Benchmark Ingestion ───────────────────────────

async function stepFloridaBenchmarks(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Florida Benchmarks';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 3: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let processed = 0;
  let errors = 0;
  let totalRecords = 0;

  try {
    let service: any;
    try {
      const mod = await import('../services/florida-benchmark-ingestion.service');
      service = mod.floridaBenchmarkIngestionService;
    } catch (err: any) {
      console.log(`  Skipping: florida-benchmark-ingestion.service not available`);
      return { step, status: 'skipped', processed: 0, errors: 0, duration: elapsed(start), details: 'Module not available' };
    }

    const counties = service.getAvailableCounties();
    console.log(`  ${counties.length} Florida counties available`);

    for (const countyId of counties) {
      try {
        console.log(`  Ingesting ${countyId}...`);
        const stats = await service.ingest(countyId);
        totalRecords += stats.recordsUpserted || 0;
        console.log(`    Hearings: ${stats.hearingsFetched}, Permits: ${stats.permitsFetched}, Upserted: ${stats.recordsUpserted}`);
        if (stats.errors.length > 0) {
          console.log(`    ${stats.errors.length} errors`);
          errors += stats.errors.length;
        }
        processed++;
        await sleep(1000);
      } catch (err: any) {
        console.log(`    Error with ${countyId}: ${err.message.slice(0, 80)}`);
        errors++;
      }
    }

    console.log(`  Done: ${processed} counties, ${totalRecords} records upserted, ${errors} errors (${elapsed(start)})`);
    return { step, status: errors > 0 ? 'partial' : 'success', processed, errors, duration: elapsed(start), details: `${totalRecords} records from ${processed} counties` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed, errors: errors + 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 4: Benchmark Enrichment ──────────────────────────────────

async function stepBenchmarkEnrichment(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Benchmark Enrichment';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 4: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let processed = 0;
  let errors = 0;

  try {
    const unenriched = await queryWithRetry(
      `SELECT id, project_name, county, state
       FROM benchmark_projects
       WHERE land_acres IS NULL AND assessed_value IS NULL
       ORDER BY state, county
       LIMIT 200`
    );

    console.log(`  ${unenriched.rows.length} unenriched benchmark projects found`);

    if (unenriched.rows.length === 0) {
      return { step, status: 'success', processed: 0, errors: 0, duration: elapsed(start), details: 'All benchmarks already enriched' };
    }

    let enrichService: any;
    try {
      const mod = await import('../services/benchmark-enrichment.service');
      enrichService = mod.benchmarkEnrichmentService || mod.default;
    } catch (err: any) {
      console.log(`  Skipping: benchmark-enrichment.service not available`);
      return { step, status: 'skipped', processed: 0, errors: 0, duration: elapsed(start), details: 'Module not available' };
    }

    const counties = [...new Set(unenriched.rows.map((r: any) => r.county).filter(Boolean))];
    console.log(`  Counties to enrich: ${counties.join(', ')}`);

    for (const county of counties) {
      try {
        console.log(`  Enriching ${county}...`);
        const result = await enrichService.enrichCounty(county);
        processed += result?.enriched || 0;
        console.log(`    Enriched: ${result?.enriched || 0}`);
        await sleep(500);
      } catch (err: any) {
        console.log(`    Error enriching ${county}: ${err.message.slice(0, 80)}`);
        errors++;
      }
    }

    console.log(`  Done: ${processed} enriched, ${errors} errors (${elapsed(start)})`);
    return { step, status: errors > 0 ? 'partial' : 'success', processed, errors, duration: elapsed(start), details: `${processed} enriched` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed, errors: errors + 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 5: Map Properties to Zoning ──────────────────────────────

async function stepMapPropertiesToZoning(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Map Properties to Zoning';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 5: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let processed = 0;
  let mapped = 0;
  let errors = 0;

  try {
    const deals = await queryWithRetry(
      `SELECT d.id, d.name, d.address, d.city, d.state,
              pzc.zoning_code as existing_code
       FROM deals d
       LEFT JOIN property_zoning_cache pzc ON pzc.deal_id = d.id
       WHERE pzc.deal_id IS NULL
       ORDER BY d.created_at DESC
       LIMIT 500`
    );

    console.log(`  ${deals.rows.length} deals without zoning mapping`);

    for (const deal of deals.rows) {
      try {
        if (!deal.city || !deal.state) {
          processed++;
          continue;
        }

        const cityLower = deal.city.toLowerCase().trim();
        const stateLower = deal.state.toLowerCase().trim();

        const muniResult = await queryWithRetry(
          `SELECT id FROM municipalities WHERE LOWER(name) = $1 AND LOWER(state) = $2 LIMIT 1`,
          [cityLower, stateLower]
        );

        if (muniResult.rows.length === 0) {
          processed++;
          continue;
        }

        const muniId = muniResult.rows[0].id;
        const districtResult = await queryWithRetry(
          `SELECT zoning_code FROM zoning_districts WHERE municipality_id = $1 LIMIT 1`,
          [muniId]
        );

        if (districtResult.rows.length > 0) {
          await queryWithRetry(
            `INSERT INTO property_zoning_cache (id, deal_id, municipality_id, zoning_code, verification_method, verified_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'admin_batch', NOW())
             ON CONFLICT (deal_id) DO UPDATE SET
               municipality_id = $2, zoning_code = $3, verified_at = NOW()`,
            [deal.id, muniId, districtResult.rows[0].zoning_code]
          );
          mapped++;
          console.log(`  Mapped: ${deal.name} -> ${districtResult.rows[0].zoning_code}`);
        }

        processed++;
      } catch (err: any) {
        console.log(`  Error mapping ${deal.name}: ${err.message.slice(0, 80)}`);
        errors++;
      }
    }

    console.log(`  Done: ${processed} processed, ${mapped} mapped, ${errors} errors (${elapsed(start)})`);
    return { step, status: errors > 0 ? 'partial' : 'success', processed, errors, duration: elapsed(start), details: `${mapped} mapped of ${processed} processed` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed, errors: errors + 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 6: Data Quality Cleanup ──────────────────────────────────

async function stepDataQualityCleanup(): Promise<StepResult> {
  const start = Date.now();
  const step = 'Data Quality Cleanup';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STEP 6: ${step}`);
  console.log(`${'═'.repeat(60)}`);

  let fixed = 0;

  try {
    const r1 = await queryWithRetry(
      `DELETE FROM development_scenarios WHERE deal_id NOT IN (SELECT id FROM deals)`
    );
    if ((r1.rowCount || 0) > 0) {
      console.log(`  Removed ${r1.rowCount} orphaned scenarios`);
      fixed += r1.rowCount || 0;
    }

    const r2 = await queryWithRetry(
      `DELETE FROM development_scenarios WHERE name IS NULL AND max_units IS NULL AND max_gba IS NULL AND max_stories IS NULL`
    );
    if ((r2.rowCount || 0) > 0) {
      console.log(`  Removed ${r2.rowCount} empty scenarios`);
      fixed += r2.rowCount || 0;
    }

    try {
      const r3 = await queryWithRetry(
        `DELETE FROM property_boundaries WHERE deal_id NOT IN (SELECT id FROM deals)`
      );
      if ((r3.rowCount || 0) > 0) {
        console.log(`  Removed ${r3.rowCount} orphaned boundaries`);
        fixed += r3.rowCount || 0;
      }
    } catch {}

    const r4 = await queryWithRetry(
      `DELETE FROM zoning_code_interpretations WHERE cached_at < NOW() - INTERVAL '30 days'`
    );
    if ((r4.rowCount || 0) > 0) {
      console.log(`  Cleared ${r4.rowCount} stale cache entries`);
      fixed += r4.rowCount || 0;
    }

    try {
      const r5 = await queryWithRetry(
        `DELETE FROM zoning_ai_analysis_cache WHERE created_at < NOW() - INTERVAL '30 days'`
      );
      if ((r5.rowCount || 0) > 0) {
        console.log(`  Cleared ${r5.rowCount} stale AI cache entries`);
        fixed += r5.rowCount || 0;
      }
    } catch {}

    if (fixed === 0) console.log(`  No issues found`);
    console.log(`  Done: ${fixed} records cleaned (${elapsed(start)})`);
    return { step, status: 'success', processed: fixed, errors: 0, duration: elapsed(start), details: `${fixed} records cleaned` };
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    return { step, status: 'failed', processed: fixed, errors: 1, duration: elapsed(start), details: err.message.slice(0, 100) };
  }
}

// ─── Step 7: Summary Statistics ────────────────────────────────────

async function printSummaryStats(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  DATABASE SUMMARY`);
  console.log(`${'═'.repeat(60)}`);

  try {
    const stats = await queryWithRetry(`
      SELECT
        (SELECT count(*) FROM municipalities) as municipalities,
        (SELECT count(*) FROM municipalities WHERE has_api = true) as api_municipalities,
        (SELECT count(*) FROM zoning_districts) as zoning_districts,
        (SELECT count(*) FROM benchmark_projects) as benchmarks,
        (SELECT count(*) FROM deals) as deals,
        (SELECT count(*) FROM properties) as properties,
        (SELECT count(*) FROM users) as users,
        (SELECT count(*) FROM development_scenarios) as scenarios,
        (SELECT count(*) FROM property_zoning_cache) as zoning_cache
    `);

    const s = stats.rows[0];
    console.log(`  Municipalities:     ${s.municipalities} (${s.api_municipalities} with API)`);
    console.log(`  Zoning Districts:   ${s.zoning_districts}`);
    console.log(`  Benchmark Projects: ${s.benchmarks}`);
    console.log(`  Deals:              ${s.deals}`);
    console.log(`  Properties:         ${s.properties}`);
    console.log(`  Users:              ${s.users}`);
    console.log(`  Scenarios:          ${s.scenarios}`);
    console.log(`  Zoning Cache:       ${s.zoning_cache}`);
  } catch (err: any) {
    console.log(`  Could not fetch stats: ${err.message.slice(0, 80)}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  JediRe Full Data Ingestion`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

  pool = createPool();

  try {
    await queryWithRetry('SELECT 1');
    console.log(`  Database connected successfully`);
  } catch (err: any) {
    console.error(`  FATAL: Cannot connect to database: ${err.message}`);
    process.exit(1);
  }

  const args: Record<string, string> = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--step=')) {
      args.step = arg.split('=')[1];
    }
  });

  const steps: [string, () => Promise<StepResult>][] = [
    ['municipalities', stepSeedMunicipalities],
    ['zoning', stepFetchZoningDistricts],
    ['fl-benchmarks', stepFloridaBenchmarks],
    ['enrichment', stepBenchmarkEnrichment],
    ['property-zoning', stepMapPropertiesToZoning],
    ['cleanup', stepDataQualityCleanup],
  ];

  if (args.step) {
    const match = steps.find(([name]) => name === args.step);
    if (!match) {
      console.error(`  Unknown step: ${args.step}`);
      console.log(`  Available steps: ${steps.map(([n]) => n).join(', ')}`);
      process.exit(1);
    }
    const result = await match[1]();
    results.push(result);
  } else {
    for (const [_name, fn] of steps) {
      const result = await fn();
      results.push(result);
    }
  }

  await printSummaryStats();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  INGESTION RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log('');

  for (const r of results) {
    const icon = r.status === 'success' ? 'OK' : r.status === 'partial' ? 'WARN' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
    console.log(`  [${icon.padEnd(4)}] ${r.step.padEnd(30)} ${r.details} (${r.duration})`);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  console.log(`\n  Total: ${totalProcessed} processed, ${totalErrors} errors`);
  console.log(`  Duration: ${elapsed(totalStart)}`);
  console.log('');

  await pool.end();
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
