/**
 * Fixed Property to Zoning Mapper
 * 
 * Handles the fact that deals table doesn't have a 'city' column
 * Uses properties table (which has city) or geocoding
 * 
 * Usage:
 *   npx tsx backend/src/scripts/map-all-properties-fixed.ts
 *   npx tsx backend/src/scripts/map-all-properties-fixed.ts --dry-run
 */

import { getPool } from '../database/connection';
import { lookupZoningByLocation, CITY_APIS } from '../services/municipal-api-connectors';

const db = getPool();

interface PropertyRecord {
  id: number;
  address_line1: string;
  city: string;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
  current_zoning: string | null;
  municipality_id: string | null;
}

interface DealRecord {
  id: string;
  address: string;
  metadata: any;
}

/**
 * Extract city from address string
 */
function extractCityFromAddress(address: string): { city: string | null; state: string | null } {
  // Patterns: "123 Main St, Atlanta, Georgia 30324"
  //           "123 Main St, Miami, Florida 33132, United States"
  
  const parts = address.split(',').map(s => s.trim());
  
  if (parts.length >= 3) {
    // Typically: [street], [city], [state zip]
    const city = parts[parts.length - 3];
    const stateZip = parts[parts.length - 2];
    
    // Extract state abbreviation
    const stateMatch = stateZip.match(/\b([A-Z]{2})\b/);
    const state = stateMatch ? stateMatch[1] : null;
    
    // Handle full state names
    const stateMap: Record<string, string> = {
      'Georgia': 'GA',
      'Florida': 'FL',
      'Texas': 'TX',
      'California': 'CA',
      'Louisiana': 'LA',
      'Tennessee': 'TN',
      'North Carolina': 'NC',
      'South Carolina': 'SC',
      'Virginia': 'VA',
    };
    
    const stateFromMap = stateMap[stateZip.split(' ')[0]];
    
    return {
      city: city && city.length < 50 ? city : null,
      state: state || stateFromMap || null
    };
  }
  
  return { city: null, state: null };
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
 * Map properties table (has city column)
 */
async function mapPropertiesTable(dryRun: boolean = false): Promise<{ success: number; skipped: number; errors: number }> {
  console.log('🗺️  Mapping properties from properties table...\n');
  
  const result = await db.query<PropertyRecord>(`
    SELECT 
      id,
      address_line1,
      city,
      state_code,
      latitude,
      longitude,
      current_zoning,
      municipality_id
    FROM properties
    WHERE city IS NOT NULL 
      AND state_code IS NOT NULL
      AND current_zoning IS NULL
    ORDER BY id
  `);
  
  const properties = result.rows;
  console.log(`Found ${properties.length} properties without zoning\n`);
  
  let success = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    console.log(`[${i + 1}/${properties.length}] ${prop.address_line1}, ${prop.city}, ${prop.state_code}`);
    
    try {
      // Get municipality ID
      let municipalityId = prop.municipality_id || getMunicipalityId(prop.city, prop.state_code);
      
      if (!municipalityId) {
        console.log(`  ⚠️  No API for ${prop.city}, ${prop.state_code}`);
        skipped++;
        continue;
      }
      
      // Need coordinates
      if (!prop.latitude || !prop.longitude) {
        console.log(`  ⚠️  No coordinates`);
        skipped++;
        continue;
      }
      
      // Query API
      console.log(`  🔍 Querying ${CITY_APIS[municipalityId]?.name || municipalityId} API...`);
      const zoning = await lookupZoningByLocation(municipalityId, prop.latitude, prop.longitude);
      
      if (!zoning) {
        console.log(`  ❌ No zoning data found`);
        skipped++;
        continue;
      }
      
      console.log(`  ✅ Found: ${zoning.zoning_code}`);
      
      if (!dryRun) {
        await db.query(
          `UPDATE properties 
           SET current_zoning = $1,
               municipality_id = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [zoning.zoning_code, municipalityId, prop.id]
        );
        console.log(`  💾 Updated`);
      } else {
        console.log(`  [DRY RUN] Would update`);
      }
      
      success++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  return { success, skipped, errors };
}

/**
 * Map deals (need to parse city from address)
 */
async function mapDealsTable(dryRun: boolean = false): Promise<{ success: number; skipped: number; errors: number }> {
  console.log('\n🗺️  Mapping deals (parsing city from address)...\n');
  
  const result = await db.query<DealRecord>(`
    SELECT 
      id,
      address,
      metadata
    FROM deals
    WHERE address IS NOT NULL
      AND (metadata->'zoning' IS NULL OR metadata->'zoning'->>'code' IS NULL)
    ORDER BY created_at DESC
  `);
  
  const deals = result.rows;
  console.log(`Found ${deals.length} deals without zoning\n`);
  
  let success = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    console.log(`[${i + 1}/${deals.length}] ${deal.address}`);
    
    try {
      // Parse city from address
      const { city, state } = extractCityFromAddress(deal.address);
      
      if (!city || !state) {
        console.log(`  ⚠️  Could not parse city/state from address`);
        skipped++;
        continue;
      }
      
      console.log(`  📍 Parsed: ${city}, ${state}`);
      
      // Get municipality ID
      const municipalityId = getMunicipalityId(city, state);
      
      if (!municipalityId) {
        console.log(`  ⚠️  No API for ${city}, ${state}`);
        skipped++;
        continue;
      }
      
      // For deals, we need to geocode the address first
      // Skip for now - this requires external geocoding service
      console.log(`  ⏭️  Skipping (needs geocoding) - use properties table instead`);
      skipped++;
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  return { success, skipped, errors };
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('🚀 PROPERTY TO ZONING MAPPER (FIXED)\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No database changes\n');
  }
  
  console.log('='.repeat(60));
  
  // Map properties table (has city column)
  const propsResult = await mapPropertiesTable(dryRun);
  
  // Map deals table (needs parsing - skip for now)
  // const dealsResult = await mapDealsTable(dryRun);
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`  ✅ Success: ${propsResult.success}`);
  console.log(`  ⚠️  Skipped: ${propsResult.skipped}`);
  console.log(`  ❌ Errors: ${propsResult.errors}`);
  console.log('='.repeat(60));
  
  // Check final coverage
  const coverageResult = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(current_zoning) FILTER (WHERE current_zoning IS NOT NULL) as with_zoning
    FROM properties
  `);
  
  const coverage = coverageResult.rows[0];
  const pct = coverage.total > 0 ? Math.round((coverage.with_zoning / coverage.total) * 100) : 0;
  
  console.log(`\n📊 Final Coverage: ${coverage.with_zoning}/${coverage.total} properties (${pct}%)`);
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(() => {
      db.end();
    });
}
