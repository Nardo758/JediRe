/**
 * Map Properties to Zoning Codes
 * 
 * Queries municipal APIs to look up zoning codes for all properties
 * and updates the database with the results.
 * 
 * Usage:
 *   npx tsx backend/src/scripts/map-properties-to-zoning.ts
 *   npx tsx backend/src/scripts/map-properties-to-zoning.ts --property-id=123
 *   npx tsx backend/src/scripts/map-properties-to-zoning.ts --dry-run
 */

import { getPool } from '../database/connection';
import { lookupZoningByLocation, CITY_APIS } from '../services/municipal-api-connectors';

const db = getPool();

interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  municipality_id: string | null;
  current_zoning: string | null;
}

/**
 * Geocode address using Google Geocoding API (if available)
 * Falls back to simple lat/lng if already present
 */
async function geocodeProperty(property: Property): Promise<{ lat: number; lng: number } | null> {
  // If we already have coordinates, use them
  if (property.lat && property.lng) {
    return { lat: property.lat, lng: property.lng };
  }

  // TODO: Add geocoding service if needed
  console.log(`    ⚠️  No coordinates available for ${property.address}`);
  return null;
}

/**
 * Determine municipality ID from city/state
 */
function getMunicipalityId(city: string, state: string): string | null {
  const cityLower = city.toLowerCase();
  const stateUpper = state.toUpperCase();

  // Direct city matches
  const cityMap: Record<string, string> = {
    'atlanta': 'atlanta-ga',
    'miami': 'miami-fl',
    'tampa': 'tampa-city-fl',
    'hollywood': 'hollywood-fl',
    'st petersburg': 'st-petersburg-fl',
    'st. petersburg': 'st-petersburg-fl',
    'west palm beach': 'west-palm-beach-fl',
    'hialeah': 'hialeah-fl',
    'coral gables': 'coral-gables-fl',
    'cape coral': 'cape-coral-fl',
    'charlotte': 'charlotte-nc',
    'dallas': 'dallas-tx',
    'san antonio': 'san-antonio-tx',
    'nashville': 'nashville-tn',
    'memphis': 'memphis-tn',
    'new orleans': 'new-orleans-la',
    'richmond': 'richmond-va',
    'fort lauderdale': 'fort-lauderdale-fl',
  };

  for (const [name, id] of Object.entries(cityMap)) {
    if (cityLower.includes(name)) {
      return id;
    }
  }

  // County fallbacks for FL
  if (stateUpper === 'FL') {
    const countyMap: Record<string, string> = {
      'miami': 'miami-dade-fl',
      'tampa': 'tampa-fl',
      'jacksonville': 'duval-fl',
      'fort myers': 'lee-fl',
      'orlando': 'orange-county-fl',
      'st petersburg': 'pinellas-fl',
      'west palm beach': 'palm-beach-fl',
    };

    for (const [name, id] of Object.entries(countyMap)) {
      if (cityLower.includes(name)) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Look up zoning for a single property
 */
async function lookupPropertyZoning(property: Property, dryRun: boolean = false): Promise<boolean> {
  console.log(`\n  Processing: ${property.address}, ${property.city}, ${property.state}`);

  // Get coordinates
  const coords = await geocodeProperty(property);
  if (!coords) {
    console.log(`    ❌ No coordinates available`);
    return false;
  }

  // Determine municipality
  let municipalityId = property.municipality_id || getMunicipalityId(property.city, property.state);
  if (!municipalityId) {
    console.log(`    ⚠️  No API connector for ${property.city}, ${property.state}`);
    return false;
  }

  // Check if API exists
  if (!CITY_APIS[municipalityId]) {
    console.log(`    ⚠️  Municipality ${municipalityId} not configured`);
    return false;
  }

  console.log(`    🔍 Querying ${CITY_APIS[municipalityId].name} API...`);

  // Query zoning API
  try {
    const zoning = await lookupZoningByLocation(municipalityId, coords.lat, coords.lng);

    if (!zoning) {
      console.log(`    ❌ No zoning data found at (${coords.lat}, ${coords.lng})`);
      return false;
    }

    console.log(`    ✅ Found: ${zoning.zoning_code} - ${zoning.district_name}`);

    if (dryRun) {
      console.log(`    [DRY RUN] Would update property ${property.id} with zoning ${zoning.zoning_code}`);
      return true;
    }

    // Update property in database
    await db.query(
      `UPDATE properties 
       SET current_zoning = $1,
           municipality_id = $2,
           lat = $3,
           lng = $4,
           zoning_last_verified = NOW()
       WHERE id = $5`,
      [zoning.zoning_code, municipalityId, coords.lat, coords.lng, property.id]
    );

    console.log(`    💾 Updated property ${property.id}`);
    return true;

  } catch (error: any) {
    console.error(`    ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Process all properties
 */
async function mapAllProperties(dryRun: boolean = false) {
  console.log('🗺️  Property to Zoning Mapper\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No database changes will be made\n');
  }

  // Get all properties that need zoning lookup
  const result = await db.query<Property>(
    `SELECT 
       id, 
       address, 
       city, 
       state, 
       lat, 
       lng, 
       municipality_id,
       current_zoning
     FROM properties
     WHERE address IS NOT NULL
       AND city IS NOT NULL
       AND state IS NOT NULL
     ORDER BY id`
  );

  const properties = result.rows;
  console.log(`Found ${properties.length} properties to process\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    console.log(`[${i + 1}/${properties.length}]`);

    try {
      const success = await lookupPropertyZoning(property, dryRun);
      if (success) {
        successCount++;
      } else {
        skipCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`  ❌ Error processing property ${property.id}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ⚠️  Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

/**
 * Process a single property by ID
 */
async function mapSingleProperty(propertyId: number, dryRun: boolean = false) {
  console.log(`🗺️  Looking up zoning for property ${propertyId}\n`);

  const result = await db.query<Property>(
    `SELECT 
       id, 
       address, 
       city, 
       state, 
       lat, 
       lng, 
       municipality_id,
       current_zoning
     FROM properties
     WHERE id = $1`,
    [propertyId]
  );

  if (result.rows.length === 0) {
    console.error(`Property ${propertyId} not found`);
    process.exit(1);
  }

  const success = await lookupPropertyZoning(result.rows[0], dryRun);
  console.log(success ? '\n✅ Done!' : '\n❌ Failed');
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let propertyId: number | null = null;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--property-id=')) {
      propertyId = parseInt(arg.split('=')[1]);
    }
  }

  if (propertyId) {
    await mapSingleProperty(propertyId, dryRun);
  } else {
    await mapAllProperties(dryRun);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}
