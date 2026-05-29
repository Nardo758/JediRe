-- Phase 4 — Window 2: Read Permission Revocation
-- Spec: docs/architecture/property-plumbing-implementation-map.md §Phase 4
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- RUN MANUALLY — do NOT apply via drizzle-kit migrate.
-- This file lives in docs/operations/runbooks/phase4/ intentionally.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- DO NOT APPLY until Window 1 has been clean for 7 full calendar days:
--   - Zero permission-denied errors on write paths to deprecated tables
--   - Zero permission-denied errors on properties time-varying column writes
--   - Monitoring log in PHASE4_MONITORING.md showing 7 consecutive clean days
--
-- PURPOSE
-- -------
-- Revoke SELECT on all deprecated tables. For `properties`, revoke table-level
-- SELECT and re-grant it on identity columns only (excluding the 5 time-varying
-- columns). Any remaining readers of time-varying columns get a runtime error
-- BEFORE those columns are permanently dropped.
--
-- WHY TABLE-LEVEL REVOKE + COLUMN RE-GRANT FOR properties
-- -------------------------------------------------------
-- In PostgreSQL, column-level REVOKE SELECT cannot override a table-level
-- GRANT SELECT. If app_user holds table-level SELECT, revoking specific
-- columns is a no-op. The correct pattern is:
--   1. REVOKE SELECT ON TABLE properties FROM app_user  (drop table-level)
--   2. GRANT SELECT (col1, col2, ...) ON TABLE properties TO app_user
--      (re-grant only identity columns)
-- This makes SELECT of time-varying columns fail with PERMISSION DENIED,
-- surfacing missed readers before DROP.
--
-- SEQUENCE
-- --------
-- 1. Apply on staging first; confirm no errors for 24 hours.
-- 2. Apply to production.
-- 3. Monitor for 7 full calendar days (PHASE4_MONITORING.md).
-- 4. Any SELECT error → DO NOT PROCEED. Identify missed reader; resolve;
--    restart the 7-day window.
-- 5. After 7 days clean → apply drop_tables.sql then drop_columns.sql
--    in a single maintenance window.
--
-- ROLE OVERRIDE — HOW TO SET THE APPLICATION ROLE
-- ------------------------------------------------
-- SET and script execution MUST happen in the same psql session.
--
-- Option A — single psql invocation (recommended):
--   psql "$DATABASE_URL" \
--     -c "SET app.revoke_role = 'your_app_role';" \
--     -f docs/operations/runbooks/phase4/20260529_phase4_window2_read_revoke.sql
--
-- Option B — heredoc (also single session):
--   psql "$DATABASE_URL" <<'EOF'
--   SET app.revoke_role = 'your_app_role';
--   \i docs/operations/runbooks/phase4/20260529_phase4_window2_read_revoke.sql
--   EOF

-- ============================================================
-- Identify application role (dynamic — environment-safe)
-- ============================================================

DO $$
DECLARE
  target_role TEXT;
BEGIN
  target_role := NULLIF(current_setting('app.revoke_role', TRUE), '');

  IF target_role IS NULL THEN
    SELECT rolname INTO target_role FROM pg_roles WHERE rolname = 'app_user';
  END IF;

  IF target_role IS NULL THEN
    target_role := CURRENT_USER;
    RAISE WARNING
      'app.revoke_role not set and ''app_user'' role not found. '
      'Falling back to CURRENT_USER (%). '
      'Re-run with: psql -c "SET app.revoke_role=''rolename'';" -f <this-script>',
      target_role;
  ELSE
    RAISE NOTICE 'Phase 4 Window 2: revoking read permissions from role ''%''.', target_role;
  END IF;

  PERFORM set_config('app.resolved_revoke_role', target_role, FALSE);
END $$;

-- ============================================================
-- DEPRECATED TABLES — Revoke all read permissions (table-level)
-- ============================================================

DO $$
DECLARE
  r TEXT := current_setting('app.resolved_revoke_role', FALSE);
BEGIN
  EXECUTE format('REVOKE SELECT ON TABLE deal_properties FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE property_sales_legacy FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE market_sale_comps FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE market_rent_comps FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE comp_properties FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE recorded_transactions FROM %I', r);
  EXECUTE format('REVOKE SELECT ON TABLE property_records FROM %I', r);

  RAISE NOTICE 'SELECT revoked on 7 deprecated tables from role ''%''.', r;
END $$;

-- ============================================================
-- properties — Table-level REVOKE then column-level re-grant
--
-- REVOKE table-level SELECT then re-grant SELECT only on identity columns,
-- excluding the 5 deprecated time-varying columns. Any SELECT touching
-- building_class, units, building_sf, current_occupancy, or acquisition_price
-- will fail with PERMISSION DENIED, surfacing missed readers.
-- ============================================================

DO $$
DECLARE
  r              TEXT := current_setting('app.resolved_revoke_role', FALSE);
  identity_cols  TEXT;
  time_varying   TEXT[] := ARRAY[
    'building_class', 'units', 'building_sf', 'current_occupancy', 'acquisition_price'
  ];
BEGIN
  -- Step 1: Revoke table-level SELECT on properties
  EXECUTE format('REVOKE SELECT ON TABLE properties FROM %I', r);

  -- Step 2: Build list of identity columns (all except time-varying)
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO identity_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'properties'
    AND column_name  <> ALL(time_varying);

  IF identity_cols IS NULL THEN
    RAISE EXCEPTION
      'No identity columns found on properties table. '
      'Verify the table exists and information_schema is accessible.';
  END IF;

  -- Step 3: Re-grant SELECT only on identity columns
  EXECUTE format('GRANT SELECT (%s) ON TABLE properties TO %I', identity_cols, r);

  RAISE NOTICE
    'properties: table-level SELECT revoked and re-granted on identity columns only '
    '(excluded: building_class, units, building_sf, current_occupancy, acquisition_price) '
    'for role ''%''.',
    r;
END $$;

-- ============================================================
-- Post-revoke verification
-- Confirm revocations are in effect before starting the 7-day window.
-- ============================================================

DO $$
DECLARE
  r              TEXT := current_setting('app.resolved_revoke_role', FALSE);
  still_has_priv BOOLEAN;
  tbl            TEXT;
  tables         TEXT[] := ARRAY[
    'deal_properties', 'property_sales_legacy', 'market_sale_comps',
    'market_rent_comps', 'comp_properties', 'recorded_transactions', 'property_records'
  ];
  all_clean      BOOLEAN := TRUE;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      still_has_priv := has_table_privilege(r, tbl, 'SELECT');
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table ''%'' does not exist — already dropped.', tbl;
      CONTINUE;
    END;

    IF still_has_priv THEN
      RAISE WARNING
        'Role ''%'' still has SELECT on ''%''. '
        'REVOKE may not have taken effect (single-role environment?). '
        'Enforcement relies on Phase 3 read removal.',
        r, tbl;
      all_clean := FALSE;
    ELSE
      RAISE NOTICE 'VERIFIED: role ''%'' has no SELECT on ''%''.', r, tbl;
    END IF;
  END LOOP;

  -- Verify properties table-level SELECT was revoked
  still_has_priv := has_table_privilege(r, 'properties', 'SELECT');
  IF still_has_priv THEN
    RAISE WARNING
      'Role ''%'' still has table-level SELECT on ''properties''. '
      'REVOKE step may not have succeeded.',
      r;
    all_clean := FALSE;
  ELSE
    RAISE NOTICE
      'VERIFIED: role ''%'' has no table-level SELECT on ''properties'' '
      '(identity column SELECT re-granted via column-level GRANT).',
      r;
  END IF;

  -- Instruct operator to confirm time-varying columns are NOT selectable
  RAISE NOTICE
    'Column-level re-grant check: confirm time-varying columns are absent from: '
    'SELECT column_name FROM information_schema.column_privileges '
    'WHERE table_name=''properties'' AND privilege_type=''SELECT'' AND grantee=''%'';',
    r;

  IF all_clean THEN
    RAISE NOTICE
      'Window 2 read revocation COMPLETE. Start 7-day monitoring window now. '
      'See docs/operations/PHASE4_MONITORING.md. '
      'After 7 clean days → apply drop_tables.sql + drop_columns.sql.';
  ELSE
    RAISE WARNING
      'Window 2 completed with warnings — review above before starting monitoring window.';
  END IF;
END $$;

-- ============================================================
-- Update audit comments
-- ============================================================

COMMENT ON TABLE deal_properties IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Pending DROP after 7-day clean window. Replaced by deals.property_id.';

COMMENT ON TABLE market_sale_comps IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Pending DROP after 7-day clean window. Replaced by property_sales.';

COMMENT ON TABLE market_rent_comps IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Replaced by property_operating_data.';

COMMENT ON TABLE comp_properties IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Replaced by properties + property_characteristics.';

COMMENT ON TABLE recorded_transactions IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Replaced by property_sales.';

COMMENT ON TABLE property_records IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Replaced by property_info_cache + property_characteristics.';

COMMENT ON TABLE property_sales_legacy IS
  'PHASE 4 WINDOW 2 ACTIVE: Read+write permissions revoked. '
  'Backfilled to property_sales in Phase 2.';
