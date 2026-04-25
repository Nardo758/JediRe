import axios from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

interface CensusVariable {
  metricId: string;
  variable: string;
  label: string;
  transform?: 'percent' | 'raw';
  denominatorVar?: string;
}

interface CensusGeo {
  geographyId: string;
  geographyName: string;
  msaCode: string;
}

interface IngestionResult {
  variablesProcessed: number;
  rowsInserted: number;
  yearsProcessed: number;
  errors: Array<{ variable: string; year: number; error: string }>;
}

const CENSUS_VARIABLES: CensusVariable[] = [
  { metricId: 'D_POPULATION', variable: 'B01003_001E', label: 'Total Population' },
  { metricId: 'D_MEDIAN_INCOME', variable: 'B19013_001E', label: 'Median Household Income' },
  { metricId: 'D_MEDIAN_AGE', variable: 'B01002_001E', label: 'Median Age' },
  { metricId: 'D_TOTAL_HOUSING_UNITS', variable: 'B25001_001E', label: 'Total Housing Units' },
  { metricId: 'D_RENTER_OCCUPIED', variable: 'B25003_003E', label: 'Renter-Occupied Units' },
  { metricId: 'D_TOTAL_OCCUPIED', variable: 'B25003_001E', label: 'Total Occupied Units' },
  { metricId: 'D_MEDIAN_RENT', variable: 'B25064_001E', label: 'Median Gross Rent' },
  { metricId: 'D_MEDIAN_HOME_VALUE', variable: 'B25077_001E', label: 'Median Home Value' },
  { metricId: 'D_BACHELOR_PLUS', variable: 'B15003_022E', label: "Bachelor's Degree or Higher (25+)" },
  { metricId: 'D_POP_25_PLUS', variable: 'B15003_001E', label: 'Population 25 Years and Over' },
  { metricId: 'D_HOUSEHOLD_COUNT', variable: 'B11001_001E', label: 'Total Households' },
  { metricId: 'D_POVERTY_POP', variable: 'B17001_002E', label: 'Population Below Poverty' },
  { metricId: 'D_TOTAL_POP_POVERTY', variable: 'B17001_001E', label: 'Pop for Poverty Status' },
];

const TARGET_GEOS: CensusGeo[] = [
  { geographyId: 'atlanta-ga-ga', geographyName: 'Atlanta-Sandy Springs-Roswell, GA', msaCode: '12060' },
];

const ACS_YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

export async function ingestCensusACS(apiKey: string): Promise<IngestionResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Census API key is required');
  }

  const result: IngestionResult = {
    variablesProcessed: 0,
    rowsInserted: 0,
    yearsProcessed: 0,
    errors: [],
  };

  const allVarCodes = CENSUS_VARIABLES.map(v => v.variable);
  const uniqueVars = [...new Set(allVarCodes)];
  const varString = uniqueVars.join(',');

  for (const year of ACS_YEARS) {
    for (const geo of TARGET_GEOS) {
      try {
        logger.info(`Fetching Census ACS ${year} for ${geo.geographyName}...`);

        const url = `https://api.census.gov/data/${year}/acs/acs5`;
        const params: Record<string, string> = {
          get: `NAME,${varString}`,
          for: `metropolitan statistical area/micropolitan statistical area:${geo.msaCode}`,
          key: apiKey,
        };

        const response = await axios.get(url, { params, timeout: 30000 });

        if (!response.data || response.data.length < 2) {
          logger.warn(`No Census data for ${year} ${geo.msaCode}`);
          continue;
        }

        const headers: string[] = response.data[0];
        const values: string[] = response.data[1];

        for (const cv of CENSUS_VARIABLES) {
          const colIdx = headers.indexOf(cv.variable);
          if (colIdx === -1) continue;

          const rawVal = values[colIdx];
          if (!rawVal || rawVal === '-' || rawVal === '(X)' || rawVal === 'null') continue;

          const value = parseFloat(rawVal);
          if (isNaN(value) || value < 0) continue;

          const periodDate = `${year}-01-01`;

          await query(
            `INSERT INTO metric_time_series
              (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (metric_id, geography_type, geography_id, period_date)
             DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source`,
            [cv.metricId, 'metro', geo.geographyId, geo.geographyName, periodDate, 'annual', value, 'census_acs5', 0.95]
          );

          result.rowsInserted++;
          result.variablesProcessed++;
        }

        const renterIdx = headers.indexOf('B25003_003E');
        const totalOccIdx = headers.indexOf('B25003_001E');
        if (renterIdx !== -1 && totalOccIdx !== -1) {
          const renter = parseFloat(values[renterIdx]);
          const totalOcc = parseFloat(values[totalOccIdx]);
          if (!isNaN(renter) && !isNaN(totalOcc) && totalOcc > 0) {
            const renterPct = (renter / totalOcc) * 100;
            await query(
              `INSERT INTO metric_time_series
                (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (metric_id, geography_type, geography_id, period_date)
               DO UPDATE SET value = EXCLUDED.value`,
              ['D_RENTER_PCT', 'metro', geo.geographyId, geo.geographyName, `${year}-01-01`, 'annual', renterPct, 'census_acs5', 0.95]
            );
            result.rowsInserted++;
          }
        }

        const bachIdx = headers.indexOf('B15003_022E');
        const pop25Idx = headers.indexOf('B15003_001E');
        if (bachIdx !== -1 && pop25Idx !== -1) {
          const bach = parseFloat(values[bachIdx]);
          const pop25 = parseFloat(values[pop25Idx]);
          if (!isNaN(bach) && !isNaN(pop25) && pop25 > 0) {
            const eduPct = (bach / pop25) * 100;
            await query(
              `INSERT INTO metric_time_series
                (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (metric_id, geography_type, geography_id, period_date)
               DO UPDATE SET value = EXCLUDED.value`,
              ['D_EDUCATION_BACHELOR_PCT', 'metro', geo.geographyId, geo.geographyName, `${year}-01-01`, 'annual', eduPct, 'census_acs5', 0.95]
            );
            result.rowsInserted++;
          }
        }

        const povertyPopIdx = headers.indexOf('B17001_002E');
        const povertyTotalIdx = headers.indexOf('B17001_001E');
        if (povertyPopIdx !== -1 && povertyTotalIdx !== -1) {
          const pov = parseFloat(values[povertyPopIdx]);
          const povTotal = parseFloat(values[povertyTotalIdx]);
          if (!isNaN(pov) && !isNaN(povTotal) && povTotal > 0) {
            const povRate = (pov / povTotal) * 100;
            await query(
              `INSERT INTO metric_time_series
                (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (metric_id, geography_type, geography_id, period_date)
               DO UPDATE SET value = EXCLUDED.value`,
              ['D_POVERTY_RATE', 'metro', geo.geographyId, geo.geographyName, `${year}-01-01`, 'annual', povRate, 'census_acs5', 0.95]
            );
            result.rowsInserted++;
          }
        }

        result.yearsProcessed++;
        logger.info(`Processed Census ACS ${year} for ${geo.geographyName}: inserted data`);

        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        const msg = axios.isAxiosError(error) ? (error.response?.data || error.message) : String(error);
        result.errors.push({ variable: 'all', year, error: String(msg) });
        logger.error(`Census ACS error for ${year} ${geo.msaCode}:`, msg);
      }
    }
  }

  logger.info(`Census ACS ingestion complete:`, {
    variablesProcessed: result.variablesProcessed,
    rowsInserted: result.rowsInserted,
    yearsProcessed: result.yearsProcessed,
    errors: result.errors.length,
  });

  // Update Knowledge Graph
  try {
    const { getKnowledgeGraph } = await import('../neural-network/knowledge-graph.service');
    const { getPool } = await import('../../database/connection');
    const kg = getKnowledgeGraph(getPool());
    await kg.upsertNode({
      type: 'Metric',
      externalId: 'census-acs-data',
      name: 'Census ACS Demographics',
      properties: {
        lastIngestion: new Date(),
        variablesProcessed: result.variablesProcessed,
        rowsInserted: result.rowsInserted,
        source: 'Census ACS',
      }
    });
  } catch (graphErr) { /* Non-fatal */ }

  return result;
}
