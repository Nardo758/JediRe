-- Phase 1A: Pro Forma stabilization window — annual granularity
-- Adds agent-computed and operator-override stabilization year columns to deal_assumptions.
-- stabilization_year: first year where vacancy ≤ threshold AND all subsequent years sustain it.
-- stabilization_year_override: operator manually pins the Pro Forma window start year (Layer 1).

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS stabilization_year INTEGER,
  ADD COLUMN IF NOT EXISTS stabilization_year_override INTEGER;
