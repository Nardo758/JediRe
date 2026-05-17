-- F-010: Clear OM-contaminated override values across all deals
--
-- Root cause: Before Task #832 added override_source='operator' stamping to
-- applyUserOverride, some seeder versions wrote broker OM values directly into
-- the override slot of LayeredValue without any source tag. When the om: layer
-- was later introduced (separate commit), those pre-existing override values
-- happened to match the om values exactly, making them indistinguishable from
-- real operator overrides and blocking agent + t12 resolution.
--
-- This migration identifies and clears ALL contaminated overrides where:
--   override IS NOT NULL
--   AND om IS NOT NULL
--   AND override = om            (exact numeric match)
--   AND override_source IS NULL  (no operator stamp — pre-Task#832 era)
--
-- Affected tables: deal_assumptions.year1, deal_underwriting_scenarios.year1
--
-- Safe to re-run: the WHERE conditions are idempotent.
-- After this migration, the F-010 write-path guard in proforma-seeder.service.ts
-- provides ongoing defense-in-depth so this contamination cannot recur.

DO $$
DECLARE
  da_contaminated_before  INTEGER;
  ds_contaminated_before  INTEGER;
  da_contaminated_after   INTEGER;
  ds_contaminated_after   INTEGER;
  da_row                  RECORD;
  ds_row                  RECORD;
  new_year1               JSONB;
  field_key               TEXT;
  field_val               JSONB;
BEGIN

  -- ── Pre-flight counts ──────────────────────────────────────────────────────

  SELECT COUNT(DISTINCT deal_id) INTO da_contaminated_before
  FROM deal_assumptions,
  LATERAL jsonb_each(year1) AS j(key, value)
  WHERE year1 IS NOT NULL
    AND (value->>'override') IS NOT NULL
    AND (value->>'om') IS NOT NULL
    AND (value->>'override') = (value->>'om')
    AND (value->>'override_source') IS NULL;

  SELECT COUNT(DISTINCT deal_id) INTO ds_contaminated_before
  FROM deal_underwriting_scenarios,
  LATERAL jsonb_each(year1) AS j(key, value)
  WHERE year1 IS NOT NULL
    AND deleted_at IS NULL
    AND (value->>'override') IS NOT NULL
    AND (value->>'om') IS NOT NULL
    AND (value->>'override') = (value->>'om')
    AND (value->>'override_source') IS NULL;

  RAISE NOTICE 'F-010 pre-fix: % deal_assumptions deals contaminated, % scenario deals contaminated',
    da_contaminated_before, ds_contaminated_before;

  -- ── Remediate deal_assumptions ─────────────────────────────────────────────
  --
  -- For each contaminated row, iterate all year1 fields and clear the override
  -- slot where it equals om with no source. Re-resolve resolved/resolution from
  -- the next best available source (t12 → om → platform → platform_fallback).
  -- The agent slot is NOT touched — any agent value already written is preserved.

  FOR da_row IN
    SELECT deal_id, year1
    FROM deal_assumptions
    WHERE year1 IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_each(year1) AS j(key, value)
        WHERE (value->>'override') IS NOT NULL
          AND (value->>'om') IS NOT NULL
          AND (value->>'override') = (value->>'om')
          AND (value->>'override_source') IS NULL
      )
  LOOP
    new_year1 := da_row.year1;

    FOR field_key, field_val IN SELECT key, value FROM jsonb_each(da_row.year1) LOOP
      -- Only process fields with LV shape: has both override and om
      IF (field_val->>'override') IS NULL
         OR (field_val->>'om') IS NULL
         OR (field_val->>'override') <> (field_val->>'om')
         OR (field_val->>'override_source') IS NOT NULL
      THEN
        CONTINUE;
      END IF;

      -- Clear override and override_source
      field_val := field_val
        || jsonb_build_object('override', NULL::text)
        || jsonb_build_object('override_source', NULL::text);

      -- Re-resolve: if agent has a value, agent wins
      IF (field_val->>'agent') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'agent')::numeric)
          || jsonb_build_object('resolution', 't12');
        -- Note: resolution stays 'agent' if agent is set
        field_val := field_val || jsonb_build_object('resolution', 'agent');
      -- Then t12
      ELSIF (field_val->>'t12') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'t12')::numeric)
          || jsonb_build_object('resolution', 't12');
      -- Then om (as next best source, not an override)
      ELSIF (field_val->>'om') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'om')::numeric)
          || jsonb_build_object('resolution', 'om');
      -- Then platform
      ELSIF (field_val->>'platform') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'platform')::numeric)
          || jsonb_build_object('resolution', 'platform_fallback');
      ELSE
        field_val := field_val
          || jsonb_build_object('resolved', NULL::text)
          || jsonb_build_object('resolution', 'platform_fallback');
      END IF;

      new_year1 := jsonb_set(new_year1, ARRAY[field_key], field_val, false);
    END LOOP;

    UPDATE deal_assumptions
    SET year1 = new_year1, updated_at = NOW()
    WHERE deal_id = da_row.deal_id;
  END LOOP;

  -- ── Remediate deal_underwriting_scenarios ──────────────────────────────────

  FOR ds_row IN
    SELECT id, deal_id, year1
    FROM deal_underwriting_scenarios
    WHERE year1 IS NOT NULL
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_each(year1) AS j(key, value)
        WHERE (value->>'override') IS NOT NULL
          AND (value->>'om') IS NOT NULL
          AND (value->>'override') = (value->>'om')
          AND (value->>'override_source') IS NULL
      )
  LOOP
    new_year1 := ds_row.year1;

    FOR field_key, field_val IN SELECT key, value FROM jsonb_each(ds_row.year1) LOOP
      IF (field_val->>'override') IS NULL
         OR (field_val->>'om') IS NULL
         OR (field_val->>'override') <> (field_val->>'om')
         OR (field_val->>'override_source') IS NOT NULL
      THEN
        CONTINUE;
      END IF;

      field_val := field_val
        || jsonb_build_object('override', NULL::text)
        || jsonb_build_object('override_source', NULL::text);

      IF (field_val->>'agent') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'agent')::numeric)
          || jsonb_build_object('resolution', 'agent');
      ELSIF (field_val->>'t12') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'t12')::numeric)
          || jsonb_build_object('resolution', 't12');
      ELSIF (field_val->>'om') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'om')::numeric)
          || jsonb_build_object('resolution', 'om');
      ELSIF (field_val->>'platform') IS NOT NULL THEN
        field_val := field_val
          || jsonb_build_object('resolved', (field_val->>'platform')::numeric)
          || jsonb_build_object('resolution', 'platform_fallback');
      ELSE
        field_val := field_val
          || jsonb_build_object('resolved', NULL::text)
          || jsonb_build_object('resolution', 'platform_fallback');
      END IF;

      new_year1 := jsonb_set(new_year1, ARRAY[field_key], field_val, false);
    END LOOP;

    UPDATE deal_underwriting_scenarios
    SET year1 = new_year1, updated_at = NOW()
    WHERE id = ds_row.id;
  END LOOP;

  -- ── Post-fix counts ────────────────────────────────────────────────────────

  SELECT COUNT(DISTINCT deal_id) INTO da_contaminated_after
  FROM deal_assumptions,
  LATERAL jsonb_each(year1) AS j(key, value)
  WHERE year1 IS NOT NULL
    AND (value->>'override') IS NOT NULL
    AND (value->>'om') IS NOT NULL
    AND (value->>'override') = (value->>'om')
    AND (value->>'override_source') IS NULL;

  SELECT COUNT(DISTINCT deal_id) INTO ds_contaminated_after
  FROM deal_underwriting_scenarios,
  LATERAL jsonb_each(year1) AS j(key, value)
  WHERE year1 IS NOT NULL
    AND deleted_at IS NULL
    AND (value->>'override') IS NOT NULL
    AND (value->>'om') IS NOT NULL
    AND (value->>'override') = (value->>'om')
    AND (value->>'override_source') IS NULL;

  RAISE NOTICE 'F-010 post-fix: % deal_assumptions deals contaminated (was %), % scenario deals contaminated (was %)',
    da_contaminated_after, da_contaminated_before,
    ds_contaminated_after, ds_contaminated_before;

  IF da_contaminated_after > 0 OR ds_contaminated_after > 0 THEN
    RAISE WARNING 'F-010: % + % contaminated rows remain after remediation — investigate manually',
      da_contaminated_after, ds_contaminated_after;
  END IF;

END $$;
