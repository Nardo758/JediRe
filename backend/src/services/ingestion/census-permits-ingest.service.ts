import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface IngestResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

/**
 * Census Building Permits Ingest Service
 *
 * Fetches Building Permits Survey (BPS) data from the Census Bureau API
 * and stores it in metric_time_series for use by the correlation engine.
 *
 * COR-08 (permits → cap rate) requires 60 months of history with an
 * 18-30 month lag. This is the second-highest-impact missing data series.
 *
 * Data types stored:
 *   - bps_total_units          (total residential units permitted)
 *   - bps_units_5_plus         (multifamily units: 5+ units)
 *   - bps_units_1_unit         (single-family units)
 *   - bps_units_2_to_4       (2-4 unit structures)
 *   - bps_structure_count      (total structures permitted)
 *
 * Geography levels: state, county, MSA
 *
 * Backfillable: 10+ years of history available from Census API.
 */

interface PermitVariable {
  metricId: string;
  variable: string;
  label: string;
}

// Census BPS variables for residential building permits
// Source: https://api.census.gov/data/construction/bps/variables.html
const PERMIT_VARIABLES: PermitVariable[] = [
  { metricId: 'bps_total_units', variable: 'TOTAL_UNITS', label: 'Total Units' },
  { metricId: 'bps_units_1_unit', variable: 'UNIT1', label: '1-Unit Structures' },
  { metricId: 'bps_units_2_to_4', variable: 'UNIT2', label: '2-Unit Structures' },
  { metricId: 'bps_units_3_to_4', variable: 'UNIT3', label: '3-4 Unit Structures' },
  { metricId: 'bps_units_5_plus', variable: 'UNIT5', label: '5+ Unit Structures' },
  { metricId: 'bps_structure_count', variable: 'STRUCTURE', label: 'Total Structures' },
];

interface GeographyMapping {
  censusGeoId: string;    // Census geography ID (e.g., '12' for FL, '12060' for Atlanta MSA)
  geographyType: 'state' | 'msa' | 'county';
  geographyId: string;    // Our internal ID
  geographyName: string;
}

/**
 * Main entry point: ingest Census Building Permits data.
 *
 * @param apiKey Census API key (optional, falls back to CENSUS_API_KEY env var)
 * @param opts.yearRange {startYear, endYear} for backfill
 * @param opts.dryRun preview without writing
 * @param opts.geographies specific geographies to ingest
 */
export async function ingestCensusPermits(
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

  const key = apiKey || process.env.CENSUS_API_KEY || '';
  if (!key) {
    throw new Error('Census API key is required (CENSUS_API_KEY env var or apiKey param)');
  }

  const targetYear = new Date().getFullYear() - 1;
  const startYear = opts.yearRange?.startYear || targetYear - 9; // 10 years default
  const endYear = opts.yearRange?.endYear || targetYear;

  logger.info('Census Permits: starting ingestion', {
    startYear,
    endYear,
    dryRun: opts.dryRun,
  });

  // Get geography mappings
  const geographies = opts.geographies || await loadGeographyMappings();
  const countiesProcessed = geographies.length;

  for (const geo of geographies) {
    try {
      for (let year = startYear; year <= endYear; year++) {
        for (const variable of PERMIT_VARIABLES) {
          try {
            const value = await fetchPermitValue(key, year, geo, variable.variable);
            if (value == null) continue;

            if (!opts.dryRun) {
              await storePermitMetric(geo, variable.metricId, value, year, variable.variable);
            }
            rowsInserted++;
          } catch (err) {
            logger.warn('Census Permits: variable failed', {
              year,
              geography: geo.geographyName,
              variable: variable.variable,
              error: (err as Error).message,
            });
          }
        }
      }
    } catch (err) {
      const msg = `Census Permits failed for ${geo.geographyName}: ${(err as Error).message}`;
      logger.error(msg);
      errors.push(msg);
    }
  }

  const endTime = new Date();
  const elapsed = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

  logger.info('Census Permits: complete', {
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

async function fetchPermitValue(
  apiKey: string,
  year: number,
  geo: GeographyMapping,
  variable: string
): Promise<number | null> {
  try {
    // Census BPS API endpoint
    // For MSA: https://api.census.gov/data/{year}/construc/bps/msa
    // For state: https://api.census.gov/data/{year}/construc/bps/st
    // For county: https://api.census.gov/data/{year}/construc/bps/county

    const geoType = geo.geographyType === 'msa' ? 'msa' : geo.geographyType === 'state' ? 'st' : 'county';
    const url = `https://api.census.gov/data/${year}/construc/bps/${geoType}`;

    const params: Record<string, string> = {
      get: `NAME,${variable}`,
      key: apiKey,
    };

    if (geo.geographyType === 'msa') {
      params['for'] = `metropolitan statistical area/micropolitan statistical area:${geo.censusGeoId}`;
    } else if (geo.geographyType === 'state') {
      params['for'] = `state:${geo.censusGeoId}`;
    } else if (geo.geographyType === 'county') {
      // County FIPS format: state(2) + county(3)
      params['for'] = `county:${geo.censusGeoId.slice(-3)}&in=state:${geo.censusGeoId.slice(0, 2)}`;
    }

    const response = await axios.get(url, { params, timeout: 30000 });

    if (!response.data || response.data.length < 2) {
      return null;
    }

    // Census API returns: [["NAME", "UNIT5", "MSA"], ["Atlanta...", "1234", "12060"], ...]
    const headers = response.data[0];
    const valueIndex = headers.indexOf(variable);
    if (valueIndex === -1) return null;

    // Sum all values (there may be multiple rows per geography)
    let total = 0;
    for (let i = 1; i < response.data.length; i++) {
      const row = response.data[i];
      const val = parseFloat(row[valueIndex]);
      if (!isNaN(val)) total += val;
    }

    return total > 0 ? total : null;
  } catch (err) {
    logger.warn('Census Permits: fetch failed', {
      year,
      geography: geo.geographyName,
      variable,
      error: (err as Error).message,
    });
    return null;
  }
}

async function storePermitMetric(
  geo: GeographyMapping,
  metricId: string,
  value: number,
  year: number,
  sourceVariable: string
): Promise<void> {
  // Census BPS is annual data, so we use Dec 1st of the year
  const periodDate = `${year}-12-01`;

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
      `Census BPS ${sourceVariable} ${year}`,
    ]
  );
}

// ─── Geography mapping helpers ───────────────────────────────────────────────

async function loadGeographyMappings(): Promise<GeographyMapping[]> {
  const mappings: GeographyMapping[] = [];

  // States from our database
  try {
    const states = await query(`
      SELECT DISTINCT state_code, state_name
      FROM submarkets
      WHERE state_code IS NOT NULL
    `);

    for (const row of states.rows) {
      const stateCode = row.state_code;
      const fips = stateFipsToCensus[stateCode];
      if (fips) {
        mappings.push({
          censusGeoId: fips,
          geographyType: 'state',
          geographyId: stateCode,
          geographyName: row.state_name || stateCode,
        });
      }
    }
  } catch (err) {
    logger.warn('Census Permits: failed to load state mappings', { error: (err as Error).message });
  }

  // MSAs from our database
  try {
    const msas = await query(`
      SELECT DISTINCT msa_id, msa_name
      FROM submarkets
      WHERE msa_id IS NOT NULL
    `);

    for (const row of msas.rows) {
      const msaId = row.msa_id;
      // Census MSA codes are the same as our msa_id (e.g., 12060)
      mappings.push({
        censusGeoId: msaId,
        geographyType: 'msa',
        geographyId: msaId,
        geographyName: row.msa_name || msaId,
      });
    }
  } catch (err) {
    logger.warn('Census Permits: failed to load MSA mappings', { error: (err as Error).message });
  }

  return mappings;
}

// State code to Census FIPS code (2-digit)
const stateFipsToCensus: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06',
  CO: '08', CT: '09', DE: '10', DC: '11', FL: '12',
  GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23',
  MD: '24', MA: '25', MI: '26', MN: '27', MS: '28',
  MO: '29', MT: '30', NE: '31', NV: '32', NH: '33',
  NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
  VT: '50', VA: '51', WA: '53', WV: '54', WI: '55',
  WY: '56',
};

export { loadGeographyMappings };
