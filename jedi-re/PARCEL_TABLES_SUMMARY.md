# Parcel Database Tables - Implementation Summary

## ✅ Completed Tasks

### 1. Created `parcels` Table
**Location**: `/home/leon/clawd/jedi-re/src/database_schema.sql` (lines added after supply tables)

**Fields**:
- `parcel_id` (SERIAL PRIMARY KEY) - Auto-incrementing unique ID
- `apn` (VARCHAR(50) NOT NULL) - Assessor's Parcel Number
- `address` (VARCHAR(500)) - Street address
- `lot_size_sqft` (DECIMAL(12,2)) - Parcel size
- `current_zoning` (VARCHAR(100)) - Current zoning code
- `current_units` (INTEGER DEFAULT 0) - Existing dwelling units
- `coordinates_lat`, `coordinates_lon` (DECIMAL) - Geographic coordinates
- `county`, `city`, `state` - Location identifiers
- `created_at`, `updated_at` - Timestamps

**Indexes**:
- `idx_parcels_apn` - Fast APN lookup
- `idx_parcels_location` - City/state filtering
- `idx_parcels_zoning` - Zoning code queries
- `idx_parcels_coordinates` - Geographic searches

**Constraints**:
- `UNIQUE(apn, county, state)` - Prevents duplicate parcels

---

### 2. Created `development_capacity` Table

**Fields**:
- `id` (SERIAL PRIMARY KEY)
- `parcel_id` (FK to parcels) - Links to parcel
- `maximum_buildable_units` (INTEGER) - Max units allowed
- `development_potential` (VARCHAR(50)) - Rating: HIGH/MEDIUM/LOW/NONE
- `confidence_score` (DECIMAL(4,3)) - Model confidence (0-1)
- `analysis_date` (TIMESTAMPTZ NOT NULL) - When analyzed
- `analysis_version` (VARCHAR(20)) - Algorithm version tracking
- `buildable_sqft` (DECIMAL(12,2)) - Total buildable area
- `estimated_construction_cost` (DECIMAL(15,2)) - Cost estimate
- `estimated_land_value` (DECIMAL(15,2)) - Land value estimate
- `limiting_factors` (TEXT[]) - Array of constraints
- `opportunities` (TEXT[]) - Array of opportunities
- `notes` (TEXT)
- Timestamps

**Indexes**:
- `idx_dev_capacity_parcel` - Parcel joins
- `idx_dev_capacity_date` - Time-based queries
- `idx_dev_capacity_potential` - Filter by potential rating
- `idx_dev_capacity_confidence` - Sort by confidence

**Behavior**:
- `ON DELETE CASCADE` - Removes analyses when parcel deleted
- Multiple analyses per parcel allowed (history tracking)

---

### 3. Created `parcel_zoning_analysis` Table

**Fields** (comprehensive zoning calculation storage):

**Zoning Rules**:
- `zoning_code`, `zoning_description`

**Density & FAR**:
- `base_far`, `bonus_far`, `effective_far`
- `max_height_ft`, `max_stories`

**Coverage & Setbacks**:
- `lot_coverage_pct`, `max_lot_coverage_pct`
- `front_setback_ft`, `rear_setback_ft`, `side_setback_ft`

**Parking**:
- `parking_ratio` (spaces per unit)
- `required_parking_spaces`

**Unit Density**:
- `base_units_per_acre`, `bonus_units_per_acre`, `effective_units_per_acre`

**Affordable Housing**:
- `affordable_unit_pct`
- `required_affordable_units`

**Special Conditions**:
- `overlay_zones` (TEXT[])
- `special_permits_required` (TEXT[])
- `variances_needed` (TEXT[])
- `eligible_incentives` (TEXT[])

**Compliance**:
- `complies_with_zoning` (BOOLEAN)
- `requires_rezoning` (BOOLEAN)

**Metadata**:
- `analysis_date`, `data_source`, `notes`

**Indexes**:
- `idx_zoning_analysis_parcel` - Parcel relationship
- `idx_zoning_analysis_dev_capacity` - Capacity analysis link
- `idx_zoning_analysis_code` - Zoning code filtering
- `idx_zoning_analysis_date` - Time-based queries
- `idx_zoning_analysis_compliance` - Compliance filtering

---

### 4. Created `latest_parcel_capacity` View

**Purpose**: Quick access to most recent capacity analysis per parcel

**Returns**:
- All parcel identifiers and attributes
- Latest capacity analysis metrics
- **Calculated**: `net_new_units` (max buildable - current units)
- Cost estimates

**Query Pattern**:
```sql
SELECT DISTINCT ON (parcel_id) ...
ORDER BY parcel_id, analysis_date DESC
```

---

### 5. Comprehensive Documentation

**File**: `/home/leon/clawd/jedi-re/docs/PARCEL_SCHEMA.md`

**Contents**:
- Table-by-table field explanations
- Index strategy and performance notes
- Relationship diagrams
- Example SQL queries for common use cases:
  - Find vacant land with high potential
  - Parcels requiring rezoning
  - Density bonus eligible parcels
- Data sources and flow
- Migration instructions
- Future enhancement roadmap (PostGIS, ML integration)

---

## Next Steps

### Immediate
1. **Start PostgreSQL**: Ensure Docker container is running
   ```bash
   cd /home/leon/clawd/jedi-re
   docker-compose up -d postgres
   ```

2. **Run Schema**: Apply the updated schema
   ```bash
   docker-compose exec postgres psql -U jedi_user -d jedi_re -f /app/src/database_schema.sql
   # OR
   psql -h localhost -U jedi_user -d jedi_re < src/database_schema.sql
   ```

3. **Verify Tables**:
   ```sql
   \dt parcels
   \dt development_capacity
   \dt parcel_zoning_analysis
   \d+ latest_parcel_capacity
   ```

### Data Loading
- **Source parcel data** from county assessor APIs or Regrid
- **Run development capacity algorithm** to populate analysis tables
- **Query view** for high-potential opportunities

---

## Schema Highlights

### Design Decisions

1. **History Preservation**: `development_capacity` allows multiple analyses per parcel over time
   - Track how estimates change as zoning rules update
   - A/B test different algorithms via `analysis_version`

2. **Array Fields**: PostgreSQL arrays for multi-valued attributes
   - `limiting_factors`, `opportunities`, `overlay_zones`, `eligible_incentives`
   - Cleaner than separate junction tables for these use cases

3. **Cascading Deletes**: Delete a parcel → all analyses removed automatically
   - Maintains referential integrity
   - Prevents orphaned records

4. **View for Performance**: `latest_parcel_capacity` pre-calculates net new units
   - Avoids repeated subqueries in application code
   - Can materialize if dataset grows large

5. **Future-Proof Coordinates**: 
   - Current: `coordinates_lat/lon` (simple decimals)
   - Upgrade path: PostGIS `GEOMETRY` type documented for spatial ops

### Performance Tuning

- **Indexes on foreign keys**: All FK relationships indexed
- **Composite index ready**: Can add `(city, state, development_potential)` if needed
- **Array operators**: Use `ANY`, `@>` for efficient array queries
- **Materialized view option**: If view queries become slow at scale

---

## Files Modified/Created

1. ✅ `/home/leon/clawd/jedi-re/src/database_schema.sql` - Updated with 3 new tables + 1 view
2. ✅ `/home/leon/clawd/jedi-re/docs/PARCEL_SCHEMA.md` - Comprehensive documentation
3. ✅ `/home/leon/clawd/jedi-re/PARCEL_TABLES_SUMMARY.md` - This summary file

---

## Success Criteria Met

- [x] `parcels` table created with all required fields
- [x] `development_capacity` table created with all required fields
- [x] `parcel_zoning_analysis` table created for detailed calculations
- [x] Appropriate indexes added for performance
- [x] Schema documented in `/home/leon/clawd/jedi-re/docs/PARCEL_SCHEMA.md`
- [x] Ready to load parcel data once database is running

**Status**: ✅ **Ready for deployment** - Apply schema to running PostgreSQL instance
