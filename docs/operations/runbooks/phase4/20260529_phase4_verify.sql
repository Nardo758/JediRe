-- Phase 4 — Post-Drop Verification
-- Run immediately after applying drop_tables.sql + drop_columns.sql
-- to confirm the target schema state is correct.
--
-- This script is READ-ONLY. It performs no mutations.
-- Safe to re-run at any time.

-- ============================================================
-- 1. Confirm all 7 deprecated tables are absent
-- ============================================================

DO $$
DECLARE
  tbl           TEXT;
  deprecated    TEXT[] := ARRAY[
    'deal_properties',
    'property_sales_legacy',
    'market_sale_comps',
    'market_rent_comps',
    'comp_properties',
    'recorded_transactions',
    'property_records'
  ];
  still_exists  INT := 0;
BEGIN
  FOREACH tbl IN ARRAY deprecated LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE WARNING 'FAIL: Table ''%'' still exists — was not dropped.', tbl;
      still_exists := still_exists + 1;
    ELSE
      RAISE NOTICE 'PASS: Table ''%'' is absent.', tbl;
    END IF;
  END LOOP;

  IF still_exists = 0 THEN
    RAISE NOTICE 'PASS: All 7 deprecated tables confirmed absent.';
  ELSE
    RAISE WARNING 'FAIL: % deprecated table(s) still present.', still_exists;
  END IF;
END $$;

-- ============================================================
-- 2. Confirm 5 time-varying columns are absent from properties
-- ============================================================

DO $$
DECLARE
  col          TEXT;
  cols         TEXT[] := ARRAY[
    'building_class', 'units', 'building_sf', 'current_occupancy', 'acquisition_price'
  ];
  still_exists INT := 0;
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'properties'
        AND column_name  = col
    ) THEN
      RAISE WARNING 'FAIL: Column properties.% still exists — was not dropped.', col;
      still_exists := still_exists + 1;
    ELSE
      RAISE NOTICE 'PASS: Column properties.% is absent.', col;
    END IF;
  END LOOP;

  IF still_exists = 0 THEN
    RAISE NOTICE 'PASS: All 5 time-varying columns confirmed absent from properties.';
  ELSE
    RAISE WARNING 'FAIL: % time-varying column(s) still present on properties.', still_exists;
  END IF;
END $$;

-- ============================================================
-- 3. Confirm deals.property_id is the canonical FK
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'deals'
      AND column_name  = 'property_id'
  ) THEN
    RAISE NOTICE 'PASS: deals.property_id column exists (canonical FK).';
  ELSE
    RAISE WARNING 'FAIL: deals.property_id column missing — canonical FK may not be in place.';
  END IF;
END $$;

-- ============================================================
-- 4. Confirm comp_unit_types is retained (not cascade-dropped)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'comp_unit_types'
  ) THEN
    RAISE NOTICE 'PASS: comp_unit_types table retained.';
  ELSE
    RAISE WARNING 'FAIL: comp_unit_types table is absent — it may have been accidentally cascade-dropped.';
  END IF;
END $$;

-- ============================================================
-- 5. Confirm no orphaned FKs referencing dropped tables
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  fk_count INT := 0;
BEGIN
  FOR rec IN
    SELECT
      tc.table_name    AS fk_table,
      kcu.column_name  AS fk_col,
      ccu.table_name   AS ref_table
    FROM information_schema.table_constraints  tc
    JOIN information_schema.key_column_usage   kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name AND ccu.table_schema = rc.unique_constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema    = 'public'
      AND ccu.table_name IN (
        'deal_properties', 'property_sales_legacy', 'market_sale_comps',
        'market_rent_comps', 'comp_properties', 'recorded_transactions', 'property_records'
      )
  LOOP
    RAISE WARNING
      'FAIL: Orphaned FK: %.% references dropped table ''%''.',
      rec.fk_table, rec.fk_col, rec.ref_table;
    fk_count := fk_count + 1;
  END LOOP;

  IF fk_count = 0 THEN
    RAISE NOTICE 'PASS: No orphaned FKs referencing any of the 7 dropped tables.';
  END IF;
END $$;

-- ============================================================
-- 6. Replacement tables — row count sanity check
-- ============================================================

DO $$
DECLARE
  cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM property_sales;
  IF cnt > 0 THEN
    RAISE NOTICE 'PASS: property_sales has % rows (replacement for market_sale_comps + recorded_transactions + property_sales_legacy).', cnt;
  ELSE
    RAISE WARNING 'WARN: property_sales has 0 rows — verify Phase 2 backfill ran.';
  END IF;

  SELECT COUNT(*) INTO cnt FROM property_characteristics;
  IF cnt > 0 THEN
    RAISE NOTICE 'PASS: property_characteristics has % rows (replacement for time-varying columns).', cnt;
  ELSE
    RAISE WARNING 'WARN: property_characteristics has 0 rows — verify Phase 2 backfill ran.';
  END IF;

  SELECT COUNT(*) INTO cnt FROM property_info_cache;
  IF cnt > 0 THEN
    RAISE NOTICE 'PASS: property_info_cache has % rows (partial replacement for property_records).', cnt;
  ELSE
    RAISE WARNING 'WARN: property_info_cache has 0 rows.';
  END IF;
END $$;
