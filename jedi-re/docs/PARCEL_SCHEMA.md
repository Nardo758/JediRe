# Parcel & Development Capacity Schema

## Overview

This schema tracks land parcels, their development capacity, and detailed zoning analysis for the JEDI RE platform. It enables identification and analysis of multifamily development opportunities across target markets.

---

## Tables

### 1. `parcels`

**Purpose**: Core parcel information — the land itself.

**Key Fields**:
- `parcel_id` (PK): Auto-incrementing unique identifier
- `apn`: Assessor's Parcel Number (unique per county/state)
- `address`: Street address
- `lot_size_sqft`: Parcel size in square feet
- `current_zoning`: Current zoning designation (e.g., 'R-3', 'MU-2', 'C-1')
- `current_units`: Existing number of dwelling units (0 if vacant land)
- `coordinates_lat` / `coordinates_lon`: Geographic location

**Indexes**:
- `idx_parcels_apn`: Fast lookup by APN
- `idx_parcels_location`: City/state filtering
- `idx_parcels_zoning`: Filter by zoning code
- `idx_parcels_coordinates`: Geographic queries

**Notes**:
- Unique constraint on `(apn, county, state)` prevents duplicates
- Coordinates use decimal degrees; can upgrade to PostGIS `GEOMETRY` type for advanced GIS operations
- `current_units = 0` typically indicates vacant or underutilized land

---

### 2. `development_capacity`

**Purpose**: Analysis results showing how many units can be built on each parcel.

**Key Fields**:
- `parcel_id` (FK): Links to `parcels` table
- `maximum_buildable_units`: Max units permitted under zoning + incentives
- `development_potential`: Qualitative rating ('HIGH', 'MEDIUM', 'LOW', 'NONE')
- `confidence_score`: Model confidence (0.000 to 1.000)
- `analysis_date`: When this analysis was performed
- `analysis_version`: Algorithm version for tracking changes over time

**Additional Metrics**:
- `buildable_sqft`: Total buildable square footage
- `estimated_construction_cost`: Rough construction cost estimate
- `estimated_land_value`: Estimated land value based on analysis
- `limiting_factors`: Array of constraints (e.g., 'height restrictions', 'parking requirements')
- `opportunities`: Array of upside factors (e.g., 'TOD incentives', 'affordable housing bonus')

**Indexes**:
- `idx_dev_capacity_parcel`: Join with parcels
- `idx_dev_capacity_date`: Time-based queries (latest analysis)
- `idx_dev_capacity_potential`: Filter high-potential parcels
- `idx_dev_capacity_confidence`: Sort by analysis confidence

**Usage Pattern**:
- New analysis creates a new row (history preserved)
- Use `latest_parcel_capacity` view for most recent results
- `CASCADE DELETE`: If parcel is deleted, all analyses are removed

---

### 3. `parcel_zoning_analysis`

**Purpose**: Detailed zoning calculations and rule applications — the "show your work" table.

**Key Sections**:

#### Density & FAR (Floor Area Ratio)
- `base_far`: Base allowable FAR under zoning
- `bonus_far`: Additional FAR from density bonuses/incentives
- `effective_far`: Total FAR used in calculation
- `max_height_ft`, `max_stories`: Vertical limits

#### Coverage & Setbacks
- `lot_coverage_pct`: Percentage of lot that can be covered by building
- `max_lot_coverage_pct`: Zoning limit
- `front_setback_ft`, `rear_setback_ft`, `side_setback_ft`: Required setbacks

#### Parking
- `parking_ratio`: Required parking spaces per unit (e.g., 1.5)
- `required_parking_spaces`: Total spaces needed

#### Unit Density
- `base_units_per_acre`: Base density allowed
- `bonus_units_per_acre`: Additional density from incentives
- `effective_units_per_acre`: Actual density used

#### Affordable Housing
- `affordable_unit_pct`: Required percentage of affordable units
- `required_affordable_units`: Number of affordable units needed

#### Special Conditions
- `overlay_zones`: Array of overlay zones (e.g., 'Historic District', 'TOD')
- `special_permits_required`: Permits needed beyond standard approvals
- `variances_needed`: Variances required if design doesn't comply
- `eligible_incentives`: Available incentive programs

#### Compliance
- `complies_with_zoning`: Boolean flag
- `requires_rezoning`: True if parcel needs rezoning to achieve max capacity

**Indexes**:
- `idx_zoning_analysis_parcel`: Link to parcel
- `idx_zoning_analysis_dev_capacity`: Link to capacity analysis
- `idx_zoning_analysis_code`: Filter by zoning code
- `idx_zoning_analysis_compliance`: Find non-compliant or rezoning-required parcels

---

## Views

### `latest_parcel_capacity`

**Purpose**: Quick access to the most recent development capacity analysis for each parcel.

**Returns**:
- Parcel identifiers (parcel_id, apn, address)
- Physical attributes (lot size, current zoning, existing units)
- Latest capacity analysis (max buildable units, potential rating, confidence)
- **Calculated field**: `net_new_units` = `maximum_buildable_units - current_units`
- Cost estimates

**Usage**:
```sql
-- Find high-potential parcels with strong confidence
SELECT apn, address, net_new_units, development_potential, confidence_score
FROM latest_parcel_capacity
WHERE development_potential = 'HIGH'
  AND confidence_score > 0.75
ORDER BY net_new_units DESC
LIMIT 20;
```

---

## Relationships

```
parcels (1) ──→ (many) development_capacity
                         │
                         └──→ (many) parcel_zoning_analysis
```

- One parcel can have multiple capacity analyses over time
- Each capacity analysis can have multiple zoning analysis records (e.g., testing different scenarios)
- Cascading deletes ensure referential integrity

---

## Data Flow

1. **Ingest Parcel Data**: Insert into `parcels` table
   - Source: County assessor data, Regrid API, manual entry
   - Fields: APN, address, lot size, coordinates, current zoning

2. **Run Development Capacity Analysis**: Insert into `development_capacity`
   - Algorithm calculates max buildable units
   - Assigns potential rating and confidence score
   - Records limiting factors and opportunities

3. **Store Zoning Calculations**: Insert into `parcel_zoning_analysis`
   - Detailed FAR, setback, parking, density calculations
   - Links to parent capacity analysis
   - Documents rule applications and compliance

4. **Query for Opportunities**: Use `latest_parcel_capacity` view
   - Filter by potential, confidence, net new units
   - Join with submarkets for market context
   - Feed into deal pipeline

---

## Performance Considerations

### Indexing Strategy
- **APN lookups**: Primary access pattern for parcel updates → indexed
- **Geographic queries**: Lat/lon indexed; consider PostGIS for complex spatial queries
- **Time-based queries**: Analysis dates indexed DESC for "latest" queries
- **Filtering**: Potential rating, zoning code, compliance flags indexed

### View Usage
- `latest_parcel_capacity` uses `DISTINCT ON (parcel_id)` for efficiency
- Materialized view option if dataset grows large (refresh periodically)

### Array Fields
- PostgreSQL native array support for multi-valued attributes
- Use `ANY`, `ALL`, or `@>` operators for array queries
- Example: `WHERE 'Density Bonus' = ANY(eligible_incentives)`

---

## Example Queries

### Find vacant land with high development potential
```sql
SELECT 
    p.apn,
    p.address,
    p.lot_size_sqft,
    dc.maximum_buildable_units,
    dc.confidence_score,
    dc.limiting_factors,
    dc.opportunities
FROM parcels p
JOIN development_capacity dc ON dc.parcel_id = p.parcel_id
WHERE p.current_units = 0
  AND dc.development_potential = 'HIGH'
  AND dc.analysis_date = (
      SELECT MAX(analysis_date) 
      FROM development_capacity 
      WHERE parcel_id = p.parcel_id
  )
ORDER BY dc.maximum_buildable_units DESC;
```

### Parcels requiring rezoning with high upside
```sql
SELECT 
    p.apn,
    p.address,
    p.current_zoning,
    pza.zoning_code AS recommended_zoning,
    dc.maximum_buildable_units,
    (dc.maximum_buildable_units - p.current_units) AS net_new_units
FROM parcels p
JOIN development_capacity dc ON dc.parcel_id = p.parcel_id
JOIN parcel_zoning_analysis pza ON pza.development_capacity_id = dc.id
WHERE pza.requires_rezoning = true
  AND dc.development_potential IN ('HIGH', 'MEDIUM')
ORDER BY net_new_units DESC;
```

### Parcels eligible for density bonus programs
```sql
SELECT 
    p.apn,
    p.address,
    pza.eligible_incentives,
    pza.bonus_units_per_acre,
    dc.maximum_buildable_units
FROM parcels p
JOIN development_capacity dc ON dc.parcel_id = p.parcel_id
JOIN parcel_zoning_analysis pza ON pza.development_capacity_id = dc.id
WHERE 'Density Bonus' = ANY(pza.eligible_incentives)
  AND pza.analysis_date = (
      SELECT MAX(analysis_date)
      FROM parcel_zoning_analysis
      WHERE parcel_id = p.parcel_id
  );
```

---

## Data Sources

### Parcel Data
- **County Assessor**: APN, address, lot size, current zoning
- **Regrid API**: Parcel boundaries, coordinates
- **Manual entry**: For specific target parcels

### Zoning Rules
- **Municipal zoning codes**: Planning department websites, zoning ordinances
- **Zoning APIs**: Zoning Atlas, local GIS portals
- **TOD/Overlay zones**: Special district maps

### Development Capacity Calculations
- **JEDI RE algorithm**: Proprietary model combining zoning rules, market conditions, constraints
- **Version tracking**: `analysis_version` field enables A/B testing and improvements

---

## Migration & Setup

### Create Tables
```bash
# From project root
psql -h localhost -U jedi_user -d jedi_re < src/database_schema.sql
```

### Verify Schema
```sql
-- Check table creation
\dt parcels
\dt development_capacity
\dt parcel_zoning_analysis

-- Check indexes
\di idx_parcels_*
\di idx_dev_capacity_*
\di idx_zoning_analysis_*

-- Verify view
SELECT * FROM latest_parcel_capacity LIMIT 5;
```

---

## Future Enhancements

### PostGIS Integration
Upgrade coordinate fields to native geometry types for advanced spatial analysis:
```sql
-- Add PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column
ALTER TABLE parcels 
ADD COLUMN geom GEOMETRY(Point, 4326);

-- Populate from lat/lon
UPDATE parcels 
SET geom = ST_SetSRID(ST_MakePoint(coordinates_lon, coordinates_lat), 4326);

-- Create spatial index
CREATE INDEX idx_parcels_geom ON parcels USING GIST(geom);
```

### Timeseries Tracking
Track how development capacity changes over time (zoning amendments, new incentives):
- Convert `development_capacity` to hypertable
- Enable time-travel queries
- Trend analysis on buildable units

### Machine Learning Integration
- Store ML model metadata (features, weights, performance metrics)
- Link predictions to `confidence_score`
- Enable model versioning and A/B testing

---

## Change Log

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-01-06 | 1.0     | Initial schema creation                      |

---

## Contact

For questions or schema change requests, contact the JEDI RE development team.
