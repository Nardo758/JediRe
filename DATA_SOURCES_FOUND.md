# JediRe Data Sources - Configuration Found

**Analysis Date:** March 7, 2026 12:23 PM EST  
**Method:** Admin API access + codebase inspection

---

## ✅ Found: Municipal API Configuration

### Available Cities (17 configured)

**API Type:** ArcGIS REST API  
**Configuration File:** `backend/src/services/municipal-api-connectors.ts`

| City | State | Service URL | Layer ID | Verified |
|------|-------|-------------|----------|----------|
| **Atlanta** | GA | `gis.atlantaga.gov/dpcd/rest/services/...` | 0 | ✅ |
| **Charlotte** | NC | `gis.charlottenc.gov/arcgis/rest/services/...` | 0 | ✅ |
| **Dallas** | TX | `services5.arcgis.com/...` | 21 | ✅ |
| **San Antonio** | TX | `services.arcgis.com/...` | 12 | ✅ |
| **Nashville** | TN | `maps.nashville.gov/arcgis/rest/services/...` | 14 | ✅ |
| **Memphis** | TN | Memphis API | - | ✅ |
| **New Orleans** | LA | New Orleans API | - | ✅ |
| *+10 more cities* | Various | - | - | ✅ |

### What Municipality APIs Provide

✅ **Property Records:**
- Parcel ID
- Address (standardized)
- Owner name
- Assessed value (land + improvements)
- Annual property taxes
- Lot size (acres/sqft)
- Building square footage
- Year built

✅ **Zoning Data:**
- Zoning code
- District name
- Max density (units/acre)
- Max height (feet)
- Max stories
- Parking requirements
- FAR (floor area ratio)

✅ **Spatial Data:**
- Parcel boundaries (GeoJSON)
- Coordinates (lat/lng)

### Import Methods

**Available Scripts:**
- `backend/src/scripts/seed-municipalities.ts` - Seed municipality config
- `backend/src/scripts/seed-api-municipalities.ts` - Seed API-enabled cities
- `backend/src/scripts/fetch-api-zoning.ts` - Fetch zoning from APIs
- `backend/src/scripts/map-properties-to-zoning.ts` - Map properties to zoning

**Admin API Endpoints:**
- `POST /api/v1/admin/ingest/zoning-districts` - Import zoning districts
- `POST /api/v1/admin/ingest/map-properties-to-zoning` - Map properties

**Connector Class:**
```typescript
// backend/src/services/municipal-api-connectors.ts
export class ArcGISConnector {
  async fetchLayer(layerId: number): Promise<any[]>
  async queryByLocation(layerId: number, lat: number, lng: number): Promise<any>
}
```

**Usage Example:**
```typescript
const atlanta = new ArcGISConnector(
  'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer'
);

// Fetch all zoning districts
const districts = await atlanta.fetchLayer(0);

// Query zoning for specific location
const zoning = await atlanta.queryByLocation(0, 33.8061, -84.3709);
```

---

## ⚠️ Missing: Apartment Locator AI Configuration

### What I Found

**Code References:**
- `backend/src/scripts/enrich-from-apartment-locator.ts` - Enrichment script (exists)
- `backend/src/middleware/auth.ts` - API key auth (configured)
- `rent_comps` table - Referenced in script

**Expected Environment Variables:**
```bash
APARTMENT_LOCATOR_API_URL=???
APARTMENT_LOCATOR_API_KEY=???
```

**Current Status:** ❌ Not configured in environment

### What the Code Expects

**From `enrich-from-apartment-locator.ts`:**

```typescript
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

// Expected API endpoint:
// GET {APARTMENT_LOCATOR_API_URL}/properties/search?lat={lat}&lng={lng}&radius={miles}
```

**Storage Table:** `rent_comps`
```sql
INSERT INTO rent_comps (
  property_id, building_name, address, city, state, zip,
  lat, lng, units, 
  studio_rent, one_bed_rent, two_bed_rent, three_bed_rent,
  occupancy_pct, year_built, rating,
  subject_property_id, market, source
)
```

### What Apartment Locator AI Should Provide

✅ **Rent Data:**
- Rent by unit type (studio, 1BR, 2BR, 3BR)
- Average rent
- Rent trends

✅ **Property Info:**
- Property name (e.g., "Riverside Apartments")
- Unit count
- Occupancy rate
- Year built (to supplement municipality data)

✅ **Marketing Data:**
- Amenities list
- Photos
- Special offers
- Property website
- Contact info

✅ **Competitive Intel:**
- Property rating
- Status (active, under construction, planned)
- Nearby competitors (within radius)

---

## 🤔 Questions for You

### 1. **Is Apartment Locator AI a separate service you control?**
   - [ ] Yes - It's a separate microservice I built
   - [ ] Yes - It's running on another Replit/server
   - [ ] No - It's a third-party service
   - [ ] No - It doesn't exist yet (needs to be built)

### 2. **If it exists, what's the API endpoint?**
   ```
   Base URL: ________________________
   Auth method: [ ] API Key  [ ] Bearer Token  [ ] OAuth  [ ] None
   API Key/Token: ________________________
   ```

### 3. **How does the scraping work?**
   - [ ] Real-time API (query on-demand)
   - [ ] Batch scraper (scrape all properties nightly)
   - [ ] On-demand scraper (send list, receive callback)
   - [ ] Manual import (CSV/JSON upload)

### 4. **What sources does it scrape?**
   - [ ] Apartments.com
   - [ ] Zillow Rentals
   - [ ] Rent.com
   - [ ] Property management websites
   - [ ] Other: ________________________

### 5. **Is there existing scraped data?**
   - [ ] Yes - 7,336 properties mentioned in code comment
   - [ ] Some - partial coverage
   - [ ] No - needs to scrape everything

---

## 🚀 Next Steps (Depending on Answers)

### If Apartment Locator AI EXISTS:
1. Get API endpoint + credentials
2. Add environment variables to `.env` or Replit secrets
3. Test connection: `npx tsx backend/src/scripts/enrich-from-apartment-locator.ts`
4. Run sync for Atlanta properties
5. Verify data in `rent_comps` table
6. Implement merge logic in `DATA_SYNC_ARCHITECTURE.md`

### If Apartment Locator AI DOESN'T EXIST:
1. **Option A:** Build a simple scraper
   - Python + BeautifulSoup/Playwright
   - Target: Apartments.com, Zillow
   - Deploy to separate service
   - Expose REST API

2. **Option B:** Use existing data sources
   - RealPage/RentRange API (paid)
   - CoStar (expensive)
   - ATTOM Data Solutions (paid)
   - Public listings aggregator

3. **Option C:** Manual enrichment (short-term)
   - Export property list
   - Manually research rent comps
   - Import via CSV
   - Automate later

---

## 📊 Current Database Status

**From system analysis:**
- **Total Deals:** 24 (10 active, 13 pipeline)
- **Total Properties:** Unknown (API requires auth)
- **Properties with rent data:** 0 (no Apartment Locator integration active)
- **Municipality data coverage:** 17 cities with API access

**Database Tables:**
- ✅ `properties` - Master table (exists)
- ✅ `municipalities` - Config table (exists, 17+ cities)
- ✅ `zoning_districts` - Zoning data (exists)
- ⚠️  `rent_comps` - Rent comparables (referenced in code, may not exist)
- ❌ `apartment_locator_*` - No dedicated tables found

---

## 📝 Summary

**What's Ready:**
✅ Municipal API integration (17 cities)
✅ ArcGIS connector class (tested)
✅ Zoning import scripts
✅ Database schema for property data
✅ Admin API for triggering imports

**What's Missing:**
❌ Apartment Locator AI configuration
❌ Rent data integration
❌ Photos system
❌ Automated sync workflow

**To Proceed:**
1. **Clarify Apartment Locator AI status** (exists? needs building?)
2. **Get API credentials** (if exists)
3. **OR decide on alternative rent data source** (if doesn't exist)
4. **Implement sync workflow** per `DATA_SYNC_ARCHITECTURE.md`

---

**Created:** 2026-03-07 12:23 PM EST  
**Author:** Leon AI (Admin access analysis)
