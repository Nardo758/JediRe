-- Task #1180: Persist F3 Programming tab program targets so they survive page refresh.
-- Stores the full ProgramTargets object (unit mix %, target units/GFA/FAR/floors/height,
-- parking ratio, amenities, budget) as JSONB in deal_assumptions.
-- On load, the frontend hydrates useDesignProgramStore from this column.
-- On change (debounced), PUT /api/v1/deals/:dealId/f3-program writes it back.

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS f3_design_program JSONB;

COMMENT ON COLUMN deal_assumptions.f3_design_program IS
  'F3 Programming tab program targets (ProgramTargets JSON). Null = not yet set by operator.';
