# County Property Data APIs - Research

## ✅ Fulton County (DONE)
- **API:** ArcGIS REST API
- **URL:** `https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0`
- **Status:** ✅ Live & working
- **Cost:** FREE
- **Coverage:** All parcels, current + historical

## Georgia Counties to Add

### Priority 1: Metro Atlanta

#### DeKalb County
- **Population:** 760K
- **Research:** Check for ArcGIS services
- **URL:** https://gis.dekalbcountyga.gov

#### Gwinnett County
- **Population:** 930K
- **Research:** Check for ArcGIS services
- **URL:** https://www.gwinnettcounty.com/web/gwinnett/departments/taxcommissioner

#### Cobb County
- **Population:** 760K
- **Research:** Check for open data
- **URL:** https://www.cobbcounty.org

### Priority 2: Major Markets

#### Forsyth County
- **Population:** 250K (fastest growing)
- **Research:** Check for GIS portal

#### Cherokee County
- **Population:** 260K
- **Research:** Check for property data

### Research Checklist for Each County

1. **Find GIS/Open Data Portal**
   - Search: "{county name} Georgia open data"
   - Search: "{county name} Georgia GIS portal"
   - Search: "{county name} Georgia ArcGIS"

2. **Check for ArcGIS Services**
   ```bash
   # Try common patterns:
   https://services.arcgis.com/{orgId}/arcgis/rest/services
   https://{county}-ga.gov/arcgis/rest/services
   ```

3. **Look for Tax Assessor Data**
   - Parcel boundaries
   - Tax records
   - Assessment data
   - Owner information

4. **Test Data Quality**
   - Check field coverage
   - Verify data freshness
   - Test query performance

## Alternative Data Sources

### If No API Available:

1. **Schneider GeoPortal** (with API approach)
   - Many counties use this
   - May have hidden APIs

2. **Tyler Technologies**
   - iasWorld platform
   - Often has export options

3. **Vanguard Appraisals**
   - Common in smaller counties

4. **Bulk Data Purchases**
   - Counties often sell parcel data
   - Usually $100-500 per county
   - Updated annually

## Next Steps

1. Research DeKalb County (high priority)
2. Research Gwinnett County (largest)
3. Research Cobb County
4. Build unified scraper interface
5. Add county routing to API

---

**Goal:** Cover top 5 metro Atlanta counties = ~90% of market
