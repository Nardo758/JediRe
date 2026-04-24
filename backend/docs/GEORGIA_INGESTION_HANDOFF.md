# Georgia Metro Data Ingestion - Complete Handoff for Replit

## Overview

This document provides everything Replit needs to complete the Georgia Metro data ingestion pipelines and connect them to the Property Identity Resolver system.

---

## Architecture: How It All Connects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. MUNICIPAL DATA INGESTION (New - Georgia Counties)
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │    Cobb     │   │  Gwinnett   │   │   DeKalb    │   │   Fulton    │
   │  (927K     │   │  (LRSN     │   │  (Permit    │   │  (Spatial   │
   │   sales)    │   │   joins)    │   │   match)    │   │   join)     │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                 │                 │                 │
          └─────────────────┼─────────────────┼─────────────────┘
                            ▼
               ┌────────────────────────┐
               │  property_info_cache   │  ← Unified storage
               │  + property_sales      │
               └───────────┬────────────┘
                           │
                           ▼
2. PROPERTY DISCOVERY (Existing)
   ┌────────────────────────────────────────┐
   │     PropertyDiscoveryService           │
   │   - Find 100+ unit multifamily         │
   │   - Use ingested data as source        │
   └───────────────────┬────────────────────┘
                       │
                       ▼
               ┌────────────────────────┐
               │  discovered_properties │
               └───────────┬────────────┘
                           │
                           ▼
3. PROPERTY MATCHING (Existing)
   ┌────────────────────────────────────────┐
   │     PropertyMatcherService             │
   │   - Match discovered → Apt Locator AI  │
   │   - Fuzzy address + name matching      │
   └───────────────────┬────────────────────┘
                       │
                       ▼
               ┌────────────────────────┐
               │   property_matches     │
               │   + apartment_locator  │
               └───────────┬────────────┘
                           │
                           ▼
4. DATA LIBRARY ENRICHMENT (Existing)
   ┌────────────────────────────────────────┐
   │    DataLibraryAutoEnrichmentService    │
   │   - Fill gaps in uploaded deals        │
   │   - Use matched data for rent info     │
   └───────────────────┬────────────────────┘
                       │
                       ▼
               ┌────────────────────────┐
               │   data_library_assets  │
               │   (enriched deals)     │
               └────────────────────────┘
```

---

## Database Tables Required

### Already Migrated (Run these if not already):
- `20260423_property_enrichment.sql` - Provider registry, enrichment jobs, property_info_cache, property_rent_data
- `20260423_property_discovery_matching.sql` - discovered_properties, apartment_locator_properties, property_matches, discovery_jobs

### New Tables Needed for Georgia Ingestion:

```sql
-- Property Sales (for Cobb's 927K sales + Fulton + Gwinnett)
CREATE TABLE IF NOT EXISTS property_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  parcel_id TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  
  -- Sale info
  sale_date DATE NOT NULL,
  sale_price DECIMAL(15, 2) NOT NULL,
  sale_type TEXT, -- 'Warranty Deed', 'Quit Claim', etc.
  qualified BOOLEAN, -- Is this a qualified (arm's length) sale?
  
  -- Grantor/Grantee
  grantor_name TEXT,
  grantee_name TEXT,
  
  -- Recording info
  book TEXT,
  page TEXT,
  instrument_type TEXT,
  
  -- Source
  provider TEXT NOT NULL,
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(parcel_id, county, state, sale_date, sale_price)
);

CREATE INDEX idx_property_sales_parcel ON property_sales(parcel_id, county, state);
CREATE INDEX idx_property_sales_date ON property_sales(sale_date DESC);
CREATE INDEX idx_property_sales_price ON property_sales(sale_price);

-- Ingestion Jobs Tracking
CREATE TABLE IF NOT EXISTS georgia_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'GA',
  job_type TEXT NOT NULL CHECK (job_type IN ('full', 'parcels', 'sales', 'yearbuilt')),
  
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  
  total_records INT DEFAULT 0,
  processed_records INT DEFAULT 0,
  inserted_records INT DEFAULT 0,
  updated_records INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add Georgia counties to providers
INSERT INTO property_data_providers (provider_type, provider_name, display_name, coverage_states, priority, is_active, api_config)
VALUES
  ('property_info', 'cobb_ga', 'Cobb County, GA', ARRAY['GA'], 100, true, 
   '{"baseUrl": "https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer", "parcelsLayer": 0, "yearBuiltTable": 5, "salesTable": 9}'::jsonb),
  ('property_info', 'gwinnett_ga', 'Gwinnett County, GA', ARRAY['GA'], 100, true,
   '{"baseUrl": "https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer", "joinKey": "LRSN"}'::jsonb),
  ('property_info', 'dekalb_ga', 'DeKalb County, GA', ARRAY['GA'], 100, true,
   '{"parcelsUrl": "https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/MapServer", "permitsUrl": "https://dcgis.dekalbcountyga.gov/building/rest/services/Building_Permit_Applications/FeatureServer"}'::jsonb),
  ('property_info', 'fulton_ga', 'Fulton County, GA', ARRAY['GA'], 100, true,
   '{"parcelsUrl": "https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tax_Parcels_2025/FeatureServer", "salesUrl": "https://services1.arcgis.com/jXZcOJp6qFkhsZyH/arcgis/rest/services/Tyler_YearlySales/FeatureServer"}'::jsonb)
ON CONFLICT (provider_type, provider_name) DO UPDATE
SET api_config = EXCLUDED.api_config,
    display_name = EXCLUDED.display_name;
```

---

## Files to Implement

### Georgia Ingestion Services (Already Created - Need DB Wiring)

| File | Description | TODO |
|------|-------------|------|
| `georgia/types.ts` | All TypeScript interfaces | ✅ Done |
| `georgia/arcgis-client.ts` | Generic ArcGIS REST client | ✅ Done |
| `georgia/cobb-ingestion.service.ts` | Cobb County | Wire `saveProperty()`, `saveSales()` |
| `georgia/gwinnett-ingestion.service.ts` | Gwinnett County | Wire `saveProperty()`, `saveSales()` |
| `georgia/dekalb-ingestion.service.ts` | DeKalb County | Wire `saveProperty()` |
| `georgia/fulton-ingestion.service.ts` | Fulton County | Wire `saveProperty()`, `saveSales()` + PostGIS spatial join |
| `georgia/georgia-orchestrator.ts` | Run all counties | ✅ Done |
| `georgia-ingestion.routes.ts` | API endpoints | ✅ Done |

### Integration Points to Wire

1. **saveProperty()** in each county service should:
```typescript
async saveProperty(property: EnrichedProperty): Promise<void> {
  await db.query(`
    INSERT INTO property_info_cache (
      parcel_id, address, city, state, county,
      year_built, number_of_units, living_area_sqft, stories,
      land_value, building_value, just_value, assessed_value,
      owner_name, zoning, property_type,
      provider, fetched_at, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (parcel_id, county, state) 
    DO UPDATE SET
      year_built = COALESCE(EXCLUDED.year_built, property_info_cache.year_built),
      number_of_units = COALESCE(EXCLUDED.number_of_units, property_info_cache.number_of_units),
      -- ... etc
      updated_at = NOW()
  `, [property.parcelId, property.address, property.city, ...]);
}
```

2. **saveSales()** should:
```typescript
async saveSales(parcelId: string, sales: PropertySale[]): Promise<void> {
  for (const sale of sales) {
    await db.query(`
      INSERT INTO property_sales (
        parcel_id, county, state, sale_date, sale_price,
        sale_type, qualified, grantor_name, provider
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (parcel_id, county, state, sale_date, sale_price) DO NOTHING
    `, [parcelId, sale.county, sale.state, sale.saleDate, sale.salePrice, ...]);
  }
}
```

---

## Property Discovery Integration

The `PropertyDiscoveryService` needs to use ingested Georgia data:

```typescript
// In property-discovery.service.ts, update getCountyConfig()
// to include Georgia counties

// Add to COUNTY_CONFIGS in county-configs.ts:
{
  county: 'Cobb',
  state: 'GA',
  parcelsEndpoint: 'https://gis.cobbcounty.gov/gisserver/rest/services/tax/taxassessorsdaily/MapServer',
  parcelsLayerId: 0,
  fieldMappings: {
    parcelId: 'PARID',
    fullAddress: 'SITUS_ADDR',
    ownerName: 'OWNER_NAM1',
    numberOfUnits: 'HAS_MULTIUNIT', // Need to derive from YearBuilt table
    justValue: 'FMV_TOTAL'
  }
},
// ... similar for Gwinnett, DeKalb, Fulton
```

**Alternative approach**: Run discovery AFTER ingestion, querying the `property_info_cache` directly:

```typescript
async discoverFromCache(county: string, state: string, minUnits: number = 100) {
  const result = await db.query(`
    SELECT * FROM property_info_cache
    WHERE county = $1 AND state = $2
      AND number_of_units >= $3
      AND property_type = 'multifamily'
  `, [county, state, minUnits]);
  
  // Insert into discovered_properties
  for (const row of result.rows) {
    // Check if already discovered
    // Insert or update
  }
}
```

---

## Property Matching Integration

Once properties are discovered, the `PropertyMatcherService` matches them with Apartment Locator AI data.

**Current stub methods to implement:**

```typescript
// In property-matcher.service.ts

private async getDiscoveredProperties(county: string, state: string): Promise<DiscoveredProperty[]> {
  const result = await db.query(`
    SELECT * FROM discovered_properties
    WHERE county = $1 AND state = $2 AND match_status = 'unmatched'
  `, [county, state]);
  return result.rows;
}

private async getApartmentLocatorProperties(county: string, state: string): Promise<ApartmentLocatorProperty[]> {
  // Get properties in the same cities as discovered properties
  const result = await db.query(`
    SELECT al.* 
    FROM apartment_locator_properties al
    WHERE al.state = $1
      AND al.city IN (
        SELECT DISTINCT city FROM discovered_properties 
        WHERE county = $2 AND state = $1
      )
  `, [state, county]);
  return result.rows;
}

async confirmMatch(matchResultId: string, userId: string, notes?: string): Promise<void> {
  await db.query(`
    UPDATE property_matches 
    SET status = 'confirmed', reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
    WHERE id = $1
  `, [matchResultId, userId, notes]);
  
  // Update discovered property
  await db.query(`
    UPDATE discovered_properties dp
    SET match_status = 'matched',
        apartment_locator_id = pm.apartment_locator_id,
        match_confidence = pm.confidence,
        matched_at = NOW(),
        matched_by = $2
    FROM property_matches pm
    WHERE pm.id = $1 AND dp.id = pm.discovered_property_id
  `, [matchResultId, userId]);
}
```

---

## Data Library Auto-Enrichment

When users upload deals, the system should automatically enrich them:

```typescript
// In auto-enrichment.service.ts, wire these methods:

private async fetchPropertyInfo(asset: DataLibraryAsset): Promise<PropertyInfo | null> {
  // First check the cache (includes Georgia data)
  const cached = await db.query(`
    SELECT * FROM property_info_cache
    WHERE address ILIKE $1 AND city ILIKE $2 AND state = $3
    ORDER BY fetched_at DESC
    LIMIT 1
  `, [asset.address, asset.city, asset.state]);
  
  if (cached.rows[0]) {
    return this.mapCacheToPropertyInfo(cached.rows[0]);
  }
  
  // If not cached, fetch from API
  return this.enrichmentOrchestrator.fetchPropertyInfo(...);
}

private async findApartmentLocatorMatch(asset: DataLibraryAsset): Promise<RentData | null> {
  // Check if there's a matched property
  const matched = await db.query(`
    SELECT al.*
    FROM apartment_locator_properties al
    JOIN property_matches pm ON pm.apartment_locator_id = al.id
    JOIN discovered_properties dp ON dp.id = pm.discovered_property_id
    WHERE pm.status IN ('confirmed', 'auto_matched')
      AND dp.address ILIKE $1
      AND dp.city ILIKE $2
      AND dp.state = $3
  `, [asset.address, asset.city, asset.state]);
  
  if (matched.rows[0]) {
    return this.mapToRentData(matched.rows[0]);
  }
  
  return null;
}
```

---

## API Routes Summary

### Georgia Ingestion Routes (New)
```
POST /api/v1/georgia/ingest                    # Run all counties
POST /api/v1/georgia/ingest/sales              # Sales only
GET  /api/v1/georgia/multifamily/count         # MF counts
POST /api/v1/georgia/cobb/ingest               # Cobb only
GET  /api/v1/georgia/cobb/parcel/:parid/sales  # Sales lookup
POST /api/v1/georgia/gwinnett/ingest           # Gwinnett only
GET  /api/v1/georgia/gwinnett/property/:lrsn   # Property lookup
POST /api/v1/georgia/dekalb/ingest             # DeKalb only
GET  /api/v1/georgia/dekalb/permits/search     # Permit search
POST /api/v1/georgia/fulton/ingest             # Fulton only
GET  /api/v1/georgia/fulton/structures/sql     # PostGIS SQL
```

### Property Discovery Routes (Existing)
```
POST /api/v1/property-discovery/discover       # Run discovery
GET  /api/v1/property-discovery/stats          # Discovery stats
GET  /api/v1/property-discovery/unmatched      # Unmatched list
```

### Property Enrichment Routes (Existing)
```
POST /api/v1/property-enrichment/enrich        # Enrich a property
GET  /api/v1/property-enrichment/profile       # Get full profile
POST /api/v1/property-enrichment/batch         # Batch enrichment
```

---

## Fulton County Spatial Join

Fulton's Structures layer requires PostGIS spatial join because FeatureID ≠ ParcelID.

**After loading structures with geometry:**

```sql
-- Run in PostGIS after loading Fulton parcels and structures
-- Step 1: Add geometry columns if not present
ALTER TABLE property_info_cache ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Step 2: Load Fulton structures into temp table with geometry
CREATE TEMP TABLE fulton_structures_temp AS
SELECT 
  "FeatureID" as feature_id,
  "YearBuilt" as year_built,
  "Stories" as stories,
  "LiveUnits" as live_units,
  "AreaSqFt" as area_sqft,
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) as geom
FROM fulton_structures_raw;

-- Step 3: Spatial join to update property_info_cache
UPDATE property_info_cache pic
SET 
  year_built = COALESCE(pic.year_built, s.year_built),
  stories = COALESCE(pic.stories, s.stories),
  number_of_units = COALESCE(pic.number_of_units, s.live_units),
  living_area_sqft = COALESCE(pic.living_area_sqft, s.area_sqft)
FROM fulton_structures_temp s
WHERE pic.county = 'Fulton' 
  AND pic.state = 'GA'
  AND ST_Intersects(s.geom, pic.geom);
```

---

## Testing Checklist

1. [ ] Run migrations: `20260423_property_enrichment.sql`, `20260423_property_discovery_matching.sql`, + new `property_sales` table
2. [ ] Test Cobb ingestion: `POST /api/v1/georgia/cobb/ingest { "maxRecords": 1000 }` (limit for testing)
3. [ ] Verify data in `property_info_cache` and `property_sales`
4. [ ] Test discovery: `POST /api/v1/property-discovery/discover { "county": "Cobb", "state": "GA", "minUnits": 100 }`
5. [ ] Verify data in `discovered_properties`
6. [ ] Test matching: `POST /api/v1/property-enrichment/match { "county": "Cobb", "state": "GA" }`
7. [ ] Verify matches in `property_matches`
8. [ ] Test Data Library enrichment with a Georgia property

---

## Environment Variables

No new secrets required. All Georgia county APIs are public ArcGIS REST services.

---

## Questions for Replit

1. **Database connection**: How is `db.query()` implemented? Need to wire the save methods.
2. **PostGIS**: Is PostGIS extension enabled? Needed for Fulton spatial join and location indexing.
3. **Background jobs**: Should ingestion run as Inngest jobs? (Recommended for 927K Cobb sales)
4. **Rate limiting**: Current code has 100ms delay between batches. Adjust if needed.

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Cobb first | Richest data (927K sales back to 2002), cleanest joins |
| LRSN for Gwinnett | PIN formats differ between tables; LRSN is consistent |
| CO date = year built (DeKalb) | IASWorld returns NULL; permit CO date is authoritative |
| Spatial join for Fulton | Structures.FeatureID ≠ Tax_Parcels.ParcelID |
| Filter PRICE < $500M | Cobb has a $6B data error sale |

---

## Contact

This was built by RockeMan 🚀 via OpenClaw for Leon. Ping in Telegram if questions.
