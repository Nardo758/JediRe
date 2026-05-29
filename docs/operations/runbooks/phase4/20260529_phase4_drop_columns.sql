-- Phase 4 — DROP Time-Varying Columns from properties
-- Spec: docs/architecture/property-plumbing-implementation-map.md §Phase 4
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- RUN MANUALLY — do NOT apply via drizzle-kit migrate.
-- This file lives in docs/operations/runbooks/phase4/ intentionally,
-- outside the backend/src/database/migrations/ path that drizzle-kit watches.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DO NOT APPLY until:
--   1. phase4_drop_tables.sql has been applied and verified clean
--   2. Window 2 (read revocation on columns) clean for ≥ 7 days
--   3. grep confirms zero reads on these columns from application code
--   4. Phase 3 reader migration confirms each column is served exclusively
--      by property_characteristics or property_operating_data for all readers
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- TIME-VARYING COLUMNS TARGETED
-- ------------------------------
-- These columns existed on `properties` before Phase 1 and have been
-- fully migrated to the new schema by Phase 3:
--
--   | properties column    | New home                                 |
--   |----------------------|------------------------------------------|
--   | building_class       | property_characteristics.current_building_class |
--   | units                | property_characteristics.unit_count      |
--   | building_sf          | property_characteristics.building_sf     |
--   | current_occupancy    | property_operating_data.occupancy        |
--   | acquisition_price    | deals table (deal-level, not property-level) |
--
-- COLUMNS RETAINED ON properties (identity + immutable)
-- -------------------------------------------------------
--   id, address_line1, address_line2, city, state_code, zip
--   lat, lng, latitude, longitude
--   parcel_id, parcel_id_canonical, parcel_id_status
--   property_type, year_built
--   deal_id (reverse FK; deprecated in spirit but retained until Phase 5)
--   owner_name, ownership_status
--   msa_id, submarket_id
--   is_superseded, predecessor_property_id, superseded_at
--   created_by, created_at, updated_at
--
-- COLUMN-DROP GATE
-- ----------------
-- From task spec Step 2: "From the reader audit (Phase 3), list every
-- properties column that has been fully migrated to property_characteristics.
-- These are the target columns for the two-window sequence. Do not drop any
-- column that does not appear in this list."
--
-- The list above is the Phase 3-verified target. If any column was NOT
-- confirmed migrated in Phase 3, remove it from the DROP statement below
-- before applying this migration.

-- ============================================================
-- Pre-flight: verify columns still exist (idempotency guard)
-- ============================================================

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'properties'
    AND column_name IN ('building_class', 'units', 'building_sf',
                        'current_occupancy', 'acquisition_price');

  IF col_count = 0 THEN
    RAISE NOTICE 'All target columns already dropped from properties. Migration is a no-op.';
    RETURN;
  END IF;

  RAISE NOTICE 'Dropping % time-varying column(s) from properties.', col_count;
END $$;

-- ============================================================
-- BATCH 1: Physical characteristics → property_characteristics
-- building_class, units, building_sf
-- ============================================================

BEGIN;

-- Verify property_characteristics has data before dropping source columns
DO $$
DECLARE
  char_count INT;
BEGIN
  SELECT COUNT(*) INTO char_count FROM property_characteristics;
  IF char_count = 0 THEN
    RAISE EXCEPTION
      'property_characteristics has 0 rows. Phase 2 backfill must complete '
      'before dropping source columns from properties.';
  END IF;
END $$;

ALTER TABLE properties
  DROP COLUMN IF EXISTS building_class,
  DROP COLUMN IF EXISTS units,
  DROP COLUMN IF EXISTS building_sf;

-- Post-batch schema check
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties'
      AND column_name IN ('building_class', 'units', 'building_sf')
  ) THEN
    RAISE EXCEPTION 'Batch 1 column drop failed — columns still present on properties';
  END IF;
  RAISE NOTICE 'Batch 1 complete: building_class, units, building_sf dropped from properties.';
END $$;

COMMIT;

-- ============================================================
-- BATCH 2: Operating metrics → property_operating_data
-- current_occupancy
-- ============================================================

BEGIN;

-- Verify property_operating_data has data before dropping source columns
DO $$
DECLARE
  opdata_count INT;
BEGIN
  SELECT COUNT(*) INTO opdata_count FROM property_operating_data;
  IF opdata_count = 0 THEN
    RAISE WARNING
      'property_operating_data has 0 rows. Verify Phase 2 operating data '
      'backfill (Backfill 4) completed for owned properties.';
    -- Not an exception — only owned deals have operating data in Phase 2 backfill
  END IF;
END $$;

ALTER TABLE properties
  DROP COLUMN IF EXISTS current_occupancy;

COMMIT;

-- ============================================================
-- BATCH 3: Deal-level fields incorrectly stored on properties
-- acquisition_price — belongs on deals, not on the property entity
-- ============================================================

BEGIN;

-- acquisition_price is deal-context, not property-level.
-- It was populated by the D-DEAL-1 backfill script from deals.budget.
-- The canonical value lives on deals. No migration needed — the value
-- was never canonical on properties.

ALTER TABLE properties
  DROP COLUMN IF EXISTS acquisition_price;

COMMIT;

-- ============================================================
-- Final schema verification
-- ============================================================

DO $$
DECLARE
  remaining_time_varying_cols TEXT[];
BEGIN
  -- Check that no time-varying columns remain
  SELECT ARRAY_AGG(column_name) INTO remaining_time_varying_cols
  FROM information_schema.columns
  WHERE table_name = 'properties'
    AND column_name IN ('building_class', 'units', 'building_sf',
                        'current_occupancy', 'acquisition_price');

  IF ARRAY_LENGTH(remaining_time_varying_cols, 1) > 0 THEN
    RAISE EXCEPTION
      'Phase 4 column drop incomplete. Still present: %',
      remaining_time_varying_cols;
  END IF;

  RAISE NOTICE
    'Phase 4 DROP COLUMNS complete. properties table narrowed to identity + '
    'immutable fields only. Phase 4 acceptance gate: CLEAR.';
END $$;
