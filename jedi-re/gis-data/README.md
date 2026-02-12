# GIS Data for JEDI RE Phase 1A

## Quick Start

This directory contains GIS data for analyzing Atlanta real estate opportunities.

### Files

1. **atlanta_zoning_districts.geojson** (5.5 MB, 2,953 features)
   - Complete zoning district boundaries for Atlanta, GA
   - Includes zoning codes, height limits, and overlay districts
   
2. **fulton_parcels_complete.geojson** (319 MB, 171,029 features)
   - **COMPLETE** Fulton County tax parcels dataset
   - ✅ Comprehensive coverage of Fulton County
   - Includes Atlanta and surrounding areas

3. **fulton_parcels_sample.geojson** (3.2 MB, 2,000 features)
   - Small sample for quick testing/previews
   - Use fulton_parcels_complete.geojson for analysis

4. **DATA_SOURCES.md**
   - Complete documentation of data sources, licenses, and download methods
   - Instructions for obtaining full parcel dataset
   - Data quality notes and known limitations

## Quick View in QGIS

```bash
# Install QGIS if needed
sudo apt install qgis

# Open files
qgis atlanta_zoning_districts.geojson fulton_parcels_sample.geojson
```

## Quick View in Python

```python
import geopandas as gpd
import matplotlib.pyplot as plt

# Load data
zoning = gpd.read_file('atlanta_zoning_districts.geojson')
parcels = gpd.read_file('fulton_parcels_sample.geojson')

# Quick plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 7))
zoning.plot(ax=ax1, column='ZONECLASS', legend=True, cmap='tab20')
parcels.plot(ax=ax2, column='ZONING1', legend=False, cmap='Set3')
ax1.set_title('Atlanta Zoning Districts')
ax2.set_title('Fulton County Parcels (Sample)')
plt.show()

# Summary stats
print(f"Zoning types: {zoning['ZONECLASS'].nunique()}")
print(f"Parcels: {len(parcels)}")
print(f"Total appraised value (sample): ${parcels['TOT_APPR'].sum():,.0f}")
```

## Data Status

✅ **Atlanta Zoning:** Complete dataset downloaded (2,953 features)  
✅ **Fulton Parcels:** Complete dataset downloaded (171,029 features)  
✅ **All data verified and ready for analysis**  

## Next Steps

1. Load into GIS software (QGIS, ArcGIS)
3. Spatial join zoning to parcels
4. Filter to target development areas
5. Export for financial analysis

## Support

See DATA_SOURCES.md for:
- Data source contacts
- License information
- Known issues and limitations
- Full documentation

---

**Downloaded:** February 3, 2026  
**Project:** JEDI RE Phase 1A  
**Region:** Atlanta, Georgia (Fulton County)
