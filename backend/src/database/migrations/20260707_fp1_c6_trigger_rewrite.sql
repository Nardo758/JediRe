-- F-P1 Phase 2D / C6 (R-C6-2): New trigger for scenario decomposition.
-- Replaces trg_sync_underwriting_scenario: instead of copying the JSONB blob,
-- decomposes it into deal_assumption_overlays rows, then recomposes
-- deal_assumptions.year1 from those rows.

BEGIN;

-- ── Decompose + recompose function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_scenario_to_overlays()
RETURNS TRIGGER AS $$
DECLARE
  _key text;
  _val jsonb;
  _resolved numeric;
  _resolution text;
  _inserted_id uuid;
  _recomposed jsonb := '{}'::jsonb;
  _overlay jsonb;
BEGIN
  -- Only process active scenarios that are not soft-deleted
  IF NEW.is_active = FALSE OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- ── 1. DECOMPOSE: insert overlay rows from year1 blob ──────────────────────
  -- Supersede previous overlays for this scenario
  UPDATE deal_assumption_overlays
  SET superseded_at = NOW(),
      superseded_by = (
        SELECT id FROM deal_assumption_overlays
        WHERE deal_id = NEW.deal_id AND scenario_id = NEW.id AND superseded_at IS NULL
        ORDER BY snapshot_at DESC LIMIT 1
      )
  WHERE deal_id = NEW.deal_id AND scenario_id = NEW.id AND superseded_at IS NULL;

  -- Iterate over top-level keys in year1
  FOR _key, _val IN SELECT * FROM jsonb_each(NEW.year1)
  LOOP
    -- Skip metadata and non-numeric objects
    IF _key IN ('source_docs', '_boundary_context', 'last_seeded_at', '_unit_count',
                'other_income_user_lines') THEN
      CONTINUE;
    END IF;

    -- Extract resolved and resolution from LayeredValue or plain value
    IF jsonb_typeof(_val) = 'object' THEN
      _resolved := (_val->>'resolved')::numeric;
      _resolution := _val->>'resolution';
    ELSIF jsonb_typeof(_val) = 'number' THEN
      _resolved := _val::numeric;
      _resolution := 'plain';
    ELSE
      CONTINUE;  -- Skip arrays, nulls, etc.
    END IF;

    -- Handle nested objects (e.g. other_income_breakdown)
    IF _key = 'other_income_breakdown' AND jsonb_typeof(_val) = 'object' THEN
      DECLARE
        _sub_key text;
        _sub_val jsonb;
        _sub_resolved numeric;
        _sub_resolution text;
      BEGIN
        FOR _sub_key, _sub_val IN SELECT * FROM jsonb_each(_val)
        LOOP
          IF jsonb_typeof(_sub_val) = 'object' THEN
            _sub_resolved := (_sub_val->>'resolved')::numeric;
            _sub_resolution := _sub_val->>'resolution';
          ELSIF jsonb_typeof(_sub_val) = 'number' THEN
            _sub_resolved := _sub_val::numeric;
            _sub_resolution := 'plain';
          ELSE
            CONTINUE;
          END IF;

          INSERT INTO deal_assumption_overlays (
            deal_id, scenario_id, field_key, field_path, source_tag,
            value, value_text, value_jsonb, note, snapshot_at, created_at, updated_at
          ) VALUES (
            NEW.deal_id, NEW.id, _key, _key || '.' || _sub_key, COALESCE(_sub_resolution, 'unknown'),
            _sub_resolved, _sub_resolved::text, _sub_val, 'decomposed_from_year1', NOW(), NOW(), NOW()
          )
          RETURNING id INTO _inserted_id;
        END LOOP;
      END;
    ELSE
      -- Insert top-level overlay row
      INSERT INTO deal_assumption_overlays (
        deal_id, scenario_id, field_key, field_path, source_tag,
        value, value_text, value_jsonb, note, snapshot_at, created_at, updated_at
      ) VALUES (
        NEW.deal_id, NEW.id, _key, _key, COALESCE(_resolution, 'unknown'),
        _resolved, _resolved::text, _val, 'decomposed_from_year1', NOW(), NOW(), NOW()
      )
      RETURNING id INTO _inserted_id;
    END IF;
  END LOOP;

  -- ── 2. RECOMPOSE: build deal_assumptions.year1 from current overlays ────────
  _recomposed := '{}'::jsonb;
  FOR _overlay IN
    SELECT value_jsonb FROM deal_assumption_overlays
    WHERE deal_id = NEW.deal_id AND scenario_id = NEW.id AND superseded_at IS NULL
    ORDER BY field_path
  LOOP
    _recomposed := _recomposed || _overlay;
  END LOOP;

  -- Update deal_assumptions with the recomposed year1
  UPDATE deal_assumptions
  SET year1 = _recomposed,
      updated_at = NOW()
  WHERE deal_id = NEW.deal_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Replace the old trigger ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_underwriting_scenario ON deal_underwriting_scenarios;

CREATE TRIGGER trg_sync_underwriting_scenario
  AFTER INSERT OR UPDATE ON deal_underwriting_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_scenario_to_overlays();

COMMIT;
