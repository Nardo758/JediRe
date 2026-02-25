# JediRe API Quick Reference (for Replit Agent)

## 📊 Total APIs: 21

### Property Assessment (2)
1. **Fulton County, GA** - `https://services1.arcgis.com/.../Tax_Parcels_2025/FeatureServer/0`
2. **DeKalb County, GA** - `https://gis.dekalbcountyga.gov/.../PropertyInformation/MapServer/0`

### Municipal Zoning - Verified (10)
3. **Atlanta, GA** - `https://gis.atlantaga.gov/dpcd/rest/services/.../LotsWithZoning/MapServer/0`
4. **Charlotte, NC** - `https://gis.charlottenc.gov/.../Parcel_Zoning_Lookup/MapServer/0`
5. **Dallas, TX** - `https://services5.arcgis.com/.../City_of_Dallas_Base_Zoning/FeatureServer/21`
6. **San Antonio, TX** - `https://services.arcgis.com/.../COSA_Zoning/FeatureServer/12`
7. **Nashville, TN** - `https://maps.nashville.gov/.../Zoning/MapServer/14`
8. **Memphis, TN** - `https://gis.shelbycountytn.gov/.../Zoning/MapServer/0`
9. **New Orleans, LA** - `https://services.arcgis.com/.../Zoning_Districts/FeatureServer/0`
10. **Miami-Dade, FL** - `https://gisweb.miamidade.gov/.../MD_Zoning/MapServer/1`
11. **Tampa, FL** - `https://maps.hillsboroughcounty.org/.../DSD_Viewer_Zoning.../FeatureServer/1`
12. **Richmond, VA** - `https://services6.arcgis.com/.../Zoning/FeatureServer/0`

### Municipal Zoning - Unverified (5)
13. **Austin, TX** - `https://services.arcgis.com/.../ZONING/FeatureServer/0`
14. **Raleigh, NC** - `https://mapstest.raleighnc.gov/.../Zoning/MapServer/0`
15. **Charleston, SC** - `https://gis.charlestoncounty.org/arcgis/rest/services`
16. **Virginia Beach, VA** - `https://gis.vbgov.com/arcgis/rest/services`
17. **Orange County, FL** - `https://gis.occompt.com/arcgis/rest/services`

### Geocoding & Mapping (2)
18. **Mapbox Geocoding** - `https://api.mapbox.com/geocoding/v5/mapbox.places`
19. **Mapbox Maps** - `https://api.mapbox.com` (requires token)

### Internal APIs (2)
20. **JediRe Backend** - `http://localhost:3001/api/v1`
21. **Property Worker** - `https://property-api.m-dixon5030.workers.dev`

---

## 🔑 Standard ArcGIS Query Pattern (ALL APIs 1-17)

```bash
GET {BASE_URL}/query?where={SQL}&outFields=*&returnGeometry=false&f=json
```

### Example: Get all zoning districts
```bash
curl "{BASE_URL}/query?where=1=1&outFields=*&returnGeometry=false&f=json"
```

### Example: Query by location (lat/lng)
```bash
curl "{BASE_URL}/query?geometry=-84.3880,33.7490&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=*&f=json"
```

### Example: Search by code
```bash
curl "{BASE_URL}/query?where=ZONING_CODE='MRC-2'&outFields=*&returnGeometry=false&f=json"
```

---

## 🚀 Implementation Files

- **Full details:** `API_CONNECTIONS.md`
- **Fulton County only:** `FULTON_COUNTY_API.md`
- **Backend config:** `backend/src/services/municipal-api-connectors.ts`
- **Scrapers:** `municipal-scraper/src/scrapers/`

---

## ⚡ No Auth Required
All APIs 1-17 are **public, no authentication needed**. Only Mapbox (#18-19) requires a token.
