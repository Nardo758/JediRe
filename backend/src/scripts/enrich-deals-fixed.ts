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

function sanitizeForArcGis(val: string): string {
  return val.replace(/'/g, "''").replace(/[;\\%_]/g, '');
}

function extractStreetForSearch(address: string): string {
  const street = address.split(',')[0].trim();
  return sanitizeForArcGis(
    street
      .replace(/\b(NE|NW|SE|SW|N|S|E|W)\b/gi, '')
      .replace(/\b(Suite|Ste|Apt|Unit|#)\s*\S*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
  );
}

async function fetchPropertyData(address: string, county: string): Promise<PropertyEnrichmentData | null> {
  const config = COUNTY_APIS[county];
  if (!config) {
    console.log(`  ⚠  No working API for ${county} — skipping`);
    return null;
  }

  const searchAddr = extractStreetForSearch(address);
  console.log(`  🔍 Searching: "${searchAddr}" in ${county}`);

  try {
    const response = await axios.get(config.url, {
      params: {
        where: `${config.addressField} LIKE '%${searchAddr}%'`,
        outFields: '*',
        resultRecordCount: 5,
        f: 'json',
      },
      timeout: 15000,
    });

    if (!response.data.features || response.data.features.length === 0) {
      const shortAddr = searchAddr.split(' ').slice(0, 3).join(' ');
      console.log(`  ⚠  No exact match, trying shorter: "${shortAddr}"`);

      const retry = await axios.get(config.url, {
        params: {
          where: `${config.addressField} LIKE '%${shortAddr}%'`,
          outFields: '*',
          resultRecordCount: 5,
          f: 'json',
        },
        timeout: 15000,
      });

      if (!retry.data.features || retry.data.features.length === 0) {
        console.log(`  ⚠  No data found in ${county}`);
        return null;
      }

      return mapFeatureToEnrichment(retry.data.features[0].attributes, config, county);
    }

    return mapFeatureToEnrichment(response.data.features[0].attributes, config, county);

  } catch (error: any) {
    console.log(`  ❌ API error: ${error.message}`);
    return null;
  }
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

  if (data.assessed_value && !data.annual_taxes) {
    data.annual_taxes = Math.round(data.assessed_value * config.taxRate);
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

      const enrichedData = await fetchPropertyData(deal.address, county);

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
    console.log('Unsupported counties hit: DeKalb GA, Cobb GA, Miami-Dade FL, Palm Beach FL');
    console.log('(APIs offline or no property data endpoint available)');

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
