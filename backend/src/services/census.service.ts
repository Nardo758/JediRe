import { logger } from '../utils/logger';

const CENSUS_BASE_URL = 'https://api.census.gov/data';
const GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';

interface CensusFIPS {
  state: string;
  county: string;
  tract?: string;
}

interface CensusTractData {
  tractId: string;
  population: number;
  medianIncome: number;
  housingUnits: number;
  medianRent: number;
  state: string;
  county: string;
}

export interface CensusTradeAreaStats {
  population: number;
  medianIncome: number;
  totalHousingUnits: number;
  medianRent: number;
  tractCount: number;
  source: 'census_acs5';
  vintage: string;
}

async function lookupFIPS(lat: number, lng: number): Promise<CensusFIPS | null> {
  try {
    const url = `${GEOCODER_URL}?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const geos = data?.result?.geographies;
    if (!geos) return null;

    const tractInfo = geos['Census Tracts']?.[0];
    const countyInfo = geos['Counties']?.[0];

    if (!countyInfo) return null;

    return {
      state: countyInfo.STATE || tractInfo?.STATE,
      county: countyInfo.COUNTY || tractInfo?.COUNTY,
      tract: tractInfo?.TRACT,
    };
  } catch (err) {
    logger.warn('Census FIPS lookup failed:', err);
    return null;
  }
}

async function fetchTractsForCounty(stateFips: string, countyFips: string): Promise<CensusTractData[]> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) {
    logger.warn('CENSUS_API_KEY not configured');
    return [];
  }

  const variables = [
    'B01003_001E',
    'B19013_001E',
    'B25001_001E',
    'B25064_001E',
  ].join(',');

  const url = `${CENSUS_BASE_URL}/2022/acs/acs5?get=${variables},NAME&for=tract:*&in=state:${stateFips}&in=county:${countyFips}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(`Census API returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const rows: string[][] = await response.json();
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map((row) => ({
      tractId: row[7],
      population: parseInt(row[0]) || 0,
      medianIncome: parseInt(row[1]) || 0,
      housingUnits: parseInt(row[2]) || 0,
      medianRent: parseInt(row[3]) || 0,
      state: row[5],
      county: row[6],
    }));
  } catch (err) {
    logger.warn('Census ACS fetch failed:', err);
    return [];
  }
}

async function fetchTractsForMultipleCounties(
  stateFips: string,
  countyFipsList: string[]
): Promise<CensusTractData[]> {
  const results: CensusTractData[] = [];
  for (const county of countyFipsList) {
    const tracts = await fetchTractsForCounty(stateFips, county);
    results.push(...tracts);
  }
  return results;
}

export async function getCensusStatsForTradeArea(
  centroidLat: number,
  centroidLng: number,
  areaSqMiles: number,
  boundaryCoords?: number[][]
): Promise<CensusTradeAreaStats | null> {
  const fips = await lookupFIPS(centroidLat, centroidLng);
  if (!fips) {
    logger.warn('Could not determine FIPS codes for centroid:', { centroidLat, centroidLng });
    return null;
  }

  const allTracts = await fetchTractsForCounty(fips.state, fips.county);
  if (allTracts.length === 0) return null;

  const countyTotalPop = allTracts.reduce((sum, t) => sum + t.population, 0);
  const countyTotalUnits = allTracts.reduce((sum, t) => sum + t.housingUnits, 0);

  const avgCountySqMiPerTract = getCountyAreaSqMiles(fips.state, fips.county) / allTracts.length;
  const estimatedTractsInArea = Math.max(1, Math.round(areaSqMiles / avgCountySqMiPerTract));
  const tractFraction = Math.min(1, estimatedTractsInArea / allTracts.length);

  const estimatedPop = Math.round(countyTotalPop * tractFraction);
  const estimatedUnits = Math.round(countyTotalUnits * tractFraction);

  const validIncomes = allTracts.filter((t) => t.medianIncome > 0).map((t) => t.medianIncome);
  const medianIncome = validIncomes.length > 0
    ? Math.round(validIncomes.reduce((s, v) => s + v, 0) / validIncomes.length)
    : 0;

  const validRents = allTracts.filter((t) => t.medianRent > 0).map((t) => t.medianRent);
  const medianRent = validRents.length > 0
    ? Math.round(validRents.reduce((s, v) => s + v, 0) / validRents.length)
    : 0;

  return {
    population: estimatedPop,
    medianIncome,
    totalHousingUnits: estimatedUnits,
    medianRent,
    tractCount: estimatedTractsInArea,
    source: 'census_acs5',
    vintage: '2022',
  };
}

function getCountyAreaSqMiles(state: string, county: string): number {
  const knownAreas: Record<string, number> = {
    '13121': 534,
    '13089': 344,
    '13063': 271,
    '13067': 437,
    '13135': 198,
    '13151': 132,
  };
  return knownAreas[`${state}${county}`] || 500;
}
