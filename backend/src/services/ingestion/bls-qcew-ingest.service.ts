import { BLSApiClient, BLS_NAICS_MAP } from '../../utils/bls-api.client';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { IngestResult } from './bls-ingest.service';

/**
 * BLS QCEW Ingest Service
 *
 * Fetches Quarterly Census of Employment and Wages (QCEW) data
 * from the Bureau of Labor Statistics API and stores it in
 * metric_time_series for use by the correlation engine.
 *
 * COR-04 (wage growth → rent growth) requires wage data, not just
 * employment counts. This is the critical missing piece for that
 * correlation pairing.
 *
 * Data types stored:
 *   - qcew_employment        (total employment, NAICS 531110)
 *   - qcew_wage_yoy          (average weekly wage YoY change)
 *   - qcew_establishments    (number of establishments)
 *   - qcew_wage_growth       (wage growth rate, calculated)
 *
 * Geography levels: national, state, MSA, county
 *
 * Backfillable: 10 years of history available from BLS API.
 */

interface QCEWConfig {
  naics: string;
  naicsLabel: string;
  measure: '1' | '4' | '5';  // 1=employment, 4=avg weekly wages, 5=establishments
  measureLabel: string;
}

const QCEW_SERIES_CONFIG: QCEWConfig[] = [
  { naics: BLS_NAICS_MAP.APARTMENT.naics, naicsLabel: 'apartment', measure: '1', measureLabel: 'employment' },
  { naics: BLS_NAICS_MAP.APARTMENT.naics, naicsLabel: 'apartment', measure: '4', measureLabel: 'wage' },
  { naics: BLS_NAICS_MAP.APARTMENT.naics, naicsLabel: 'apartment', measure: '5', measureLabel: 'establishments' },
];

interface GeographyMapping {
  blsAreaCode: string;   // 5-digit BLS area code (e.g., 00000 = national, 12000 = FL, 12060 = Atlanta MSA)
  geographyType: 'national' | 'state' | 'msa' | 'county';
  geographyId: string;   // our internal ID (e.g., 'US', 'FL', 'Atlanta-Sandy-Springs-Roswell GA')
  geographyName: string;
  parentMsaId?: string;  // for counties, the MSA they belong to
}

/**
 * Main entry point: ingest BLS QCEW data for all configured geographies.
 *
 * @param apiKey BLS API key (optional, falls back to BLS_API_KEY env var)
 * @param opts.yearRange {startYear, endYear} for backfill
 * @param opts.dryRun preview without writing
 */
export async function ingestBLSQCEW(
  apiKey?: string,
  opts: {
    yearRange?: { startYear: number; endYear: number };
    dryRun?: boolean;
    geographies?: GeographyMapping[];
  } = {}
): Promise<IngestResult> {
  const startTime = new Date();
  const errors: string[] = [];
  let rowsInserted = 0;

  const client = new BLSApiClient(apiKey);
  const targetYear = new Date().getFullYear() - 1; // QCEW lags ~6 months
  const startYear = opts.yearRange?.startYear || targetYear - 9; // 10 years default
  const endYear = opts.yearRange?.endYear || targetYear;

  logger.info('BLS QCEW: starting ingestion', {
    startYear,
    endYear,
    dryRun: opts.dryRun,
  });

  // Get geography mappings from the database
  const geographies = opts.geographies || await loadGeographyMappings();
  const countiesProcessed = geographies.length;

  for (const geo of geographies) {
    try {
      const geoRows = await ingestGeography(client, geo, startYear, endYear, opts.dryRun);
      rowsInserted += geoRows;
    } catch (err) {
      const msg = `BLS QCEW failed for ${geo.geographyName}: ${(err as Error).message}`;
      logger.error(msg);
      errors.push(msg);
    }
  }

  const endTime = new Date();
  const elapsed = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

  logger.info('BLS QCEW: complete', {
    countiesProcessed,
    rowsInserted,
    errors: errors.length,
    elapsed: `${elapsed}s`,
  });

  return {
    countiesProcessed,
    rowsInserted,
    errors,
    startTime,
    endTime,
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function ingestGeography(
  client: BLSApiClient,
  geo: GeographyMapping,
  startYear: number,
  endYear: number,
  dryRun?: boolean
): Promise<number> {
  let rowsInserted = 0;

  for (const config of QCEW_SERIES_CONFIG) {
    try {
      const seriesId = buildQCEWSeriesForArea(geo.blsAreaCode, config.naics, config.measure);
      const results = await client.getMultipleSeries([seriesId], startYear, endYear);

      const series = results.find((s) => s.seriesID === seriesId);
      if (!series?.data?.length) {
        logger.warn('BLS QCEW: no data for series', {
          seriesId,
          geography: geo.geographyName,
        });
        continue;
      }

      for (const point of series.data) {
        // Parse period: "A01" = annual, "Q01"-"Q04" = quarterly
        const isAnnual = point.period === 'A01';
        const isQuarterly = point.period.startsWith('Q');
        if (!isAnnual && !isQuarterly) continue;

        const year = parseInt(point.year);
        const quarter = isQuarterly ? parseInt(point.period.replace('Q', '')) : null;

        // Determine period_date for the metric_time_series
        let periodDate: string;
        if (isAnnual) {
          periodDate = `${year}-12-01`; // Annual = Dec 1st of that year
        } else if (quarter) {
          const month = (quarter - 1) * 3 + 1;
          periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
        } else {
          continue;
        }

        const metricId = `qcew_${config.naicsLabel}_${config.measureLabel}`;
        const value = parseFloat(point.value);

        if (isNaN(value)) continue;

        // For wage series, also compute YoY growth
        if (config.measure === '4' && !dryRun) {
          await storeWageWithGrowth(
            geo,
            metricId,
            value,
            year,
            quarter,
            periodDate,
            seriesId
          );
          rowsInserted += 2; // wage + wage_growth
        } else if (!dryRun) {
          await storeMetric(geo, metricId, value, periodDate, seriesId);
          rowsInserted++;
        }
      }
    } catch (err) {
      logger.warn('BLS QCEW: series failed', {
        geography: geo.geographyName,
        measure: config.measureLabel,
        error: (err as Error).message,
      });
    }
  }

  return rowsInserted;
}

async function storeMetric(
  geo: GeographyMapping,
  metricId: string,
  value: number,
  periodDate: string,
  sourceSeriesId: string
): Promise<void> {
  await query(
    `INSERT INTO metric_time_series (
      metric_id, geography_type, geography_id, period_date, value,
      data_source, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (metric_id, geography_type, geography_id, period_date)
    DO UPDATE SET
      value = EXCLUDED.value,
      data_source = EXCLUDED.data_source,
      updated_at = CURRENT_TIMESTAMP`,
    [
      metricId,
      geo.geographyType,
      geo.geographyId,
      periodDate,
      value,
      `BLS QCEW ${sourceSeriesId}`,
    ]
  );
}

async function storeWageWithGrowth(
  geo: GeographyMapping,
  metricId: string,
  value: number,
  year: number,
  quarter: number | null,
  periodDate: string,
  sourceSeriesId: string
): Promise<void> {
  // Store the raw wage
  await storeMetric(geo, metricId, value, periodDate, sourceSeriesId);

  // Compute YoY growth: compare to same period last year
  const prevYear = year - 1;
  let prevPeriodDate: string;
  if (quarter) {
    const month = (quarter - 1) * 3 + 1;
    prevPeriodDate = `${prevYear}-${String(month).padStart(2, '0')}-01`;
  } else {
    prevPeriodDate = `${prevYear}-12-01`;
  }

  const prevValue = await query(
    `SELECT value FROM metric_time_series
     WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
       AND period_date = $4
     LIMIT 1`,
    [metricId, geo.geographyType, geo.geographyId, prevPeriodDate]
  );

  if (prevValue.rows.length > 0) {
    const prev = parseFloat(prevValue.rows[0].value);
    if (prev > 0) {
      const growth = ((value - prev) / prev) * 100;
      await storeMetric(
        geo,
        `${metricId}_growth`,
        growth,
        periodDate,
        sourceSeriesId
      );
    }
  }
}

// ─── Geography mapping helpers ─────────────────────────────────────────────

async function loadGeographyMappings(): Promise<GeographyMapping[]> {
  const mappings: GeographyMapping[] = [];

  // National
  mappings.push({
    blsAreaCode: '00000',
    geographyType: 'national',
    geographyId: 'US',
    geographyName: 'United States',
  });

  // States from our database
  try {
    const states = await query(`
      SELECT DISTINCT state_code, state_name
      FROM submarkets
      WHERE state_code IS NOT NULL
    `);

    for (const row of states.rows) {
      const stateCode = row.state_code;
      const stateFips = stateFipsMap[stateCode];
      if (stateFips) {
        mappings.push({
          blsAreaCode: stateFips,
          geographyType: 'state',
          geographyId: stateCode,
          geographyName: row.state_name || stateCode,
        });
      }
    }
  } catch (err) {
    logger.warn('BLS QCEW: failed to load state mappings', { error: (err as Error).message });
  }

  // MSAs from our database (we map them to BLS MSA codes)
  try {
    const msas = await query(`
      SELECT DISTINCT msa_id, msa_name
      FROM submarkets
      WHERE msa_id IS NOT NULL
    `);

    for (const row of msas.rows) {
      const msaCode = msaBlsCodeMap[row.msa_id];
      if (msaCode) {
        mappings.push({
          blsAreaCode: msaCode,
          geographyType: 'msa',
          geographyId: row.msa_id,
          geographyName: row.msa_name || row.msa_id,
        });
      }
    }
  } catch (err) {
    logger.warn('BLS QCEW: failed to load MSA mappings', { error: (err as Error).message });
  }

  return mappings;
}

// State FIPS to BLS area code (2-digit state FIPS + 000)
const stateFipsMap: Record<string, string> = {
  AL: '01000', AK: '02000', AZ: '04000', AR: '05000', CA: '06000',
  CO: '08000', CT: '09000', DE: '10000', DC: '11000', FL: '12000',
  GA: '13000', HI: '15000', ID: '16000', IL: '17000', IN: '18000',
  IA: '19000', KS: '20000', KY: '21000', LA: '22000', ME: '23000',
  MD: '24000', MA: '25000', MI: '26000', MN: '27000', MS: '28000',
  MO: '29000', MT: '30000', NE: '31000', NV: '32000', NH: '33000',
  NJ: '34000', NM: '35000', NY: '36000', NC: '37000', ND: '38000',
  OH: '39000', OK: '40000', OR: '41000', PA: '42000', RI: '44000',
  SC: '45000', SD: '46000', TN: '47000', TX: '48000', UT: '49000',
  VT: '50000', VA: '51000', WA: '53000', WV: '54000', WI: '55000',
  WY: '56000',
};

// MSA ID to BLS area code (select major MSAs)
const msaBlsCodeMap: Record<string, string> = {
  '12060': '12060', // Atlanta-Sandy-Springs-Roswell GA
  '47900': '47900', // Washington-Arlington-Alexandria DC-VA-MD-WV
  '16980': '16980', // Chicago-Naperville-Elgin IL-IN-WI
  '19100': '19100', // Dallas-Fort Worth-Arlington TX
  '26420': '26420', // Houston-The Woodlands-Sugar Land TX
  '31080': '31080', // Los Angeles-Long Beach-Anaheim CA
  '33100': '33100', // Miami-Fort Lauderdale-West Palm Beach FL
  '35620': '35620', // New York-Newark-Jersey City NY-NJ-PA
  '37980': '37980', // Philadelphia-Camden-Wilmington PA-NJ-DE-MD
  '41860': '41860', // San Francisco-Oakland-Hayward CA
  '47900': '47900', // Washington-Arlington-Alexandria DC-VA-MD-WV
  // Add more as needed — BLS QCEW has ~400 MSAs
};

// Build QCEW series ID for a specific area code
function buildQCEWSeriesForArea(areaCode: string, naics: string, measure: '1' | '4' | '5'): string {
  // QCEW series format:
  //   ENU + area_fips(5) + size_code(1) + ownership(1) + industry(6) + data_type(2)
  // area: 00000 = national, 12000 = FL, 12060 = Atlanta MSA
  // size: 0 = all sizes
  // ownership: 5 = private
  // data_type: 01 = employment, 04 = avg weekly wages, 05 = establishments
  const paddedNaics = naics.padEnd(6, '0').substring(0, 6);
  const dataType = measure === '1' ? '01' : measure === '4' ? '04' : '05';
  return `ENU${areaCode}05${paddedNaics}${dataType}`;
}

export { buildQCEWSeriesForArea };
