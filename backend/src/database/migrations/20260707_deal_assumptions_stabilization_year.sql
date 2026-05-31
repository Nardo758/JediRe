-- Phase 1A: Pro Forma stabilization window
-- Adds agent-computed stabilization year and operator override to deal_assumptions.
-- stabilization_target_pct (the vacancy threshold) already exists from a prior migration.

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS stabilization_year          INTEGER,
  ADD COLUMN IF NOT EXISTS stabilization_year_override INTEGER;

COMMENT ON COLUMN deal_assumptions.stabilization_year IS
  'Agent-computed: first hold-period year where projected vacancy ≤ (1 − stabilization_target_pct) and all subsequent years also satisfy the threshold. Null when no year qualifies within the hold period. Written by the Cashflow Agent pipeline.';

COMMENT ON COLUMN deal_assumptions.stabilization_year_override IS
  'Operator override: manually anchors the Pro Forma window to a specific hold-period year. Takes precedence over agent-computed stabilization_year when set.';
