/**
 * MSA Economic Data Ingestion Script
 *
 * Pulls per-MSA monthly economic indicators from BLS:
 *   - CES (SMU): nonfarm payroll employment by supersector
 *   - LAUS (LAUMT): unemployment rate, civilian labor force
 *
 * QCEW (ENU) was tried previously but the BLS public timeseries API does not
 * expose MSA-level QCEW series — every probe returned "Series does not exist".
 * Wages / establishment counts therefore stay NULL until we wire the QCEW
 * flat-file pipeline (separate task).
 *
 * Run nightly via cron: 30 8 * * * (after the M28 rate ingest).
 *
 * SMU series format (20 chars):
 *   SM + adj(U|S) + state(2) + area(5) + supersector(2) + industry(6) + datatype(2)
 *
 * LAUMT series format (20 chars):
 *   LAUMT + state(2) + area(5) + 0000000 + measure(1)
 *     measure: 3=unemployment rate, 4=unemployment, 5=employment, 6=labor force
 */
import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/connection';
import { BLSApiClient, BLSSeriesData, BLSDataPoint } from '../utils/bls-api.client';
import { logger } from '../utils/logger';

const pool = getPool();

// CES supersectors that matter for CRE demand-side analysis.
// "code" goes into naics_code (varchar(6)) — we reuse that column for the
// CES supersector code so the existing UNIQUE (msa_id, snapshot_date, naics_code)
// constraint keeps one row per supersector per snapshot.
const MSA_CES_TARGETS: Array<{ supersector: string; label: string }> = [
  { supersector: '00', label: 'Total Nonfarm' },
  { supersector: '20', label: 'Construction' },
  { supersector: '30', label: 'Manufacturing' },
  { supersector: '40', label: 'Trade, Transportation & Utilities' },
  { supersector: '50', label: 'Information' },
  { supersector: '55', label: 'Financial Activities' },
  { supersector: '60', label: 'Professional & Business Services' },
  { supersector: '65', label: 'Education & Health Services' },
  { supersector: '70', label: 'Leisure & Hospitality' },
  { supersector: '90', label: 'Government' },
];

// CBSA → 2-digit state FIPS for the principal state in the MSA.
// Falls back to scanning the MSA name if not present here.
const CBSA_TO_STATE_FIPS: Record<string, string> = {
  '12060': '13', // Atlanta-Sandy Springs-Roswell, GA
  '33100': '12', // Miami-Fort Lauderdale-WPB, FL
  '36740': '12', // Orlando-Kissimmee-Sanford, FL
  '45300': '12', // Tampa-St Petersburg-Clearwater, FL
  '34980': '47', // Nashville-Davidson, TN
  '16980': '17', // Chicago-Naperville-Elgin, IL
  '19100': '48', // Dallas-Fort Worth-Arlington, TX
  '26420': '48', // Houston-The Woodlands-Sugar Land, TX
  '12420': '48', // Austin-Round Rock-Georgetown, TX
  '38060': '04', // Phoenix-Mesa-Chandler, AZ
  '39580': '37', // Raleigh-Cary, NC
  '16740': '37', // Charlotte-Concord-Gastonia, NC
  '47900': '11', // Washington-Arlington-Alexandria, DC
  '35620': '36', // New York-Newark-Jersey City, NY
  '31080': '06', // Los Angeles-Long Beach-Anaheim, CA
};

const STATE_NAME_TO_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
};

function resolveStateFips(cbsaCode: string, msaName: string): string | null {
  if (CBSA_TO_STATE_FIPS[cbsaCode]) return CBSA_TO_STATE_FIPS[cbsaCode];
  // Last 2-letter state code in the MSA name (e.g., "Atlanta-..., GA")
  const m = msaName.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})?$/);
  if (m && STATE_NAME_TO_FIPS[m[1]]) return STATE_NAME_TO_FIPS[m[1]];
  return null;
}

function buildCESSeries(stateFips: string, cbsaCode: string, supersector: string): string {
  // U = not seasonally adjusted, datatype 01 = all employees (thousands)
  return `SMU${stateFips}${cbsaCode.padStart(5, '0')}${supersector}00000001`;
}

function buildLAUMTUnemploymentRateSeries(stateFips: string, cbsaCode: string): string {
  return `LAUMT${stateFips}${cbsaCode.padStart(5, '0')}00000003`;
}

function getLatestMonthly(data: BLSDataPoint[]): BLSDataPoint | null {
  // Restrict to real calendar months M01..M12 — BLS also publishes M13
  // (annual average) which would skew YoY comparisons.
  const monthly = data
    .filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-' && d.value !== '')
    .sort((a, b) => {
      const ay = parseInt(a.year), by = parseInt(b.year);
      if (by !== ay) return by - ay;
      return parseInt(b.period.slice(1)) - parseInt(a.period.slice(1));
    });
  return monthly[0] || null;
}

/** YoY change between latest monthly point and same month one year prior. */
function computeMonthlyYoY(data: BLSDataPoint[]): number | null {
  const latest = getLatestMonthly(data);
  if (!latest) return null;
  const yearAgo = data.find(
    d => d.period === latest.period && parseInt(d.year) === parseInt(latest.year) - 1
  );
  if (!yearAgo) return null;
  const curr = parseFloat(latest.value);
  const prev = parseFloat(yearAgo.value);
  if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(2));
}

export async function ingestMsaData() {
  const snapshotDate = new Date().toISOString().split('T')[0];

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`MSA Economic Data Ingestion - ${snapshotDate}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  const blsClient = new BLSApiClient();

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
    const stateFips = resolveStateFips(msa.cbsa_code, msa.name);
    if (!stateFips) {
      console.log(`\n  → ${msa.name}: ⚠️  could not resolve state FIPS, skipping`);
      skipped++;
      continue;
    }

    console.log(`\n  → ${msa.name} (CBSA: ${msa.cbsa_code}, State FIPS: ${stateFips})`);

    // Fetch unemployment rate once for this MSA (applies to all supersector rows)
    let unemploymentRate: number | null = null;
    try {
      const urSeries = buildLAUMTUnemploymentRateSeries(stateFips, msa.cbsa_code);
      const [urData] = await blsClient.getMultipleSeries(
        [urSeries],
        new Date().getFullYear() - 1,
        new Date().getFullYear()
      );
      const latestUr = getLatestMonthly(urData?.data ?? []);
      unemploymentRate = latestUr ? parseFloat(latestUr.value) : null;
      if (unemploymentRate != null) {
        console.log(`     · Unemployment rate: ${unemploymentRate}%`);
      }
    } catch (err: any) {
      logger.warn(`[MSAIngest] Failed unemployment fetch ${msa.name}`, { error: err.message });
    }

    // Batch all CES supersector employment series in one BLS call
    const seriesIds = MSA_CES_TARGETS.map(t => buildCESSeries(stateFips, msa.cbsa_code, t.supersector));

    let cesSeries: BLSSeriesData[] = [];
    try {
      cesSeries = await blsClient.getMultipleSeries(
        seriesIds,
        new Date().getFullYear() - 2,
        new Date().getFullYear()
      );
    } catch (err: any) {
      errors++;
      logger.warn(`[MSAIngest] CES batch fetch failed ${msa.name}`, { error: err.message });
      continue;
    }

    for (const target of MSA_CES_TARGETS) {
      const seriesId = buildCESSeries(stateFips, msa.cbsa_code, target.supersector);
      const data = cesSeries.find(s => s.seriesID === seriesId)?.data ?? [];
      const latest = getLatestMonthly(data);

      if (!latest || latest.value === '-' || latest.value === '0') {
        continue;
      }

      const yoyChange = computeMonthlyYoY(data);
      // CES values are in thousands of jobs — convert to absolute employment.
      const employmentLevel = parseFloat(latest.value) * 1000;
      const citationTag = `BLS CES ${latest.year}-${latest.period}`;

      try {
        await pool.query(
          `INSERT INTO msa_economic_snapshot (
            msa_id, snapshot_date, naics_code, naics_label,
            total_employment, yoy_change_pct, avg_weekly_wage,
            establishment_count, local_unemployment_rate, bls_citation_tag
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (msa_id, snapshot_date, naics_code) DO UPDATE SET
            total_employment        = EXCLUDED.total_employment,
            yoy_change_pct          = EXCLUDED.yoy_change_pct,
            local_unemployment_rate = EXCLUDED.local_unemployment_rate,
            bls_citation_tag        = EXCLUDED.bls_citation_tag`,
          [
            msa.id,
            snapshotDate,
            target.supersector,
            target.label,
            employmentLevel,
            yoyChange,
            null,
            null,
            unemploymentRate,
            citationTag,
          ]
        );

        inserted++;
        console.log(
          `     ✓ ${target.label}: ${Math.round(employmentLevel).toLocaleString()} jobs ` +
          `(${yoyChange != null ? (yoyChange >= 0 ? '+' : '') + yoyChange + '% YoY' : 'no YoY'})`
        );
      } catch (err: any) {
        errors++;
        logger.warn(`[MSAIngest] Insert failed ${msa.name} / ${target.label}`, { error: err.message });
      }
    }
  }

  console.log(`\n✅ MSA Economic Data Ingestion complete`);
  console.log(`   Inserted/updated: ${inserted}  |  Skipped: ${skipped} MSA(s)  |  Errors: ${errors}\n`);
}

// Only run as a CLI script — not when imported by the M28 scheduler.
if (require.main === module) {
  ingestMsaData()
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
