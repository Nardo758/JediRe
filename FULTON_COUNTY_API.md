# Fulton County Property Data API

## ✅ API AVAILABLE!
Fulton County uses **ArcGIS REST API** for property data access - much better than scraping!

## Data Portal
- **Main Portal:** https://gisdata.fultoncountyga.gov
- **Organization:** Fulton County, Georgia - GIS (AQDHTHDrZzfsFsB5)
- **Type:** ArcGIS Open Data Portal with REST services

## Available Data Categories
- ✅ **Cadastral** (Tax parcels)
- ✅ **Boundaries**
- ✅ **Economic Development**
- ✅ **Planning**
- ✅ **Demographics**
- ✅ **Transportation**

## ✅ WORKING API ENDPOINT

### Service URL
```
https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0
```

### Available Years
- `Tax_Parcels_2025` (latest)
- `Tax_Parcels_2024`
- `Tax_Parcels` (current digest)
- Historical data back to 2015

### Available Fields
```
ParcelID        - Parcel identifier
TaxYear         - Tax year
Address         - Full property address
AddrNumber      - House number
AddrStreet      - Street name
Owner           - Owner name
OwnerAddr1      - Owner address line 1
OwnerAddr2      - Owner address line 2
TaxDist         - Tax district
TotAssess       - Total assessed value
LandAssess      - Land assessed value
ImprAssess      - Improvement assessed value
TotAppr         - Total appraised value
LandAppr        - Land appraised value
ImprAppr        - Improvement appraised value
LUCode          - Land use code
ClassCode       - Classification code
ExCode          - Exemption code
LivUnits        - Number of living units
LandAcres       - Land area in acres
NbrHood         - Neighborhood
Subdiv          - Subdivision
```

### Example Queries

#### Query by Address
```bash
curl "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=Address%20LIKE%20%27%25PEACHTREE%25%27&outFields=*&returnGeometry=false&f=json"
```

#### Query by Owner Name
```bash
curl "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=Owner%20LIKE%20%27%25SMITH%25%27&outFields=*&returnGeometry=false&f=json"
```

#### Query by Parcel ID
```bash
curl "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=ParcelID%3D%2722%20434112460329%27&outFields=*&returnGeometry=false&f=json"
```

#### Bulk Export
```bash
# Get all multifamily properties (LivUnits > 1)
curl "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=LivUnits%20%3E%201&outFields=*&returnGeometry=false&f=json"
```

### Sample Response
```json
{
  "features": [
    {
      "attributes": {
        "ParcelID": "22 434112460329",
        "Address": "900 COBBLESTON CT",
        "Owner": "DODD ROBERT & PAULA",
        "TotAssess": 403960,
        "LandAcres": 0.3241,
        "LivUnits": 1
      }
    }
  ]
}
```

## Data Fields We Need
From the Property Records system:
- Parcel ID / Tax ID
- Owner name
- Property address
- Assessed value
- Land use / zoning
- Sale date / price
- Building square footage
- Lot size

## Integration Plan

### Option A: Direct API Integration (Recommended)
- Call ArcGIS REST API from Cloudflare Worker
- Cache results in Supabase
- Update periodically (weekly/monthly)

### Option B: Bulk Download
- Export all parcels as GeoJSON/CSV
- Import into Supabase
- Refresh periodically

## Cost
✅ **FREE!** - Public open data portal, no API key required

## Rate Limits
- Check ArcGIS service limits (usually generous for public data)
- Can implement caching to minimize requests

## Next Action
1. **Find the exact parcel service URL**
2. **Test a sample query**
3. **Update municipal-scraper to use API instead of browser automation**

---

This is way better than Puppeteer! No Cloudflare issues, no bot detection, clean structured data. 🚀
