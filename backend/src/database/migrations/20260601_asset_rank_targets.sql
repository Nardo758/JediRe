-- Migration: asset_rank_targets
-- Persists per-property rank targets set by users in the RANK & COMPS drawer
-- of the Asset Hub. One row per (property_id, user_id) pair; upserted on save.

CREATE TABLE IF NOT EXISTS asset_rank_targets (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID         NOT NULL,
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_rank   INTEGER      NOT NULL DEFAULT 2,
  target_pcs    INTEGER,
  notes         TEXT,
  target_config JSONB        NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_rank_targets_property_user
  ON asset_rank_targets (property_id, user_id);
