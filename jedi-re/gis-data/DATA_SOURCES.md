# GIS Data Sources - JEDI RE Phase 1A

## Download Summary

**Download Date:** February 3, 2026  
**Downloaded By:** Automated GIS data acquisition script  
**Purpose:** JEDI RE Phase 1A - Atlanta real estate analysis

## Datasets Downloaded

### 1. Atlanta Zoning Districts

**File:** `atlanta_zoning_complete.geojson`  
**Source:** City of Atlanta Department of City Planning  
**URL:** https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/22  
**Format:** GeoJSON  
**Size:** 5.44 MB  
**Features:** 2,953 zoning polygons  
**Coordinate System:** WGS84 (EPSG:4326)

**Description:**  
Zoning district boundaries for the City of Atlanta, Georgia. Includes zoning classifications, descriptions, height limits, and overlay districts.

**Key Fields:**
- `ZONECLASS`: Zoning classification code (e.g., MRC-3, R-4, C-2)
- `ZONEDESC`: URL link to full zoning description
- `HEIGHT`: Maximum building height
- `BASEELEV`: Base elevation
- `ZONING OVERLAY`: Special zoning overlays
- `SPI`, `SUBAREA`, `TSA`: Special district identifiers

**License:** Public domain - City of Atlanta Open Data
**Usage Restrictions:** None - publicly available data
**Last Updated:** Varies by feature (see LASTUPDATE field)

**Data Quality Notes:**
- Complete coverage of Atlanta city limits
- Downloaded via ArcGIS REST API with pagination
- Verified 2,953 features match expected coverage

---

### 2. Fulton County Tax Parcels (Sample)

**File:** `fulton_parcels_atlanta.geojson`  
**Source:** City of Atlanta GIS (subset of Fulton County)  
**URL:** https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/25  
**Format:** GeoJSON  
**Size:** 3.11 MB  
**Features:** 2,000 parcel polygons (SAMPLE DATASET)  
**Coordinate System:** WGS84 (EPSG:4326)

**Description:**  
Tax parcel boundaries for Fulton County, Georgia. This is a **SAMPLE DATASET** limited to 2,000 features due to API query restrictions. Covers primarily Atlanta city limits parcels.

**Key Fields:**
- `PARCELID`: Unique parcel identifier
- `SITEADDRESS`, `SITECITY`, `SITEZIP`: Property address
- `OWNERNME1`, `OWNERNME2`: Owner names
- `LNDVALUE`: Land value
- `TOT_APPR`: Total appraised value
- `IMPR_APPR`: Improvement appraised value
- `ZONING1`, `ZONING2`: Zoning codes
- `COUNCIL`: City Council district
- `NPU`: Neighborhood Planning Unit
- `NEIGHBORHOOD`: Neighborhood name
- `CLASSCD`, `CLASSDSCRP`: Property class code and description

**License:** Public domain - Fulton County/City of Atlanta Open Data
**Usage Restrictions:** None - publicly available data
**Last Updated:** See LAST_EDITED_DATE field

**Data Quality Notes:**
- ⚠️ **IMPORTANT:** This is a SAMPLE of only 2,000 parcels
- Limited to the first 2,000 records returned by the API
- Does NOT include all Fulton County parcels
- For complete parcel data, see "Full Dataset Access" section below

---

## Full Dataset Access Instructions

### Complete Fulton County Parcel Data

For the **complete** Fulton County parcel dataset, use one of these methods:

#### Option 1: Fulton County Open Data Portal (Recommended)
1. Visit: https://gisdata.fultoncountyga.gov/
2. Search for "Tax Parcels" or "Cadastral"
3. Download shapefile or geodatabase format
4. Expected size: ~500,000+ parcels, 100+ MB

#### Option 2: Atlanta Regional Commission Open Data
1. Visit: https://opendata.atlantaregional.com/
2. Search for "Fulton County Parcels"
3. Download complete dataset

#### Option 3: ArcGIS REST API with Pagination
Use the pagination script included in this directory:
```bash
python3 download_complete.py
```

This script downloads all features by making multiple requests with pagination.

#### Option 4: Direct GIS Service Export
Contact Fulton County GIS Division:
- Website: https://www.fultoncountyga.gov/fcgis-home
- Email: GeoPortal.SupportTeam@fultoncountyga.gov
- Phone: (404) 612-6372

---

## Data Verification

### Atlanta Zoning
- ✅ Downloaded: 2,953 features
- ✅ File integrity: Valid GeoJSON
- ✅ Coordinate system: WGS84
- ✅ Coverage: Complete Atlanta city limits
- ✅ Date verified: February 3, 2026

### Fulton County Parcels
- ⚠️ Downloaded: 2,000 features (SAMPLE ONLY)
- ✅ File integrity: Valid GeoJSON
- ✅ Coordinate system: WGS84
- ⚠️ Coverage: Partial (first 2,000 records from API)
- ✅ Date verified: February 3, 2026

---

## Technical Notes

### Download Method
Data was downloaded using the ArcGIS REST API:
- Service: City of Atlanta Department of City Planning
- API Version: 11.2
- Query parameters: `where=1=1&outFields=*&f=geojson`
- Pagination: 2,000 records per request
- Authentication: None required (public data)

### File Formats
- **GeoJSON**: Web-friendly, human-readable, works with most GIS software
- **Alternative formats available:** Shapefile, KML, CSV, GeoDatabase

### Coordinate Reference System
- **Current:** WGS84 (EPSG:4326) - Geographic coordinates
- **Common alternatives:**
  - NAD83 / Georgia West (EPSG:2240) - State plane feet
  - NAD83 / UTM Zone 16N (EPSG:26916) - Meters
  - Web Mercator (EPSG:3857) - Web mapping

### Recommended Tools
- **QGIS** (free, open-source): https://qgis.org/
- **ArcGIS Pro** (commercial)
- **Python:** geopandas, shapely, fiona
- **R:** sf, sp packages
- **Web:** Leaflet, Mapbox, Google Maps API

---

## Known Issues and Limitations

1. **Parcel Data Incomplete**
   - Current file contains only 2,000 parcels
   - Full Fulton County has ~450,000 parcels
   - Coverage bias toward Atlanta city center
   - Recommendation: Download complete dataset from official portal

2. **Zoning Data**
   - Appears complete with 2,953 zones
   - External links in ZONEDESC field may change
   - Zoning codes updated periodically by city

3. **Temporal Currency**
   - Data reflects status as of download date
   - Parcels: Updates vary by record
   - Zoning: Check LASTUPDATE field for freshness

---

## Data Lineage

### Original Sources
1. **Fulton County Board of Assessors**
   - Tax parcel geometry and attributes
   - Updated annually for tax purposes
   
2. **City of Atlanta Department of City Planning**
   - Zoning district boundaries
   - Updated as zoning changes approved

### Processing Steps
1. Raw data maintained in ArcGIS Server
2. Published via REST API by respective agencies
3. Downloaded via HTTP GET requests
4. Exported as GeoJSON (WGS84)
5. No geometric or attribute transformations applied
6. Original field names and values preserved

---

## License and Terms of Use

### License
Both datasets are **public domain** and distributed under open data policies:
- Fulton County Open Data License: CC0 1.0 Universal
- City of Atlanta Open Data License: Public Domain

### Terms of Use
- ✅ Free to use for any purpose
- ✅ Commercial use permitted
- ✅ Modification permitted
- ✅ Redistribution permitted
- ⚠️ No warranty provided
- ⚠️ Use at your own risk

### Attribution (Optional but Appreciated)
```
Data sources:
- Zoning: City of Atlanta Department of City Planning
- Parcels: Fulton County Board of Assessors
```

---

## Contact Information

### Data Publishers

**Fulton County GIS**
- Website: https://www.fultoncountyga.gov/fcgis-home
- Email: GeoPortal.SupportTeam@fultoncountyga.gov
- Phone: (404) 612-6372

**City of Atlanta GIS**
- Website: https://gis.atlantaga.gov/
- Email: gishelp@atlantaga.gov

### For Questions About This Download
- Created by: JEDI RE automated acquisition
- Date: February 3, 2026
- Project: JEDI RE Phase 1A
- Contact: [Your contact information]

---

## Change Log

### 2026-02-03
- Initial download
- Atlanta zoning: 2,953 features acquired
- Fulton parcels: 2,000 sample features acquired
- Documentation created

---

## Next Steps

### Recommended Actions
1. ✅ Verify data loads correctly in your GIS software
2. ⚠️ **Download complete Fulton County parcel dataset** (see instructions above)
3. ✅ Reproject to appropriate coordinate system for analysis
4. ✅ Join zoning and parcel data on spatial relationship
5. ✅ Validate data quality for your specific use case

### Data Integration
For JEDI RE Phase 1A analysis:
1. Load both datasets into QGIS or ArcGIS
2. Spatial join parcels with zoning districts
3. Filter to area of interest (development zones)
4. Export combined dataset for financial analysis

---

## Additional Resources

- Fulton County GIS Portal: https://gisdata.fultoncountyga.gov/
- Atlanta Regional Commission Open Data: https://opendata.atlantaregional.com/
- Georgia GIS Clearinghouse: https://data.georgiaspatial.org/
- ArcGIS REST API Documentation: https://developers.arcgis.com/rest/

---

**Document Version:** 1.0  
**Last Updated:** February 3, 2026  
**Status:** Complete (with noted limitations)
