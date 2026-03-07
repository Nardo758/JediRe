/**
 * Enrich Property Data from Apartment Locator AI
 * 
 * Pulls rent comps, occupancy, and amenity data from the 7,336 properties
 * in Apartment Locator AI and enriches JediRe database.
 * 
 * Usage:
 *   npx tsx backend/src/scripts/enrich-from-apartment-locator.ts
 *   npx tsx backend/src/scripts/enrich-from-apartment-locator.ts --deal-id=[ID]
 */

import { getPool } from '../database/connection';

const db = getPool();

interface ApartmentLocatorProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  units: number;
  rent_studio?: number;
  rent_1br?: number;
  rent_2br?: number;
  rent_3br?: number;
  occupancy_rate?: number;
  year_built?: number;
  amenities?: string[];
  rating?: number;
  status?: string; // 'active', 'under_construction', 'planned'
}

/**
 * Fetch properties from Apartment Locator AI API
 */
async function fetchApartmentLocatorProperties(
  lat: number,
  lng: number,
  radiusMiles: number = 3
): Promise<ApartmentLocatorProperty[]> {
  // TODO: Replace with actual Apartment Locator AI API endpoint
  const APARTMENT_LOCATOR_API = process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:5000/api';
  
  try {
    const response = await fetch(
      `${APARTMENT_LOCATOR_API}/properties/search?lat=${lat}&lng=${lng}&radius=${radiusMiles}`
    );
    
    if (!response.ok) {
      throw new Error(`Apartment Locator API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.properties || [];
    
  } catch (error: any) {
    console.warn(`Could not fetch from Apartment Locator: ${error.message}`);
    return [];
  }
}

/**
 * Enrich a single deal with Apartment Locator data
 */
async function enrichDeal(dealId: string) {
  console.log(`\n🔍 Enriching deal ${dealId}...`);
  
  // Get deal location
  const dealResult = await db.query(
    `SELECT d.id, d.property_address, pb.centroid
     FROM deals d
     LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
     WHERE d.id = $1`,
    [dealId]
  );
  
  if (dealResult.rows.length === 0) {
    console.log(`  ⚠️  Deal not found`);
    return { success: false, error: 'Deal not found' };
  }
  
  const deal = dealResult.rows[0];
  
  if (!deal.centroid) {
    console.log(`  ⚠️  No property boundary/centroid available`);
    return { success: false, error: 'No location data' };
  }
  
  const [lng, lat] = deal.centroid.coordinates;
  
  console.log(`  📍 Location: ${lat}, ${lng}`);
  console.log(`  🔎 Querying Apartment Locator AI...`);
  
  // Fetch properties from Apartment Locator
  const properties = await fetchApartmentLocatorProperties(lat, lng, 3);
  
  console.log(`  ✅ Found ${properties.length} properties within 3 miles`);
  
  if (properties.length === 0) {
    return { success: true, comps: 0 };
  }
  
  // Insert as rent comps
  let inserted = 0;
  for (const prop of properties) {
    try {
      await db.query(
        `INSERT INTO rent_comps (
          property_id, building_name, address, city, state, zip,
          lat, lng, units, 
          studio_rent, one_bed_rent, two_bed_rent, three_bed_rent,
          occupancy_pct, year_built, rating,
          subject_property_id, market, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (property_id, subject_property_id) DO UPDATE SET
          units = EXCLUDED.units,
          studio_rent = EXCLUDED.studio_rent,
          one_bed_rent = EXCLUDED.one_bed_rent,
          two_bed_rent = EXCLUDED.two_bed_rent,
          three_bed_rent = EXCLUDED.three_bed_rent,
          occupancy_pct = EXCLUDED.occupancy_pct,
          updated_at = NOW()`,
        [
          prop.id,
          prop.name,
          prop.address,
          prop.city,
          prop.state,
          prop.zip,
          prop.lat,
          prop.lng,
          prop.units,
          prop.rent_studio || null,
          prop.rent_1br || null,
          prop.rent_2br || null,
          prop.rent_3br || null,
          prop.occupancy_rate || null,
          prop.year_built || null,
          prop.rating || null,
          dealId,
          `${prop.city}, ${prop.state}`,
          'apartment_locator_ai'
        ]
      );
      inserted++;
    } catch (error: any) {
      console.warn(`    ⚠️  Error inserting ${prop.name}: ${error.message}`);
    }
  }
  
  console.log(`  💾 Inserted ${inserted} rent comps`);
  
  return { success: true, comps: inserted };
}

/**
 * Enrich all deals
 */
async function enrichAllDeals() {
  console.log('🚀 Enriching all deals from Apartment Locator AI...\n');
  
  const dealsResult = await db.query(
    `SELECT d.id 
     FROM deals d
     LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
     WHERE pb.centroid IS NOT NULL
     ORDER BY d.created_at DESC`
  );
  
  const deals = dealsResult.rows;
  console.log(`Found ${deals.length} deals with location data\n`);
  
  let successCount = 0;
  let totalComps = 0;
  
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    console.log(`[${i + 1}/${deals.length}]`);
    
    try {
      const result = await enrichDeal(deal.id);
      if (result.success) {
        successCount++;
        totalComps += result.comps || 0;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`  Deals enriched: ${successCount}/${deals.length}`);
  console.log(`  Total rent comps added: ${totalComps}`);
  console.log('='.repeat(60));
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  let dealId: string | null = null;
  
  for (const arg of args) {
    if (arg.startsWith('--deal-id=')) {
      dealId = arg.split('=')[1];
    }
  }
  
  if (dealId) {
    await enrichDeal(dealId);
  } else {
    await enrichAllDeals();
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
    })
    .finally(() => {
      db.end();
    });
}

export { enrichDeal, enrichAllDeals };
