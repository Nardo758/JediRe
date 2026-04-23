/**
 * Census ACS Demographics Ingest
 *
 * Fetches American Community Survey (ACS) 5-year estimates for all MSAs
 * in the database and updates the `msas` table with real demographic values.
 *
 * Variables pulled:
 *   B01003_001E — Total population
 *   B19013_001E — Median household income (past 12 months, inflation-adjusted)
 *   B25064_001E — Median gross rent
 *
 * No API key required for small request counts, but the env var CENSUS_API_KEY
 * can be set to raise the rate limit.
 *
 * Run annually or after a new MSA is added.
 * Cron: 0 6 1 1 * (1st of January at 06:00)
 */

import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import axios from 'axios';

const pool = getPool();

const ACS_BASE = 'https://api.census.gov/data';
const ACS_VINTAGE = '2022'; // Latest published ACS 5-year vintage as of 2026

interface ACSRow {
  cbsaCode: string;
  population: number | null;
  medianHouseholdIncome: number | null;
  medianGrossRent: number | null;
}

async function fetchACSForCBSAs(cbsaCodes: string[]): Promise<ACSRow[]> {
  const apiKey = process.env.CENSUS_API_KEY;

  const variables = [
    'B01003_001E', // total population
    'B19013_001E', // median HHI
    'B25064_001E', // median gross rent
  ].join(',');

  // Census allows comma-separated CBSA codes in the geo filter
  const cbsaList = cbsaCodes.join(',');
  const url = `${ACS_BASE}/${ACS_VINTAGE}/acs/acs5`;
  const params: Record<string, string> = {
    get: variables,
    for: `metropolitan statistical area/micropolitan statistical area:${cbsaList}`,
  };
  if (apiKey) params.key = apiKey;

  const response = await axios.get(url, { params, timeout: 30000 });
  const rows: string[][] = response.data;

  if (!Array.isArray(rows) || rows.length < 2) return [];

  // First row is headers; rest are data rows
  const [headers, ...dataRows] = rows;
  const colIdx = (name: string) => headers.indexOf(name);
  const popIdx   = colIdx('B01003_001E');
  const hhiIdx   = colIdx('B19013_001E');
  const rentIdx  = colIdx('B25064_001E');
  const geoIdx   = colIdx('metropolitan statistical area/micropolitan statistical area');

  return dataRows.map(row => {
    const parseNum = (v: string) => {
      const n = parseFloat(v);
      return isNaN(n) || n < 0 ? null : n;
    };
    return {
      cbsaCode: row[geoIdx],
      population: parseNum(row[popIdx]),
      medianHouseholdIncome: parseNum(row[hhiIdx]),
      medianGrossRent: parseNum(row[rentIdx]),
    };
  });
}

async function main() {
  const snapshotDate = new Date().toISOString().split('T')[0];

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Census ACS Demographics Ingest - ${snapshotDate}`);
  console.log(`ACS vintage: ${ACS_VINTAGE}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  const msaResult = await pool.query<{ id: number; name: string; cbsa_code: string }>(
    `SELECT id, name, cbsa_code FROM msas WHERE cbsa_code IS NOT NULL ORDER BY id`
  );

  if (msaResult.rows.length === 0) {
    console.log('⚠️  No MSAs found. Exiting.');
    return;
  }

  console.log(`📍 ${msaResult.rows.length} MSA(s) to update:`);
  msaResult.rows.forEach(m => console.log(`   · ${m.name} (CBSA ${m.cbsa_code})`));
  console.log('');

  const cbsaCodes = msaResult.rows.map(m => m.cbsa_code);

  console.log('📊 Fetching ACS 5-year estimates from Census API...');
  let acsRows: ACSRow[] = [];
  try {
    acsRows = await fetchACSForCBSAs(cbsaCodes);
    console.log(`   ✓ Received data for ${acsRows.length} MSA(s)\n`);
  } catch (err: any) {
    console.error('❌ Census ACS fetch failed:', err.message);
    await pool.end();
    process.exit(1);
  }

  const byCode = new Map(acsRows.map(r => [r.cbsaCode, r]));

  let updated = 0;
  let skipped = 0;

  for (const msa of msaResult.rows) {
    const acs = byCode.get(msa.cbsa_code);
    if (!acs) {
      console.log(`  ⚠️  ${msa.name}: no ACS data returned — skipping`);
      skipped++;
      continue;
    }

    await pool.query(
      `UPDATE msas
         SET population              = COALESCE($1, population),
             median_household_income = COALESCE($2, median_household_income),
             updated_at              = NOW()
       WHERE id = $3`,
      [acs.population, acs.medianHouseholdIncome, msa.id]
    );

    console.log(`  ✓ ${msa.name}`);
    if (acs.population != null)            console.log(`       Population:       ${acs.population.toLocaleString()}`);
    if (acs.medianHouseholdIncome != null) console.log(`       Median HHI:       $${acs.medianHouseholdIncome.toLocaleString()}`);
    if (acs.medianGrossRent != null)       console.log(`       Median Gross Rent: $${acs.medianGrossRent.toLocaleString()}/mo`);
    updated++;
  }

  console.log(`\n✅ ACS demographics ingest complete`);
  console.log(`   Updated: ${updated}  |  Skipped: ${skipped}`);

  await pool.end();
}

main().catch(async err => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
