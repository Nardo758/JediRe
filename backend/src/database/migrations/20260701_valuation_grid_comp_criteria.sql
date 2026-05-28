-- Task #1417: Valuation Grid — Comp Override UX
-- Adds comp_criteria JSONB column to deal_assumptions so operators can persist
-- tunable selection parameters (radius, maxAgeMonths) and excluded comp IDs.
-- Shape: {
--   radiusMiles?: number,
--   maxAgeMonths?: number,
--   minUnits?: number,
--   maxUnits?: number,
--   propertyClasses?: string[],
--   excludedCompIds?: string[]   -- UUIDs of market_sale_comps rows to skip
-- }

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS comp_criteria JSONB;
