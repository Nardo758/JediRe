/**
 * Property Data Enrichment from Municipal/County Assessor APIs
 * 
 * Pulls property-level data for all deals in the database:
 * - Unit count
 * - Square footage (total, habitable, amenity, leasing/common)
 * - Building count and details
 * - Year built, lot size
 * - Assessed value, annual taxes
 * 
 * Supports:
 * - Fulton County, GA (ArcGIS REST API)
 * - DeKalb County, GA (ArcGIS REST API)
 * - Miami-Dade County, FL (ArcGIS REST API)
 * - More counties can be added easily
 */

import axios from 'axios';
import { getPool } from '../database/connection';

const pool = getPool();

interface PropertyEnrichmentData {
  units?: number;
  total_sqft?: number;
  habitable_sqft?: number;
  amenity_sqft?: number;
  leasing_office_sqft?: number;
  building_count?: number;
  buildings?: Array<{
    building_id?: string;
    sqft?: number;
    stories?: number;
    year_built?: number;
    use_code?: string;
  }>;
  year_built?: number;
  lot_size_acres?: number;
  assessed_value?: number;
  assessed_land?: number;
  assessed_improvements?: number;
  annual_taxes?: number;
  parcel_id?: string;
  owner_name?: string;
  use_code?: string;
  zoning?: string;
  enrichment_source: string;
}

/**
 * County Assessor API Configurations
 */
const COUNTY_APIS: Record<string, any> = {
  'fulton-ga': {
    name: 'Fulton County, GA',
    type: 'arcgis',
    parcelServiceUrl: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0',
    buildingServiceUrl: null, // Fulton doesn't expose building-level detail via API
    fields: {
      parcelId: 'ParcelID',
      address: 'Address',
      owner: 'Owner',
      totalAssessed: 'TotAssess',
      landAssessed: 'Land',
      improvAssessed: 'Improv',
      yearBuilt: 'YearBuilt',
      luCode: 'LUCode', // Land Use Code
      classCode: 'ClassCode',
      lotSize: 'Acreage',
    },
  },
  'dekalb-ga': {
    name: 'DeKalb County, GA',
    type: 'arcgis',
    parcelServiceUrl: 'https://gis.dekalbcountyga.gov/arcgis/rest/services/PropertyInformation/MapServer/0',
    buildingServiceUrl: null,
    fields: {
      parcelId: 'ParcelID',
      address: 'Address',
      owner: 'Owner',
      totalAssessed: 'TOTAL_APPR',
      yearBuilt: 'YEAR_BUILT',
      luCode: 'LAND_USE',
      lotSize: 'ACRES',
    },
  },
  'miami-dade-fl': {
    name: 'Miami-Dade County, FL',
    type: 'arcgis',
    parcelServiceUrl: 'https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_PropertyAppraisal/MapServer/0',
    buildingServiceUrl: null,
    fields: {
      parcelId: 'PARCELNO',
      address: 'PHYADR',
      owner: 'OWNERNAME1',
      totalAssessed: 'TOT_LND_VAL',
      yearBuilt: 'YR_BLT',
      luCode: 'DOR_UC',
      lotSize: 'TOT_LVG_AREA',
    },
  },
};

/**
 * Infer unit count from land use code (when not explicitly available)
 */
function inferUnitsFromLandUseCode(luCode: string, totalSqft?: number): number | null {
  // Fulton County land use codes
  const fultonMultifamilyCodes: Record<string, number> = {
    '310': 2,  // Duplex
    '320': 3,  // Triplex
    '330': 4,  // Quadruplex
    '340': 0,  // 5+ units (use sqft-based estimate)
    '350': 0,  // Apartments
    '360': 0,  // Condos
  };

  if (fultonMultifamilyCodes[luCode] !== undefined) {
    const codeUnits = fultonMultifamilyCodes[luCode];
    if (codeUnits > 0) return codeUnits;
    
    // For 5+ units, estimate from square footage
    if (totalSqft && totalSqft > 0) {
      // Average unit size: 850 sqft
      // Apply 15% common area factor
      const estimatedUnits = Math.round((totalSqft * 0.85) / 850);
      return estimatedUnits > 0 ? estimatedUnits : null;
    }
  }

  return null;
}

/**
 * Infer sqft breakdown when only total is available
 */
function inferSqftBreakdown(totalSqft: number, units?: number): {
  habitable?: number;
  amenity?: number;
  leasing_office?: number;
} {
  if (!units || units < 5) {
    // Small properties: assume all habitable
    return {
      habitable: totalSqft,
      amenity: 0,
      leasing_office: 0,
    };
  }

  // Multifamily: typical breakdown
  // 85% habitable (units)
  // 10% amenities (gym, pool, clubhouse)
  // 5% leasing office + common areas
  return {
    habitable: Math.round(totalSqft * 0.85),
    amenity: Math.round(totalSqft * 0.10),
    leasing_office: Math.round(totalSqft * 0.05),
  };
}

/**
 * Fetch property data from ArcGIS REST API
 */
async function fetchPropertyDataArcGIS(
  serviceUrl: string,
  address: string,
  parcelId?: string,
  fields?: Record<string, string>
): Promise<any | null> {
  try {
    // Query by address or parcel ID
    const whereClause = parcelId
      ? `${fields?.parcelId || 'ParcelID'} = '${parcelId}'`
      : `${fields?.address || 'Address'} LIKE '%${address.split(' ')[0]}%'`;

    const response = await axios.get(`${serviceUrl}/query`, {
      params: {
        where: whereClause,
        outFields: '*',
        returnGeometry: false,
        f: 'json',
      },
      timeout: 15000,
    });

    const features = response.data.features || [];
    if (features.length === 0) {
      console.log(`  ⚠️  No data found for ${address}`);
      return null;
    }

    // If multiple matches, try to find exact address match
    if (features.length > 1 && fields?.address) {
      const exactMatch = features.find((f: any) =>
        f.attributes[fields.address]?.toLowerCase().includes(address.toLowerCase())
      );
      if (exactMatch) return exactMatch.attributes;
    }

    return features[0].attributes;
  } catch (error: any) {
    console.error(`  ❌ API error: ${error.message}`);
    return null;
  }
}

/**
 * Enrich a single property
 */
async function enrichProperty(
  capsuleId: string,
  address: string,
  city: string,
  state: string,
  parcelId?: string
): Promise<PropertyEnrichmentData | null> {
  // Determine which county API to use
  const countyKey = `${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`;
  let config = COUNTY_APIS[countyKey];

  // Fallback to county-level API if city not found
  if (!config) {
    const stateCountyKeys = Object.keys(COUNTY_APIS).filter(k => k.endsWith(`-${state.toLowerCase()}`));
    if (stateCountyKeys.length > 0) {
      config = COUNTY_APIS[stateCountyKeys[0]];
      console.log(`  ℹ️  Using ${config.name} API (fallback)`);
    }
  }

  if (!config) {
    console.log(`  ⚠️  No API configured for ${city}, ${state}`);
    return null;
  }

  console.log(`  🔍 Fetching from ${config.name}...`);

  const rawData = await fetchPropertyDataArcGIS(
    config.parcelServiceUrl,
    address,
    parcelId,
    config.fields
  );

  if (!rawData) return null;

  // Extract fields
  const totalAssessed = rawData[config.fields.totalAssessed];
  const landAssessed = rawData[config.fields.landAssessed];
  const improvAssessed = rawData[config.fields.improvAssessed];
  const yearBuilt = rawData[config.fields.yearBuilt];
  const luCode = rawData[config.fields.luCode];
  const lotSize = rawData[config.fields.lotSize];
  const ownerName = rawData[config.fields.owner];

  // Try to extract units (not always available)
  let units: number | undefined;
  const unitsField = rawData['UNITS'] || rawData['Units'] || rawData['NUM_UNITS'];
  if (unitsField) {
    units = parseInt(unitsField);
  } else if (luCode) {
    units = inferUnitsFromLandUseCode(luCode, rawData['TOTAL_LVG_AREA']) || undefined;
  }

  // Try to extract square footage
  let totalSqft: number | undefined;
  const sqftField = rawData['TOTAL_LVG_AREA'] || rawData['BLD_AREA'] || rawData['HEATED_AREA'];
  if (sqftField) {
    totalSqft = parseInt(sqftField);
  }

  // Infer sqft breakdown
  const sqftBreakdown = totalSqft ? inferSqftBreakdown(totalSqft, units) : {};

  const enrichmentData: PropertyEnrichmentData = {
    units,
    total_sqft: totalSqft,
    habitable_sqft: sqftBreakdown.habitable,
    amenity_sqft: sqftBreakdown.amenity,
    leasing_office_sqft: sqftBreakdown.leasing_office,
    year_built: yearBuilt ? parseInt(yearBuilt) : undefined,
    lot_size_acres: lotSize ? parseFloat(lotSize) : undefined,
    assessed_value: totalAssessed ? parseFloat(totalAssessed) : undefined,
    assessed_land: landAssessed ? parseFloat(landAssessed) : undefined,
    assessed_improvements: improvAssessed ? parseFloat(improvAssessed) : undefined,
    parcel_id: parcelId || rawData[config.fields.parcelId],
    owner_name: ownerName,
    use_code: luCode,
    enrichment_source: config.name,
  };

  // Calculate annual taxes (if we have millage rate, otherwise rough estimate)
  if (enrichmentData.assessed_value) {
    // Typical GA millage: ~40 mills (4%)
    // Typical FL millage: ~20 mills (2%)
    const estimatedMillage = state === 'GA' ? 40 : 20;
    enrichmentData.annual_taxes = (enrichmentData.assessed_value * estimatedMillage) / 1000;
  }

  return enrichmentData;
}

/**
 * Update deal capsule with enriched data
 */
async function updateDealCapsule(
  capsuleId: string,
  enrichmentData: PropertyEnrichmentData
): Promise<void> {
  try {
    // Fetch current deal_data
    const result = await pool.query(
      'SELECT deal_data FROM deal_capsules WHERE id = $1',
      [capsuleId]
    );

    if (result.rows.length === 0) {
      console.error(`  ❌ Capsule ${capsuleId} not found`);
      return;
    }

    const dealData = result.rows[0].deal_data || {};

    // Update deal_data with enriched fields
    const updatedDealData = {
      ...dealData,
      units: enrichmentData.units || dealData.units,
      total_sqft: enrichmentData.total_sqft || dealData.total_sqft,
      habitable_sqft: enrichmentData.habitable_sqft || dealData.habitable_sqft,
      amenity_sqft: enrichmentData.amenity_sqft || dealData.amenity_sqft,
      leasing_office_sqft: enrichmentData.leasing_office_sqft || dealData.leasing_office_sqft,
      year_built: enrichmentData.year_built || dealData.year_built,
      lot_size_acres: enrichmentData.lot_size_acres || dealData.lot_size_acres,
      parcel_id: enrichmentData.parcel_id || dealData.parcel_id,
      assessed_value: enrichmentData.assessed_value,
      assessed_land: enrichmentData.assessed_land,
      assessed_improvements: enrichmentData.assessed_improvements,
      annual_taxes: enrichmentData.annual_taxes,
      owner_name: enrichmentData.owner_name,
      use_code: enrichmentData.use_code,
      enrichment_source: enrichmentData.enrichment_source,
      enriched_at: new Date().toISOString(),
    };

    await pool.query(
      'UPDATE deal_capsules SET deal_data = $1, updated_at = NOW() WHERE id = $2',
      [updatedDealData, capsuleId]
    );

    console.log(`  ✅ Updated capsule ${capsuleId}`);
  } catch (error: any) {
    console.error(`  ❌ Error updating capsule: ${error.message}`);
  }
}

/**
 * Main enrichment function
 */
async function enrichAllProperties(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('🏢 PROPERTY DATA ENRICHMENT');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Fetch all deals that need enrichment
    const result = await pool.query(`
      SELECT 
        id,
        property_address,
        deal_data->>'city' as city,
        deal_data->>'state' as state,
        deal_data->>'parcel_id' as parcel_id,
        deal_data->>'units' as units,
        deal_data->>'enriched_at' as enriched_at
      FROM deal_capsules
      WHERE property_address IS NOT NULL
      ORDER BY created_at DESC
    `);

    const deals = result.rows;
    console.log(`Found ${deals.length} deals to enrich\n`);

    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    for (const deal of deals) {
      console.log(`📍 ${deal.property_address}`);

      // Skip if already enriched recently (within 30 days)
      if (deal.enriched_at) {
        const enrichedDate = new Date(deal.enriched_at);
        const daysSinceEnrich = (Date.now() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceEnrich < 30) {
          console.log(`  ⏭️  Skipped (enriched ${Math.floor(daysSinceEnrich)} days ago)\n`);
          skipped++;
          continue;
        }
      }

      // Enrich property
      const enrichmentData = await enrichProperty(
        deal.id,
        deal.property_address,
        deal.city || '',
        deal.state || '',
        deal.parcel_id
      );

      if (enrichmentData) {
        await updateDealCapsule(deal.id, enrichmentData);
        enriched++;
        console.log(`  📊 Units: ${enrichmentData.units || 'N/A'}`);
        console.log(`  📐 Total SF: ${enrichmentData.total_sqft?.toLocaleString() || 'N/A'}`);
        if (enrichmentData.habitable_sqft) {
          console.log(`     ├─ Habitable: ${enrichmentData.habitable_sqft.toLocaleString()} SF`);
        }
        if (enrichmentData.amenity_sqft) {
          console.log(`     ├─ Amenity: ${enrichmentData.amenity_sqft.toLocaleString()} SF`);
        }
        if (enrichmentData.leasing_office_sqft) {
          console.log(`     └─ Leasing/Common: ${enrichmentData.leasing_office_sqft.toLocaleString()} SF`);
        }
      } else {
        failed++;
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('SUMMARY:');
    console.log(`  ✅ Enriched: ${enriched}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('❌ Enrichment failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  enrichAllProperties()
    .then(() => {
      console.log('✅ Enrichment complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Enrichment failed:', error);
      process.exit(1);
    });
}

export { enrichAllProperties, enrichProperty, updateDealCapsule };
