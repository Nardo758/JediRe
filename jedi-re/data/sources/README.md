# JEDI RE Data Sources

This directory contains documentation and metadata for GIS data sources used in the JEDI RE project.

## Target Data Sources

### 1. Fulton County Parcel Data
- **Purpose**: Property parcel boundaries and attributes for Fulton County, GA
- **Format**: Shapefile or GeoJSON preferred
- **Attributes needed**: Parcel ID, address, property type, zoning, land use, assessed value, owner information
- **Update frequency**: Quarterly or annually

### 2. Atlanta Zoning District Boundaries
- **Purpose**: Zoning district boundaries for City of Atlanta
- **Format**: Shapefile or GeoJSON preferred
- **Attributes needed**: Zoning district code, description, allowed uses, height restrictions, FAR limits
- **Update frequency**: As zoning changes are adopted

## Identified Sources

### Fulton County Open Data Portal
- **URL**: https://data.fultoncountyga.gov/
- **Status**: Accessible but JavaScript-heavy, requires browser navigation
- **Platform**: Socrata Open Data
- **Notes**: Parcel data likely available but hard to locate programmatically

### Atlanta ArcGIS Hub
- **URL**: https://atlantaga.opendata.arcgis.com/
- **Status**: Accessible but JavaScript-heavy, requires browser interaction
- **Platform**: ArcGIS Hub
- **Notes**: Zoning data likely available in FeatureServer format

### Georgia GIS Clearinghouse
- **URL**: https://data.georgiaspatial.org/
- **Status**: Requires cookies, redirect issues
- **Notes**: May contain statewide GIS data

## Data Acquisition Status

| Data Type | Status | Last Checked | Notes |
|-----------|--------|--------------|-------|
| Fulton County Parcels | Manual Acquisition Required | 2026-02-03 | Source identified but requires browser navigation |
| Atlanta Zoning | Manual Acquisition Required | 2026-02-03 | Source identified but requires browser interaction |

## Investigation Summary
A comprehensive investigation was conducted on 2026-02-03. Key findings:

1. **Technical Limitations**: Modern government GIS portals use JavaScript frameworks that are difficult to access programmatically
2. **Access Restrictions**: Some sites block automated access
3. **Sources Identified**: Potential sources found but require manual/browser navigation
4. **Directory Structure**: Prepared for data storage when acquired

## Recommended Approach
1. **Short-term**: Use simulated data for development
2. **Medium-term**: Manual data acquisition when browser access is available
3. **Long-term**: Build automated data pipeline with proper browser automation

## File Organization

- `raw/`: Original downloaded files (preserve original format)
- `processed/`: Cleaned, transformed data ready for analysis
- `sources/`: Documentation and metadata about data sources
- `schemas/`: Data schema documentation

## Documentation Files
- `DATA_ACQUISITION_PROGRESS.md` - Detailed investigation log
- `DATA_ACQUISITION_SUMMARY.md` - Executive summary and recommendations
- `arcgis_services_found.json` - Partial ArcGIS services catalog