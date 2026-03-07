# JediRe Data Synchronization Architecture
**Option C: Full Integration (1 Week)**

## Overview

JediRe integrates two primary data sources:
1. **Municipality API** - Property records (tax, parcel, zoning, ownership)
2. **Apartment Locator AI** - Rent data (competitor intel, unit pricing)

These must be synchronized to create complete property records.

---

## 🏗️ Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MUNICIPALITY API                          │
│  (Tax Records, Parcels, Zoning, Ownership, Legal Desc)      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   JEDIRE PLATFORM                            │
│                                                               │
│  1. Import Properties (base records)                         │
│     • Address, Parcel ID, Owner                              │
│     • Assessed Value, Tax Data                               │
│     • Lot Size, Building SF                                  │
│     • Zoning Code                                            │
│                                                               │
│  2. Geocode & Normalize                                      │
│     • Standardize addresses                                  │
│     • Get lat/lng coordinates                                │
│     • Deduplicate records                                    │
│                                                               │
│  3. Generate Scrape List for Apartment Locator AI           │
│     • Filter: Multifamily properties only                    │
│     • Export: Address, Lat/Lng, Property ID                  │
│     • Format: JSON/CSV for scraper                           │
│                                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 APARTMENT LOCATOR AI                         │
│                                                               │
│  Scrapes competitor websites for:                           │
│    • Property names                                          │
│    • Rent by unit type (studio, 1BR, 2BR, 3BR)              │
│    • Unit counts                                             │
│    • Occupancy rates                                         │
│    • Amenities                                               │
│    • Photos                                                  │
│    • Special offers                                          │
│    • Contact info                                            │
│                                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   JEDIRE PLATFORM                            │
│                                                               │
│  4. Merge Datasets                                           │
│     • Match by address + coordinates                         │
│     • Enrich property records with rent data                 │
│     • Store in unified property table                        │
│                                                               │
│  5. Calculate Metrics                                        │
│     • NOI (from rent data + tax data)                        │
│     • Cap Rate (NOI / Assessed Value)                        │
│     • Rent per SF                                            │
│     • Occupancy trends                                       │
│                                                               │
│  6. Populate PropertyDetailsPage                             │
│     • All 6 tabs now have data                               │
│     • Financial tab: Rent roll + NOI                         │
│     • Market tab: Comps from Apartment Locator               │
│     • Zoning tab: From Municipality API                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Core Tables

#### 1. `properties` (Master Table)
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  
  -- From Municipality API
  parcel_id VARCHAR,
  address_line1 VARCHAR NOT NULL,
  city VARCHAR,
  state_code VARCHAR(2),
  zip VARCHAR(10),
  county VARCHAR,
  
  -- Geocoded
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  
  -- From Municipality API  
  property_type VARCHAR, -- 'Residential', 'Multifamily', 'Commercial'
  lot_size_acres DECIMAL,
  building_sf INTEGER,
  year_built INTEGER,
  assessed_value DECIMAL,
  annual_taxes DECIMAL,
  
  -- From Apartment Locator AI (enriched)
  name VARCHAR,
  units INTEGER,
  rent_studio INTEGER,
  rent_1br INTEGER,
  rent_2br INTEGER,
  rent_3br INTEGER,
  avg_rent INTEGER, -- calculated
  occupancy_rate DECIMAL,
  amenities JSONB,
  photos JSONB,
  website VARCHAR,
  
  -- Calculated
  estimated_noi DECIMAL,
  estimated_cap_rate DECIMAL,
  
  -- Metadata
  municipality_source VARCHAR, -- API identifier
  apartment_locator_id VARCHAR, -- external ID
  last_enriched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `property_sync_queue` (Orchestration)
```sql
CREATE TABLE property_sync_queue (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  
  sync_stage VARCHAR, -- 'pending', 'scraped', 'merged', 'completed', 'failed'
  
  -- Stage tracking
  municipality_imported_at TIMESTAMP,
  geocoded_at TIMESTAMP,
  sent_to_scraper_at TIMESTAMP,
  scraped_at TIMESTAMP,
  merged_at TIMESTAMP,
  
  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. `apartment_locator_scrape_requests` (Outbound)
```sql
CREATE TABLE apartment_locator_scrape_requests (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  
  -- Request payload
  address VARCHAR NOT NULL,
  lat DECIMAL,
  lng DECIMAL,
  property_type VARCHAR,
  
  -- Status
  status VARCHAR, -- 'pending', 'sent', 'completed', 'failed'
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Response
  scrape_result JSONB,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. `apartment_locator_responses` (Inbound)
```sql
CREATE TABLE apartment_locator_responses (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  request_id UUID REFERENCES apartment_locator_scrape_requests(id),
  
  -- Scraped data
  external_id VARCHAR, -- Apartment Locator's property ID
  property_name VARCHAR,
  units INTEGER,
  rent_data JSONB, -- { studio: 1800, 1br: 2200, 2br: 2800 }
  occupancy_rate DECIMAL,
  amenities JSONB,
  photos JSONB,
  rating DECIMAL,
  
  scraped_at TIMESTAMP,
  received_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Sync Workflow Implementation

### Phase 1: Municipality Import (Days 1-2)

**Goal:** Import property records from municipality APIs

**Implementation:**
```typescript
// backend/src/services/municipality-sync.service.ts

interface MunicipalityAPIConfig {
  name: string;
  baseUrl: string;
  authKey?: string;
  endpoints: {
    properties: string;
    parcels: string;
    zoning: string;
  };
}

class MunicipalitySyncService {
  /**
   * Import properties from a municipality API
   */
  async importFromMunicipality(
    municipalityId: string,
    filters?: {
      propertyTypes?: string[];
      minValue?: number;
      bounds?: { north: number; south: number; east: number; west: number };
    }
  ): Promise<ImportResult> {
    // 1. Fetch from municipality API
    const properties = await this.fetchMunicipalityProperties(municipalityId, filters);
    
    // 2. Transform to JediRe schema
    const transformed = properties.map(p => this.transformMunicipalityData(p));
    
    // 3. Bulk insert/upsert
    await this.bulkUpsertProperties(transformed);
    
    // 4. Add to sync queue
    await this.queueForEnrichment(transformed.map(p => p.id));
    
    return {
      imported: transformed.length,
      queued: transformed.length
    };
  }
  
  /**
   * Geocode properties that don't have coordinates
   */
  async geocodeProperties(): Promise<void> {
    const ungeocodedProps = await query(`
      SELECT id, address_line1, city, state_code, zip
      FROM properties
      WHERE lat IS NULL OR lng IS NULL
      LIMIT 100
    `);
    
    for (const prop of ungeocodedProps.rows) {
      const coords = await this.geocode(prop.address_line1, prop.city, prop.state_code);
      
      await query(`
        UPDATE properties
        SET lat = $1, lng = $2, updated_at = NOW()
        WHERE id = $3
      `, [coords.lat, coords.lng, prop.id]);
    }
  }
}
```

**API Endpoint:**
```typescript
// POST /api/v1/admin/sync/municipality/import
router.post('/sync/municipality/import', requireAdminAuth, async (req, res) => {
  const { municipalityId, filters } = req.body;
  
  const result = await municipalitySyncService.importFromMunicipality(
    municipalityId,
    filters
  );
  
  res.json({
    success: true,
    imported: result.imported,
    queued: result.queued
  });
});
```

---

### Phase 2: Apartment Locator Integration (Days 3-4)

**Goal:** Send property list to Apartment Locator AI and receive scraped data

**2A: Export Property List for Scraper**
```typescript
// backend/src/services/apartment-locator-sync.service.ts

class ApartmentLocatorSyncService {
  /**
   * Generate scrape list for Apartment Locator AI
   */
  async generateScrapeList(): Promise<ScrapeRequest[]> {
    // Get properties that need scraping
    const props = await query(`
      SELECT p.id, p.address_line1, p.city, p.state_code, p.zip, p.lat, p.lng
      FROM properties p
      LEFT JOIN apartment_locator_responses alr ON alr.property_id = p.id
      WHERE p.property_type = 'Multifamily'
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND (alr.id IS NULL OR alr.scraped_at < NOW() - INTERVAL '30 days')
      LIMIT 1000
    `);
    
    const requests = [];
    
    for (const prop of props.rows) {
      // Create scrape request
      const requestId = await query(`
        INSERT INTO apartment_locator_scrape_requests
        (property_id, address, lat, lng, property_type, status)
        VALUES ($1, $2, $3, $4, 'Multifamily', 'pending')
        RETURNING id
      `, [prop.id, prop.address_line1, prop.lat, prop.lng]);
      
      requests.push({
        request_id: requestId.rows[0].id,
        property_id: prop.id,
        address: prop.address_line1,
        city: prop.city,
        state: prop.state_code,
        zip: prop.zip,
        lat: prop.lat,
        lng: prop.lng
      });
    }
    
    return requests;
  }
  
  /**
   * Send batch scrape request to Apartment Locator AI
   */
  async sendScrapeRequest(properties: ScrapeRequest[]): Promise<void> {
    const APARTMENT_LOCATOR_URL = process.env.APARTMENT_LOCATOR_API_URL;
    const API_KEY = process.env.APARTMENT_LOCATOR_API_KEY;
    
    const response = await fetch(`${APARTMENT_LOCATOR_URL}/scrape/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        properties,
        callback_url: `${process.env.JEDIRE_BASE_URL}/api/v1/webhooks/apartment-locator`,
        priority: 'normal' // 'urgent', 'normal', 'low'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Apartment Locator API error: ${response.status}`);
    }
    
    // Mark requests as sent
    const requestIds = properties.map(p => p.request_id);
    await query(`
      UPDATE apartment_locator_scrape_requests
      SET status = 'sent', sent_at = NOW()
      WHERE id = ANY($1)
    `, [requestIds]);
  }
}
```

**2B: Webhook to Receive Scraped Data**
```typescript
// backend/src/api/rest/webhooks/apartment-locator.routes.ts

router.post('/apartment-locator', async (req: Request, res: Response) => {
  const { request_id, property_id, data, error } = req.body;
  
  if (error) {
    // Log error
    await query(`
      UPDATE apartment_locator_scrape_requests
      SET status = 'failed', error_message = $1
      WHERE id = $2
    `, [error, request_id]);
    
    return res.json({ received: true });
  }
  
  // Store scraped data
  await query(`
    INSERT INTO apartment_locator_responses
    (property_id, request_id, external_id, property_name, units, rent_data, 
     occupancy_rate, amenities, photos, rating, scraped_at, received_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
  `, [
    property_id,
    request_id,
    data.external_id,
    data.name,
    data.units,
    JSON.stringify(data.rent_data),
    data.occupancy_rate,
    JSON.stringify(data.amenities),
    JSON.stringify(data.photos),
    data.rating,
    data.scraped_at
  ]);
  
  // Mark request complete
  await query(`
    UPDATE apartment_locator_scrape_requests
    SET status = 'completed', completed_at = NOW(), scrape_result = $1
    WHERE id = $2
  `, [JSON.stringify(data), request_id]);
  
  // Trigger merge
  await apartmentLocatorSyncService.mergeScrapedData(property_id);
  
  res.json({ received: true });
});
```

**API Endpoints:**
```typescript
// POST /api/v1/admin/sync/apartment-locator/generate-list
// GET  /api/v1/admin/sync/apartment-locator/status
// POST /api/v1/webhooks/apartment-locator (callback from scraper)
```

---

### Phase 3: Data Merge & Enrichment (Days 5-6)

**Goal:** Merge municipality data + scraped data into complete property records

```typescript
class DataMergeService {
  /**
   * Merge scraped data with property record
   */
  async mergeScrapedData(propertyId: string): Promise<void> {
    // Get latest scraped data
    const scraped = await query(`
      SELECT * FROM apartment_locator_responses
      WHERE property_id = $1
      ORDER BY scraped_at DESC
      LIMIT 1
    `, [propertyId]);
    
    if (scraped.rows.length === 0) return;
    
    const data = scraped.rows[0];
    
    // Update property record
    await query(`
      UPDATE properties SET
        name = COALESCE($1, name),
        units = COALESCE($2, units),
        rent_studio = COALESCE(($3::jsonb->>'studio')::integer, rent_studio),
        rent_1br = COALESCE(($3::jsonb->>'1br')::integer, rent_1br),
        rent_2br = COALESCE(($3::jsonb->>'2br')::integer, rent_2br),
        rent_3br = COALESCE(($3::jsonb->>'3br')::integer, rent_3br),
        occupancy_rate = COALESCE($4, occupancy_rate),
        amenities = COALESCE($5, amenities),
        photos = COALESCE($6, photos),
        website = COALESCE($7, website),
        apartment_locator_id = $8,
        last_enriched_at = NOW(),
        updated_at = NOW()
      WHERE id = $9
    `, [
      data.property_name,
      data.units,
      data.rent_data,
      data.occupancy_rate,
      data.amenities,
      data.photos,
      data.website,
      data.external_id,
      propertyId
    ]);
    
    // Calculate metrics
    await this.calculateMetrics(propertyId);
    
    // Update sync queue
    await query(`
      UPDATE property_sync_queue
      SET sync_stage = 'completed', merged_at = NOW()
      WHERE property_id = $1
    `, [propertyId]);
  }
  
  /**
   * Calculate derived metrics
   */
  async calculateMetrics(propertyId: string): Promise<void> {
    await query(`
      UPDATE properties
      SET 
        avg_rent = (
          COALESCE(rent_studio, 0) + 
          COALESCE(rent_1br, 0) + 
          COALESCE(rent_2br, 0) + 
          COALESCE(rent_3br, 0)
        ) / NULLIF(
          (CASE WHEN rent_studio IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN rent_1br IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN rent_2br IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN rent_3br IS NOT NULL THEN 1 ELSE 0 END), 0
        ),
        estimated_noi = (
          COALESCE(avg_rent, 0) * 12 * COALESCE(units, 1) * COALESCE(occupancy_rate, 0.95) * 0.6
        ),
        estimated_cap_rate = CASE 
          WHEN COALESCE(assessed_value, 0) > 0 
          THEN (estimated_noi / assessed_value) * 100
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = $1
    `, [propertyId]);
  }
}
```

---

### Phase 4: Cron Jobs & Monitoring (Day 7)

**Automated Sync Schedule:**

```typescript
// backend/src/jobs/data-sync.jobs.ts

import cron from 'node-cron';

// Daily: Import new properties from municipality
cron.schedule('0 2 * * *', async () => {
  logger.info('Starting daily municipality import...');
  await municipalitySyncService.importFromMunicipality('atlanta-fulton', {
    propertyTypes: ['Multifamily'],
    minValue: 500000
  });
});

// Daily: Geocode properties missing coordinates
cron.schedule('0 3 * * *', async () => {
  logger.info('Starting geocoding job...');
  await municipalitySyncService.geocodeProperties();
});

// Daily: Generate scrape list and send to Apartment Locator
cron.schedule('0 4 * * *', async () => {
  logger.info('Generating scrape list for Apartment Locator...');
  const list = await apartmentLocatorSyncService.generateScrapeList();
  
  if (list.length > 0) {
    await apartmentLocatorSyncService.sendScrapeRequest(list);
    logger.info(`Sent ${list.length} properties to Apartment Locator`);
  }
});

// Hourly: Process incoming scraped data
cron.schedule('0 * * * *', async () => {
  logger.info('Processing scraped data...');
  const pending = await query(`
    SELECT DISTINCT property_id 
    FROM apartment_locator_responses
    WHERE received_at > NOW() - INTERVAL '1 hour'
  `);
  
  for (const row of pending.rows) {
    await dataMergeService.mergeScrapedData(row.property_id);
  }
});
```

**Monitoring Dashboard:**
```typescript
// GET /api/v1/admin/sync/status

router.get('/sync/status', requireAdminAuth, async (req, res) => {
  const stats = await query(`
    SELECT 
      COUNT(*) as total_properties,
      COUNT(*) FILTER (WHERE lat IS NOT NULL) as geocoded,
      COUNT(*) FILTER (WHERE last_enriched_at IS NOT NULL) as enriched,
      COUNT(*) FILTER (WHERE last_enriched_at > NOW() - INTERVAL '30 days') as recently_enriched,
      AVG(CASE WHEN avg_rent IS NOT NULL THEN 1 ELSE 0 END) as pct_with_rent,
      AVG(CASE WHEN photos IS NOT NULL THEN 1 ELSE 0 END) as pct_with_photos
    FROM properties
    WHERE property_type = 'Multifamily'
  `);
  
  const queueStatus = await query(`
    SELECT sync_stage, COUNT(*) as count
    FROM property_sync_queue
    GROUP BY sync_stage
  `);
  
  res.json({
    properties: stats.rows[0],
    queue: queueStatus.rows,
    lastSync: await getLastSyncTimestamp()
  });
});
```

---

## 🚀 Implementation Timeline

### Week 1: Full Integration

**Day 1-2: Municipality Import**
- [ ] Create municipality sync service
- [ ] Implement API connectors for Atlanta/Fulton County
- [ ] Build geocoding service
- [ ] Test import of 100 properties
- [ ] Validate data quality

**Day 3-4: Apartment Locator Integration**
- [ ] Create scrape request generator
- [ ] Build webhook receiver
- [ ] Test with 10 properties
- [ ] Implement retry logic
- [ ] Document API contract with Apartment Locator team

**Day 5-6: Data Merge & Enrichment**
- [ ] Build merge service
- [ ] Implement metric calculations (NOI, cap rate)
- [ ] Test with merged dataset
- [ ] Fix auth inconsistency (property details endpoint)
- [ ] Validate PropertyDetailsPage with real data

**Day 7: Automation & Monitoring**
- [ ] Set up cron jobs
- [ ] Build sync monitoring dashboard
- [ ] Test end-to-end flow
- [ ] Create admin UI for manual triggers
- [ ] Document runbooks

---

## 🎯 Success Metrics

After 1 week, you should have:

✅ **100+ properties** with complete data:
- Municipality data (tax, parcel, zoning) ✅
- Scraped rent data (from Apartment Locator) ✅
- Geocoded coordinates ✅
- Calculated metrics (NOI, cap rate) ✅
- Photos ✅

✅ **PropertyDetailsPage** fully functional:
- Overview tab: Photos + stats ✅
- Financial tab: Rent roll + NOI ✅
- Comparables tab: M27 comps ✅
- Zoning tab: Municipality data ✅
- Market tab: Demographics + trends ✅
- Documents tab: Tax records ✅

✅ **Automated sync** running daily:
- New properties imported ✅
- Scraped data updated ✅
- Metrics recalculated ✅
- Admin dashboard shows status ✅

✅ **User experience** fixed:
- No auth blockers ✅
- Property details load ✅
- Dashboard shows data ✅
- Maps have pins ✅

---

## 🔧 Environment Variables Needed

```bash
# Municipality APIs
ATLANTA_FULTON_API_URL=https://api.fultoncountyga.gov
ATLANTA_FULTON_API_KEY=...

# Apartment Locator AI
APARTMENT_LOCATOR_API_URL=https://apartment-locator-ai.com/api
APARTMENT_LOCATOR_API_KEY=...
APARTMENT_LOCATOR_WEBHOOK_SECRET=...

# Geocoding
GOOGLE_MAPS_API_KEY=...
# OR
MAPBOX_API_KEY=...

# JediRe
JEDIRE_BASE_URL=https://jedire.com
```

---

## 📝 Next Steps

1. **Confirm Apartment Locator AI API contract**
   - What's the endpoint for batch scrape requests?
   - How does the callback/webhook work?
   - What's the expected response format?
   - Rate limits?

2. **Confirm Municipality API access**
   - Do you have API keys for Atlanta/Fulton County?
   - What's the API documentation URL?
   - Property query endpoints?

3. **Decide on geocoding service**
   - Google Maps Geocoding API? (paid)
   - Mapbox? (paid)
   - OpenStreetMap Nominatim? (free, rate-limited)

Once confirmed, I'll implement the full sync system.

**Ready to start?** Let me know the API details and I'll begin implementation.
