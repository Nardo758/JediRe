-- Migration: 20260508_strategy_fields_lv
-- Description: Adds LV-shaped JSONB columns for Investment Strategy and Exit Strategy,
--              backfills Exit Strategy from the old flat TEXT column, then drops it.
--
-- Task #613 — Strategy fields LV persistence (May 2026)
--
-- Shape per column:
--   { detected: { value, confidence, source } | null,  -- M08 writes here later
--     override: <enum-value> | null                     -- operator dropdown writes
--   }
-- Resolved = override ?? detected?.value ?? null  (computed at read time by the composer)
--
-- Investment Strategy enum (V1):  Build-to-Sell | Flip | Rental | Short-Term Rental
--   Aligns with M08 strategy table names so detected.value and override share a value space.
--   M08 wires the detected slot in a separate task.
-- Exit Strategy enum (unchanged): Sale | Refinance | Hold

BEGIN;

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS investment_strategy_lv JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_strategy_lv       JSONB DEFAULT NULL;

-- Backfill existing flat exit_strategy TEXT values into the LV shape.
-- Any deal that already had exit_strategy set gets its value in override;
-- detected stays null until M08 writes it.
UPDATE deal_assumptions
SET exit_strategy_lv = jsonb_build_object(
    'detected', NULL,
    'override', exit_strategy
  )
WHERE exit_strategy IS NOT NULL
  AND exit_strategy_lv IS NULL;

-- Drop the old flat column now that all values are migrated.
ALTER TABLE deal_assumptions DROP COLUMN IF EXISTS exit_strategy;

COMMENT ON COLUMN deal_assumptions.investment_strategy_lv IS
  'LayeredValue: {detected:{value,confidence,source}|null, override:enum|null}. '
  'Operator override enum: Build-to-Sell|Flip|Rental|Short-Term Rental. '
  'M08 writes detected slot. Resolved = override ?? detected.value ?? null.';

COMMENT ON COLUMN deal_assumptions.exit_strategy_lv IS
  'LayeredValue: {detected:{value,confidence,source}|null, override:enum|null}. '
  'Operator override enum: Sale|Refinance|Hold. '
  'M08 writes detected slot. Resolved = override ?? detected.value ?? null. '
  'Supersedes old exit_strategy TEXT column (dropped in this migration).';

COMMIT;
