-- Phase 4 — DROP Deprecated Tables
-- Spec: docs/architecture/property-plumbing-implementation-map.md §Phase 4
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- RUN MANUALLY — do NOT apply via drizzle-kit migrate.
-- This file lives in docs/operations/runbooks/phase4/ intentionally,
-- outside the backend/src/database/migrations/ path that drizzle-kit watches.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DO NOT APPLY until ALL of the following are confirmed:
--   1. Phase 3 acceptance criteria fully met (all 37 readers at flag=true
--      for ≥ 30 days; zero reads from deprecated tables in codebase)
--   2. Window 1 (write revocation) clean for ≥ 7 days
--   3. Window 2 (read revocation) clean for ≥ 7 days
--   4. pg_dump archive verified for each table (PROPERTY_REFACTOR_ARCHIVE.md)
--   5. This migration tested in full on staging environment
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- EXECUTION PLAN
-- --------------
-- Drop in dependency order to avoid FK constraint violations.
-- Each table is dropped in an explicit transaction with a FK validation
-- check after. If any FK violation surfaces → ROLLBACK; investigate.
--
-- Dependency order:
--   1. deal_properties             — no other table references it
--   2. property_sales_legacy       — no other table references it
--   3. sale_comp_set_members.market_comp_id FK → market_sale_comps (drop col first)
--   4. market_sale_comps           — after FK col dropped above
--   5. market_rent_comps           — no other table references it
--   6. comp_properties             — no other table references it
--   7. recorded_transactions       — no other table references it
--   8. property_records            — no other table references it
--
-- ARCHIVE VERIFICATION
-- --------------------
-- Before running, confirm pg_dump archives exist for all 7 tables:
--   grep -A5 "ARCHIVE REGISTRY" docs/operations/PROPERTY_REFACTOR_ARCHIVE.md
-- All 7 entries must have status = VERIFIED.

-- ============================================================
-- Pre-flight check: abort if any OTHER session has active reads
-- (will catch single-role environments where REVOKE had no effect)
-- ============================================================

DO $$
DECLARE
  active_conn INT;
BEGIN
  -- Exclude pg_backend_pid() to prevent self-match: the currently executing
  -- DO block itself contains the deprecated table names in its query text,
  -- so without this exclusion the check would always find ≥ 1 active match
  -- (itself) and abort every run.
  SELECT COUNT(*) INTO active_conn
  FROM pg_stat_activity
  WHERE state = 'active'
    AND pid <> pg_backend_pid()
    AND query ~* 'deal_properties|market_sale_comps|market_rent_comps|comp_properties|recorded_transactions|property_records|property_sales_legacy'
    AND query_start > NOW() - INTERVAL '1 minute';

  IF active_conn > 0 THEN
    RAISE EXCEPTION
      'Phase 4 DROP aborted: % active queries (from other sessions) touching '
      'deprecated tables detected. Wait for queries to complete and confirm '
      'monitoring window is clean.',
      active_conn;
  END IF;

  RAISE NOTICE 'Pre-flight: no external sessions touching deprecated tables. Proceeding.';
END $$;

-- ============================================================
-- STEP 1: DROP deal_properties
-- Replaced by: deals.property_id canonical FK
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS deal_properties;

-- Verify: deals.property_id column intact
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'property_id'
  ) THEN
    RAISE EXCEPTION 'deals.property_id missing after deal_properties drop — aborting';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- STEP 2: DROP property_sales_legacy
-- Replaced by: property_sales (canonical table; backfilled Phase 2)
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS property_sales_legacy;

-- Verify: property_sales intact
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'property_sales' AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'property_sales missing after property_sales_legacy drop — aborting';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- STEP 3: Remove sale_comp_set_members.market_comp_id FK column
-- This column references market_sale_comps(id) — must drop before
-- market_sale_comps can be dropped.
-- ============================================================

BEGIN;

-- Drop the FK column (added by 20260424_sale_comp_sets_fix.sql)
ALTER TABLE sale_comp_set_members
  DROP COLUMN IF EXISTS market_comp_id;

COMMIT;

-- ============================================================
-- STEP 4: DROP market_sale_comps
-- Replaced by: property_sales (canonical transaction + comp table)
-- Row estimate: 343K — archive verified before this step
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS market_sale_comps;

-- Verify: property_sales has data (rough sanity check)
DO $$
DECLARE
  sales_count INT;
BEGIN
  SELECT COUNT(*) INTO sales_count FROM property_sales;
  IF sales_count = 0 THEN
    RAISE WARNING 'property_sales has 0 rows after market_sale_comps drop. '
      'Verify Phase 2 backfill completed successfully.';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- STEP 5: DROP market_rent_comps
-- Replaced by: property_operating_data
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS market_rent_comps;

COMMIT;

-- ============================================================
-- STEP 6: DROP comp_properties
-- Replaced by: properties (identity) + property_characteristics (time-varying)
-- Note: comp_unit_types.comp_id FK references comp_properties(id).
-- Using CASCADE drops that constraint automatically.
-- comp_unit_types table itself is retained (not in Phase 4 deprecation list).
-- ============================================================

BEGIN;

-- CASCADE drops the FK constraint from comp_unit_types.comp_id automatically.
-- The comp_unit_types table and its rows are NOT dropped — only the FK is removed.
DROP TABLE IF EXISTS comp_properties CASCADE;

-- Verify comp_unit_types still exists (rows retained; FK constraint gone)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'comp_unit_types' AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'comp_unit_types was accidentally dropped with comp_properties CASCADE — investigate';
  END IF;
  RAISE NOTICE 'comp_unit_types retained (FK to comp_properties removed by CASCADE).';
END $$;

COMMIT;

-- ============================================================
-- STEP 7: DROP recorded_transactions
-- Replaced by: property_sales (source=county_recorded)
-- Row estimate: 12 — archive trivial
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS recorded_transactions;

COMMIT;

-- ============================================================
-- STEP 8: DROP property_records
-- Replaced by: property_info_cache (canonical assessor layer)
--              + property_characteristics (time-varying backfill)
-- Row estimate: 249K — archive verified before this step
-- 5 columns migrated to property_info_cache:
--   class_code, neighborhood_code, tax_district, assessor_url, property_class
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS property_records;

-- Verify: property_info_cache intact and non-empty
DO $$
DECLARE
  cache_count INT;
BEGIN
  SELECT COUNT(*) INTO cache_count FROM property_info_cache;
  IF cache_count = 0 THEN
    RAISE WARNING 'property_info_cache has 0 rows after property_records drop. '
      'Verify assessor pipeline is operational.';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- Post-drop schema verification
-- ============================================================

DO $$
DECLARE
  orphaned_fks INT;
BEGIN
  -- Check for any remaining FK constraints pointing to dropped tables
  SELECT COUNT(*) INTO orphaned_fks
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc
    ON rc.unique_constraint_name = tc.constraint_name
  WHERE tc.table_name IN (
    'deal_properties', 'market_sale_comps', 'market_rent_comps',
    'comp_properties', 'recorded_transactions', 'property_records',
    'property_sales_legacy'
  );

  IF orphaned_fks > 0 THEN
    RAISE EXCEPTION
      '% orphaned FK constraints still reference dropped tables. '
      'Investigate before marking Phase 4 Step 6 complete.',
      orphaned_fks;
  END IF;

  RAISE NOTICE 'Phase 4 DROP TABLES complete. All deprecated tables dropped. '
    'No orphaned FK constraints detected. Proceed to phase4_drop_columns.sql.';
END $$;
