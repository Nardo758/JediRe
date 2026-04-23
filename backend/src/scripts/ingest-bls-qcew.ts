/**
 * BLS QCEW Flat-File Ingest
 *
 * Downloads annual QCEW (Quarterly Census of Employment and Wages) CSV files
 * for each MSA from the BLS flat-file API and back-fills avg_weekly_wage and
 * establishment_count into `msa_economic_snapshot` rows that were previously
 * NULL (the BLS timeseries API does not expose MSA-level QCEW).
 *
 * QCEW area code convention:
 *   C + first 4 digits of 5-digit CBSA code
 *   e.g., Atlanta 12060 → C1206, Charlotte 16740 → C1674
 *
 * NAICS → CES Supersector mapping used in msa_economic_snapshot.naics_code:
 *   00 → Total Nonfarm (QCEW: own_code=0, industry_code="10", agglvl=40)
 *   20 → Construction  (industry_code "23")
 *   30 → Manufacturing (industry_code "31-33")
 *   40 → Trade, Transportation & Utilities (industry_code "48-49" + "42" + "44-45")
 *   50 → Information   (industry_code "51")
 *   55 → Financial Activities (industry_code "52" + "53")
 *   60 → Professional & Business Services (industry_code "54" + "55" + "56")
 *   65 → Education & Health Services (industry_code "61" + "62")
 *   70 → Leisure & Hospitality (industry_code "71" + "72")
 *   90 → Government (own_code "1" + "2" + "3")
 *
 * Run annually after new annual data is published (~September of following year).
 * Cron: 0 7 15 9 * (Sept 15 at 07:00)
 */

import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const pool = getPool();

const QCEW_BASE = 'https://data.bls.gov/cew/data/api';

// Maps our stored naics_code (CES supersector strings) to QCEW industry_code
// strings that appear in the QCEW CSV. Rows where own_code=5 (private) are
// preferred; own_code=0 is used for total nonfarm.
const NAICS_TO_QCEW: Array<{
  naics: string;
  label: string;
  industryCodes: string[];  // QCEW industry_code values
  ownCode: string;          // '0' all, '5' private, '1|2|3' gov
}> = [
  { naics: '00', label: 'Total Nonfarm',                        industryCodes: ['10'],                       ownCode: '0' },
  { naics: '20', label: 'Construction',                          industryCodes: ['23'],                       ownCode: '5' },
  { naics: '30', label: 'Manufacturing',                         industryCodes: ['31-33'],                    ownCode: '5' },
  { naics: '40', label: 'Trade, Transportation & Utilities',    industryCodes: ['42', '44-45', '48-49'],     ownCode: '5' },
  { naics: '50', label: 'Information',                           industryCodes: ['51'],                       ownCode: '5' },
  { naics: '55', label: 'Financial Activities',                  industryCodes: ['52', '53'],                 ownCode: '5' },
  { naics: '60', label: 'Professional & Business Services',     industryCodes: ['54', '55', '56'],           ownCode: '5' },
  { naics: '65', label: 'Education & Health Services',          industryCodes: ['61', '62'],                 ownCode: '5' },
  { naics: '70', label: 'Leisure & Hospitality',                industryCodes: ['71', '72'],                 ownCode: '5' },
];

type QCEWRow = Record<string, string>;

function cbsaToAreaCode(cbsaCode: string): string {
  // QCEW uses C + first 4 digits of 5-digit CBSA
  return `C${cbsaCode.slice(0, 4)}`;
}

async function fetchQCEW(areaCode: string, year: number): Promise<QCEWRow[]> {
  const url = `${QCEW_BASE}/${year}/a/area/${areaCode}.csv`;
  const response = await axios.get(url, { responseType: 'text', timeout: 30000 });
  if (typeof response.data !== 'string' || response.data.startsWith('<html>')) {
    throw new Error(`QCEW response was not CSV (possible 404) for ${areaCode} ${year}`);
  }
  const rows: QCEWRow[] = parse(response.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });
  return rows;
}

/**
 * Given a list of QCEW rows, sum up the values for the specified
 * (industry_code, own_code) targets and return a weighted average
 * weekly wage and total establishment count.
 */
function extractSectorData(
  rows: QCEWRow[],
  industryCodes: string[],
  ownCode: string
): { avgWeeklyWage: number | null; establishmentCount: number | null } {
  const matches = rows.filter(
    r =>
      industryCodes.includes((r.industry_code ?? '').trim().replace(/"/g, '')) &&
      (r.own_code ?? '').trim().replace(/"/g, '') === ownCode
  );
  if (matches.length === 0) return { avgWeeklyWage: null, establishmentCount: null };

  let totalWageWeighted = 0;
  let totalEmpl = 0;
  let totalEstabs = 0;

  for (const m of matches) {
    const empl  = parseInt((m.annual_avg_emplvl  ?? '0').replace(/"/g, '')) || 0;
    const wage  = parseInt((m.annual_avg_wkly_wage ?? '0').replace(/"/g, '')) || 0;
    const estabs = parseInt((m.annual_avg_estabs ?? '0').replace(/"/g, '')) || 0;
    totalWageWeighted += wage * empl;
    totalEmpl += empl;
    totalEstabs += estabs;
  }

  const avgWeeklyWage = totalEmpl > 0 ? Math.round(totalWageWeighted / totalEmpl) : null;
  return {
    avgWeeklyWage: avgWeeklyWage ?? null,
    establishmentCount: totalEstabs > 0 ? totalEstabs : null,
  };
}

async function main() {
  const snapshotDate = new Date().toISOString().split('T')[0];
  // QCEW annual data is published ~Sept of the following year; use year-2 as safe default
  const year = new Date().getFullYear() - 2; // 2024 from 2026

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`BLS QCEW Flat-File Ingest - ${snapshotDate}`);
  console.log(`QCEW data year: ${year}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  const msaResult = await pool.query<{ id: number; name: string; cbsa_code: string }>(
    `SELECT id, name, cbsa_code FROM msas WHERE cbsa_code IS NOT NULL ORDER BY id`
  );

  if (msaResult.rows.length === 0) {
    console.log('⚠️  No MSAs found. Exiting.');
    await pool.end();
    return;
  }

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const msa of msaResult.rows) {
    const areaCode = cbsaToAreaCode(msa.cbsa_code);
    console.log(`\n  → ${msa.name} (CBSA: ${msa.cbsa_code}, QCEW area: ${areaCode})`);

    let rows: QCEWRow[] = [];
    try {
      rows = await fetchQCEW(areaCode, year);
      console.log(`     ✓ Downloaded ${rows.length} QCEW rows`);
    } catch (err: any) {
      // Try year - 1 as fallback
      try {
        rows = await fetchQCEW(areaCode, year - 1);
        console.log(`     ✓ Downloaded ${rows.length} QCEW rows (fallback year ${year - 1})`);
      } catch (err2: any) {
        console.log(`     ❌ QCEW fetch failed for both ${year} and ${year - 1}: ${err.message}`);
        totalErrors++;
        continue;
      }
    }

    // Find the most recent snapshot_date for this MSA so we update existing rows
    const latestSnap = await pool.query<{ snapshot_date: string }>(
      `SELECT snapshot_date FROM msa_economic_snapshot
         WHERE msa_id = $1
         ORDER BY snapshot_date DESC
         LIMIT 1`,
      [msa.id]
    );
    const targetDate = latestSnap.rows[0]?.snapshot_date ?? snapshotDate;

    for (const sector of NAICS_TO_QCEW) {
      const { avgWeeklyWage, establishmentCount } = extractSectorData(
        rows,
        sector.industryCodes,
        sector.ownCode
      );
      if (avgWeeklyWage === null && establishmentCount === null) continue;

      // Update existing snapshot row (or skip if not found — ingest-msa-economic-data must run first)
      const result = await pool.query(
        `UPDATE msa_economic_snapshot
            SET avg_weekly_wage    = COALESCE($1, avg_weekly_wage),
                establishment_count = COALESCE($2, establishment_count)
          WHERE msa_id = $3
            AND naics_code = $4
            AND snapshot_date = $5`,
        [avgWeeklyWage, establishmentCount, msa.id, sector.naics, targetDate]
      );

      if (result.rowCount && result.rowCount > 0) {
        const parts = [];
        if (avgWeeklyWage)      parts.push(`$${avgWeeklyWage.toLocaleString()}/wk avg wage`);
        if (establishmentCount) parts.push(`${establishmentCount.toLocaleString()} estabs`);
        console.log(`     · ${sector.label}: ${parts.join(', ')}`);
        totalUpdated++;
      }
    }
  }

  console.log(`\n✅ QCEW ingest complete`);
  console.log(`   Rows updated: ${totalUpdated}  |  MSA errors: ${totalErrors}`);

  await pool.end();
}

main().catch(async err => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
