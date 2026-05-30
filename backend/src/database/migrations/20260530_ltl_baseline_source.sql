-- Migration: Task #1540 (Piece B1 fix-pass) — LTL baseline source selector
--
-- ltl_baseline_source: operator-chosen signal that seeds the LTL trajectory.
-- When NULL, engine auto-selects: live (M07 lease-level) when present, else T12.
-- Operator can override to force T12 (to use the trailing average as baseline)
-- or force live (to use the current lease-level gap, even if higher than T12).
--
-- Valid values: 'live' | 't12' | NULL (auto)
-- Written via PATCH /:dealId/assumptions/ltl-controls
-- Read in proforma-adjustment.service.ts before projections IIFE.

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS ltl_baseline_source VARCHAR(10)
    CONSTRAINT ltl_baseline_source_check CHECK (ltl_baseline_source IN ('live', 't12'));

COMMENT ON COLUMN deal_assumptions.ltl_baseline_source IS
  'Operator-chosen LTL trajectory baseline source: ''live'' (M07 lease-level gap) or '
  '''t12'' (T12 trailing average). NULL = auto (live when present, else T12). '
  'Written via PATCH /:dealId/assumptions/ltl-controls.';
