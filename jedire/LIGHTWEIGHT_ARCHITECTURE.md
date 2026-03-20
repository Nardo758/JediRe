# JediRe Lightweight Architecture - Map-Agnostic Approach

## 🎯 ARCHITECTURE LAYERS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LIGHTWEIGHT ARCHITECTURE                                                │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ USER INTERFACE LAYER                                                │ │
│ │                                                                     │ │
│ │ Option A: Web App                                                   │ │
│ │ ├── User inputs address                                             │ │
│ │ ├── Embedded map (Mapbox/Google Maps iframe)                        │ │
│ │ ├── Measuring tool overlay                                          │ │
│ │ └── Results panel                                                   │ │
│ │                                                                     │ │
│ │ Option B: Browser Extension                                         │ │
│ │ ├── Inject into Google Maps, Zillow, Redfin                         │ │
│ │ ├── "Analyze this property" button appears                          │ │
│ │ ├── Scrapes property details automatically                          │ │
│ │ └── Overlay results directly on their map                           │ │
│ │                                                                     │ │
│ │ Option C: Mobile App                                                │ │
│ │ ├── Built-in map view                                               │ │
│ │ ├── GPS location integration                                        │ │
│ │ └── Photo upload for property identification                        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ GEOCODING & LOOKUP LAYER                                            │ │
│ │                                                                     │ │
│ │ Address → Coordinates:                                              │ │
│ │ ├── Google Geocoding API                                            │ │
│ │ ├── Mapbox Geocoding API                                            │ │
│ │ └── Fallback: Census Bureau                                         │ │
│ │                                                                     │ │
│ │ Coordinates → Zoning District:                                      │ │
│ │ ├── Reverse geocode to municipality                                 │ │
│ │ ├── Query our zoning district database                              │ │
│ │ │   (lightweight: just district boundaries + codes)                 │ │
│ │ └── Return: {district_code: "R-3", municipality: "Austin"}          │ │
│ │                                                                     │ │
│ │ Property Details:                                                   │ │
│ │ ├── Primary: User-measured via map tool                             │ │
│ │ ├── Backup: Regrid API (parcel data)                                │ │
│ │ └── Backup: Tax assessor APIs                                       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ZONING RULES DATABASE                                               │ │
│ │                                                                     │ │
│ │ LIGHTWEIGHT: Just the rules, not the maps                           │ │
│ │                                                                     │ │
│ │ zoning_districts table:                                             │ │
│ │ ├── municipality, district_code                                     │ │
│ │ ├── permitted_uses, conditional_uses                                │ │
│ │ ├── dimensional_standards                                           │ │
│ │ └── full_code_sections (text + embeddings)                          │ │
│ │                                                                     │ │
│ │ district_boundaries table (MINIMAL):                                │ │
│ │ ├── Just for reverse geocoding                                      │ │
│ │ ├── Simplified polygons (not detailed parcels)                      │ │
│ │ └── Can be GeoJSON, not full PostGIS                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ AI INTERPRETATION ENGINE                                            │ │
│ │                                                                     │ │
│ │ Input:                                                              │ │
│ │ ├── Address: "123 Main St, Austin, TX"                              │ │
│ │ ├── Lot size: 8,000 sq ft (user measured or API)                    │ │
│ │ ├── Zoning: "R-3" (from lookup)                                     │ │
│ │ └── Question: "Can I build 4 units?" (optional)                     │ │
│ │                                                                     │ │
│ │ Processing:                                                         │ │
│ │ ├── Retrieve R-3 rules for Austin from database                     │ │
│ │ ├── Calculate max units (density rules)                             │ │
│ │ ├── Calculate buildable envelope (setbacks)                         │ │
│ │ ├── Calculate parking requirements                                  │ │
│ │ └── RAG-based Q&A if user asks questions                            │ │
│ │                                                                     │ │
│ │ Output:                                                             │ │
│ │ ├── "Yes, you can build 4 units"                                    │ │
│ │ ├── Max buildable area: 3,200 sq ft                                 │ │
│ │ ├── Max height: 35 ft                                               │ │
│ │ ├── Parking needed: 8 spaces                                        │ │
│ │ └── Development score: 85/100                                       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ VISUALIZATION LAYER                                                 │ │
│ │                                                                     │ │
│ │ Return to user:                                                     │ │
│ │ ├── GeoJSON overlay (buildable envelope)                            │ │
│ │ ├── They apply to THEIR map (Google/Mapbox)                         │ │
│ │ ├── Or: We show on embedded map in our interface                    │ │
│ │ └── 3D view: Simple isometric diagram (not full 3D map)             │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ MINIMAL MAP DATA REQUIRED

### What You DON'T Need:
- ❌ Full parcel data
- ❌ Detailed property boundaries
- ❌ Vector tile server
- ❌ Custom map renderer
- ❌ Complex GIS infrastructure

### What You ONLY Need:
- ✅ Simple district lookup table
- ✅ Zoning rules database
- ✅ Basic polygon boundaries for districts

---

## 📊 DATABASE SCHEMA

### Zoning District Boundaries Table

```sql
-- LIGHTWEIGHT: Just for district lookup, not detailed parcels
CREATE TABLE zoning_district_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality VARCHAR(255) NOT NULL,
    district_code VARCHAR(50) NOT NULL,
    district_name VARCHAR(255),
    
    -- Simplified boundary (just for point-in-polygon check)
    -- Option 1: Store as GeoJSON TEXT (no PostGIS required!)
    boundary_geojson TEXT,
    
    -- Option 2: Use PostGIS (recommended for performance)
    boundary GEOMETRY(Polygon, 4326),
    
    -- Metadata
    data_source VARCHAR(100),
    last_updated TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_district UNIQUE(municipality, district_code)
);

-- Spatial index for fast lookups
CREATE INDEX idx_boundary_gist ON zoning_district_boundaries USING GIST(boundary);

-- Regular index for municipality lookups
CREATE INDEX idx_municipality ON zoning_district_boundaries(municipality);
```

### Example Data:

```sql
-- Austin, TX - R-3 District
INSERT INTO zoning_district_boundaries (
    municipality,
    district_code,
    district_name,
    boundary_geojson,
    boundary
) VALUES (
    'Austin',
    'R-3',
    'Multi-Family Residential',
    '{
        "type": "Polygon",
        "coordinates": [[
            [-97.7431, 30.2672],
            [-97.7400, 30.2672],
            [-97.7400, 30.2650],
            [-97.7431, 30.2650],
            [-97.7431, 30.2672]
        ]]
    }'::text,
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [-97.7431, 30.2672],
            [-97.7400, 30.2672],
            [-97.7400, 30.2650],
            [-97.7431, 30.2650],
            [-97.7431, 30.2672]
        ]]
    }')
);
```

### Lookup Query (Point-in-Polygon):

```sql
-- Find which zoning district a point is in
SELECT 
    district_code,
    district_name
FROM zoning_district_boundaries
WHERE municipality = 'Austin'
  AND ST_Contains(
      boundary,
      ST_SetSRID(ST_Point(-97.7420, 30.2660), 4326)
  );
```

---

## 🔍 LIGHTWEIGHT ZONING LOOKUP SERVICE

### Full Service Implementation

```javascript
class ZoningLookupService {
    
    /**
     * Main entry point - get zoning for an address
     */
    async getZoningForAddress(address) {
        try {
            // Step 1: Geocode address to coordinates
            const coords = await this.geocode(address);
            
            // Step 2: Determine municipality
            const municipality = await this.getMunicipality(coords);
            
            // Step 3: Find zoning district
            const district = await this.getZoningDistrict(coords, municipality);
            
            // Step 4: Get property details (lot size, etc.)
            const propertyDetails = await this.getPropertyDetails(address, coords);
            
            return {
                address,
                coordinates: coords,
                municipality,
                zoning_district: district,
                lot_size_sqft: propertyDetails.lot_size,
                current_use: propertyDetails.current_use,
                confidence: 'high'
            };
        } catch (error) {
            console.error('Zoning lookup failed:', error);
            throw error;
        }
    }
    
    /**
     * Geocode address to lat/lng
     */
    async geocode(address) {
        // Primary: Google Geocoding API
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?` +
                `address=${encodeURIComponent(address)}&` +
                `key=${process.env.GOOGLE_MAPS_API_KEY}`
            );
            
            const data = await response.json();
            
            if (data.status === 'OK' && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return {
                    lat: location.lat,
                    lng: location.lng,
                    formatted_address: data.results[0].formatted_address,
                    confidence: 'high'
                };
            }
        } catch (error) {
            console.log('Google geocoding failed, trying Mapbox...');
        }
        
        // Fallback: Mapbox Geocoding API
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
                `${encodeURIComponent(address)}.json?` +
                `access_token=${process.env.MAPBOX_ACCESS_TOKEN}`
            );
            
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                return {
                    lat,
                    lng,
                    formatted_address: data.features[0].place_name,
                    confidence: 'medium'
                };
            }
        } catch (error) {
            console.log('Mapbox geocoding failed');
        }
        
        throw new Error('Geocoding failed for address: ' + address);
    }
    
    /**
     * Reverse geocode to get municipality
     */
    async getMunicipality(coords) {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?` +
            `latlng=${coords.lat},${coords.lng}&` +
            `key=${process.env.GOOGLE_MAPS_API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
            const components = data.results[0].address_components;
            
            // Extract city
            const cityComponent = components.find(c => 
                c.types.includes('locality')
            );
            
            // Extract county
            const countyComponent = components.find(c => 
                c.types.includes('administrative_area_level_2')
            );
            
            // Extract state
            const stateComponent = components.find(c => 
                c.types.includes('administrative_area_level_1')
            );
            
            return {
                city: cityComponent?.long_name,
                county: countyComponent?.long_name,
                state: stateComponent?.short_name,
                formatted: `${cityComponent?.long_name}, ${stateComponent?.short_name}`
            };
        }
        
        throw new Error('Could not determine municipality');
    }
    
    /**
     * Query database to find zoning district
     */
    async getZoningDistrict(coords, municipality) {
        const response = await fetch('/api/zoning-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat: coords.lat,
                lng: coords.lng,
                municipality: municipality.city
            })
        });
        
        if (!response.ok) {
            throw new Error('Zoning district lookup failed');
        }
        
        return await response.json();
    }
    
    /**
     * Get property details (lot size, etc.)
     * Try multiple sources in priority order
     */
    async getPropertyDetails(address, coords) {
        // Option 1: Regrid API (best parcel data)
        try {
            const regridData = await this.getRegridData(coords);
            if (regridData) {
                return {
                    lot_size: regridData.properties.lot_sqft,
                    current_use: regridData.properties.land_use,
                    source: 'regrid',
                    confidence: 'high'
                };
            }
        } catch (e) {
            console.log('Regrid lookup failed, trying tax assessor...');
        }
        
        // Option 2: Tax assessor API
        try {
            const assessorData = await this.getAssessorData(address);
            if (assessorData) {
                return {
                    lot_size: assessorData.lot_size_sqft,
                    current_use: assessorData.land_use,
                    source: 'assessor',
                    confidence: 'medium'
                };
            }
        } catch (e) {
            console.log('Tax assessor failed');
        }
        
        // Option 3: User will measure manually
        return {
            lot_size: null, // User must provide
            current_use: null,
            source: 'manual',
            message: 'Please measure lot size using the map tool'
        };
    }
    
    async getRegridData(coords) {
        // Regrid parcel API
        const response = await fetch(
            `https://app.regrid.com/api/v2/parcels?` +
            `lat=${coords.lat}&lng=${coords.lng}&` +
            `token=${process.env.REGRID_API_KEY}`
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.features[0]; // First matching parcel
        }
        
        return null;
    }
    
    async getAssessorData(address) {
        // County tax assessor API
        // Implementation varies by county
        // This is a placeholder - would need specific integrations
        return null;
    }
}

module.exports = new ZoningLookupService();
```

---

## 🔌 BACKEND API ENDPOINT

### `/api/zoning-lookup` - Database Query

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncpg

router = APIRouter()

class ZoningLookupRequest(BaseModel):
    lat: float
    lng: float
    municipality: str

class ZoningLookupResponse(BaseModel):
    district_code: str
    district_name: str
    municipality: str
    confidence: str

@router.post("/api/zoning-lookup", response_model=ZoningLookupResponse)
async def lookup_zoning_district(request: ZoningLookupRequest):
    """
    Find zoning district for a lat/lng point
    """
    
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Point-in-polygon query
        result = await conn.fetchrow("""
            SELECT 
                district_code,
                district_name,
                municipality
            FROM zoning_district_boundaries
            WHERE municipality = $1
              AND ST_Contains(
                  boundary,
                  ST_SetSRID(ST_Point($2, $3), 4326)
              )
            LIMIT 1
        """, request.municipality, request.lng, request.lat)
        
        if result:
            return {
                "district_code": result['district_code'],
                "district_name": result['district_name'],
                "municipality": result['municipality'],
                "confidence": "high"
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No zoning district found for coordinates in {request.municipality}"
            )
            
    finally:
        await conn.close()
```

---

## 🎯 DATA ACQUISITION STRATEGY

### Minimal Data Requirements

For **MVP** (start with 3-5 cities):
```
Per city, you need:
1. Zoning district boundaries (simplified polygons)
   - Source: City planning department GIS data
   - Format: Shapefile or GeoJSON
   - Size: ~1-10 MB per city
   
2. Zoning code text (structured rules)
   - Source: Municipal code website
   - Format: Scraped + structured into JSON
   - Size: ~500 KB per city

Total per city: ~1-10 MB (lightweight!)
```

### How to Get the Data:

1. **City GIS Data:**
   - Most cities have open data portals
   - Example: https://data.austintexas.gov
   - Look for "Zoning" or "Land Use" datasets
   - Download as Shapefile or GeoJSON

2. **Simplify Polygons:**
   ```python
   import geopandas as gpd
   from shapely.geometry import shape
   
   # Load original shapefile
   gdf = gpd.read_file('austin_zoning.shp')
   
   # Simplify to reduce size (0.001 = ~100 meters tolerance)
   gdf['geometry'] = gdf['geometry'].simplify(0.001)
   
   # Save as GeoJSON
   gdf.to_file('austin_zoning_simplified.geojson', driver='GeoJSON')
   ```

3. **Scrape Zoning Codes:**
   ```python
   # Use Claude/GPT to structure zoning ordinances
   prompt = f"""
   Extract structured zoning rules from this code section:
   
   {code_text}
   
   Return JSON with:
   - allowed_uses
   - density rules
   - setbacks
   - height limits
   - parking requirements
   """
   ```

---

## 💰 COST COMPARISON

### Traditional GIS Approach:
- PostGIS database
- Vector tile server
- Map rendering
- Tile caching
- **Cost:** $50K-100K/year infrastructure

### Lightweight Approach:
- Simple PostgreSQL
- No tile server needed
- Users bring their own maps
- **Cost:** $5K-10K/year infrastructure

**Savings: 80-90%!** 🎉

---

**This is the complete lightweight architecture!** 🚀

---

**Last Updated:** 2026-01-31  
**Status:** Ready to Build
