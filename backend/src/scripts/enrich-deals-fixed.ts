import axios from 'axios';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@helium/heliumdb?sslmode=disable',
});

interface PropertyEnrichmentData {
  units?: number;
  total_sqft?: number;
  habitable_sqft?: number;
  amenity_sqft?: number;
  leasing_office_sqft?: number;
  year_built?: number;
  lot_size_acres?: number;
  assessed_value?: number;
  assessed_land?: number;
  assessed_improvements?: number;
  appraised_value?: number;
  appraised_land?: number;
  appraised_improvements?: number;
  annual_taxes?: number;
  parcel_id?: string;
  owner_name?: string;
  use_code?: string;
  class_code?: string;
  enrichment_source: string;
  enriched_at: string;
}

interface CountyAPIConfig {
  url: string;
  addressField: string;
  fields: Record<string, string>;
  taxRate: number;
  lotSizeUnit?: 'acres' | 'sqft';
  customMapper?: (attrs: any, data: PropertyEnrichmentData) => void;
}

const COUNTY_APIS: Record<string, CountyAPIConfig> = {
  'Fulton County, GA': {
    url: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query',
    addressField: 'Address',
    fields: {
      units: 'LivUnits',
      lot_size_acres: 'LandAcres',
      assessed_value: 'TotAssess',
      assessed_land: 'LandAssess',
      assessed_improvements: 'ImprAssess',
      appraised_value: 'TotAppr',
      appraised_land: 'LandAppr',
      appraised_improvements: 'ImprAppr',
      parcel_id: 'ParcelID',
      owner_name: 'Owner',
      use_code: 'LUCode',
      class_code: 'ClassCode',
    },
    taxRate: 0.0185,
  },
  'DeKalb County, GA': {
    url: 'https://dcgis.dekalbcountyga.gov/hosted/rest/services/Tax_Parcels/FeatureServer/0/query',
    addressField: 'SITEADDRESS',
    fields: {
      appraised_value: 'TOTAPR1',
      parcel_id: 'PARCELID',
      owner_name: 'OWNERNME1',
      use_code: 'USECD',
      class_code: 'CLASSCD',
    },
    taxRate: 0.0195,
    customMapper: (attrs: any, data: PropertyEnrichmentData) => {
      const shapeArea = parseFloat(attrs['Shape__Area']);
      if (Number.isFinite(shapeArea) && shapeArea > 0) {
        data.lot_size_acres = Math.round((shapeArea / 43560) * 100) / 100;
      }
      if (attrs['STATEDAREA']) data.total_sqft = parseFloat(attrs['STATEDAREA']) || undefined;
      if (attrs['ZONING']) data.use_code = `${data.use_code || ''} (Zone: ${attrs['ZONING']})`.trim();
    },
  },
  'Miami-Dade County, FL': {
    url: 'https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/24/query',
    addressField: 'TRUE_SITE_ADDR',
    fields: {
      units: 'UNIT_COUNT',
      parcel_id: 'FOLIO',
      owner_name: 'TRUE_OWNER1',
      use_code: 'DOR_CODE_CUR',
    },
    taxRate: 0.0195,
    lotSizeUnit: 'sqft',
    customMapper: (attrs: any, data: PropertyEnrichmentData) => {
      const lotSqft = parseFloat(attrs['LOT_SIZE']);
      if (Number.isFinite(lotSqft) && lotSqft > 0) {
        data.lot_size_acres = Math.round((lotSqft / 43560) * 100) / 100;
      }
      const heated = parseFloat(attrs['BUILDING_HEATED_AREA']);
      if (Number.isFinite(heated) && heated > 0) data.total_sqft = heated;
      const yrBuilt = parseInt(attrs['YEAR_BUILT']);
      if (Number.isFinite(yrBuilt) && yrBuilt > 1800) data.year_built = yrBuilt;
      const landVal = parseFloat(attrs['LAND_VAL_CUR']);
      if (Number.isFinite(landVal) && landVal > 0) data.assessed_land = landVal;
      const bldgVal = parseFloat(attrs['BUILDING_VAL_CUR']);
      if (Number.isFinite(bldgVal) && bldgVal > 0) data.assessed_improvements = bldgVal;
      const totalVal = parseFloat(attrs['TOTAL_VAL_CUR']);
      if (Number.isFinite(totalVal) && totalVal > 0) data.assessed_value = totalVal;
      if (attrs['DOR_DESC']) data.class_code = attrs['DOR_DESC'];
      if (attrs['PRIMARY_ZONE']) data.use_code = `${data.use_code || ''} (Zone: ${attrs['PRIMARY_ZONE']})`.trim();
    },
  },
  'Palm Beach County, FL': {
    url: 'https://services.arcgis.com/B7X7NCOKKXditlwZ/arcgis/rest/services/Palm_Beach_County_Parcels/FeatureServer/0/query',
    addressField: 'PHY_ADDR1',
    fields: {
      units: 'NO_RES_UNT',
      appraised_value: 'JV',
      assessed_land: 'LND_VAL',
      parcel_id: 'PARCEL_ID',
      owner_name: 'OWN_NAME',
      use_code: 'DOR_UC',
    },
    taxRate: 0.0185,
    customMapper: (attrs: any, data: PropertyEnrichmentData) => {
      const lotSqft = parseFloat(attrs['LND_SQFOOT']);
      if (Number.isFinite(lotSqft) && lotSqft > 0) {
        data.lot_size_acres = Math.round((lotSqft / 43560) * 100) / 100;
      }
      const livingArea = parseFloat(attrs['TOT_LVG_AR']);
      if (Number.isFinite(livingArea) && livingArea > 0) data.total_sqft = livingArea;
      const yrBuilt = parseInt(attrs['ACT_YR_BLT']);
      if (Number.isFinite(yrBuilt) && yrBuilt > 1800) data.year_built = yrBuilt;
      const jv = data.appraised_value || 0;
      const lnd = parseFloat(attrs['LND_VAL']) || 0;
      data.appraised_land = lnd > 0 ? lnd : undefined;
      data.appraised_improvements = (jv > 0 && lnd > 0) ? jv - lnd : undefined;
      data.assessed_land = undefined;
      if (attrs['IMP_QUAL']) data.class_code = attrs['IMP_QUAL'];
    },
  },
};

const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
};

function parseAddress(address: string): { street: string; city: string; state: string } {
  const parts = address.split(',').map(p => p.trim());

  if (parts.length >= 3) {
    const street = parts[0];

    const hasCountry = parts[parts.length - 1].toLowerCase().includes('united states') ||
                       parts[parts.length - 1].toLowerCase().includes('usa');
    const stateIdx = hasCountry ? parts.length - 2 : parts.length - 1;
    const cityIdx = stateIdx - 1;

    const stateZip = parts[stateIdx];
    const stateToken = stateZip.replace(/\d+/g, '').trim();
    const state = STATE_ABBREVIATIONS[stateToken.toLowerCase()] || stateToken.toUpperCase();
    const city = parts[cityIdx];

    return { street, city, state };
  }

  return { street: parts[0] || '', city: '', state: '' };
}

function getCounty(city: string, state: string): string | null {
  const c = city.toLowerCase();
  const s = state.toUpperCase();

  if (s === 'GA') {
    if (c.includes('atlanta') || c.includes('buckhead') || c.includes('midtown') ||
        c.includes('sandy springs') || c.includes('alpharetta') || c.includes('college park') ||
        c.includes('east point') || c.includes('union city') || c.includes('roswell') ||
        c.includes('johns creek') || c.includes('milton')) {
      return 'Fulton County, GA';
    }
    if (c.includes('decatur') || c.includes('stone mountain') || c.includes('lithonia') ||
        c.includes('tucker') || c.includes('dunwoody') || c.includes('brookhaven')) {
      return 'DeKalb County, GA';
    }
    if (c.includes('marietta') || c.includes('kennesaw') || c.includes('smyrna') ||
        c.includes('acworth') || c.includes('powder springs')) {
      return 'Cobb County, GA';
    }
  }

  if (s === 'FL') {
    if (c.includes('miami') || c.includes('hialeah') || c.includes('doral') ||
        c.includes('coral gables') || c.includes('homestead')) {
      return 'Miami-Dade County, FL';
    }
    if (c.includes('west palm beach') || c.includes('boca raton') || c.includes('delray') ||
        c.includes('boynton') || c.includes('palm beach') || c.includes('jupiter') ||
        c.includes('wellington') || c.includes('royal palm')) {
      return 'Palm Beach County, FL';
    }
  }

  return null;
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  'BOULEVARD': 'BLVD', 'AVENUE': 'AVE', 'STREET': 'ST', 'DRIVE': 'DR',
  'ROAD': 'RD', 'LANE': 'LN', 'COURT': 'CT', 'PLACE': 'PL',
  'CIRCLE': 'CIR', 'PARKWAY': 'PKWY', 'HIGHWAY': 'HWY', 'TERRACE': 'TER',
  'TRAIL': 'TRL', 'WAY': 'WAY', 'NORTHEAST': 'NE', 'NORTHWEST': 'NW',
  'SOUTHEAST': 'SE', 'SOUTHWEST': 'SW', 'INDUSTRIAL': 'IND',
  'SOUTH': 'S', 'NORTH': 'N', 'EAST': 'E', 'WEST': 'W',
};

function sanitizeForArcGis(val: string): string {
  return val.replace(/'/g, "''").replace(/[;\\%_]/g, '');
}

function abbreviateStreet(street: string): string {
  let result = street.toUpperCase();
  for (const [full, abbr] of Object.entries(STREET_ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  return result;
}

function extractStreetForSearch(address: string): string {
  const street = address.split(',')[0].trim();
  return sanitizeForArcGis(
    abbreviateStreet(street)
      .replace(/\b(NE|NW|SE|SW|N|S|E|W)\b/gi, '')
      .replace(/\b(Suite|Ste|Apt|Unit|#)\s*\S*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractStreetWithDirections(address: string): string {
  const street = address.split(',')[0].trim();
  return sanitizeForArcGis(
    abbreviateStreet(street)
      .replace(/\b(Suite|Ste|Apt|Unit|#)\s*\S*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function findBestMatch(features: any[], streetNum: string, addressField: string): any | null {
  for (const feat of features) {
    const addr = (feat.attributes?.[addressField] || '').toString().trim().toUpperCase();
    const addrNum = addr.match(/^(\d+)/)?.[1];
    if (addrNum === streetNum) return feat.attributes;
  }
  return null;
}

async function queryArcGis(config: CountyAPIConfig, searchTerm: string): Promise<any[] | null> {
  try {
    const response = await axios.get(config.url, {
      params: {
        where: `${config.addressField} LIKE '${searchTerm}'`,
        outFields: '*',
        resultRecordCount: 5,
        f: 'json',
      },
      timeout: 15000,
    });
    const feats = response.data?.features;
    return (feats && feats.length > 0) ? feats : null;
  } catch {
    return null;
  }
}

async function fetchPropertyData(address: string, county: string): Promise<PropertyEnrichmentData | null> {
  const config = COUNTY_APIS[county];
  if (!config) {
    console.log(`  ⚠  No working API for ${county} — skipping`);
    return null;
  }

  const withDirs = extractStreetWithDirections(address);
  const noDirs = extractStreetForSearch(address);
  const parts = noDirs.split(' ').filter(Boolean);
  const streetNum = /^\d+$/.test(parts[0] || '') ? parts[0] : null;
  const streetName = parts.slice(streetNum ? 1 : 0, (streetNum ? 1 : 0) + 2).join(' ');
  const justNumAndName = streetNum ? `${streetNum} ${streetName}` : streetName;

  const rawStreet = sanitizeForArcGis(
    address.split(',')[0].trim()
      .replace(/\b(Suite|Ste|Apt|Unit|#)\s*\S*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
  );
  const altNoDirs = noDirs.replace(/\bPKWY\b/, 'PKY');

  const seen = new Set<string>();
  const strategies: Array<{label: string; term: string}> = [];
  const addStrategy = (label: string, term: string) => {
    if (!seen.has(term)) { seen.add(term); strategies.push({ label, term }); }
  };

  addStrategy('full w/ directions', `%${withDirs}%`);
  addStrategy('no directions', `%${noDirs}%`);
  addStrategy('raw (unabbreviated)', `%${rawStreet}%`);
  if (altNoDirs !== noDirs) addStrategy('alt abbreviation', `%${altNoDirs}%`);
  if (streetNum && parts.length > 1) addStrategy('number + street', `${streetNum} ${parts[1]}%`);
  const coreStreetWord = noDirs.split(' ').find(w => w.length > 3 && !/^\d+$/.test(w));
  if (coreStreetWord && streetNum) addStrategy('number + core word', `${streetNum}%${coreStreetWord}%`);
  addStrategy('short', `%${justNumAndName}%`);

  const searchStrategies = strategies;

  for (const strategy of searchStrategies) {
    console.log(`  🔍 ${strategy.label}: "${strategy.term}" in ${county}`);
    try {
      const feats = await queryArcGis(config, strategy.term);
      if (feats) {
        if (!streetNum) {
          const attrs = feats[0].attributes;
          console.log(`  ✓  Found match (no street number to verify): "${attrs[config.addressField] || 'N/A'}"`);
          return mapFeatureToEnrichment(attrs, config, county);
        }
        const matched = findBestMatch(feats, streetNum, config.addressField);
        if (matched) {
          console.log(`  ✓  Found match: "${matched[config.addressField] || 'N/A'}"`);
          return mapFeatureToEnrichment(matched, config, county);
        }
        console.log(`  ⚠  ${feats.length} result(s) but none matched street number ${streetNum}`);
      }
    } catch (error: any) {
      console.log(`  ❌ API error: ${error.message}`);
      return null;
    }
  }

  console.log(`  ⚠  No data found in ${county} after ${searchStrategies.length} attempts`);
  return null;
}

function mapFeatureToEnrichment(attrs: any, config: CountyAPIConfig, county: string): PropertyEnrichmentData {
  const data: PropertyEnrichmentData = {
    enrichment_source: county,
    enriched_at: new Date().toISOString(),
  };

  const safeInt = (v: any): number | undefined => {
    const n = parseInt(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const safeFloat = (v: any): number | undefined => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  if (config.fields.units) data.units = safeInt(attrs[config.fields.units]);
  if (config.fields.lot_size_acres) data.lot_size_acres = safeFloat(attrs[config.fields.lot_size_acres]);
  if (config.fields.assessed_value) data.assessed_value = safeFloat(attrs[config.fields.assessed_value]);
  if (config.fields.assessed_land) data.assessed_land = safeFloat(attrs[config.fields.assessed_land]);
  if (config.fields.assessed_improvements) data.assessed_improvements = safeFloat(attrs[config.fields.assessed_improvements]);
  if (config.fields.parcel_id) data.parcel_id = attrs[config.fields.parcel_id]?.toString() || undefined;
  if (config.fields.owner_name) data.owner_name = attrs[config.fields.owner_name]?.toString().trim() || undefined;
  if (config.fields.use_code) data.use_code = attrs[config.fields.use_code]?.toString() || undefined;
  if (config.fields.class_code) data.class_code = attrs[config.fields.class_code]?.toString() || undefined;

  if (config.fields.appraised_value) data.appraised_value = safeFloat(attrs[config.fields.appraised_value]);
  if (config.fields.appraised_land) data.appraised_land = safeFloat(attrs[config.fields.appraised_land]);
  if (config.fields.appraised_improvements) data.appraised_improvements = safeFloat(attrs[config.fields.appraised_improvements]);

  if (config.customMapper) {
    config.customMapper(attrs, data);
  }

  const taxableVal = data.assessed_value || data.appraised_value;
  if (taxableVal && !data.annual_taxes) {
    data.annual_taxes = Math.round(taxableVal * config.taxRate);
  }

  return data;
}

async function updateDeal(dealId: string, enrichedData: PropertyEnrichmentData): Promise<boolean> {
  try {
    const res = await pool.query(`
      UPDATE deals
      SET
        property_data = COALESCE(property_data, '{}'::jsonb) || $1::jsonb,
        updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(enrichedData), dealId]);

    if (res.rowCount === 0) {
      console.log(`  ❌ No rows updated for deal ${dealId}`);
      return false;
    }

    console.log(`  ✅ Updated deal ${dealId}`);
    if (enrichedData.units !== undefined) console.log(`     Units: ${enrichedData.units}`);
    if (enrichedData.lot_size_acres !== undefined) console.log(`     Lot: ${enrichedData.lot_size_acres.toFixed(2)} acres`);
    if (enrichedData.assessed_value !== undefined) console.log(`     Assessed: $${enrichedData.assessed_value.toLocaleString()}`);
    if (enrichedData.appraised_value !== undefined) console.log(`     Appraised: $${enrichedData.appraised_value.toLocaleString()}`);
    if (enrichedData.owner_name) console.log(`     Owner: ${enrichedData.owner_name}`);
    if (enrichedData.parcel_id) console.log(`     Parcel: ${enrichedData.parcel_id}`);
    console.log('');
    return true;

  } catch (error: any) {
    console.error(`  ❌ Error updating deal: ${error.message}`);
    return false;
  }
}

async function enrichAllDeals(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('  PROPERTY DATA ENRICHMENT');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    const result = await pool.query(`
      SELECT id, name, address, property_data
      FROM deals
      WHERE address IS NOT NULL
      ORDER BY created_at DESC
    `);

    const deals = result.rows;
    console.log(`Found ${deals.length} deals to process\n`);

    let enriched = 0;
    let skipped = 0;
    let noApi = 0;
    let failed = 0;

    for (const deal of deals) {
      console.log(`--- ${deal.name || 'Unnamed'}`);
      console.log(`    ${deal.address}`);

      if (deal.property_data?.enriched_at) {
        const enrichedDate = new Date(deal.property_data.enriched_at);
        const daysSince = (Date.now() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
          console.log(`  >> Skipped (enriched ${Math.floor(daysSince)} days ago)\n`);
          skipped++;
          continue;
        }
      }

      const { city, state } = parseAddress(deal.address);
      const county = getCounty(city, state);

      if (!county) {
        console.log(`  ⚠  Could not determine county for "${city}, ${state}"\n`);
        failed++;
        continue;
      }

      if (!COUNTY_APIS[county]) {
        console.log(`  ⚠  No API configured for ${county}\n`);
        noApi++;
        continue;
      }

      let enrichedData = await fetchPropertyData(deal.address, county);

      const atlantaCrossBorder = ['atlanta', 'east point', 'college park'];
      const cityLower = city.toLowerCase();
      if (!enrichedData && state.toUpperCase() === 'GA' && atlantaCrossBorder.some(c => cityLower.includes(c))) {
        if (county === 'Fulton County, GA' && COUNTY_APIS['DeKalb County, GA']) {
          console.log(`  ↻  Trying DeKalb County (Atlanta cross-county fallback)...`);
          enrichedData = await fetchPropertyData(deal.address, 'DeKalb County, GA');
        } else if (county === 'DeKalb County, GA' && COUNTY_APIS['Fulton County, GA']) {
          console.log(`  ↻  Trying Fulton County (Atlanta cross-county fallback)...`);
          enrichedData = await fetchPropertyData(deal.address, 'Fulton County, GA');
        }
      }

      if (enrichedData) {
        const updated = await updateDeal(deal.id, enrichedData);
        if (updated) {
          enriched++;
        } else {
          failed++;
        }
      } else {
        failed++;
        console.log('');
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log(`  Enriched:      ${enriched}`);
    console.log(`  Skipped:       ${skipped} (already recent)`);
    console.log(`  No API:        ${noApi} (county not supported)`);
    console.log(`  Failed:        ${failed}`);
    console.log(`  Total:         ${deals.length}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\nSupported counties: ' + Object.keys(COUNTY_APIS).join(', '));
    console.log('Note: Cobb County GA GIS is offline — Marietta deals cannot be enriched currently.');

  } catch (error: any) {
    console.error('Fatal error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

enrichAllDeals()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nEnrichment failed:', error);
    process.exit(1);
  });
