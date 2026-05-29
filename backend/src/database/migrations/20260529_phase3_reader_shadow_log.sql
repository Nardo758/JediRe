-- Phase 3 — Reader Migration Shadow Log
-- Captures divergences between old and new property schema code paths.
-- Written by Phase3ShadowService; swallowed on failure (never breaks production).

CREATE TABLE IF NOT EXISTS property_reader_shadow_log (
  id           BIGSERIAL PRIMARY KEY,
  reader_id    TEXT        NOT NULL,
  entity_id    TEXT        NOT NULL,
  field        TEXT        NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  match        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup by reader for daily divergence reports
CREATE INDEX IF NOT EXISTS property_reader_shadow_log_reader_created
  ON property_reader_shadow_log (reader_id, created_at DESC);

-- Divergence-only index for fast "is this reader clean?" queries
CREATE INDEX IF NOT EXISTS property_reader_shadow_log_divergences
  ON property_reader_shadow_log (reader_id, created_at DESC)
  WHERE match = FALSE;

COMMENT ON TABLE property_reader_shadow_log IS
  'Phase 3 reader migration shadow comparison log. '
  'Each row is a field-level comparison between the old and new code paths. '
  'A reader may be promoted to canary only after 7 days with zero divergences.';
