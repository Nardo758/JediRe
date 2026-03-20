
# Property Data Enrichment

Automatically pull property-level data from Municipal/County Assessor APIs to enrich deal capsules with accurate unit counts, square footage, building details, and assessment data.

## Why This Matters

**Problem:** Deal capsules often lack basic property details:
- Unit count unknown → can't calculate per-unit metrics
- Square footage missing → can't estimate construction costs
- Assessment data missing → can't predict post-sale tax liability

**Solution:** Automatically fetch from county assessor APIs and backfill all deals.

## What Gets Enriched

### Core Property Data
- **Unit count** - Number of residential units
- **Total square footage** - Building area
- **Square footage breakdown**:
  - Habitable (residential units)
  - Amenity (gym, pool, clubhouse)
  - Leasing office + common areas

### Building Details
- Building count (multi-building properties)
- Individual building data (SF, stories, year built, use code)

### Assessment Data
- Assessed value (total, land, improvements)
- Annual property taxes
- Owner name
- Land use classification code
- Parcel ID

### Metadata
- Enrichment source (which county API)
- Enrichment timestamp

## Supported Counties

### Currently Integrated
1. **Fulton County, GA** - Full coverage
2. **DeKalb County, GA** - Full coverage
3. **Miami-Dade County, FL** - Full coverage

### Easy to Add
Any county with an ArcGIS REST API (most do). Just add to `COUNTY_APIS` config.

## Usage

### Run for All Deals

```bash
cd backend
npx ts-node src/scripts/enrich-property-data.ts
```

**Output:**
```
═══════════════════════════════════════════════════
🏢 PROPERTY DATA ENRICHMENT
═══════════════════════════════════════════════════

Found 47 deals to enrich

📍 1234 Peachtree St NE, Atlanta, GA
  🔍 Fetching from Fulton County, GA...
  ✅ Updated capsule abc-123
  📊 Units: 24
  📐 Total SF: 28,800
     ├─ Habitable: 24,480 SF
     ├─ Amenity: 2,880 SF
     └─ Leasing/Common: 1,440 SF

📍 567 Memorial Dr, Atlanta, GA
  🔍 Fetching from Fulton County, GA...
  ⚠️  No data found for 567 Memorial Dr

═══════════════════════════════════════════════════
SUMMARY:
  ✅ Enriched: 42
  ⏭️  Skipped: 3 (recently enriched)
  ❌ Failed: 2
═══════════════════════════════════════════════════
```

### Programmatic Usage

```typescript
import { enrichProperty, updateDealCapsule } from '../scripts/enrich-property-data';

const enrichmentData = await enrichProperty(
  capsuleId,
  '1234 Peachtree St NE',
  'Atlanta',
  'GA',
  '14-0123-4567-890' // Optional parcel ID
);

if (enrichmentData) {
  await updateDealCapsule(capsuleId, enrichmentData);
  console.log(`Units: ${enrichmentData.units}`);
  console.log(`Total SF: ${enrichmentData.total_sqft}`);
}
```

## Data Model

### DealData Fields (Updated)

```typescript
interface DealData {
  // ... existing fields ...
  
  // Square footage breakdown
  total_sqft?: number;
  habitable_sqft?: number;        // Residential unit space
  amenity_sqft?: number;          // Gym, pool, clubhouse
  leasing_office_sqft?: number;   // Leasing office + common areas
  
  // Building details
  building_count?: number;
  buildings?: Array<{
    building_id?: string;
    sqft?: number;
    stories?: number;
    year_built?: number;
    use_code?: string;
  }>;
  
  // Assessor data
  assessed_value?: number;
  assessed_land?: number;
  assessed_improvements?: number;
  annual_taxes?: number;
  owner_name?: string;
  use_code?: string;
  
  // Enrichment tracking
  enrichment_source?: string;     // "Fulton County, GA"
  enriched_at?: string;           // ISO timestamp
}
```

## How It Works

### 1. Query ArcGIS REST API

Most county assessor offices use ArcGIS for their GIS platform. We query their REST API endpoints:

```typescript
GET https://services1.arcgis.com/.../Tax_Parcels_2025/FeatureServer/0/query
  ?where=Address LIKE '%1234 Peachtree%'
  &outFields=*
  &f=json
```

### 2. Extract Relevant Fields

Each county uses different field names. We map them:

```typescript
const config = {
  fields: {
    parcelId: 'ParcelID',
    totalAssessed: 'TotAssess',
    yearBuilt: 'YearBuilt',
    // ... etc
  }
};
```

### 3. Infer Missing Data

**Unit count** (when not explicitly available):
- Check land use code (e.g., "340" = 5+ units in Fulton County)
- Estimate from total SF: `units = (totalSF * 0.85) / 850 SF/unit`

**SF breakdown** (when only total is available):
- Habitable: 85% of total (residential units)
- Amenity: 10% of total (gym, pool, clubhouse)
- Leasing/Common: 5% of total (office, hallways)

**Annual taxes** (when not available):
- Estimate: `assessed_value * typical_millage_rate / 1000`
- GA: ~40 mills, FL: ~20 mills

### 4. Update Deal Capsule

Merge enriched data with existing `deal_data`, preserving any manually-entered values.

## Enrichment Strategy

### When to Enrich

- **On import** - When a new deal is added
- **On demand** - User clicks "Refresh Property Data"
- **Scheduled** - Nightly for deals <30 days old
- **Backfill** - Run script to enrich all historical deals

### Refresh Policy

- Skip if enriched within last 30 days (to avoid API spam)
- Force refresh with `--force` flag

### Fallback Logic

1. Try exact address match
2. Try partial address match (street number + name)
3. Try parcel ID (if available)
4. Fall back to county-level API (if city API unavailable)
5. Mark as failed, log for manual review

## Adding New Counties

Easy 3-step process:

### 1. Find the API Endpoint

Search for `"{county name} GIS REST services"` or check the county assessor website.

Most use ArcGIS. Look for URLs like:
```
https://gis.{county}.{state}.us/arcgis/rest/services/...
```

### 2. Add to Configuration

```typescript
const COUNTY_APIS: Record<string, any> = {
  'cobb-ga': {
    name: 'Cobb County, GA',
    type: 'arcgis',
    parcelServiceUrl: 'https://gis.cobbcountyga.gov/.../FeatureServer/0',
    fields: {
      parcelId: 'PARCEL_ID',
      address: 'ADDRESS',
      totalAssessed: 'TOTAL_VALUE',
      yearBuilt: 'YEAR_BUILT',
      // ... map field names
    },
  },
};
```

### 3. Test

```bash
npx ts-node src/scripts/enrich-property-data.ts
```

## Data Sources

### ArcGIS REST API Endpoints

All counties use standard ArcGIS REST API:

**Parcel layer query:**
```
{serviceUrl}/query
  ?where=1=1
  &outFields=*
  &f=json
```

**Query by address:**
```
{serviceUrl}/query
  ?where=Address LIKE '%{address}%'
  &outFields=*
  &f=json
```

**Query by parcel ID:**
```
{serviceUrl}/query
  ?where=ParcelID='{parcelId}'
  &outFields=*
  &f=json
```

### Field Name Variations

Common field names across counties:

| Data | Possible Field Names |
|------|---------------------|
| Units | `UNITS`, `Units`, `NUM_UNITS`, `DWELLING_UNITS` |
| Total SF | `TOTAL_LVG_AREA`, `BLD_AREA`, `HEATED_AREA`, `SQFT` |
| Assessed Value | `TotAssess`, `TOTAL_APPR`, `TOT_LND_VAL`, `ASSESSED_VALUE` |
| Year Built | `YearBuilt`, `YEAR_BUILT`, `YR_BLT` |
| Parcel ID | `ParcelID`, `PARCEL_ID`, `PARCELNO`, `PIN` |

## Limitations

### What APIs Don't Provide

- **Rent roll data** - Must scrape CoStar/Yardi or import manually
- **Unit mix** - Can estimate (studio/1BR/2BR split) but not precise
- **Building-level detail** - Most counties only have parcel-level data
- **Historical assessment data** - Current year only (for trends, see HISTORICAL_TRENDS.md)

### API Reliability

- APIs can be slow (5-15 seconds per property)
- Some counties throttle requests
- Fields vary by county (requires manual mapping)
- Data quality varies (some counties missing units/SF)

## Troubleshooting

### "No data found"

**Causes:**
- Address format mismatch (API uses "Street" vs "St")
- Property not in county database
- Rural/unincorporated area
- New construction not yet assessed

**Solutions:**
- Try parcel ID instead of address
- Check county GIS website manually
- Fall back to manual entry

### "API timeout"

**Causes:**
- County server slow/overloaded
- Network issues

**Solutions:**
- Retry with longer timeout
- Run during off-peak hours (night)
- Batch smaller sets of properties

### "Field not found"

**Causes:**
- County uses different field names
- Field doesn't exist in this county's data

**Solutions:**
- Check API metadata: `{serviceUrl}?f=json`
- Update field mapping in config
- Mark field as unavailable for this county

## Future Enhancements

- **Building-level detail** - Some counties expose building data separately
- **Historical assessments** - Pull multi-year data for trend analysis
- **Permit data** - Integrate permit APIs for construction tracking
- **Deed records** - Pull ownership chain for sale history
- **Zoning overlay** - Cross-reference with zoning districts
- **CoStar integration** - Supplement with commercial data

---

**Need help?** Check the script output for detailed error messages and API response logging.
