-- Phase 4 — Window 1: Write Permission Revocation
-- Spec: docs/architecture/property-plumbing-implementation-map.md §Phase 4
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- RUN MANUALLY — do NOT apply via drizzle-kit migrate.
-- This file lives in docs/operations/runbooks/phase4/ intentionally,
-- outside the backend/src/database/migrations/ path that drizzle-kit watches.
-- Premature application before Phase 3 completes is irreversible from a
-- monitoring-window perspective; apply only after operator confirmation.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- DO NOT APPLY until Phase 3 acceptance criteria are ALL MET:
--   - Every reader (R-001 through R-037) at flag=true for ≥ 30 days
--   - grep confirms zero reads on deprecated tables in application code
--   - property_reader_shadow_log clean for 30-day window
--   - rent-scraper-aggregation.service.ts raw SQL reader migrated (see unitMix.schema.ts note)
--
-- PURPOSE
-- -------
-- Revoke INSERT/UPDATE/DELETE on all deprecated tables. For the `properties`
-- table, revoke table-level UPDATE and re-grant it on identity columns only
-- (excluding the 5 time-varying columns being deprecated). This surfaces any
-- missed writers as permission-denied errors in application logs BEFORE
-- columns/tables are permanently dropped.
--
-- WHY TABLE-LEVEL REVOKE + COLUMN RE-GRANT FOR properties
-- -------------------------------------------------------
-- In PostgreSQL, column-level REVOKE UPDATE cannot override an existing
-- table-level GRANT UPDATE. If app_user holds table-level UPDATE on properties,
-- REVOKE UPDATE (col1, col2, ...) FROM app_user is a no-op — the role retains
-- write access through the table-level grant.
-- The correct pattern is:
--   1. REVOKE UPDATE ON TABLE properties FROM app_user  (drop table-level)
--   2. GRANT UPDATE (id_col1, id_col2, ...) ON TABLE properties TO app_user
--      (re-grant only identity columns)
-- This makes any UPDATE touching a time-varying column fail with PERMISSION
-- DENIED, surfacing missed writers during the 7-day window.
--
-- SEQUENCE
-- --------
-- 1. Apply on staging first; confirm no permission-denied errors in 24 hours.
-- 2. Apply to production.
-- 3. Monitor for 7 full calendar days (docs/operations/PHASE4_MONITORING.md).
-- 4. If any permission-denied errors appear → DO NOT PROCEED. Identify the
--    missed writer, resolve it, and restart the 7-day window.
-- 5. After 7 days clean → apply Window 2 (20260529_phase4_window2_read_revoke.sql).
--
-- ROLE OVERRIDE — HOW TO SET THE APPLICATION ROLE
-- ------------------------------------------------
-- SET and script execution MUST happen in the same psql session.
-- A separate psql invocation cannot see a session-local SET from a prior run.
--
-- Option A — single psql invocation (recommended):
--   psql "$DATABASE_URL" \
--     -c "SET app.revoke_role = 'your_app_role';" \
--     -f docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql
--
-- Option B — heredoc (also single session):
--   psql "$DATABASE_URL" <<'EOF'
--   SET app.revoke_role = 'your_app_role';
--   \i docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql
--   EOF
--
-- If app.revoke_role is not set: checks for 'app_user' role automatically.
-- If 'app_user' does not exist: falls back to CURRENT_USER with WARNING.
--
-- Idempotent: REVOKE and GRANT are safe to re-apply.

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
    RAISE NOTICE 'Phase 4 Window 1: revoking write permissions from role ''%''.', target_role;
  END IF;

  PERFORM set_config('app.resolved_revoke_role', target_role, FALSE);
END $$;

-- ============================================================
-- DEPRECATED TABLES — Revoke all write permissions (table-level)
-- ============================================================

DO $$
DECLARE
  r TEXT := current_setting('app.resolved_revoke_role', FALSE);
BEGIN
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE deal_properties FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE property_sales_legacy FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE market_sale_comps FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE market_rent_comps FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE comp_properties FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE recorded_transactions FROM %I', r);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE property_records FROM %I', r);

  RAISE NOTICE 'Write permissions revoked on 7 deprecated tables from role ''%''.', r;
END $$;

-- ============================================================
-- properties — Table-level REVOKE then column-level re-grant
--
-- REVOKE table-level UPDATE so the subsequent column-level REVOKE
-- takes actual effect (column REVOKE cannot override table-level GRANT).
-- Then GRANT UPDATE only on identity columns, excluding the 5 deprecated
-- time-varying columns: building_class, units, building_sf,
-- current_occupancy, acquisition_price.
-- ============================================================

DO $$
DECLARE
  r              TEXT := current_setting('app.resolved_revoke_role', FALSE);
  identity_cols  TEXT;
  time_varying   TEXT[] := ARRAY[
    'building_class', 'units', 'building_sf', 'current_occupancy', 'acquisition_price'
  ];
BEGIN
  -- Step 1: Revoke table-level UPDATE on properties
  EXECUTE format('REVOKE UPDATE ON TABLE properties FROM %I', r);

  -- Step 2: Build the list of identity columns (all columns except time-varying)
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

  -- Step 3: Re-grant UPDATE only on identity columns
  EXECUTE format('GRANT UPDATE (%s) ON TABLE properties TO %I', identity_cols, r);

  RAISE NOTICE
    'properties: table-level UPDATE revoked and re-granted on identity columns only '
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
      still_has_priv := has_table_privilege(r, tbl, 'INSERT');
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table ''%'' does not exist — already dropped.', tbl;
      CONTINUE;
    END;

    IF still_has_priv THEN
      RAISE WARNING
        'Role ''%'' still has INSERT on ''%''. '
        'REVOKE may not have taken effect (single-role environment?). '
        'Enforcement relies on Phase 3 application-level write removal.',
        r, tbl;
      all_clean := FALSE;
    ELSE
      RAISE NOTICE 'VERIFIED: role ''%'' has no INSERT on ''%''.', r, tbl;
    END IF;
  END LOOP;

  -- Verify properties table-level UPDATE was revoked
  still_has_priv := has_table_privilege(r, 'properties', 'UPDATE');
  IF still_has_priv THEN
    RAISE WARNING
      'Role ''%'' still has table-level UPDATE on ''properties''. '
      'REVOKE step may not have succeeded.',
      r;
    all_clean := FALSE;
  ELSE
    RAISE NOTICE
      'VERIFIED: role ''%'' has no table-level UPDATE on ''properties'' '
      '(identity column UPDATE re-granted via column-level GRANT).',
      r;
  END IF;

  -- Verify column-level UPDATE grants are set by checking information_schema
  RAISE NOTICE
    'Column-level re-grant check: run this query to confirm identity columns have UPDATE: '
    'SELECT column_name FROM information_schema.column_privileges '
    'WHERE table_name=''properties'' AND privilege_type=''UPDATE'' AND grantee=''%'';',
    r;

  IF all_clean THEN
    RAISE NOTICE
      'Window 1 write revocation COMPLETE. Start 7-day monitoring window now. '
      'See docs/operations/PHASE4_MONITORING.md.';
  ELSE
    RAISE WARNING
      'Window 1 completed with warnings — review above before starting monitoring window.';
  END IF;
END $$;

-- ============================================================
-- Audit marker — update table comments
-- ============================================================

COMMENT ON TABLE deal_properties IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Read-only until Window 2 revokes SELECT and table is dropped. '
  'Replaced by deals.property_id canonical FK.';

COMMENT ON TABLE market_sale_comps IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Read-only until Window 2 revokes SELECT and table is dropped. '
  'Replaced by property_sales.';

COMMENT ON TABLE market_rent_comps IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Replaced by property_operating_data.';

COMMENT ON TABLE comp_properties IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Replaced by properties + property_characteristics.';

COMMENT ON TABLE recorded_transactions IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Replaced by property_sales.';

COMMENT ON TABLE property_records IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Replaced by property_info_cache + property_characteristics.';

COMMENT ON TABLE property_sales_legacy IS
  'PHASE 4 WINDOW 1 ACTIVE: Write permissions revoked. '
  'Backfilled to property_sales in Phase 2.';
