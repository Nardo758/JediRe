-- F-010 contamination cleanup migration
--
-- Root cause: legacy data written before Task #832 introduced override_source
-- stamping. Fields where override === om with no override_source were likely
-- created by an old code path that copied OM into the override slot.
--
-- This migration cleans all contaminated LayeredValues in deal_assumptions.year1
-- by clearing the override and re-resolving from t12 → om → platform.
--
-- The getOverride() guard and auto-healer already prevent new contamination,
-- but this removes the legacy data so the guards never need to fire.

-- Create a helper function to clean a single LayeredValue JSONB
CREATE OR REPLACE FUNCTION clean_f010_contamination(lv jsonb)
RETURNS jsonb AS $$
DECLARE
    ov  numeric := (lv->>'override')::numeric;
    omv numeric := (lv->>'om')::numeric;
    t12v numeric := (lv->>'t12')::numeric;
    plat numeric := (lv->>'platform')::numeric;
    new_resolved numeric;
    new_resolution text;
BEGIN
    -- Only clean if override === om AND override_source is absent/null
    IF lv->>'override_source' IS NOT NULL THEN
        RETURN lv; -- clean, leave as-is
    END IF;
    IF ov IS NULL OR omv IS NULL OR ov != omv THEN
        RETURN lv; -- not contaminated, leave as-is
    END IF;

    -- Re-resolve following the standard priority: t12 → om → platform → null
    IF t12v IS NOT NULL THEN
        new_resolved := t12v;
        new_resolution := 't12';
    ELSIF omv IS NOT NULL THEN
        new_resolved := omv;
        new_resolution := 'om';
    ELSIF plat IS NOT NULL THEN
        new_resolved := plat;
        new_resolution := 'platform_fallback';
    ELSE
        new_resolved := NULL;
        new_resolution := 'platform_fallback';
    END IF;

    RETURN jsonb_strip_nulls(
        lv
        - 'override'
        || jsonb_build_object(
            'resolved',   new_resolved,
            'resolution', new_resolution
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Apply cleanup to every deal_assumptions row
-- We iterate year1 keys dynamically because the field names vary by deal
DO $$
DECLARE
    rec record;
    year1_val jsonb;
    field_key text;
    lv_val jsonb;
    cleaned_lv jsonb;
    changed boolean := false;
    affected_count int := 0;
BEGIN
    FOR rec IN SELECT deal_id, year1 FROM deal_assumptions WHERE year1 IS NOT NULL LOOP
        year1_val := rec.year1;
        changed := false;

        -- Iterate all top-level keys in year1
        FOR field_key IN SELECT jsonb_object_keys(year1_val) LOOP
            lv_val := year1_val->field_key;
            -- Only process objects that look like LayeredValues (have 'resolved' or 'override')
            IF jsonb_typeof(lv_val) = 'object' AND (
                lv_val ? 'override' OR lv_val ? 'resolved'
            ) THEN
                cleaned_lv := clean_f010_contamination(lv_val);
                IF cleaned_lv != lv_val THEN
                    year1_val := jsonb_set(year1_val, ARRAY[field_key], cleaned_lv);
                    changed := true;
                END IF;
            END IF;
        END LOOP;

        IF changed THEN
            UPDATE deal_assumptions
            SET year1 = year1_val, updated_at = NOW()
            WHERE deal_id = rec.deal_id;
            affected_count := affected_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'F-010 cleanup: affected % deal_assumptions rows', affected_count;
END $$;

-- Also clean deal_underwriting_scenarios.year1 for active scenarios
-- (the trigger syncs to deal_assumptions, but we clean both to be safe)
DO $$
DECLARE
    rec record;
    year1_val jsonb;
    field_key text;
    lv_val jsonb;
    cleaned_lv jsonb;
    changed boolean := false;
    affected_count int := 0;
BEGIN
    FOR rec IN SELECT id, year1 FROM deal_underwriting_scenarios
               WHERE year1 IS NOT NULL AND is_active = TRUE AND deleted_at IS NULL LOOP
        year1_val := rec.year1;
        changed := false;

        FOR field_key IN SELECT jsonb_object_keys(year1_val) LOOP
            lv_val := year1_val->field_key;
            IF jsonb_typeof(lv_val) = 'object' AND (
                lv_val ? 'override' OR lv_val ? 'resolved'
            ) THEN
                cleaned_lv := clean_f010_contamination(lv_val);
                IF cleaned_lv != lv_val THEN
                    year1_val := jsonb_set(year1_val, ARRAY[field_key], cleaned_lv);
                    changed := true;
                END IF;
            END IF;
        END LOOP;

        IF changed THEN
            UPDATE deal_underwriting_scenarios
            SET year1 = year1_val, updated_at = NOW()
            WHERE id = rec.id;
            affected_count := affected_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'F-010 cleanup (scenarios): affected % scenario rows', affected_count;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS clean_f010_contamination(jsonb);

-- Add a comment to the deal_assumptions table documenting the fix
COMMENT ON TABLE deal_assumptions IS
    'Deal assumptions with LayeredValue fields. F-010 contamination (override===om with no override_source) was cleaned on 2026-06-20. All new overrides are stamped with override_source by applyUserOverride.';
