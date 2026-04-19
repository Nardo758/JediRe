/**
 * MSA Economic Data Ingestion Script
 * Pulls BLS QCEW employment/wage data for each MSA in the platform
 * using the cbsa_code already stored in the `msas` table.
 *
 * Run nightly (after M28 rate ingest) via cron: 30 8 * * *
 *
 * Series format: ENU + cbsa_code(5) + ownership(1) + naics(6) + datatype(2)
 *   ownership 5 = private sector
 *   datatype 01 = employment, 04 = avg weekly wages, 05 = establishments
 */
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import { BLSApiClient, BLSSeriesData, BLSDataPoint } from '../utils/bls-api.client';
import { logger } from '../utils/logger';

const pool = getPool();

// 3-digit NAICS codes — broad enough for MSA-level QCEW coverage without suppression
const MSA_NAICS_TARGETS: Array<{ naics: string; label: string }> = [
  { naics: '531',  label: 'Real Estate' },
  { naics: '493',  label: 'Warehousing & Storage' },
  { naics: '721',  label: 'Hotels & Accommodations' },
  { naics: '623',  label: 'Nursing & Residential Care' },
  { naics: '611',  label: 'Educational Services' },
  { naics: '236',  label: 'Construction of Buildings' },
  { naics: '621',  label: 'Ambulatory Health Care' },
  { naics: '522',  label: 'Credit & Lending' },
];

function buildMsaQCEWSeries(cbsaCode: string, naics3: string, measure: '1' | '4' | '5'): string {
  // Zero-pad CBSA code to 5 digits
  const area = cbsaCode.padStart(5, '0');
  // Pad NAICS to 6 digits
  const paddedNaics = naics3.padEnd(6, '0').substring(0, 6);
  const dataType = measure === '1' ? '01' : measure === '4' ? '04' : '05';
  // Ownership 5 = private
  return `ENU${area}5${paddedNaics}${dataType}`;
}

function getLatestAnnual(data: BLSDataPoint[]): BLSDataPoint | null {
  const annuals = data
    .filter(d => d.period === 'A01')
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));
  return annuals[0] || null;
}

function computeYoYChange(data: BLSDataPoint[]): number | null {
  const annuals = data
    .filter(d => d.period === 'A01')
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));
  if (annuals.length < 2) return null;
  const curr = parseFloat(annuals[0].value);
  const prev = parseFloat(annuals[1].value);
  if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(2));
}

async function ingestMsaData() {
  const snapshotDate = new Date().toISOString().split('T')[0];

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`MSA Economic Data Ingestion - ${snapshotDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  const blsClient = new BLSApiClient();

  // Fetch all MSAs with CBSA codes
  const msaResult = await pool.query(
    `SELECT id, name, cbsa_code FROM msas WHERE cbsa_code IS NOT NULL ORDER BY id`
  );

  if (msaResult.rows.length === 0) {
    console.log('⚠️  No MSAs with cbsa_code found. Exiting.');
    return;
  }

  console.log(`📍 Found ${msaResult.rows.length} MSA(s) to process`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const msa of msaResult.rows) {
    console.log(`\n  → ${msa.name} (CBSA: ${msa.cbsa_code})`);

    // Check if today's data already exists for this MSA
    const existing = await pool.query(
      `SELECT COUNT(*) FROM msa_economic_snapshot
       WHERE msa_id = $1 AND snapshot_date = $2`,
      [msa.id, snapshotDate]
    );
    const existingCount = parseInt(existing.rows[0].count);

    if (existingCount >= MSA_NAICS_TARGETS.length) {
      console.log(`     ⏭️  Data already exists. Skipping.`);
      skipped++;
      continue;
    }

    for (const target of MSA_NAICS_TARGETS) {
      try {
        // Build series IDs for employment + wages
        const empSeriesId = buildMsaQCEWSeries(msa.cbsa_code, target.naics, '1');
        const wageSeriesId = buildMsaQCEWSeries(msa.cbsa_code, target.naics, '4');
        const estSeriesId = buildMsaQCEWSeries(msa.cbsa_code, target.naics, '5');

        const seriesArray: BLSSeriesData[] = await blsClient.getMultipleSeries(
          [empSeriesId, wageSeriesId, estSeriesId],
          new Date().getFullYear() - 3,
          new Date().getFullYear()
        );

        const find = (id: string): BLSDataPoint[] =>
          seriesArray.find(s => s.seriesID === id)?.data ?? [];

        const empData = find(empSeriesId);
        const wageData = find(wageSeriesId);
        const estData = find(estSeriesId);

        const latestEmp = getLatestAnnual(empData);
        const latestWage = getLatestAnnual(wageData);
        const latestEst = getLatestAnnual(estData);
        const yoyChange = computeYoYChange(empData);

        // Only store if we got at least employment data
        if (!latestEmp || latestEmp.value === '-' || latestEmp.value === '0') {
          continue;
        }

        const citationYear = latestEmp.year;
        const citationTag = `BLS QCEW ${citationYear}`;

        await pool.query(
          `INSERT INTO msa_economic_snapshot (
            msa_id, snapshot_date, naics_code, naics_label,
            total_employment, yoy_change_pct, avg_weekly_wage,
            establishment_count, bls_citation_tag
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (msa_id, snapshot_date, naics_code) DO UPDATE SET
            total_employment   = EXCLUDED.total_employment,
            yoy_change_pct     = EXCLUDED.yoy_change_pct,
            avg_weekly_wage    = EXCLUDED.avg_weekly_wage,
            establishment_count = EXCLUDED.establishment_count,
            bls_citation_tag   = EXCLUDED.bls_citation_tag`,
          [
            msa.id,
            snapshotDate,
            target.naics,
            target.label,
            latestEmp ? parseFloat(latestEmp.value) : null,
            yoyChange,
            latestWage ? parseFloat(latestWage.value) : null,
            latestEst ? parseInt(latestEst.value) : null,
            citationTag,
          ]
        );

        inserted++;
        console.log(`     ✓ ${target.label}: ${latestEmp.value} workers (${yoyChange !== null ? (yoyChange >= 0 ? '+' : '') + yoyChange + '% YoY' : 'no YoY'})`);

      } catch (err: any) {
        errors++;
        logger.warn(`[MSAIngest] Failed ${msa.name} / ${target.label}`, { error: err.message });
      }
    }
  }

  console.log(`\n✅ MSA Economic Data Ingestion complete`);
  console.log(`   Inserted/updated: ${inserted}  |  Skipped: ${skipped} MSA(s)  |  Errors: ${errors}`);
  console.log('');
}

// Run if called directly (not imported as module)
if (require.main === module) {
  ingestMsaData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });
}

export { ingestMsaData };
