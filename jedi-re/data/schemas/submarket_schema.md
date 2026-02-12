# Submarket Data Schema

## Overview
This document describes the data schema for submarket information in the JEDI RE system. This schema will be populated with real data from Fulton County parcel data and Atlanta zoning data once acquired.

## Core Submarket Attributes

### Geographic Identification
| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `id` | string | Unique identifier for submarket | Generated |
| `name` | string | Submarket name (e.g., "Buckhead, Atlanta") | Manual/Geocoding |
| `county` | string | County name | Fulton County Parcel Data |
| `city` | string | City name | Atlanta Zoning Data |
| `boundary_geometry` | GeoJSON | Geographic boundary polygon | Fulton County Parcels + Atlanta Zoning |

### Demographic Data
| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `population` | integer | Total population | Census API |
| `population_growth_rate` | float | Annual population growth rate (decimal) | Census API |
| `net_migration_annual` | integer | Net annual migration | Census API |
| `employment` | integer | Total employment | BLS/Census |
| `employment_growth_rate` | float | Annual employment growth rate (decimal) | BLS/Census |
| `median_income` | integer | Median household income | Census API |

### Housing Supply Data
| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `existing_units` | integer | Existing housing units | Fulton County Parcel Data |
| `pipeline_units` | integer | Units under construction | Building Permits |
| `future_permitted_units` | integer | Permitted future units | Building Permits |
| `zoning_district` | string | Primary zoning district | Atlanta Zoning Data |
| `zoning_allowed_density` | float | Allowed units per acre | Atlanta Zoning Data |

### Rental Market Data
| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `rent_timeseries` | array[float] | Historical rent data | Apartment Scrapers |
| `vacancy_rate` | float | Current vacancy rate | Market Reports |
| `rent_growth_annual` | float | Annual rent growth rate | Calculated |

## Data Sources Integration

### Primary Sources (To be acquired)
1. **Fulton County Parcel Data**
   - Parcel boundaries
   - Property attributes
   - Land use codes
   - Assessed values

2. **Atlanta Zoning Data**
   - Zoning district boundaries
   - Zoning regulations
   - Allowed uses
   - Density restrictions

### Secondary Sources (Planned)
1. **US Census API** - Demographic data
2. **BLS API** - Employment data
3. **Apartment Scrapers** - Rental data
4. **Building Permits** - Pipeline data

## Data Relationships

```
Fulton County Parcels → Submarket Boundaries
Atlanta Zoning → Zoning Attributes
Census Data → Demographic Attributes
Rent Scrapers → Market Performance
```

## Sample Data Structure
```json
{
  "id": "buckhead_atlanta",
  "name": "Buckhead, Atlanta",
  "county": "Fulton",
  "city": "Atlanta",
  "boundary_geometry": {"type": "Polygon", "coordinates": [...]},
  "population": 50000,
  "population_growth_rate": 0.015,
  "zoning_district": "C-2",
  "existing_units": 12000,
  "rent_timeseries": [2000, 2010, 2005, ...]
}
```

## Next Steps for Schema Implementation
1. **Acquire GIS data** - Fulton County parcels and Atlanta zoning
2. **Process boundaries** - Create submarket polygons from parcel aggregation
3. **Enrich with attributes** - Add demographic and market data
4. **Validate schema** - Test with real data integration
5. **Document updates** - Update this schema as new data sources are added