-- F9 Pro Forma Tier-2 (Spec §13): Save-driven versioning.
-- One row per user-triggered save of an F9 assumption snapshot.
-- Audit trail = saved versions only. Diff between any two versions powers
-- the F9 "compare to v3" picker; override_divergences feeds M22 attribution.

CREATE TABLE IF NOT EXISTS deal_versions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                  UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  version_number           INTEGER NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID,

  layered_state_snapshot   JSONB NOT NULL,
  model_versions           JSONB NOT NULL DEFAULT '{}'::jsonb,
  override_divergences     JSONB NOT NULL DEFAULT '[]'::jsonb,

  save_trigger             TEXT NOT NULL DEFAULT 'user_save'
                             CHECK (save_trigger IN ('user_save','chat_command','auto_prompt')),
  note                     TEXT,

  UNIQUE (deal_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_deal_versions_deal_id_created
  ON deal_versions (deal_id, created_at DESC);
