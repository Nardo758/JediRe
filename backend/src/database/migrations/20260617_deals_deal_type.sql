-- Task #1239 / Task #1233 — Add deal_type column to deals table
-- This column is the canonical deal classification (existing, value_add, development,
-- redevelopment, lease_up, stabilized) used by Pattern B routing, RegimeExpand,
-- tab visibility, and the cashflow agent prompt selector.
-- The A2-derived wire (Task #1233) writes this column whenever the operator saves
-- investmentStrategy via PATCH /assumptions/strategy.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deal_type TEXT;

COMMENT ON COLUMN deals.deal_type IS
  'Canonical deal classification: existing | value_add | development | redevelopment | lease_up | stabilized. '
  'Written by the A2-derived wire when operator saves investmentStrategy (Task #1233). '
  'Consumed by Pattern B routing, RegimeExpand, tab visibility, cashflow agent prompt selection.';
