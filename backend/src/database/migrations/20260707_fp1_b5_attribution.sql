-- F-P1 Phase 2C / C4 (B5): Multi-user attribution columns on deal_assumption_overlays
-- Adds edited_by + edited_at to the dark overlay table (no live consumers yet).
-- Identity-neutral: metadata only, no output change.

BEGIN;

ALTER TABLE deal_assumption_overlays
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NOT NULL DEFAULT NOW();

-- Update the index to include edited_at for per-field history queries
DROP INDEX IF EXISTS idx_deal_assumption_overlays_deal;
CREATE INDEX IF NOT EXISTS idx_deal_assumption_overlays_deal
  ON deal_assumption_overlays (deal_id, field_key, snapshot_at DESC, edited_at DESC);

COMMIT;
