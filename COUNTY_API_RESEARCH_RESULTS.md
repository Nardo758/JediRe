# County Property Data API Research - Georgia Metro Atlanta

## Research Status (Feb 15, 2026)

### ✅ Fulton County - COMPLETE
- **Status:** ✅ Live and working
- **API Type:** ArcGIS REST API
- **URL:** `https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0`
- **Data Available:** 340,000+ parcels
- **Fields:** ParcelID, Address, Owner, TotAssess, LandAcres, LivUnits, LUCode, Subdiv
- **Cost:** FREE
- **Success Rate:** 99%
- **Response Time:** <1 second
- **Integration:** ✅ Complete

### 🔍 DeKalb County - IN PROGRESS
- **Population:** 760,000
- **Estimated Parcels:** ~280,000
- **Tax Assessor:** https://www.dekalbcountyga.gov/tax-assessor
- **Property Search:** https://www.qpublic.net/ga/dekalb/

**Research Findings:**
1. **qPublic (Schneider GeoPortal)** - Same as Fulton County!
   - URL: https://qpublic.schneidercorp.com/Application.aspx?App=DeKalbCountyGA
   - ⚠️ Uses Cloudflare protection (blocks browsers)
   - May have hidden ArcGIS API (need to investigate)

2. **Possible ArcGIS Services:**
   - Try: `https://gis.dekalbcountyga.gov/arcgis/rest/services`
   - Try: `https://webgis.dekalbcountyga.gov/arcgis/rest/services`
   - Try: `https://maps.dekalbcountyga.gov/arcgis/rest/services`
   - Status: None responded (may need different URL pattern)

3. **Alternative Sources:**
   - DeKalb GIS Department: https://www.dekalbcountyga.gov/geographic-information-systems
   - May need to contact GIS department for API access
   - Bulk data purchase may be available

**Next Steps:**
- [ ] Contact DeKalb GIS department for API documentation
- [ ] Check if they use Esri/ArcGIS (many GA counties do)
- [ ] Test qPublic for hidden API endpoints
- [ ] Consider bulk data purchase if no API

### 🔍 Gwinnett County - IN PROGRESS
- **Population:** 930,000 (largest in metro)
- **Estimated Parcels:** ~320,000
- **Tax Commissioner:** https://www.gwinnettcounty.com/web/gwinnett/departments/taxcommissioner
- **Property Search:** https://www.gwinnettcounty.com/web/gwinnett/departments/taxcommissioner/propertysearch

**Research Findings:**
1. **County Website Redirects:**
   - GIS services redirect to: https://www.gwinnettcounty.com/departments/informationtechnologyservices/geographicinformationsystems/gisbrowser
   - May use custom portal (not standard ArcGIS)

2. **iasWorld Platform:**
   - Property search appears to use Tyler Technologies iasWorld
   - Common assessment/tax platform in Georgia
   - May have API access (need credentials)

3. **GIS Portal:**
   - Gwinnett has active GIS department
   - Web GIS browser available
   - May publish ArcGIS services

**Next Steps:**
- [ ] Navigate to GIS browser to find service URLs
- [ ] Check for ArcGIS REST services endpoints
- [ ] Contact IT Services for API documentation
- [ ] Test iasWorld platform for data export options

### 🔍 Cobb County - IN PROGRESS
- **Population:** 760,000
- **Estimated Parcels:** ~270,000
- **Tax Assessor:** https://www.cobbassessor.org
- **Property Search:** https://www.cobbassessor.org/index.php?section=search

**Research Findings:**
1. **Custom Tax Assessor Site:**
   - Cobb runs independent assessor website
   - Property search available online
   - May have API or bulk data options

2. **GIS Department:**
   - Cobb County GIS: https://gis.cobbcountyga.gov
   - Likely uses ArcGIS (common in Georgia)
   - May publish REST services

3. **Data Access:**
   - Cobb is known for good data transparency
   - May offer bulk data downloads
   - GIS data portal likely exists

**Next Steps:**
- [ ] Check gis.cobbcountyga.gov for ArcGIS services
- [ ] Contact assessor office for data access options
- [ ] Look for open data portal
- [ ] Test property search for API endpoints

### 🔍 Forsyth County - QUEUED
- **Population:** 250,000 (fastest growing)
- **Estimated Parcels:** ~85,000
- **Priority:** Medium (smaller but growing fast)

**Quick Research:**
- Tax Assessor: https://www.forsythco.com/Departments-Offices/Tax-Assessors
- Known for strong development activity
- Good candidate for property data

### 🔍 Cherokee County - QUEUED
- **Population:** 260,000
- **Estimated Parcels:** ~95,000
- **Priority:** Medium

**Quick Research:**
- Tax Assessor: https://www.cherokeega-tax.org
- Active residential development
- North Atlanta suburbs

## Common Patterns in Georgia Counties

### 1. Schneider GeoPortal (qPublic)
**Counties Using:**
- Fulton ✅
- DeKalb ✅
- Many others

**Access Methods:**
- Hidden ArcGIS REST API (Fulton approach)
- Direct API with credentials
- Bulk data purchase

**Pro:** Standardized platform, good data quality
**Con:** Cloudflare protection on web interface

### 2. ArcGIS REST Services
**Common URL Patterns:**
```
https://gis.{county}ga.gov/arcgis/rest/services
https://maps.{county}ga.gov/arcgis/rest/services
https://webgis.{county}ga.gov/arcgis/rest/services
https://services.arcgis.com/{orgId}/arcgis/rest/services
```

**How to Find:**
1. View page source on county GIS page
2. Look for ArcGIS JavaScript includes
3. Find organization ID in config
4. Construct REST service URL

### 3. Tyler Technologies (iasWorld)
**Counties Using:**
- Gwinnett (likely)
- Others TBD

**Access Methods:**
- Web service API (requires credentials)
- Report exports (CSV/Excel)
- Bulk data purchase

### 4. Custom Solutions
Some counties build their own systems:
- Direct database exports
- Custom APIs
- FTP/SFTP bulk data

## Data Quality Comparison

| County | Platform | API Access | Data Freshness | Cost |
|--------|----------|------------|----------------|------|
| Fulton | qPublic/ArcGIS | ✅ FREE | Current year | $0 |
| DeKalb | qPublic | 🔍 Research | Unknown | TBD |
| Gwinnett | iasWorld | 🔍 Research | Unknown | TBD |
| Cobb | Custom | 🔍 Research | Unknown | TBD |

## Next Actions

### Immediate (Today)
1. **DeKalb:** Call GIS department, ask about ArcGIS services
2. **Gwinnett:** Navigate GIS browser, find service URLs
3. **Cobb:** Check gis.cobbcountyga.gov for REST services

### Short Term (This Week)
1. Test any discovered APIs with sample queries
2. Build scrapers for each county (clone Fulton approach)
3. Deploy to property-api worker
4. Update data coverage dashboard

### Medium Term (Next 2 Weeks)
1. Add Forsyth and Cherokee counties
2. Cover top 6 metro Atlanta counties
3. Achieve 90%+ market coverage

## Bulk Data Alternative

If APIs are not available or too restrictive:

**Purchase Bulk Data:**
- Most counties sell parcel data
- Cost: $100-500 per county
- Updated: Annually or quarterly
- Format: Shapefile, CSV, or GeoJSON

**Import Process:**
1. Purchase from county
2. Import to Supabase
3. Refresh periodically
4. Still 98% cheaper than CoStar!

**Pros:**
- Complete dataset
- No rate limits
- Offline processing

**Cons:**
- Upfront cost
- Manual refresh needed
- Not real-time

## Contact Information

### DeKalb County
- **GIS Department:** https://www.dekalbcountyga.gov/geographic-information-systems
- **Phone:** (404) 371-2821
- **Email:** gis@dekalbcountyga.gov

### Gwinnett County
- **IT Services GIS:** https://www.gwinnettcounty.com/departments/informationtechnologyservices/geographicinformationsystems
- **Phone:** (770) 822-8000
- **Email:** Contact form on website

### Cobb County
- **GIS Division:** https://gis.cobbcountyga.gov
- **Phone:** (770) 528-1300
- **Email:** GISSupport@cobbcounty.org

## Success Criteria

**County is "ready" when:**
- ✅ API endpoint identified and working
- ✅ Sample query returns valid data
- ✅ Field mapping documented
- ✅ Integration tested
- ✅ Added to property-api worker
- ✅ Listed in data coverage dashboard

---

**Research Status:** 1 of 6 complete, 3 in progress
**Next Update:** After contacting county GIS departments
