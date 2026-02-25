# JediRe - All API Connections

## Property Assessment APIs

### 1. Fulton County Board of Assessors (GA)
- **Type:** ArcGIS REST API
- **Base:** `https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0`
- **Auth:** None (public)
- **Data:** Parcel ID, Owner, Address, Assessed Value, Lot Size, Units
- **Implementation:** `municipal-scraper/src/scrapers/fulton-county-api.ts`

### 2. DeKalb County Board of Tax Assessors (GA)
- **Type:** ArcGIS REST API
- **Base:** `https://gis.dekalbcountyga.gov/arcgis/rest/services/OpenData/PropertyInformation/MapServer/0`
- **Auth:** None (public)
- **Data:** Parcel ID, Owner, Address, Assessed Value, Property Type
- **Implementation:** `municipal-scraper/src/scrapers/dekalb-county-api.ts`

---

## Municipal Zoning APIs (ArcGIS REST)

### 3. Atlanta, GA - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer/0`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONING_CLASSIFICATION`, `ZONEDESC`
- **Data:** Zoning districts, permitted uses, density limits

### 4. Charlotte, NC - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.charlottenc.gov/arcgis/rest/services/ODP/Parcel_Zoning_Lookup/MapServer/0`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `Zoning`

### 5. Dallas, TX - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://services5.arcgis.com/74bZbbuf05Ctvbzv/arcgis/rest/services/City_of_Dallas_Base_Zoning/FeatureServer/21`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONE_DIST`

### 6. San Antonio, TX - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://services.arcgis.com/g1fRTDLeMgspWrYp/arcgis/rest/services/COSA_Zoning/FeatureServer/12`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `Base`

### 7. Nashville, TN - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/Zoning/MapServer/14`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONE_DESC`

### 8. Memphis, TN - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.shelbycountytn.gov/arcgis/rest/services/Zoning/Zoning/MapServer/0`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONE_TYPE`

### 9. New Orleans, LA - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://services.arcgis.com/f4rR7WnIfGBdVYFd/arcgis/rest/services/Zoning_Districts/FeatureServer/0`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONE`

### 10. Miami-Dade, FL - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer/1`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `ZONE`, `ZONE_DESC`

### 11. Tampa/Hillsborough County, FL - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://maps.hillsboroughcounty.org/arcgis/rest/services/DSD_Viewer_Services/DSD_Viewer_Zoning_Regulatory/FeatureServer/1`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `NZONE`, `NZONE_DESC`

### 12. Richmond, VA - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://services6.arcgis.com/StPsG80YRtvnlCJ8/arcgis/rest/services/Zoning/FeatureServer/0`
- **Auth:** None
- **Status:** ✅ Verified
- **Fields:** `Name`

### 13. Austin, TX - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/ZONING/FeatureServer/0`
- **Auth:** None
- **Status:** ⚠️ Unverified
- **Fields:** `ZONING_ZTYP`

### 14. Raleigh, NC - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://mapstest.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer/0`
- **Auth:** None
- **Status:** ⚠️ Unverified
- **Fields:** `ZONING`, `ZONE_NAME`

### 15. Charleston County, SC - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.charlestoncounty.org/arcgis/rest/services`
- **Auth:** None
- **Status:** ⚠️ Unverified
- **Fields:** `ZONE_CLASS`, `ZONE_NAME`

### 16. Virginia Beach, VA - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.vbgov.com/arcgis/rest/services`
- **Auth:** None
- **Status:** ⚠️ Unverified
- **Fields:** `ZONING`, `ZONE_DESCRIPTION`

### 17. Orange County, FL - Zoning
- **Type:** ArcGIS REST API
- **Base:** `https://gis.occompt.com/arcgis/rest/services`
- **Auth:** None
- **Status:** ⚠️ Unverified
- **Fields:** `ZONING`, `ZONE_NAME`

---

## Geocoding & Mapping APIs

### 18. Mapbox Geocoding API
- **Base:** `https://api.mapbox.com/geocoding/v5/mapbox.places`
- **Auth:** Token required (`VITE_MAPBOX_TOKEN`)
- **Usage:** Address → Coordinates, Reverse geocoding
- **Docs:** https://docs.mapbox.com/api/search/geocoding/

### 19. Mapbox Maps API
- **Base:** `https://api.mapbox.com`
- **Auth:** Token required
- **Usage:** Interactive maps, drawing boundaries
- **Styles:** `mapbox://styles/mapbox/satellite-streets-v12`

---

## Internal/Backend APIs

### 20. JediRe Backend REST API
- **Base:** `http://localhost:3001/api/v1` (dev) or production URL
- **Auth:** JWT Bearer token
- **Endpoints:**
  - `/auth/*` - Authentication
  - `/deals/*` - Deal management
  - `/properties/*` - Property records
  - `/zoning/*` - Zoning lookups
  - `/zoning-districts/*` - District details
  - `/reverse-geocode` - Location → Municipality
  - `/zoning-intelligence/*` - AI analysis
  - `/market-intelligence/*` - Market data
  
### 21. Property Scraper Cloudflare Worker
- **Base:** `https://property-api.m-dixon5030.workers.dev`
- **Auth:** None
- **Endpoints:**
  - `POST /scrape` - Scrape property by address or parcel ID
  - `POST /scrape/multifamily` - Bulk multifamily search
  - `GET /health` - Health check
- **Counties:** Fulton, DeKalb

---

## ArcGIS Query Examples

### Standard Query Format
```
GET {base_url}/query?where={whereClause}&outFields=*&returnGeometry=false&f=json
```

### Common WHERE Clauses
```sql
-- By field value
ZONING_CLASSIFICATION='MRC-2-C'

-- By partial match
Address LIKE '%PEACHTREE%'

-- By number range
LivUnits >= 5

-- Get all
1=1
```

### Query Parameters
- **where** - SQL WHERE clause (required)
- **outFields** - Comma-separated fields or `*` for all
- **returnGeometry** - `true` or `false`
- **geometryType** - `esriGeometryPoint` for point queries
- **geometry** - `lng,lat` for spatial queries
- **spatialRel** - `esriSpatialRelIntersects` for contains
- **resultRecordCount** - Max results (default 1000, max 2000)
- **resultOffset** - Pagination offset
- **f** - Format (`json`, `geojson`, `pjson`)

### Pagination Pattern
```javascript
let offset = 0;
const batchSize = 2000;
const allResults = [];

while (true) {
  const url = `${baseUrl}/query?where=1=1&outFields=*&resultRecordCount=${batchSize}&resultOffset=${offset}&f=json`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.features || data.features.length === 0) break;
  allResults.push(...data.features);
  
  if (data.features.length < batchSize) break;
  offset += data.features.length;
}
```

---

## Implementation Files

### Backend
- `backend/src/services/municipal-api-connectors.ts` - All zoning API configs
- `backend/src/api/rest/property.routes.ts` - Property scraping endpoints
- `backend/src/api/rest/zoning.routes.ts` - Zoning lookup endpoints

### Scraper
- `municipal-scraper/src/scrapers/fulton-county-api.ts` - Fulton implementation
- `municipal-scraper/src/scrapers/dekalb-county-api.ts` - DeKalb implementation
- `municipal-scraper/src/api-only.ts` - Cloudflare Worker (API-only scraper)

### Frontend
- `frontend/src/services/api.client.ts` - API client wrapper
- `frontend/src/components/deal/sections/PropertyBoundarySection.tsx` - Uses Mapbox + reverse geocode

---

## Environment Variables Required

```bash
# Mapbox
VITE_MAPBOX_TOKEN=pk.eyJ1...

# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Optional
ANTHROPIC_API_KEY=... # For AI features
```

---

## Rate Limits & Best Practices

### ArcGIS REST APIs
- **Rate Limit:** None for public endpoints (use reasonable requests)
- **Best Practice:** Max 10 req/sec, use batch queries
- **Pagination:** Use `resultOffset` for >2000 records

### Mapbox APIs
- **Free Tier:** 100,000 requests/month
- **Rate Limit:** 600 requests/min
- **Docs:** https://docs.mapbox.com/api/overview/#rate-limits

### Property Assessment APIs
- **No strict limits** (public data)
- **Best Practice:** Cache results, batch queries when possible

---

## Health Check Endpoints

```bash
# Fulton County
curl "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0?f=json"

# DeKalb County
curl "https://gis.dekalbcountyga.gov/arcgis/rest/services/OpenData/PropertyInformation/MapServer/0?f=json"

# Atlanta Zoning
curl "https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer/0?f=json"

# Backend Health
curl "http://localhost:3001/api/v1/health"

# Property Worker
curl "https://property-api.m-dixon5030.workers.dev/health"
```

---

## Quick Start Example

```javascript
// 1. Query Fulton County property by address
const response = await fetch(
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?' +
  'where=Address LIKE \'%PEACHTREE ST%\'' +
  '&outFields=*' +
  '&returnGeometry=false' +
  '&resultRecordCount=10' +
  '&f=json'
);
const data = await response.json();
console.log(data.features[0].attributes);

// 2. Query Atlanta zoning by location
const zoningResponse = await fetch(
  'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer/0/query?' +
  'geometry=-84.3880,33.7490' +
  '&geometryType=esriGeometryPoint' +
  '&spatialRel=esriSpatialRelIntersects' +
  '&outFields=*' +
  '&f=json'
);
const zoningData = await zoningResponse.json();
console.log(zoningData.features[0].attributes);

// 3. Use backend wrapper
const backendResponse = await fetch('http://localhost:3001/api/v1/zoning/lookup', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  params: {
    city: 'Atlanta',
    address: '123 Peachtree St'
  }
});
```

---

## Notes

- All ArcGIS REST APIs follow same query pattern
- No authentication needed for public data
- CORS enabled on all endpoints
- Use `f=json` for JSON response, `f=geojson` for GeoJSON
- Most APIs support spatial queries (point-in-polygon)
- Data refresh cycles vary (annually for assessor data, real-time for zoning)
