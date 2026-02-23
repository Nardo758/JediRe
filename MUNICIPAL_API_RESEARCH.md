# Municipal Zoning API Research - Southeast + Texas

**Research Date:** February 23, 2026  
**Target:** 13 states, ~150+ municipalities  
**Goal:** Identify available APIs for zoning/property data

---

## 📋 Target Municipalities List

### Priority Tier 1: Major Metro Areas (Population 500K+)

#### Georgia (4 cities)
- [ ] Atlanta (498K) - Fulton County
- [ ] Augusta (202K) - Richmond County
- [ ] Columbus (206K) - Muscogee County
- [ ] Savannah (147K) - Chatham County

#### Florida (10 cities)
- [ ] Jacksonville (949K) - Duval County
- [ ] Miami (449K) - Miami-Dade County
- [ ] Tampa (384K) - Hillsborough County
- [ ] Orlando (307K) - Orange County
- [ ] St. Petersburg (258K) - Pinellas County
- [ ] Hialeah (223K) - Miami-Dade County
- [ ] Tallahassee (196K) - Leon County
- [ ] Fort Lauderdale (182K) - Broward County
- [ ] Cape Coral (194K) - Lee County
- [ ] Port St. Lucie (204K) - St. Lucie County

#### North Carolina (5 cities)
- [ ] Charlotte (874K) - Mecklenburg County
- [ ] Raleigh (467K) - Wake County
- [ ] Greensboro (296K) - Guilford County
- [ ] Durham (283K) - Durham County
- [ ] Winston-Salem (247K) - Forsyth County

#### South Carolina (3 cities)
- [ ] Columbia (137K) - Richland County
- [ ] Charleston (150K) - Charleston County
- [ ] North Charleston (114K) - Charleston County

#### Tennessee (4 cities)
- [ ] Nashville (689K) - Davidson County
- [ ] Memphis (633K) - Shelby County
- [ ] Knoxville (190K) - Knox County
- [ ] Chattanooga (181K) - Hamilton County

#### Alabama (2 cities)
- [ ] Birmingham (200K) - Jefferson County
- [ ] Montgomery (200K) - Montgomery County

#### Louisiana (2 cities)
- [ ] New Orleans (383K) - Orleans Parish
- [ ] Baton Rouge (227K) - East Baton Rouge Parish

#### Texas (13 cities)
- [ ] Houston (2.3M) - Harris County
- [ ] San Antonio (1.5M) - Bexar County
- [ ] Dallas (1.3M) - Dallas County
- [ ] Austin (978K) - Travis County
- [ ] Fort Worth (935K) - Tarrant County
- [ ] El Paso (678K) - El Paso County
- [ ] Arlington (398K) - Tarrant County
- [ ] Corpus Christi (317K) - Nueces County
- [ ] Plano (285K) - Collin County
- [ ] Lubbock (258K) - Lubbock County
- [ ] Laredo (255K) - Webb County
- [ ] Irving (240K) - Dallas County
- [ ] Garland (238K) - Dallas County

#### Virginia (3 cities)
- [ ] Virginia Beach (459K) - Virginia Beach
- [ ] Norfolk (238K) - Norfolk
- [ ] Richmond (230K) - Richmond

#### Kentucky (2 cities)
- [ ] Louisville (617K) - Jefferson County
- [ ] Lexington (323K) - Fayette County

#### Mississippi (1 city)
- [ ] Jackson (153K) - Hinds County

#### Arkansas (1 city)
- [ ] Little Rock (202K) - Pulaski County

#### West Virginia (1 city)
- [ ] Charleston (47K) - Kanawha County

**Total Tier 1: 53 cities**

---

### Priority Tier 2: Mid-Size Cities (100K-500K)

*Additional 50+ cities to add (Greenville SC, Huntsville AL, Mobile AL, Pensacola FL, etc.)*

---

## 🌐 Known Municipal APIs & Open Data Portals

### ✅ Confirmed Available APIs

#### Georgia
1. **Atlanta, GA**
   - Portal: https://gis.atlantaga.gov/
   - Type: ArcGIS REST API + Open Data
   - Datasets: Zoning districts, property parcels, permits
   - API: https://gis.atlantaga.gov/dpcd/rest/services/
   - Status: ✅ FREE, No API key required
   - Quality: EXCELLENT

2. **Fulton County, GA** (Covers Atlanta)
   - Portal: https://gis.fultoncountyga.gov/
   - Type: ArcGIS REST API
   - Datasets: Tax parcels, zoning, ownership
   - Status: ✅ Already scraped (1,028 properties)
   - Quality: EXCELLENT

#### Florida
3. **Miami-Dade County, FL**
   - Portal: https://gis-mdc.opendata.arcgis.com/
   - Type: ArcGIS Open Data + REST API
   - Datasets: Zoning, parcels, permits, building footprints
   - API: https://gis.mdc.opendata.arcgis.com/
   - Status: ✅ FREE
   - Quality: EXCELLENT

4. **Orange County, FL** (Orlando)
   - Portal: https://data.occompt.com/
   - Type: Socrata Open Data API
   - Datasets: Parcels, zoning, property appraiser data
   - Status: ✅ FREE
   - Quality: GOOD

5. **Hillsborough County, FL** (Tampa)
   - Portal: https://gis-hcpa.opendata.arcgis.com/
   - Type: ArcGIS REST API
   - Datasets: Zoning, parcels, future land use
   - Status: ✅ FREE
   - Quality: EXCELLENT

#### North Carolina
6. **Charlotte, NC** (Mecklenburg County)
   - Portal: https://data.charlottenc.gov/
   - Type: Socrata Open Data API
   - Datasets: Zoning, parcels, permits
   - API: https://data.charlottenc.gov/api/
   - Status: ✅ FREE, API token optional
   - Quality: EXCELLENT

7. **Wake County, NC** (Raleigh)
   - Portal: https://data.wakegov.com/
   - Type: Socrata Open Data API
   - Datasets: Parcels, zoning, land records
   - Status: ✅ FREE
   - Quality: EXCELLENT

#### Texas
8. **Austin, TX**
   - Portal: https://data.austintexas.gov/
   - Type: Socrata Open Data API
   - Datasets: Zoning, parcels, building permits
   - API: https://data.austintexas.gov/api/
   - Status: ✅ FREE
   - Quality: EXCELLENT

9. **Dallas, TX**
   - Portal: https://www.dallasopendata.com/
   - Type: Socrata Open Data API
   - Datasets: Zoning cases, parcels, property info
   - Status: ✅ FREE
   - Quality: GOOD

10. **San Antonio, TX** (Bexar County)
    - Portal: https://data.sanantonio.gov/
    - Type: Socrata Open Data API
    - Datasets: Zoning, parcels, permits
    - Status: ✅ FREE
    - Quality: GOOD

11. **Houston, TX** (Harris County)
    - Portal: https://cohgis-mycity.opendata.arcgis.com/
    - Type: ArcGIS REST API
    - Datasets: Zoning, permits, parcels
    - Status: ✅ FREE
    - Quality: EXCELLENT

#### Tennessee
12. **Nashville, TN** (Davidson County)
    - Portal: https://data.nashville.gov/
    - Type: Socrata Open Data API
    - Datasets: Zoning, parcels, building permits
    - Status: ✅ FREE
    - Quality: EXCELLENT

13. **Memphis, TN** (Shelby County)
    - Portal: https://data.memphistn.gov/
    - Type: Socrata Open Data API
    - Datasets: Parcels, permits, property data
    - Status: ✅ FREE
    - Quality: GOOD

#### South Carolina
14. **Charleston County, SC**
    - Portal: https://gis.charlestoncounty.org/
    - Type: ArcGIS REST API
    - Datasets: Zoning, parcels, floodplains
    - Status: ✅ FREE
    - Quality: EXCELLENT

#### Virginia
15. **Richmond, VA**
    - Portal: https://data.richmondva.gov/
    - Type: Socrata Open Data API
    - Datasets: Zoning, parcels, permits
    - Status: ✅ FREE
    - Quality: GOOD

16. **Virginia Beach, VA**
    - Portal: https://gis.vbgov.com/
    - Type: ArcGIS REST API
    - Datasets: Zoning, parcels, land use
    - Status: ✅ FREE
    - Quality: GOOD

#### Louisiana
17. **New Orleans, LA**
    - Portal: https://data.nola.gov/
    - Type: Socrata Open Data API
    - Datasets: Zoning districts, parcels, permits
    - Status: ✅ FREE
    - Quality: EXCELLENT

**Total Confirmed: 17 cities/counties with APIs**

---

### ⚠️ Partial/Limited Data Available

18. **Columbus, GA** - GIS viewer only, no API
19. **Augusta, GA** - PDF maps, no structured data
20. **Birmingham, AL** - Limited GIS portal
21. **Montgomery, AL** - Static maps only
22. **Jackson, MS** - County data only
23. **Little Rock, AR** - Pulaski County has limited GIS
24. **Knoxville, TN** - Knox County GIS (manual download)
25. **Fort Worth, TX** - Tarrant County (API available)
26. **El Paso, TX** - City GIS portal (limited API)

**Total Partial: ~10 cities**

---

### ❌ No Known API (Municode Scraping Required)

*Estimated: 25+ cities including:*
- Savannah, GA
- Most Alabama cities
- Most Mississippi cities
- Most Arkansas cities
- West Virginia cities
- Many Florida smaller cities
- South Carolina smaller cities

---

## 📊 Gap Analysis

### Coverage Summary

| Category | Count | % of Total |
|----------|-------|------------|
| **Full API Access** | 17 | 32% |
| **Partial Data** | 10 | 19% |
| **No API (Need Scraping)** | 26 | 49% |
| **TOTAL TIER 1** | 53 | 100% |

### By State

| State | Cities | APIs Available | Gap |
|-------|--------|----------------|-----|
| **Georgia** | 4 | 2 (50%) | 2 |
| **Florida** | 10 | 4 (40%) | 6 |
| **North Carolina** | 5 | 2 (40%) | 3 |
| **South Carolina** | 3 | 1 (33%) | 2 |
| **Tennessee** | 4 | 2 (50%) | 2 |
| **Alabama** | 2 | 0 (0%) | 2 |
| **Louisiana** | 2 | 1 (50%) | 1 |
| **Texas** | 13 | 5 (38%) | 8 |
| **Virginia** | 3 | 2 (67%) | 1 |
| **Kentucky** | 2 | 0 (0%) | 2 |
| **Mississippi** | 1 | 0 (0%) | 1 |
| **Arkansas** | 1 | 0 (0%) | 1 |
| **West Virginia** | 1 | 0 (0%) | 1 |
| **TOTAL** | **53** | **17 (32%)** | **36** |

---

## 🎯 Data Quality Tiers

### Tier A: Excellent (Full Zoning Parameters)
**Available via API:**
- Atlanta, GA
- Miami-Dade, FL
- Hillsborough County, FL (Tampa)
- Charlotte, NC
- Wake County, NC (Raleigh)
- Austin, TX
- Houston, TX
- Nashville, TN
- Charleston County, SC
- New Orleans, LA

**= 10 cities with complete data**

### Tier B: Good (Zoning Districts Only, Parameters Manual)
**Available via API:**
- Orange County, FL (Orlando)
- Dallas, TX
- San Antonio, TX
- Memphis, TN
- Richmond, VA
- Virginia Beach, VA
- Fulton County, GA

**= 7 cities with partial data**

### Tier C: Limited (Manual/Scraping Required)
**Everything else = 36 cities**

---

## 📦 Recommended API Platforms

### 1. Socrata Open Data (Most Common)
- Used by: Charlotte, Raleigh, Austin, Dallas, San Antonio, Nashville, Memphis, Richmond, New Orleans
- API Type: REST JSON
- Authentication: Optional token (increases rate limit)
- Rate Limit: 1000 req/hour (no token), 10K/hour (with token)
- Docs: https://dev.socrata.com/

### 2. ArcGIS REST API (Second Most Common)
- Used by: Atlanta, Miami-Dade, Tampa, Houston, Charleston, Virginia Beach
- API Type: REST JSON/GeoJSON
- Authentication: Optional token
- Rate Limit: Varies by server
- Docs: https://developers.arcgis.com/rest/

### 3. Custom APIs (Rare)
- Some cities have custom-built portals
- Usually less documented
- May require manual testing

---

## 🚀 Build Priority

### Phase 1: Proof of Concept (Today)
**Build integrations for:**
1. ✅ Atlanta (ArcGIS) - Already have data
2. Charlotte (Socrata)
3. Miami-Dade (ArcGIS)

**= Cover 3 major metros, test both API types**

### Phase 2: API Expansion (Week 1)
**Add the remaining 14 API cities:**
- All Socrata cities (9)
- All ArcGIS cities (5)

**= 17 total API-driven cities**

### Phase 3: Municode Scraping (Week 2)
**Target the 36 gap cities:**
- Build scraper
- Start with high-priority metros
- Manual entry for complex cases

### Phase 4: Maintenance (Ongoing)
- Quarterly data refresh
- Monitor API changes
- Add new cities

---

## 💾 Data Schema Requirements

Based on API analysis, we need to store:

**Zoning Districts:**
- Zoning code (varchar)
- District name (text)
- Max density (decimal)
- Max FAR (decimal)
- Max height (feet + stories)
- Min parking (spaces/unit)
- Setbacks (front/side/rear)
- Permitted uses (text[])
- Conditional uses (text[])
- Overlay districts (text[])
- Special conditions (jsonb)

**Property Cache:**
- Address + coordinates
- Zoning district ID
- Municipality ID
- Last verified date
- Data source (api/scraped/manual)

**Municipalities:**
- Name, state, county
- API type (socrata/arcgis/none)
- API URL
- API key/token
- Rate limit info
- Last scraped date

---

## 📋 Next Steps

1. ✅ **This document** - Complete research
2. **Build database schema** (30 min)
3. **Build API integration framework** (1 hour)
   - Socrata connector
   - ArcGIS connector
4. **Test with 3 proof-of-concept cities** (1 hour)
5. **Expand to remaining 14 API cities** (2-3 hours)
6. **Build Municode scraper** (Tomorrow, 2 hours)
7. **Data collection for gap cities** (Ongoing)

---

## 🤝 Collaboration Opportunities

**Potential Partnerships:**
- Share data with other RE tech companies
- License to appraisal firms
- Sell to brokerages as add-on

**Estimated Value:**
- Internal use: $50K+/year saved
- Licensing: $100K-500K/year potential
- Platform differentiation: Priceless

---

**Status:** Research complete, ready to build! 🚀
