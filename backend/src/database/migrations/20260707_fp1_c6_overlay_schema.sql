-- F-P1 Phase 2D / C6 (R-C6-1): Overlay schema completion — add scenario_id,
-- superseded_by, superseded_at, field_path, and value_jsonb to the dark
-- deal_assumption_overlays table.
--
-- These columns enable the scenario decomposition (B2) by linking overlay rows
-- to their originating scenario and supporting field-level history.

BEGIN;

-- ── Add columns required for decomposition ─────────────────────────────────
ALTER TABLE deal_assumption_overlays
  ADD COLUMN IF NOT EXISTS scenario_id uuid REFERENCES deal_underwriting_scenarios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES deal_assumption_overlays(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS field_path text,  -- JSON path into year1 (e.g. 'noi', 'expenses.payroll')
  ADD COLUMN IF NOT EXISTS value_jsonb jsonb;  -- full LayeredValue or object when numeric value is insufficient

-- ── Update index to include scenario_id for fast per-scenario queries ───────
DROP INDEX IF EXISTS idx_deal_assumption_overlays_deal;
CREATE INDEX IF NOT EXISTS idx_deal_assumption_overlays_deal
  ON deal_assumption_overlays (deal_id, scenario_id, field_path, snapshot_at DESC, edited_at DESC);

-- ── Index for superseded_by (history traversal) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deal_assumption_overlays_superseded
  ON deal_assumption_overlays (superseded_by) WHERE superseded_by IS NOT NULL;

COMMIT;
