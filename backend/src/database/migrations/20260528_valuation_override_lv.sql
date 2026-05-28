-- Migration: 20260528_valuation_override_lv
-- Task: #1370 Valuation Grid — multi-method price triangulation
-- Description: Adds valuation_override_lv JSONB column to deal_assumptions
--              for the Operator Override method in the Valuation Grid (V0.1).
--
--   valuation_override_lv stores a LayeredValue<number> JSON object:
--     { resolved, layers: { operator: { value, rationale, updatedAt } }, resolvedFrom, alertLevel }

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS valuation_override_lv JSONB;

COMMENT ON COLUMN deal_assumptions.valuation_override_lv IS
  'Operator-set purchase price override for the Valuation Grid (Task #1370).
   LayeredValue<number> — resolved value is the operator-asserted indicated value.
   Null = no override set (Method 4 shown as INSUFFICIENT in the grid).';
