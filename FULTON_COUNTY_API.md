# Fulton County Board of Assessors - API Connection

## Base Endpoint
```
https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0
```

## API Type
ArcGIS REST API (public, no authentication required)

## Query Format
```
GET /query?where={whereClause}&outFields=*&returnGeometry=false&f=json
```

## Available Fields
- **ParcelID** - Unique parcel identifier
- **Address** - Property street address
- **Owner** - Owner name
- **TotAssess** - Total assessed value ($)
- **LandAcres** - Lot size in acres
- **LivUnits** - Number of living units
- **LUCode** - Land use code
- **ClassCode** - Property class code
- **Subdiv** - Subdivision name
- **NbrHood** - Neighborhood

## Example Queries

### 1. Search by Address
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=Address%20LIKE%20'%25PEACHTREE%25'&outFields=*&returnGeometry=false&resultRecordCount=1&f=json
```

### 2. Search by Parcel ID
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=ParcelID='14%200087%200001'&outFields=*&returnGeometry=false&f=json
```

### 3. Search by Owner Name
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=Owner%20LIKE%20'%25COMPANY%20NAME%25'&outFields=*&returnGeometry=false&resultRecordCount=50&f=json
```

### 4. Find Multifamily Properties (5+ units)
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=LivUnits%20%3E=%205&outFields=*&returnGeometry=false&resultRecordCount=100&f=json
```

### 5. Get Total Count
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json
```

## Response Format
```json
{
  "features": [
    {
      "attributes": {
        "ParcelID": "14 0087 0001",
        "Address": "123 PEACHTREE ST NE",
        "Owner": "SAMPLE OWNER LLC",
        "TotAssess": 1250000,
        "LandAcres": 0.5,
        "LivUnits": 12,
        "LUCode": "MULTIFAMILY",
        "ClassCode": "R4",
        "Subdiv": "MIDTOWN DISTRICT",
        "NbrHood": "MIDTOWN"
      }
    }
  ]
}
```

## Query Parameters Reference
- **where** - SQL-like WHERE clause (required)
  - Example: `Address LIKE '%PEACHTREE%'`
  - Example: `ParcelID='14 0087 0001'`
  - Example: `LivUnits >= 5`
- **outFields** - Fields to return (`*` for all)
- **returnGeometry** - Include geometry (`true` or `false`)
- **resultRecordCount** - Max results per page (default: 1000, max: 2000)
- **resultOffset** - Pagination offset
- **f** - Format (`json`, `geojson`, `pjson`)

## Pagination
For large queries (>2000 records):
```javascript
let offset = 0;
const batchSize = 2000;
const allFeatures = [];

while (true) {
  const url = `${baseUrl}/query?where=LivUnits>=5&outFields=*&returnGeometry=false&resultRecordCount=${batchSize}&resultOffset=${offset}&f=json`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.features || data.features.length === 0) break;
  allFeatures.push(...data.features);
  
  if (data.features.length < batchSize) break;
  offset += data.features.length;
}
```

## Health Check
```
GET https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0?f=json
```

Should return:
```json
{
  "name": "Tax_Parcels_2025"
}
```

## Rate Limits
- Public API, no strict rate limits
- Recommended: Max 10 requests/second
- Use pagination for bulk queries

## Alternative Endpoints (Same Data)
```
# Alternative base (OpenData portal)
https://gis.fultoncountyga.gov/apps/gisdata/rest/services/OpenData_Layers/Property_layers/MapServer/2
```

## Notes
- Data updated annually (2025 tax roll)
- No authentication required
- Free public access
- CORS-enabled for browser requests
- Use URL encoding for special characters in WHERE clause
